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
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const onboardingRoutes = require('./routes/onboardingRoutes');

// --- 2. Environment Variables & Constants ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;
const YOUR_DOMAIN = process.env.YOUR_DOMAIN || 'http://localhost:3000';

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
}

// --- 3. Initialize Express App ---
const app = express();

// --- 4. Database Connection Pool ---
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- 5. Middleware ---
// Stripe webhook must come before express.json()
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook signature verification failed.`, err.message);
        return res.sendStatus(400);
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const companyId = session.client_reference_id;
        const stripeCustomerId = session.customer;
        const subscriptionPlan = session.metadata.plan;
        try {
            await pool.query(
                'UPDATE companies SET subscription_plan = $1, stripe_customer_id = $2 WHERE id = $3',
                [subscriptionPlan, stripeCustomerId, companyId]
            );
            console.log(`Company ${companyId} successfully subscribed to ${subscriptionPlan} plan.`);
        } catch (dbError) {
            console.error('Failed to update company subscription in database:', dbError);
        }
    }
    res.json({received: true});
});

app.use(cors());
app.use(express.json());

// --- 6. Authentication Middleware ---
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

// --- 7. API Route Definitions ---
const apiRoutes = express.Router();

// Public Routes
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    if (!companyName || !fullName || !email || !password) {
        return res.status(400).json({ error: "All fields are required." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const companyRes = await client.query(`INSERT INTO companies (name) VALUES ($1) RETURNING id`, [companyName]);
        const companyId = companyRes.rows[0].id;
        const locationRes = await client.query(`INSERT INTO locations (location_name, company_id) VALUES ($1, $2) RETURNING location_id`, [`${companyName} HQ`, companyId]);
        const locationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10);
        await client.query(`INSERT INTO users (full_name, email, password, role, location_id, company_id) VALUES ($1, $2, $3, 'super_admin', $4, $5)`, [fullName, email, hash, locationId, companyId]);
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
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id, company_id: user.company_id };
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
    try {
        const result = await pool.query('SELECT subscription_plan FROM companies WHERE id = $1', [req.user.company_id]);
        if (result.rows.length === 0) return res.status(404).json({error: 'Company not found.'});
        res.json({ plan: result.rows[0].subscription_plan });
    } catch (error) {
        console.error("Error fetching subscription status:", error);
        res.status(500).json({ error: 'Failed to get subscription status.' });
    }
});


// Admin Routes
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

// Modular Routes
onboardingRoutes(apiRoutes, pool, isAuthenticated, isAdmin);

// Use the router
app.use('/api', apiRoutes);


// --- 8. Static File Serving & Fallback ---
app.use(express.static(path.join(__dirname)));
app.get(/'*'/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- 9. Server Startup Logic ---
const startServer = async () => {
    try {
        const client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        
        const schemaQueries = `
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                subscription_plan VARCHAR(50) DEFAULT 'Free',
                stripe_customer_id VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                location_name VARCHAR(255) NOT NULL,
                location_address TEXT,
                company_id INT,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'location_admin', 'employee')),
                position VARCHAR(255),
                employee_id VARCHAR(255) UNIQUE,
                location_id INT,
                company_id INT,
                employment_type VARCHAR(50),
                availability JSONB,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            -- Add other table creation statements here...
        `;
        
        await client.query(schemaQueries);
        console.log("Database schema verified/created.");
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
