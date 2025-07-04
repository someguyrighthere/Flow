const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const { promises: fsPromises } = require('fs');
const path = require('path');
const onboardingRoutes = require('./routes/onboardingRoutes'); // Make sure this path is correct

const app = express();
const apiRoutes = express.Router();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

if (!DATABASE_URL) {
    console.error("DATABASE_URL environment variable is not set. Please set it in your .env file or Render environment variables.");
    process.exit(1); // Exit if no database connection string
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Use rejectUnauthorized: false for Render's managed PostgreSQL
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 20000,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir)); // Serve uploaded files statically
app.use('/api', apiRoutes);

// --- Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        console.warn("[Auth] No token provided. Sending 401.");
        return res.sendStatus(401); // Unauthorized
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn("[Auth] Invalid token provided. Sending 403. Error:", err.message);
            return res.sendStatus(403); // Forbidden
        }
        req.user = user; // Attach user payload from token to request
        next();
    });
};
const isAdmin = (req, res, next) => {
    // Also consider req.user.location_id here if admin roles are location-specific
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'location_admin')) {
        next();
    } else {
        console.warn("[Auth] Access denied for user:", req.user?.id, "Role:", req.user?.role);
        return res.status(403).json({ error: 'Access denied.' });
    }
};

// --- API ROUTES ---

// Auth Routes
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const locationRes = await client.query(`INSERT INTO locations (location_name) VALUES ($1) RETURNING location_id`,[`${companyName} HQ`]);
        const locationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10);
        await client.query(`INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4) RETURNING user_id`, [fullName, email, hash, locationId]);
        await client.query('COMMIT');
        res.status(201).json({ message: "Registration successful!" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Register] Error during registration:', err);
        res.status(500).json({ error: "An internal server error occurred during registration." });
    } finally {
        client.release();
    }
});
apiRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(`SELECT user_id, full_name, email, password, role, location_id FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials." });
        }
        // Ensure user_id and location_id are sent in payload, even if null from DB (frontend handles null)
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, role: user.role, userId: user.user_id }); // Added userId to response for convenience
    } catch (err) {
        console.error('[Login] Error during login:', err);
        res.status(500).json({ error: "An internal server error occurred during login." });
    }
});

// User Routes
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role, location_id FROM users WHERE user_id = $1', [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[Users] Failed to retrieve user profile:', err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        let query = `
            SELECT 
                u.user_id, 
                u.full_name, 
                u.position, 
                u.role, 
                u.location_id,
                l.location_name  
            FROM users u
            LEFT JOIN locations l ON u.location_id = l.location_id 
        `;
        const params = [];
        let whereClause = '';
        if (req.user.role === 'location_admin') {
            whereClause = ' WHERE u.location_id = $1';
            params.push(req.user.location_id);
        }
        query += whereClause;
        query += ' ORDER BY u.full_name';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[Users] Error retrieving users:', err);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

// Locations Routes
apiRoutes.get('/locations', isAuthenticated, async (req, res) => {
    try {
        let query = 'SELECT location_id, location_name, location_address FROM locations';
        const params = [];
        if (req.user.role === 'location_admin') {
            query += ' WHERE location_id = $1';
            params.push(req.user.location_id);
        }
        query += ' ORDER BY location_name';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[Locations] Error retrieving locations:', err);
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});

apiRoutes.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
    const { location_name, location_address } = req.body;
    if (!location_name || !location_address) {
        return res.status(400).json({ error: 'Location name and address are required.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING *',
            [location_name, location_address]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Locations] Error adding new location:', err);
        if (err.code === '23505') { // Unique violation for location_name
            return res.status(409).json({ error: 'Location name already exists.' });
        }
        res.status(500).json({ error: 'Failed to add new location.' });
    }
});


// Business Settings Endpoint (for operating hours, etc.)
// GET: Fetch business settings
apiRoutes.get('/settings/business', isAuthenticated, async (req, res) => {
    // Ensure user has a valid location_id in their token
    if (!req.user || req.user.location_id == null) {
        console.warn("[Backend] GET /settings/business: User's location_id is null. Cannot fetch settings.");
        return res.status(400).json({ error: 'User is not associated with a location. Cannot retrieve business settings.' });
    }

    try {
        // Fetch settings for the user's location
        const result = await pool.query(
            'SELECT operating_hours_start, operating_hours_end FROM business_settings WHERE location_id = $1',
            [req.user.location_id]
        );
        
        if (result.rows.length > 0) {
            console.log("[Backend] Found business settings for location:", req.user.location_id, result.rows[0]);
            res.json(result.rows[0]); // Return actual settings if found
        } else {
            console.log("[Backend] No business settings found for location:", req.user.location_id, "Returning nulls.");
            res.json({ operating_hours_start: null, operating_hours_end: null }); // Return nulls if no settings found
        }
    } catch (err) {
        console.error('[Backend] Error fetching business settings:', err);
        res.status(500).json({ error: 'Failed to retrieve business settings.' });
    }
});

// PUT: Update business settings (specifically operating hours for now)
apiRoutes.put('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    const { operating_hours_start, operating_hours_end } = req.body;
    
    // Ensure user has a valid location_id in their token before proceeding with DB operations
    if (!req.user || req.user.location_id == null) {
        console.error("[Backend] PUT /settings/business: User's location_id is null. Cannot save business settings.");
        return res.status(400).json({ error: 'User is not associated with a location. Cannot save business settings.' });
    }

    if (!operating_hours_start || !operating_hours_end) {
        return res.status(400).json({ error: 'Start and end operating hours are required.' });
    }

    try {
        console.log("[Backend] Attempting to save business settings for location:", req.user.location_id);
        const result = await pool.query(
            `INSERT INTO business_settings (location_id, operating_hours_start, operating_hours_end)
             VALUES ($1, $2, $3)
             ON CONFLICT (location_id) DO UPDATE SET
             operating_hours_start = EXCLUDED.operating_hours_start,
             operating_hours_end = EXCLUDED.operating_hours_end,
             updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [req.user.location_id, operating_hours_start, operating_hours_end]
        );
        console.log("[Backend] Business settings saved/updated:", result.rows[0]);
        res.status(200).json({ message: 'Business settings updated successfully!', settings: result.rows[0] });
    } catch (err) {
        console.error('[Backend] Error updating business settings:', err);
        res.status(500).json({ error: 'Failed to update business settings.' });
    }
});


