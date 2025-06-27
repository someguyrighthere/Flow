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
        // Only fetch employees with availability for scheduling purposes
        const result = await pool.query("SELECT user_id, full_name, availability FROM users WHERE role = 'employee' AND availability IS NOT NULL");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve employee availability.' });
    }
});

app.get('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start date and end date are required.' });
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

// Reverted: Removed autoScheduleRoutes import as it was causing issues and needs full re-evaluation.
// autoScheduleRoutes(app, pool, isAuthenticated, isAdmin);


// Job Posting and Applicant Routes (Hiring Module)
app.post('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const { title, description, requirements, location_id } = req.body;
    if (!title || !description) {
        return res.status(400).json({ error: 'Job title and description are required.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO job_postings (title, description, requirements, location_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [title, description, requirements || null, location_id || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating job posting:', err);
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});

app.get('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                jp.id,
                jp.title,
                jp.description,
                jp.requirements,
                jp.location_id,
                l.location_name,
                COUNT(a.id) AS applicant_count
            FROM job_postings jp
            LEFT JOIN locations l ON jp.location_id = l.location_id
            LEFT JOIN applicants a ON jp.id = a.job_id  -- FIX: Changed a.job_posting_id to a.job_id
            GROUP BY jp.id, jp.title, jp.description, jp.requirements, jp.location_id, l.location_name
            ORDER BY jp.created_at DESC;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching job postings:', err);
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});

app.get('/job-postings/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                jp.id,
                jp.title,
                jp.description,
                jp.requirements,
                l.location_name
            FROM job_postings jp
            LEFT JOIN locations l ON jp.location_id = l.location_id
            WHERE jp.id = $1;
        `, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Job posting not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching single job posting:', err);
        res.status(500).json({ error: 'Failed to retrieve job posting details.' });
    }
});


app.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`DELETE FROM job_postings WHERE id = $1`, [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Job posting not found.' });
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting job posting:', err);
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});

app.post('/apply/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const { name, email, phone, address, date_of_birth, availability, is_authorized } = req.body;

    if (!jobId || !name || !email) {
        return res.status(400).json({ error: 'Job ID, name, and email are required.' });
    }

    try {
        // FIX: Changed job_posting_id to job_id in INSERT statement
        await pool.query(
            `INSERT INTO applicants (job_id, name, email, phone, address, date_of_birth, availability, is_authorized) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [jobId, name, email, phone || null, address || null, date_of_birth || null, availability || null, is_authorized || false]
        );
        res.status(201).json({ message: 'Application submitted successfully!' });
    } catch (err) {
        console.error('Error submitting application:', err);
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});

app.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    const { jobId, status, locationId } = req.query;
    let sql = `
        SELECT
            a.id,
            a.name,
            a.email,
            a.phone,
            a.address,
            a.date_of_birth,
            a.availability,
            a.is_authorized,
            a.status,
            jp.title AS job_title,
            l.location_name
        FROM applicants a
        JOIN job_postings jp ON a.job_id = jp.id  -- FIX: Changed a.job_posting_id to a.job_id
        LEFT JOIN locations l ON jp.location_id = l.location_id
        WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (jobId) {
        sql += ` AND a.job_id = $${paramIndex++}`; // FIX: Changed a.job_posting_id to a.job_id
        params.push(jobId);
    }
    if (status) {
        sql += ` AND a.status = $${paramIndex++}`;
        params.push(status);
    }
    if (locationId) {
        sql += ` AND jp.location_id = $${paramIndex++}`;
        params.push(locationId);
    }

    sql += ` ORDER BY a.applied_at DESC;`;

    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching applicants:', err);
        res.status(500).json({ error: 'Failed to retrieve applicants.' });
    }
});

app.get('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                a.id,
                a.name,
                a.email,
                a.phone,
                a.address,
                a.date_of_birth,
                a.availability,
                a.is_authorized,
                a.status,
                jp.title AS job_title,
                l.location_name
            FROM applicants a
            JOIN job_postings jp ON a.job_id = jp.id  -- FIX: Changed a.job_posting_id to a.job_id
            LEFT JOIN locations l ON jp.location_id = l.location_id
            WHERE a.id = $1;
        `, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Applicant not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching single applicant:', err);
        res.status(500).json({ error: 'Failed to retrieve applicant details.' });
    }
});

app.delete('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`DELETE FROM applicants WHERE id = $1`, [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Applicant not found.' });
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting applicant:', err);
        res.status(500).json({ error: 'Failed to delete applicant.' });
    }
});


// Documents Routes
const upload = multer({ dest: 'uploads/' }); // Files will be stored in an 'uploads' directory

app.post('/documents', isAuthenticated, upload.single('document'), async (req, res) => {
    const { title, description } = req.body;
    const { originalname, filename, path: filepath, mimetype, size } = req.file;
    const userId = req.user.id;

    if (!title || !req.file) {
        return res.status(400).json({ error: 'Title and document file are required.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO documents (user_id, title, description, file_name, file_path, mime_type, size) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [userId, title, description || null, originalname, filepath, mimetype, size]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error uploading document:', err);
        res.status(500).json({ error: 'Failed to upload document.' });
        // Clean up the uploaded file if database insert fails
        fs.unlink(filepath, (unlinkErr) => {
            if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
        });
    }
});

app.get('/documents', isAuthenticated, async (req, res) => {
    // Admins can see all documents, regular users only their own
    const userId = req.user.id;
    const userRole = req.user.role;
    let sql = `SELECT document_id, title, description, file_name, file_path, mime_type, size, uploaded_at FROM documents`;
    const params = [];

    if (userRole === 'employee') {
        sql += ` WHERE user_id = $1`;
        params.push(userId);
    }
    sql += ` ORDER BY uploaded_at DESC;`;

    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching documents:', err);
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});

app.delete('/documents/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const docQuery = await pool.query('SELECT user_id, file_path FROM documents WHERE document_id = $1', [id]);
        const document = docQuery.rows[0];

        if (!document) {
            return res.status(404).json({ error: 'Document not found.' });
        }

        // Security: Only the owner or an admin can delete a document
        if (document.user_id != userId && userRole !== 'super_admin' && userRole !== 'location_admin') {
            return res.status(403).json({ error: 'Access denied. You can only delete your own documents.' });
        }

        // Delete from database
        const deleteResult = await pool.query(`DELETE FROM documents WHERE document_id = $1`, [id]);
        
        // Delete the actual file from the server
        fs.unlink(document.file_path, (err) => {
            if (err) console.error('Error deleting uploaded file:', err);
        });

        if (deleteResult.rowCount === 0) return res.status(404).json({ error: 'Document not found in DB after check.' });
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting document:', err);
        res.status(500).json({ error: 'Failed to delete document.' });
    }
});


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
                start_time TIMESTAMPTZ NOT NULL,
                end_time TIMESTAMPTZ NOT NULL,
                notes TEXT,
                FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS business_settings (
                id INT PRIMARY KEY,
                operating_hours_start TIME,
                operating_hours_end TIME
            );
            -- Schema for job_postings and applicants tables
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
                job_id INT NOT NULL, -- FIX: Changed column name to job_id
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                address TEXT,
                date_of_birth DATE,
                availability VARCHAR(255),
                is_authorized BOOLEAN,
                status VARCHAR(50) DEFAULT 'pending',
                applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE -- FIX: Changed FK to job_id
            );
            -- Other tables (checklists, onboarding_tasks, documents) schema still need to be added
            -- for their respective functionalities to work if they are desired in the future.
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
