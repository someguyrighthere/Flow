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
        await client.query(`INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4)`, [fullName, email, hash, locationId]);
        await client.query('COMMIT');
        res.status(201).json({ message: "Registration successful!" });
    } catch (err) {
        await client.query('ROLLBACK');
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
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid credentials." });
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, role: user.role });
    } catch (err) {
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

// User Routes
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role FROM users WHERE user_id = $1', [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        let query = 'SELECT user_id, full_name, position, role, location_id FROM users';
        const params = [];
        // If location_admin, filter users by their assigned location
        if (req.user.role === 'location_admin') {
            query += ' WHERE location_id = $1';
            params.push(req.user.location_id);
        }
        query += ' ORDER BY full_name';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error retrieving users:', err); // Log the actual error
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

// Locations Routes
// NEW: Endpoint to get all locations
apiRoutes.get('/locations', isAuthenticated, async (req, res) => {
    try {
        let query = 'SELECT location_id, location_name, location_address FROM locations';
        const params = [];
        // If location_admin, filter locations by their assigned location
        if (req.user.role === 'location_admin') {
            query += ' WHERE location_id = $1';
            params.push(req.user.location_id);
        }
        query += ' ORDER BY location_name';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error retrieving locations:', err);
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});

// NEW: Endpoint to add a new location (used by admin.js form)
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
        console.error('Error adding new location:', err);
        res.status(500).json({ error: 'Failed to add new location.' });
    }
});


// NEW: Business Settings Endpoint (for operating hours, etc.)
// This endpoint will return general business settings.
apiRoutes.get('/settings/business', isAuthenticated, async (req, res) => {
    try {
        // In a real application, you'd fetch this from a 'business_settings' table.
        // For now, return hardcoded default operating hours.
        res.json({
            operating_hours_start: '09:00', // Example: 9 AM
            operating_hours_end: '17:00'    // Example: 5 PM
        });
    } catch (err) {
        console.error('Error fetching business settings:', err);
        res.status(500).json({ error: 'Failed to retrieve business settings.' });
    }
});

// Subscription Status Endpoint (already added)
apiRoutes.get('/subscription-status', isAuthenticated, async (req, res) => {
    try {
        res.json({ plan: 'Pro Plan' });
    } catch (err) {
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
