// server.js - FINAL VERSION WITH ALL ROUTES, INCLUDING OWNER DASHBOARD

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs'); // Keep fs for mkdirSync if needed for other purposes, but not for uploadsDir
const path = require('path');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Temporarily comment out Stripe init

// --- NEW GCS IMPORTS ---
const { Storage } = require('@google-cloud/storage'); // Only need the official GCS library
// --- END NEW GCS IMPORTS ---

const createOnboardingRouter = require('./routes/onboardingRoutes');

const app = express();
const apiRoutes = express.Router();
const ownerRoutes = express.Router();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'default-secret-password-change-me';

// Define Stripe Price IDs from environment variables
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
const STRIPE_ENTERPRISE_PRICE_ID = process.env.STRIPE_ENTERPRISE_PRICE_ID;
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000'; // Define your app's base URL

// --- REMOVED DEBUGGING: Inspect STRIPE_SECRET_KEY string content ---
// const DEBUG_STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
// if (DEBUG_STRIPE_SECRET_KEY) {
//     console.log('DEBUG_KEY: Length:', DEBUG_STRIPE_SECRET_KEY.length);
//     console.log('DEBUG_KEY: First 5 chars:', DEBUG_STRIPE_SECRET_KEY.substring(0, 5));
//     console.log('DEBUG_KEY: Last 5 chars:', DEBUG_STRIPE_SECRET_KEY.substring(DEBUG_STRIPE_SECRET_KEY.length - 5));
//     console.log('DEBUG_KEY: Contains newline?', DEBUG_STRIPE_SECRET_KEY.includes('\n'));
//     console.log('DEBUG_KEY: Contains space?', DEBUG_STRIPE_SECRET_KEY.includes(' '));
//     // Attempt to initialize Stripe here to catch errors earlier
//     try {
//         const stripe = require('stripe')(DEBUG_STRIPE_SECRET_KEY);
//         console.log('DEBUG_KEY: Stripe init successful with this key.');
//         // Re-assign to the global stripe variable
//         Object.defineProperty(global, 'stripe', { value: stripe, writable: true });
//     } catch (e) {
//         console.error('DEBUG_KEY: Stripe init FAILED with this key:', e.message);
//         // If init fails, we'll still proceed, but the next calls will fail.
//     }
// } else {
//     console.error('DEBUG_KEY: STRIPE_SECRET_KEY is not set!');
// }
// --- END REMOVED DEBUGGING ---

// --- NEW GCS CONFIGURATION ---
let gcsConfig;
try {
    if (process.env.GCP_KEY_JSON) {
        gcsConfig = JSON.parse(process.env.GCP_KEY_JSON);
        console.log('Google Cloud Storage credentials loaded from environment variable.');
    } else {
        console.error('CRITICAL ERROR: GCP_KEY_JSON environment variable is NOT set. GCS uploads will fail.');
        process.exit(1);
    }
} catch (e) {
    console.error('CRITICAL ERROR: Failed to parse GCP_KEY_JSON environment variable. Ensure it is valid JSON.', e.message);
    process.exit(1);
}

// Initialize GCS client
const storageClient = new Storage({
    projectId: gcsConfig.project_id,
    credentials: {
        client_email: gcsConfig.client_email,
        private_key: gcsConfig.private_key.replace(/\\n/g, '\n')
    }
});
const bucket = storageClient.bucket(process.env.GCS_BUCKET_NAME);

