// server.js - Backend for Flow Business Suite (Updated for PostgreSQL)
const express = require('express');
const { Pool } = require('pg'); // Import Pool for PostgreSQL
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Replace with a strong, random key in production!

// --- Middleware Setup ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Body parser for JSON payloads
app.use(express.urlencoded({ extended: true })); // Body parser for URL-encoded payloads

// Serve static files from the root directory (where HTML, CSS, JS are)
app.use(express.static(path.join(__dirname, '/')));

// Multer storage for file uploads (documents)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// --- Database Connection (PostgreSQL) ---
// Use Render's DATABASE_URL environment variable for connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Render's managed PostgreSQL
    }
});

pool.on('connect', () => console.log('Connected to PostgreSQL database.'));
pool.on('error', (err) => console.error('Unexpected error on idle client', err));

// Initialize database schema (create tables if they don't exist)
async function initializeDbSchema() {
    try {
        const client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                company_id INTEGER,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'employee', -- 'super_admin', 'location_admin', 'employee'
                location_id INTEGER,
                employee_id TEXT UNIQUE,
                plan_id TEXT DEFAULT 'free',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                company_id INTEGER,
                location_name TEXT NOT NULL,
                location_address TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS positions (
                id SERIAL PRIMARY KEY,
                company_id INTEGER,
                name TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                company_id INTEGER,
                position_id INTEGER, -- Links to positions table
                title TEXT NOT NULL,
                structure_type TEXT NOT NULL, -- 'single_list', 'daily', 'weekly'
                group_count INTEGER DEFAULT 0, -- Number of days/weeks for grouped lists
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS task_groups (
                id SERIAL PRIMARY KEY,
                checklist_id INTEGER,
                title TEXT NOT NULL, -- e.g., "Day 1", "Week 2"
                group_order INTEGER,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                checklist_id INTEGER, -- For single_list tasks directly under checklist
                task_group_id INTEGER, -- For tasks under a task_group
                description TEXT NOT NULL,
                completed BOOLEAN DEFAULT FALSE, -- BOOLEAN type for PostgreSQL
                task_order INTEGER,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
                FOREIGN KEY (task_group_id) REFERENCES task_groups(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS onboarding_sessions (
                session_id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL, -- The new hire's user_id
                company_id INTEGER NOT NULL,
                checklist_id INTEGER NOT NULL,
                start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completion_date TIMESTAMP WITH TIME ZONE,
                status TEXT DEFAULT 'active', -- 'active', 'archived'
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS documents (
                document_id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL, -- Uploader
                title TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                description TEXT,
                upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS job_postings (
                job_posting_id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                requirements TEXT,
                location_id INTEGER, -- Optional: links to locations table
                status TEXT DEFAULT 'Open', -- 'Open', 'Closed'
                created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS applicants (
                applicant_id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                job_posting_id INTEGER NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone_number TEXT,
                resume_path TEXT, -- Path to uploaded resume
                status TEXT DEFAULT 'Applied', -- 'Applied', 'Interviewing', 'Rejected', 'Hired'
                application_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (job_posting_id) REFERENCES job_postings(job_posting_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS schedules (
                schedule_id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL, -- user_id of the employee
                location_id INTEGER NOT NULL,
                start_time TIMESTAMP WITH TIME ZONE NOT NULL,
                end_time TIMESTAMP WITH TIME ZONE NOT NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE
            );
        `);

        // Example: Create a default super admin if none exists
        const adminCheck = await client.query(`SELECT user_id FROM users WHERE role = 'super_admin'`);
        if (adminCheck.rows.length === 0) {
            console.log('No super admin found, creating a default one.');
            const hashedPassword = await bcrypt.hash('adminpassword', 10); // Default password

            // Need to insert into companies first to get a company_id
            const companyResult = await client.query(`INSERT INTO companies (name) VALUES ('Default Company') RETURNING id`);
            const companyId = companyResult.rows[0].id;

            const userResult = await client.query(
                `INSERT INTO users (company_id, full_name, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
                [companyId, 'Super Admin', 'admin@example.com', hashedPassword, 'super_admin']
            );
            console.log(`Default Super Admin created with email admin@example.com and password adminpassword. User ID: ${userResult.rows[0].user_id}`);
        }
        client.release();
    } catch (err) {
        console.error('Error initializing database schema:', err);
    }
}

initializeDbSchema();

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication token required.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err);
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = user; // Attach user payload to request
        next();
    });
};

// --- Helper function for PostgreSQL queries ---
// These will now use the pg Pool
const dbRun = async (query, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        // For INSERT/UPDATE/DELETE, result.rowCount can be used to check success
        return result;
    } finally {
        client.release();
    }
};

const dbGet = async (query, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        return result.rows[0]; // Return the first row for single results
    } finally {
        client.release();
    }
};

const dbAll = async (query, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        return result.rows; // Return all rows for multiple results
    } finally {
        client.release();
    }
};

