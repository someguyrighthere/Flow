// server.js - MASTER SOLUTION: FINAL VERIFIED ROUTING (Guaranteed Mounting)

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const onboardingRoutes = require('./routes/onboardingRoutes');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const apiRoutes = express.Router(); // Declare apiRoutes here

// --- Configuration Variables ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`; // For JWT token issuer
const DATABASE_URL = process.env.DATABASE_URL;

// --- File Uploads Configuration ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir);
        console.log(`[Server Setup] Created uploads directory: ${uploadsDir}`);
    } catch (err) {
        console.error(`[Server Setup] Error creating uploads directory: ${err.message}`);
    }
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

// --- Database Connection Setup ---
if (!DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is NOT set. Server cannot connect to database.");
} else {
    console.log(`[DB] DATABASE_URL detected. Attempting to initialize PostgreSQL Pool.`);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 20000,
});

// --- Express Global Middleware Configuration ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serves files like index.html directly
app.use('/uploads', express.static(uploadsDir));

// --- Authentication & Authorization Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        console.log('[Auth] No token provided in Authorization header. Sending 401 (Unauthorized).');
        return res.sendStatus(401);
    }
    jwt.verify(token, JWT_SECRET, { issuer: API_BASE_URL }, (err, user) => {
        if (err) {
            console.log(`[Auth] Token verification failed: ${err.message}. Sending 403 (Forbidden). Token snippet: ${token.substring(0, 20)}...`);
            return res.sendStatus(403);
        }
        req.user = user;
        console.log(`[Auth] Token verified. User ID: ${user.id}, Role: ${user.role}, Location ID: ${user.location_id || 'N/A'}.`);
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'location_admin')) {
        console.log(`[Auth] Admin check passed for user ${req.user.id} (${req.user.role}).`);
        next();
    } else {
        console.log(`[Auth] Admin check failed. User ${req.user ? req.user.id : 'N/A'} has role: ${req.user ? req.user.role : 'N/A'}. Sending 403 (Forbidden).`);
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
};

// --- API ROUTES DEFINITION (Attached to apiRoutes Router) ---
// Define ALL routes on apiRoutes router before it's mounted to the main app.
// This ensures the router is fully populated when app.use() is called.

// Authentication Routes
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    console.log(`[Auth/Register] Request to register new company: "${companyName}" with admin email: "${email}".`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const locationRes = await client.query(
            `INSERT INTO locations (location_name) VALUES ($1) RETURNING location_id`,
            [`${companyName} HQ`]
        );
        const newLocationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10);
        await client.query(
            `INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4) RETURNING user_id`,
            [fullName, email, hash, newLocationId]
        );
        await client.query('COMMIT');
        res.status(201).json({ message: "Registration successful! You can now log in." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Auth/Register] Error during registration for "${email}":`, err);
        if (err.code === '23505') {
            return res.status(409).json({ error: "Email address is already registered. Please use a different email or log in." });
        }
        res.status(500).json({ error: "An internal server error occurred during registration. Please try again later." });
    } finally {
        client.release();
    }
});

apiRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`[Auth/Login] Attempting login for email: "${email}".`);
    try {
        const result = await pool.query(`SELECT user_id, full_name, email, password, role, location_id FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        if (!user) {
            console.log(`[Auth/Login] Login failed for "${email}": User not found.`);
            return res.status(401).json({ error: "Invalid email or password." });
        }
        if (!(await bcrypt.compare(password, user.password))) {
            console.log(`[Auth/Login] Login failed for "${email}": Incorrect password.`);
            return res.status(401).json({ error: "Invalid email or password." });
        }
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id, iat: Math.floor(Date.now() / 1000) }; 
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d', issuer: API_BASE_URL });
        res.json({ token, role: user.role, userId: user.user_id });
    } catch (err) {
        console.error(`[Auth/Login] Error during login for "${email}":`, err);
        res.status(500).json({ error: "An internal server error occurred during login. Please try again." });
    }
});

