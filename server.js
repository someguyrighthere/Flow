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
const multer = require('multer'); // ADD THIS LINE: Import multer
const fs = require('fs'); // ADD THIS LINE: Import file system module for local storage ops


// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    try {
        require('fs').accessSync(path.join(__dirname, '.env'));
        dotenv.config(); // Use dotenv.config() here
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

// NEW: Trust proxy for Express when behind a load balancer (like Render)
// This is crucial for rate-limiting middleware to correctly identify client IPs.
app.set('trust proxy', 1); // Trust the first proxy (Render's load balancer)

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
                // Corrected from invoiceNFailed.id to invoiceFailed.id
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
            res.status(201).json({ message: "Company and user registered successfully!", userId: newUserId });
        } catch (dbErr) {
            await client.query('ROLLBACK'); // Rollback on error
            console.error("Database error during registration:", dbErr);
            // NEW: More specific error messages for duplicate unique constraints
            if (dbErr.code === '23505') { // PostgreSQL unique_violation error code
                if (dbErr.constraint === 'users_email_key') {
                    return res.status(409).json({ error: 'Email already registered. Please use a different email address.' });
                }
                if (dbErr.constraint === 'companies_company_name_key') {
                    return res.status(409).json({ error: 'Company name already registered. Please choose a different company name.' });
                }
            }
            next(dbErr); // Pass to general error handler
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Registration error:", error);
        next(error); // Pass to general error handler
    }
});

