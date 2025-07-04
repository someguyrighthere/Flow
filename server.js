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
    process.exit(1); // Exit process if no database URL
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