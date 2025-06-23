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
const multer = require('multer');
const fs = require('fs');
const dotenv = require('dotenv'); // Ensure dotenv is required for .env loading

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    try {
        require('fs').accessSync(path.join(__dirname, '.env'));
        dotenv.config(); // Use dotenv.config() here
    } catch (e) {
        console.warn("Warning: .env file not found or accessible locally. Relying on system environment variables.");
    }
} else if (process.env.NODE_ENV === 'production') {
    dotenv.config(); // For production, ensure .env is loaded if available, or rely on system envs
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

// NEW: Trust proxy for Express when behind a load balancer (like Render)
// This is crucial for rate-limiting middleware to correctly identify client IPs.
app.set('trust proxy', 1); // Trust the first proxy (Render's load balancer)

// --- General Middleware ---
app.use(morgan('dev')); // Request logger - placed early

// --- Multer Configuration for File Uploads (Moved to top for visibility) ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
// Create the uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR); // Store files in the 'uploads' directory
    },
    filename: function (req, file, cb) {
        // Use a unique name to prevent collisions, e.g., timestamp-originalfilename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

// Configure Multer to accept single file uploads with the field name 'document_file'
const upload = multer({
    storage: storage,
    limits: { fileSize: 1 * 1024 * 1024 * 1024 } // 1 GB limit (1 * 1024 * 1024 * 1024 bytes)
});


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
                        'UPDATE users SET stripe_customer_id = $1, stripe_subscription_id = $2, subscription_status = $3, plan_id = $4 WHERE user_id = $5',
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
                        'UPDATE users SET subscription_status = $1, plan_id = $2 WHERE stripe_customer_id = $3',
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
                        'UPDATE users SET subscription_status = $1, plan_id = $2, stripe_subscription_id = NULL WHERE stripe_customer_id = $3',
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
                        'UPDATE users SET subscription_status = $1 WHERE stripe_subscription_id = $2 AND stripe_customer_id = $3',
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
                        'UPDATE users SET subscription_status = $1 WHERE stripe_subscription_id = $2 AND stripe_customer_id = $3',
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
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => console.log('Connected to PostgreSQL database'));
pool.on('error', (err) => console.error('PostgreSQL database error:', err.message, err.stack));

