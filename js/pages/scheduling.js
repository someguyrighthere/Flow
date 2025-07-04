const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const { promises: fsPromises } = require('fs');
const path = require('path');
const onboardingRoutes = require('./routes/onboardingRoutes');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const apiRoutes = express.Router();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

if (!DATABASE_URL) {
    console.error("DATABASE_URL environment variable is not set. Please set it in your .env file or Render environment variables.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 20000,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));
app.use('/api', apiRoutes);

// --- Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        console.log('[Auth] No token provided, sending 401'); // Added log
        return res.sendStatus(401);
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('[Auth] Token verification failed, sending 403. Error:', err.message); // Added log
            return res.sendStatus(403);
        }
        req.user = user;
        console.log('[Auth] Token verified. User ID:', user.id, 'Role:', user.role); // Added log
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'location_admin')) {
        console.log('[Admin Middleware] User is admin, proceeding.'); // Added log
        next();
    } else {
        console.log('[Admin Middleware] Access denied. User role:', req.user ? req.user.role : 'none'); // Added log
        return res.status(403).json({ error: 'Access denied.' });
    }
};

// --- API ROUTES ---

// Auth Routes
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const locationRes = await client.query(`INSERT INTO locations (location_name) VALUES ($1) RETURNING location_id`,[`${companyName} HQ`]);
        const hash = await bcrypt.hash(password, 10);
        await client.query(`INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', NULL) RETURNING user_id`, [fullName, email, hash]);
        await client.query('COMMIT');
        res.status(201).json({ message: "Registration successful!" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Register] Error during registration:', err);
        res.status(500).json({ error: "An internal server error occurred during registration." });
    } finally {
        client.release();
    }
});

apiRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(`SELECT user_id, full_name, email, password, role, location_id FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials." });
        }
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, role: user.role, userId: user.user_id });
    } catch (err) {
        console.error('[Login] Error during login:', err);
        res.status(500).json({ error: "An internal server error occurred during login." });
    }
});

// --- User Routes (CORRECTED ORDER) ---

// Specific user routes first
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role, location_id FROM users WHERE user_id = $1', [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[Users] Failed to retrieve user profile:', err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

apiRoutes.get('/users/availability', isAuthenticated, isAdmin, async (req, res) => {
    const { location_id } = req.query;
    try {
        let query = `SELECT user_id, full_name, availability, location_id FROM users`;
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (req.user.role === 'super_admin' && location_id) {
            whereClauses.push(`location_id = $${paramIndex++}`);
            params.push(location_id);
        } else if (req.user.role === 'location_admin') {
            whereClauses.push(`location_id = $${paramIndex++}`);
            params.push(req.user.location_id);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[Users Availability] Error retrieving user availability:', err);
        res.status(500).json({ error: 'Failed to retrieve user availability.' });
    }
});

// Generic /users route last
apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    console.log(`[GET /api/users] Received request. Query:`, req.query);
    const { location_id } = req.query;
    try {
        let query = `
            SELECT u.user_id, u.full_name, u.position, u.role, u.location_id, u.availability, l.location_name
            FROM users u LEFT JOIN locations l ON u.location_id = l.location_id
        `;
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (req.user.role === 'location_admin') {
            whereClauses.push(`u.location_id = $${paramIndex++}`);
            params.push(req.user.location_id);
        } else if (req.user.role === 'super_admin' && location_id) {
            whereClauses.push(`u.location_id = $${paramIndex++}`);
            params.push(location_id);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }
        
        query += ' ORDER BY u.full_name';
        
        console.log(`[GET /api/users] Executing query: ${query} with params: ${params}`);
        const result = await pool.query(query, params);
        console.log(`[GET /api/users] Query successful, returning ${result.rows.length} users.`);
        res.json(result.rows);
    } catch (err) {
        console.error('[Users] Error retrieving users:', err);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

// ADDED: The missing DELETE route for users
apiRoutes.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    // Add logic to prevent users from deleting themselves
    if (req.user.id === parseInt(id, 10)) {
        return res.status(400).json({ error: "You cannot delete your own account." });
    }
    try {
        const result = await pool.query('DELETE FROM users WHERE user_id = $1 RETURNING user_id', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});


// --- Other Routes ---
// (The rest of the file remains the same)

// Locations Routes
apiRoutes.get('/locations', isAuthenticated, async (req, res) => {
    console.log(`[GET /api/locations] Received request. User Role: ${req.user.role}, User Location ID: ${req.user.location_id}`); // Added log
    try {
        let query = 'SELECT location_id, location_name, location_address FROM locations ORDER BY location_name';
        const params = [];
        if (req.user.role === 'location_admin') {
            query = 'SELECT location_id, location_name, location_address FROM locations WHERE location_id = $1 ORDER BY location_name';
            params.push(req.user.location_id);
        }
        console.log(`[GET /api/locations] Executing query: ${query} with params: ${params}`); // Added log
        const result = await pool.query(query, params);
        console.log(`[GET /api/locations] Query successful, returning ${result.rows.length} locations.`); // Added log
        res.json(result.rows);
    } catch (err) {
        console.error('[Locations] Error retrieving locations:', err);
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});

apiRoutes.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
    const { location_name, location_address } = req.body;
    if (!location_name || !location_address) {
        return res.status(400).json({ error: 'Location name and address are required.' });
    }
    try {
        const result = await pool.query('INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING *', [location_name, location_address]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Locations] Error adding new location:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Location name already exists.' });
        }
        res.status(500).json({ error: 'Failed to add new location.' });
    }
});

// Business Settings Endpoint
apiRoutes.get('/settings/business', isAuthenticated, async (req, res) => {
    let targetLocationId = req.user.role === 'super_admin' ? req.query.location_id : req.user.location_id;
    console.log(`[GET /api/settings/business] Received request. User Role: ${req.user.role}, Target Location ID: ${targetLocationId}`); // Added log
    if (!targetLocationId) {
        console.log('[GET /api/settings/business] No targetLocationId, returning null hours.'); // Added log
        return res.json({ operating_hours_start: null, operating_hours_end: null });
    }
    try {
        const result = await pool.query('SELECT operating_hours_start, operating_hours_end FROM business_settings WHERE location_id = $1', [targetLocationId]);
        console.log(`[GET /api/settings/business] Query successful. Result:`, result.rows[0]); // Added log
        res.json(result.rows[0] || { operating_hours_start: null, operating_hours_end: null });
    } catch (err) {
        console.error('[Backend] Error fetching business settings:', err);
        res.status(500).json({ error: 'Failed to retrieve business settings.' });
    }
});

apiRoutes.put('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    const { operating_hours_start, operating_hours_end, location_id: requestedLocationId } = req.body;
    let targetLocationId = req.user.role === 'super_admin' ? requestedLocationId : req.user.location_id;
    if (!targetLocationId) {
        return res.status(400).json({ error: 'A valid location must be specified or associated with the user.' });
    }
    if (!operating_hours_start || !operating_hours_end) {
        return res.status(400).json({ error: 'Start and end operating hours are required.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO business_settings (location_id, operating_hours_start, operating_hours_end) VALUES ($1, $2, $3)
             ON CONFLICT (location_id) DO UPDATE SET operating_hours_start = EXCLUDED.operating_hours_start, operating_hours_end = EXCLUDED.operating_hours_end, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [targetLocationId, operating_hours_start, operating_hours_end]
        );
        res.status(200).json({ message: 'Business settings updated successfully!', settings: result.rows[0] });
    } catch (err) {
        console.error('[Backend] Error updating business settings:', err);
        res.status(500).json({ error: 'Failed to update business settings.' });
    }
});

// Shift Management Routes
apiRoutes.get('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { startDate, endDate, location_id } = req.query;
    console.log(`[GET /api/shifts] Request received. User ID: ${req.user.id}, Role: ${req.user.role}. Query params: startDate=${startDate}, endDate=${endDate}, location_id=${location_id}`); // Added comprehensive log
    
    if (!startDate || !endDate) {
        console.log('[GET /api/shifts] Missing startDate or endDate, sending 400.'); // Added log
        return res.status(400).json({ error: 'Start date and end date are required for fetching shifts.' });
    }
    try {
        let query = `
            SELECT s.id, s.employee_id, u.full_name AS employee_name, s.location_id, l.location_name, s.start_time, s.end_time, s.notes
            FROM shifts s JOIN users u ON s.employee_id = u.user_id JOIN locations l ON s.location_id = l.location_id
            WHERE s.start_time >= $1 AND s.end_time <= $2
        `;
        const params = [startDate, endDate];
        let paramIndex = 3;

        const effectiveLocationId = req.user.role === 'super_admin' ? location_id : req.user.location_id;
        console.log(`[GET /api/shifts] Effective Location ID for query: ${effectiveLocationId}. User Role: ${req.user.role}`); // Added log

        if (effectiveLocationId) {
            query += ` AND s.location_id = $${paramIndex++}`;
            params.push(effectiveLocationId);
        }
        
        query += ' ORDER BY s.start_time ASC';
        
        console.log(`[GET /api/shifts] Executing SQL query: "${query}" with params: [${params.join(', ')}]`); // Added log
        const result = await pool.query(query, params);
        console.log(`[GET /api/shifts] Query successful, returning ${result.rows.length} shifts.`); // Added log
        // console.log(`[GET /api/shifts] Returned shifts data:`, result.rows); // Optional: log full data, but can be verbose
        res.json(result.rows);
    } catch (err) {
        console.error('[Shifts] Error retrieving shifts:', err);
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});

apiRoutes.post('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    console.log(`[POST /api/shifts] Received data from client: Employee ID: ${employee_id}, Location ID: ${location_id}, Start: ${start_time}, End: ${end_time}`); // Added log
    
    if (!employee_id || !location_id || !start_time || !end_time) {
        console.log('[POST /api/shifts] Missing required fields, sending 400.'); // Added log
        return res.status(400).json({ error: 'Employee, location, start time, and end time are required.' });
    }
    if (new Date(start_time) >= new Date(end_time)) {
        console.log('[POST /api/shifts] End time is not after start time, sending 400.'); // Added log
        return res.status(400).json({ error: 'End time must be after start time.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [employee_id, location_id, start_time, end_time, notes]
        );
        console.log('[POST /api/shifts] Shift created successfully in DB:', result.rows[0]); // Added log
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Shifts] Error creating shift:', err);
        res.status(500).json({ error: 'Failed to create shift.' });
    }
});

apiRoutes.delete('/shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE /api/shifts/:id] Request received for ID: ${id}`); // Added log
    try {
        const result = await pool.query('DELETE FROM shifts WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) {
            console.log(`[DELETE /api/shifts/:id] Shift ID ${id} not found.`); // Added log
            return res.status(404).json({ error: 'Shift not found.' });
        }
        console.log(`[DELETE /api/shifts/:id] Shift ID ${id} deleted successfully.`); // Added log
        res.status(204).send();
    } catch (err) {
        console.error('[Shifts] Error deleting shift:', err);
        res.status(500).json({ error: 'Failed to delete shift.' });
    }
});


// Onboarding Routes
onboardingRoutes(apiRoutes, pool, isAuthenticated, isAdmin);

// Server Startup
const startServer = async () => {
    try {
        const client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        client.release();
        app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port ${PORT}`));
    } catch (err) {
        console.error('Failed to start server:', err.stack);
        process.exit(1);
    }
};

startServer();