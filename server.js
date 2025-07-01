// server.js

// --- 1. Imports and Setup ---
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const onboardingRoutes = require('./routes/onboardingRoutes');

// --- 2. Initialize Express App ---
const app = express();
const apiRoutes = express.Router();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

// --- Multer Storage Setup ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

// --- 3. Database Connection ---
if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
}
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- 4. Middleware ---
app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

// Static file serving
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// --- 5. Authentication Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin' && req.user.role !== 'location_admin') {
        return res.status(403).json({ error: 'Access denied.' });
    }
    next();
};

// --- 6. API Routes ---

// Public Registration and Login
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    if (!companyName || !fullName || !email || !password) {
        return res.status(400).json({ error: "All fields are required." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const locationRes = await client.query(
            `INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING location_id`,
            [`${companyName} HQ`, 'Default Address']
        );
        const locationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10);
        await client.query(
            `INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4)`,
            [fullName, email, hash, locationId]
        );
        await client.query('COMMIT');
        res.status(201).json({ message: "Registration successful! You can now log in." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Registration error:', err);
        if (err.code === '23505') return res.status(409).json({ error: "An account with this email already exists." });
        res.status(500).json({ error: "An internal server error occurred during registration." });
    } finally {
        client.release();
    }
});

apiRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        if (!user || !user.password) return res.status(401).json({ error: "Invalid credentials." });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials." });
        
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        
        res.json({ message: "Logged in successfully!", token: token, role: user.role, location_id: user.location_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

// Authenticated Routes
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

apiRoutes.get('/subscription-status', isAuthenticated, async (req, res) => {
    res.json({ plan: 'Free' }); 
});

// --- Admin Routes ---
apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    let sql;
    const params = [];
    if (req.user.role === 'super_admin') {
        sql = `SELECT u.user_id, u.full_name, u.email, u.role, u.position, l.location_name FROM users u LEFT JOIN locations l ON u.location_id = l.location_id ORDER BY u.role, u.full_name`;
    } else {
        sql = `SELECT u.user_id, u.full_name, u.email, u.role, u.position, l.location_name FROM users u LEFT JOIN locations l ON u.location_id = l.location_id WHERE u.location_id = $1 ORDER BY u.role, u.full_name`;
        params.push(req.user.location_id);
    }
    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

// --- Job Postings & Applicants Routes (ADDED BACK) ---
apiRoutes.get('/job-postings', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM job_postings ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching job postings:', err);
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});

apiRoutes.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const sql = `
            SELECT a.*, jp.title as job_title
            FROM applicants a
            JOIN job_postings jp ON a.job_posting_id = jp.id
            ORDER BY a.applied_at DESC;
        `;
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching applicants:', err);
        res.status(500).json({ error: 'Failed to retrieve applicants.' });
    }
});

// Modular Routes
onboardingRoutes(apiRoutes, pool, isAuthenticated, isAdmin);

// Fallback for serving index.html on any non-API route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- 7. Server Startup Logic ---
const startServer = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        // Schema creation logic...
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to initialize database or start server:', err.stack);
        if (client) client.release();
        process.exit(1);
    }
};

startServer();