// --- Database Schema Initialization ---
// This function creates tables if they don't exist. It will run on server startup.
async function initializeDbSchema() {
    const client = await pool.connect();
    try {
        console.log('Initializing database schema...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL, -- Renamed from 'password' to 'password_hash' for clarity
                role TEXT DEFAULT 'employee', -- 'super_admin', 'location_admin', 'employee'
                location_id INTEGER,
                employee_id TEXT UNIQUE,
                plan_id TEXT DEFAULT 'free',
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                subscription_status TEXT DEFAULT 'inactive', -- e.g., 'active', 'cancelled', 'past_due'
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                position_id INTEGER, -- Added position_id for employees
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL,
                FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                location_name TEXT NOT NULL,
                location_address TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS positions (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                position_id INTEGER, -- Links to positions table
                title TEXT NOT NULL,
                structure_type TEXT NOT NULL, -- 'single_list', 'daily', 'weekly'
                group_count INTEGER DEFAULT 0, -- Number of days/weeks for grouped lists
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS task_groups (
                id SERIAL PRIMARY KEY,
                checklist_id INTEGER NOT NULL,
                title TEXT NOT NULL, -- e.g., "Day 1", "Week 2"
                group_order INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                checklist_id INTEGER, -- For single_list tasks directly under checklist
                task_group_id INTEGER, -- For tasks under a task_group
                description TEXT NOT NULL,
                completed BOOLEAN DEFAULT FALSE, -- BOOLEAN type for PostgreSQL
                task_order INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
                FOREIGN KEY (task_group_id) REFERENCES task_groups(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS onboarding_sessions (
                session_id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL, -- The new hire's user_id
                company_id INTEGER NOT NULL,
                checklist_id INTEGER NOT NULL,
                start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completion_date TIMESTAMP WITH TIME ZONE,
                status TEXT DEFAULT 'active', -- 'active', 'archived'
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS documents (
                document_id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                uploaded_by_user_id INTEGER NOT NULL, -- Renamed from 'user_id' for clarity to avoid conflict with users.user_id
                title TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                description TEXT,
                upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (uploaded_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS job_postings (
                job_posting_id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                location_id INTEGER, -- Optional: links to locations table
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                requirements TEXT,
                status TEXT DEFAULT 'Open', -- 'Open', 'Closed', 'Filled'
                created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS applicants (
                applicant_id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                job_posting_id INTEGER NOT NULL,
                location_id INTEGER, -- Added for consistency with job_postings
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone_number TEXT,
                resume_path TEXT, -- Path to uploaded resume
                status TEXT DEFAULT 'Applied', -- 'Applied', 'Interviewing', 'Rejected', 'Hired'
                application_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (job_posting_id) REFERENCES job_postings(job_posting_id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS schedules (
                schedule_id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL, -- user_id of the employee
                location_id INTEGER NOT NULL,
                start_time TIMESTAMP WITH TIME ZONE NOT NULL,
                end_time TIMESTAMP WITH TIME ZONE NOT NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE
            );
        `);

        // Insert initial super admin if no users exist
        const userCount = await client.query(`SELECT COUNT(*) FROM users`);
        if (parseInt(userCount.rows[0].count) === 0) {
            console.log('No users found, creating a default super admin and company.');
            const hashedPassword = await bcrypt.hash('adminpassword', 10); // Default password

            const companyInsertResult = await client.query(`INSERT INTO companies (name) VALUES ($1) RETURNING id`, ['Flow Business Suite Company']);
            const companyId = companyInsertResult.rows[0].id;

            await client.query(
                `INSERT INTO users (company_id, full_name, email, password_hash, role, plan_id, subscription_status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [companyId, 'Super Admin', 'admin@example.com', hashedPassword, 'super_admin', 'free', 'active']
            );
            console.log('Default Super Admin "admin@example.com" created with password "adminpassword" for "Flow Business Suite Company".');
        } else {
            console.log('Users already exist, skipping initial admin creation.');
        }

        console.log('Database schema initialization complete.');
    } catch (err) {
        console.error('Error initializing database schema:', err.message, err.stack);
    } finally {
        client.release();
    }
}

// Execute schema initialization when the application starts
initializeDbSchema();


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

// Modified runCommand to return rows or rowCount, useful for RETURNING clauses
async function runCommand(text, params) {
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
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
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Forbidden: Token has expired.' });
            }
            return res.status(403).json({ error: 'Forbidden: Invalid token.' });
        }
        req.user = user; // This payload should contain userId, email, role, companyId, etc.
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

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        const password_hash = await bcrypt.hash(password, 10);
        
        // Insert into Companies table
        const companyResult = await client.query('INSERT INTO companies (name) VALUES ($1) RETURNING id', [company_name]);
        const newCompanyId = companyResult.rows[0].id;

        // Insert new user as super_admin for the new company
        const userResult = await client.query(
            `INSERT INTO users (company_id, full_name, email, password_hash, role, subscription_status, plan_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [newCompanyId, full_name, email, password_hash, 'super_admin', 'active', 'free']
        );
        const newUserId = userResult.rows[0].user_id;

        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ message: "Company and user registered successfully!", userId: newUserId });
    } catch (dbErr) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error("Database error during registration:", dbErr);
        // NEW: More specific error messages for duplicate unique constraints
        if (dbErr.code === '23505') { // PostgreSQL unique_violation error code
            if (dbErr.constraint === 'users_email_key') {
                return res.status(409).json({ error: 'Email already registered. Please use a different email address.' });
            }
            if (dbErr.constraint === 'companies_name_key') { // Changed from company_name_key
                return res.status(409).json({ error: 'Company name already registered. Please choose a different company name.' });
            }
        }
        next(dbErr); // Pass to general error handler
    } finally {
        client.release();
    }
});

app.post('/login', authLimiter, async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    try {
        const userResult = await query("SELECT user_id, company_id, location_id, full_name, email, role, subscription_status, plan_id, password_hash FROM users WHERE email = $1", [email]);
        const user = userResult[0];

        if (!user) { return res.status(401).json({ error: "Invalid credentials." }); }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) { return res.status(401).json({ error: "Invalid credentials." }); }

        const payload = {
            id: user.user_id, // Changed from userId to id for consistency with app.js
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            company_id: user.company_id, // Changed from companyId to company_id
            location_id: user.location_id, // Changed from locationId to location_id
            subscription_status: user.subscription_status, // Changed from subscriptionStatus
            plan_id: user.plan_id // Changed from planId
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
        res.status(200).json({ message: "Login successful!", token, role: user.role });
    } catch (error) {
        console.error("Login API error:", error);
        next(error);
    }
});

app.post('/create-checkout-session', authenticateToken, async (req, res, next) => {
    const { planId } = req.body;
    const { id: userId, email, company_id: companyId } = req.user; // Get user info from authenticated token

    if (!stripeInstance) {
        console.error("Stripe not initialized. STRIPE_SECRET_KEY might be missing.");
        return res.status(500).json({ error: "Payment processing is unavailable." });
    }

    // Retrieve Stripe Price IDs from environment variables
    let priceId;
    switch (planId) {
        case 'pro':
            priceId = STRIPE_PRICE_ID_PRO; // Get from environment variable
            break;
        case 'enterprise':
            priceId = STRIPE_PRICE_ID_ENT; // Get from environment variable
            break;
        default:
            return res.status(400).json({ error: "Invalid plan selected." });
    }

    if (!priceId) {
        console.error(`Stripe Price ID for plan '${planId}' is not configured.`);
        return res.status(500).json({ error: `Payment processing: Price ID for ${planId} plan missing.` });
    }

    try {
        const session = await stripeInstance.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription', // Use 'subscription' mode for recurring payments
            success_url: `${process.env.CORS_ORIGIN}/suite-hub.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CORS_ORIGIN}/suite-hub.html?payment=cancelled`,
            metadata: {
                userId: userId,
                planId: planId,
                companyId: companyId,
                userEmail: email // Useful for reconciliation in Stripe
            },
            customer_email: email, // Pre-fill customer email
        });

        res.status(200).json({ sessionId: session.id });
    } catch (error) {
        console.error("Error creating Stripe Checkout session:", error);
        // Distinguish between Stripe-specific errors and general errors for better client feedback
        if (error.type === 'StripeCardError' || error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({ error: error.message });
        }
        next(error); // Pass other errors to general error handler
    }
});

app.post('/invite-admin', authenticateToken, async (req, res, next) => {
    const { full_name, email, password, location_id } = req.body;
    const { company_id: companyId, role } = req.user;

    // Authorization check
    if (role !== 'super_admin') {
        return res.status(403).json({ error: 'Access Dismissed: Only super admins can invite other admins.' });
    }

    // Input validation
    if (!full_name || !email || !password || password.length < 6 || !isValidEmail(email) || typeof location_id !== 'number' || location_id <= 0) {
        return res.status(400).json({ error: "Invalid admin invitation data provided. Full name, valid email, password (min 6 chars), and a valid location ID are required." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // Verify location exists and belongs to the company
        const locationCheck = await client.query('SELECT location_id FROM locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
        if (locationCheck.rows.length === 0) {
            await client.query('ROLLBACK'); // Rollback if location invalid
            return res.status(400).json({ error: 'Selected location does not exist or does not belong to your company.' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const result = await client.query(
            `INSERT INTO users (company_id, location_id, full_name, email, password_hash, role, subscription_status, plan_id) VALUES ($1, $2, $3, $4, $5, 'location_admin', 'active', 'free') RETURNING user_id`,
            [companyId, location_id, full_name, email, password_hash]
        );
        const newUserId = result.rows[0].user_id;

        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ message: "Location admin invited successfully!", userId: newUserId });
    } catch (dbErr) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error("Database error during admin invitation:", dbErr);
        if (dbErr.code === '23505') { // PostgreSQL unique_violation error code
            return res.status(409).json({ error: 'Email already registered.' });
        }
        next(dbErr); // Pass to general error handler
    } finally {
        client.release(); // Release client
    }
});

app.post('/invite-employee', authenticateToken, async (req, res, next) => {
    const { full_name, email, password, position, employee_id, location_id } = req.body;
    const { company_id: companyId, role, location_id: currentUserLocationId, plan_id: currentPlanId } = req.user; // Get plan_id from authenticated user

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can invite employees.' });
    }
    
    // Input validation
    const isLocationIdValid = location_id === null || (typeof location_id === 'number' && !isNaN(location_id) && location_id >= 0); // location_id can be 0 or greater
    if (!full_name || !email || !password || password.length < 6 || !isValidEmail(email) || !isLocationIdValid) {
        return res.status(400).json({ error: "Invalid employee invitation data provided. Full name, valid email, password (min 6 chars), and a valid location are required." });
    }
    if (position !== undefined && typeof position !== 'string') { return res.status(400).json({ error: 'Position must be a string if provided.' }); }
    if (employee_id !== undefined && employee_id !== null && typeof employee_id !== 'string' && typeof employee_id !== 'number') {
        return res.status(400).json({ error: 'Employee ID must be a string, number, or null if provided.' });
    }


    // Location admin specific restriction
    if (role === 'location_admin') {
        if (currentUserLocationId !== null) {
            if (location_id !== currentUserLocationId && location_id !== null) {
                return res.status(403).json({ error: 'Access Dismissed: Location admin can only invite employees to their assigned location or unassigned roles.' });
            }
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location cannot invite employees to any location.' });
        }
    }

    // --- Employee Limit Enforcement Logic ---
    const maxEmployeesForPlan = PLAN_EMPLOYEE_LIMITS[currentPlanId];

    if (maxEmployeesForPlan !== null) { // If the plan has a defined limit (not 'unlimited')
        try {
            // Count existing users (employees and location_admins, but NOT super_admins) for this company
            const employeeCountResult = await query(
                `SELECT COUNT(*) FROM users WHERE company_id = $1 AND role IN ('employee', 'location_admin')`,
                [companyId]
            );
            const currentEmployeeCount = parseInt(employeeCountResult[0].count, 10);

            if (currentEmployeeCount >= maxEmployeesForPlan) {
                return res.status(403).json({ error: `Subscription limit reached: Your current plan allows up to ${maxEmployeesForPlan} employees. Please upgrade your plan.` });
            }
        } catch (dbError) {
            console.error("Database error checking employee count:", dbError);
            next(dbError); // Pass DB error to general error handler
            return; // Prevent further execution
        }
    }
    // --- END NEW LOGIC ---

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        if (location_id !== null && location_id > 0) { // Only check if a specific location_id is provided and is valid
            const locationCheck = await client.query('SELECT location_id FROM locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
            if (locationCheck.rows.length === 0) { 
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Selected location does not exist or does not belong to your company.' }); 
            }
        }

        const password_hash = await bcrypt.hash(password, 10);
        
        // Find or create position for the employee
        let positionId = null;
        if (position) {
            let existingPosition = await client.query(`SELECT id FROM positions WHERE name = $1 AND company_id = $2`, [position, companyId]);
            if (existingPosition.rows.length > 0) {
                positionId = existingPosition.rows[0].id;
            } else {
                const newPosition = await client.query(`INSERT INTO positions (company_id, name) VALUES ($1, $2) RETURNING id`, [companyId, position]);
                positionId = newPosition.rows[0].id;
            }
        }

        const result = await client.query(
            `INSERT INTO users (company_id, location_id, full_name, email, password_hash, role, subscription_status, plan_id, employee_id, position_id) VALUES ($1, $2, $3, $4, $5, 'employee', 'active', 'free', $6, $7) RETURNING user_id`,
            [companyId, location_id, full_name, email, password_hash, employee_id, positionId]
        );
        const newUserId = result.rows[0].user_id;

        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ message: "Employee invited successfully!", userId: newUserId });
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error("Invite employee error:", error);
        if (error.code === '23505') { // PostgreSQL unique violation error code
            return res.status(409).json({ error: 'Email already registered.' });
        }
        next(error);
    } finally {
        client.release(); // Release client
    }
});


// --- Checklist Management API Routes (NEW / REFINED) ---
app.get('/api/checklists', authenticateToken, async (req, res, next) => {
    try {
        const checklists = await query(`
            SELECT c.id, c.title, c.structure_type, c.group_count, p.name AS position
            FROM checklists c
            JOIN positions p ON c.position_id = p.id
            WHERE c.company_id = $1 ORDER BY c.created_at DESC
        `, [req.user.company_id]);
        res.json(checklists);
    } catch (error) {
        console.error('Error fetching checklists:', error.message);
        next(error);
    }
});

app.get('/api/checklists/:id', authenticateToken, async (req, res, next) => {
    const checklistId = req.params.id;
    const companyId = req.user.company_id;

    try {
        const checklistResult = await query(`
            SELECT c.id, c.title, c.structure_type, c.group_count, p.name AS position
            FROM checklists c
            JOIN positions p ON c.position_id = p.id
            WHERE c.id = $1 AND c.company_id = $2
        `, [checklistId, companyId]);
        const checklist = checklistResult[0];

        if (!checklist) {
            return res.status(404).json({ error: 'Checklist not found or unauthorized.' });
        }

        let tasksData = [];
        if (checklist.structure_type === 'single_list') {
            tasksData = await query(`
                SELECT id, description, completed FROM tasks
                WHERE checklist_id = $1 ORDER BY task_order
            `, [checklistId]);
        } else { // 'daily' or 'weekly'
            const taskGroups = await query(`
                SELECT id, title, group_order FROM task_groups
                WHERE checklist_id = $1 ORDER BY group_order
            `, [checklistId]);

            for (const group of taskGroups) {
                const tasksInGroup = await query(`
                    SELECT id, description, completed FROM tasks
                    WHERE task_group_id = $1 ORDER BY task_order
                `, [group.id]);
                tasksData.push({
                    id: group.id, // Group ID
                    groupTitle: group.title,
                    tasks: tasksInGroup
                });
            }
        }
        res.json({ ...checklist, tasks: tasksData });

    } catch (error) {
        console.error('Error fetching checklist details:', error.message);
        next(error);
    }
});

app.post('/api/checklists', authenticateToken, async (req, res, next) => {
    const { position, title, structure_type, group_count, tasks } = req.body;
    const companyId = req.user.company_id;
    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // Ensure position exists or create it
        let positionDataResult = await client.query(`SELECT id FROM positions WHERE name = $1 AND company_id = $2`, [position, companyId]);
        let positionId;
        if (positionDataResult.rows.length > 0) {
            positionId = positionDataResult.rows[0].id;
        } else {
            const newPositionResult = await client.query(`INSERT INTO positions (company_id, name) VALUES ($1, $2) RETURNING id`, [companyId, position]);
            positionId = newPositionResult.rows[0].id;
        }

        const checklistResult = await client.query(
            `INSERT INTO checklists (company_id, position_id, title, structure_type, group_count) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [companyId, positionId, title, structure_type, group_count]
        );
        const checklistId = checklistResult.rows[0].id;

        if (structure_type === 'single_list') {
            for (let i = 0; i < tasks.length; i++) {
                await client.query(`INSERT INTO tasks (checklist_id, description, completed, task_order) VALUES ($1, $2, $3, $4)`,
                    [checklistId, tasks[i].description, tasks[i].completed, i]);
            }
        } else {
            for (let i = 0; i < tasks.length; i++) {
                const groupResult = await client.query(`INSERT INTO task_groups (checklist_id, title, group_order) VALUES ($1, $2, $3) RETURNING id`,
                    [checklistId, tasks[i].groupTitle, i]);
                const taskGroupId = groupResult.rows[0].id;
                for (let j = 0; j < tasks[i].tasks.length; j++) {
                    await client.query(`INSERT INTO tasks (task_group_id, description, completed, task_order) VALUES ($1, $2, $3, $4)`,
                        [taskGroupId, tasks[i].tasks[j].description, tasks[i].tasks[j].completed, j]);
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Checklist created successfully!', id: checklistId });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error creating checklist:', error.message);
        next(error);
    } finally {
        if (client) client.release();
    }
});

app.put('/api/checklists/:id', authenticateToken, async (req, res, next) => {
    const checklistId = req.params.id;
    const { position, title, structure_type, group_count, tasks } = req.body;
    const companyId = req.user.company_id;
    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // Verify checklist belongs to user's company
        const existingChecklistResult = await client.query(`SELECT id FROM checklists WHERE id = $1 AND company_id = $2`, [checklistId, companyId]);
        if (existingChecklistResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Checklist not found or unauthorized.' });
        }

        // Ensure position exists or create it
        let positionDataResult = await client.query(`SELECT id FROM positions WHERE name = $1 AND company_id = $2`, [position, companyId]);
        let positionId;
        if (positionDataResult.rows.length > 0) {
            positionId = positionDataResult.rows[0].id;
        } else {
            const newPositionResult = await client.query(`INSERT INTO positions (company_id, name) VALUES ($1, $2) RETURNING id`, [companyId, position]);
            positionId = newPositionResult.rows[0].id;
        }

        // Update checklist details
        await client.query(
            `UPDATE checklists SET position_id = $1, title = $2, structure_type = $3, group_count = $4 WHERE id = $5`,
            [positionId, title, structure_type, group_count, checklistId]
        );

        // Delete existing tasks and task groups for this checklist
        await client.query(`DELETE FROM tasks WHERE checklist_id = $1`, [checklistId]);
        await client.query(`DELETE FROM task_groups WHERE checklist_id = $1`, [checklistId]);

        // Insert new tasks and task groups based on the updated payload
        if (structure_type === 'single_list') {
            for (let i = 0; i < tasks.length; i++) {
                await client.query(`INSERT INTO tasks (checklist_id, description, completed, task_order) VALUES ($1, $2, $3, $4)`,
                    [checklistId, tasks[i].description, tasks[i].completed, i]);
            }
        } else {
            for (let i = 0; i < tasks.length; i++) {
                const groupResult = await client.query(`INSERT INTO task_groups (checklist_id, title, group_order) VALUES ($1, $2, $3) RETURNING id`,
                    [checklistId, tasks[i].groupTitle, i]);
                const taskGroupId = groupResult.rows[0].id;
                for (let j = 0; j < tasks[i].tasks.length; j++) {
                    await client.query(`INSERT INTO tasks (task_group_id, description, completed, task_order) VALUES ($1, $2, $3, $4)`,
                        [taskGroupId, tasks[i].tasks[j].description, tasks[i].tasks[j].completed, j]);
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Checklist updated successfully!' });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error updating checklist:', error.message);
        next(error);
    } finally {
        if (client) client.release();
    }
});


app.delete('/api/checklists/:id', authenticateToken, async (req, res, next) => {
    const checklistId = req.params.id;
    const companyId = req.user.company_id;
    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // Delete tasks first (due to foreign key constraints)
        await client.query(`DELETE FROM tasks WHERE checklist_id = $1`, [checklistId]);
        // Delete task groups
        await client.query(`DELETE FROM task_groups WHERE checklist_id = $1`, [checklistId]);
        // Delete the checklist itself
        const deleteResult = await client.query(`DELETE FROM checklists WHERE id = $1 AND company_id = $2`, [checklistId, companyId]);

        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Checklist not found or unauthorized to delete.' });
        }

        await client.query('COMMIT');
        res.status(204).send(); // No content for successful deletion
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error deleting checklist:', error.message);
        next(error);
    } finally {
        if (client) client.release();
    }
});


app.get('/api/positions', authenticateToken, async (req, res, next) => {
    try {
        const positions = await query(`SELECT id, name FROM positions WHERE company_id = $1 ORDER BY name ASC`, [req.user.company_id]);
        res.json({ positions });
    } catch (error) {
        console.error('Error fetching positions:', error.message);
        next(error);
    }
});


app.get('/api/onboarding-tasks/:userId', authenticateToken, async (req, res, next) => {
    const newHireUserId = req.params.userId;
    const companyId = req.user.company_id; // Ensure user accessing tasks is in the same company

    try {
        // Fetch the onboarding session for the new hire
        const sessionResult = await query(`
            SELECT os.*, c.position_id, c.title AS checklist_title, c.structure_type, c.group_count
            FROM onboarding_sessions os
            JOIN checklists c ON os.checklist_id = c.id
            WHERE os.user_id = $1 AND os.company_id = $2
        `, [newHireUserId, companyId]);
        const session = sessionResult[0];

        if (!session) {
            return res.status(404).json({ error: 'Onboarding session not found for this user.' });
        }

        const checklist = {
            id: session.checklist_id,
            title: session.checklist_title,
            structure_type: session.structure_type,
            group_count: session.group_count
        };

        let tasks = [];
        if (session.structure_type === 'single_list') {
            tasks = await query(`SELECT id, description, completed FROM tasks WHERE checklist_id = $1 ORDER BY task_order`, [session.checklist_id]);
        } else { // 'daily' or 'weekly'
            const taskGroups = await query(`SELECT id, title, group_order FROM task_groups WHERE checklist_id = $1 ORDER BY group_order`, [session.checklist_id]);
            for (const group of taskGroups) {
                const groupTasks = await query(`SELECT id, description, completed FROM tasks WHERE task_group_id = $1 ORDER BY task_order`, [group.id]);
                tasks.push({
                    id: group.id, // Group ID
                    groupTitle: group.title,
                    tasks: groupTasks
                });
            }
        }
        res.json({ checklist, tasks });

    } catch (error) {
        console.error('Error fetching onboarding tasks:', error.message);
        next(error);
    }
});

app.put('/api/onboarding-tasks/:taskId', authenticateToken, async (req, res, next) => {
    const taskId = req.params.taskId;
    const { completed } = req.body; // Only need 'completed' status to update

    try {
        // Ensure the task belongs to a checklist managed by the user's company
        const taskOwnerCheck = await query(`
            SELECT c.id FROM tasks t
            LEFT JOIN checklists c ON t.checklist_id = c.id
            LEFT JOIN task_groups tg ON t.task_group_id = tg.id
            LEFT JOIN checklists c_grouped ON tg.checklist_id = c_grouped.id
            WHERE t.id = $1 AND (c.company_id = $2 OR c_grouped.company_id = $2)
        `, [taskId, req.user.company_id]);

        if (taskOwnerCheck.length === 0) {
            return res.status(404).json({ error: 'Task not found or unauthorized.' });
        }

        await runCommand(`UPDATE tasks SET completed = $1 WHERE id = $2`, [completed, taskId]); // PostgreSQL BOOLEAN
        res.json({ message: 'Task status updated successfully.' });
    } catch (error) {
        console.error('Error updating task status:', error.message);
        next(error);
    }
});


// Existing routes from your original server.js

app.get('/profile', authenticateToken, async (req, res, next) => {
    try {
        const userResult = await query('SELECT user_id, company_id, location_id, full_name, email, role, subscription_status, plan_id FROM users WHERE user_id = $1', [req.user.id]);
        const user = userResult[0];
        if (!user) { return res.status(404).json({ error: 'User not found.' }); }
        res.status(200).json(user);
    }    catch (error) {
        console.error("Error fetching profile info:", error);
        next(error);
    }
});

app.put('/profile', authenticateToken, async (req, res, next) => {
    const { fullName, email, currentPassword, newPassword } = req.body;
    const { id: userId } = req.user; // Use 'id' from token payload

    // Input validation
    if (fullName === undefined && email === undefined && (!currentPassword || !newPassword)) { return res.status(400).json({ error: 'No data provided for update.' }); }
    if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim() === '')) { return res.status(400).json({ error: "Full name must be a non-empty string if provided." }); }
    if (email !== undefined && !isValidEmail(email)) { return res.status(400).json({ error: "A valid email address must be provided if changing email." }); }
    if (newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length < 6)) { return res.status(400).json({ error: "New password must be at least 6 characters long if changing password." }); }
    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) { return res.status(400).json({ error: 'Both current password and new password are required to change password.' }); }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        const userResult = await client.query("SELECT password_hash, email FROM users WHERE user_id = $1", [userId]);
        const user = userResult.rows[0];
        if (!user) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }

        let updateSql = 'UPDATE users SET ';
        const updateParams = [];
        const clauses = [];
        let paramIndex = 1;

        if (fullName !== undefined && fullName !== user.full_name) {
            clauses.push(`full_name = $${paramIndex++}`);
            updateParams.push(fullName);
        }
        if (email !== undefined && email !== user.email) {
            const existingUser = await client.query("SELECT user_id FROM users WHERE email = $1 AND user_id != $2", [email, userId]);
            if (existingUser.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Email already in use by another account.' });
            }
            clauses.push(`email = $${paramIndex++}`);
            updateParams.push(email);
        }
        if (currentPassword && newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) {
                await client.query('ROLLBACK');
                return res.status(401).json({ error: "Current password incorrect." });
            }
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            clauses.push(`password_hash = $${paramIndex++}`);
            updateParams.push(newPasswordHash);
        }

        if (clauses.length === 0) {
            await client.query('ROLLBACK');
            return res.status(200).json({ message: 'No changes detected. Profile remains the same.' });
        }

        updateSql += clauses.join(', ') + ` WHERE user_id = $${paramIndex}`;
        updateParams.push(userId);

        await client.query(updateSql, updateParams);
        
        await client.query('COMMIT');

        // Fetch updated user details to regenerate token with new info (e.g., email or full_name)
        const updatedUserResult = await query("SELECT user_id, company_id, location_id, full_name, email, role, subscription_status, plan_id FROM users WHERE user_id = $1", [userId]);
        const updatedUser = updatedUserResult[0];
        const newPayload = {
            id: updatedUser.user_id,
            email: updatedUser.email,
            role: updatedUser.role,
            fullName: updatedUser.full_name,
            company_id: updatedUser.company_id,
            location_id: updatedUser.location_id,
            subscription_status: updatedUser.subscription_status,
            plan_id: updatedUser.plan_id
        };
        const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Profile updated successfully!', token: newToken });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("Error updating profile:", error);
        next(error);
    } finally {
        if (client) client.release();
    }
});

