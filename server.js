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
const onboardingRoutes = require('./routes/onboardingRoutes'); 

// --- 2. Initialize Express App ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

// --- Multer Storage Setup (for document uploads) ---
const uploadsDir = path.join(__dirname, 'uploads');
// Ensure the uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Use original filename with a timestamp to prevent collisions
        cb(null, `${Date.now()}-${file.originalname}`);
    }
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
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files statically
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
        const result = await pool.query(`INSERT INTO locations (location_name, location_address) RETURNING *`, [location_name, location_address]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
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
        res.status(201).json({ message: `${role} invited successfully.` });
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
        console.error('Error fetching employee availability:', err);
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
    } catch (err) {
        console.error('Error retrieving shifts:', err);
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});

app.post('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    if (!employee_id || !location_id || !start_time || !end_time) return res.status(400).json({ error: 'Missing required shift information.' });
    try {
        await pool.query(
            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
            [employee_id, location_id, start_time, end_time, notes]
        );
        res.status(201).json({ message: 'Shift created successfully.' });
    } catch (err) {
        console.error('Error creating shift:', err);
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


// Document Management Routes
app.get('/documents', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT document_id, user_id, title, description, file_name, file_path, mime_type, size, uploaded_at FROM documents ORDER BY uploaded_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching documents:', err);
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});

app.post('/documents', isAuthenticated, upload.single('documentFile'), async (req, res) => {
    const { title, description, userId } = req.body; 
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    if (!title) {
        fs.unlink(file.path, (err) => { if (err) console.error('Error deleting uploaded file:', err); });
        return res.status(400).json({ error: 'Document title is required.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO documents (user_id, title, description, file_name, file_path, mime_type, size) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.user.id, title, description, file.originalname, file.path, file.mimetype, file.size]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error uploading document:', err);
        fs.unlink(file.path, (unlinkErr) => { if (unlinkErr) console.error('Error deleting uploaded file after DB fail:', unlinkErr); });
        res.status(500).json({ error: 'Failed to upload document.' });
    }
});

app.delete('/documents/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const fileRes = await pool.query('SELECT file_path FROM documents WHERE document_id = $1', [id]);
        if (fileRes.rows.length === 0) { return res.status(404).json({ error: 'Document not found.' }); }
        const filePathToDelete = fileRes.rows[0].file_path;

        const deleteRes = await pool.query('DELETE FROM documents WHERE document_id = $1', [id]);
        if (deleteRes.rowCount === 0) { return res.status(404).json({ error: 'Document not found in DB after check.' }); }

        fs.unlink(filePathToDelete, (err) => { if (err) { console.error('Error deleting physical file:', filePathToDelete, err); } });
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting document:', err);
        res.status(500).json({ error: 'Failed to delete document.' });
    }
});


// Job Postings Routes
app.get('/job-postings', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM job_postings ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching job postings:', err);
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});

app.post('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const { title, description, requirements, location_id } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Title and description are required.' });
    try {
        const result = await pool.query(
            `INSERT INTO job_postings (title, description, requirements, location_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [title, description, requirements, location_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating job posting:', err);
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});

app.put('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, description, requirements, location_id } = req.body;
    try {
        const result = await pool.query(
            'UPDATE job_postings SET title = $1, description = $2, requirements = $3, location_id = $4 WHERE id = $5 RETURNING *',
            [title, description, requirements, location_id, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Job posting not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating job posting:', err);
        res.status(500).json({ error: 'Failed to update job posting.' });
    }
});

app.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM job_postings WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Job posting not found.' });
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting job posting:', err);
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});


// Applicants Routes
app.post('/applicants', upload.none(), async (req, res) => { 
    const { job_posting_id, name, email, phone, address, date_of_birth, availability, is_authorized } = req.body;
    if (!job_posting_id || !name || !email) return res.status(400).json({ error: 'Job posting ID, name, and email are required.' });
    try {
        const availabilityJson = availability ? JSON.stringify(availability) : null;
        
        const result = await pool.query(
            `INSERT INTO applicants (job_posting_id, name, email, phone, address, date_of_birth, availability, is_authorized) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [job_posting_id, name, email, phone || null, address || null, date_of_birth || null, availabilityJson, is_authorized || false]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error submitting application:', err);
        if (err.code === '23503') return res.status(400).json({ error: 'Job posting not found (Foreign Key constraint).' });
        if (err.code === '23502') return res.status(400).json({ error: 'Missing required fields for applicant.' });
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});

app.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const sql = `
            SELECT a.*, jp.title as job_title
            FROM applicants a
            JOIN job_postings jp ON a.job_posting_id = jp.id
            ORDER BY a.applied_at DESC;
        `;
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching applicants:', err);
        res.status(500).json({ error: 'Failed to retrieve applicants.' });
    }
});