// Subscription Status Endpoint
apiRoutes.get('/subscription-status', isAuthenticated, async (req, res) => {
    try {
        res.json({ plan: 'Pro Plan' });
    }
    catch (err) {
        console.error('Error fetching subscription status:', err);
        res.status(500).json({ error: 'Failed to retrieve subscription status.' });
    }
});

// Checklist Routes
apiRoutes.get('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM checklists ORDER BY title');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve checklists.' });
    }
});

apiRoutes.post('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    const { title, position, tasks } = req.body;
    if (!title || !position || !tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: 'Title, position, and at least one task are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const checklistRes = await client.query(
            `INSERT INTO checklists (title, position, tasks, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
            [title, position, JSON.stringify(tasks), req.user.id]
        );
        const newChecklist = checklistRes.rows[0];

        await client.query('COMMIT');
        res.status(201).json({ message: 'Checklist created successfully!', checklist: newChecklist });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating checklist:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A checklist with this title/position might already exist.' });
        }
        res.status(500).json({ error: 'Failed to create checklist.' });
    } finally {
        client.release();
    }
});


// Document Routes
apiRoutes.get('/documents', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                d.document_id, 
                d.title, 
                d.description, 
                d.file_name, 
                d.uploaded_at,
                u.full_name as uploaded_by_name
            FROM documents d
            LEFT JOIN users u ON d.uploaded_by = u.user_id
            ORDER BY d.uploaded_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error retrieving documents:', err);
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});

apiRoutes.post('/documents', isAuthenticated, upload.single('document'), async (req, res) => {
    const { title, description } = req.body;
    const file = req.file;

    if (!title || !file) {
        if (file) {
            await fsPromises.unlink(file.path).catch(e => console.error("Error deleting partially uploaded file:", e));
        }
        return res.status(400).json({ error: 'Title and file are required.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO documents (title, description, file_name, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING *`,
            [title, description, file.filename, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (file) {
            await fsPromises.unlink(file.path).catch(e => console.error("Error deleting uploaded file after DB error:", e));
        }
        console.error('Error uploading document to DB:', err);
        res.status(500).json({ error: 'Failed to upload document.' });
    }
});

apiRoutes.delete('/documents/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    let filePathToDelete = null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const docRes = await client.query('SELECT file_name FROM documents WHERE document_id = $1', [id]);
        if (docRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Document not found.' });
        }
        filePathToDelete = path.join(uploadsDir, docRes.rows[0].file_name);

        await client.query('DELETE FROM documents WHERE document_id = $1', [id]);

        await client.query('COMMIT');

        if (filePathToDelete) {
            await fsPromises.unlink(filePathToDelete).catch(e => console.error("Error deleting physical file:", e));
        }
        
        res.status(204).send();
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting document:', err);
        res.status(500).json({ error: 'Failed to delete document.' });
    } finally {
        client.release();
    }
});


