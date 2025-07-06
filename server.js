// server.js - FINAL VERSION WITH ALL ROUTES

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

// --- API ROUTES DEFINITION ---
// Includes all routes for all features

// Authentication
apiRoutes.post('/register', async (req, res) => { /* ... */ });
apiRoutes.post('/login', async (req, res) => { /* ... */ });

// Users
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => { /* ... */ });
apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.put('/users/me', isAuthenticated, async (req, res) => { /* ... */ });
apiRoutes.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.post('/invite-admin', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.post('/invite-employee', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });

// Locations & Settings
apiRoutes.get('/locations', isAuthenticated, async (req, res) => { /* ... */ });
apiRoutes.post('/locations', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.delete('/locations/:id', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.get('/settings/business', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.put('/settings/business', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });

// Checklists
apiRoutes.get('/checklists', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.post('/checklists', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });

// Documents
apiRoutes.get('/documents', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.post('/documents', isAuthenticated, isAdmin, upload.single('document'), async (req, res) => { /* ... */ });
apiRoutes.delete('/documents/:id', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });

// Hiring
apiRoutes.get('/job-postings', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.post('/job-postings', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.get('/applicants', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.delete('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });

// Scheduling
apiRoutes.get('/shifts', isAuthenticated, async (req, res) => {
    const { startDate, endDate, location_id, user_id } = req.query;
    const requestingUserId = req.user.id;
    const isUserAdmin = req.user.role === 'super_admin' || req.user.role === 'location_admin';

    if (user_id && !isUserAdmin && String(user_id) !== String(requestingUserId)) {
        return res.status(403).json({ error: 'Access denied.' });
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
apiRoutes.post('/shifts', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.delete('/shifts/:id', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
apiRoutes.delete('/shifts', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });

// Messaging
apiRoutes.post('/messages', isAuthenticated, async (req, res) => { /* ... */ });
apiRoutes.get('/messages', isAuthenticated, async (req, res) => { /* ... */ });
apiRoutes.delete('/messages/:id', isAuthenticated, async (req, res) => { /* ... */ });

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