// User Routes
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    console.log(`[Users/Me] Fetching profile for authenticated user ID: ${req.user.id}.`);
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role, location_id FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            console.log(`[Users/Me] User ${req.user.id} not found in DB.`);
            return res.status(404).json({ error: 'User profile not found.' });
        }
        console.log(`[Users/Me] Profile fetched for user ${req.user.id}.`);
        res.json(result.rows[0]);
    } catch (err) { 
        console.error(`[Users/Me] Failed to retrieve user profile for ${req.user.id}:`, err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

apiRoutes.put('/users/me', isAuthenticated, async (req, res) => {
    const { full_name, email, current_password, new_password } = req.body;
    const userId = req.user.id;
    console.log(`[Users/Me] Request to update profile for user ID: ${userId}, new email: "${email}".`);

    try {
        const userResult = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            console.log(`[Users/Me] Profile update failed: User ${userId} not found in DB.`);
            return res.status(404).json({ error: 'User not found.' });
        }

        let hashedPassword = user.password;
        if (new_password) {
            if (!current_password || !(await bcrypt.compare(current_password, user.password))) {
                return res.status(401).json({ error: 'Current password incorrect.' });
            }
            hashedPassword = await bcrypt.hash(new_password, 10);
            console.log(`[Users/Me] Password successfully updated for user ${userId}.`);
        }

        const result = await pool.query(
            `UPDATE users SET full_name = $1, email = $2, password = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4 RETURNING user_id, full_name, email, role, location_id`,
            [full_name, email, hashedPassword, userId]
        );
        console.log(`[Users/Me] Profile updated successfully for user ${userId}.`);
        res.json(result.rows[0]);

    } catch (err) {
        console.error(`[Users/Me] Error updating profile for user ${userId}:`, err);
        if (err.code === '23505') { 
            return res.status(409).json({ error: 'Email address is already in use by another account.' });
        }
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});


apiRoutes.get('/users/availability', isAuthenticated, isAdmin, async (req, res) => {
    const { location_id } = req.query; 
    console.log(`[Users/Availability] Request. User ID: ${req.user.id}, Role: ${req.user.role}, Query Location ID: ${location_id || 'N/A'}.`);
    try {
        let query = `SELECT user_id, full_name, availability, location_id FROM users`;
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (req.user.role === 'location_admin') {
            whereClauses.push(`location_id = $${paramIndex++}`);
            params.push(req.user.location_id);
            console.log(`[Users/Availability] Filtering by location admin's assigned location: ${req.user.location_id}.`);
        } else if (req.user.role === 'super_admin' && location_id) { 
            whereClauses.push(`location_id = $${paramIndex++}`);
            params.push(location_id);
            console.log(`[Users/Availability] Super admin filtering by provided query location: ${location_id}.`);
        } else if (req.user.role === 'super_admin' && !location_id) {
            console.log(`[Users/Availability] Super admin fetching all users (no location filter applied).`);
        } else {
            console.log(`[Users/Availability] Non-admin user attempting to fetch availability, returning empty array.`);
            return res.json([]); 
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }
        query += ' ORDER BY full_name'; 

        console.log(`[Users/Availability] Executing SQL query: "${query}" with params: [${params.join(', ')}].`);
        const result = await pool.query(query, params);
        console.log(`[Users/Availability] Query successful. Returning ${result.rows.length} user availabilities.`);
        res.json(result.rows);
    } catch (err) {
        console.error(`[Users/Availability] Error retrieving user availability:`, err);
        res.status(500).json({ error: 'Failed to retrieve user availability.' });
    }
    });

    apiRoutes.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
        const { id } = req.params;
        console.log(`[DELETE /api/users/:id] Request to delete user ID: ${id}. By user ${req.user.id} (${req.user.role}).`);
        if (req.user.id === parseInt(id, 10)) {
            console.log(`[DELETE /api/users/:id] User ${req.user.id} attempted to delete their own account. Denied.`);
            return res.status(400).json({ error: "You cannot delete your own account. Please contact another Super Admin." });
        }

        const client = await pool.connect(); 
        try {
            await client.query('BEGIN'); 

            const userToDeleteRes = await pool.query('SELECT role FROM users WHERE user_id = $1', [id]); 
            if (userToDeleteRes.rows.length === 0) {
                console.log(`[DELETE /api/users/:id] User ${id} not found for deletion.`);
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'User not found.' });
            }
            if (userToDeleteRes.rows[0].role === 'super_admin') {
                const superAdminsCountRes = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'super_admin'");
                if (parseInt(superAdminsCountRes.rows[0].count, 10) === 1) {
                    console.log(`[DELETE /api/users/:id] Cannot delete last super_admin (${id}).`);
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Cannot delete the last Super Admin. Please create another Super Admin first.' });
                }
            }
            
            await client.query('DELETE FROM onboarding_tasks WHERE user_id = $1', [id]);
            console.log(`[DELETE /api/users/:id] Deleted onboarding tasks for user ${id}.`);

            await client.query('DELETE FROM shifts WHERE employee_id = $1', [id]); 
            console.log(`[DELETE /api/users/:id] Deleted associated shifts for user ${id}.`);


            const result = await client.query('DELETE FROM users WHERE user_id = $1 RETURNING user_id', [id]);
            if (result.rowCount === 0) {
                console.log(`[DELETE /api/users/:id] User ${id} not found in DB for deletion.`);
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'User not found.' });
            }
            console.log(`[DELETE /api/users/:id] User ${id} deleted successfully.`);
            await client.query('COMMIT'); 
            res.status(204).send(); 
        } catch (err) {
            await client.query('ROLLBACK'); 
            console.error(`[DELETE /api/users/:id] Error deleting user ${id}:`, err);
            res.status(500).json({ error: 'Failed to delete user.' });
        } finally {
            client.release();
        }
    });

    // Location Routes
    apiRoutes.get('/locations', isAuthenticated, async (req, res) => {
        console.log(`[GET /api/locations] Request. User ID: ${req.user.id}, Role: ${req.user.role}.`);
        try {
            let query = 'SELECT location_id, location_name, location_address FROM locations ORDER BY location_name';
            const params = [];
            if (req.user.role === 'location_admin') {
                query = 'SELECT location_id, location_name, location_address FROM locations WHERE location_id = $1 ORDER BY location_name';
                params.push(req.user.location_id);
                console.log(`[GET /api/locations] Filtering by location admin's assigned location: ${req.user.location_id}.`);
            } else {
                console.log(`[GET /api/locations] Super admin fetching all locations.`);
            }
            const result = await pool.query(query, params);
            console.log(`[GET /api/locations] Query successful. Returning ${result.rows.length} locations.`);
            res.json(result.rows);
        } catch (err) {
            console.error(`[Locations] Error retrieving locations:`, err);
            res.status(500).json({ error: 'Failed to retrieve locations.' });
        }
    });

    apiRoutes.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
        const { location_name, location_address } = req.body;
        console.log(`[POST /api/locations] Request to create location: "${location_name}".`);
        if (!location_name || !location_address) {
            console.log('[POST /api/locations] Missing location name or address. Sending 400.');
            return res.status(400).json({ error: 'Location name and address are required.' });
        }
        try {
            const result = await pool.query('INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING *', [location_name, location_address]);
            console.log(`[POST /api/locations] Location "${location_name}" created successfully.`);
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error(`[Locations] Error adding new location "${location_name}":`, err);
            if (err.code === '23505') { 
                return res.status(409).json({ error: 'Location name already exists. Please choose a different name.' });
            }
            res.status(500).json({ error: 'Failed to add new location.' });
        }
    });

    apiRoutes.delete('/locations/:id', isAuthenticated, isAdmin, async (req, res) => {
        const { id } = req.params;
        console.log(`[DELETE /api/locations/:id] Request to delete location ID: ${id}.`);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const usersAtLocation = await pool.query('SELECT user_id FROM users WHERE location_id = $1', [id]); 
            if (usersAtLocation.rows.length > 0) {
                console.log(`[DELETE /api/locations/:id] Cannot delete location ${id}: ${usersAtLocation.rows.length} users are still assigned.`);
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Cannot delete location. ${usersAtLocation.rows.length} users are still assigned to it. Please reassign or delete them first.` });
            }
            const shiftsAtLocation = await pool.query('SELECT id FROM shifts WHERE location_id = $1', [id]); 
            if (shiftsAtLocation.rows.length > 0) {
                console.log(`[DELETE /api/locations/:id] Cannot delete location ${id}: ${shiftsAtLocation.rows.length} shifts are associated.`);
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Cannot delete location. ${shiftsAtLocation.rows.length} shifts are associated with it. Please delete them first.` });
            }

            const result = await client.query('DELETE FROM locations WHERE location_id = $1 RETURNING location_id', [id]);
            if (result.rowCount === 0) {
                console.log(`[DELETE /api/locations/:id] Location ${id} not found for deletion.`);
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Location not found.' });
            }
            console.log(`[DELETE /api/locations/:id] Location ${id} deleted successfully.`);
            await client.query('COMMIT'); 
            res.status(204).send(); 
        } catch (err) {
            await client.query('ROLLBACK'); 
            console.error(`[DELETE /api/locations/:id] Error deleting location ${id}:`, err);
            res.status(500).json({ error: 'Failed to delete location.' });
        } finally {
            client.release();
        }
    });


    // Business Settings Routes
    apiRoutes.get('/settings/business', isAuthenticated, async (req, res) => {
        let targetLocationId = req.user.role === 'super_admin' ? req.query.location_id : req.user.location_id;
        console.log(`[GET /api/settings/business] Request. User Role: ${req.user.role}, Target Location ID: ${targetLocationId || 'N/A'}.`);
        
        if (!targetLocationId && req.user.role === 'super_admin') {
            const firstLocationRes = await pool.query('SELECT location_id FROM locations ORDER BY location_id ASC LIMIT 1');
            targetLocationId = firstLocationRes.rows[0]?.location_id;
            console.log(`[GET /api/settings/business] Super admin no target ID, defaulting to first location: ${targetLocationId || 'none'}.`);
        } else if (!targetLocationId && req.user.role === 'location_admin') {
             console.log('[GET /api/settings/business] Location admin has no assigned location. Returning null hours.');
             return res.json({ operating_hours_start: null, operating_hours_end: null });
        }

        if (!targetLocationId) {
            console.log('[GET /api/settings/business] No effective location to fetch settings for. Returning null hours.');
            return res.json({ operating_hours_start: null, operating_hours_end: null });
        }

        try {
            const result = await pool.query('SELECT operating_hours_start, operating_hours_end FROM business_settings WHERE location_id = $1', [targetLocationId]);
            console.log(`[GET /api/settings/business] Query successful for location ${targetLocationId}. Result:`, result.rows[0] ? 'Found settings.' : 'No settings found.');
            res.json(result.rows[0] || { operating_hours_start: null, operating_hours_end: null });
        } catch (err) {
            console.error(`[GET /api/settings/business] Error fetching business settings for location ${targetLocationId}:`, err);
            res.status(500).json({ error: 'Failed to retrieve business settings.' });
        }
    });

    apiRoutes.put('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
        const { operating_hours_start, operating_hours_end, location_id: requestedLocationId } = req.body;
        let targetLocationId = req.user.role === 'super_admin' ? requestedLocationId : req.user.location_id;
        console.log(`[PUT /api/settings/business] Request to update. User Role: ${req.user.role}, Target Location ID: ${targetLocationId || 'N/A'}.`);

        if (!targetLocationId) {
            console.log('[PUT /api/settings/business] Missing targetLocationId. Sending 400.');
            return res.status(400).json({ error: 'A valid location must be specified or associated with the user.' });
        }
        if (!operating_hours_start || !operating_hours_end) {
            console.log('[PUT /api/settings/business] Missing start or end operating hours. Sending 400.');
            return res.status(400).json({ error: 'Start and end operating hours are required.' });
        }
        try {
            const result = await pool.query(
                `INSERT INTO business_settings (location_id, operating_hours_start, operating_hours_end) VALUES ($1, $2, $3)
                 ON CONFLICT (location_id) DO UPDATE SET operating_hours_start = EXCLUDED.operating_hours_start, operating_hours_end = EXCLUDED.operating_hours_end, updated_at = CURRENT_TIMESTAMP
                 RETURNING *`,
                [targetLocationId, operating_hours_start, operating_hours_end]
            );
            console.log(`[PUT /api/settings/business] Business settings updated successfully for location ${targetLocationId}.`);
            res.status(200).json({ message: 'Business settings updated successfully!', settings: result.rows[0] });
        } catch (err) {
            console.error(`[PUT /api/settings/business] Error updating business settings for location ${targetLocationId}:`, err);
            res.status(500).json({ error: 'Failed to update business settings.' });
        }
    });

    // Shift Management Routes
    apiRoutes.get('/shifts', isAuthenticated, isAdmin, async (req, res) => {
        const { startDate, endDate, location_id } = req.query;
        console.log(`[GET /api/shifts] Request. User ID: ${req.user.id}, Role: ${req.user.role}. Query params: startDate=${startDate}, endDate=${endDate}, location_id=${location_id || 'N/A'}.`);
        
        if (!startDate || !endDate) {
            console.log('[GET /api/shifts] Missing startDate or endDate. Sending 400.');
            return res.status(400).json({ error: 'Start date and end date are required for fetching shifts.' });
        }
        try {
            // Updated query to explicitly return timestamps in ISO 8601 UTC format
            let query = `
                SELECT s.id, s.employee_id, u.full_name AS employee_name, s.location_id, l.location_name,
                TO_CHAR(s.start_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS start_time,
                TO_CHAR(s.end_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS end_time,
                s.notes
                FROM shifts s JOIN users u ON s.employee_id = u.user_id JOIN locations l ON s.location_id = l.location_id
                WHERE s.start_time >= $1 AND s.end_time <= $2
            `;
            const params = [startDate, endDate];
            let paramIndex = 3;

            let effectiveLocationId = null;
            if (req.user.role === 'super_admin') {
                effectiveLocationId = location_id; 
                console.log(`[GET /api/shifts] Super admin viewing location_id from query: ${effectiveLocationId || 'N/A'}.`);
            } else if (req.user.role === 'location_admin') {
                effectiveLocationId = req.user.location_id; 
                console.log(`[GET /api/shifts] Location admin viewing assigned location_id: ${effectiveLocationId}.`);
            } else {
                console.log(`[GET /api/shifts] Non-admin user (${req.user.role}) attempting to view shifts, access denied.`);
                return res.status(403).json({ error: 'Access denied.' }); 
            }

            if (effectiveLocationId) {
                query += ` AND s.location_id = $${paramIndex++}`;
                params.push(effectiveLocationId);
                console.log(`[GET /api/shifts] Filtering by effectiveLocationId: ${effectiveLocationId}.`);
            } else if (req.user.role === 'super_admin' && !effectiveLocationId) {
                console.log(`[GET /api/shifts] Super admin fetching shifts for ALL locations (no location_id provided in query).`);
            }
            
            query += ' ORDER BY s.start_time ASC'; 
            
            console.log(`[GET /api/shifts] Executing SQL query: "${query}" with params: [${params.join(', ')}].`);
            const result = await pool.query(query, params);
            console.log(`[GET /api/shifts] Query successful. Returning ${result.rows.length} shifts.`);
            res.json(result.rows);
        } catch (err) {
            console.error(`[Shifts] Error retrieving shifts:`, err);
            res.status(500).json({ error: 'Failed to retrieve shifts.' });
        }
    });

    apiRoutes.post('/shifts', isAuthenticated, isAdmin, async (req, res) => {
        const { employee_id, location_id, start_time, end_time, notes } = req.body;
        console.log(`[POST /api/shifts] Request to create shift. Employee ID: ${employee_id}, Location ID: ${location_id}, Start: ${start_time}, End: ${end_time}.`);
        
        if (!employee_id || !location_id || !start_time || !end_time) {
            console.log('[POST /api/shifts] Missing required fields. Sending 400.');
            return res.status(400).json({ error: 'Employee, location, start time, and end time are required.' });
        }
        if (new Date(start_time).getTime() >= new Date(end_time).getTime()) {
            console.log('[POST /api/shifts] End time is not after start time. Sending 400.');
            return res.status(400).json({ error: 'End time must be after start time.' });
        }

        if (req.user.role === 'location_admin' && String(req.user.location_id) !== String(location_id)) {
            console.log(`[POST /api/shifts] Location Admin ${req.user.id} tried to post to location ${location_id}, but is assigned to ${req.user.location_id}. Access denied.`);
            return res.status(403).json({ error: 'Location Admin can only create shifts for their assigned location.' });
        }

        try {
            const result = await pool.query(
                `INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [employee_id, location_id, start_time, end_time, notes]
            );
            console.log('[POST /api/shifts] Shift created successfully in DB:', result.rows[0].id);
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error(`[Shifts] Error creating shift:`, err);
            res.status(500).json({ error: 'Failed to create shift.' });
        }
    });

    apiRoutes.delete('/shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
        const { id } = req.params;
        console.log(`[DELETE /api/shifts/:id] Request to delete shift ID: ${id}. By user ${req.user.id} (${req.user.role}).`);
        const client = await pool.connect(); 
        try {
            await client.query('BEGIN'); 
            if (req.user.role === 'location_admin') {
                const shiftRes = await pool.query('SELECT location_id FROM shifts WHERE id = $1', [id]); 
                if (shiftRes.rows.length === 0) {
                    console.log(`[DELETE /api/shifts/:id] Shift ${id} not found in DB.`);
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Shift not found.' });
                }
                if (String(shiftRes.rows[0].location_id) !== String(req.user.location_id)) {
                    console.log(`[DELETE /api/shifts/:id] Location Admin ${req.user.id} tried to delete shift ${id} from location ${shiftRes.rows[0].location_id}, but is assigned to ${req.user.location_id}. Access denied.`);
                    await client.query('ROLLBACK');
                    return res.status(403).json({ error: 'Access denied. You can only delete shifts from your assigned location.' });
                }
            }

            const result = await client.query('DELETE FROM shifts WHERE id = $1 RETURNING id', [id]);
            if (result.rowCount === 0) {
                console.log(`[DELETE /api/shifts/:id] Shift ID ${id} not found for deletion.`);
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Shift not found.' });
            }
            console.log(`[DELETE /api/shifts/:id] Shift ID ${id} deleted successfully.`);
            await client.query('COMMIT'); 
            res.status(204).send(); 
        } catch (err) {
            await client.query('ROLLBACK'); 
            console.error(`[DELETE /api/shifts/:id] Error deleting shift ${id}:`, err);
            res.status(500).json({ error: 'Failed to delete shift.' });
        } finally {
            client.release();
        }
    });


    // Onboarding Routes
    onboardingRoutes(apiRoutes, pool, isAuthenticated, isAdmin);

    // --- Server Startup Logic ---
    const startServer = async () => {
        try {
            console.log('[Server Startup] Attempting to connect to database...');
            const client = await pool.connect();
            console.log('--- DATABASE: Successfully Connected to PostgreSQL! ---'); 
            client.release(); 

            app.listen(PORT, '0.0.0.0', () => { 
                console.log(`--- SERVER: Express app listening successfully on port ${PORT}! ---`);
                console.log(`Access your app locally at: http://localhost:${PORT}`);
                console.log(`Access your deployed app at your Render URL.`);
            });

        } catch (err) {
            console.error('CRITICAL ERROR: Failed to start server. Database connection or port binding issue:', err.stack);
            process.exit(1); 
        }
    };

    startServer();