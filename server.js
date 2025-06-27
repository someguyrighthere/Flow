// server.js

// --- 1. Imports and Setup ---
const express = require('express');
const { Pool } = require('pg');
const cors =require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Import new modular routes
const autoScheduleRoutes = require('./routes/autoScheduleRoutes');

// --- 2. Initialize Express App ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

// --- 3. Database Connection ---
if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
}
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- 4. Middleware ---
app.use(cors());
app.use(express.json());
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// User, Auth, and Account Routes
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        if (!user || !user.password) return res.status(401).json({ error: "Invalid credentials." });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials." });
        const payload = { id: user.user_id, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ message: "Logged in successfully!", token: token, role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

app.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

app.put('/users/me', isAuthenticated, async (req, res) => {
    const { full_name, email, current_password, new_password } = req.body;
    const userId = req.user.id;
    try {
        if (new_password) {
            if (!current_password) return res.status(400).json({ error: 'Current password is required.' });
            const userRes = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
            const user = userRes.rows[0];
            const isMatch = await bcrypt.compare(current_password, user.password);
            if (!isMatch) return res.status(401).json({ error: 'Incorrect current password.' });
            const newHashedPassword = await bcrypt.hash(new_password, 10);
            await pool.query('UPDATE users SET password = $1 WHERE user_id = $2', [newHashedPassword, userId]);
        }
        await pool.query('UPDATE users SET full_name = $1, email = $2 WHERE user_id = $3', [full_name, email, userId]);
        res.json({ message: 'Profile updated successfully.' });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') return res.status(400).json({ error: 'This email is already in use.' });
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// Admin & Business Settings Routes
app.get('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM business_settings WHERE id = 1');
        if (result.rows.length === 0) {
            return res.json({ operating_hours_start: '09:00', operating_hours_end: '17:00' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve business settings.' });
    }
});

app.post('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    const { operating_hours_start, operating_hours_end } = req.body;
    try {
        const query = `
            INSERT INTO business_settings (id, operating_hours_start, operating_hours_end) 
            VALUES (1, $1, $2)
            ON CONFLICT (id) 
            DO UPDATE SET operating_hours_start = $1, operating_hours_end = $2;
        `;
        await pool.query(query, [operating_hours_start, operating_hours_end]);
        res.json({ message: 'Business settings saved successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save business settings.' });
    }
});

app.get('/locations', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM locations ORDER BY location_name");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});

app.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
    const { location_name, location_address } = req.body;
    try {
        const result = await pool.query(`INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING *`, [location_name, location_address]);
        res.status(201).json(result.rows[0]);
    }  catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Failed to create location.' });
    }
});

app.delete('/locations/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`DELETE FROM locations WHERE location_id = $1`, [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Location not found.' });
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete location.' });
    }
});


app.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    const sql = `SELECT u.user_id, u.full_name, u.email, u.role, u.position, u.employment_type, u.availability, l.location_name FROM users u LEFT JOIN locations l ON u.location_id = l.location_id ORDER BY u.full_name`;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

app.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    if (req.user.id == req.params.id) return res.status(403).json({ error: "You cannot delete your own account." });
    try {
        const result = await pool.query(`DELETE FROM users WHERE user_id = $1`, [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

const inviteUser = async (req, res, role) => {
    const { full_name, email, password, location_id, position, employment_type, availability } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: "All fields are required." });
    try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO users (full_name, email, password, role, position, location_id, employment_type, availability) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [full_name, email, hash, role, position || null, location_id || null, employment_type || null, JSON.stringify(availability) || null]
        );
        res.status(201).json({ message: `${role} invited successfully.`, tempPassword: password }); // Return temp password for display
    } catch (err) {
        console.error('Invite user error:', err);
        if (err.code === '23505') return res.status(400).json({ error: "Email may already be in use." });
        res.status(500).json({ error: "An internal server error occurred." });
    }
};