app.get('/locations', authenticateToken, async (req, res, next) => {
    const { company_id: companyId, role } = req.user;
    let sql = 'SELECT location_id, location_name, location_address FROM locations WHERE company_id = $1';
    const params = [companyId];

    // Authorization check
    if (!['super_admin', 'location_admin', 'employee'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to view locations.' });
    }

    try {
        const locations = await query(sql, params);
        res.json(locations);
    } catch (error) {
        console.error("Database error fetching locations:", error);
        next(error);
    }
});

app.post('/locations', authenticateToken, async (req, res, next) => {
    const { location_name, location_address } = req.body;
    const { company_id: companyId, role } = req.user;

    // Authorization check
    if (role !== 'super_admin') {
        return res.status(403).json({ error: 'Access Dismissed: Only super admins can create locations.' });
    }
    // Input validation
    if (!location_name || typeof location_name !== 'string' || location_name.trim() === '' || !location_address || typeof location_address !== 'string' || location_address.trim() === '') {
        return res.status(400).json({ error: "Location name and address are required and must be non-empty strings." });
    }

    try {
        const result = await runCommand('INSERT INTO locations (company_id, location_name, location_address) VALUES ($1, $2, $3) RETURNING location_id', [companyId, location_name, location_address]);
        res.status(201).json({ message: 'Location created!', locationId: result.location_id });
    }    catch (error) {
        console.error("Database error creating location:", error);
        next(error);
    }
});

app.delete('/locations/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { company_id: companyId, role } = req.user;

    // Authorization check
    if (role !== 'super_admin') {
        return res.status(403).json({ error: 'Access Dismissed: Only super admins can delete locations.' });
    }
    // Input validation
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid location ID provided.' }); }

    try {
        const result = await runCommand('DELETE FROM locations WHERE location_id = $1 AND company_id = $2', [id, companyId]);
        if (result === 0) { return res.status(404).json({ error: 'Location not found or not authorized to delete.' }); }
        res.status(204).send(); // 204 No Content for successful deletion
    } catch (error) {
        console.error("Database error deleting location:", error);
        next(error);
    }
});

