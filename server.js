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

// --- 2. Initialize Express App ---
const app = express();
const apiRoutes = express.Router();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;
const YOUR_DOMAIN = process.env.YOUR_DOMAIN || 'http://localhost:3000';

// --- Multer Storage Setup ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

// --- 3. Database Connection ---
if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
}
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- 4. Middleware ---
// Use express.raw() for the Stripe webhook, before express.json()
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

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
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
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
});

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

// Static file serving
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// --- 5. Authentication Middleware ---
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

// --- 6. API Routes ---

// Public Registration and Login
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    if (!companyName || !fullName || !email || !password) {
        return res.status(400).json({ error: "All fields are required." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create a new company with a default 'Free' plan
        const companyRes = await client.query(
            `INSERT INTO companies (name, subscription_plan) VALUES ($1, 'Free') RETURNING id`,
            [companyName]
        );
        const companyId = companyRes.rows[0].id;

        // Create a default location for the new company
        const locationRes = await client.query(
            `INSERT INTO locations (location_name, location_address, company_id) VALUES ($1, $2, $3) RETURNING location_id`,
            [`${companyName} HQ`, 'Default Address', companyId]
        );
        const locationId = locationRes.rows[0].location_id;

        // Create the super_admin user for the company
        const hash = await bcrypt.hash(password, 10);
        await client.query(
            `INSERT INTO users (full_name, email, password, role, location_id, company_id) VALUES ($1, $2, $3, 'super_admin', $4, $5)`,
            [fullName, email, hash, locationId, companyId]
        );
        
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

// --- Subscription and Payment Routes ---
apiRoutes.post('/create-checkout-session', isAuthenticated, async (req, res) => {
    const { plan } = req.body;
    const companyId = req.user.company_id;

    const priceIds = {
        'Pro': process.env.STRIPE_PRO_PRICE_ID,
        'Enterprise': process.env.STRIPE_ENTERPRISE_PRICE_ID
    };

    const priceId = priceIds[plan];
    if (!priceId) {
        return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${YOUR_DOMAIN}/account.html?payment=success`,
            cancel_url: `${YOUR_DOMAIN}/pricing.html?payment=cancelled`,
            client_reference_id: companyId, // Pass company ID to webhook
            metadata: {
                plan: plan // Pass plan name to webhook
            }
        });
        res.json({ id: session.id });
    } catch (error) {
        console.error("Stripe session creation error:", error);
        res.status(500).json({ error: 'Failed to create checkout session.' });
    }
});

apiRoutes.get('/subscription-status', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT subscription_plan FROM companies WHERE id = $1', [req.user.company_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({error: 'Company not found.'});
        }
        res.json({ plan: result.rows[0].subscription_plan });
    } catch (error) {
        console.error("Error fetching subscription status:", error);
        res.status(500).json({ error: 'Failed to get subscription status.' });
    }
});


// Other routes...
onboardingRoutes(apiRoutes, pool, isAuthenticated, isAdmin);

// Fallback for serving index.html
app.get(/'*'/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- 7. Server Startup Logic ---
const startServer = async () => {
    let client;
    try {
        client = await pool.connect();
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
                company_id INT NOT NULL,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            
            ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INT;
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.constraint_column_usage
                    WHERE table_name = 'users' AND constraint_name = 'users_company_id_fkey'
                ) THEN
                    ALTER TABLE users ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
                END IF;
            END;
            $$;
        `;
        
        await client.query(schemaQueries);
        console.log("Database schema verified/created.");

        client.release();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (err) {
        console.error('Failed to initialize database or start server:', err.stack);
        if (client) client.release();
        process.exit(1);
    }
};

startServer();
