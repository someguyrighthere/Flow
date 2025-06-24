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

// --- 2. Initialize Express App ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

// --- Multer Setup for File Uploads ---
const uploadDir = 'uploads';
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

// --- 3. Database Connection and Initialization ---
if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const initializeDatabase = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        
        // --- ONE-TIME FIX: Drop hiring tables to ensure a clean schema ---
        // This is a temporary measure. REMOVE THESE 2 LINES after a successful deployment.
        await client.query('DROP TABLE IF EXISTS applicants CASCADE;');
        await client.query('DROP TABLE IF EXISTS job_postings CASCADE;');
        console.log("Hiring tables dropped to ensure a fresh start.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                location_name TEXT NOT NULL,
                location_address TEXT
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('super_admin', 'location_admin', 'employee')),
                position TEXT,
                location_id INTEGER,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                position TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                tasks JSONB NOT NULL,
                structure_type TEXT,
                time_group_count INTEGER
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS onboarding_sessions (
                session_id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE,
                checklist_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'Active',
                tasks_status JSONB,
                start_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS documents (
                document_id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS job_postings (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                requirements TEXT,
                location_id INTEGER,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS applicants (
                id SERIAL PRIMARY KEY,
                job_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'Applied',
                applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE
            );
        `);
        
        console.log("Database schema verified.");
        
    } catch (err) {
        console.error('Error connecting to or initializing PostgreSQL database:', err.stack);
        process.exit(1);
    } finally {
        if (client) client.release();
    }
};

// --- 4. Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


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
    res.sendFile(__dirname + '/index.html');
});

// Hiring Routes
app.post('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const { title, description, requirements, location_id } = req.body;
    if (!title || !description) return res.status(400).json({error: 'Title and description are required.'});
    try {
        const result = await pool.query(
            `INSERT INTO job_postings (title, description, requirements, location_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [title, description, requirements, location_id || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});

app.get('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const sql = `
        SELECT jp.*, l.location_name, COUNT(a.id) as applicant_count
        FROM job_postings jp
        LEFT JOIN locations l ON jp.location_id = l.location_id
        LEFT JOIN applicants a ON jp.id = a.job_id
        GROUP BY jp.id, l.location_name
        ORDER BY jp.created_at DESC;
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching job postings:", err);
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});

app.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM job_postings WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Job posting not found.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});

app.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    let query = `
        SELECT a.*, jp.title as job_title
        FROM applicants a
        JOIN job_postings jp ON a.job_id = jp.id
    `;
    const filters = [];
    const values = [];
    let counter = 1;

    if (req.query.jobId) {
        filters.push(`a.job_id = $${counter++}`);
        values.push(req.query.jobId);
    }
    if (req.query.status) {
        filters.push(`a.status = $${counter++}`);
        values.push(req.query.status);
    }

    if (filters.length > 0) {
        query += ' WHERE ' + filters.join(' AND ');
    }
    query += ' ORDER BY a.applied_at DESC;';

    try {
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching applicants:", err);
        res.status(500).json({ error: 'Failed to retrieve applicants.' });
    }
});