app.get('/users', authenticateToken, async (req, res, next) => {
    const { company_id: companyId, role, id: currentUserId, location_id: currentUserLocationId } = req.user;
    const { filterRole, filterLocationId } = req.query;

    let sql = `SELECT u.user_id, u.full_name, u.email, u.role, l.location_name, u.employee_id, pos.name as position_name
                FROM users u
                LEFT JOIN locations l ON u.location_id = l.location_id
                LEFT JOIN positions pos ON u.position_id = pos.id
                WHERE u.company_id = $1`;
    const params = [companyId];
    let paramIndex = 2;

    // Authorization and filtering based on user role
    if (role === 'location_admin') {
        if (currentUserLocationId !== null) { // Ensure location admin is assigned a location
            sql += ` AND (u.location_id = $${paramIndex++} OR u.location_id IS NULL)`;
            params.push(currentUserLocationId);
        } else {
            // Location admin not assigned to a location should not see any users
            return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' });
        }
    } else if (role === 'employee') {
        sql += ` AND u.user_id = $${paramIndex++}`;
        params.push(currentUserId);
    } else if (!['super_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to view users.' });
    }

    const allowedRoles = ['super_admin', 'location_admin', 'employee']; // Roles that can be filtered by
    if (filterRole) {
        // Validate filterRole against allowed roles and current user's permissions
        if (!allowedRoles.includes(filterRole) || (role === 'location_admin' && filterRole === 'super_admin')) {
            return res.status(400).json({ error: 'Invalid filter role provided or insufficient permissions to filter by this role.' });
        }
        sql += ` AND u.role = $${paramIndex++}`;
        params.push(filterRole);
    }

    if (filterLocationId) {
        if (isNaN(parseInt(filterLocationId))) { return res.status(400).json({ error: 'Invalid filter location ID provided.' }); }
        const parsedLocationId = parseInt(filterLocationId);

        // Super admin can filter by any location
        // Location admin can only filter by their assigned location (or null/unassigned)
        if (role === 'super_admin' || (role === 'location_admin' && (parsedLocationId === currentUserLocationId || parsedLocationId === 0))) {
            sql += ` AND u.location_id = $${paramIndex++}`;
            params.push(parsedLocationId);
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to filter by location.' });
        }
    }

    try {
        const users = await query(sql, params);
        res.json(users);
    } catch (error) {
        console.error("Database error fetching users:", error);
        next(error);
    }
});

