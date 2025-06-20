// --- Imports ---
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const csv = require('csv-parser'); // Not used in provided routes, but kept.
const { Readable } = require('stream'); // Not used in provided routes, but kept.
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    try {
        require('fs').accessSync(path.join(__dirname, '.env'));
        require('dotenv').config();
    } catch (e) {
        console.warn("Warning: .env file not found or accessible locally. Relying on system environment variables.");
    }
}

// Ensure essential environment variables are set
const PORT = process.env.PORT || 3000; // Default to 3000 if PORT is not set
const JWT_SECRET = process.env.JWT_SECRET; // This was missing in the original code
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY; // Stripe key
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET; // Stripe webhook secret
// Retrieve Stripe Price IDs from environment variables
const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO;
const STRIPE_PRICE_ID_ENT = process.env.STRIPE_PRICE_ID_ENT;

// Define employee limits for each plan (adjust these values as per your actual tiers)
const PLAN_EMPLOYEE_LIMITS = {
    'free': 5,          // Free plan: up to 5 employees
    'pro': 100,         // Pro plan: up to 100 employees
    'enterprise': null  // Enterprise plan: null or Infinity for unlimited
};


// Validate JWT_SECRET
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined. Please set it in your environment variables or .env file.');
    process.exit(1); // Exit the process if essential variable is missing
}

// Stripe instance (only if key is available)
let stripeInstance;
if (STRIPE_SECRET_KEY) {
    stripeInstance = require('stripe')(STRIPE_SECRET_KEY);
} else {
    console.warn("Warning: STRIPE_SECRET_KEY is not defined. Stripe related functionalities might not work.");
}

const app = express();

// --- General Middleware ---
app.use(morgan('dev')); // Request logger - placed early

// Stripe Webhook Endpoint (This MUST be before express.json() to get raw body)
app.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Use Stripe's method to construct the event from the raw body and signature
        // req.rawBody is provided by express.raw() middleware
        event = stripeInstance.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // --- Database Setup (PostgreSQL) is defined later, so we need to ensure pool is available
    // or connect specifically for this webhook. For simplicity, we'll assume pool is set up globally.
    const client = await pool.connect(); // Connect to DB for webhook logic
    try {
        await client.query('BEGIN'); // Start transaction for atomicity

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                console.log(`Checkout Session Completed: ${session.id}`);
                const userId = session.metadata.userId;
                const planId = session.metadata.planId;
                if (session.payment_status === 'paid' && userId && planId) {
                    await client.query(
                        'UPDATE Users SET stripe_customer_id = $1, stripe_subscription_id = $2, subscription_status = $3, plan_id = $4 WHERE user_id = $5',
                        [session.customer, session.subscription, 'active', planId, userId]
                    );
                    console.log(`User ${userId} subscription updated to ${planId} (active).`);
                }
                break;
            case 'customer.subscription.updated':
                const subscriptionUpdated = event.data.object;
                console.log(`Subscription Updated: ${subscriptionUpdated.id}`);
                if (subscriptionUpdated.customer && subscriptionUpdated.status && subscriptionUpdated.plan && subscriptionUpdated.plan.id) {
                    await client.query(
                        'UPDATE Users SET subscription_status = $1, plan_id = $2 WHERE stripe_customer_id = $3',
                        [subscriptionUpdated.status, subscriptionUpdated.plan.id, subscriptionUpdated.customer]
                    );
                    console.log(`Subscription for customer ${subscriptionUpdated.customer} status updated to ${subscriptionUpdated.status} and plan to ${subscriptionUpdated.plan.id}.`);
                }
                break;
            case 'customer.subscription.deleted':
                const subscriptionDeleted = event.data.object;
                console.log(`Subscription Deleted: ${subscriptionDeleted.id}`);
                if (subscriptionDeleted.customer) {
                    await client.query(
                        'UPDATE Users SET subscription_status = $1, plan_id = $2, stripe_subscription_id = NULL WHERE stripe_customer_id = $3',
                        ['cancelled', 'free', subscriptionDeleted.customer]
                    );
                    console.log(`Subscription for customer ${subscriptionDeleted.customer} marked as cancelled and reverted to free.`);
                }
                break;
            case 'invoice.payment_succeeded':
                const invoiceSucceeded = event.data.object;
                console.log(`Invoice Payment Succeeded: ${invoiceSucceeded.id}`);
                if (invoiceSucceeded.subscription && invoiceSucceeded.customer) {
                    await client.query(
                        'UPDATE Users SET subscription_status = $1 WHERE stripe_subscription_id = $2 AND stripe_customer_id = $3',
                        ['active', invoiceSucceeded.subscription, invoiceSucceeded.customer]
                    );
                    console.log(`Subscription ${invoiceSucceeded.subscription} status set to active.`);
                }
                break;
            case 'invoice.payment_failed':
                const invoiceFailed = event.data.object;
                console.log(`Invoice Payment Failed: ${invoiceFailed.id}`);
                if (invoiceFailed.subscription && invoiceFailed.customer) {
                    await client.query(
                        'UPDATE Users SET subscription_status = $1 WHERE stripe_subscription_id = $2 AND stripe_customer_id = $3',
                        ['past_due', invoiceFailed.subscription, invoiceFailed.customer]
                    );
                    console.log(`Subscription ${invoiceFailed.subscription} status set to past_due.`);
                }
                break;
            // ... handle other event types as needed
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        await client.query('COMMIT'); // Commit transaction
        // Return a 200 response to acknowledge receipt of the event
        res.status(200).json({ received: true });
    } catch (dbErr) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error("Database update error during webhook processing:", dbErr.message);
        res.status(500).json({ error: 'Webhook processing failed.' });
    } finally {
        client.release(); // Release client back to pool
    }
});

