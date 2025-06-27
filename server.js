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
const autoScheduleRoutes = require('./routes/autoScheduleRoutes'); // NEW: Import auto-scheduling routes

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

// Routes for Onboarding Dashboard (dashboard.html)
app.get('/positions', isAuthenticated, async (req, res) => {
    try {
        // Fetch all unique positions from the 'users' table that have associated checklists
        // This query ensures that only positions linked to existing checklists are returned,
        // and provides a distinct list of position names and IDs for dropdowns.
        const result = await pool.query(`
            SELECT DISTINCT u.position AS name, c.id AS id
            FROM users u
            JOIN checklists c ON u.position = c.position
            WHERE u.position IS NOT NULL AND u.position != ''
            ORDER BY u.position
        `);
        res.json({ positions: result.rows });
    } catch (err) {
        console.error('Error fetching positions:', err);
        res.status(500).json({ error: 'Failed to retrieve positions.' });
    }
});

app.post('/onboard-employee', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, position_id, employee_id } = req.body;

    if (!full_name || !email || !position_id) {
        return res.status(400).json({ error: 'Full name, email, and position are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Create a temporary password for the new employee
        const tempPassword = Math.random().toString(36).slice(-8); // Generate a random 8-character password
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // 2. Create the new user (employee)
        const userResult = await client.query(
            `INSERT INTO users (full_name, email, password, role, position, employee_id) VALUES ($1, $2, $3, 'employee', (SELECT position FROM checklists WHERE id = $4), $5) RETURNING user_id;`,
            [full_name, email, hashedPassword, position_id, employee_id || null]
        );
        const newUserId = userResult.rows[0].user_id;

        // 3. Fetch the checklist based on the position_id
        const checklistResult = await client.query('SELECT id, tasks FROM checklists WHERE id = $1;', [position_id]);
        const checklist = checklistResult.rows[0];

        if (!checklist) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'No checklist found for the specified position.' });
        }

        // 4. Insert tasks into onboarding_tasks table
        // Iterate through tasks and insert them
        for (const task of checklist.tasks) {
            await client.query(
                `INSERT INTO onboarding_tasks (user_id, checklist_id, description, completed, document_id, document_name, task_order, group_index)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
                [newUserId, checklist.id, task.description, false, task.documentId || null, task.documentName || null, task.taskOrder || 0, task.groupIndex || 0]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Employee onboarded successfully!', tempPassword: tempPassword, userId: newUserId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during onboarding:', err);
        if (err.code === '23505') { // Unique violation (e.g., duplicate email or employee_id)
            return res.status(400).json({ error: 'Email or Employee ID already exists.' });
        }
        res.status(500).json({ error: 'An error occurred during onboarding.' });
    } finally {
        client.release();
    }
});

app.get('/onboarding-sessions', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const sessionsQuery = `
            SELECT
                u.user_id,
                u.full_name,
                u.email,
                u.position,
                COUNT(ot.id) AS totalTasks,
                COUNT(CASE WHEN ot.completed = TRUE THEN 1 END) AS completedTasks
            FROM users u
            LEFT JOIN onboarding_tasks ot ON u.user_id = ot.user_id
            WHERE u.role = 'employee'
            GROUP BY u.user_id, u.full_name, u.email, u.position
            ORDER BY u.full_name;
        `;
        const result = await pool.query(sessionsQuery);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching onboarding sessions:', err);
        res.status(500).json({ error: 'Failed to retrieve onboarding sessions.' });
    }
});


// Onboarding Task Routes (for new-hire-view.html)
app.get('/onboarding-tasks/:userId', isAuthenticated, async (req, res) => {
    const { userId } = req.params;

    // Security check: Ensure the user can only view their own tasks, or an admin can view any
    if (req.user.id != userId && req.user.role !== 'super_admin' && req.user.role !== 'location_admin') {
        return res.status(403).json({ error: 'Access denied. You can only view your own onboarding tasks.' });
    }

    try {
        const userQuery = await pool.query('SELECT full_name, position FROM users WHERE user_id = $1', [userId]);
        const user = userQuery.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const tasksQuery = `
            SELECT
                ot.id,
                ot.description,
                ot.completed,
                ot.document_id,
                ot.document_name,
                ot.task_order,
                ot.group_index,
                c.structure_type,
                c.time_group_count,
                c.title AS checklist_title
            FROM onboarding_tasks ot
            JOIN users u ON ot.user_id = u.user_id
            LEFT JOIN checklists c ON ot.checklist_id = c.id
            WHERE ot.user_id = $1
            ORDER BY ot.group_index, ot.task_order;
        `;
        const tasksResult = await pool.query(tasksQuery, [userId]);
        res.json({ user: { full_name: user.full_name, position: user.position }, tasks: tasksResult.rows });

    } catch (err) {
        console.error('Error fetching onboarding tasks:', err);
        res.status(500).json({ error: 'Failed to retrieve onboarding tasks.' });
    }
});

app.put('/onboarding-tasks/:taskId/complete', isAuthenticated, async (req, res) => {
    const { taskId } = req.params;
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
        return res.status(400).json({ error: 'Invalid completion status provided.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // First, get the task to check ownership (security) and current status
        const taskQuery = await client.query('SELECT user_id, completed FROM onboarding_tasks WHERE id = $1', [taskId]);
        const task = taskQuery.rows[0];

        if (!task) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Task not found.' });
        }

        // Security check: Only the owner or an admin can update the task
        if (req.user.id !== task.user_id && req.user.role !== 'super_admin' && req.user.role !== 'location_admin') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Access denied. You can only update your own tasks.' });
        }

        // Update task status
        await client.query('UPDATE onboarding_tasks SET completed = $1 WHERE id = $2', [completed, taskId]);

        await client.query('COMMIT');
        res.json({ message: 'Task status updated successfully!' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating task status:', err);
        res.status(500).json({ error: 'Failed to update task status.' });
    } finally {
        client.release();
    }
});


// Checklist Routes
app.get('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM checklists ORDER BY position, title');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching checklists:', err);
        res.status(500).json({ error: 'Failed to retrieve checklists.' });
    }
});

app.post('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    const { position, title, tasks, structure_type, time_group_count } = req.body;

    if (!position || !title || !Array.isArray(tasks) || tasks.length === 0) {
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

app.delete('/checklists/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`DELETE FROM checklists WHERE id = $1`, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Checklist not found.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting checklist:', err);
        res.status(500).json({ error: 'Failed to delete checklist.' });
    }
});

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
            LEFT JOIN applicants a ON jp.id = a.job_posting_id
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
        await pool.query(
            `INSERT INTO applicants (job_posting_id, name, email, phone, address, date_of_birth, availability, is_authorized) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
        JOIN job_postings jp ON a.job_posting_id = jp.id
        LEFT JOIN locations l ON jp.location_id = l.location_id
        WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (jobId) {
        sql += ` AND a.job_posting_id = $${paramIndex++}`;
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
            JOIN job_postings jp ON a.job_posting_id = jp.id
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
            if (err) console.error('Error deleting file from disk:', err);
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
