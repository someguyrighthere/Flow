// --- Imports ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // Import cors
const path = require('path');
const csv = require('csv-parser'); // For CSV parsing
const { Readable } = require('stream'); // For creating a readable stream from a string
const rateLimit = require('express-rate-limit'); // Import rate-limiting middleware
const morgan = require('morgan'); // Import morgan for request logging

// Load environment variables from .env file in development
// IMPORTANT: Only load .env if server.js is run directly, NOT when required by tests.
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    require('dotenv').config();
}

// Import the Stripe library and initialize it with your secret key
// Use process.env.STRIPE_SECRET_KEY for production
const stripeInstance = require('stripe')(process.env.STRIPE_SECRET_KEY || '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');

// --- App Initialization ---
const app = express();

// Configure CORS for production environment
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:8000']; // Default to localhost for development

// Add 'null' to allowed origins if not in production and not explicitly set for local file access
if (process.env.NODE_ENV !== 'production' && !process.env.CORS_ORIGIN) {
    allowedOrigins.push('null');
}

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or local file access if 'null' is in allowedOrigins)
        if (!origin) {
            // Check if 'null' is explicitly allowed or if we're in dev and no CORS_ORIGIN is set
            if (allowedOrigins.includes('null') || (process.env.NODE_ENV !== 'production' && !process.env.CORS_ORIGIN)) {
                return callback(null, true);
            }
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }

        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Allow cookies to be sent
    optionsSuccessStatus: 204 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));


// Use process.env.PORT for production, fallback to 3000 for local development
const PORT = process.env.PORT || 3000;

// Define a webhook secret for Stripe. This should also be an environment variable.
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_YOUR_WEBHOOK_SECRET';

// --- Rate Limiting Configuration ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max 10 requests per 15 minutes per IP
    message: 'Too many login/registration attempts from this IP, please try again after 15 minutes',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// --- Middleware for Stripe Webhook (MUST be before express.json() for other routes) --
// This route needs the raw body for signature verification.
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('Checkout Session Completed:', session.id);
            const userId = session.metadata.userId;
            const planId = session.metadata.planId;
            if (session.payment_status === 'paid' && userId && planId) {
                db.run(
                    'UPDATE Users SET stripe_customer_id = ?, stripe_subscription_id = ?, subscription_status = ?, plan_id = ? WHERE user_id = ?',
                    [session.customer, session.subscription, 'active', planId, userId],
                    function(err) {
                        if (err) console.error('Database update error for checkout.session.completed:', err.message);
                        else console.log(`User ${userId} subscription updated to ${planId} (active).`);
                    }
                );
            }
            break;
        case 'customer.subscription.updated':
            const subscriptionUpdated = event.data.object;
            console.log('Subscription Updated:', subscriptionUpdated.id);
            if (subscriptionUpdated.customer && subscriptionUpdated.status && subscriptionUpdated.plan && subscriptionUpdated.plan.id) {
                db.run(
                    'UPDATE Users SET subscription_status = ?, plan_id = ? WHERE stripe_customer_id = ?',
                    [subscriptionUpdated.status, subscriptionUpdated.plan.id, subscriptionUpdated.customer],
                    function(err) {
                        if (err) console.error('Database update error for customer.subscription.updated:', err.message);
                        else console.log(`Subscription for customer ${subscriptionUpdated.customer} status updated to ${subscriptionUpdated.status} and plan to ${subscriptionUpdated.plan.id}.`);
                    }
                );
            }
            break;
        case 'customer.subscription.deleted':
            const subscriptionDeleted = event.data.object;
            console.log('Subscription Deleted:', subscriptionDeleted.id);
            if (subscriptionDeleted.customer) {
                db.run(
                    'UPDATE Users SET subscription_status = ?, plan_id = ?, stripe_subscription_id = NULL WHERE stripe_customer_id = ?',
                    ['cancelled', 'free', subscriptionDeleted.customer],
                    function(err) {
                        if (err) console.error('Database update error for customer.subscription.deleted:', err.message);
                        else console.log(`Subscription for customer ${subscriptionDeleted.customer} marked as cancelled and reverted to free.`);
                    }
                );
            }
            break;
        case 'invoice.payment_succeeded':
            const invoiceSucceeded = event.data.object;
            console.log('Invoice Payment Succeeded:', invoiceSucceeded.id);
            if (invoiceSucceeded.subscription && invoiceSucceeded.customer) {
                db.run(
                    'UPDATE Users SET subscription_status = ? WHERE stripe_subscription_id = ? AND stripe_customer_id = ?',
                    ['active', invoiceSucceeded.subscription, invoiceSucceeded.customer],
                    function(err) {
                        if (err) console.error('Database update error for invoice.payment_succeeded:', err.message);
                        else console.log(`Subscription ${invoiceSucceeded.subscription} status set to active.`);
                    }
                );
            }
            break;
        case 'invoice.payment_failed':
            const invoiceFailed = event.data.object;
            console.log('Invoice Payment Failed:', invoiceFailed.id);
            if (invoiceFailed.subscription && invoiceFailed.customer) {
                db.run(
                    'UPDATE Users SET subscription_status = ? WHERE stripe_subscription_id = ? AND stripe_customer_id = ?',
                    ['past_due', invoiceFailed.subscription, invoiceFailed.customer],
                    function(err) {
                        if (err) console.error('Database update error for invoice.payment_failed:', err.message);
                        else console.log(`Subscription ${invoiceFailed.subscription} status set to past_due.`);
                    }
                );
            }
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
    res.status(200).json({ received: true });
});

// IMPORTANT: express.json() for parsing JSON request bodies MUST come AFTER the webhook route
app.use(express.json());

// --- JWT Secret ---
// CRUCIAL FOR TESTING: Directly access process.env.JWT_SECRET without fallback.
// This ensures tests control the secret used by the app instance.
const JWT_SECRET = process.env.JWT_SECRET; // Ensure it *must* come from process.env

// --- Request Logging (using Morgan) ---
// 'dev' format is good for development, 'combined' or 'tiny' for production logs
app.use(morgan('dev'));

// --- Serve Static Files (Frontend) with Caching ---
// This middleware serves static files from the 'onboardflow' root directory
// and sets Cache-Control headers for browser caching.
app.use(express.static(path.join(__dirname, '..'), {
    maxAge: '7d', // Cache static assets for 7 days (e.g., CSS, JS, images, favicon)
    immutable: false // Set to true if asset filenames include content hashes (e.g., app.min.js?v=hash)
}));

