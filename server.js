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

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;
// Add a secret password for your private dashboard
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'default-secret-password-change-me';

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

// --- API ROUTES DEFINITION ---

// --- NEW: Public route for submitting feedback ---
apiRoutes.post('/feedback', isAuthenticated, async (req, res) => {
    const { feedback_type, message } = req.body;
    const userId = req.user.id;

    if (!feedback_type || !message) {
        return res.status(400).json({ error: 'Feedback type and message are required.' });
    }

    try {
        // Get user details to store with the feedback
        const userRes = await pool.query('SELECT full_name, email FROM users WHERE user_id = $1', [userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Submitting user not found.' });
        }
        const { full_name, email } = userRes.rows[0];

        await pool.query(
            'INSERT INTO feedback (user_id, user_name, user_email, feedback_type, message) VALUES ($1, $2, $3, $4, $5)',
            [userId, full_name, email, feedback_type, message]
        );
        res.status(201).json({ message: 'Feedback submitted successfully. Thank you!' });
    } catch (err) {
        console.error('Error submitting feedback:', err);
        res.status(500).json({ error: 'Failed to submit feedback.' });
    }
});

// ... (All your other /api/... routes remain here)

// --- MOUNT API ROUTER ---
app.use('/api', apiRoutes);


// --- NEW: PRIVATE OWNER ROUTES ---
const ownerRoutes = express.Router();

ownerRoutes.post('/data', async (req, res) => {
    const { owner_password } = req.body;

    // Check the password
    if (owner_password !== OWNER_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password.' });
    }

    try {
        const [subscriptions, feedback] = await Promise.all([
            pool.query('SELECT location_name, subscription_plan, subscription_status FROM locations ORDER BY location_name ASC'),
            pool.query('SELECT * FROM feedback ORDER BY submitted_at DESC')
        ]);

        res.json({
            subscriptions: subscriptions.rows,
            feedback: feedback.rows
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