app.delete('/users/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { company_id: companyId, role, id: authenticatedUserId } = req.user;

    // Authorization check
    if (role !== 'super_admin') {
        return res.status(403).json({ error: 'Access Dismissed: Only super admins can delete users.' });
    }
    // Prevent super admin from deleting their own account via this endpoint
    if (parseInt(id) === authenticatedUserId) {
        return res.status(403).json({ error: 'Cannot delete your own super admin account via this interface.' });
    }
    // Input validation
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid user ID provided.' }); }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // Prevent deleting other super admin accounts
        const userToDelete = await client.query('SELECT role FROM users WHERE user_id = $1 AND company_id = $2', [id, companyId]);
        if (userToDelete.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found or not authorized to delete.' });
        }
        if (userToDelete.rows[0].role === 'super_admin') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Cannot delete another super admin account.' });
        }

        const deleteResult = await client.query('DELETE FROM users WHERE user_id = $1 AND company_id = $2', [id, companyId]);
        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found or not authorized to delete.' });
        }
        await client.query('COMMIT');
        res.status(204).send();
    }  catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("Database error deleting user:", error);
        next(error);
    } finally {
        if (client) client.release();
    }
});

app.post('/schedules', authenticateToken, async (req, res, next) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    const { company_id: companyId, role, location_id: currentUserLocationId } = req.user;

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can create schedules.' });
    }

    // Input validation
    if (typeof employee_id !== 'number' || employee_id <= 0 || typeof location_id !== 'number' || location_id <= 0 || !start_time || !end_time || isNaN(new Date(start_time).getTime()) || isNaN(new Date(end_time).getTime()) || new Date(start_time) >= new Date(end_time)) {
        return res.status(400).json({ error: 'Invalid schedule data provided. Ensure employee_id, location_id are valid numbers, and start_time is before end_time.' });
    }
    if (notes !== undefined && typeof notes !== 'string') { return res.status(400).json({ error: 'Notes must be a string if provided.' }); }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // Verify employee and location belong to the company and are accessible
        const employeeCheck = await client.query('SELECT user_id, location_id FROM users WHERE user_id = $1 AND company_id = $2', [employee_id, companyId]);
        if (employeeCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Employee not found in your company.' });
        }

        const locationCheck = await client.query('SELECT location_id FROM locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
        if (locationCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Location not found in your company.' });
        }

        // Location admin specific check for scheduling employees at specific locations
        if (role === 'location_admin' && currentUserLocationId !== null) {
            // If the employee is assigned to a location, it must be the admin's location or unassigned
            if (employeeCheck.rows[0].location_id !== null && employeeCheck.rows[0].location_id !== currentUserLocationId) {
                 await client.query('ROLLBACK');
                 return res.status(403).json({ error: 'Access Dismissed: Location admin can only schedule employees within their assigned location or unassigned employees.' });
            }
            // The schedule's location_id must match the admin's assigned location
            if (location_id !== currentUserLocationId) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Access Dismissed: Location admin can only create schedules for their assigned location.' });
            }
        }


        const result = await client.query(
            'INSERT INTO schedules (company_id, employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING schedule_id', // Return the new schedule ID
            [companyId, employee_id, location_id, start_time, end_time, notes]
        );
        const newScheduleId = result.rows[0].schedule_id;

        await client.query('COMMIT');
        res.status(201).json({ message: 'Schedule created successfully!', scheduleId: newScheduleId });
    }  catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("Database error creating schedule:", error);
        next(error);
    } finally {
        if (client) client.release();
    }
});