// --- Database Setup ---
const db = new sqlite3.Database('./onboardflow.db', (err) => {
    if (err) {
        // Log database connection error and exit
        console.error("Error opening database:", err.message);
        process.exit(1); // Exit process if database connection fails
    } else {
        console.log("Successfully connected to the database.");
        db.get("PRAGMA foreign_keys = ON");
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS Companies (company_id INTEGER PRIMARY KEY AUTOINCREMENT, company_name TEXT NOT NULL UNIQUE)`);
            db.run(`CREATE TABLE IF NOT EXISTS Locations (location_id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER, location_name TEXT NOT NULL, location_address TEXT NOT NULL, FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE)`);
            db.run(`CREATE TABLE IF NOT EXISTS Users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER,
                location_id INTEGER,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                position TEXT,
                employee_id TEXT,
                role TEXT NOT NULL,
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                subscription_status TEXT,
                plan_id TEXT,
                FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES Locations(location_id) ON DELETE CASCADE
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS Schedules (
                schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                location_id INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (employee_id) REFERENCES Users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES Locations(location_id) ON DELETE CASCADE
            )`);
            // NEW: Create JobPostings table
            db.run(`CREATE TABLE IF NOT EXISTS JobPostings (
                job_posting_id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                location_id INTEGER, -- Optional: link job posting to a specific location
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                requirements TEXT, -- Optional: job requirements
                status TEXT NOT NULL DEFAULT 'Open', -- e.g., 'Open', 'Closed', 'Filled'
                created_date TEXT NOT NULL, -- ISO 8601 format
                FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES Locations(location_id) ON DELETE CASCADE
            )`);
            // Update Applicants table schema to link to JobPostings and add phone_number
            db.run(`CREATE TABLE IF NOT EXISTS Applicants (
                applicant_id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                location_id INTEGER, -- Optional: applicant's preferred location or location applied for
                job_posting_id INTEGER, -- NEW: Link to JobPostings table
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone_number TEXT, -- NEW: Phone number field
                status TEXT NOT NULL DEFAULT 'Applied', -- e.g., 'Applied', 'Interviewing', 'Rejected', 'Hired'
                resume_url TEXT, -- Optional: URL to a resume document (e.g., hosted on cloud storage)
                notes TEXT,
                application_date TEXT NOT NULL, -- ISO 8601 format
                FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES Locations(location_id) ON DELETE CASCADE,
                FOREIGN KEY (job_posting_id) REFERENCES JobPostings(job_posting_id) ON DELETE SET NULL -- If job posting is deleted, set this to NULL
            )`);
            // NEW: Create Documents table for file/video uploads
            db.run(`CREATE TABLE IF NOT EXISTS Documents (
                document_id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL, -- User who uploaded the document
                title TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_url TEXT NOT NULL, -- URL to the stored file (e.g., S3, GCS)
                description TEXT,
                upload_date TEXT NOT NULL, -- ISO 8601 format
                FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
            )`);
        });
    }
});

// --- Authentication Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Log the specific JWT error for debugging
            console.error("JWT Verification Error:", err.message);
            return res.status(403).json({ error: 'Forbidden: Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
}

// --- Helper for Input Validation ---
const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// --- API Routes (ALL API ROUTES SHOULD BE DEFINED HERE, BEFORE STATIC FILE SERVING) ---

// Apply rate limiting to authentication routes
app.post('/api/register', authLimiter, async (req, res, next) => { // Added 'next'
    const { company_name, full_name, email, password } = req.body;

    // Input Validation for Registration
    if (!company_name || typeof company_name !== 'string' || company_name.trim() === '') {
        return res.status(400).json({ error: "Company name is required and must be a non-empty string." });
    }
    if (!full_name || typeof full_name !== 'string' || full_name.trim() === '') {
        return res.status(400).json({ error: "Full name is required and must be a non-empty string." });
    }
    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: "A valid email address is required." });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: "Password is required and must be at least 6 characters long." });
    }

    try {
        const password_hash = await bcrypt.hash(password, 10);
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('INSERT INTO Companies (company_name) VALUES (?)', [company_name], function(err) {
                if (err) { 
                    db.run('ROLLBACK'); 
                    console.error("Database error creating company:", err);
                    return next(new Error("Could not create company.")); // Pass error to error handling middleware
                }
                const newCompanyId = this.lastID;
                db.run(`INSERT INTO Users (company_id, location_id, full_name, email, password_hash, role, subscription_status, plan_id) VALUES (?, ?, ?, ?, ?, 'super_admin', 'active', 'free')`, [newCompanyId, null, full_name, email, password_hash], function(userInsertErr) {
                    if (userInsertErr) { 
                        db.run('ROLLBACK'); 
                        console.error("Database error creating user:", userInsertErr);
                        if (userInsertErr.message.includes('UNIQUE constraint failed: Users.email')) { 
                            return res.status(409).json({ error: 'Email already registered.' }); 
                        }
                        return next(new Error("Could not create user.")); // Pass error
                    }
                    db.run('COMMIT');
                    res.status(201).json({ message: "Company and user registered successfully!", userId: this.lastID });
                });
            });
        });
    } catch (error) { 
        console.error("Registration error:", error);
        next(error); // Pass error to error handling middleware
    }
});

app.post('/api/login', authLimiter, (req, res, next) => { // Added 'next'
    const { email, password } = req.body;

    // Input Validation for Login
    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: "A valid email address is required." });
    }
    if (!password || typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({ error: "Password is required." });
    }

    db.get("SELECT * FROM Users WHERE email = ?", [email], async (err, user) => {
        if (err) {
            console.error("Database error during login:", err);
            return next(new Error("A server error occurred during login.")); // Pass error
        }
        if (!user) { 
            return res.status(401).json({ error: "Invalid credentials." }); 
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) { 
            return res.status(401).json({ error: "Invalid credentials." }); 
        }
        const payload = { userId: user.user_id, email: user.email, role: user.role, fullName: user.full_name, companyId: user.company_id, locationId: user.location_id, subscriptionStatus: user.subscription_status, planId: user.plan_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: "Login successful!", token, role: user.role });
    });
});

app.post('/api/invite-admin', authenticateToken, async (req, res, next) => { // Added 'next'
    const { full_name, email, password, location_id } = req.body;
    const { companyId, role } = req.user;

    // Input Validation for Invite Admin
    if (role !== 'super_admin') { return res.status(403).json({ error: 'Access Denied: Only super admins can invite other admins.' }); }
    if (!full_name || typeof full_name !== 'string' || full_name.trim() === '') {
        return res.status(400).json({ error: "Full name is required and must be a non-empty string." });
    }
    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: "A valid email address is required." });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: "Temporary password is required and must be at least 6 characters long." });
    }
    if (typeof location_id !== 'number' || location_id <= 0) { // Assuming location_id is an integer ID
        return res.status(400).json({ error: "A valid location ID is required." });
    }

    try {
        const password_hash = await bcrypt.hash(password, 10);
        db.get('SELECT * FROM Locations WHERE location_id = ? AND company_id = ?', [location_id, companyId], (err, location) => {
            if (err) { console.error("Database error checking location:", err); return next(new Error('Database error when verifying location.')); } // Pass error
            if (!location) { return res.status(400).json({ error: 'Selected location does not exist or does not belong to your company.' }); }
            db.run(`INSERT INTO Users (company_id, location_id, full_name, email, password_hash, role, subscription_status, plan_id) VALUES (?, ?, ?, ?, ?, 'location_admin', 'active', 'free')`, [companyId, location_id, full_name, email, password_hash], function(userInsertErr) {
                if (userInsertErr) {
                    console.error("Database error inviting admin:", userInsertErr);
                    if (userInsertErr.message.includes('UNIQUE constraint failed: Users.email')) { return res.status(409).json({ error: 'Email already registered.' }); }
                    return next(new Error('Failed to invite admin.')); // Pass error
                }
                res.status(201).json({ message: "Location admin invited successfully!", userId: this.lastID });
            });
        });
    } catch (error) { console.error("Invite admin error:", error); next(error); } // Pass error
});

// NEW: API endpoint for inviting employees
app.post('/api/invite-employee', authenticateToken, async (req, res, next) => {
    const { full_name, email, password, position, employee_id, location_id } = req.body;
    const { companyId, role, locationId: currentUserLocationId } = req.user;

    // Authorization: Super admin can invite anyone, Location admin can only invite to their location or unassigned
    if (!['super_admin', 'location_admin'].includes(role)) {
        return res.status(403).json({ error: 'Access Denied: Only admins can invite employees.' });
    }

    // Input Validation for Invite Employee
    if (!full_name || typeof full_name !== 'string' || full_name.trim() === '') {
        return res.status(400).json({ error: "Full name is required and must be a non-empty string." });
    }
    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: "A valid email address is required." });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: "Temporary password is required and must be at least 6 characters long." });
    }
    
    // Corrected location_id validation: Must be a number > 0.
    // If location_id is null, it indicates an unassigned location, which is valid for a super admin.
    // For location_admin, it must match their current location.
    // This revised logic correctly checks for null OR a valid positive integer.
    const isLocationIdValid = location_id === null || (typeof location_id === 'number' && !isNaN(location_id) && location_id > 0);
    if (!isLocationIdValid) {
        return res.status(400).json({ error: "A valid location ID (positive number) is required for employee, or null for unassigned." });
    }
    
    if (position !== undefined && typeof position !== 'string') {
        return res.status(400).json({ error: 'Position must be a string if provided.' });
    }
    if (employee_id !== undefined && typeof employee_id !== 'string') {
        return res.status(400).json({ error: 'Employee ID must be a string if provided.' });
    }

    // Location Admin specific check: ensure they are inviting to their assigned location or null
    // If location_admin tries to set a location that is NOT their own, block it.
    // Allow location_admin to set to null if their current location is null.
    if (role === 'location_admin') {
        // A location admin can ONLY assign an employee to their own location or to null (unassigned)
        if (location_id !== currentUserLocationId) {
            // If the target location_id is not the current user's location, check if both are null
            if (!(location_id === null && currentUserLocationId === null)) {
                return res.status(403).json({ error: 'Access Denied: Location admin can only invite employees to their assigned location.' });
            }
        }
    }


    try {
        const password_hash = await bcrypt.hash(password, 10);

        // Verify the location_id belongs to the company and, if location_admin, matches their assigned location
        // This check is crucial if location_id is NOT null
        if (location_id !== null) {
            const locationVerification = await new Promise((resolve, reject) => {
                db.get('SELECT location_id FROM Locations WHERE location_id = ? AND company_id = ?', [location_id, companyId], (err, location) => {
                    if (err) reject(err);
                    resolve(location);
                });
            });
            if (!locationVerification) {
                return res.status(400).json({ error: 'Selected location does not exist or does not belong to your company.' });
            }
        }

        db.run(
            `INSERT INTO Users (company_id, location_id, full_name, email, password_hash, position, employee_id, role, subscription_status, plan_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'employee', 'active', 'free')`,
            [companyId, location_id, full_name, email, password_hash, position, employee_id,], // Default new employees to 'employee' role
            function(userInsertErr) {
                if (userInsertErr) {
                    console.error("Database error inviting employee:", userInsertErr);
                    if (userInsertErr.message.includes('UNIQUE constraint failed: Users.email')) { return res.status(409).json({ error: 'Email already registered.' }); }
                    return next(new Error('Failed to invite employee.'));
                }
                res.status(201).json({ message: "Employee invited successfully!", userId: this.lastID });
            }
        );
    } catch (error) {
        console.error("Invite employee error:", error);
        next(error);
    }
});


app.get('/api/profile', authenticateToken, (req, res) => {
    const { userId, fullName, email, role, companyId, locationId, subscriptionStatus, planId } = req.user;
    res.status(200).json({ userId, fullName, email, role, companyId, locationId, subscriptionStatus, planId });
});

app.put('/api/profile', authenticateToken, async (req, res, next) => { // Added 'next'
    const { fullName, email, currentPassword, newPassword } = req.body;
    const { userId } = req.user;

    // Input Validation for Profile Update
    if (fullName === undefined && email === undefined && (!currentPassword || !newPassword)) {
        return res.status(400).json({ error: 'No data provided for update.' });
    }
    if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim() === '')) {
        return res.status(400).json({ error: "Full name must be a non-empty string if provided." });
    }
    if (email !== undefined && !isValidEmail(email)) {
        return res.status(400).json({ error: "A valid email address must be provided if changing email." });
    }
    if (newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length < 6)) {
        return res.status(400).json({ error: "New password must be at least 6 characters long if changing password." });
    }
    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
        return res.status(400).json({ error: 'Both current password and new password are required to change password.' });
    }


    db.get("SELECT * FROM Users WHERE user_id = ?", [userId], async (err, user) => {
        if (err) { console.error("Database error fetching user for profile update:", err); return next(new Error("Server error during profile update.")); } // Pass error
        if (!user) { return res.status(404).json({ error: "User not found." }); }
        let updateSql = 'UPDATE Users SET ';
        const updateParams = [];
        const clauses = [];
        let changesMade = false;
        if (fullName !== undefined && fullName !== user.full_name) {
            clauses.push('full_name = ?');
            updateParams.push(fullName);
            changesMade = true;
        }
        if (email !== undefined && email !== user.email) {
            try { // Added try-catch for async await in db.get
                const existingUser = await new Promise((resolve, reject) => {
                    db.get("SELECT user_id FROM Users WHERE email = ? AND user_id != ?", [email, userId], (err, row) => {
                        if (err) reject(err);
                        resolve(row);
                    });
                });
                if (existingUser) { return res.status(409).json({ error: 'Email already in use by another account.' }); }
            } catch (dbErr) {
                console.error("Database error checking existing email:", dbErr);
                return next(new Error("Server error verifying email availability."));
            }
            clauses.push('email = ?');
            updateParams.push(email);
            changesMade = true;
        }
        if (currentPassword && newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) { return res.status(401).json({ error: "Current password incorrect." }); }
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            clauses.push('password_hash = ?');
            updateParams.push(newPasswordHash);
            changesMade = true;
        }
        if (!changesMade) { return res.status(200).json({ message: 'No changes detected. Profile remains the same.' }); }
        updateSql += clauses.join(', ') + ' WHERE user_id = ?';
        updateParams.push(userId);
        db.run(updateSql, updateParams, function(updateErr) {
            if (updateErr) { console.error("Database error updating profile:", updateErr); return next(new Error('Failed to update profile.')); } // Pass error
            if (this.changes > 0) {
                db.get("SELECT * FROM Users WHERE user_id = ?", [userId], (fetchErr, updatedUser) => {
                    if (fetchErr || !updatedUser) { console.error("Error fetching updated user for new token:", fetchErr); return res.status(200).json({ message: 'Profile updated successfully, but token could not be refreshed.' }); }
                    const newPayload = { userId: updatedUser.user_id, email: updatedUser.email, role: updatedUser.role, fullName: updatedUser.full_name, companyId: updatedUser.company_id, locationId: updatedUser.location_id, subscriptionStatus: updatedUser.subscription_status, planId: user.plan_id };
                    const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '1h' });
                    res.status(200).json({ message: 'Profile updated successfully!', token: newToken });
                });
            } else { res.status(200).json({ message: 'No changes applied as data was identical.' }); }
        });
    });
});

app.get('/api/locations', authenticateToken, (req, res, next) => { // Added 'next'
    const { companyId, role } = req.user;
    let sql = 'SELECT location_id, location_name, location_address FROM Locations WHERE company_id = ?';
    const params = [companyId];

    // Allowing super_admin, location_admin, and employee to view all locations in their company for dropdowns/selection
    if (!['super_admin', 'location_admin', 'employee'].includes(role)) {
        return res.status(403).json({ error: 'Access Denied: Insufficient permissions to view locations.' });
    }

    db.all(sql, params, (err, rows) => {
        if (err) { console.error("Database error fetching locations:", err); return next(new Error('Database error fetching locations.')); } // Pass error
        res.json(rows);
    });
});

app.post('/api/locations', authenticateToken, (req, res, next) => { // Added 'next'
    const { location_name, location_address } = req.body;
    const { companyId, role } = req.user;

    // Input Validation for Create Location
    if (role !== 'super_admin') { return res.status(403).json({ error: 'Access Denied: Only super admins can create locations.' }); }
    if (!location_name || typeof location_name !== 'string' || location_name.trim() === '') {
        return res.status(400).json({ error: "Location name is required and must be a non-empty string." });
    }
    if (!location_address || typeof location_address !== 'string' || location_address.trim() === '') {
        return res.status(400).json({ error: "Location address is required and must be a non-empty string." });
    }

    db.run('INSERT INTO Locations (company_id, location_name, location_address) VALUES (?, ?, ?)', [companyId, location_name, location_address], function(err) {
        if (err) { console.error("Database error creating location:", err); return next(new Error('Failed to create location.')); } // Pass error
        res.status(201).json({ message: 'Location created!', locationId: this.lastID });
    });
});

app.delete('/api/locations/:id', authenticateToken, (req, res, next) => { // Added 'next'
    const { id } = req.params;
    const { companyId, role } = req.user;
    if (role !== 'super_admin') { return res.status(403).json({ error: 'Access Denied: Only super admins can delete locations.' }); }

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid location ID provided.' });
    }

    db.run('DELETE FROM Locations WHERE location_id = ? AND company_id = ?', [id, companyId], function(err) {
        if (err) { console.error("Database error deleting location:", err); return next(new Error('Failed to delete location.')); } // Pass error
        if (this.changes === 0) { return res.status(404).json({ error: 'Location not found or not authorized to delete.' }); }
        res.status(204).send();
    });
});

app.get('/api/users', authenticateToken, (req, res, next) => { // Added 'next'
    const { companyId, role, userId: currentUserId, locationId: currentUserLocationId } = req.user;
    const { filterRole, filterLocationId } = req.query;

    let sql = `SELECT Users.user_id, Users.full_name, Users.email, Users.role, Locations.location_name
               FROM Users
               LEFT JOIN Locations ON Users.location_id = Locations.location_id
               WHERE Users.company_id = ?`;
    const params = [companyId];

    if (role === 'super_admin') {
        // Super admin can view all users in their company.
    } else if (role === 'location_admin') {
        // Location admin can view all users within their assigned location, plus unassigned users for their company.
        if (currentUserLocationId) {
            sql += ` AND (Users.location_id = ? OR Users.location_id IS NULL)`; // Admins might need to see unassigned users
            params.push(currentUserLocationId);
        } else {
            return res.status(403).json({ error: 'Access Denied: Location admin not assigned to a location.' });
        }
    } else if (role === 'employee') {
        sql += ` AND Users.user_id = ?`;
        params.push(currentUserId);
    } else {
        return res.status(403).json({ error: 'Access Denied: Insufficient permissions to view users.' });
    }

    // Input validation for filterRole and filterLocationId
    const allowedRoles = ['super_admin', 'location_admin', 'employee'];
    if (filterRole && (!allowedRoles.includes(filterRole) || (role === 'location_admin' && filterRole === 'super_admin'))) {
        return res.status(400).json({ error: 'Invalid filter role provided or insufficient permissions to filter by this role.' });
    }
    if (filterLocationId && isNaN(parseInt(filterLocationId))) {
        return res.status(400).json({ error: 'Invalid filter location ID provided.' });
    }


    if (filterRole) {
        if (role === 'super_admin' || (role === 'location_admin' && (filterRole === 'employee' || filterRole === 'location_admin')) || (role === 'employee' && filterRole === 'employee')) {
            sql += ` AND Users.role = ?`;
            params.push(filterRole);
        } else {
            // This case should ideally be caught by the earlier validation for allowedRoles, but for defense-in-depth:
            return res.status(403).json({ error: 'Access Denied: Insufficient permissions to filter by role.' });
        }
    }
    if (filterLocationId) {
        // Ensure location_admin can only filter by their own location
        if (role === 'super_admin' || (role === 'location_admin' && parseInt(filterLocationId) === currentUserLocationId)) {
            sql += ` AND Users.location_id = ?`;
            params.push(filterLocationId);
        } else {
            return res.status(403).json({ error: 'Access Denied: Insufficient permissions to filter by location.' });
        }
    }

    db.all(sql, params, (err, rows) => {
        if (err) { console.error("Database error fetching users:", err); return next(new Error('Database error fetching users.')); } // Pass error
        res.json(rows);
    });
});

app.delete('/api/users/:id', authenticateToken, (req, res, next) => { // Added 'next'
    const { id } = req.params;
    const { companyId, role, userId: authenticatedUserId } = req.user;
    if (role !== 'super_admin') { return res.status(403).json({ error: 'Access Denied: Only super admins can delete users.' }); }
    if (parseInt(id) === authenticatedUserId) { return res.status(403).json({ error: 'Cannot delete your own super admin account via this interface.' }); }

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid user ID provided.' });
    }

    db.run('DELETE FROM Users WHERE user_id = ? AND company_id = ? AND role != \'super_admin\'', [id, companyId], function(err) {
        if (err) { console.error("Database error deleting user:", err); return next(new Error('Failed to delete user.')); } // Pass error
        if (this.changes === 0) { return res.status(404).json({ error: 'User not found or not authorized to delete.' }); }
        res.status(204).send();
    });
});

app.post('/api/create-checkout-session', authenticateToken, async (req, res, next) => { // Added 'next'
    const { planId } = req.body;
    const { userId, email, companyId } = req.user;

    // Input Validation for planId
    const allowedPlanIds = ['pro', 'enterprise'];
    if (!planId || !allowedPlanIds.includes(planId)) {
        return res.status(400).json({ error: 'Invalid plan ID provided.' });
    }

    const priceIdMap = {
        'pro': process.env.STRIPE_PRICE_ID_PRO,       // Use environment variable
        'enterprise': process.env.STRIPE_PRICE_ID_ENT // Use environment variable
    };
    const stripePriceId = priceIdMap[planId];
    if (!stripePriceId) { return res.status(500).json({ error: 'Stripe price ID not configured for this plan.' }); } // Changed from 400 to 500 as this is a server-side config issue
    try {
        let customerId;
        const userRecord = await new Promise((resolve, reject) => {
            db.get('SELECT stripe_customer_id FROM Users WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
        if (userRecord && userRecord.stripe_customer_id) {
            customerId = userRecord.stripe_customer_id;
        } else {
            const customer = await stripeInstance.customers.create({ email: email, metadata: { userId: userId, companyId: companyId, }, });
            customerId = customer.id;
            db.run('UPDATE Users SET stripe_customer_id = ? WHERE user_id = ?', [customerId, userId], (err) => {
                if (err) console.error('Failed to save Stripe customer ID to DB:', err);
            });
        }
        const session = await stripeInstance.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            line_items: [{ price: stripePriceId, quantity: 1, }, ],
            // Use environment variables for success/cancel URLs, or relative paths if handled client-side
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:8000'}/suite-hub.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:8000'}/pricing.html?payment=cancelled`,
            metadata: { userId: userId, planId: planId, },
        });
        res.status(200).json({ url: session.url });
    } catch (error) { console.error('Error creating Stripe Checkout Session:', error); next(error); } // Pass error
});