app.post('/login', authLimiter, async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    try {
        const userResult = await query("SELECT * FROM Users WHERE email = $1", [email]);
        const user = userResult[0];

        if (!user) { return res.status(401).json({ error: "Invalid credentials." }); }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) { return res.status(401).json({ error: "Invalid credentials." }); }

        const payload = {
            userId: user.user_id,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            companyId: user.company_id,
            locationId: user.location_id, // Can be null for super_admin
            subscriptionStatus: user.subscription_status,
            planId: user.plan_id
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
    const { userId, email, companyId } = req.user; // Get user info from authenticated token

    if (!stripeInstance) {
        console.error("Stripe not initialized. STRIPE_SECRET_KEY might be missing.");
        return res.status(500).json({ error: "Payment processing is unavailable." });
    }

    // Retrieve Stripe Price IDs from environment variables
    let priceId;
    switch (planId) {
        case 'pro':
            priceId = process.env.STRIPE_PRICE_ID_PRO; // Get from environment variable
            break;
        case 'enterprise':
            priceId = process.env.STRIPE_PRICE_ID_ENT; // Get from environment variable
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
    const { companyId, role } = req.user;

    // Authorization check
    if (role !== 'super_admin') {
        return res.status(403).json({ error: 'Access Dismissed: Only super admins can invite other admins.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }

    // Input validation
    if (!full_name || !email || !password || password.length < 6 || !isValidEmail(email) || typeof location_id !== 'number' || location_id <= 0) {
        return res.status(400).json({ error: "Invalid admin invitation data provided. Full name, valid email, password (min 6 chars), and a valid location ID are required." });
    }

    try {
        // Verify location exists and belongs to the company
        const locationCheck = await query('SELECT location_id FROM Locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
        if (locationCheck.length === 0) {
            return res.status(400).json({ error: 'Selected location does not exist or does not belong to your company.' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        // Corrected: Added RETURNING user_id to get the newly created user's ID
        const result = await runCommand(
            `INSERT INTO Users (company_id, location_id, full_name, email, password_hash, role, subscription_status, plan_id) VALUES ($1, $2, $3, $4, $5, 'location_admin', 'active', 'free') RETURNING user_id`,
            [companyId, location_id, full_name, email, password_hash]
        );
        res.status(201).json({ message: "Location admin invited successfully!", userId: result.user_id });
    } catch (error) {
        console.error("Invite admin error:", error);
        if (error.message && error.message.includes('duplicate key value violates unique constraint "users_email_key"')) {
            return res.status(409).json({ error: 'Email already registered.' });
        }
        next(error);
    }
});

app.post('/invite-employee', authenticateToken, async (req, res, next) => {
    const { full_name, email, password, position, employee_id, location_id } = req.body;
    const { companyId, role, locationId: currentUserLocationId, planId: currentPlanId } = req.user; // Get planId from authenticated user

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can invite employees.' }); // Changed 'Access Denied' to 'Access Dismissed'
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
                return res.status(403).json({ error: 'Access Dismissed: Location admin can only invite employees to their assigned location or unassigned roles.' }); // Changed 'Access Denied' to 'Access Dismissed'
            }
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location cannot invite employees to any location.' }); // Changed 'Access Denied' to 'Access Dismissed'
        }
    }

    // --- NEW: Employee Limit Enforcement Logic ---
    const maxEmployeesForPlan = PLAN_EMPLOYEE_LIMITS[currentPlanId];

    if (maxEmployeesForPlan !== null) { // If the plan has a defined limit (not 'unlimited')
        try {
            // Count existing users (employees and location_admins, but NOT super_admins) for this company
            const employeeCountResult = await query(
                `SELECT COUNT(*) FROM Users WHERE company_id = $1 AND role IN ('employee', 'location_admin')`,
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

    try { // Outer try block
        if (location_id !== null && location_id > 0) { // Only check if a specific location_id is provided and is valid
            const locationCheck = await query('SELECT location_id FROM Locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
            if (locationCheck.length === 0) { return res.status(400).json({ error: 'Selected location does not exist or does not belong to your company.' }); }
        }

        const password_hash = await bcrypt.hash(password, 10);
        // Corrected: Added RETURNING user_id to get the newly created user's ID
        const result = await runCommand(
            `INSERT INTO Users (company_id, location_id, full_name, email, password_hash, role, subscription_status, plan_id, position, employee_id) VALUES ($1, $2, $3, $4, $5, 'employee', 'active', 'free', $6, $7) RETURNING user_id`,
            [companyId, location_id, full_name, email, password_hash, position, employee_id]
        );
        // The runCommand now returns an object with user_id if successful
        res.status(201).json({ message: "Employee invited successfully!", userId: result.user_id });
    } catch (error) { // The outer catch block for the above try
        console.error("Invite employee error:", error);
        if (error.message && error.message.includes('duplicate key value violates unique constraint "users_email_key"')) {
            return res.status(409).json({ error: 'Email already registered.' });
        }
        next(error);
    }
}); // Corrected: This was the missing closing curly brace for the route handler itself

// --- Multer Configuration for File Uploads ---
const UPLOADS_DIR = path.join(__dirname, 'uploads'); // Files will be stored in a subfolder 'uploads'
// Create the uploads directory if it doesn't exist
// const fs = require('fs'); // fs is already imported at the top now
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
// NEW: Increased limits to multer for file size to 1GB
const upload = multer({
    storage: storage,
    limits: { fileSize: 1 * 1024 * 1024 * 1024 } // 1 GB limit (1 * 1024 * 1024 * 1024 bytes)
});

// --- Document Management API Routes ---
app.post('/documents/upload', authenticateToken, upload.single('document_file'), async (req, res, next) => {
    const { title, description } = req.body;
    const { userId, companyId, role } = req.user;
    const file = req.file; // This comes from multer

    // Authorization: Only super_admin and location_admin can upload documents
    if (!['super_admin', 'location_admin'].includes(role)) {
        // If a location_admin tries to upload, they should only be able to if assigned to a location
        // or if the document isn't specifically tied to a location within the document's metadata
        // For now, let's keep it simple: any admin role can upload to the company's documents.
        return res.status(403).json({ error: 'Access Dismissed: Only admins can upload documents.' });
    }

    // Input validation
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: "Document title is required and must be a non-empty string." });
    }
    if (!file) {
        return res.status(400).json({ error: "No file provided for upload." });
    }
    // The Multer 'limits' option above handles file size before this point.
    // If a file exceeds the limit, Multer will throw an FAILED_TO_PARSE_BODY error with code 'LIMIT_FILE_SIZE'
    // that needs to be caught by the general error handler.
    // The previous manual size check is now removed as Multer's limits are more robust.

    try {
        const result = await runCommand(
            // Removed mime_type from the INSERT statement temporarily for debugging database schema
            `INSERT INTO Documents (company_id, title, description, file_path, file_name, uploaded_by_user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING document_id, file_path`,
            [companyId, title, description, file.path, file.originalname, userId] // Removed file.mimetype
        );
        res.status(201).json({ message: 'Document uploaded successfully!', documentId: result.document_id, filePath: result.file_path });
    } catch (error) {
        console.error("Database error during document upload:", error);
        // Clean up uploaded file if DB insert fails
        if (file && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path); // Delete the file
        }
        next(error);
    }
});

app.get('/documents', authenticateToken, async (req, res, next) => {
    const { companyId, role } = req.user;
    // Authorization: Any user within the company should be able to view documents for now
    // If specific roles should be restricted, add checks here.

    // Removed mime_type from SELECT statement temporarily for debugging database schema
    let sql = `SELECT document_id, title, description, file_name, upload_date, file_path,
                      uploaded_by_user_id -- Select the ID directly from Documents table
               FROM Documents
               WHERE company_id = $1`;

    const params = [companyId];

    try {
        const documents = await query(sql, params);
        res.json(documents);
    } catch (error) {
        // This log message was identified as potentially causing a SyntaxError in previous logs
        // Ensuring it correctly handles the error object.
        console.error(`Database error fetching documents: ${error.message || JSON.stringify(error)}`); // Improved error logging
        next(error); // Pass to general error handler
    }
});

// Route to serve files for download
app.get('/documents/download/:document_id', authenticateToken, async (req, res, next) => {
    const { document_id } = req.params;
    const { companyId, role } = req.user;

    // Input validation
    if (!document_id || isNaN(parseInt(document_id))) {
        return res.status(400).json({ error: 'Invalid document ID provided.' });
    }

    try {
        const docResult = await query(
            // Removed mime_type from SELECT statement temporarily
            'SELECT file_path, file_name, company_id FROM Documents WHERE document_id = $1',
            [document_id]
        );
        const document = docResult[0];

        if (!document) {
            return res.status(404).json({ error: 'Document not found.' });
        }

        // Authorization: Ensure document belongs to the authenticated user's company
        if (document.company_id !== companyId) {
            return res.status(403).json({ error: 'Access Dismissed: You are not authorized to download this document.' });
        }

        const filePath = document.file_path;
        const fileName = document.file_name;
        // const mimeType = document.mime_type; // No longer retrieving from DB for now

        // Check if file exists on disk
        if (!fs.existsSync(filePath)) {
            console.error(`Attempted to download non-existent file: ${filePath}`);
            return res.status(404).json({ error: 'File not found on server storage.' });
        }

        // For download, we need the mime_type. Since we're bypassing the DB for it,
        // we'll have to infer it or default to a generic type.
        // A more robust solution would be to use a library to infer mime type from file extension
        // or ensure the DB column exists.
        res.setHeader('Content-Type', 'application/octet-stream'); // Default to generic type
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.sendFile(filePath); // Send the file from local storage

    } catch (error) {
        console.error("Error serving document for download:", error);
        next(error);
    }
});

app.delete('/documents/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { companyId, role } = req.user;

    // Authorization: Only super_admin and location_admin can delete documents
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can delete documents.' });
    }
    // Input validation
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid document ID provided.' }); }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // First, get the file_path to delete the physical file
        const docResult = await client.query('SELECT file_path, company_id FROM Documents WHERE document_id = $1', [id]);
        const document = docResult.rows[0];

        if (!document) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Document not found.' });
        }
        // Ensure document belongs to the authenticated user's company
        if (document.company_id !== companyId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Access Dismissed: You are not authorized to delete this document.' });
        }

        // Delete from database
        const dbDeleteResult = await client.query('DELETE FROM Documents WHERE document_id = $1 AND company_id = $2', [id, companyId]);

        if (dbDeleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Document not found or not authorized to delete.' });
        }

        // Delete physical file after successful DB deletion
        if (fs.existsSync(document.file_path)) {
            fs.unlinkSync(document.file_path);
            console.log(`Successfully deleted physical file: ${document.file_path}`);
        } else {
            console.warn(`Attempted to delete non-existent physical file: ${document.file_path}`);
        }

        await client.query('COMMIT');
        res.status(204).send(); // No content for successful deletion

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Database error deleting document:", error);
        next(error);
    } finally {
        client.release();
    }
});

app.get('/profile', authenticateToken, async (req, res, next) => {
    try {
        const userResult = await query('SELECT user_id, company_id, location_id, full_name, email, role, subscription_status, plan_id FROM Users WHERE user_id = $1', [req.user.userId]);
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
    const { userId } = req.user;

    // Input validation
    if (fullName === undefined && email === undefined && (!currentPassword || !newPassword)) { return res.status(400).json({ error: 'No data provided for update.' }); }
    if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim() === '')) { return res.status(400).json({ error: "Full name must be a non-empty string if provided." }); }
    if (email !== undefined && !isValidEmail(email)) { return res.status(400).json({ error: "A valid email address must be provided if changing email." }); }
    if (newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length < 6)) { return res.status(400).json({ error: "New password must be at least 6 characters long if changing password." }); }
    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) { return res.status(400).json({ error: 'Both current password and new password are required to change password.' }); }

    try {
        const userResult = await query("SELECT * FROM Users WHERE user_id = $1", [userId]);
        const user = userResult[0];
        if (!user) { return res.status(404).json({ error: "User not found." }); }

        let updateSql = 'UPDATE Users SET ';
        const updateParams = [];
        const clauses = [];
        let paramIndex = 1;

        if (fullName !== undefined && fullName !== user.full_name) {
            clauses.push(`full_name = $${paramIndex++}`);
            updateParams.push(fullName);
        }
        if (email !== undefined && email !== user.email) {
            const existingUser = await query("SELECT user_id FROM Users WHERE email = $1 AND user_id != $2", [email, userId]);
            if (existingUser.length > 0) { return res.status(409).json({ error: 'Email already in use by another account.' }); }
            clauses.push(`email = $${paramIndex++}`);
            updateParams.push(email);
        }
        if (currentPassword && newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) { return res.status(401).json({ error: "Current password incorrect." }); }
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            clauses.push(`password_hash = $${paramIndex++}`);
            updateParams.push(newPasswordHash);
        }

        if (clauses.length === 0) { return res.status(200).json({ message: 'No changes detected. Profile remains the same.' }); }

        updateSql += clauses.join(', ') + ` WHERE user_id = $${paramIndex}`;
        updateParams.push(userId);

        await runCommand(updateSql, updateParams);
        
        // Fetch updated user details to regenerate token with new info (e.g., email or full_name)
        const updatedUserResult = await query("SELECT user_id, company_id, location_id, full_name, email, role, subscription_status, plan_id FROM Users WHERE user_id = $1", [userId]);
        const updatedUser = updatedUserResult[0];
        const newPayload = {
            userId: updatedUser.user_id,
            email: updatedUser.email,
            role: updatedUser.role,
            fullName: updatedUser.full_name,
            companyId: updatedUser.company_id,
            locationId: updatedUser.location_id,
            subscriptionStatus: updatedUser.subscription_status,
            planId: updatedUser.plan_id
        };
        const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Profile updated successfully!', token: newToken });

    } catch (error) {
        console.error("Error updating profile:", error);
        next(error);
    }
});