app.get('/schedules', authenticateToken, async (req, res, next) => {
    const { employee_id, location_id, start_date, end_date } = req.query;
    const { company_id: companyId, role, id: currentUserId, location_id: currentUserLocationId } = req.user;

    let sql = `SELECT s.*, u.full_name AS employee_name, u.email AS employee_email, l.location_name
                FROM schedules s
                JOIN users u ON s.employee_id = u.user_id
                JOIN locations l ON s.location_id = l.location_id
                WHERE s.company_id = $1`;
    const params = [companyId];
    let paramIndex = 2;

    // Authorization based on user role
    if (role === 'location_admin') {
        if (currentUserLocationId !== null) {
            sql += ` AND s.location_id = $${paramIndex++}`;
            params.push(currentUserLocationId);
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' });
        }
    } else if (role === 'employee') {
        sql += ` AND s.employee_id = $${paramIndex++}`;
        params.push(currentUserId);
    } else if (!['super_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to view schedules.' });
    }
    
    // Optional filters
    if (employee_id) {
        if (isNaN(parseInt(employee_id))) { return res.status(400).json({ error: 'Invalid employee ID filter provided.' }); }
        sql += ` AND s.employee_id = $${paramIndex++}`;
        params.push(parseInt(employee_id));
    }
    if (location_id) {
        if (isNaN(parseInt(location_id))) { return res.status(400).json({ error: 'Invalid location ID filter provided.' }); }
        sql += ` AND s.location_id = $${paramIndex++}`;
        params.push(parseInt(location_id));
    }
    if (start_date) {
        if (isNaN(new Date(start_date).getTime())) { return res.status(400).json({ error: 'Invalid start date format.' }); }
        sql += ` AND s.start_time >= $${paramIndex++}`;
        params.push(start_date);
    }
    if (end_date) {
        if (isNaN(new Date(end_date).getTime())) { return res.status(400).json({ error: 'Invalid end date format.' }); }
        sql += ` AND s.end_time <= $${paramIndex++}`;
        params.push(end_date);
    }

    sql += ` ORDER BY s.start_time ASC`;

    try {
        const schedules = await query(sql, params);
        res.json(schedules);
    } catch (error) {
        console.error("Database error fetching schedules:", error);
        next(error);
    }
});

app.delete('/schedules/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { company_id: companyId, role, id: currentUserId, location_id: currentUserLocationId } = req.user;

    // Authorization check
    if (role === 'employee') {
        return res.status(403).json({ error: 'Access Dismissed: Employees cannot delete schedules.' });
    }
    // Input validation
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid schedule ID provided.' }); }

    let sql = `DELETE FROM schedules WHERE schedule_id = $1 AND company_id = $2`;
    const params = [id, companyId];
    let paramIndex = 3;

    // Additional WHERE clauses based on role for secure deletion
    if (role === 'location_admin') {
        if (currentUserLocationId === null) {
             return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' });
        }
        // Location admin can only delete schedules for employees associated with their location
        sql += ` AND employee_id IN (SELECT user_id FROM users WHERE location_id = $${paramIndex++} AND company_id = $${paramIndex++})`;
        params.push(currentUserLocationId, companyId);
    } else if (role === 'super_admin') {
        // Super admin can delete any schedule within their company, already covered by company_id filter
    } else {
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to delete schedules.' });
    }

    try {
        const result = await runCommand(sql, params);
        if (result === 0) { return res.status(404).json({ error: 'Schedule not found or not authorized to delete.' }); }
        res.status(204).send();
    }  catch (error) {
        console.error("Database error deleting schedule:", error);
        next(error);
    }
});

app.post('/job-postings', authenticateToken, async (req, res, next) => {
    const { title, description, requirements, location_id } = req.body;
    const { company_id: companyId, role, location_id: currentUserLocationId } = req.user;
    const created_date = new Date().toISOString();

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can create job postings.' });
    }

    // Input validation
    if (!title || typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: "Job title is required and must be a non-empty string." }); }
    if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) { return res.status(400).json({ error: 'Description must be a non-empty string if provided.' }); }
    if (requirements !== undefined && typeof requirements !== 'string') { return res.status(400).json({ error: 'Requirements must be a string if provided.' }); }
    // location_id can be null or a number
    if (location_id !== undefined && typeof location_id !== 'number' && location_id !== null) { return res.status(400).json({ error: 'Location ID must be a number or null if provided.' }); }
    if (location_id !== null && location_id <= 0) { return res.status(400).json({ error: 'Location ID must be a positive number or null.' }); }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // If a location_id is provided, verify it exists and belongs to the company
        if (location_id !== null) {
            const locationCheck = await client.query('SELECT location_id FROM locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
            if (locationCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Selected location does not exist or does not belong to your company.' });
            }
        }

        // Location admin specific restriction for job posting location
        if (role === 'location_admin' && currentUserLocationId !== null) {
            // If location_id is provided and it's not the admin's location or null
            if (location_id !== currentUserLocationId && location_id !== null) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Access Dismissed: Location admin can only post jobs for their assigned location or unassigned (null).' });
            }
        }

        const result = await client.query(
            `INSERT INTO job_postings (company_id, location_id, title, description, requirements, status, created_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING job_posting_id`,
            [companyId, location_id, title, description, requirements, 'Open', created_date]
        );
        const newJobPostingId = result.rows[0].job_posting_id;

        await client.query('COMMIT');
        res.status(201).json({ message: 'Job posting created successfully!', jobPostingId: newJobPostingId });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("Database error creating job posting:", error);
        next(error);
    } finally {
        if (client) client.release();
    }
});