app.post('/api/schedules', authenticateToken, (req, res, next) => { // Added 'next'
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    const { companyId, role, userId: currentUserId } = req.user;

    // Input Validation for Create Schedule
    if (role !== 'super_admin' && role !== 'location_admin') { return res.status(403).json({ error: 'Access Denied: Only admins can create schedules.' }); }
    if (typeof employee_id !== 'number' || employee_id <= 0) {
        return res.status(400).json({ error: 'A valid employee ID is required.' });
    }
    if (typeof location_id !== 'number' || location_id <= 0) {
        return res.status(400).json({ error: 'A valid location ID is required.' });
    }
    if (!start_time || !end_time || isNaN(new Date(start_time).getTime()) || isNaN(new Date(end_time).getTime())) {
        return res.status(400).json({ error: 'Valid start and end times are required.' });
    }
    if (new Date(start_time) >= new Date(end_time)) {
        return res.status(400).json({ error: 'Start time must be before end time.' });
    }
    if (notes !== undefined && typeof notes !== 'string') {
        return res.status(400).json({ error: 'Notes must be a string if provided.' });
    }

    db.get('SELECT user_id FROM Users WHERE user_id = ? AND company_id = ?', [employee_id, companyId], (err, employee) => {
        if (err) { console.error("Database error verifying employee:", err); return next(new Error('Database error during employee verification.')); } // Pass error
        if (!employee) { return res.status(400).json({ error: 'Employee not found in your company.' }); }
        db.get('SELECT location_id FROM Locations WHERE location_id = ? AND company_id = ?', [location_id, companyId], (err, location) => {
            if (err) { console.error("Database error verifying location:", err); return next(new Error('Database error during location verification.')); } // Pass error
            if (!location) { return res.status(400).json({ error: 'Location not found in your company.' }); }
            db.run(
                'INSERT INTO Schedules (employee_id, location_id, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?)', [employee_id, location_id, start_time, end_time, notes],
                function(insertErr) {
                    if (insertErr) { console.error("Database error creating schedule:", insertErr); return next(new Error('Failed to create schedule.')); } // Pass error
                    res.status(201).json({ message: 'Schedule created successfully!', scheduleId: this.lastID });
                }
            );
        });
    });
});