// --- CUSTOM MULTER GCS STORAGE ENGINE ---
// This is a custom storage engine for Multer that uploads directly to GCS.
const gcsStorage = multer.diskStorage({ // Multer requires a diskStorage-like structure for custom engines
    _handleFile: (req, file, cb) => {
        // Generate a unique filename for GCS to avoid collisions
        const uniqueFilename = `documents/${Date.now()}-${file.originalname}`;
        const gcsFile = bucket.file(uniqueFilename);

        // Create a write stream to GCS
        const stream = gcsFile.createWriteStream({
            metadata: {
                contentType: file.mimetype, // Set content type based on the uploaded file
            },
            predefinedAcl: 'publicRead', // Make the file publicly readable after upload
        });

        // Handle errors during the GCS upload stream
        stream.on('error', (err) => {
            console.error('GCS upload stream error during write:', err);
            // Propagate the error back to Multer
            cb(err);
        });

        // Handle successful completion of the GCS upload stream
        stream.on('finish', () => {
            // Get the public URL of the uploaded file
            gcsFile.publicUrl().then(url => {
                // Attach the public URL to req.file so it can be accessed in the route handler
                file.publicUrl = url;
                // Important: Ensure publicUrl is not null/undefined before passing to callback
                if (!file.publicUrl) {
                    const error = new Error('GCS public URL was not generated.');
                    console.error('GCS URL generation error:', error);
                    return cb(error); // Propagate error
                }
                // Call Multer's callback to indicate success, passing necessary file info
                cb(null, {
                    path: url, // Use the public URL as the 'path' property
                    filename: uniqueFilename // Store the path within the bucket as 'filename' for deletion logic
                });
            }).catch(urlErr => {
                // Handle errors during public URL retrieval
                console.error('Error getting public URL for GCS file:', urlErr);
                cb(urlErr); // Propagate error
            });
        });

        // Pipe the incoming file stream (from Multer) to the GCS write stream
        file.stream.pipe(stream);
    },
    _removeFile: (req, file, cb) => {
        // This function is called by Multer if an error occurs during upload (to clean up)
        // or if you explicitly call `upload.storage._removeFile`.
        // For GCS, we need to delete the file from the bucket.
        const filePath = file.filename; // This is the path within the bucket, stored during _handleFile
        bucket.file(filePath).delete().then(() => {
            console.log(`File ${filePath} removed from GCS.`);
            cb(null); // Indicate success to Multer
        }).catch(err => {
            // Log a warning if deletion fails, but don't block the process
            console.warn(`Error removing file ${filePath} from GCS: ${err.message}`);
            cb(err); // Still call callback, but log warning
        });
    }
});

const upload = multer({ storage: gcsStorage }); // Use our custom GCS storage engine
// --- END CUSTOM MULTER GCS STORAGE ENGINE ---


// --- REMOVE OLD LOCAL DISK STORAGE CONFIGURATION ---
// The following lines are commented out as they are no longer needed
// for local disk storage and static file serving.
// const uploadsDir = path.join(__dirname, 'uploads');
// if (!fs.existsSync(uploadsDir)) {
//     fs.mkdirSync(uploadsDir);
// }
// const localDiskStorage = multer.diskStorage({
//     destination: (req, file, cb) => cb(null, uploadsDir),
//     filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
// });
// const upload = multer({ storage: localDiskStorage });
// --- END REMOVAL ---

if (!DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is NOT set.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

app.use(cors());

// IMPORTANT: Stripe webhook needs the raw body, so this middleware must come BEFORE express.json()
// This route should be one of the first to be defined to ensure it catches the raw body.
app.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('Stripe Webhook Secret is not set in environment variables.');
        return res.status(500).send('Webhook secret not configured.');
    }

    try {
        // Use the globally defined stripe object
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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
            const locationId = session.metadata.locationId;
            const plan = session.metadata.plan;
            const subscriptionId = session.subscription;

            if (userId && locationId && plan) {
                try {
                    // Update the location's subscription plan and status
                    await pool.query(
                        `UPDATE locations SET subscription_plan = $1, subscription_status = 'active', stripe_customer_id = $2, stripe_subscription_id = $3 WHERE location_id = $4`,
                        [plan, session.customer, subscriptionId, locationId]
                    );
                    console.log(`Location ${locationId} updated to ${plan} plan.`);
                } catch (dbErr) {
                    console.error('Database update error for checkout.session.completed:', dbErr);
                    return res.status(500).send('Database update failed.');
                }
            } else {
                console.warn('Missing metadata in checkout session:', session.metadata);
            }
            break;
        case 'customer.subscription.updated':
            const subscription = event.data.object;
            console.log('Customer Subscription Updated:', subscription.id);
            try {
                await pool.query(
                    `UPDATE locations SET subscription_status = $1 WHERE stripe_subscription_id = $2`,
                    [subscription.status, subscription.id]
                );
                console.log(`Subscription ${subscription.id} status updated to ${subscription.status}.`);
            } catch (dbErr) {
                console.error('Database update error for customer.subscription.updated:', dbErr);
                return res.status(500).send('Database update failed.');
            }
            break;
        case 'customer.subscription.deleted':
            const deletedSubscription = event.data.object;
            console.log('Customer Subscription Deleted:', deletedSubscription.id);
            try {
                await pool.query(
                    `UPDATE locations SET subscription_plan = 'free', subscription_status = 'cancelled', stripe_subscription_id = NULL WHERE stripe_subscription_id = $1`,
                    [deletedSubscription.id]
                );
                console.log(`Subscription ${deletedSubscription.id} cancelled.`);
            } catch (dbErr) {
                console.error('Database update error for customer.subscription.deleted:', dbErr);
                return res.status(500).send('Database update failed.');
            }
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });
});

