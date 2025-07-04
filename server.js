const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const { promises: fsPromises } = require('fs');
const path = require('path');
const onboardingRoutes = require('./routes/onboardingRoutes');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 20000,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));
app.use('/api', apiRoutes);

// --- Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        console.warn("[Auth] No token provided. Sending 401.");
        return res.sendStatus(401);
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn("[Auth] Invalid token provided. Sending 403. Error:", err.message);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'location_admin')) {
        next();
    } else {
        console.warn("[Auth] Access denied for user:", req.user?.id, "Role:", req.user?.role, ". Required: super_admin or location_admin.");
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
        await client.query(`INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', NULL) RETURNING user_id`, [fullName, email, hash]);
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
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, role: user.role, userId: user.user_id });
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
                u.availability,
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

apiRoutes.get('/users/availability', isAuthenticated, isAdmin, async (req, res) => {
    try {
        let query = `
            SELECT
                user_id,
                full_name,
                availability,
                location_id
            FROM users
        `;
        const params = [];
        if (req.user.role === 'location_admin') {
            query += ' WHERE location_id = $1';
            params.push(req.user.location_id);
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[Users Availability] Error retrieving user availability:', err);
        res.status(500).json({ error: 'Failed to retrieve user availability.' });
    }
});

// Invite a new Location Admin
apiRoutes.post('/invite-admin', isAuthenticated, isAdmin, async (req, res) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only Super Admins can invite new location admins.' });
    }
    const { full_name, email, password, location_id } = req.body;
    if (!full_name || !email || !password || !location_id) {
        return res.status(400).json({ error: 'Full name, email, password, and location are required.' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'location_admin', $4)`,
            [full_name, email, hash, location_id]
        );
        res.status(201).json({ message: 'Location admin invited successfully!' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A user with this email already exists.' });
        }
        console.error('[Admin] Error inviting location admin:', err);
        res.status(500).json({ error: 'Failed to invite location admin.' });
    }
});

// Invite a new Employee
apiRoutes.post('/invite-employee', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, password, position, employee_id, employment_type, location_id, availability } = req.body;
    if (!full_name || !email || !password || !location_id) {
        return res.status(400).json({ error: 'Full name, email, password, and location are required.' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO users (full_name, email, password, role, position, employee_identifier, employment_type, location_id, availability)
             VALUES ($1, $2, $3, 'employee', $4, $5, $6, $7, $8)`,
            [full_name, email, hash, position, employee_id, employment_type, location_id, availability]
        );
        res.status(201).json({ message: 'Employee invited successfully!' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A user with this email or employee ID already exists.' });
        }
        console.error('[Admin] Error inviting employee:', err);
        res.status(500).json({ error: 'Failed to invite employee.' });
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
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Location name already exists.' });
        }
        res.status(500).json({ error: 'Failed to add new location.' });
    }
});

// Business Settings Endpoint
apiRoutes.get('/settings/business', isAuthenticated, async (req, res) => {
    let targetLocationId;
    if (req.user.role === 'super_admin') {
        targetLocationId = req.query.location_id;
    } else {
        targetLocationId = req.user.location_id;
    }
    if (targetLocationId == null) {
        return res.json({ operating_hours_start: null, operating_hours_end: null });
    }
    try {
        const result = await pool.query(
            'SELECT operating_hours_start, operating_hours_end FROM business_settings WHERE location_id = $1',
            [targetLocationId]
        );
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.json({ operating_hours_start: null, operating_hours_end: null });
        }
    } catch (err) {
        console.error('[Backend] Error fetching business settings:', err);
        res.status(500).json({ error: 'Failed to retrieve business settings.' });
    }
});

apiRoutes.put('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    const { operating_hours_start, operating_hours_end, location_id: requestedLocationId } = req.body;
    let targetLocationId;
    if (req.user.role === 'super_admin') {
        targetLocationId = requestedLocationId || req.user.location_id;
    } else {
        targetLocationId = req.user.location_id;
    }
    if (targetLocationId == null) {
        return res.status(400).json({ error: 'A valid location must be associated with the user or specified to save business settings.' });
    }
    if (!operating_hours_start || !operating_hours_end) {
        return res.status(400).json({ error: 'Start and end operating hours are required.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO business_settings (location_id, operating_hours_start, operating_hours_end)
             VALUES ($1, $2, $3)
             ON CONFLICT (location_id) DO UPDATE SET
             operating_hours_start = EXCLUDED.operating_hours_start,
             operating_hours_end = EXCLUDED.operating_hours_end,
             updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [targetLocationId, operating_hours_start, operating_hours_end]
        );
        res.status(200).json({ message: 'Business settings updated successfully!', settings: result.rows[0] });
    } catch (err) {
        console.error('[Backend] Error updating business settings:', err);
        res.status(500).json({ error: 'Failed to update business settings.' });
    }
});

