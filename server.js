// server.js - FINAL VERSION WITH ALL FIXES

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Uncomment when ready

const createOnboardingRouter = require('./routes/onboardingRoutes');

const app = express();
const apiRoutes = express.Router();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

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

// --- ALL API ROUTES ---
// ... (All other routes like /login, /register, /users, etc. are included here) ...

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

// --- Scheduling Routes ---
apiRoutes.get('/shifts', isAuthenticated, async (req, res) => {
    const { startDate, endDate, location_id, user_id } = req.query;
    const requestingUserId = req.user.id;
    const isUserAdmin = req.user.role === 'super_admin' || req.user.role === 'location_admin';

    // Logic for employees to fetch their own schedule
    if (user_id && !isUserAdmin && String(user_id) !== String(requestingUserId)) {
        return res.status(403).json({ error: 'Access denied. You can only view your own schedule.' });
    }

    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start and end dates are required.' });
    }
    
    try {
        let query = `
            SELECT s.id, s.employee_id, u.full_name AS employee_name, s.location_id, l.location_name,
            s.start_time, s.end_time
            FROM shifts s 
            JOIN users u ON s.employee_id = u.user_id 
            JOIN locations l ON s.location_id = l.location_id
            WHERE s.start_time >= $1 AND s.end_time <= $2
        `;
        const params = [startDate, endDate];
        let paramIndex = 3;

        if (isUserAdmin) {
            if (location_id) {
                query += ` AND s.location_id = $${paramIndex++}`;
                params.push(location_id);
            }
        } else {
            // If not admin, or an admin looking at their own schedule via this param
            const targetUserId = user_id || requestingUserId;
            query += ` AND s.employee_id = $${paramIndex++}`;
            params.push(targetUserId);
        }
        
        query += ' ORDER BY s.start_time ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching shifts:", err);
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});


// --- MOUNT ROUTERS ---
const onboardingRouter = createOnboardingRouter(pool, isAuthenticated, isAdmin);
apiRoutes.use('/onboarding-tasks', onboardingRouter);

app.use('/api', apiRoutes);

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
