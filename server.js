// server.js - DEFINITIVE VERSION for Backend Stability and Logging

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
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Assuming Stripe is used elsewhere and correctly configured

const app = express();
const apiRoutes = express.Router();
// Use process.env.PORT as provided by Render, fallback to 3000 for local development
const PORT = process.env.PORT || 3000; 
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

// --- File Uploads Configuration ---
const uploadsDir = path.join(__dirname, 'uploads');
// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    console.log(`[Server Setup] Creating uploads directory: ${uploadsDir}`);
    fs.mkdirSync(uploadsDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

// --- Database Connection Configuration ---
if (!DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is not set. Cannot connect to database.");
    // Do not exit here; let the startServer catch the connection error if it's during actual connect
    // process.exit(1);
}
console.log(`[DB] Attempting to connect to database using DATABASE_URL...`);
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // CRUCIAL for Render's managed PostgreSQL
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 20000,
});

// --- Express Middleware ---
app.use(cors());
app.use(express.json()); // To parse JSON request bodies
app.use(express.static(path.join(__dirname))); // Serve static files from root
app.use('/uploads', express.static(uploadsDir)); // Serve uploaded files
app.use('/api', apiRoutes); // Mount API routes under /api

// --- Authentication & Authorization Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        console.log('[Auth] No token provided in Authorization header, sending 401.');
        return res.sendStatus(401); // Unauthorized
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log(`[Auth] Token verification failed: ${err.message}, sending 403. Token: ${token.substring(0, 20)}...`);
            return res.sendStatus(403); // Forbidden
        }
        req.user = user; // Attach user payload to request
        console.log(`[Auth] Token verified. User ID: ${user.id}, Role: ${user.role}, Location ID: ${user.location_id || 'N/A'}.`);
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'location_admin')) {
        console.log(`[Auth] Admin check passed for user ${req.user.id} (${req.user.role}).`);
        next();
    } else {
        console.log(`[Auth] Admin check failed for user ${req.user.id} (${req.user.role || 'No Role'}). Sending 403.`);
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
};

// --- API ROUTES ---

// Auth Routes
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    console.log(`[Auth/Register] Attempting registration for: ${email}`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Create a default location for the new company
        const locationRes = await client.query(`INSERT INTO locations (location_name) VALUES ($1) RETURNING location_id`, [`${companyName} HQ`]);
        const newLocationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10);
        // Create the super_admin user, potentially linking to the new location
        await client.query(
            `INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4) RETURNING user_id`,
            [fullName, email, hash, newLocationId] // Link super_admin to their first location
        );
        await client.query('COMMIT');
        console.log(`[Auth/Register] Registration successful for ${email}, Company: ${companyName}.`);
        res.status(201).json({ message: "Registration successful! You can now log in." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Auth/Register] Error during registration for ${email}:`, err);
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ error: "Email already registered." });
        }
        res.status(500).json({ error: "An internal server error occurred during registration." });
    } finally {
        client.release();
    }
});

apiRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`[Auth/Login] Attempting login for: ${email}`);
    try {
        const result = await pool.query(`SELECT user_id, full_name, email, password, role, location_id FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        if (!user) {
            console.log(`[Auth/Login] Login failed for ${email}: User not found.`);
            return res.status(401).json({ error: "Invalid credentials." });
        }
        if (!(await bcrypt.compare(password, user.password))) {
            console.log(`[Auth/Login] Login failed for ${email}: Incorrect password.`);
            return res.status(401).json({ error: "Invalid credentials." });
        }
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        console.log(`[Auth/Login] Login successful for ${email}. Role: ${user.role}.`);
        res.json({ token, role: user.role, userId: user.user_id });
    } catch (err) {
        console.error(`[Auth/Login] Error during login for ${email}:`, err);
        res.status(500).json({ error: "An internal server error occurred during login." });
    }
});

// --- User Routes ---

apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    console.log(`[Users/Me] Fetching profile for user ID: ${req.user.id}`);
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role, location_id FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            console.log(`[Users/Me] User ${req.user.id} not found.`);
            return res.status(404).json({ error: 'User profile not found.' });
        }
        console.log(`[Users/Me] Profile fetched for ${req.user.id}.`);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`[Users/Me] Failed to retrieve user profile for ${req.user.id}:`, err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