app.get('/api/schedules', authenticateToken, (req, res, next) => { // Added 'next'
    const { employee_id, location_id, start_date, end_date } = req.query;
    const { companyId, role, userId: currentUserId, locationId: currentUserLocationId } = req.user;

    let sql = `SELECT Schedules.*, Users.full_name AS employee_name, Users.email AS employee_email, Locations.location_name
               FROM Schedules
               JOIN Users ON Schedules.employee_id = Users.user_id
               JOIN Locations ON Schedules.location_id = Locations.location_id
               WHERE Users.company_id = ?`;
    const params = [companyId];

    if (role === 'location_admin') {
        if (currentUserLocationId) {
            sql += ` AND Schedules.location_id = ?`;
            params.push(currentUserLocationId);
        } else {
            return res.status(403).json({ error: 'Access Denied: Location admin not assigned to a location.' });
        }
    } else if (role === 'employee') {
        sql += ` AND Users.user_id = ?`;
        params.push(currentUserId);
    }

    // Input validation for query parameters
    if (employee_id && isNaN(parseInt(employee_id))) {
        return res.status(400).json({ error: 'Invalid employee ID filter provided.' });
    }
    if (location_id && isNaN(parseInt(location_id))) {
        return res.status(400).json({ error: 'Invalid location ID filter provided.' });
    }
    if (start_date && isNaN(new Date(start_date).getTime())) {
        return res.status(400).json({ error: 'Invalid start date filter provided.' });
    }
    if (end_date && isNaN(new Date(end_date).getTime())) {
        return res.status(400).json({ error: 'Invalid end date filter provided.' });
    }


    if (employee_id && (role === 'super_admin' || (role === 'location_admin' && parseInt(employee_id) === currentUserId) || (role === 'employee' && parseInt(employee_id) === currentUserId))) {
        sql += ` AND Users.role = ?`;
        params.push(filterRole); // This should be employee_id, not filterRole
    }
    if (location_id && (role === 'super_admin' || (role === 'location_admin' && parseInt(location_id) === currentUserLocationId))) {
        sql += ` AND Schedules.location_id = ?`;
        params.push(location_id);
    }
    if (start_date) {
        sql += ` AND Schedules.start_time >= ?`;
        params.push(start_date);
    }
    if (end_date) {
        sql += ` AND Schedules.end_time <= ?`;
        params.push(end_date);
    }

    db.all(sql, params, (err, rows) => {
        if (err) { console.error("Database error fetching schedules:", err); return next(new Error('Database error fetching schedules.')); } // Pass error
        res.json(rows);
    });
});