app.put('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, is_authorized } = req.body; 
    try {
        const result = await pool.query(
            `UPDATE applicants SET status = $1, is_authorized = $2 WHERE id = $3 RETURNING *`,
            [status, is_authorized, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Applicant not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating applicant:', err);
        res.status(500).json({ error: 'Failed to update applicant.' });
    }
});

app.delete('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM applicants WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Applicant not found.' });
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting applicant:', err);
        res.status(500).json({ error: 'Failed to delete applicant.' });
    }
});


// Checklist Routes
app.post('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    const { position, title, tasks, structure_type, time_group_count } = req.body;
    if (!position || !title || !tasks || tasks.length === 0) {
        return res.status(400).json({ error: 'Position, title, and at least one task are required.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO checklists (position, title, tasks, structure_type, time_group_count) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [position, title, JSON.stringify(tasks), structure_type, time_group_count]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating checklist:', err);
        res.status(500).json({ error: 'Failed to create checklist.' });
    }
});

app.get('/checklists', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM checklists ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching checklists:', err);
        res.status(500).json({ error: 'Failed to retrieve checklists.' });
    }
});

app.put('/checklists/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { position, title, tasks, structure_type, time_group_count } = req.body;
    if (!position || !title || !tasks || tasks.length === 0) {
        return res.status(400).json({ error: 'Position, title, and at least one task are required.' });
    }
    try {
        const result = await pool.query(
            `UPDATE checklists SET position = $1, title = $2, tasks = $3, structure_type = $4, time_group_count = $5 WHERE id = $6 RETURNING *`,
            [position, title, JSON.stringify(tasks), structure_type, time_group_count, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Checklist not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating checklist:', err);
        res.status(500).json({ error: 'Failed to update checklist.' });
    }
});

app.delete('/checklists/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM checklists WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Checklist not found.' });
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting checklist:', err);
        res.status(500).json({ error: 'Failed to delete checklist.' });
    }
});


// Onboarding Tasks API
app.post('/onboarding-tasks', isAuthenticated, isAdmin, async (req, res) => {
    const { user_id, checklist_id } = req.body;
    if (!user_id || !checklist_id) {
        return res.status(400).json({ error: 'User ID and Checklist ID are required.' });
    }

    const client = await pool.connect(); 
    try {
        const existingAssignment = await client.query(
            'SELECT * FROM onboarding_tasks WHERE user_id = $1 AND checklist_id = $2',
            [user_id, checklist_id]
        );
        if (existingAssignment.rows.length > 0) {
            await client.query('ROLLBACK'); 
            return res.status(409).json({ error: 'This task list is already assigned to this user.' });
        }

        const checklistRes = await client.query('SELECT tasks FROM checklists WHERE id = $1', [checklist_id]);
        if (checklistRes.rows.length === 0) {
            await client.query('ROLLBACK'); 
            return res.status(404).json({ error: 'Checklist not found.' });
        }
        const tasks = checklistRes.rows[0].tasks;

        await client.query('BEGIN'); 

        for (const [index, task] of tasks.entries()) {
            await client.query(
                `INSERT INTO onboarding_tasks (user_id, checklist_id, description, completed, document_id, document_name, task_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [user_id, checklist_id, task.description, false, task.documentId || null, task.documentName || null, index + 1]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({ message: 'Task list assigned successfully.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error assigning onboarding tasks:', err);
        res.status(500).json({ error: 'Failed to assign onboarding tasks.' });
    } finally {
        client.release(); 
    }
});

app.get('/onboarding-tasks', isAuthenticated, async (req, res) => {
    const { user_id } = req.query; 
    try {
        let query = `
            SELECT ot.*, u.full_name as user_name, c.title as checklist_title, c.position as checklist_position
            FROM onboarding_tasks ot
            JOIN users u ON ot.user_id = u.user_id
            JOIN checklists c ON ot.checklist_id = c.id
        `;
        const params = [];
        if (user_id) {
            query += ' WHERE ot.user_id = $1';
            params.push(user_id);
        }
        query += ' ORDER BY ot.id'; 
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching onboarding tasks:', err);
        res.status(500).json({ error: 'Failed to retrieve onboarding tasks.' });
    }
});

// NEW: PUT route for individual onboarding tasks (to mark complete)
app.put('/onboarding-tasks/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { completed } = req.body;
    // Only 'completed' status can be updated from frontend for now.
    // If you need to update description, etc., add those fields to req.body and the query.
    if (typeof completed !== 'boolean') {
        return res.status(400).json({ error: 'Completion status (boolean) is required.' });
    }

    try {
        const result = await pool.query(
            `UPDATE onboarding_tasks SET completed = $1 WHERE id = $2 RETURNING *`,
            [completed, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Onboarding task not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating onboarding task status:', err);
        res.status(500).json({ error: 'Failed to update onboarding task status.' });
    }
});

// Scheduling Routes (now handled by autoScheduleRoutes.js)
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
                job_posting_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                address TEXT,
                date_of_birth DATE,
                availability VARCHAR(255),
                is_authorized BOOLEAN,
                status VARCHAR(50) DEFAULT 'pending',
                applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE CASCADE
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