app.get('/job-postings', authenticateToken, async (req, res, next) => {
    const { status, location_id } = req.query;
    const { company_id: companyId, role, location_id: currentUserLocationId } = req.user;

    let sql = `SELECT jp.job_posting_id, jp.company_id, jp.location_id, jp.title, jp.description, jp.requirements, jp.status, jp.created_date, l.location_name
                FROM job_postings jp
                LEFT JOIN locations l ON jp.location_id = l.location_id
                WHERE jp.company_id = $1`;
    const params = [companyId];
    let paramIndex = 2;

    // Authorization and filtering based on user role
    if (role === 'location_admin') {
        if (currentUserLocationId !== null) {
            sql += ` AND (jp.location_id = $${paramIndex++} OR jp.location_id IS NULL)`; // Location admins see their location's jobs and unassigned jobs
            params.push(currentUserLocationId);
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' });
        }
    } else if (role === 'employee') {
        // Employees generally shouldn't see all job postings unless for internal applications
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to view job postings.' });
    }
    // Super admin already has access via company_id filter


    const allowedStatuses = ['Open', 'Closed', 'Filled'];
    if (status) {
        if (!allowedStatuses.includes(status)) { return res.status(400).json({ error: 'Invalid job posting status filter provided.' }); }
        sql += ` AND jp.status = $${paramIndex++}`;
        params.push(status);
    }

    if (location_id) {
        if (isNaN(parseInt(location_id))) { return res.status(400).json({ error: 'Invalid location ID filter provided.' }); }
        const parsedLocationId = parseInt(location_id);

        // Super admin can filter by any location
        // Location admin can only filter by their assigned location or null (unassigned)
        if (role === 'super_admin' || (role === 'location_admin' && (parsedLocationId === currentUserLocationId || parsedLocationId === 0))) {
            sql += ` AND jp.location_id = $${paramIndex++}`;
            params.push(parsedLocationId);
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to filter by location.' });
        }
    }

    try {
        const postings = await query(sql, params);
        res.json(postings);
    } catch (error) {
        console.error("Database error fetching job postings:", error);
        next(error);
    }
});

app.put('/job-postings/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { title, description, requirements, status, location_id } = req.body;
    const { company_id: companyId, role, location_id: currentUserLocationId } = req.user;

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can update job postings.' });
    }
    // Input validation
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid job posting ID provided.' }); }
    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) { return res.status(400).json({ error: "Job title must be a non-empty string if provided." }); }
    if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) { return res.status(400).json({ error: 'Description must be a non-empty string if provided.' }); }
    if (requirements !== undefined && typeof requirements !== 'string') { return res.status(400).json({ error: 'Requirements must be a string if provided.' }); }
    const allowedStatuses = ['Open', 'Closed', 'Filled'];
    if (status !== undefined && !allowedStatuses.includes(status)) { return res.status(400).json({ error: 'Invalid status provided.' }); }
    
    // location_id can be null or a number
    if (location_id !== undefined && typeof location_id !== 'number' && location_id !== null) { return res.status(400).json({ error: 'Location ID must be a number or null if provided.' }); }
    if (location_id !== null && location_id <= 0) { return res.status(400).json({ error: 'Location ID must be a positive number or null.' }); }


    let updateSql = 'UPDATE job_postings SET ';
    const updateParams = [];
    const clauses = [];
    let paramIndex = 1;

    // Dynamically build update clauses
    if (title !== undefined) { clauses.push(`title = $${paramIndex++}`); updateParams.push(title); }
    if (description !== undefined) { clauses.push(`description = $${paramIndex++}`); updateParams.push(description); }
    if (requirements !== undefined) { clauses.push(`requirements = $${paramIndex++}`); updateParams.push(requirements); }
    if (status !== undefined) { clauses.push(`status = $${paramIndex++}`); updateParams.push(status); }
    
    if (location_id !== undefined) {
        // Super admin can change location to any valid location or null
        // Location admin can only change location to their assigned location or null (unassign)
        if (role === 'super_admin' || (role === 'location_admin' && (location_id === currentUserLocationId || location_id === null))) {
            clauses.push(`location_id = $${paramIndex++}`);
            updateParams.push(location_id);
        } else if (role === 'location_admin') {
            return res.status(403).json({ error: 'Access Dismissed: Location admin cannot change job posting location to another location.' });
        }
    }

    if (clauses.length === 0) { return res.status(400).json({ error: 'No fields provided for update.' }); }

    updateSql += clauses.join(', ') + ` WHERE job_posting_id = $${paramIndex++} AND company_id = $${paramIndex++}`;
    updateParams.push(parseInt(id), companyId);

    // Ensure location admin can only update jobs within their assigned location or unassigned jobs
    if (role === 'location_admin' && currentUserLocationId !== null) {
        updateSql += ` AND (location_id = $${paramIndex++} OR location_id IS NULL)`;
        params.push(currentUserLocationId);
    } else if (role === 'location_admin' && currentUserLocationId === null) {
        return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' });
    }

    try {
        const result = await runCommand(updateSql, updateParams);
        if (result === 0) { return res.status(404).json({ error: 'Job posting not found or not authorized to update.' }); }
        res.status(200).json({ message: 'Job posting updated successfully!' });
    } catch (error) {
        console.error("Database error updating job posting:", error);
        next(error);
    }
});

app.delete('/job-postings/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { company_id: companyId, role, location_id: currentUserLocationId } = req.user;

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can delete job postings.' });
    }
    // Input validation
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid job posting ID provided.' }); }

    let sql = 'DELETE FROM job_postings WHERE job_posting_id = $1 AND company_id = $2';
    const params = [id, companyId];
    let paramIndex = 3;

    // Location admin specific restriction for deletion
    if (role === 'location_admin' && currentUserLocationId !== null) {
        sql += ` AND (location_id = $${paramIndex++} OR location_id IS NULL)`; // Can delete jobs at their location or unassigned
        params.push(currentUserLocationId);
    } else if (role === 'location_admin' && currentUserLocationId === null) {
        return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' });
    }

    try {
        const result = await runCommand(sql, params);
        if (result === 0) { return res.status(404).json({ error: 'Job posting not found or not authorized to delete.' }); }
        res.status(204).send();
    }  catch (error) {
        console.error("Database error deleting job posting:", error);
        next(error);
    }
});