// Now, apply express.json() for all subsequent routes that need JSON body parsing
app.use(express.json());

// --- REMOVE OLD LOCAL STATIC FILE SERVING ---
// The following lines are commented out as they are no longer needed
// for local disk storage and static file serving.
// app.use(express.static(path.join(__dirname)));
// app.use('/uploads', express.static(uploadsDir));
// --- END REMOVAL ---

// Serve all frontend static files from the root of the project
// This assumes your HTML, CSS, JS bundles are in the root or accessible directly.
// If your HTML files reference /dist/css/style.min.css, they need access to /dist/
app.use(express.static(path.join(__dirname)));


// Authentication and Authorization middleware
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
// All routes defined using apiRoutes.get, apiRoutes.post, etc.
// will be mounted under the '/api' prefix.

// Authentication
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const locationRes = await client.query(`INSERT INTO locations (location_name, subscription_plan, subscription_status) VALUES ($1, $2, $3) RETURNING location_id`, [`${companyName} HQ`, 'free', 'active']); // Default to free plan on registration
        const newLocationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10);
        await client.query(`INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4) RETURNING user_id`, [fullName, email, hash, newLocationId]);
        await client.query('COMMIT');
        res.status(201).json({ message: "Registration successful!" });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(409).json({ error: "Email address is already registered." });
        res.status(500).json({ error: "An internal server error occurred." });
    } finally {
        client.release();
    }
});
apiRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(`SELECT user_id, full_name, email, password, role, location_id FROM users WHERE email = $1`, [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Invalid email or password." });
        const user = result.rows[0];
        if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid email or password." });

        const payload = { id: user.user_id, role: user.role, location_id: user.location_id, iat: Math.floor(Date.now() / 1000) };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, role: user.role, userId: user.user_id });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