app.delete('/api/schedules/:id', authenticateToken, (req, res, next) => { // Added 'next'
    const { id } = req.params;
    const { companyId, role, userId: currentUserId, locationId: currentUserLocationId } = req.user;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid schedule ID provided.' });
    }

    if (role === 'employee') {
        return res.status(403).json({ error: 'Access Denied: Employees cannot delete schedules.' });
    }

    let sql = `DELETE FROM Schedules WHERE schedule_id = ?`;
    const params = [id];

    if (role === 'location_admin') {
        sql += ` AND employee_id IN (SELECT user_id FROM Users WHERE location_id = ? AND company_id = ?)`;
        params.push(currentUserLocationId, companyId);
    } else if (role === 'super_admin') {
        sql += ` AND employee_id IN (SELECT user_id FROM Users WHERE company_id = ?)`;
        params.push(companyId);
    }

    db.run(sql, params, function(err) {
        if (err) { console.error("Database error deleting schedule:", err); return next(new Error('Failed to delete schedule.')); } // Pass error
        if (this.changes === 0) { return res.status(404).json({ error: 'Schedule not found or not authorized to delete.' }); }
        res.status(204).send();
    });
});

// --- Hiring Routes ---

/**
 * POST /api/job-postings
 * Creates a new job posting.
 * Requires super_admin or location_admin role.
 */
app.post('/api/job-postings', authenticateToken, (req, res, next) => { // Added 'next'
    const { title, description, requirements, location_id } = req.body;
    const { companyId, role, locationId: currentUserLocationId } = req.user;
    const created_date = new Date().toISOString(); // Current date/time for creation

    // Input Validation for Create Job Posting
    if (role !== 'super_admin' && role !== 'location_admin') {
        return res.status(403).json({ error: 'Access Denied: Only admins can create job postings.' });
    }
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: "Job title is required and must be a non-empty string." });
    }
    if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) { // Line 1009
        return res.status(400).json({ error: 'Description must be a non-empty string if provided.' });
    } else if (description !== undefined) { 
        clauses.push('description = ?'); 
        updateParams.push(description); 
    }
    if (requirements !== undefined && typeof requirements !== 'string') {
        return res.status(400).json({ error: 'Requirements must be a string if provided.' });
    } else if (requirements !== undefined) { 
        clauses.push('requirements = ?');
        updateParams.push(requirements);
    }
    if (status !== undefined) { clauses.push('status = ?'); updateParams.push(status); }
    
    // super_admin can change location_id. location_admin cannot change location_id or change to different location
    if (location_id !== undefined) {
        if (role === 'super_admin') {
            clauses.push('location_id = ?'); updateParams.push(location_id);
        } else if (role === 'location_admin') {
            if (location_id !== currentUserLocationId && location_id !== null) { // location_id can be null (company-wide)
                return res.status(403).json({ error: 'Access Denied: Location admin cannot change job posting location to another location.' });
            }
            // If location admin updates job posting, and it's their location, or setting to null, it's allowed
            clauses.push('location_id = ?'); updateParams.push(location_id);
        }
    }


    if (clauses.length === 0) { return res.status(400).json({ error: 'No fields provided for update.' }); }

    updateSql += clauses.join(', ') + ' WHERE job_posting_id = ? AND company_id = ?';
    updateParams.push(id, companyId);

    // Additional security for location_admin: ensure they only update their own location's postings
    if (role === 'location_admin') {
        updateSql += ' AND (location_id = ? OR location_id IS NULL)'; // Allow updating unassigned jobs too
        params.push(currentUserLocationId);
    }

    db.run(updateSql, updateParams, function(err) {
        if (err) { console.error("Database error updating job posting:", err); return next(new Error('Failed to update job posting.')); } // Pass error
        if (this.changes === 0) { return res.status(404).json({ error: 'Job posting not found or not authorized to update.' }); }
        res.status(200).json({ message: 'Job posting updated successfully!' });
    });
});