app.post('/apply/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });

    try {
        await pool.query(
            'INSERT INTO applicants (job_id, name, email) VALUES ($1, $2, $3)',
            [jobId, name, email]
        );
        res.status(201).json({ message: 'Application submitted successfully!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});


// Document Management Routes
app.post('/documents', isAuthenticated, isAdmin, upload.single('document'), async (req, res) => {
    const { title, description } = req.body;
    const { filename, path: filePath, mimetype } = req.file;
    if (!title || !req.file) return res.status(400).json({ error: 'Title and file are required.' });
    try {
        const result = await pool.query(
            `INSERT INTO documents (title, description, file_name, file_path, mime_type) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [title, description, filename, filePath, mimetype]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save document information.' });
    }
});

app.get('/documents', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM documents ORDER BY uploaded_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});

app.delete('/documents/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const docRes = await pool.query('SELECT file_path FROM documents WHERE document_id = $1', [id]);
        if (docRes.rows.length === 0) return res.status(404).json({ error: 'Document not found.' });
        const filePath = docRes.rows[0].file_path;
        await pool.query('DELETE FROM documents WHERE document_id = $1', [id]);
        fs.unlink(filePath, (err) => {
            if (err) console.error(`Failed to delete file from disk: ${filePath}`, err);
        });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete document.' });
    }
});


// User and Auth Routes
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
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

app.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

app.put('/users/me', isAuthenticated, async (req, res) => {
    const { full_name, email, current_password, new_password } = req.body;
    const userId = req.user.id;
    try {
        if (new_password) {
            if (!current_password) return res.status(400).json({ error: 'Current password is required to set a new password.' });
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
        if (err.code === '23505') return res.status(400).json({ error: 'This email is already in use by another account.' });
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});


// Onboarding and Position Routes
app.get('/positions', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, position, title FROM checklists');
        const positions = result.rows.map(row => ({ id: row.id, name: `${row.position} - ${row.title}` }));
        res.json({ positions });
    } catch(err) {
        res.status(500).json({ error: "Failed to load positions." });
    }
});

app.get('/onboarding-sessions', isAuthenticated, isAdmin, async (req, res) => {
    const sql = `
        SELECT 
            s.session_id, u.user_id, u.full_name, u.email, c.position, s.tasks_status,
            (SELECT COUNT(*) FROM jsonb_array_elements(c.tasks)) as total_tasks,
            (SELECT COUNT(*) FROM jsonb_to_recordset(s.tasks_status) as x(description text, completed boolean) WHERE completed = true) as completed_tasks
        FROM onboarding_sessions s
        JOIN users u ON s.user_id = u.user_id
        JOIN checklists c ON s.checklist_id = c.id
        ORDER BY s.start_date DESC;
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load onboarding sessions.' });
    }
});

app.post('/onboard-employee', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, position_id } = req.body;
    if (!full_name || !email || !position_id) {
        return res.status(400).json({ error: 'Full name, email, and position are required.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const userRes = await client.query(
            `INSERT INTO users (full_name, email, password, role, position) VALUES ($1, $2, $3, 'employee', (SELECT position FROM checklists WHERE id = $4)) RETURNING user_id`,
            [full_name, email, hashedPassword, position_id]
        );
        const newUserId = userRes.rows[0].user_id;
        const checklistRes = await client.query('SELECT tasks FROM checklists WHERE id = $1', [position_id]);
        if (checklistRes.rows.length === 0) throw new Error('Checklist not found.');
        const tasks = checklistRes.rows[0].tasks;
        const initialTasksStatus = tasks.map(task => ({ ...task, completed: false }));
        await client.query(
            `INSERT INTO onboarding_sessions (user_id, checklist_id, tasks_status) VALUES ($1, $2, $3)`,
            [newUserId, position_id, JSON.stringify(initialTasksStatus)]
        );
        await client.query('COMMIT');
        console.log(`Onboarding invite for ${email} complete. Temporary password: ${tempPassword}`);
        res.status(201).json({ message: 'Onboarding started successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(400).json({ error: 'This email address is already in use.' });
        res.status(500).json({ error: 'An error occurred during the onboarding process.' });
    } finally {
        client.release();
    }
});

// Checklist Routes
app.get('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM checklists ORDER BY position');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve checklists.' });
    }
});

app.post('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    const { position, title, tasks, structure_type, time_group_count } = req.body;
    if (!position || !title || !tasks || !Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Position, title, and a valid tasks array are required.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO checklists (position, title, tasks, structure_type, time_group_count) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [position, title, JSON.stringify(tasks), structure_type, time_group_count]
        );
        res.status(201).json({ id: result.rows[0].id, message: 'Checklist created successfully' });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'A checklist for this position already exists.' });
        res.status(500).json({ error: 'Failed to create checklist.' });
    }
});

app.delete('/checklists/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const usageCheck = await pool.query('SELECT COUNT(*) FROM onboarding_sessions WHERE checklist_id = $1', [id]);
        if (usageCheck.rows[0].count > 0) {
            return res.status(409).json({ error: `Cannot delete: This task list is assigned to ${usageCheck.rows[0].count} onboarding session(s).` });
        }
        const result = await pool.query('DELETE FROM checklists WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Checklist not found.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete checklist.' });
    }
});


// Location Management Routes
app.get('/locations', isAuthenticated, isAdmin, (req, res) => { pool.query("SELECT * FROM locations").then(r => res.json(r.rows)).catch(err => res.status(500).json({error:err.message}))});
app.post('/locations', isAuthenticated, isAdmin, (req, res) => {
    const { location_name, location_address } = req.body;
    pool.query(`INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING location_id`, [location_name, location_address])
        .then(r => res.status(201).json({ id: r.rows[0].location_id, location_name, location_address }))
        .catch(err => res.status(400).json({ error: err.message }));
});
app.delete('/locations/:id', isAuthenticated, isAdmin, (req, res) => {
    pool.query(`DELETE FROM locations WHERE location_id = $1`, [req.params.id])
        .then(r => r.rowCount === 0 ? res.status(404).json({error:'Location not found.'}) : res.status(204).send())
        .catch(err => res.status(500).json({ error: err.message }));
});

// User Management Routes
app.get('/users', isAuthenticated, isAdmin, (req, res) => {
    pool.query(`SELECT u.user_id, u.full_name, u.email, u.role, u.position, l.location_name FROM users u LEFT JOIN locations l ON u.location_id = l.location_id`)
        .then(r => res.json(r.rows))
        .catch(err => res.status(500).json({ error: err.message }));
});
app.delete('/users/:id', isAuthenticated, isAdmin, (req, res) => {
    if (req.user.id == req.params.id) return res.status(403).json({ error: "You cannot delete your own account." });
    pool.query(`DELETE FROM users WHERE user_id = $1`, [req.params.id])
        .then(r => r.rowCount === 0 ? res.status(404).json({error:'User not found.'}) : res.status(204).send())
        .catch(err => res.status(500).json({ error: err.message }));
});
const inviteUser = async (req, res, role) => {
    const { full_name, email, password, location_id, position } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: "Full name, email, and password are required." });
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(`INSERT INTO users (full_name, email, password, role, position, location_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id`, [full_name, email, hash, role, position || null, location_id || null]);
        res.status(201).json({ id: result.rows[0].user_id });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: "Email may already be in use." });
        res.status(500).json({ error: "An internal server error occurred." });
    }
};
app.post('/invite-admin', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'location_admin'));
app.post('/invite-employee', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'employee'));


// --- 7. Start Server ---
const startServer = async () => {
    try {
        await initializeDatabase();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
};

startServer();