// Job Postings Routes
// GET a single job posting by ID (publicly accessible for apply page)
app.get('/job-postings/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                jp.id, 
                jp.title, 
                jp.description, 
                jp.requirements, 
                jp.created_at,
                l.location_name
            FROM job_postings jp
            LEFT JOIN locations l ON jp.location_id = l.location_id
            WHERE jp.id = $1
        `, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error retrieving single job posting:', err);
        res.status(500).json({ error: 'Failed to retrieve job posting.' });
    }
});


// GET all job postings (Admin only)
apiRoutes.get('/job-postings', isAuthenticated, async (req, res) => {
    try {
        let query = `
            SELECT 
                jp.id, 
                jp.title, 
                jp.description, 
                jp.requirements, 
                jp.created_at,
                l.location_name
            FROM job_postings jp
            LEFT JOIN locations l ON jp.location_id = l.location_id
            ORDER BY jp.created_at DESC
        `;
        const params = [];
        if (req.user.role === 'location_admin') {
            query += ' WHERE jp.location_id = $1';
            params.push(req.user.location_id);
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error retrieving job postings:', err);
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});

// POST a new job posting
apiRoutes.post('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const { title, description, requirements, location_id } = req.body;
    if (!title || !description || !location_id) {
        return res.status(400).json({ error: 'Title, description, and location are required.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO job_postings (title, description, requirements, location_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [title, description, requirements, location_id, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating job posting:', err);
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});

// DELETE a job posting
apiRoutes.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM job_postings WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found.' });
        }
        res.status(204).send(); // 204 No Content for successful deletion
    } catch (err) {
        console.error('Error deleting job posting:', err);
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});

// Applicants Routes (Public and Admin)
// Public endpoint for job application submission
app.post('/apply/:jobId', async (req, res) => {
    const { jobId } = req.params; // Get jobId from URL parameters
    const { name, email, address, phone, date_of_birth, availability, is_authorized } = req.body; // Get other fields from body

    // Basic validation for required fields
    if (!jobId || !name || !email || !availability) {
        return res.status(400).json({ error: 'Job ID, name, email, and availability are required.' });
    }

    try {
        // Ensure date_of_birth is handled correctly for optionality
        const dobValue = date_of_birth ? date_of_birth : null; // Set to null if empty string

        const result = await pool.query(
            `INSERT INTO applicants (job_id, name, email, address, phone, date_of_birth, availability, is_authorized) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            //                       ^^^^^^ CORRECTED: Changed from job_posting_id to job_id
            [jobId, name, email, address, phone, dobValue, availability, is_authorized]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error submitting application:', err);
        // Check for specific PostgreSQL error codes
        if (err.code === '23503') { // PostgreSQL foreign key violation error code
            return res.status(400).json({ error: 'Invalid Job Posting ID. The job you are applying for does not exist.' });
        }
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});

// GET all applicants (Admin only)
apiRoutes.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    try {
        let query = `
            SELECT 
                a.id, 
                a.name, 
                a.email, 
                a.phone, 
                a.applied_at,
                jp.title AS job_title,
                jp.location_id
            FROM applicants a
            LEFT JOIN job_postings jp ON a.job_posting_id = jp.id
        `;
        const params = [];
        if (req.user.role === 'location_admin') {
            query += ' WHERE jp.location_id = $1';
            params.push(req.user.location_id);
        }
        query += ' ORDER BY a.applied_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error retrieving applicants:', err);
        res.status(500).json({ error: 'Failed to retrieve applicants.' });
    }
});

// DELETE an applicant (archive)
apiRoutes.delete('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM applicants WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Applicant not found.' });
        }
        res.status(204).send(); // 204 No Content for successful deletion
    } catch (err) {
        console.error('Error deleting applicant:', err);
        res.status(500).json({ error: 'Failed to delete applicant.' });
    }
});


// Onboarding Routes
onboardingRoutes(apiRoutes, pool, isAuthenticated, isAdmin);

// The server startup logic
const startServer = async () => {
    try {
        const client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        client.release();
        app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port ${PORT}`));
    } catch (err) {
        console.error('Failed to start server:', err.stack);
        process.exit(1);
    }
};

startServer();