/**
 * GET /api/job-postings
 * Retrieves job postings.
 * Can filter by location_id and status.
 * Requires super_admin or location_admin.
 */
app.get('/api/job-postings', authenticateToken, (req, res, next) => { // Added 'next'
    const { status, location_id } = req.query;
    const { companyId, role, locationId: currentUserLocationId } = req.user;

    let sql = 'SELECT * FROM JobPostings WHERE company_id = ?';
    const params = [companyId];

    // Authorization: super_admin sees all, location_admin sees their location's postings
    if (role === 'location_admin') {
        if (currentUserLocationId) {
            sql += ' AND (location_id = ? OR location_id IS NULL)'; // Location admin sees their location's postings or company-wide
            params.push(currentUserLocationId);
        } else {
            return res.status(403).json({ error: 'Access Denied: Location admin not assigned to a location.' });
        }
    } else if (role === 'employee') {
        // Employees generally shouldn't see job postings list via this admin API
        return res.status(403).json({ error: 'Access Denied: Insufficient permissions to view job postings.' });
    }

    // Input validation for query parameters
    const allowedStatuses = ['Open', 'Closed', 'Filled']; // Assuming these are your valid statuses
    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid job posting status filter provided.' });
    }
    if (location_id && isNaN(parseInt(location_id))) {
        return res.status(400).json({ error: 'Invalid location ID filter provided.' });
    }


    if (status) {
        sql += ' AND status = ?';
        params.push(status);
    }
    // Only super admin can filter by any location_id beyond their own scope
    if (location_id && role === 'super_admin') {
        sql += ` AND location_id = ?`;
        params.push(location_id);
    }

    db.all(sql, params, (err, rows) => {
        if (err) { console.error("Database error fetching job postings:", err); return next(new Error('Database error fetching job postings.')); } // Pass error
        res.json(rows);
    });
});

/**
 * PUT /api/job-postings/:id
 * Updates a job posting.
 * Requires super_admin or location_admin (for their location's postings).
 */
app.put('/api/job-postings/:id', authenticateToken, (req, res, next) => { // Added 'next'
    const { id } = req.params;
    const { title, description, requirements, status, location_id } = req.body;
    const { companyId, role, locationId: currentUserLocationId } = req.user;

    // Input Validation for Job Posting Update
    if (role !== 'super_admin' && role !== 'location_admin') {
        return res.status(403).json({ error: 'Access Denied: Only admins can update job postings.' });
    }
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid job posting ID provided.' });
    }
    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
        return res.status(400).json({ error: 'Job title must be a non-empty string if provided.' });
    }
    if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) {
        return res.status(400).json({ error: 'Description must be a non-empty string if provided.' });
    }
    if (requirements !== undefined && typeof requirements !== 'string') {
        return res.status(400).json({ error: 'Requirements must be a string if provided.' });
    }
    const allowedStatuses = ['Open', 'Closed', 'Filled'];
    if (status !== undefined && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }
    if (location_id !== undefined && typeof location_id !== 'number' && location_id !== null) {
        return res.status(400).json({ error: 'Location ID must be a number or null if provided.' });
    }


    let updateSql = 'UPDATE JobPostings SET ';
    const updateParams = [];
    const clauses = [];

    if (title !== undefined) { clauses.push('title = ?'); updateParams.push(title); }
    // Line 1009 fix: Ensure this line and surrounding logic is correct.
    if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) { // Line 1009
        return res.status(400).json({ error: 'Description must be a non-empty string if provided.' });
    } else if (description !== undefined) { 
        clauses.push('description = ?'); 
        updateParams.push(description); 
    }
    
    if (requirements !== undefined && typeof requirements !== 'string') {
        return res.status(400).json({ error: 'Requirements must be a string if provided.' });
    } else if (requirements !== undefined) { 
        clauses.push('requirements = ?');
        updateParams.push(requirements);
    }
    
    if (status !== undefined) { clauses.push('status = ?'); updateParams.push(status); }
    
    // super_admin can change location_id. location_admin cannot change location_id or change to different location
    if (location_id !== undefined) {
        if (role === 'super_admin') {
            clauses.push('location_id = ?'); updateParams.push(location_id);
        } else if (role === 'location_admin') {
            if (location_id !== currentUserLocationId && location_id !== null) { // location_id can be null (company-wide)
                return res.status(403).json({ error: 'Access Denied: Location admin cannot change job posting location to another location.' });
            }
            // If location admin updates job posting, and it's their location, or setting to null, it's allowed
            clauses.push('location_id = ?'); updateParams.push(location_id);
        }
    }


    if (clauses.length === 0) { return res.status(400).json({ error: 'No fields provided for update.' }); }

    updateSql += clauses.join(', ') + ' WHERE job_posting_id = ? AND company_id = ?';
    updateParams.push(id, companyId);

    // Additional security for location_admin: ensure they only update their own location's postings
    if (role === 'location_admin') {
        updateSql += ' AND (location_id = ? OR location_id IS NULL)'; // Allow updating unassigned jobs too
        params.push(currentUserLocationId);
    }

    db.run(updateSql, updateParams, function(err) {
        if (err) { console.error("Database error updating job posting:", err); return next(new Error('Failed to update job posting.')); } // Pass error
        if (this.changes === 0) { return res.status(404).json({ error: 'Job posting not found or not authorized to update.' }); }
        res.status(200).json({ message: 'Job posting updated successfully!' });
    });
});

/**
 * DELETE /api/job-postings/:id
 * Deletes a job posting.
 * Requires super_admin or location_admin (for their location's postings).
 */
app.delete('/api/job-postings/:id', authenticateToken, (req, res, next) => { // Added 'next'
    const { id } = req.params;
    const { companyId, role, locationId: currentUserLocationId } = req.user;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid job posting ID provided.' });
    }

    if (role !== 'super_admin' && role !== 'location_admin') {
        return res.status(403).json({ error: 'Access Denied: Only admins can delete job postings.' });
    }

    let sql = 'DELETE FROM JobPostings WHERE job_posting_id = ? AND company_id = ?';
    const params = [id, companyId];

    // Additional security for location_admin: ensure they only delete their own location's postings
    if (role === 'location_admin') {
        sql += ' AND (location_id = ? OR location_id IS NULL)';
        params.push(currentUserLocationId);
    }

    db.run(sql, params, function(err) {
        if (err) { console.error("Database error deleting job posting:", err); return next(new Error('Failed to delete job posting.')); } // Pass error
        if (this.changes === 0) { return res.status(404).json({ error: 'Job posting not found or not authorized to delete.' }); }
        res.status(204).send();
    });
});


