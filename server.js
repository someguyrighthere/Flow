// server.js - FINAL VERSION WITH ALL ROUTES, INCLUDING OWNER DASHBOARD

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createOnboardingRouter = require('./routes/onboardingRoutes');

const app = express();
const apiRoutes = express.Router();
const ownerRoutes = express.Router(); // Router for private owner routes

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'default-secret-password-change-me';

// ... (multer, pool, middleware setup remains the same) ...
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
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is NOT set.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));

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


// --- All other API routes remain unchanged ---
app.use('/api', apiRoutes);


// --- PRIVATE OWNER ROUTES ---
ownerRoutes.post('/data', async (req, res) => {
    const { owner_password } = req.body;

    if (owner_password !== OWNER_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password.' });
    }

    try {
        const [subscriptions, feedback] = await Promise.all([
            pool.query('SELECT location_name, subscription_plan, subscription_status FROM locations ORDER BY location_name ASC'),
            pool.query('SELECT * FROM feedback ORDER BY submitted_at DESC')
        ]);

        // FIX: Calculate subscription counts
        const subscriptionCounts = {
            free: 0,
            pro: 0,
            enterprise: 0,
            total: subscriptions.rows.length
        };

        subscriptions.rows.forEach(sub => {
            const plan = (sub.subscription_plan || 'free').toLowerCase();
            if (plan.includes('pro')) {
                subscriptionCounts.pro++;
            } else if (plan.includes('enterprise')) {
                subscriptionCounts.enterprise++;
            } else {
                subscriptionCounts.free++;
            }
        });

        res.json({
            subscriptions: subscriptions.rows,
            feedback: feedback.rows,
            subscriptionCounts: subscriptionCounts // Add counts to the response
        });
    } catch (err) {
        console.error('Error fetching owner data:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
});

// --- MOUNT OWNER ROUTER ---
app.use('/owner', ownerRoutes);


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
