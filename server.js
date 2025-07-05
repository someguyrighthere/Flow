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
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
};

// --- API ROUTES DEFINITION ---
// All private/protected API routes are defined on the 'apiRoutes' router.

// --- Scheduling Routes ---
// FIX: Allow employees to fetch their own shifts
apiRoutes.get('/shifts', isAuthenticated, async (req, res) => {
    const { startDate, endDate, location_id, user_id } = req.query;
    const requestingUserId = req.user.id;
    const isUserAdmin = req.user.role === 'super_admin' || req.user.role === 'location_admin';

    // Security check: if a specific user_id is requested, ensure the requester is an admin OR is that user.
    if (user_id && !isUserAdmin && String(user_id) !== String(requestingUserId)) {
        return res.status(403).json({ error: 'Access denied. You can only view your own schedule.' });
    }

    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start and end dates are required.' });
    }
    
    try {
        let query = `
            SELECT s.id, s.employee_id, u.full_name AS employee_name, s.location_id, l.location_name,
            s.start_time, s.end_time
            FROM shifts s 
            JOIN users u ON s.employee_id = u.user_id 
            JOIN locations l ON s.location_id = l.location_id
            WHERE s.start_time >= $1 AND s.end_time <= $2
        `;
        const params = [startDate, endDate];
        let paramIndex = 3;

        if (isUserAdmin) {
            if (location_id) {
                query += ` AND s.location_id = $${paramIndex++}`;
                params.push(location_id);
            }
        } else {
            // If not an admin, force filter by their own user ID
            query += ` AND s.employee_id = $${paramIndex++}`;
            params.push(requestingUserId);
        }
        
        query += ' ORDER BY s.start_time ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});

// ... (The rest of your server.js file remains the same) ...

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