// Update Applicant API endpoints to use job_posting_id
app.post('/api/applicants', authenticateToken, (req, res, next) => { // Added 'next'
    const { job_posting_id, full_name, email, notes, location_id, phone_number } = req.body; // Added phone_number
    const { companyId, role, locationId: currentUserLocationId } = req.user;
    const application_date = new Date().toISOString(); // Current date/time for application

    // Input Validation for Adding Applicant
    if (role !== 'super_admin' && role !== 'location_admin') {
        return res.status(403).json({ error: 'Access Denied: Only admins can add applicants.' });
    }
    if (typeof job_posting_id !== 'number' || job_posting_id <= 0) {
        return res.status(400).json({ error: 'A valid job posting ID is required.' });
    }
    if (!full_name || typeof full_name !== 'string' || full_name.trim() === '') {
        return res.status(400).json({ error: "Full name is required and must be a non-empty string." });
    }
    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: "A valid email address is required." });
    }
    // Basic phone number validation (simple check for non-empty string, could be more complex with regex)
    if (!phone_number || typeof phone_number !== 'string' || phone_number.trim() === '') {
        return res.status(400).json({ error: "Phone number is required." });
    }
    if (notes !== undefined && typeof notes !== 'string') {
        return res.status(400).json({ error: 'Notes must be a string if provided.' });
    }
    if (location_id !== undefined && typeof location_id !== 'number' && location_id !== null) {
        return res.status(400).json({ error: 'Location ID must be a number or null if provided.' });
    }


    // Verify job_posting_id belongs to the company, and for location_admin, to their location
    db.get('SELECT job_posting_id, location_id FROM JobPostings WHERE job_posting_id = ? AND company_id = ?', [job_posting_id, companyId], (err, jobPosting) => {
        if (err) { console.error("Database error verifying job posting:", err); return next(new Error('Database error when verifying job posting.')); } // Pass error
        if (!jobPosting) { return res.status(400).json({ error: 'Job Posting not found or does not belong to your company.' }); }
        
        // Location admin can only add applicants to jobs in their assigned location or unassigned jobs
        if (role === 'location_admin' && jobPosting.location_id !== currentUserLocationId && jobPosting.location_id !== null) {
            return res.status(403).json({ error: 'Access Denied: Location admin cannot add applicants to jobs outside their assigned location.' });
        }

        db.run(
            'INSERT INTO Applicants (company_id, location_id, job_posting_id, full_name, email, phone_number, notes, application_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [companyId, location_id || jobPosting.location_id, job_posting_id, full_name, email, phone_number, notes, application_date], // Use location_id from payload or job posting
            function(insertErr) {
                if (insertErr) { console.error("Database error creating applicant:", insertErr); return next(new Error('Failed to create applicant.')); } // Pass error
                res.status(201).json({ message: 'Applicant added successfully!', applicantId: this.lastID });
            }
        );
    });
});

app.get('/api/applicants', authenticateToken, (req, res, next) => { // Added 'next'
    const { job_posting_id, status, location_id } = req.query; // Added job_posting_id, status, location_id filters
    const { companyId, role, userId: currentUserId, locationId: currentUserLocationId } = req.user;

    let sql = `SELECT Applicants.*, JobPostings.title AS job_title_name
               FROM Applicants
               LEFT JOIN JobPostings ON Applicants.job_posting_id = JobPostings.job_posting_id
               WHERE Applicants.company_id = ?`;
    const params = [companyId];

    // Input validation for query parameters
    const allowedStatuses = ['Applied', 'Interviewing', 'Rejected', 'Hired']; // Define valid statuses
    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid applicant status filter provided.' });
    }
    if (job_posting_id && isNaN(parseInt(job_posting_id))) {
        return res.status(400).json({ error: 'Invalid job posting ID filter provided.' });
    }
    if (location_id && isNaN(parseInt(location_id))) {
        return res.status(400).json({ error: 'Invalid location ID filter provided.' });
    }

    if (status) {
        sql += ` AND Applicants.status = ?`;
        params.push(status);
    }

    if (role === 'location_admin') {
        if (currentUserLocationId) {
            sql += ` AND (Applicants.location_id = ? OR Applicants.location_id IS NULL)`; // Location admin sees applicants for their location or unassigned
            params.push(currentUserLocationId);
        } else {
            return res.status(403).json({ error: 'Access Denied: Location admin not assigned to a location.' });
        }
    } else if (role === 'employee') {
        sql += ` AND Applicants.user_id = ?`;
        params.push(currentUserId);
    } else {
        return res.status(403).json({ error: 'Access Denied: Insufficient permissions to view applicants.' });
    }

    // Apply job_posting_id filter if provided
    if (job_posting_id) {
        sql += ` AND Applicants.job_posting_id = ?`;
        params.push(job_posting_id);
    }
    // Apply location filter from query params for super_admin
    if (location_id && role === 'super_admin') {
        sql += ` AND Applicants.location_id = ?`;
        params.push(location_id);
    }


    db.all(sql, params, (err, rows) => {
        if (err) { console.error("Database error fetching applicants:", err); return next(new Error('Database error fetching applicants.')); } // Pass error
        res.json(rows);
    });
});

/**
 * PUT /api/applicants/:id
 * Updates an applicant's details (e.g., status, notes).
 */
app.put('/api/applicants/:id', authenticateToken, (req, res, next) => { // Added 'next'
    const { id } = req.params;
    const { full_name, email, status, resume_url, notes, location_id, job_posting_id, phone_number } = req.body;
    const { companyId, role, locationId: currentUserLocationId } = req.user;

    // Input Validation for Applicant Update
    if (role !== 'super_admin' && role !== 'location_admin') {
        return res.status(403).json({ error: 'Access Denied: Only admins can update applicant records.' });
    }
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid applicant ID provided.' });
    }
    if (full_name !== undefined && (typeof full_name !== 'string' || full_name.trim() === '')) {
        return res.status(400).json({ error: "Full name must be a non-empty string if provided." });
    }
    if (email !== undefined && !isValidEmail(email)) {
        return res.status(400).json({ error: "A valid email address must be provided if changing email." });
    }
    if (phone_number !== undefined && (typeof phone_number !== 'string' || phone_number.trim() === '')) {
        return res.status(400).json({ error: "Phone number must be a non-empty string if provided." });
    }
    const allowedStatuses = ['Applied', 'Interviewing', 'Rejected', 'Hired'];
    if (status !== undefined && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }
    if (resume_url !== undefined && typeof resume_url !== 'string') { // Assuming resume_url is a string URL
        return res.status(400).json({ error: 'Resume URL must be a string if provided.' });
    }
    if (notes !== undefined && typeof notes !== 'string') {
        return res.status(400).json({ error: 'Notes must be a string if provided.' });
    }
    if (location_id !== undefined && typeof location_id !== 'number' && location_id !== null) {
        return res.status(400).json({ error: 'Location ID must be a number or null if provided.' });
    }
    if (job_posting_id !== undefined && typeof job_posting_id !== 'number' && job_posting_id !== null) {
        return res.status(400).json({ error: 'Job posting ID must be a number or null if provided.' });
    }


    let updateSql = 'UPDATE Applicants SET ';
    const updateParams = [];
    const clauses = [];

    if (full_name !== undefined) { clauses.push('full_name = ?'); updateParams.push(full_name); }
    if (email !== undefined) { clauses.push('email = ?'); updateParams.push(email); }
    if (phone_number !== undefined) { clauses.push('phone_number = ?'); updateParams.push(phone_number); }
    if (status !== undefined) { clauses.push('status = ?'); updateParams.push(status); }
    if (resume_url !== undefined) { clauses.push('resume_url = ?'); updateParams.push(resume_url); }
    if (notes !== undefined) { clauses.push('notes = ?'); updateParams.push(notes); }
    
    // Admins can update location_id or job_posting_id, with restrictions for location_admin
    if (location_id !== undefined) {
        if (role === 'super_admin') {
            clauses.push('location_id = ?'); updateParams.push(location_id);
        } else if (role === 'location_admin') {
            if (location_id !== currentUserLocationId && location_id !== null) { // location_id can be null (company-wide)
                return res.status(403).json({ error: 'Access Denied: Location admin cannot assign applicants to another location.' });
            }
            // If location admin updates applicant location, and it's their location, or setting to null, it's allowed
            clauses.push('location_id = ?'); updateParams.push(location_id);
        }
    }
    if (job_posting_id !== undefined) {
         if (role === 'super_admin') {
            clauses.push('job_posting_id = ?'); updateParams.push(job_posting_id);
        } else if (role === 'location_admin') {
            // Verify new job_posting_id belongs to the location admin's assigned location or is company-wide
            db.get('SELECT job_posting_id, location_id FROM JobPostings WHERE job_posting_id = ? AND company_id = ?', [job_posting_id, companyId], (err, job) => {
                if (err) { console.error("DB error verifying job posting for update:", err); return next(new Error('Database error verifying job posting.')); } // Pass error
                if (!job) { return res.status(400).json({ error: 'Job Posting not found or does not belong to your company.' }); }
                if (job.location_id !== null && job.location_id !== currentUserLocationId) {
                    return res.status(403).json({ error: 'Access Denied: Location admin cannot assign applicants to jobs outside their assigned location.' });
                }
            });
            clauses.push('job_posting_id = ?'); updateParams.push(job_posting_id);
        }
    }


    if (clauses.length === 0) { return res.status(400).json({ error: 'No fields provided for update.' }); }

    updateSql += clauses.join(', ') + ' WHERE applicant_id = ? AND company_id = ?';
    updateParams.push(id, companyId);

    // For location_admin, ensure they can only update applicants within their assigned location
    if (role === 'location_admin') {
        updateSql += ' AND (location_id = ? OR location_id IS NULL)'; // Allow updating unassigned applicants too
        params.push(currentUserLocationId);
    }

    db.run(updateSql, updateParams, function(err) {
        if (err) { console.error("Database error updating applicant:", err); return next(new Error('Failed to update applicant.')); } // Pass error
        if (this.changes === 0) { return res.status(404).json({ error: 'Applicant not found or not authorized to update.' }); }
        res.status(200).json({ message: 'Applicant updated successfully!' });
    });
});