// --- Stripe Integration ---
apiRoutes.post('/create-checkout-session', isAuthenticated, async (req, res) => {
    const { plan } = req.body;
    const userId = req.user.id;
    const priceIds = {
        basic: process.env.PRICE_ID_BASIC,
        pro: process.env.PRICE_ID_PRO
    };
    const priceId = priceIds[plan];
    if (!priceId) {
        return res.status(400).json({ error: 'Invalid plan selected.' });
    }
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${process.env.YOUR_DOMAIN}/suite-hub.html?payment=success`,
            cancel_url: `${process.env.YOUR_DOMAIN}/pricing.html?payment=cancelled`,
            client_reference_id: userId
        });
        res.json({ id: session.id });
    } catch (err) {
        console.error("Stripe Error: Failed to create checkout session -", err.message);
        res.status(500).json({ error: 'Failed to initiate checkout.' });
    }
});

// Subscription Status Endpoint
apiRoutes.get('/subscription-status', isAuthenticated, async (req, res) => {
    try {
        // In a real app, you would look up the user's subscription status from your database
        // which would be updated via Stripe webhooks.
        // For now, we return a hardcoded plan.
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
    }
    catch (err) {
        console.error('Error retrieving job postings:', err);
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});

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

apiRoutes.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM job_postings WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting job posting:', err);
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});

// Applicants Routes
app.post('/apply/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const { name, email, address, phone, date_of_birth, availability, is_authorized } = req.body;
    if (!jobId || !name || !email || !availability) {
        return res.status(400).json({ error: 'Job ID, name, email, and availability are required.' });
    }
    try {
        const dobValue = date_of_birth ? date_of_birth : null;
        const result = await pool.query(
            `INSERT INTO applicants (job_id, name, email, address, phone, date_of_birth, availability, is_authorized) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [jobId, name, email, address, phone, dobValue, availability, is_authorized]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error submitting application:', err);
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Invalid Job Posting ID. The job you are applying for does not exist.' });
        }
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});

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
            LEFT JOIN job_postings jp ON a.job_id = jp.id
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

apiRoutes.delete('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM applicants WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Applicant not found.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting applicant:', err);
        res.status(500).json({ error: 'Failed to delete applicant.' });
    }
});

// Shift Management Routes
apiRoutes.get('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required for fetching shifts.' });
    }
    try {
        let query = `
            SELECT
                s.id,
                s.employee_id,
                u.full_name AS employee_name,
                s.location_id,
                l.location_name,
                s.start_time,
                s.end_time,
                s.notes
            FROM shifts s
            JOIN users u ON s.employee_id = u.user_id
            JOIN locations l ON s.location_id = l.location_id
            WHERE s.start_time >= $1 AND s.end_time <= $2
        `;
        const params = [startDate, endDate];
        let paramIndex = 3;
        if (req.user.role === 'location_admin') {
            query += ` AND s.location_id = $${paramIndex++}`;
            params.push(req.user.location_id);
        }
        query += ' ORDER BY s.start_time ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[Shifts] Error retrieving shifts:', err);
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});

apiRoutes.post('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    if (!employee_id || !location_id || !start_time || !end_time) {
        return res.status(400).json({ error: 'Employee, location, start time, and end time are required.' });
    }
    if (new Date(start_time) >= new Date(end_time)) {
        return res.status(400).json({ error: 'End time must be after start time.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [employee_id, location_id, start_time, end_time, notes]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Shifts] Error creating shift:', err);
        res.status(500).json({ error: 'Failed to create shift.' });
    }
});

apiRoutes.delete('/shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM shifts WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shift not found.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('[Shifts] Error deleting shift:', err);
        res.status(500).json({ error: 'Failed to delete shift.' });
    }
});

// Onboarding Routes
onboardingRoutes(apiRoutes, pool, isAuthenticated, isAdmin);

// Server Startup
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
