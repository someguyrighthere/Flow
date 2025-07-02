// server.js

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

if (!DATABASE_URL) throw new Error("DATABASE_URL environment variable is not set.");

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
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};
const isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'location_admin')) {
        next();
    } else {
        return res.status(403).json({ error: 'Access denied.' });
    }
};

// --- ALL API ROUTES RESTORED ---

// Auth & User Routes
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const locationRes = await client.query(`INSERT INTO locations (location_name) VALUES ($1) RETURNING location_id`,[`${companyName} HQ`]);
        const locationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10);
        await client.query(`INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4)`, [fullName, email, hash, locationId]);
        await client.query('COMMIT');
        res.status(201).json({ message: "Registration successful!" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Registration error:', err);
        res.status(500).json({ error: "An internal server error occurred." });
    } finally {
        client.release();
    }
});

apiRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: "Invalid credentials." });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials." });
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, role: user.role });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role FROM users WHERE user_id = $1', [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

// Location Routes
apiRoutes.get('/locations', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY location_name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching locations:', err);
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});

// Checklist Routes
apiRoutes.get('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM checklists ORDER BY title');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching checklists:', error);
        res.status(500).json({ error: 'Failed to retrieve checklists.' });
    }
});

apiRoutes.post('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    const { title, position, tasks } = req.body;
    try {
        const result = await pool.query('INSERT INTO checklists (title, position, tasks) VALUES ($1, $2, $3) RETURNING *', [title, position, JSON.stringify(tasks)]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating checklist:', error);
        res.status(500).json({ error: 'Failed to create checklist.' });
    }
});

// Document Routes
apiRoutes.get('/documents', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM documents ORDER BY uploaded_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching documents:', err);
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});

apiRoutes.post('/documents', isAuthenticated, isAdmin, upload.single('document'), async (req, res) => {
    const { title, description } = req.body;
    const { filename } = req.file;
    const uploaded_by = req.user.id;
    try {
        await pool.query('INSERT INTO documents (title, description, file_name, uploaded_by) VALUES ($1, $2, $3, $4)', [title, description, filename, uploaded_by]);
        res.status(201).json({ message: 'Document uploaded successfully' });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: 'Failed to upload document.' });
    }
});

// Job Posting Routes
apiRoutes.get('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM job_postings WHERE is_active = true ORDER BY created_at DESC');
        res.json(result.rows);
    } catch(err) {
        console.error('Error fetching job postings:', err);
        res.status(500).send('Server error');
    }
});

// External Routes
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