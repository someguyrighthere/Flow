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
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
});

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

// --- SIMPLIFIED STATIC FILE SERVING ---
// This one line serves everything from your project's main directory.
// This includes your HTML files, and the 'dist' folder.
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


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

// --- Your API Routes ---
// I am including all the routes from your original files here to ensure it's complete.
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const locationRes = await client.query(`INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING location_id`,[`${companyName} HQ`, 'Default Address']);
        const locationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10);
        await client.query(`INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4)`, [fullName, email, hash, locationId]);
        await client.query('COMMIT');
        res.status(201).json({ message: "Registration successful! You can now log in." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Registration error:', err);
        if (err.code === '23505') return res.status(409).json({ error: "An account with this email already exists." });
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
        res.json({ message: "Logged in successfully!", token, role: user.role, location_id: user.location_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'User not found.' });
        }
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

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
    const { title, position, tasks, structure_type, time_group_count } = req.body;
    try {
        const result = await pool.query('INSERT INTO checklists (title, position, tasks, structure_type, time_group_count) VALUES ($1, $2, $3, $4, $5) RETURNING *', [title, position, JSON.stringify(tasks), structure_type, time_group_count]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating checklist:', error);
        res.status(500).json({ error: 'Failed to create checklist.' });
    }
});

apiRoutes.get('/documents', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT d.document_id, d.title, d.description, d.file_name, d.uploaded_at, u.full_name AS uploaded_by_name FROM documents d JOIN users u ON d.uploaded_by = u.user_id ORDER BY d.uploaded_at DESC`);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});

apiRoutes.post('/documents', isAuthenticated, isAdmin, upload.single('document'), async (req, res) => {
    const { title, description } = req.body;
    const { filename } = req.file;
    const uploaded_by = req.user.id;
    try {
        const result = await pool.query('INSERT INTO documents (title, description, file_name, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING *', [title, description, filename, uploaded_by]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: 'Failed to upload document.' });
    }
});

onboardingRoutes(apiRoutes, pool, isAuthenticated, isAdmin);

// The server startup logic
const startServer = async () => {
    try {
        const client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        client.release();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to initialize database or start server:', err.stack);
        process.exit(1);
    }
};

startServer();