// Endpoint to update user profile (including password)
apiRoutes.put('/users/me', isAuthenticated, async (req, res) => {
    const { full_name, email, current_password, new_password } = req.body;
    const userId = req.user.id;
    console.log(`[Users/Me] Updating profile for user ID: ${userId}, email: ${email}`);

    try {
        const userResult = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            console.log(`[Users/Me] Profile update failed: User ${userId} not found.`);
            return res.status(404).json({ error: 'User not found.' });
        }

        let hashedPassword = user.password;
        if (new_password) {
            if (!current_password || !(await bcrypt.compare(current_password, user.password))) {
                console.log(`[Users/Me] Profile update failed: Incorrect current password for user ${userId}.`);
                return res.status(401).json({ error: 'Current password incorrect.' });
            }
            hashedPassword = await bcrypt.hash(new_password, 10);
            console.log(`[Users/Me] Password updated for user ${userId}.`);
        }

        const result = await pool.query(
            `UPDATE users SET full_name = $1, email = $2, password = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4 RETURNING user_id, full_name, email, role, location_id`,
            [full_name, email, hashedPassword, userId]
        );
        console.log(`[Users/Me] Profile updated successfully for user ${userId}.`);
        res.json(result.rows[0]);

    } catch (err) {
        console.error(`[Users/Me] Error updating profile for user ${userId}:`, err);
        if (err.code === '23505') { // Unique violation for email
            return res.status(409).json({ error: 'Email already in use.' });
        }
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});


apiRoutes.get('/users/availability', isAuthenticated, isAdmin, async (req, res) => {
    const { location_id } = req.query; // This can be passed by super_admin
    console.log(`[Users/Availability] Request for user availability. User Role: ${req.user.role}, Query Location ID: ${location_id}.`);
    try {
        let query = `SELECT user_id, full_name, availability, location_id FROM users`;
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (req.user.role === 'location_admin') {
            whereClauses.push(`location_id = $${paramIndex++}`);
            params.push(req.user.location_id);
            console.log(`[Users/Availability] Filtering by location_admin's own location: ${req.user.location_id}`);
        } else if (req.user.role === 'super_admin' && location_id) { // Super admin can filter by provided location_id
            whereClauses.push(`location_id = $${paramIndex++}`);
            params.push(location_id);
            console.log(`[Users/Availability] Super admin filtering by query location: ${location_id}`);
        } else if (req.user.role === 'super_admin' && !location_id) {
            // Super admin wants all users, no location filter
            console.log(`[Users/Availability] Super admin fetching all users (no location filter).`);
        } else {
            // Should not happen, but a fallback if role is employee or unhandled
            console.log(`[Users/Availability] Non-admin user attempting to fetch all availability, returning empty.`);
            return res.json([]);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }
        query += ' ORDER BY full_name';

        console.log(`[Users/Availability] Executing query: "${query}" with params: [${params.join(', ')}]`);
        const result = await pool.query(query, params);
        console.log(`[Users/Availability] Query successful, returning ${result.rows.length} users.`);
        res.json(result.rows);
    } catch (err) {
        console.error(`[Users/Availability] Error retrieving user availability:`, err);
        res.status(500).json({ error: 'Failed to retrieve user availability.' });
    }
});

apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    console.log(`[GET /api/users] Received request. User ID: ${req.user.id}, Role: ${req.user.role}, Query:`, req.query);
    const { location_id } = req.query; // This can be passed by super_admin
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
            console.log(`[GET /api/users] Filtering by location_admin's own location: ${req.user.location_id}`);
        } else if (req.user.role === 'super_admin' && location_id) { // Super admin can filter by provided location_id
            whereClauses.push(`u.location_id = $${paramIndex++}`);
            params.push(location_id);
            console.log(`[GET /api/users] Super admin filtering by query location: ${location_id}`);
        } else if (req.user.role === 'super_admin' && !location_id) {
            // Super admin wants all users, no location filter (returns all users for all locations)
            console.log(`[GET /api/users] Super admin fetching all users (no location filter).`);
        } else {
             // Should not happen, but a fallback if role is employee or unhandled
            console.log(`[GET /api/users] Non-admin user attempting to fetch all users, returning empty.`);
            return res.json([]);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }
        
        query += ' ORDER BY u.full_name';
        
        console.log(`[GET /api/users] Executing SQL query: "${query}" with params: [${params.join(', ')}]`);
        const result = await pool.query(query, params);
        console.log(`[GET /api/users] Query successful, returning ${result.rows.length} users.`);
        res.json(result.rows);
    } catch (err) {
        console.error(`[GET /api/users] Error retrieving users:`, err);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

apiRoutes.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE /api/users/:id] Request received for ID: ${id}. By user ${req.user.id} (${req.user.role}).`);
    // Add logic to prevent users from deleting themselves
    if (req.user.id === parseInt(id, 10)) {
        console.log(`[DELETE /api/users/:id] User ${req.user.id} attempted to delete own account.`);
        return res.status(400).json({ error: "You cannot delete your own account." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Check if user to be deleted is super_admin and if there's only one left
        const userToDeleteRes = await client.query('SELECT role FROM users WHERE user_id = $1', [id]);
        if (userToDeleteRes.rows.length > 0 && userToDeleteRes.rows[0].role === 'super_admin') {
            const superAdminsCountRes = await client.query("SELECT COUNT(*) FROM users WHERE role = 'super_admin'");
            if (parseInt(superAdminsCountRes.rows[0].count, 10) === 1) {
                console.log(`[DELETE /api/users/:id] Cannot delete last super_admin.`);
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Cannot delete the last Super Admin. Create another Super Admin first.' });
            }
        }
        
        // Delete associated onboarding tasks
        await client.query('DELETE FROM onboarding_tasks WHERE user_id = $1', [id]);
        console.log(`[DELETE /api/users/:id] Deleted onboarding tasks for user ${id}.`);

        // Reassign or nullify references in other tables (e.g., shifts, job applications if applicable)
        // For shifts: if employee_id is a foreign key, either delete shifts or set employee_id to NULL.
        // For now, let's assume cascade delete or no strict FK constraint for testing.
        // For job applications: If applicants are tied to users, handle similarly.

        const result = await client.query('DELETE FROM users WHERE user_id = $1 RETURNING user_id', [id]);
        if (result.rowCount === 0) {
            console.log(`[DELETE /api/users/:id] User ${id} not found for deletion.`);
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found.' });
        }
        console.log(`[DELETE /api/users/:id] User ${id} deleted successfully.`);
        await client.query('COMMIT');
        res.status(204).send(); // No content
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[DELETE /api/users/:id] Error deleting user ${id}:`, err);
        res.status(500).json({ error: 'Failed to delete user.' });
    } finally {
        client.release();
    }
});

