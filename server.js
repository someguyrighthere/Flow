// server.js - DEFINITIVE AND FINAL VERSION for Backend Stability and Logging
// This version is designed to resolve server startup and database connection issues on Render.com.

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
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Ensure STRIPE_SECRET_KEY is set on Render

const app = express();
const apiRoutes = express.Router();

// --- Configuration Variables ---
// Use process.env.PORT provided by Render, fallback to 3000 for local development
const PORT = process.env.PORT || 3000; 
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this'; // IMPORTANT: Set a strong secret on Render
const DATABASE_URL = process.env.DATABASE_URL; // IMPORTANT: Set your PostgreSQL connection string on Render

// --- File Uploads Configuration ---
const uploadsDir = path.join(__dirname, 'uploads');
// Ensure uploads directory exists on server startup
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir);
        console.log(`[Server Setup] Created uploads directory: ${uploadsDir}`);
    } catch (err) {
        console.error(`[Server Setup] Error creating uploads directory: ${err.message}`);
    }
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir), // Destination folder
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`) // Unique filename
});
const upload = multer({ storage: storage });

// --- Database Connection Setup ---
// Verify DATABASE_URL is set before attempting to create a pool
if (!DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is NOT set. Server cannot connect to database.");
    // This will cause startServer to fail when pool.connect() is called
} else {
    console.log(`[DB] DATABASE_URL detected. Attempting to initialize PostgreSQL Pool.`);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // CRUCIAL for Render's managed PostgreSQL databases
    connectionTimeoutMillis: 10000,     // 10 seconds for connection
    idleTimeoutMillis: 20000,           // 20 seconds for idle clients before disconnect
});

// --- Express Middleware Configuration ---
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.json()); // Enable parsing of JSON request bodies
app.use(express.static(path.join(__dirname))); // Serve static files from the root of the project
app.use('/uploads', express.static(uploadsDir)); // Serve files from the 'uploads' directory statically

// Mount API routes under the '/api' prefix
app.use('/api', apiRoutes); 

// --- Authentication & Authorization Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    if (token == null) {
        console.log('[Auth] No token provided in Authorization header. Sending 401 (Unauthorized).');
        return res.sendStatus(401); 
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log(`[Auth] Token verification failed: ${err.message}. Sending 403 (Forbidden). Token snippet: ${token.substring(0, 20)}...`);
            return res.sendStatus(403); 
        }
        req.user = user; // Attach user payload (id, role, location_id) to the request object
        console.log(`[Auth] Token verified. User ID: ${user.id}, Role: ${user.role}, Location ID: ${user.location_id || 'N/A'}.`);
        next(); // Proceed to the next middleware/route handler
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'location_admin')) {
        console.log(`[Auth] Admin check passed for user ${req.user.id} (${req.user.role}).`);
        next(); // User has admin role, proceed
    } else {
        console.log(`[Auth] Admin check failed. User ${req.user ? req.user.id : 'N/A'} has role: ${req.user ? req.user.role : 'N/A'}. Sending 403 (Forbidden).`);
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
};

// --- API ROUTES DEFINITION ---

// Authentication Routes
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    console.log(`[Auth/Register] Request to register new company: "${companyName}" with admin email: "${email}".`);
    const client = await pool.connect(); // Get a client from the pool
    try {
        await client.query('BEGIN'); // Start transaction
        // Create a default location for the new company
        const locationRes = await client.query(
            `INSERT INTO locations (location_name) VALUES ($1) RETURNING location_id`, 
            [`${companyName} HQ`]
        );
        const newLocationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10); // Hash the password
        // Create the super_admin user, linking them to their first created location
        await client.query(
            `INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4) RETURNING user_id`, 
            [fullName, email, hash, newLocationId]
        );
        await client.query('COMMIT'); // Commit transaction
        console.log(`[Auth/Register] Registration successful for "${email}" under company "${companyName}".`);
        res.status(201).json({ message: "Registration successful! You can now log in." });
    } catch (err) {
        await client.query('ROLLBACK'); // Rollback transaction on error
        console.error(`[Auth/Register] Error during registration for "${email}":`, err);
        if (err.code === '23505') { // PostgreSQL unique violation error code (e.g., email already exists)
            return res.status(409).json({ error: "Email address is already registered. Please use a different email or log in." });
        }
        res.status(500).json({ error: "An internal server error occurred during registration. Please try again later." });
    } finally {
        client.release(); // Release the client back to the pool
    }
});

apiRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`[Auth/Login] Attempting login for email: "${email}".`);
    try {
        const result = await pool.query(`SELECT user_id, full_name, email, password, role, location_id FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        if (!user) {
            console.log(`[Auth/Login] Login failed for "${email}": User not found.`);
            return res.status(401).json({ error: "Invalid email or password." });
        }
        if (!(await bcrypt.compare(password, user.password))) {
            console.log(`[Auth/Login] Login failed for "${email}": Incorrect password.`);
            return res.status(401).json({ error: "Invalid email or password." });
        }
        // Create JWT payload (ensure location_id is included for frontend use/middleware)
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' }); // Token expires in 1 day
        console.log(`[Auth/Login] Login successful for "${email}". User ID: ${user.user_id}, Role: ${