// Users & Admin
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role, location_id FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User profile not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});
apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT u.user_id, u.full_name, u.position, u.role, l.location_name, u.location_id FROM users u LEFT JOIN locations l ON u.location_id = l.location_id ORDER BY u.full_name`);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});
apiRoutes.put('/users/me', isAuthenticated, async (req, res) => {
    const { full_name, email, current_password, new_password } = req.body;
    const userId = req.user.id;
    try {
        const userResult = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        let hashedPassword = userResult.rows[0].password;
        if (new_password) {
            if (!current_password || !(await bcrypt.compare(current_password, userResult.rows[0].password))) {
                return res.status(401).json({ error: 'Current password incorrect.' });
            }
            hashedPassword = await bcrypt.hash(new_password, 10);
        }
        const result = await pool.query(`UPDATE users SET full_name = $1, email = $2, password = $3 WHERE user_id = $4 RETURNING user_id, full_name, email, role`,[full_name, email, hashedPassword, userId]);
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email address is already in use.' });
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});
apiRoutes.post('/invite-admin', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, password, location_id } = req.body;
    if (!full_name || !email || !password || !location_id) return res.status(400).json({ error: 'All fields are required.' });
    try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query("INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'location_admin', $4)",[full_name, email, hash, location_id]);
        res.status(201).json({ message: 'Location admin invited successfully.' });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
        res.status(500).json({ error: 'Failed to invite location admin.' });
    }
});

// MODIFIED: Added employee limit enforcement
apiRoutes.post('/invite-employee', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, password, position, location_id, availability } = req.body;
    if (!full_name || !email || !password || !location_id) return res.status(400).json({ error: 'Name, email, password, and location are required.' });

    try {
        // 1. Get current location's subscription plan
        const locationResult = await pool.query('SELECT subscription_plan FROM locations WHERE location_id = $1', [location_id]);
        if (locationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Location not found.' });
        }
        const subscriptionPlan = locationResult.rows[0].subscription_plan;

        // 2. Count existing employees and location admins for this location
        const employeeCountResult = await pool.query(
            `SELECT COUNT(*) FROM users WHERE location_id = $1 AND role IN ('employee', 'location_admin')`,
            [location_id]
        );
        const currentEmployeeCount = parseInt(employeeCountResult.rows[0].count, 10);

        // 3. Enforce limits based on subscription plan
        const FREE_TIER_LIMIT = 5;
        const PRO_TIER_LIMIT = 100;

        if (subscriptionPlan === 'free' && currentEmployeeCount >= FREE_TIER_LIMIT) {
            return res.status(403).json({ error: `Free tier is limited to ${FREE_TIER_LIMIT} employees. Please upgrade your plan to invite more.` });
        } else if (subscriptionPlan === 'pro' && currentEmployeeCount >= PRO_TIER_LIMIT) {
            return res.status(403).json({ error: `Pro plan is limited to ${PRO_TIER_LIMIT} employees. Please upgrade to the Enterprise plan to invite more.` });
        }
        // No limit for 'enterprise' plan

        // If limits are not exceeded, proceed with invitation
        const hash = await bcrypt.hash(password, 10);
        await pool.query("INSERT INTO users (full_name, email, password, role, position, location_id, availability) VALUES ($1, $2, $3, 'employee', $4, $5, $6)",[full_name, email, hash, position, location_id, availability ? JSON.stringify(availability) : null]);
        res.status(201).json({ message: 'Employee invited successfully.' });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
        console.error('Error inviting employee:', err); // Log the actual error for debugging
        res.status(500).json({ error: 'Failed to invite employee.' });
    }
});

// Locations & Business Settings
apiRoutes.get('/locations', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY location_name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});
apiRoutes.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
    const { location_name, location_address } = req.body;
    if (!location_name || !location_address) return res.status(400).json({ error: 'Location name and address are required.' });
    try {
        const result = await pool.query('INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING *', [location_name, location_address]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add new location.' });
    }
});
apiRoutes.delete('/locations/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM locations WHERE location_id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete location.' });
    }
});
apiRoutes.get('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM business_settings');
        res.json(result.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve business settings.' });
    }
});
apiRoutes.put('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    const { operating_hours_start, operating_hours_end } = req.body;
    try {
        await pool.query(`INSERT INTO business_settings (id, operating_hours_start, operating_hours_end) VALUES (1, $1, $2) ON CONFLICT (id) DO UPDATE SET operating_hours_start = $1, operating_hours_end = $2`,[operating_hours_start, operating_hours_end]);
        res.status(200).json({ message: 'Business settings updated.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update business settings.' });
    }
});

// Checklists
apiRoutes.get('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM checklists ORDER BY position, title');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve checklists.' });
    }
});
apiRoutes.post('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    const { title, position, tasks } = req.body;
    if (!title || !position || !tasks) return res.status(400).json({ error: 'Missing required fields.' });
    try {
        const result = await pool.query('INSERT INTO checklists (title, position, tasks) VALUES ($1, $2, $3) RETURNING *',[title, position, JSON.stringify(tasks)]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create checklist.' });
    }
});

// Documents
apiRoutes.get('/documents', isAuthenticated, isAdmin, async (req, res) => {
    try {
        // file_name will now contain the full GCS URL
        const result = await pool.query(`SELECT d.document_id, d.title, d.description, d.file_name, d.uploaded_at, u.full_name as uploaded_by_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.user_id ORDER BY d.uploaded_at DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});