// --- Locations Routes ---
apiRoutes.get('/locations', isAuthenticated, async (req, res) => {
    console.log(`[GET /api/locations] Received request. User ID: ${req.user.id}, Role: ${req.user.role}.`);
    try {
        let query = 'SELECT location_id, location_name, location_address FROM locations ORDER BY location_name';
        const params = [];
        // location_admin can only see their own location
        if (req.user.role === 'location_admin') {
            query = 'SELECT location_id, location_name, location_address FROM locations WHERE location_id = $1 ORDER BY location_name';
            params.push(req.user.location_id);
            console.log(`[GET /api/locations] Filtering by location_admin's own location: ${req.user.location_id}`);
        } else {
            console.log(`[GET /api/locations] Super admin fetching all locations.`);
        }
        const result = await pool.query(query, params);
        console.log(`[GET /api/locations] Query successful, returning ${result.rows.length} locations.`);
        res.json(result.rows);
    } catch (err) {
        console.error(`[Locations] Error retrieving locations:`, err);
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});

apiRoutes.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
    const { location_name, location_address } = req.body;
    console.log(`[POST /api/locations] Received request to create location: ${location_name}`);
    if (!location_name || !location_address) {
        console.log('[POST /api/locations] Missing location name or address, sending 400.');
        return res.status(400).json({ error: 'Location name and address are required.' });
    }
    try {
        const result = await pool.query('INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING *', [location_name, location_address]);
        console.log(`[POST /api/locations] Location "${location_name}" created successfully.`);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(`[Locations] Error adding new location ${location_name}:`, err);
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Location name already exists.' });
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
        // Before deleting a location, check for associated users or shifts
        const usersAtLocation = await client.query('SELECT user_id FROM users WHERE location_id = $1', [id]);
        if (usersAtLocation.rows.length > 0) {
            console.log(`[DELETE /api/locations/:id] Cannot delete location ${id}: ${usersAtLocation.rows.length} users are still assigned.`);
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Cannot delete location. ${usersAtLocation.rows.length} users are still assigned to it.` });
        }
        const shiftsAtLocation = await client.query('SELECT id FROM shifts WHERE location_id = $1', [id]);
        if (shiftsAtLocation.rows.length > 0) {
            console.log(`[DELETE /api/locations/:id] Cannot delete location ${id}: ${shiftsAtLocation.rows.length} shifts are associated.`);
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Cannot delete location. ${shiftsAtLocation.rows.length} shifts are associated with it.` });
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


// --- Business Settings Endpoint ---
apiRoutes.get('/settings/business', isAuthenticated, async (req, res) => {
    let targetLocationId = req.user.role === 'super_admin' ? req.query.location_id : req.user.location_id;
    console.log(`[GET /api/settings/business] Received request. User Role: ${req.user.role}, Target Location ID: ${targetLocationId}.`);
    if (!targetLocationId && req.user.role !== 'super_admin') { // Super admin can get global settings if needed, but per-location is typical
        console.log('[GET /api/settings/business] No targetLocationId for location_admin, returning null hours.');
        return res.json({ operating_hours_start: null, operating_hours_end: null });
    }
    try {
        // If super_admin and no location_id specified, fetch a global/default, or for the first location
        const queryLocationId = targetLocationId || (req.user.role === 'super_admin' ? (await pool.query('SELECT location_id FROM locations LIMIT 1')).rows[0]?.location_id : null);
        if (!queryLocationId) {
            console.log('[GET /api/settings/business] No effective location to fetch settings for.');
            return res.json({ operating_hours_start: null, operating_hours_end: null });
        }
        const result = await pool.query('SELECT operating_hours_start, operating_hours_end FROM business_settings WHERE location_id = $1', [queryLocationId]);
        console.log(`[GET /api/settings/business] Query successful for location ${queryLocationId}. Result:`, result.rows[0] || 'No settings found.');
        res.json(result.rows[0] || { operating_hours_start: null, operating_hours_end: null });
    } catch (err) {
        console.error(`[GET /api/settings/business] Error fetching business settings:`, err);
        res.status(500).json({ error: 'Failed to retrieve business settings.' });
    }
});

apiRoutes.put('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    const { operating_hours_start, operating_hours_end, location_id: requestedLocationId } = req.body;
    let targetLocationId = req.user.role === 'super_admin' ? requestedLocationId : req.user.location_id;
    console.log(`[PUT /api/settings/business] Request to update. User Role: ${req.user.role}, Target Location ID: ${targetLocationId}.`);

    if (!targetLocationId) {
        console.log('[PUT /api/settings/business] Missing targetLocationId, sending 400.');
        return res.status(400).json({ error: 'A valid location must be specified or associated with the user.' });
    }
    if (!operating_hours_start || !operating_hours_end) {
        console.log('[PUT /api/settings/business] Missing start or end operating hours, sending 400.');
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
        console.error(`[PUT /api/settings/business] Error updating business settings:`, err);
        res.status(500).json({ error: 'Failed to update business settings.' });
    }
});