app.get('/locations', authenticateToken, async (req, res, next) => {
    const { companyId, role } = req.user;
    let sql = 'SELECT location_id, location_name, location_address FROM Locations WHERE company_id = $1';
    const params = [companyId];

    // Authorization check
    if (!['super_admin', 'location_admin', 'employee'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to view locations.' }); // Changed 'Access Denied' to 'Access Dismissed'
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
    const { companyId, role } = req.user;

    // Authorization check
    if (role !== 'super_admin') {
        return res.status(403).json({ error: 'Access Dismissed: Only super admins can create locations.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }
    // Input validation
    if (!location_name || typeof location_name !== 'string' || location_name.trim() === '' || !location_address || typeof location_address !== 'string' || location_address.trim() === '') {
        return res.status(400).json({ error: "Location name and address are required and must be non-empty strings." });
    }

    try {
        const result = await query('INSERT INTO Locations (company_id, location_name, location_address) VALUES ($1, $2, $3) RETURNING location_id', [companyId, location_name, location_address]);
        res.status(201).json({ message: 'Location created!', locationId: result[0].location_id });
    }    catch (error) {
        console.error("Database error creating location:", error);
        next(error);
    }
});

app.delete('/locations/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { companyId, role } = req.user;

    // Authorization check
    if (role !== 'super_admin') {
        return res.status(403).json({ error: 'Access Dismissed: Only super admins can delete locations.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }
    // Input validation
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid location ID provided.' }); }

    try {
        const result = await runCommand('DELETE FROM Locations WHERE location_id = $1 AND company_id = $2', [id, companyId]);
        if (result === 0) { return res.status(404).json({ error: 'Location not found or not authorized to delete.' }); }
        res.status(204).send(); // 204 No Content for successful deletion
    } catch (error) {
        console.error("Database error deleting location:", error);
        next(error);
    }
});

app.get('/users', authenticateToken, async (req, res, next) => {
    const { companyId, role, userId: currentUserId, locationId: currentUserLocationId } = req.user;
    const { filterRole, filterLocationId } = req.query;

    let sql = `SELECT Users.user_id, Users.full_name, Users.email, Users.role, Locations.location_name
                FROM Users
                LEFT JOIN Locations ON Users.location_id = Locations.location_id
                WHERE Users.company_id = $1`;
    const params = [companyId];
    let paramIndex = 2;

    // Authorization and filtering based on user role
    if (role === 'location_admin') {
        if (currentUserLocationId !== null) { // Ensure location admin is assigned a location
            sql += ` AND (Users.location_id = $${paramIndex++} OR Users.location_id IS NULL)`;
            params.push(currentUserLocationId);
        } else {
            // Location admin not assigned to a location should not see any users
            return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' }); // Changed 'Access Denied' to 'Access Dismissed'
        }
    } else if (role === 'employee') {
        sql += ` AND Users.user_id = $${paramIndex++}`;
        params.push(currentUserId);
    } else if (!['super_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to view users.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }

    const allowedRoles = ['super_admin', 'location_admin', 'employee']; // Roles that can be filtered by
    if (filterRole) {
        // Validate filterRole against allowed roles and current user's permissions
        if (!allowedRoles.includes(filterRole) || (role === 'location_admin' && filterRole === 'super_admin')) {
            return res.status(400).json({ error: 'Invalid filter role provided or insufficient permissions to filter by this role.' });
        }
        sql += ` AND Users.role = $${paramIndex++}`;
        params.push(filterRole);
    }

    if (filterLocationId) {
        if (isNaN(parseInt(filterLocationId))) { return res.status(400).json({ error: 'Invalid filter location ID provided.' }); }
        const parsedLocationId = parseInt(filterLocationId);

        // Super admin can filter by any location
        // Location admin can only filter by their assigned location (or null/unassigned)
        if (role === 'super_admin' || (role === 'location_admin' && (parsedLocationId === currentUserLocationId || parsedLocationId === 0))) {
            sql += ` AND Users.location_id = $${paramIndex++}`;
            params.push(parsedLocationId);
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to filter by location.' }); // Changed 'Access Denied' to 'Access Dismissed'
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
    const { companyId, role, userId: authenticatedUserId } = req.user;

    // Authorization check
    if (role !== 'super_admin') {
        return res.status(403).json({ error: 'Access Dismissed: Only super admins can delete users.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }
    // Prevent super admin from deleting their own account via this endpoint
    if (parseInt(id) === authenticatedUserId) {
        return res.status(403).json({ error: 'Cannot delete your own super admin account via this interface.' });
    }
    // Input validation
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid user ID provided.' }); }

    try {
        // Prevent deleting other super admin accounts
        const userToDelete = await query('SELECT role FROM Users WHERE user_id = $1 AND company_id = $2', [id, companyId]);
        if (userToDelete.length === 0) { return res.status(404).json({ error: 'User not found or not authorized to delete.' }); }
        if (userToDelete[0].role === 'super_admin') {
            return res.status(403).json({ error: 'Cannot delete another super admin account.' });
        }

        const result = await runCommand('DELETE FROM Users WHERE user_id = $1 AND company_id = $2', [id, companyId]);
        if (result === 0) { return res.status(404).json({ error: 'User not found or not authorized to delete.' }); }
        res.status(204).send();
    }  catch (error) {
        console.error("Database error deleting user:", error);
        next(error);
    }
});


// NEW: Endpoint to get positions for the dashboard dropdown
app.get('/positions', authenticateToken, async (req, res, next) => {
    const { companyId } = req.user;

    try {
        // This query selects the unique position names associated with the user's company
        const result = await query(
            'SELECT DISTINCT position FROM Checklists WHERE company_id = $1 ORDER BY position ASC', 
            [companyId]
        );

        // The frontend expects an object with an array of {id, name}.
        // We will map the database results to this format.
        const positions = result.map(row => ({
            id: row.position, // Using the position name as the ID
            name: row.position
        }));

        res.status(200).json({ positions: positions });

    } catch (error) {
        console.error("Database error fetching positions:", error);
        next(error);
    }
});


app.post('/schedules', authenticateToken, async (req, res, next) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    const { companyId, role, locationId: currentUserLocationId } = req.user;

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can create schedules.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }

    // Input validation
    if (typeof employee_id !== 'number' || employee_id <= 0 || typeof location_id !== 'number' || location_id <= 0 || !start_time || !end_time || isNaN(new Date(start_time).getTime()) || isNaN(new Date(end_time).getTime()) || new Date(start_time) >= new Date(end_time)) {
        return res.status(400).json({ error: 'Invalid schedule data provided. Ensure employee_id, location_id are valid numbers, and start_time is before end_time.' });
    }
    if (notes !== undefined && typeof notes !== 'string') { return res.status(400).json({ error: 'Notes must be a string if provided.' }); }

    try {
        // Verify employee and location belong to the company and are accessible
        const employeeCheck = await query('SELECT user_id, location_id FROM Users WHERE user_id = $1 AND company_id = $2', [employee_id, companyId]);
        if (employeeCheck.length === 0) { return res.status(400).json({ error: 'Employee not found in your company.' }); }

        const locationCheck = await query('SELECT location_id FROM Locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
        if (locationCheck.length === 0) { return res.status(400).json({ error: 'Location not found in your company.' }); }

        // Location admin specific check for scheduling employees at specific locations
        if (role === 'location_admin' && currentUserLocationId !== null) {
            // If the employee is assigned to a location, it must be the admin's location or unassigned
            if (employeeCheck[0].location_id !== null && employeeCheck[0].location_id !== currentUserLocationId) {
                 return res.status(403).json({ error: 'Access Dismissed: Location admin can only schedule employees within their assigned location or unassigned employees.' }); // Changed 'Access Denied' to 'Access Dismissed'
            }
            // The schedule's location_id must match the admin's assigned location
            if (location_id !== currentUserLocationId) {
                return res.status(403).json({ error: 'Access Dismissed: Location admin can only create schedules for their assigned location.' }); // Changed 'Access Denied' to 'Access Dismissed'
            }
        }


        const result = await runCommand(
            'INSERT INTO Schedules (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5) RETURNING schedule_id', // Return the new schedule ID
            [employee_id, location_id, start_time, end_time, notes]
        );
        res.status(201).json({ message: 'Schedule created successfully!', scheduleId: result.schedule_id });
    }  catch (error) {
        console.error("Database error creating schedule:", error);
        next(error);
    }
});

app.get('/schedules', authenticateToken, async (req, res, next) => {
    const { employee_id, location_id, start_date, end_date } = req.query;
    const { companyId, role, userId: currentUserId, locationId: currentUserLocationId } = req.user;

    let sql = `SELECT Schedules.*, Users.full_name AS employee_name, Users.email AS employee_email, Locations.location_name
                FROM Schedules
                JOIN Users ON Schedules.employee_id = Users.user_id
                JOIN Locations ON Schedules.location_id = Locations.location_id
                WHERE Users.company_id = $1`;
    const params = [companyId];
    let paramIndex = 2;

    // Authorization based on user role
    if (role === 'location_admin') {
        if (currentUserLocationId !== null) {
            sql += ` AND Schedules.location_id = $${paramIndex++}`;
            params.push(currentUserLocationId);
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' }); // Changed 'Access Denied' to 'Access Dismissed'
        }
    } else if (role === 'employee') {
        sql += ` AND Schedules.employee_id = $${paramIndex++}`;
        params.push(currentUserId);
    } else if (!['super_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to view schedules.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }
    
    // Optional filters
    if (employee_id) {
        if (isNaN(parseInt(employee_id))) { return res.status(400).json({ error: 'Invalid employee ID filter provided.' }); }
        sql += ` AND Schedules.employee_id = $${paramIndex++}`;
        params.push(parseInt(employee_id));
    }
    if (location_id) {
        if (isNaN(parseInt(location_id))) { return res.status(400).json({ error: 'Invalid location ID filter provided.' }); }
        sql += ` AND Schedules.location_id = $${paramIndex++}`;
        params.push(parseInt(location_id));
    }
    if (start_date) {
        if (isNaN(new Date(start_date).getTime())) { return res.status(400).json({ error: 'Invalid start date format.' }); }
        sql += ` AND Schedules.start_time >= $${paramIndex++}`;
        params.push(start_date);
    }
    if (end_date) {
        if (isNaN(new Date(end_date).getTime())) { return res.status(400).json({ error: 'Invalid end date format.' }); }
        sql += ` AND Schedules.end_time <= $${paramIndex++}`;
        params.push(end_date);
    }

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
    const { companyId, role, userId: currentUserId, locationId: currentUserLocationId } = req.user;

    // Authorization check
    if (role === 'employee') {
        return res.status(403).json({ error: 'Access Dismissed: Employees cannot delete schedules.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }
    // Input validation
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid schedule ID provided.' }); }

    let sql = `DELETE FROM Schedules WHERE schedule_id = $1`;
    const params = [id];
    let paramIndex = 2;

    // Additional WHERE clauses based on role for secure deletion
    if (role === 'location_admin') {
        if (currentUserLocationId === null) {
             return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' }); // Changed 'Access Denied' to 'Access Dismissed'
        }
        // Location admin can only delete schedules for employees associated with their location
        sql += ` AND employee_id IN (SELECT user_id FROM Users WHERE location_id = $${paramIndex++} AND company_id = $${paramIndex++})`;
        params.push(currentUserLocationId, companyId);
    } else if (role === 'super_admin') {
        // Super admin can delete any schedule within their company
        sql += ` AND employee_id IN (SELECT user_id FROM Users WHERE company_id = $${paramIndex++})`;
        params.push(companyId);
    } else {
        // Should be caught by initial role check, but as a fallback
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to delete schedules.' }); // Changed 'Access Denied' to 'Access Dismissed'
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

// --- Onboarding Endpoints ---

// This endpoint is called from the "Onboard New Employee" modal on the dashboard.
// It creates a new user with the 'employee' role.
app.post('/onboard-employee', authenticateToken, async (req, res, next) => {
    const { full_name, email, position_id, employee_id } = req.body;
    const { companyId, role } = req.user;

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can onboard new employees.' });
    }

    // Use the position_id from the request, which is the position name (e.g., "Sales")
    const position = position_id; 

    // Basic validation
    if (!full_name || !email || !position) {
        return res.status(400).json({ error: 'Full name, email, and a valid position are required.' });
    }

    try {
        // A simple, insecure temporary password. In a real-world scenario, you would
        // generate a more secure random password or use a token-based invitation system.
        const tempPassword = 'password123';
        const password_hash = await bcrypt.hash(tempPassword, 10);

        // Check if a checklist exists for this position to ensure it's a valid onboarding position
        const checklist = await query('SELECT 1 FROM Checklists WHERE position = $1 AND company_id = $2', [position, companyId]);
        if (checklist.length === 0) {
            return res.status(400).json({ error: `No task list found for position: '${position}'. Please create one first.` });
        }

        // Insert the new employee into the Users table
        const newUser = await runCommand(
            `INSERT INTO Users (company_id, full_name, email, password_hash, role, position, employee_id, subscription_status, plan_id) 
             VALUES ($1, $2, $3, $4, 'employee', $5, $6, 'active', 'free') RETURNING user_id`,
            [companyId, full_name, email, password_hash, position, employee_id]
        );
        
        res.status(201).json({ 
            message: `Employee onboarded successfully! Their temporary password is: ${tempPassword}`,
            userId: newUser.user_id 
        });

    } catch (error) {
        if (error.code === '23505') { // Handle duplicate email error
            return res.status(409).json({ error: 'An employee with this email address already exists.' });
        }
        console.error("Onboard employee error:", error);
        next(error);
    }
});


// This endpoint gets the list of active onboarding sessions for the main dashboard view.
app.get('/onboarding-sessions', authenticateToken, async (req, res, next) => {
    const { companyId } = req.user;
    try {
        // Step 1: Get all users with the 'employee' role for the company.
        const employees = await query(`
            SELECT user_id, full_name, email, position 
            FROM Users 
            WHERE role = 'employee' AND company_id = $1
        `, [companyId]);

        if (employees.length === 0) {
            return res.json([]);
        }

        // Step 2: For each employee, get their checklist, total tasks, and completed tasks.
        const sessions = await Promise.all(employees.map(async (employee) => {
            // Find the checklist for the employee's position.
            const checklistResult = await query('SELECT checklist_id, tasks FROM Checklists WHERE position = $1 AND company_id = $2 LIMIT 1', [employee.position, companyId]);
            if (checklistResult.length === 0) {
                return null; // Skip if no checklist is found for their position
            }
            const checklist = checklistResult[0];

            // Calculate total tasks from the JSONB structure
            let totalTasks = 0;
            if (checklist.tasks[0]?.groupTitle) { // It's a grouped list
                totalTasks = checklist.tasks.reduce((sum, group) => sum + group.tasks.length, 0);
            } else { // It's a single list
                totalTasks = checklist.tasks.length;
            }

            // Count completed tasks from the UserTasks table
            const completedResult = await query('SELECT COUNT(*) FROM UserTasks WHERE user_id = $1 AND checklist_id = $2', [employee.user_id, checklist.checklist_id]);
            const completedTasks = parseInt(completedResult[0].count, 10);

            // Filter out completed sessions
            if (totalTasks > 0 && completedTasks >= totalTasks) {
                return null;
            }

            return {
                ...employee,
                totalTasks: totalTasks,
                completedTasks: completedTasks
            };
        }));
        
        // Filter out the null values for employees with no checklist or who are complete
        res.json(sessions.filter(session => session !== null));

    } catch (error) {
        console.error("Error loading onboarding sessions:", error);
        next(error);
    }
});


// This endpoint gets the specific task list for a new hire when they view their onboarding page.
app.get('/onboarding-tasks/:userId', authenticateToken, async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await query('SELECT * FROM Users WHERE user_id = $1', [userId]);
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const position = user[0].position;
        const checklistResult = await query('SELECT * FROM Checklists WHERE position = $1 AND company_id = $2 LIMIT 1', [user[0].company_id, user[0].company_id]);
        if (checklistResult.length === 0) {
            return res.status(404).json({ error: `No checklist found for position: ${position}` });
        }
        
        const checklist = checklistResult[0];
        const completedTasksResult = await query('SELECT task_description FROM UserTasks WHERE user_id = $1 AND checklist_id = $2', [userId, checklist.checklist_id]);
        const completedTaskDescriptions = new Set(completedTasksResult.map(t => t.task_description));

        // Map tasks and add completion status and a unique ID for the frontend
        const mapTasks = (task, groupIndex, taskIndex) => {
            const isCompleted = completedTaskDescriptions.has(task.description);
            // Generate a stable, unique ID for the frontend to use
            const taskId = `${checklist.checklist_id}-${groupIndex}-${taskIndex}`;
            return { ...task, completed: isCompleted, id: taskId };
        };

        let tasksWithStatus;
        if (checklist.tasks[0]?.groupTitle) { // Grouped structure
            tasksWithStatus = checklist.tasks.map((group, groupIndex) => ({
                ...group,
                tasks: group.tasks.map((task, taskIndex) => mapTasks(task, groupIndex, taskIndex))
            }));
        } else { // Single list structure
            tasksWithStatus = checklist.tasks.map((task, taskIndex) => mapTasks(task, -1, taskIndex));
        }

        res.json({ checklist, tasks: tasksWithStatus });
    } catch (error) {
        console.error("Error fetching user onboarding tasks:", error);
        next(error);
    }
});


// This endpoint is called when a new hire checks or unchecks a task.
app.put('/onboarding-tasks/:taskId', authenticateToken, async (req, res, next) => {
    const { taskId } = req.params;
    const { completed } = req.body;
    const { userId } = req.user;

    try {
        // Deconstruct the task ID generated by the GET endpoint
        const [checklistId, groupIndex, taskIndex] = taskId.split('-').map(Number);
        
        // Fetch the checklist to get the task description from the JSON
        const checklistResult = await query('SELECT tasks FROM Checklists WHERE checklist_id = $1', [checklistId]);
        if (checklistResult.length === 0) {
            return res.status(404).json({ error: 'Checklist not found.' });
        }
        
        const checklistTasks = checklistResult[0].tasks;
        let taskDescription;

        if (groupIndex === -1) { // Single list
            taskDescription = checklistTasks[taskIndex]?.description;
        } else { // Grouped list
            taskDescription = checklistTasks[groupIndex]?.tasks[taskIndex]?.description;
        }

        if (!taskDescription) {
             return res.status(404).json({ error: 'Task not found within checklist.' });
        }

        if (completed) {
            // Add a record to UserTasks. ON CONFLICT DO NOTHING prevents errors if it's already there.
            await runCommand(`
                INSERT INTO UserTasks (user_id, checklist_id, task_description, completed_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, checklist_id, task_description) DO NOTHING
            `, [userId, checklistId, taskDescription]);
        } else {
            // Remove the record if the task is unchecked.
            await runCommand('DELETE FROM UserTasks WHERE user_id = $1 AND checklist_id = $2 AND task_description = $3', [userId, checklistId, taskDescription]);
        }
        
        res.status(200).json({ message: 'Task status updated.' });
    } catch (error) {
        console.error("Error updating task status:", error);
        next(error);
    }
});

// --- NEW: Checklist CRUD Endpoints ---

// GET all checklists for the company
app.get('/checklists', authenticateToken, async (req, res, next) => {
    const { companyId } = req.user;
    try {
        const checklists = await query('SELECT * FROM Checklists WHERE company_id = $1 ORDER BY position, title', [companyId]);
        res.status(200).json(checklists);
    } catch (error) {
        console.error("Error fetching checklists:", error);
        next(error);
    }
});

// GET a single checklist by its ID
app.get('/checklists/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { companyId } = req.user;
    try {
        const result = await query('SELECT * FROM Checklists WHERE checklist_id = $1 AND company_id = $2', [id, companyId]);
        if (result.length === 0) {
            return res.status(404).json({ error: 'Checklist not found or you do not have permission to view it.' });
        }
        res.status(200).json(result[0]);
    } catch (error) {
        console.error(`Error fetching checklist with id ${id}:`, error);
        next(error);
    }
});

// POST a new checklist
app.post('/checklists', authenticateToken, async (req, res, next) => {
    const { position, title, structure_type, group_count, tasks } = req.body;
    const { companyId, role } = req.user;

    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: You are not authorized to create task lists.' });
    }
    if (!position || !title || !structure_type || !tasks || tasks.length === 0) {
        return res.status(400).json({ error: 'Missing required fields for checklist creation.' });
    }

    try {
        const result = await runCommand(
            `INSERT INTO Checklists (company_id, position, title, structure_type, group_count, tasks)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING checklist_id`,
            [companyId, position, title, structure_type, group_count || 0, JSON.stringify(tasks)]
        );
        res.status(201).json({ message: 'Checklist created successfully!', checklistId: result.checklist_id });
    } catch (error) {
        // *** UPDATED ERROR HANDLING LOGIC ***
        if (error.code === '23505' && error.constraint === 'checklists_company_id_position_key') {
            return res.status(409).json({ error: 'A task list for this position already exists. Please use a different position name.' });
        }
        console.error("Error creating checklist:", error);
        next(error);
    }
});

// PUT (update) an existing checklist
app.put('/checklists/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { position, title, structure_type, group_count, tasks } = req.body;
    const { companyId, role } = req.user;

    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: You are not authorized to update task lists.' });
    }
    if (!position || !title || !structure_type || !tasks || tasks.length === 0) {
        return res.status(400).json({ error: 'Missing required fields for checklist update.' });
    }

    try {
        const result = await runCommand(
            `UPDATE Checklists SET position = $1, title = $2, structure_type = $3, group_count = $4, tasks = $5
             WHERE checklist_id = $6 AND company_id = $7`,
            [position, title, structure_type, group_count || 0, JSON.stringify(tasks), id, companyId]
        );
        if (result === 0) {
            return res.status(404).json({ error: 'Checklist not found or you do not have permission to update it.' });
        }
        res.status(200).json({ message: 'Checklist updated successfully!' });
    } catch (error) {
        console.error(`Error updating checklist with id ${id}:`, error);
        next(error);
    }
});

// DELETE a checklist
app.delete('/checklists/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { companyId, role } = req.user;
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: You are not authorized to delete task lists.' });
    }
    try {
        const result = await runCommand('DELETE FROM Checklists WHERE checklist_id = $1 AND company_id = $2', [id, companyId]);
        if (result === 0) {
            return res.status(404).json({ error: 'Checklist not found or you do not have permission to delete it.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting checklist with id ${id}:`, error);
        next(error);
    }
});

// --- End of NEW Checklist Endpoints ---



app.post('/job-postings', authenticateToken, async (req, res, next) => {
    const { title, description, requirements, location_id } = req.body;
    const { companyId, role, locationId: currentUserLocationId } = req.user;
    const created_date = new Date().toISOString();

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can create job postings.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }

    // Input validation
    if (!title || typeof title !== 'string' || title.trim() === '') { return res.status(400).json({ error: "Job title is required and must be a non-empty string." }); }
    if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) { return res.status(400).json({ error: 'Description must be a non-empty string if provided.' }); }
    if (requirements !== undefined && typeof requirements !== 'string') { return res.status(400).json({ error: 'Requirements must be a string if provided.' }); }
    // location_id can be null or a number
    if (location_id !== undefined && typeof location_id !== 'number' && location_id !== null) { return res.status(400).json({ error: 'Location ID must be a number or null if provided.' }); }
    if (location_id !== null && location_id <= 0) { return res.status(400).json({ error: 'Location ID must be a positive number or null.' }); }

    // Location admin specific restriction for job posting location
    if (role === 'location_admin' && currentUserLocationId !== null) {
        // If location_id is provided and it's not the admin's location or null
        if (location_id !== currentUserLocationId && location_id !== null) {
            return res.status(403).json({ error: 'Access Dismissed: Location admin can only post jobs for their assigned location or unassigned (null).' }); // Changed 'Access Denied' to 'Access Dismissed'
        }
    }

    try {
        // If a location_id is provided, verify it exists and belongs to the company
        if (location_id !== null) {
            const locationCheck = await query('SELECT location_id FROM Locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
            if (locationCheck.length === 0) {
                return res.status(400).json({ error: 'Selected location does not exist or does not belong to your company.' });
            }
        }

        const result = await runCommand(
            `INSERT INTO JobPostings (company_id, location_id, title, description, requirements, status, created_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING job_posting_id`,
            [companyId, location_id, title, description, requirements, 'Open', created_date]
        );
        res.status(201).json({ message: 'Job posting created successfully!', jobPostingId: result[0].job_posting_id });
    } catch (error) {
        console.error("Database error creating job posting:", error);
        next(error);
    }
});

app.get('/job-postings', authenticateToken, async (req, res, next) => {
    const { status, location_id } = req.query;
    const { companyId, role, locationId: currentUserLocationId } = req.user;

    let sql = 'SELECT * FROM JobPostings WHERE company_id = $1';
    const params = [companyId];
    let paramIndex = 2;

    // Authorization and filtering based on user role
    if (role === 'location_admin') {
        if (currentUserLocationId !== null) {
            sql += ` AND (location_id = $${paramIndex++} OR location_id IS NULL)`; // Location admins see their location's jobs and unassigned jobs
            params.push(currentUserLocationId);
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' }); // Changed 'Access Denied' to 'Access Dismissed'
        }
    } else if (role === 'employee') {
        // Employees generally shouldn't see all job postings unless for internal applications
        // For now, deny access, or tailor a specific view for employees if needed
        return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to view job postings.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }
    // Super admin already has access via companyId filter


    const allowedStatuses = ['Open', 'Closed', 'Filled'];
    if (status) {
        if (!allowedStatuses.includes(status)) { return res.status(400).json({ error: 'Invalid job posting status filter provided.' }); }
        sql += ` AND status = $${paramIndex++}`;
        params.push(status);
    }

    if (location_id) {
        if (isNaN(parseInt(location_id))) { return res.status(400).json({ error: 'Invalid location ID filter provided.' }); }
        const parsedLocationId = parseInt(location_id);

        // Super admin can filter by any location
        // Location admin can only filter by their assigned location or null (unassigned)
        if (role === 'super_admin' || (role === 'location_admin' && (parsedLocationId === currentUserLocationId || parsedLocationId === 0))) {
            sql += ` AND location_id = $${paramIndex++}`;
            params.push(parsedLocationId);
        } else {
            return res.status(403).json({ error: 'Access Dismissed: Insufficient permissions to filter by location.' }); // Changed 'Access Denied' to 'Access Dismissed'
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
    const { companyId, role, locationId: currentUserLocationId } = req.user;

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can update job postings.' }); // Changed 'Access Denied' to 'Access Dismissed'
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


    let updateSql = 'UPDATE JobPostings SET ';
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
            return res.status(403).json({ error: 'Access Dismissed: Location admin cannot change job posting location to another location.' }); // Changed 'Access Denied' to 'Access Dismissed'
        }
    }

    if (clauses.length === 0) { return res.status(400).json({ error: 'No fields provided for update.' }); }

    updateSql += clauses.join(', ') + ` WHERE job_posting_id = $${paramIndex++} AND company_id = $${paramIndex++}`;
    updateParams.push(parseInt(id), companyId);

    // Ensure location admin can only update jobs within their assigned location or unassigned jobs
    if (role === 'location_admin' && currentUserLocationId !== null) {
        updateSql += ` AND (location_id = $${paramIndex++} OR location_id IS NULL)`;
        updateParams.push(currentUserLocationId);
    } else if (role === 'location_admin' && currentUserLocationId === null) {
        return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' }); // Changed 'Access Denied' to 'Access Dismissed'
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
    const { companyId, role, locationId: currentUserLocationId } = req.user;

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can delete job postings.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }
    // Input validation
    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ error: 'Invalid job posting ID provided.' }); }

    let sql = 'DELETE FROM JobPostings WHERE job_posting_id = $1 AND company_id = $2';
    const params = [id, companyId];
    let paramIndex = 3;

    // Location admin specific restriction for deletion
    if (role === 'location_admin' && currentUserLocationId !== null) {
        sql += ` AND (location_id = $${paramIndex++} OR location_id IS NULL)`; // Can delete jobs at their location or unassigned
        params.push(currentUserLocationId);
    } else if (role === 'location_admin' && currentUserLocationId === null) {
        return res.status(403).json({ error: 'Access Dismissed: Location admin not assigned to a location.' }); // Changed 'Access Denied' to 'Access Dismissed'
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
    const { job_posting_id, full_name, email, notes, location_id, phone_number } = req.body;
    const { companyId, role, locationId: currentUserLocationId } = req.user;
    const application_date = new Date().toISOString();

    // Authorization check
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Dismissed: Only admins can add applicants.' }); // Changed 'Access Denied' to 'Access Dismissed'
    }

    // Input validation
    if (typeof job_posting_id !== 'number' || job_posting_id <= 0 || !full_name || typeof full_name !== 'string' || full_name.trim() === '' || !email || !isValidEmail(email) || !phone_number || typeof phone_number !== 'string' || phone_number.trim() === '') {
        return res.status(400).json({ error: 'Invalid applicant data provided. Job Posting ID, full name, valid email, and phone number are required.' });
    }
    if (notes !== undefined && typeof notes !== 'string') { return res.status(400).json({ error: 'Notes must be a string if provided.' }); }
    // location_id can be null or a number
    if (location_id !== undefined && typeof location_id !== 'number' && location_id !== null) { return res.status(400).json({ error: 'Location ID must be a number or null if provided.' }); }
    if (location_id !== null && location_id <= 0) { return res.status(400).json({ error: 'Location ID must be a positive number or null.' }); }


    try {
        const jobPostingCheck = await query('SELECT job_posting_id, location_id FROM JobPostings WHERE job_posting_id = $1 AND company_id = $2', [job_posting_id, companyId]);
        if (jobPostingCheck.length === 0) { return res.status(400).json({ error: 'Job Posting not found or does not belong to your company.' }); }

        // Determine the actual location_id for the applicant.
        // If location_id is provided in the body, use it. Otherwise, use the job posting's location.
        // If job posting's location is null, the applicant's location will also be null.
        const actualLocationId = location_id === undefined ? jobPostingCheck[0].location_id : location_id;

        // Location admin specific check
        if (role === 'location_admin' && currentUserLocationId !== null) {
            // An applicant cannot be added to a job posting whose location is outside the admin's assigned location,
            // unless the job posting itself is unassigned (null).
            if (actualLocationId !== currentUserLocationId && actualLocationId !== null) {
                return res.status(403).json({ error: 'Access Dismissed: Location admin cannot add applicants to jobs outside their assigned location.' }); // Changed 'Access Denied' to 'Access Dismissed'
            }
        }

        const result = await runCommand(
            `INSERT INTO Applicants (company_id, location_id, job_posting_id, full_name, email, phone_number, notes, application_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING applicant_id`, // Added status with default and returning ID
            [companyId, actualLocationId, job_posting_id, full_name, email, phone_number, notes, application_date, 'Applied'] // Default status 'Applied'
        );
        res.status(201).json({ message: 'Applicant added successfully!', applicantId: result.applicant_id });
    } catch (error) {
        console.error("Database error creating applicant:", error);
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
    app.listen(PORT, () => {
        console.log(`Server is running successfully on http://localhost:${PORT}`);
    });
} else {
    module.exports = app;
}
" in the document and am asking a query about/based on this code below.
Instructions to follow:
  * Don't output/edit the document if the query is Direct/Simple. For example, if the query asks for a simple explanation, output a direct answer.
  * Make sure to **edit** the document if the query shows the intent of editing the document, in which case output the entire edited document, **not just that section or the edits**.
    * Don't output the same document/empty document and say that you have edited it.
    * Don't change unrelated code in the document.
  * Don't output  and  in your final response.
  * Any references like "this" or "selected code" refers to the code between  and  tags.
  * Just acknowledge my request in the introduction.
  * Make sure to refer to the document as "Canvas" in your response.

i have selected all the code in the document can you tell me what is going on he