app.post('/invite-admin', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'location_admin'));
app.post('/invite-employee', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'employee'));

// Scheduling Routes
app.get('/users/availability', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT user_id, full_name, availability FROM users WHERE role = 'employee' AND availability IS NOT NULL");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve employee availability.' });
    }
});

app.get('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start date and end date are required.' });
    // FIX: Removed AT TIME ZONE from here. PostgreSQL will return TIMESTAMPTZ in UTC.
    // Frontend will interpret it as local time.
    const sql = `
        SELECT s.id, s.start_time, s.end_time, s.notes, u.full_name as employee_name, l.location_name
        FROM shifts s
        JOIN users u ON s.employee_id = u.user_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        WHERE s.start_time >= $1 AND s.start_time < $2
        ORDER BY s.start_time;
    `;
    try {
        const result = await pool.query(sql, [startDate, endDate]);
        res.json(result.rows);
    }  catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});

app.post('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    if (!employee_id || !location_id || !start_time || !end_time) return res.status(400).json({ error: 'Missing required shift information.' });
    
    // DEBUG: Log received start_time and end_time
    console.log("Server received start_time:", start_time);
    console.log("Server received end_time:", end_time);

    try {
        // FIX: Remove AT TIME ZONE from INSERT. Rely on Node.js Date.toISOString() to send UTC.
        // The previous attempt added AT TIME ZONE which could convert it multiple times or based on server timezone.
        // TIMESTAMPTZ always stores UTC. Node.js Date.toISOString() converts local time to UTC automatically.
        // We ensure Node.js is creating Dates in intended local time in autoScheduleRoutes.js.
        await pool.query(
            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
            [employee_id, location_id, start_time, end_time, notes]
        );
        res.status(201).json({ message: 'Shift created successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create shift.' });
    }
});

app.delete('/shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM shifts WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Shift not found.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting shift:', err);
        res.status(500).json({ error: 'Failed to delete shift.' });
    }
});

// RE-ADDED: Use the modular autoScheduleRoutes
autoScheduleRoutes(app, pool, isAuthenticated, isAdmin);


// --- 7. Server Startup Logic ---
const startServer = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        
        const schemaQueries = `
            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                location_name VARCHAR(255) NOT NULL UNIQUE,
                location_address TEXT
            );
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'location_admin', 'employee')),
                position VARCHAR(255),
                employee_id VARCHAR(255) UNIQUE,
                location_id INT,
                employment_type VARCHAR(50),
                availability JSONB,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS shifts (
                id SERIAL PRIMARY KEY,
                employee_id INT NOT NULL,
                location_id INT NOT NULL,
                -- FIX: Change to TIMESTAMP WITHOUT TIME ZONE to store raw time, no timezone interpretation.
                start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
                end_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                notes TEXT,
                FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS business_settings (
                id INT PRIMARY KEY,
                operating_hours_start TIME,
                operating_hours_end TIME
            );
            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                position VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                tasks JSONB NOT NULL,
                structure_type VARCHAR(50) NOT NULL DEFAULT 'single_list',
                time_group_count INT
            );
            CREATE TABLE IF NOT EXISTS onboarding_tasks (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                checklist_id INT,
                description TEXT NOT NULL,
                completed BOOLEAN DEFAULT FALSE,
                document_id INT,
                document_name VARCHAR(255),
                task_order INT,
                group_index INT,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE SET NULL,
                FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS job_postings (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                requirements TEXT,
                location_id INT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS applicants (
                id SERIAL PRIMARY KEY,
                job_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                address TEXT,
                date_of_birth DATE,
                availability VARCHAR(255),
                is_authorized BOOLEAN,
                status VARCHAR(50) DEFAULT 'pending',
                applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS documents (
                document_id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                file_name VARCHAR(255) NOT NULL,
                file_path TEXT NOT NULL,
                mime_type VARCHAR(255),
                size BIGINT,
                uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );
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