apiRoutes.post('/documents', isAuthenticated, isAdmin, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });
        const { title, description } = req.body;
        // IMPORTANT: Use req.file.publicUrl which multer-cloud-storage adds
        const fileUrl = req.file.publicUrl;
        // Store the full URL in the database
        const result = await pool.query('INSERT INTO documents (title, description, file_name, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING *',[title, description, fileUrl, req.user.id]);
        res.status(201).json({ message: 'Document uploaded successfully!', document: result.rows[0] }); // Added document to response for frontend
    } catch (err) {
        console.error('Error uploading document to GCS and saving to DB:', err); // More specific error logging
        res.status(500).json({ error: 'Failed to upload document.' });
    }
});
apiRoutes.delete('/documents/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const docResult = await pool.query('SELECT file_name FROM documents WHERE document_id = $1', [id]);
        if (docResult.rows.length === 0) return res.status(404).json({ error: 'Document not found.' });

        const fileUrlToDelete = docResult.rows[0].file_name;

        // --- NEW: Delete from GCS (Attempt to delete, but don't block DB deletion) ---
        // Check if the file_name is a valid URL before attempting GCS deletion
        let isGcsUrl = false;
        let filePath = '';
        try {
            const url = new URL(fileUrlToDelete);
            // Basic check if it looks like a GCS URL
            if (url.hostname.includes('storage.googleapis.com') || url.hostname.includes(process.env.GCS_BUCKET_NAME)) {
                filePath = url.pathname.substring(1); // Remove leading slash
                isGcsUrl = true;
            }
        } catch (e) {
            // Not a valid URL, so it's likely an old local filename
            console.warn(`File name "${fileUrlToDelete}" is not a valid URL. Assuming it's an old local file.`);
        }

        if (isGcsUrl) {
            try {
                const storageClient = new Storage({
                    projectId: gcsConfig.project_id,
                    credentials: {
                        client_email: gcsConfig.client_email,
                        private_key: gcsConfig.private_key.replace(/\\n/g, '\n')
                    }
                });
                const bucketName = process.env.GCS_BUCKET_NAME;
                await storageClient.bucket(bucketName).file(filePath).delete();
                console.log(`File ${filePath} deleted from GCS bucket ${bucketName}.`);
            } catch (gcsErr) {
                // Log the GCS deletion error but continue to delete the DB record
                console.warn(`Could not delete file ${filePath} from GCS bucket ${bucketName}. It might not exist or permissions are off. Error: ${gcsErr.message}`);
            }
        } else {
            // Handle deletion for old local files (if they were ever persistent, which they aren't on Render)
            // For now, just log a message as local files are ephemeral on Render.
            console.log(`Skipping GCS deletion for non-GCS URL: ${fileUrlToDelete}. Assuming it was an ephemeral local file.`);
        }
        // --- END NEW: Delete from GCS ---

        // Always attempt to delete the database record
        await pool.query('DELETE FROM documents WHERE document_id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting document record from database:', err); // More specific error message
        res.status(500).json({ error: 'Failed to delete document record.' });
    }
});

// Hiring
apiRoutes.get('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT jp.id, jp.title, jp.created_at, l.location_name FROM job_postings jp LEFT JOIN locations l ON jp.location_id = l.location_id ORDER BY jp.created_at DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});
apiRoutes.post('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const { title, description, requirements, location_id } = req.body;
    if (!title || !description || !location_id) return res.status(400).json({ error: 'Title, description, and location are required.' });
    try {
        const result = await pool.query('INSERT INTO job_postings (title, description, requirements, location_id) VALUES ($1, $2, $3, $4) RETURNING *',[title, description, requirements, location_id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});
apiRoutes.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM job_postings WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});
apiRoutes.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT a.id, a.name, a.email, a.phone, a.applied_at, jp.title AS job_title FROM applicants a JOIN job_postings jp ON a.job_id = jp.id ORDER BY a.applied_at DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve applicants.' });
    }
});
apiRoutes.delete('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM applicants WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete applicant.' });
    }
});

// Scheduling
apiRoutes.get('/shifts', isAuthenticated, async (req, res) => {
    const { startDate, endDate, location_id, user_id } = req.query;
    const requestingUserId = req.user.id;
    const isUserAdmin = req.user.role === 'super_admin' || req.user.role === 'location_admin';
    if (user_id && !isUserAdmin && String(user_id) !== String(requestingUserId)) return res.status(403).json({ error: 'Access denied.' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start and end dates are required.' });
    try {
        let query = `SELECT s.id, s.employee_id, u.full_name as employee_name, s.location_id, l.location_name, s.start_time, s.end_time FROM shifts s JOIN users u ON s.employee_id = u.user_id JOIN locations l ON s.location_id = l.location_id WHERE s.start_time >= $1 AND s.end_time <= $2`;
        const params = [startDate, endDate];
        let paramIndex = 3;
        if (isUserAdmin) {
            if (location_id) {
                query += ` AND s.location_id = $${paramIndex++}`;
                params.push(location_id);
            }
        } else {
            const targetUserId = user_id || requestingUserId;
            query += ` AND s.employee_id = $${paramIndex++}`;
            params.push(targetUserId);
        }
        query += ' ORDER BY s.start_time ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});
apiRoutes.post('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    if (!employee_id || !location_id || !start_time || !end_time) return res.status(400).json({ error: 'All fields are required.' });
    try {
        const result = await pool.query('INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',[employee_id, location_id, start_time, end_time, notes]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create shift.' });
    }
});
apiRoutes.delete('/shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM shifts WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete shift.' });
    }
});
apiRoutes.delete('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { beforeDate } = req.query;
    if (!beforeDate) return res.status(400).json({ error: 'A "beforeDate" query parameter is required.' });
    try {
        const result = await pool.query('DELETE FROM shifts WHERE start_time < $1', [beforeDate]);
        res.status(200).json({ message: `${result.rowCount} old shifts deleted successfully.` });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete old shifts.' });
    }
});