// Shift Management Routes
apiRoutes.get('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { startDate, endDate, location_id } = req.query;
    console.log(`[GET /api/shifts] Request received. User ID: ${req.user.id}, Role: ${req.user.role}. Query params: startDate=${startDate}, endDate=${endDate}, location_id=${location_id}.`);
    
    if (!startDate || !endDate) {
        console.log('[GET /api/shifts] Missing startDate or endDate, sending 400.');
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

        // Determine the effective location_id for filtering based on user role and query params
        let effectiveLocationId = null;
        if (req.user.role === 'super_admin') {
            effectiveLocationId = location_id; // Super admin can view any location provided in query
            console.log(`[GET /api/shifts] Super admin viewing location_id from query: ${effectiveLocationId}.`);
        } else if (req.user.role === 'location_admin') {
            effectiveLocationId = req.user.location_id; // Location admin is restricted to their assigned location
            console.log(`[GET /api/shifts] Location admin viewing assigned location_id: ${effectiveLocationId}.`);
        } else {
            console.log(`[GET /api/shifts] Non-admin user attempting to view shifts, access denied.`);
            return res.status(403).json({ error: 'Access denied.' }); // Should be caught by isAdmin, but defensive
        }

        if (effectiveLocationId) {
            query += ` AND s.location_id = $${paramIndex++}`;
            params.push(effectiveLocationId);
        } else if (req.user.role === 'super_admin' && !effectiveLocationId) {
            // If super_admin but no location_id is provided, fetch all shifts (no location filter)
            console.log(`[GET /api/shifts] Super admin fetching shifts for ALL locations (no location_id provided in query).`);
            // No additional WHERE clause needed
        }
        
        query += ' ORDER BY s.start_time ASC';
        
        console.log(`[GET /api/shifts] Executing SQL query: "${query}" with params: [${params.join(', ')}]`);
        const result = await pool.query(query, params);
        console.log(`[GET /api/shifts] Query successful, returning ${result.rows.length} shifts.`);
        // console.log(`[GET /api/shifts] Returned shifts data:`, result.rows); // Optional: log full data, can be verbose
        res.json(result.rows);
    } catch (err) {
        console.error(`[Shifts] Error retrieving shifts:`, err);
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});

apiRoutes.post('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    console.log(`[POST /api/shifts] Received data from client. Employee ID: ${employee_id}, Location ID: ${location_id}, Start: ${start_time}, End: ${end_time}.`);
    
    if (!employee_id || !location_id || !start_time || !end_time) {
        console.log('[POST /api/shifts] Missing required fields, sending 400.');
        return res.status(400).json({ error: 'Employee, location, start time, and end time are required.' });
    }
    // Basic backend validation for date order
    if (new Date(start_time) >= new Date(end_time)) {
        console.log('[POST /api/shifts] End time is not after start time, sending 400.');
        return res.status(400).json({ error: 'End time must be after start time.' });
    }

    // Location Admin specific check for POSTing shifts
    if (req.user.role === 'location_admin' && String(req.user.location_id) !== String(location_id)) {
        console.log(`[POST /api/shifts] Location Admin ${req.user.id} tried to post to location ${location_id} but is assigned to ${req.user.location_id}. Access denied.`);
        return res.status(403).json({ error: 'Location Admin can only create shifts for their assigned location.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [employee_id, location_id, start_time, end_time, notes]
        );
        console.log('[POST /api/shifts] Shift created successfully in DB:', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(`[Shifts] Error creating shift:`, err);
        res.status(500).json({ error: 'Failed to create shift.' });
    }
});

apiRoutes.delete('/shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE /api/shifts/:id] Request received for ID: ${id}. By user ${req.user.id} (${req.user.role}).`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Check if user has permission to delete this shift (location_admin can only delete shifts from their location)
        if (req.user.role === 'location_admin') {
            const shiftRes = await client.query('SELECT location_id FROM shifts WHERE id = $1', [id]);
            if (shiftRes.rows.length === 0) {
                console.log(`[DELETE /api/shifts/:id] Shift ${id} not found.`);
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
            console.log(`[DELETE /api/shifts/:id] Shift ID ${id} not found.`);
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Shift not found.' });
        }
        console.log(`[DELETE /api/shifts/:id] Shift ID ${id} deleted successfully.`);
        await client.query('COMMIT');
        res.status(204).send(); // No content
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

// --- Server Startup ---
const startServer = async () => {
    try {
        // Attempt to connect to the database to verify credentials before starting server
        const client = await pool.connect();
        console.log('--- DATABASE: Connected to PostgreSQL! ---'); // Clear success message
        client.release(); // Release client back to the pool immediately after testing connection

        // Start Express server after successful DB connection
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Access your app at: http://localhost:${PORT} (if local) or your Render URL.`);
        });

    } catch (err) {
        console.error('CRITICAL ERROR: Failed to start server and connect to database:', err.stack); // Enhanced error message
        process.exit(1); // Exit process if database connection fails
    }
};

startServer(); // Initiate server startup