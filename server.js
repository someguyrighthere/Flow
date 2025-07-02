// server.js

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
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
    ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    console.log('Serving static files from /dist');
} else {
    console.warn('Dist directory not found.');
}
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- 5. Authentication Middleware with Debugging ---
const isAuthenticated = (req, res, next) => {
    // --- DEBUG LOG ---
    console.log(`[DEBUG] isAuthenticated middleware triggered for path: ${req.path}`);
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        // --- DEBUG LOG ---
        console.log('[DEBUG] No token provided. Sending 401.');
        return res.sendStatus(401);
    }
    // --- DEBUG LOG ---
    console.log('[DEBUG] Token received. Verifying...');
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // --- DEBUG LOG ---
            console.error('[DEBUG] JWT verification failed:', err.message);
            return res.sendStatus(403);
        }
        // --- DEBUG LOG ---
        console.log('[DEBUG] JWT verification successful. User payload:', user);
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

// --- 6. API Routes with Debugging ---

// ... (other routes like /register and /login remain the same) ...
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    if (!companyName || !fullName || !email || !password) {
        return res.status(400).json({ error: "All fields are required." });
    }
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
        if (err.code === '23505') {
            return res.status(409).json({ error: "An account with this email already exists." });
        }
        res.status(500).json({ error: "An internal server error occurred during registration." });
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
        res.json({ message: "Logged in successfully!", token: token, role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});


// --- MODIFIED /api/users/me ROUTE ---
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    // --- DEBUG LOG ---
    console.log('[DEBUG] /api/users/me route handler started.');
    try {
        // --- DEBUG LOG ---
        console.log('[DEBUG] req.user object received by handler:', req.user);
        if (!req.user || typeof req.user.id === 'undefined') {
            console.error('[DEBUG] CRITICAL ERROR: req.user.id is missing or undefined!');
            return res.status(500).json({ error: 'Server error: User ID not found in token payload.' });
        }
        const query = 'SELECT user_id, full_name, email, role FROM users WHERE user_id = $1';
        const values = [req.user.id];
        // --- DEBUG LOG ---
        console.log(`[DEBUG] Executing query: ${query} with values: [${values}]`);
        const result = await pool.query(query, values);
        // --- DEBUG LOG ---
        console.log('[DEBUG] Database query successful.');
        if (result.rows.length === 0) {
            // --- DEBUG LOG ---
            console.log('[DEBUG] User not found in database. Sending 404.');
            return res.status(404).json({ error: 'User not found.' });
        }
        // --- DEBUG LOG ---
        console.log('[DEBUG] Sending user data back to client.');
        res.json(result.rows[0]);
    } catch (err) {
        // --- DEBUG LOG ---
        console.error('[DEBUG] ERROR inside /api/users/me route handler:', err.stack);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

// ... (the rest of your routes) ...
// The following is a placeholder for the rest of your routes.
// Make sure all other routes from your original file are also present.
// For brevity, I am not including them here, but they should be in your file.
// ...

// Fallback for serving index.html
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- 7. Server Startup Logic ---
const startServer = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        // The schema creation logic from your file...
        await client.query(`
            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                location_name VARCHAR(255) UNIQUE NOT NULL,
                location_address TEXT
            );
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'employee',
                position VARCHAR(255),
                employee_id VARCHAR(255),
                employment_type VARCHAR(50),
                location_id INTEGER REFERENCES locations(location_id),
                availability JSONB
            );
            -- ... and all your other tables ...
        `);
        console.log('Database schema checked/created successfully.');

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