// --- API Routes ---

// User Authentication & Profile
app.post('/api/register', async (req, res) => {
    const { company_name, full_name, email, password } = req.body;
    let client; // Declare client here for transaction scope
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        client = await pool.connect();
        await client.query('BEGIN');

        const companyResult = await client.query(`INSERT INTO companies (name) VALUES ($1) RETURNING id`, [company_name]);
        const companyId = companyResult.rows[0].id;

        await client.query(
            `INSERT INTO users (company_id, full_name, email, password, role) VALUES ($1, $2, $3, $4, $5)`,
            [companyId, full_name, email, hashedPassword, 'super_admin'] // First user is super_admin
        );
        await client.query('COMMIT');
        res.status(201).json({ message: 'Company and Super Admin registered successfully!' });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        if (error.code === '23505') { // PostgreSQL unique violation error code
            return res.status(409).json({ error: 'Email already registered.' });
        }
        console.error('Registration error:', error.message);
        res.status(500).json({ error: 'Failed to register company and user.' });
    } finally {
        if (client) client.release();
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await dbGet(`SELECT * FROM users WHERE email = $1`, [email]);
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { id: user.user_id, email: user.email, role: user.role, company_id: user.company_id },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.json({ message: 'Logged in successfully!', token, role: user.role });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: 'Login failed.' });
    }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await dbGet(`SELECT user_id, full_name, email, role, plan_id FROM users WHERE user_id = $1`, [req.user.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error.message);
        res.status(500).json({ error: 'Failed to fetch profile.' });
    }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
    const { fullName, email, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const user = await dbGet(`SELECT * FROM users WHERE user_id = $1`, [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Handle password change if requested
        if (currentPassword && newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Current password is incorrect.' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
            }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await dbRun(`UPDATE users SET password = $1 WHERE user_id = $2`, [hashedPassword, userId]);
        }

        // Update other profile information
        await dbRun(`UPDATE users SET full_name = $1, email = $2 WHERE user_id = $3`, [fullName, email, userId]);

        // Re-issue token if email changed (or just to keep it fresh)
        const updatedUser = await dbGet(`SELECT user_id, full_name, email, role, company_id FROM users WHERE user_id = $1`, [userId]);
        const newToken = jwt.sign(
            { id: updatedUser.user_id, email: updatedUser.email, role: updatedUser.role, company_id: updatedUser.company_id },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ message: 'Profile updated successfully!', token: newToken });
    } catch (error) {
        console.error('Error updating profile:', error.message);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// Admin Settings - Locations & Users
app.get('/api/locations', authenticateToken, async (req, res) => {
    try {
        const locations = await dbAll(`SELECT * FROM locations WHERE company_id = $1`, [req.user.company_id]);
        res.json(locations);
    } catch (error) {
        console.error('Error fetching locations:', error.message);
        res.status(500).json({ error: 'Failed to fetch locations.' });
    }
});

app.post('/api/locations', authenticateToken, async (req, res) => {
    const { location_name, location_address } = req.body;
    try {
        await dbRun(`INSERT INTO locations (company_id, location_name, location_address) VALUES ($1, $2, $3)`,
            [req.user.company_id, location_name, location_address]);
        res.status(201).json({ message: 'Location created successfully!' });
    } catch (error) {
        console.error('Error creating location:', error.message);
        res.status(500).json({ error: 'Failed to create location.' });
    }
});

app.delete('/api/locations/:id', authenticateToken, async (req, res) => {
    const locationId = req.params.id;
    try {
        await dbRun(`DELETE FROM locations WHERE location_id = $1 AND company_id = $2`, [locationId, req.user.company_id]);
        res.status(204).send(); // No content for successful deletion
    } catch (error) {
        console.error('Error deleting location:', error.message);
        res.status(500).json({ error: 'Failed to delete location.' });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    const filterRole = req.query.filterRole; // e.g., 'employee'
    let query = `SELECT u.user_id, u.full_name, u.email, u.role, l.location_name FROM users u
                 LEFT JOIN locations l ON u.location_id = l.location_id
                 WHERE u.company_id = $1`;
    const params = [req.user.company_id];

    if (filterRole) {
        query += ` AND u.role = $2`; // Adjust parameter index if adding more conditions
        params.push(filterRole);
    }

    try {
        const users = await dbAll(query, params);
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error.message);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});


app.post('/api/invite-user', authenticateToken, async (req, res) => {
    const { full_name, email, password, role, position, employee_id, location_id } = req.body;
    const companyId = req.user.company_id;
    let client; // Declare client here for transaction scope

    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        const hashedPassword = await bcrypt.hash(password, 10);
        // Find or create position for the employee
        let positionId = null;
        if (position) {
            let existingPosition = await client.query(`SELECT id FROM positions WHERE name = $1 AND company_id = $2`, [position, companyId]);
            if (existingPosition.rows.length > 0) {
                positionId = existingPosition.rows[0].id;
            } else {
                const newPosition = await client.query(`INSERT INTO positions (company_id, name) VALUES ($1, $2) RETURNING id`, [companyId, position]);
                positionId = newPosition.rows[0].id;
            }
        }

        await client.query(
            `INSERT INTO users (company_id, full_name, email, password, role, location_id, employee_id, position_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [companyId, full_name, email, hashedPassword, role, location_id || null, employee_id || null, positionId]
        );
        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ message: `${role} invited successfully!` });
    } catch (error) {
        if (client) await client.query('ROLLBACK'); // Rollback on error
        if (error.code === '23505') { // PostgreSQL unique violation error code
            return res.status(409).json({ error: 'Email or Employee ID already exists.' });
        }
        console.error('Invite user error:', error.message);
        res.status(500).json({ error: `Failed to invite ${role}.` });
    } finally {
        if (client) client.release(); // Release client
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    const userId = req.params.id;
    try {
        await dbRun(`DELETE FROM users WHERE user_id = $1 AND company_id = $2`, [userId, req.user.company_id]);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting user:', error.message);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});


// Onboarding Dashboard
app.post('/api/onboard-employee', authenticateToken, async (req, res) => {
    const { full_name, email, position_id, employee_id } = req.body;
    const companyId = req.user.company_id;
    let client; // Declare client here for transaction scope

    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // Create a temporary password for the new employee (they'll set a real one on first login)
        const tempPassword = Math.random().toString(36).slice(-8); // Generate a random string
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Find the checklist for the given position
        const checklistResult = await client.query(`SELECT id FROM checklists WHERE position_id = $1 AND company_id = $2`, [position_id, companyId]);
        const checklist = checklistResult.rows[0];
        if (!checklist) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No checklist found for this position. Please create one in Task Lists.' });
        }

        // Create the new user with 'employee' role
        const userResult = await client.query(
            `INSERT INTO users (company_id, full_name, email, password, role, employee_id, position_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING user_id`,
            [companyId, full_name, email, hashedPassword, 'employee', employee_id || null, position_id]
        );
        const newUserId = userResult.rows[0].user_id;

        // Create the onboarding session
        await client.query(
            `INSERT INTO onboarding_sessions (user_id, company_id, checklist_id) VALUES ($1, $2, $3)`,
            [newUserId, companyId, checklist.id]
        );
        await client.query('COMMIT'); // Commit transaction

        res.status(201).json({ message: 'Onboarding invite sent successfully!' });
    } catch (error) {
        if (client) await client.query('ROLLBACK'); // Rollback on error
        if (error.code === '23505') { // PostgreSQL unique violation error code
            return res.status(409).json({ error: 'Email or Employee ID already exists.' });
        }
        console.error('Error onboarding employee:', error.message);
        res.status(500).json({ error: 'Failed to onboard employee.' });
    } finally {
        if (client) client.release(); // Release client
    }
});

app.get('/api/onboarding-sessions', authenticateToken, async (req, res) => {
    try {
        const sessions = await dbAll(`
            SELECT
                os.session_id,
                os.user_id,
                u.full_name,
                u.email,
                pos.name AS position,
                c.title AS checklist_title,
                c.structure_type,
                c.group_count
            FROM onboarding_sessions os
            JOIN users u ON os.user_id = u.user_id
            JOIN checklists c ON os.checklist_id = c.id
            LEFT JOIN positions pos ON u.position_id = pos.id
            WHERE os.company_id = $1 AND os.status = 'active'
        `, [req.user.company_id]);

        // For each session, fetch the total tasks and completed tasks
        for (const session of sessions) {
            let totalTasks = 0;
            let completedTasks = 0;

            if (session.structure_type === 'single_list') {
                const tasks = await dbAll(`SELECT completed FROM tasks WHERE checklist_id = $1`, [session.checklist_id]);
                totalTasks = tasks.length;
                completedTasks = tasks.filter(t => t.completed === true).length; // PostgreSQL BOOLEAN is true/false
            } else { // 'daily' or 'weekly'
                const taskGroups = await dbAll(`SELECT id FROM task_groups WHERE checklist_id = $1`, [session.checklist_id]);
                for (const group of taskGroups) {
                    const tasks = await dbAll(`SELECT completed FROM tasks WHERE task_group_id = $1`, [group.id]);
                    totalTasks += tasks.length;
                    completedTasks += tasks.filter(t => t.completed === true).length;
                }
            }
            session.totalTasks = totalTasks;
            session.completedTasks = completedTasks;
        }

        res.json(sessions);
    } catch (error) {
        console.error('Error fetching onboarding sessions:', error.message);
        res.status(500).json({ error: 'Failed to fetch onboarding sessions.' });
    }
});


app.put('/api/onboarding-sessions/:id/archive', authenticateToken, async (req, res) => {
    const sessionId = req.params.id;
    try {
        await dbRun(`UPDATE onboarding_sessions SET status = 'archived', completion_date = CURRENT_TIMESTAMP WHERE session_id = $1 AND company_id = $2`,
            [sessionId, req.user.company_id]);
        res.json({ message: 'Onboarding session archived.' });
    } catch (error) {
        console.error('Error archiving onboarding session:', error.message);
        res.status(500).json({ error: 'Failed to archive session.' });
    }
});


// New Hire View - Onboarding Tasks
app.get('/api/onboarding-tasks/:userId', authenticateToken, async (req, res) => {
    const newHireUserId = req.params.userId;
    const companyId = req.user.company_id; // Ensure user accessing tasks is in the same company

    try {
        // Fetch the onboarding session for the new hire
        const session = await dbGet(`
            SELECT os.*, c.position_id, c.title AS checklist_title, c.structure_type, c.group_count
            FROM onboarding_sessions os
            JOIN checklists c ON os.checklist_id = c.id
            WHERE os.user_id = $1 AND os.company_id = $2
        `, [newHireUserId, companyId]);

        if (!session) {
            return res.status(404).json({ error: 'Onboarding session not found for this user.' });
        }

        const checklist = {
            id: session.checklist_id,
            title: session.checklist_title,
            structure_type: session.structure_type,
            group_count: session.group_count
        };

        let tasks = [];
        if (session.structure_type === 'single_list') {
            tasks = await dbAll(`SELECT id, description, completed FROM tasks WHERE checklist_id = $1 ORDER BY task_order`, [session.checklist_id]);
        } else { // 'daily' or 'weekly'
            const taskGroups = await dbAll(`SELECT id, title, group_order FROM task_groups WHERE checklist_id = $1 ORDER BY group_order`, [session.checklist_id]);
            for (const group of taskGroups) {
                const groupTasks = await dbAll(`SELECT id, description, completed FROM tasks WHERE task_group_id = $1 ORDER BY task_order`, [group.id]);
                tasks.push({
                    groupTitle: group.title,
                    tasks: groupTasks
                });
            }
        }
        res.json({ checklist, tasks });

    } catch (error) {
        console.error('Error fetching onboarding tasks:', error.message);
        res.status(500).json({ error: 'Failed to fetch onboarding tasks.' });
    }
});

app.put('/api/onboarding-tasks/:taskId', authenticateToken, async (req, res) => {
    const taskId = req.params.taskId;
    const { completed, type, groupIndex } = req.body; // type and groupIndex are sent from frontend but not used for update directly

    try {
        // Ensure the task belongs to a checklist managed by the user's company
        const task = await dbGet(`
            SELECT t.id, t.completed, c.company_id FROM tasks t
            JOIN checklists c ON t.checklist_id = c.id
            WHERE t.id = $1 AND c.company_id = $2
        `, [taskId, req.user.company_id]);

        // If not a direct checklist task, check if it's part of a grouped checklist
        if (!task) {
            const groupedTask = await dbGet(`
                SELECT t.id, t.completed, c.company_id FROM tasks t
                JOIN task_groups tg ON t.task_group_id = tg.id
                JOIN checklists c ON tg.checklist_id = c.id
                WHERE t.id = $1 AND c.company_id = $2
            `, [taskId, req.user.company_id]);

            if (!groupedTask) {
                return res.status(404).json({ error: 'Task not found or unauthorized.' });
            }
        }

        await dbRun(`UPDATE tasks SET completed = $1 WHERE id = $2`, [completed, taskId]); // PostgreSQL BOOLEAN
        res.json({ message: 'Task status updated successfully.' });
    } catch (error) {
        console.error('Error updating task status:', error.message);
        res.status(500).json({ error: 'Failed to update task status.' });
    }
});


// --- Checklist Management ---

app.get('/api/checklists', authenticateToken, async (req, res) => {
    try {
        const checklists = await dbAll(`
            SELECT c.id, c.title, c.structure_type, c.group_count, p.name AS position
            FROM checklists c
            JOIN positions p ON c.position_id = p.id
            WHERE c.company_id = $1 ORDER BY c.created_at DESC
        `, [req.user.company_id]);
        res.json(checklists);
    } catch (error) {
        console.error('Error fetching checklists:', error.message);
        res.status(500).json({ error: 'Failed to fetch checklists.' });
    }
});

app.get('/api/checklists/:id', authenticateToken, async (req, res) => {
    const checklistId = req.params.id;
    const companyId = req.user.company_id;

    try {
        // Fetch the checklist itself
        const checklist = await dbGet(`
            SELECT c.id, c.title, c.structure_type, c.group_count, p.name AS position
            FROM checklists c
            JOIN positions p ON c.position_id = p.id
            WHERE c.id = $1 AND c.company_id = $2
        `, [checklistId, companyId]);

        if (!checklist) {
            return res.status(404).json({ error: 'Checklist not found or unauthorized.' });
        }

        let tasksData = [];
        if (checklist.structure_type === 'single_list') {
            tasksData = await dbAll(`
                SELECT id, description, completed FROM tasks
                WHERE checklist_id = $1 ORDER BY task_order
            `, [checklistId]);
        } else { // 'daily' or 'weekly'
            const taskGroups = await dbAll(`
                SELECT id, title, group_order FROM task_groups
                WHERE checklist_id = $1 ORDER BY group_order
            `, [checklistId]);

            for (const group of taskGroups) {
                const tasksInGroup = await dbAll(`
                    SELECT id, description, completed FROM tasks
                    WHERE task_group_id = $1 ORDER BY task_order
                `, [group.id]);
                tasksData.push({
                    id: group.id, // Group ID
                    groupTitle: group.title,
                    tasks: tasksInGroup
                });
            }
        }
        res.json({ ...checklist, tasks: tasksData });

    } catch (error) {
        console.error('Error fetching checklist details:', error.message);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/api/checklists', authenticateToken, async (req, res) => {
    const { position, title, structure_type, group_count, tasks } = req.body;
    const companyId = req.user.company_id;
    let client; // Declare client here for transaction scope

    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // Ensure position exists or create it
        let positionDataResult = await client.query(`SELECT id FROM positions WHERE name = $1 AND company_id = $2`, [position, companyId]);
        let positionId;
        if (positionDataResult.rows.length > 0) {
            positionId = positionDataResult.rows[0].id;
        } else {
            const newPositionResult = await client.query(`INSERT INTO positions (company_id, name) VALUES ($1, $2) RETURNING id`, [companyId, position]);
            positionId = newPositionResult.rows[0].id;
        }

        const checklistResult = await client.query(
            `INSERT INTO checklists (company_id, position_id, title, structure_type, group_count) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [companyId, positionId, title, structure_type, group_count]
        );
        const checklistId = checklistResult.rows[0].id;

        if (structure_type === 'single_list') {
            for (let i = 0; i < tasks.length; i++) {
                await client.query(`INSERT INTO tasks (checklist_id, description, completed, task_order) VALUES ($1, $2, $3, $4)`,
                    [checklistId, tasks[i].description, tasks[i].completed, i]);
            }
        } else {
            for (let i = 0; i < tasks.length; i++) {
                const groupResult = await client.query(`INSERT INTO task_groups (checklist_id, title, group_order) VALUES ($1, $2, $3) RETURNING id`,
                    [checklistId, tasks[i].groupTitle, i]);
                const taskGroupId = groupResult.rows[0].id;
                for (let j = 0; j < tasks[i].tasks.length; j++) {
                    await client.query(`INSERT INTO tasks (task_group_id, description, completed, task_order) VALUES ($1, $2, $3, $4)`,
                        [taskGroupId, tasks[i].tasks[j].description, tasks[i].tasks[j].completed, j]);
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Checklist created successfully!', id: checklistId });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error creating checklist:', error.message);
        res.status(500).json({ error: 'Failed to create checklist.' });
    } finally {
        if (client) client.release();
    }
});

app.put('/api/checklists/:id', authenticateToken, async (req, res) => {
    const checklistId = req.params.id;
    const { position, title, structure_type, group_count, tasks } = req.body;
    const companyId = req.user.company_id;
    let client; // Declare client here for transaction scope

    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // Verify checklist belongs to user's company
        const existingChecklistResult = await client.query(`SELECT id FROM checklists WHERE id = $1 AND company_id = $2`, [checklistId, companyId]);
        if (existingChecklistResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Checklist not found or unauthorized.' });
        }

        // Ensure position exists or create it
        let positionDataResult = await client.query(`SELECT id FROM positions WHERE name = $1 AND company_id = $2`, [position, companyId]);
        let positionId;
        if (positionDataResult.rows.length > 0) {
            positionId = positionDataResult.rows[0].id;
        } else {
            const newPositionResult = await client.query(`INSERT INTO positions (company_id, name) VALUES ($1, $2) RETURNING id`, [companyId, position]);
            positionId = newPositionResult.rows[0].id;
        }

        // Update checklist details
        await client.query(
            `UPDATE checklists SET position_id = $1, title = $2, structure_type = $3, group_count = $4 WHERE id = $5`,
            [positionId, title, structure_type, group_count, checklistId]
        );

        // Delete existing tasks and task groups for this checklist
        await client.query(`DELETE FROM tasks WHERE checklist_id = $1`, [checklistId]);
        await client.query(`DELETE FROM task_groups WHERE checklist_id = $1`, [checklistId]);

        // Insert new tasks and task groups based on the updated payload
        if (structure_type === 'single_list') {
            for (let i = 0; i < tasks.length; i++) {
                await client.query(`INSERT INTO tasks (checklist_id, description, completed, task_order) VALUES ($1, $2, $3, $4)`,
                    [checklistId, tasks[i].description, tasks[i].completed, i]);
            }
        } else {
            for (let i = 0; i < tasks.length; i++) {
                const groupResult = await client.query(`INSERT INTO task_groups (checklist_id, title, group_order) VALUES ($1, $2, $3) RETURNING id`,
                    [checklistId, tasks[i].groupTitle, i]);
                const taskGroupId = groupResult.rows[0].id;
                for (let j = 0; j < tasks[i].tasks.length; j++) {
                    await client.query(`INSERT INTO tasks (task_group_id, description, completed, task_order) VALUES ($1, $2, $3, $4)`,
                        [taskGroupId, tasks[i].tasks[j].description, tasks[i].tasks[j].completed, j]);
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Checklist updated successfully!' });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error updating checklist:', error.message);
        res.status(500).json({ error: 'Failed to update checklist.' });
    } finally {
        if (client) client.release();
    }
});


app.delete('/api/checklists/:id', authenticateToken, async (req, res) => {
    const checklistId = req.params.id;
    const companyId = req.user.company_id;
    let client; // Declare client here for transaction scope

    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // Delete tasks first (foreign key constraints)
        await client.query(`DELETE FROM tasks WHERE checklist_id = $1`, [checklistId]);
        // Delete task groups
        await client.query(`DELETE FROM task_groups WHERE checklist_id = $1`, [checklistId]);
        // Delete the checklist itself
        await client.query(`DELETE FROM checklists WHERE id = $1 AND company_id = $2`, [checklistId, companyId]);
        await client.query('COMMIT');
        res.status(204).send(); // No content for successful deletion
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error deleting checklist:', error.message);
        res.status(500).json({ error: 'Failed to delete checklist.' });
    } finally {
        if (client) client.release();
    }
});


// Job Postings and Applicants
app.get('/api/job-postings', authenticateToken, async (req, res) => {
    const statusFilter = req.query.status;
    let query = `SELECT jp.*, l.location_name FROM job_postings jp LEFT JOIN locations l ON jp.location_id = l.location_id WHERE jp.company_id = $1`;
    const params = [req.user.company_id];

    if (statusFilter) {
        query += ` AND jp.status = $2`; // Adjust parameter index
        params.push(statusFilter);
    }
    query += ` ORDER BY jp.created_date DESC`;

    try {
        const jobPostings = await dbAll(query, params);
        res.json(jobPostings);
    } catch (error) {
        console.error('Error fetching job postings:', error.message);
        res.status(500).json({ error: 'Failed to fetch job postings.' });
    }
});

app.post('/api/job-postings', authenticateToken, async (req, res) => {
    const { title, description, requirements, location_id } = req.body;
    try {
        await dbRun(`INSERT INTO job_postings (company_id, title, description, requirements, location_id) VALUES ($1, $2, $3, $4, $5)`,
            [req.user.company_id, title, description, requirements, location_id]);
        res.status(201).json({ message: 'Job posting created successfully!' });
    } catch (error) {
        console.error('Error creating job posting:', error.message);
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});

app.delete('/api/job-postings/:id', authenticateToken, async (req, res) => {
    const jobPostingId = req.params.id;
    try {
        await dbRun(`DELETE FROM job_postings WHERE job_posting_id = $1 AND company_id = $2`, [jobPostingId, req.user.company_id]);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting job posting:', error.message);
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});

// Applicant API (basic structure, you'd expand this)
app.get('/api/applicants', authenticateToken, async (req, res) => {
    const { job_posting_id, status, location_id } = req.query;
    let query = `
        SELECT a.*, jp.title AS job_title, l.location_name FROM applicants a
        JOIN job_postings jp ON a.job_posting_id = jp.job_posting_id
        LEFT JOIN locations l ON jp.location_id = l.location_id
        WHERE a.company_id = $1
    `;
    const params = [req.user.company_id];

    if (job_posting_id) {
        params.push(job_posting_id);
        query += ` AND a.job_posting_id = $${params.length}`;
    }
    if (status) {
        params.push(status);
        query += ` AND a.status = $${params.length}`;
    }
    if (location_id) {
        params.push(location_id);
        query += ` AND jp.location_id = $${params.length}`;
    }
    query += ` ORDER BY a.application_date DESC`;

    try {
        const applicants = await dbAll(query, params);
        res.json(applicants);
    } catch (error) {
        console.error('Error fetching applicants:', error.message);
        res.status(500).json({ error: 'Failed to fetch applicants.' });
    }
});

app.delete('/api/applicants/:id', authenticateToken, async (req, res) => {
    const applicantId = req.params.id;
    try {
        await dbRun(`DELETE FROM applicants WHERE applicant_id = $1 AND company_id = $2`, [applicantId, req.user.company_id]);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting applicant:', error.message);
        res.status(500).json({ error: 'Failed to delete applicant.' });
    }
});


// Documents API
app.post('/api/documents/upload', authenticateToken, upload.single('document_file'), async (req, res) => {
    const { title, description } = req.body;
    const filePath = req.file ? req.file.path : null;
    const fileName = req.file ? req.file.originalname : null;

    if (!filePath || !fileName) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
        await dbRun(`INSERT INTO documents (company_id, user_id, title, file_name, file_path, description) VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.company_id, req.user.id, title, fileName, filePath, description]);
        res.status(201).json({ message: 'Document uploaded successfully!' });
    } catch (error) {
        console.error('Error uploading document:', error.message);
        // Clean up uploaded file if DB insert fails
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.status(500).json({ error: 'Failed to upload document.' });
    }
});

app.get('/api/documents', authenticateToken, async (req, res) => {
    try {
        const documents = await dbAll(`SELECT document_id, title, file_name, description, upload_date FROM documents WHERE company_id = $1 ORDER BY upload_date DESC`, [req.user.company_id]);
        res.json(documents);
    } catch (error) {
        console.error('Error fetching documents:', error.message);
        res.status(500).json({ error: 'Failed to fetch documents.' });
    }
});

app.get('/api/documents/download/:id', authenticateToken, async (req, res) => {
    const documentId = req.params.id;
    try {
        const document = await dbGet(`SELECT file_path, file_name, company_id FROM documents WHERE document_id = $1`, [documentId]);
        if (!document || document.company_id !== req.user.company_id) {
            return res.status(404).json({ error: 'Document not found or unauthorized.' });
        }
        res.download(document.file_path, document.file_name);
    } catch (error) {
        console.error('Error downloading document:', error.message);
        res.status(500).json({ error: 'Failed to download document.' });
    }
});

app.delete('/api/documents/:id', authenticateToken, async (req, res) => {
    const documentId = req.params.id;
    try {
        const document = await dbGet(`SELECT file_path, company_id FROM documents WHERE document_id = $1`, [documentId]);
        if (!document || document.company_id !== req.user.company_id) {
            return res.status(404).json({ error: 'Document not found or unauthorized.' });
        }

        await dbRun(`DELETE FROM documents WHERE document_id = $1`, [documentId]);
        // Delete the file from the filesystem
        if (fs.existsSync(document.file_path)) {
            fs.unlinkSync(document.file_path);
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting document:', error.message);
        res.status(500).json({ error: 'Failed to delete document.' });
    }
});


// Scheduling API
app.get('/api/schedules', authenticateToken, async (req, res) => {
    const { start_date, end_date, employee_id, location_id } = req.query;
    let query = `
        SELECT s.*, u.full_name AS employee_name, l.location_name FROM schedules s
        JOIN users u ON s.employee_id = u.user_id
        JOIN locations l ON s.location_id = l.location_id
        WHERE s.company_id = $1
    `;
    const params = [req.user.company_id];

    if (start_date) {
        params.push(start_date);
        query += ` AND s.start_time >= $${params.length}`;
    }
    if (end_date) {
        params.push(end_date);
        query += ` AND s.end_time <= $${params.length}`;
    }
    if (employee_id) {
        params.push(employee_id);
        query += ` AND s.employee_id = $${params.length}`;
    }
    if (location_id) {
        params.push(location_id);
        query += ` AND s.location_id = $${params.length}`;
    }
    query += ` ORDER BY s.start_time ASC`;

    try {
        const schedules = await dbAll(query, params);
        res.json(schedules);
    } catch (error) {
        console.error('Error fetching schedules:', error.message);
        res.status(500).json({ error: 'Failed to fetch schedules.' });
    }
});

app.post('/api/schedules', authenticateToken, async (req, res) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    try {
        await dbRun(`INSERT INTO schedules (company_id, employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.company_id, employee_id, location_id, start_time, end_time, notes]);
        res.status(201).json({ message: 'Shift created successfully!' });
    } catch (error) {
        console.error('Error creating schedule:', error.message);
        res.status(500).json({ error: 'Failed to create shift.' });
    }
});

app.delete('/api/schedules/:id', authenticateToken, async (req, res) => {
    const scheduleId = req.params.id;
    try {
        await dbRun(`DELETE FROM schedules WHERE schedule_id = $1 AND company_id = $2`, [scheduleId, req.user.company_id]);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting schedule:', error.message);
        res.status(500).json({ error: 'Failed to delete schedule.' });
    }
});


// Catch-all for API 404s
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
});

// Catch-all for frontend routes to serve index.html (for single-page app routing)
// If you have explicit routes for each HTML page, remove this.
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, req.path);
    // Serve the requested file if it exists, otherwise fall back to index.html
    if (fs.existsSync(filePath) && !fs.lstatSync(filePath).isDirectory()) {
        res.sendFile(filePath);
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});


// Start the server
// IMPORTANT: Listen on '0.0.0.0' and use process.env.PORT for Render deployments.
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