/**
 * DELETE /api/applicants/:id
 * Deletes an applicant.
 * Requires super_admin or location_admin (for their location's applicants).
 */
app.delete('/api/applicants/:id', authenticateToken, (req, res, next) => { // Added 'next'
    const { id } = req.params;
    const { companyId, role, locationId: currentUserLocationId } = req.user;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid applicant ID provided.' });
    }

    if (role !== 'super_admin' && role !== 'location_admin') {
        return res.status(403).json({ error: 'Access Denied: Only admins can delete applicants.' });
    }

    let sql = 'DELETE FROM Applicants WHERE applicant_id = ? AND company_id = ?';
    const params = [id, companyId];

    // Additional security for location_admin: ensure they only delete applicants in their own location
    if (role === 'location_admin') {
        sql += ' AND (location_id = ? OR location_id IS NULL)';
        params.push(currentUserLocationId);
    }

    db.run(sql, params, function(err) {
        if (err) { console.error("Database error deleting applicant:", err); return next(new Error('Failed to delete applicant.')); } // Pass error
        if (this.changes === 0) { return res.status(404).json({ error: 'Applicant not found or not authorized to delete.' }); }
        res.status(204).send();
    });
});

// --- Document Management Routes ---

/**
 * POST /api/documents
 * Uploads (saves metadata for) a new document.
 * Requires authenticated user.
 * Note: Actual file storage is assumed to be handled by a separate service (e.g., S3).
 * This endpoint only stores the metadata and a URL.
 */
app.post('/api/documents', authenticateToken, (req, res, next) => { // Added 'next'
    const { title, file_name, file_type, file_url, description } = req.body;
    const { companyId, userId } = req.user;
    const upload_date = new Date().toISOString();

    // Input Validation for Document Upload
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'Document title is required and must be a non-empty string.' });
    }
    if (!file_name || typeof file_name !== 'string' || file_name.trim() === '') {
        return res.status(400).json({ error: 'File name is required and must be a non-empty string.' });
    }
    if (!file_type || typeof file_type !== 'string' || file_type.trim() === '') {
        return res.status(400).json({ error: 'File type is required and must be a non-empty string.' });
    }
    // Basic URL validation: checks for http(s) protocol and some content. Can be more robust.
    const urlRegex = /^https?:\/\/[^\s$.?#].[^\s]*$/i;
    if (!file_url || typeof file_url !== 'string' || !urlRegex.test(file_url)) {
        return res.status(400).json({ error: 'A valid file URL (starting with http or https) is required.' });
    }
    if (description !== undefined && typeof description !== 'string') {
        return res.status(400).json({ error: 'Notes must be a string if provided.' });
    }

    db.run(
        'INSERT INTO Documents (company_id, user_id, title, file_name, file_type, file_url, description, upload_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [companyId, userId, title, file_name, file_type, file_url, description, upload_date],
        function(err) {
            if (err) {
                console.error("Database error uploading document:", err);
                return next(new Error('Failed to upload document metadata.')); // Pass error
            }
            res.status(201).json({ message: 'Document metadata saved successfully!', documentId: this.lastID });
        }
    );
});

/**
 * GET /api/documents
 * Retrieves a list of documents for the company.
 * Filters can be added (e.g., by uploader, by type).
 * Requires authenticated user. Super admins can see all, others can see own documents.
 */
app.get('/api/documents', authenticateToken, (req, res, next) => { // Added 'next'
    const { companyId, userId, role } = req.user;
    
    let sql = 'SELECT * FROM Documents WHERE company_id = ?';
    const params = [companyId];

    // Non-super-admins only see their own documents
    if (role !== 'super_admin') {
        sql += ' AND user_id = ?';
        params.push(userId);
    }

    db.all(sql, params, (err, rows) => {
        if (err) { console.error("Database error fetching documents:", err); return next(new Error('Database error fetching documents.')); } // Pass error
        res.json(rows);
    });
});

/**
 * DELETE /api/documents/:id
 * Deletes a document record.
 * Requires super_admin or the user who uploaded it.
 */
app.delete('/api/documents/:id', authenticateToken, (req, res, next) => { // Added 'next'
    const { id } = req.params;
    const { companyId, userId, role } = req.user;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid document ID provided.' });
    }

    let sql = 'DELETE FROM Documents WHERE document_id = ? AND company_id = ?';
    const params = [id, companyId];

    // Only super_admin or the original uploader can delete
    if (role !== 'super_admin') {
        sql += ' AND user_id = ?';
        params.push(userId);
    }

    db.run(sql, params, function(err) {
        if (err) { console.error("Database error deleting document:", err); return next(new Error('Failed to delete document.')); } // Pass error
        if (this.changes === 0) { return res.status(404).json({ error: 'Document not found or not authorized to delete.' }); }
        res.status(204).send();
    });
});

// Fallback for any other GET request not handled by an API route (serves index.html for SPA behavior)
// This should always be the LAST route in your Express app
app.get(/'*'/, (req, res) => {
    // Correctly serve the index.html from the parent directory
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// --- Global Error Handling Middleware ---
// This should be the very last middleware in your Express app
app.use((err, req, res, next) => {
    console.error(`Unhandled Error: ${err.stack}`); // Log the full stack trace for debugging
    // Respond with a generic error message for the client
    res.status(500).json({
        error: 'An unexpected server error occurred. Please try again later.',
        // In development, you might send more details:
        // message: err.message,
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// --- Server Start ---
// This conditional export allows the app to be imported for testing
// without starting the server listener when the test runner requires it.
if (require.main === module) {
    // Only listen if this file is run directly (not required as a module)
    app.listen(PORT, () => {
        console.log(`Server is running successfully on http://localhost:${PORT}`);
    });
} else {
    // Export the app for testing purposes
    module.exports = app;
}