app.use(express.json()); // JSON body parser should be early - now after webhook

// CORS Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow multiple origins by splitting a comma-separated string from env
        const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : ['http://localhost:8000', 'http://127.0.0.1:8000', 'null'];

        // console.log(`CORS Check: Incoming Origin -> ${origin}`); // Commented out for production
        // console.log(`CORS Check: Allowed Origins -> ${allowedOrigins.join(', ')}`); // Commented out for production

        if (!origin || allowedOrigins.includes(origin)) { // Use .includes for array check
            callback(null, true);
        } else {
            const msg = `CORS Error: Origin ${origin} not allowed. Allowed: ${allowedOrigins.join(', ')}`;
            console.error(msg);
            callback(new Error(msg), false);
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
}));


// --- Database Setup (PostgreSQL) ---
// IMPORTANT: This part MUST be global and initialized before any route that uses 'pool' or 'query'/'runCommand'
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => console.log('Connected to PostgreSQL database'));
pool.on('error', (err) => console.error('PostgreSQL database error:', err.message, err.stack));

// --- Helper function for database queries (for consistency) ---
async function query(text, params) {
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return res.rows;
    } finally {
        client.release();
    }
}

// Modified runCommand to return rowCount or potentially the ID if a RETURNING clause is used
async function runCommand(text, params) {
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        // If a RETURNING clause is used, rows might be populated. Otherwise, return rowCount.
        // This makes `runCommand` more versatile for INSERT/UPDATE/DELETE.
        return res.rows.length > 0 ? res.rows[0] : res.rowCount;
    } finally {
        client.release();
    }
}

// --- Authentication Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT Verification Error:", err.message);
            // Specifically check for token expiration
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Forbidden: Token has expired.' });
            }
            return res.status(403).json({ error: 'Forbidden: Invalid token.' });
        }
        req.user = user;
        next();
    });
}

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// --- API Routes (Define ALL API routes FIRST) ---
// These routes must come BEFORE any static file serving middleware
// to ensure API requests are handled by your backend logic.

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max 10 requests per 15 minutes per IP
    message: 'Too many login/registration attempts from this IP, please try again after 15 minutes',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Applying authLimiter directly as middleware
app.post('/register', authLimiter, async (req, res, next) => {
    const { company_name, full_name, email, password } = req.body;
    if (!company_name || !full_name || !email || !password || password.length < 6 || !isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid registration data provided. Please ensure all fields are filled, password is at least 6 characters, and email is valid." });
    }

    try {
        const password_hash = await bcrypt.hash(password, 10);
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN'); // Start transaction
            const companyResult = await client.query('INSERT INTO Companies (company_name) VALUES ($1) RETURNING company_id', [company_name]);
            const newCompanyId = companyResult.rows[0].company_id;

            const userResult = await client.query(
                `INSERT INTO Users (company_id, full_name, email, password_hash, role, subscription_status, plan_id) VALUES ($1, $2, $3, $4, 'super_admin', 'active', 'free') RETURNING user_id`,
                [newCompanyId, full_name, email, password_hash]
            );
            const newUserId = userResult.rows[0].user_id;

            await client.query('COMMIT'); // Commit transaction
            res.status(201).json({ message: "Company and user registe