// Messaging
apiRoutes.post('/messages', isAuthenticated, async (req, res) => {
    const { recipient_id, content } = req.body;
    const sender_id = req.user.id;
    if (!recipient_id || !content) return res.status(400).json({ error: 'Recipient and message content are required.' });
    try {
        await pool.query('INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)', [sender_id, recipient_id, content]);
        res.status(201).json({ message: 'Message sent successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send message.' });
    }
});
apiRoutes.get('/messages', isAuthenticated, async (req, res) => {
    const recipient_id = req.user.id;
    try {
        const result = await pool.query(`SELECT message_id, content, sent_at, is_read, u.full_name as sender_name FROM messages m JOIN users u ON m.sender_id = u.user_id WHERE m.recipient_id = $1 ORDER BY m.sent_at DESC`, [recipient_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve messages.' });
    }
});
apiRoutes.delete('/messages/:id', isAuthenticated, async (req, res) => {
    const messageId = req.params.id;
    const userId = req.user.id;
    try {
        const result = await pool.query('DELETE FROM messages WHERE message_id = $1 AND recipient_id = $2', [messageId, userId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Message not found or you do not have permission to delete it.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete message.' });
    }
});

// Subscription Status
apiRoutes.get('/subscription-status', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT subscription_plan, subscription_status FROM locations WHERE location_id = $1', [req.user.location_id]);
        if (result.rows.length === 0) return res.status(404).json({ plan: 'None', status: 'inactive' });
        res.json({ plan: result.rows[0].subscription_plan || 'Free Tier', status: result.rows[0].subscription_status || 'inactive' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get subscription status.' });
    }
});

// NEW: Stripe Checkout Session Creation Endpoint
apiRoutes.post('/create-checkout-session', isAuthenticated, async (req, res) => {
    const { plan } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userLocationId = req.user.location_id;

    let priceId;
    let planName;

    if (plan === 'pro') {
        priceId = STRIPE_PRO_PRICE_ID;
        planName = 'Pro Plan';
    } else if (plan === 'enterprise') {
        priceId = STRIPE_ENTERPRISE_PRICE_ID;
        planName = 'Enterprise Plan';
    } else {
        return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    if (!priceId) {
        console.error(`Stripe Price ID not configured for plan: ${plan}`);
        return res.status(500).json({ error: 'Payment configuration error. Please contact support.' });
    }

    try {
        let customer;
        // Check if customer already exists in Stripe for this email
        const existingCustomers = await stripe.customers.list({ email: userEmail, limit: 1 });
        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
        } else {
            // Create a new customer in Stripe
            customer = await stripe.customers.create({
                email: userEmail,
                name: req.user.full_name,
                metadata: {
                    userId: userId,
                    locationId: userLocationId,
                },
            });
        }

        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${APP_BASE_URL}/account.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${APP_BASE_URL}/pricing.html?payment=cancelled`,
            metadata: {
                userId: userId,
                locationId: userLocationId,
                plan: plan,
            },
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session.' });
    }
});


// Feedback
apiRoutes.post('/feedback', isAuthenticated, async (req, res) => {
    const { feedback_type, message } = req.body;
    const userId = req.user.id;
    if (!feedback_type || !message) return res.status(400).json({ error: 'Feedback type and message are required.' });
    try {
        const userRes = await pool.query('SELECT full_name, email FROM users WHERE user_id = $1', [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'Submitting user not found.' });
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

// --- MOUNT ROUTERS ---
const onboardingRouter = createOnboardingRouter(pool, isAuthenticated, isAdmin);
apiRoutes.use('/onboarding-tasks', onboardingRouter);

// Mount apiRoutes under the '/api' prefix after all definitions
app.use('/api', apiRoutes);

// Mount ownerRoutes under the '/owner' prefix
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
