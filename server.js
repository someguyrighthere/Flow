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
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_...replace_with_your_key'); // Fallback for local testing

const onboardingRoutes = require('./routes/onboardingRoutes');

// --- 2. Environment Variables & Constants ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;
const YOUR_DOMAIN = process.env.YOUR_DOMAIN || 'http://localhost:3000';

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
}

// --- 3. Initialize Express App & Database Pool ---
const app = express();
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- 4. Middleware ---
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

// Static file serving
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));


// --- 5. API Route Definitions ---
const apiRoutes = express.Router();

// Authentication Middleware (defined before being used in routes)
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

// --- Attach all routes to the /api router ---

// Public Routes
apiRoutes.post('/register', async (req, res) => {
    // ... (registration logic remains the same)
});
apiRoutes.post('/login', async (req, res) => {
    // ... (login logic remains the same)
});

// Authenticated Routes
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    // ... (get user profile logic remains the same)
});
apiRoutes.get('/subscription-status', isAuthenticated, async (req, res) => {
    // ... (get subscription status logic remains the same)
});

// Admin Routes
apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    // ... (get users logic remains the same)
});
// ... (all other admin routes for locations, inviting users, etc.)

// Modular Routes
onboardingRoutes(apiRoutes, pool, isAuthenticated, isAdmin);


// --- Use the API router ---
app.use('/api', apiRoutes);

// --- Fallback for Frontend ---
app.get(/'*'/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- 6. Server Startup Logic ---
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
            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                position VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                tasks JSONB NOT NULL,
                structure_type VARCHAR(50) NOT NULL DEFAULT 'single_list',
                time_group_count INT
            );
            CREATE TABLE IF NOT EXISTS onboarding_tasks (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                checklist_id INT,
                description TEXT NOT NULL,
                completed BOOLEAN DEFAULT FALSE,
                document_id INT,
                document_name VARCHAR(255),
                task_order INT,
                group_index INT,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE SET NULL
            );
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
