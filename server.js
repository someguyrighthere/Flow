// server.js - MASTER SOLUTION: FINAL, COMPLETE ROUTING FOR ALL API ROUTES

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- Router Imports ---
const createOnboardingRouter = require('./routes/onboardingRoutes');

const app = express();
const apiRoutes = express.Router(); // This will handle all routes prefixed with /api

// --- Configuration Variables ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;
const DATABASE_URL = process.env.DATABASE_URL;

// --- File Uploads Configuration ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir);
    } catch (err) {
        console.error(`[Server Setup] Error creating uploads directory: ${err.message}`);
    }
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

// --- Database Connection Setup ---
if (!DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is NOT set.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 20000,
});

// --- Express Global Middleware Configuration ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));

// --- Authentication & Authorization Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    
    jwt.verify(token, JWT_SECRET, { issuer: API_BASE_URL }, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'location_admin')) {
        next();
    } else {
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
};

// --- API ROUTES DEFINITION ---
// All private/protected API routes are defined on the 'apiRoutes' router.

// --- Authentication Routes ---
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const locationRes = await client.query(`INSERT INTO locations (location_name) VALUES ($1) RETURNING location_id`, [`${companyName} HQ`]);
        const newLocationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10);
        await client.query(`INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4) RETURNING user_id`, [fullName, email, hash, newLocationId]);
        await client.query('COMMIT');
        res.status(201).json({ message: "Registration successful!" });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(409).json({ error: "Email address is already registered." });
        res.status(500).json({ error: "An internal server error occurred." });
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
            return res.status(401).json({ error: "Invalid email or password." });
        }
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id, iat: Math.floor(Date.now() / 1000) };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d', issuer: API_BASE_URL });
        res.json({ token, role: user.role, userId: user.user_id });
    } catch (err) {
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

// --- User & Admin Routes ---
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role, location_id FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User profile not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.user_id, u.full_name, u.position, u.role, l.location_name 
            FROM users u 
            LEFT JOIN locations l ON u.location_id = l.location_id 
            ORDER BY u.full_name
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

apiRoutes.put('/users/me', isAuthenticated, async (req, res) => {
    const { full_name, email, current_password, new_password } = req.body;
    const userId = req.user.id;
    try {
        const userResult = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        
        let hashedPassword = userResult.rows[0].password;
        if (new_password) {
            if (!current_password || !(await bcrypt.compare(current_password, userResult.rows[0].password))) {
                return res.status(401).json({ error: 'Current password incorrect.' });
            }
            hashedPassword = await bcrypt.hash(new_password, 10);
        }

        const result = await pool.query(
            `UPDATE users SET full_name = $1, email = $2, password = $3 WHERE user_id = $4 RETURNING user_id, full_name, email, role`,
            [full_name, email, hashedPassword, userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email address is already in use.' });
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

apiRoutes.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    if (req.user.id === parseInt(id, 10)) return res.status(400).json({ error: "You cannot delete your own account." });
    try {
        await pool.query('DELETE FROM users WHERE user_id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

// --- Location Routes ---
apiRoutes.get('/locations', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY location_name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});

// --- Checklist Routes ---
apiRoutes.get('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM checklists ORDER BY position, title');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve checklists.' });
    }
});

apiRoutes.post('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    const { title, position, tasks } = req.body;
    if (!title || !position || !tasks) return res.status(400).json({ error: 'Missing required fields.' });
    try {
        const result = await pool.query(
            'INSERT INTO checklists (title, position, tasks) VALUES ($1, $2, $3) RETURNING *',
            [title, position, JSON.stringify(tasks)]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create checklist.' });
    }
});

// --- Document Routes ---
apiRoutes.get('/documents', isAuthenticated, isAdmin, async (req, res) => {
    try {
        // FIX: Changed JOIN to LEFT JOIN to include documents even if the uploader was deleted.
        const result = await pool.query(`
            SELECT d.document_id, d.title, d.description, d.file_name, d.uploaded_at, u.full_name as uploaded_by_name
            FROM documents d 
            LEFT JOIN users u ON d.uploaded_by = u.user_id
            ORDER BY d.uploaded_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});

apiRoutes.post('/documents', isAuthenticated, isAdmin, upload.single('document'), async (req, res) => {
    const { title, description } = req.body;
    const { filename } = req.file;
    try {
        const result = await pool.query(
            'INSERT INTO documents (title, description, file_name, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, description, filename, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to upload document.' });
    }
});

// --- Hiring Routes ---
apiRoutes.get('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT jp.id, jp.title, jp.created_at, l.location_name 
            FROM job_postings jp
            LEFT JOIN locations l ON jp.location_id = l.location_id
            ORDER BY jp.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching job postings:', err);
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
            'INSERT INTO job_postings (title, description, requirements, location_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, description, requirements, location_id]
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
        await pool.query('DELETE FROM job_postings WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});

apiRoutes.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.id, a.name, a.email, a.phone, a.applied_at, jp.title AS job_title
            FROM applicants a
            JOIN job_postings jp ON a.job_id = jp.id
            ORDER BY a.applied_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve applicants.' });
    }
});

apiRoutes.delete('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM applicants WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete applicant.' });
    }
});


// --- PUBLIC ROUTES ---
app.get('/job-postings/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`SELECT * FROM job_postings WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Job posting not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve job posting.' });
    }
});

app.post('/apply/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const { name, email, availability } = req.body;
    if (!name || !email || !availability) return res.status(400).json({ error: 'Name, email, and availability are required.' });
    try {
        const result = await pool.query(
            'INSERT INTO applicants (job_id, name, email, availability) VALUES ($1, $2, $3, $4) RETURNING *',
            [jobId, name, email, availability]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});

// --- MOUNT ROUTERS ---
const onboardingRouter = createOnboardingRouter(pool, isAuthenticated, isAdmin);
apiRoutes.use('/onboarding-tasks', onboardingRouter);

app.use('/api', apiRoutes);


// --- Server Startup Logic ---
const startServer = async () => {
    try {
        await pool.connect();
        console.log('--- DATABASE: Successfully Connected to PostgreSQL! ---');
        
        app.listen(PORT, '0.0.0.0', () => { 
            console.log(`--- SERVER: Express app listening successfully on port ${PORT}! ---`);
        });

    } catch (err) {
        console.error('CRITICAL ERROR: Failed to start server.', err.stack);
        process.exit(1); 
    }
};

startServer();