app.post('/applicants', authenticateToken, async (req, res, next) => {
    const { job_posting_id, full_name, email, notes, phone_number } = req.body; // Removed location_id from body, it's inferred from job posting
    const { company_id: companyId, role, location_id: currentUserLocationId } = req.user;
    const application_date = new Date().toISOString();

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can add applicants.' });
    }

    // Input validation
    if (typeof job_posting_id !== 'number' || job_posting_id <= 0 || !full_name || typeof full_name !== 'string' || full_name.trim() === '' || !email || !isValidEmail(email) || !phone_number || typeof phone_number !== 'string' || phone_number.trim() === '') {
        return res.status(400).json({ error: 'Invalid applicant data provided. Job Posting ID, full name, valid email, and phone number are required.' });
    }
    if (notes !== undefined && typeof notes !== 'string') { return res.status(400).json({ error: 'Notes must be a string if provided.' }); }


    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        const jobPostingCheck = await client.query('SELECT job_posting_id, location_id FROM job_postings WHERE job_posting_id = $1 AND company_id = $2', [job_posting_id, companyId]);
        if (jobPostingCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Job Posting not found or does not belong to your company.' });
        }

        const jobPostingLocationId = jobPostingCheck.rows[0].location_id;

        // Location admin specific check
        if (role === 'location_admin' && currentUserLocationId !== null) {
            // An applicant cannot be added to a job posting whose location is outside the admin's assigned location,
            // unless the job posting itself is unassigned (null).
            if (jobPostingLocationId !== currentUserLocationId && jobPostingLocationId !== null) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Access Dismissed: Location admin cannot add applicants to jobs outside their assigned location.' });
            }
        }

        const result = await client.query(
            `INSERT INTO applicants (company_id, job_posting_id, location_id, full_name, email, phone_number, notes, application_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING applicant_id`,
            [companyId, job_posting_id, jobPostingLocationId, full_name, email, phone_number, notes, application_date, 'Applied']
        );
        const newApplicantId = result.rows[0].applicant_id;

        await client.query('COMMIT');
        res.status(201).json({ message: 'Applicant added successfully!', applicantId: newApplicantId });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("Database error creating applicant:", error);
        next(error);
    } finally {
        if (client) client.release();
    }
});

app.get('/applicants', authenticateToken, async (req, res, next) => {
    const { job_posting_id, status, location_id } = req.query;
    const { company_id: companyId, role, location_id: currentUserLocationId } = req.user;

    let sql = `SELECT a.applicant_id, a.company_id, a.job_posting_id, a.full_name, a.email, a.phone_number, a.resume_path, a.status, a.application_date,
                      jp.title AS job_title, l.location_name
                FROM applicants a
                JOIN job_postings jp ON a.job_posting_id = jp.job_posting_id
                LEFT JOIN locations l ON a.location_id = l.location_id
                WHERE a.company_id = $1`;
    const params = [companyId];
    let paramIndex = 2;

    // Authorization and filtering based on user role
    if (role === 'location_admin') {
        if (currentUserLocationId !== null) {
            sql += ` AND (a.location_id = $${paramIndex++} OR a.location_id IS NULL)`;
            params.push(currentUserLocationId);
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' });
        }
    } else if (role === 'employee') {
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to view applicants.' });
    }

    if (job_posting_id) {
        if (isNaN(parseInt(job_posting_id))) { return res.status(400).json({ error: 'Invalid job posting ID filter provided.' }); }
        sql += ` AND a.job_posting_id = $${paramIndex++}`;
        params.push(parseInt(job_posting_id));
    }
    if (status) {
        const allowedStatuses = ['Applied', 'Interviewing', 'Rejected', 'Hired'];
        if (!allowedStatuses.includes(status)) { return res.status(400).json({ error: 'Invalid status filter provided.' }); }
        sql += ` AND a.status = $${paramIndex++}`;
        params.push(status);
    }
    if (location_id) {
        if (isNaN(parseInt(location_id))) { return res.status(400).json({ error: 'Invalid location ID filter provided.' }); }
        sql += ` AND a.location_id = $${paramIndex++}`;
        params.push(parseInt(location_id));
    }

    sql += ` ORDER BY a.application_date DESC`;

    try {
        const applicants = await query(sql, params);
        res.json(applicants);
    } catch (error) {
        console.error("Database error fetching applicants:", error);
        next(error);
    }
});

app.put('/applicants/:id/status', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;
    const { company_id: companyId, role, location_id: currentUserLocationId } = req.user;

    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can update applicant status.' });
    }
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid applicant ID provided.' }); }
    const allowedStatuses = ['Applied', 'Interviewing', 'Rejected', 'Hired'];
    if (!status || !allowedStatuses.includes(status)) { return res.status(400).json({ error: 'Invalid status provided.' }); }

    let sql = 'UPDATE applicants SET status = $1 WHERE applicant_id = $2 AND company_id = $3';
    const params = [status, id, companyId];
    let paramIndex = 4;

    if (role === 'location_admin' && currentUserLocationId !== null) {
        sql += ` AND (location_id = $${paramIndex++} OR location_id IS NULL)`;
        params.push(currentUserLocationId);
    } else if (role === 'location_admin' && currentUserLocationId === null) {
        return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' });
    }

    try {
        const result = await runCommand(sql, params);
        if (result === 0) { return res.status(404).json({ error: 'Applicant not found or not authorized to update status.' }); }
        res.status(200).json({ message: 'Applicant status updated successfully.' });
    } catch (error) {
        console.error("Database error updating applicant status:", error);
        next(error);
    }
});

app.delete('/applicants/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { company_id: companyId, role, location_id: currentUserLocationId } = req.user;

    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can delete applicants.' });
    }
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid applicant ID provided.' }); }

    let sql = 'DELETE FROM applicants WHERE applicant_id = $1 AND company_id = $2';
    const params = [id, companyId];
    let paramIndex = 3;

    if (role === 'location_admin' && currentUserLocationId !== null) {
        sql += ` AND (location_id = $${paramIndex++} OR location_id IS NULL)`;
        params.push(currentUserLocationId);
    } else if (role === 'location_admin' && currentUserLocationId === null) {
        return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' });
    }

    try {
        const result = await runCommand(sql, params);
        if (result === 0) { return res.status(404).json({ error: 'Applicant not found or not authorized to delete.' }); }
        res.status(204).send();
    } catch (error) {
        console.error("Database error deleting applicant:", error);
        next(error);
    }
});


// --- Static Files and SPA Fallback (Moved to the very end) ---
// Define Public Directory Path - this assumes server.js is in the root of the repository
const PUBLIC_DIR = path.join(__dirname, '/');
// Serve static files (CSS, JS, images, etc.) from the public directory
app.use(express.static(PUBLIC_DIR));

// Explicitly serve HTML files for direct requests (e.g., typing URL into browser)
// It's generally better to have a single entry point (index.html) for SPAs
// and let client-side routing handle the rest. However, if direct access to these
// files is needed, this is how.
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});
app.get('/register.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'register.html'));
});
app.get('/pricing.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'pricing.html'));
});
app.get('/suite-hub.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'suite-hub.html'));
});
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});
app.get('/checklists.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'checklists.html'));
});
app.get('/new-hire-view.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'new-hire-view.html'));
});
app.get('/hiring.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'hiring.html'));
});
app.get('/scheduling.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'scheduling.html'));
});
app.get('/sales-analytics.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'sales-analytics.html'));
});
app.get('/documents.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'documents.html'));
});
app.get('/account.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'account.html'));
});
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// SPA Fallback: For any other GET request not handled by an API route or explicit file route,
// serve index.html. This is crucial for client-side routing.
// This should be the very last route for GET requests.
app.get(/'*'/, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Error Handling Middleware (Always last) ---
app.use((err, req, res, next) => {
    console.error(`Unhandled Error: ${err.stack}`);
    res.status(500).json({
        error: 'An unexpected server error occurred. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined // Only expose message in dev
    });
});

// --- Server Start ---
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => { // Added '0.0.0.0' binding for Render compatibility
        console.log(`Server is running successfully on http://localhost:${PORT}`);
    });
} else {
    module.exports = app;
