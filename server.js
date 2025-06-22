// server.js - Backend for Flow Business Suite
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create 'uploads' directory if it doesn't exist
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// --- Database Connection (SQLite) ---
// Connect to SQLite database
const dbPath = path.join(__dirname, 'onboardflow.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Initialize database schema (create tables if they don't exist)
        db.serialize(() => {
            // Users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'employee', -- 'super_admin', 'location_admin', 'employee'
                location_id INTEGER,
                employee_id TEXT UNIQUE,
                plan_id TEXT DEFAULT 'free',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Locations table
            db.run(`CREATE TABLE IF NOT EXISTS locations (
                location_id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER,
                location_name TEXT NOT NULL,
                location_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Positions table (used for onboarding checklists)
            db.run(`CREATE TABLE IF NOT EXISTS positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Checklists table
            db.run(`CREATE TABLE IF NOT EXISTS checklists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER,
                position_id INTEGER, -- Links to positions table
                title TEXT NOT NULL,
                structure_type TEXT NOT NULL, -- 'single_list', 'daily', 'weekly'
                group_count INTEGER DEFAULT 0, -- Number of days/weeks for grouped lists
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (position_id) REFERENCES positions(id)
            )`);

            // Task_Groups table (for daily/weekly checklists)
            db.run(`CREATE TABLE IF NOT EXISTS task_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                checklist_id INTEGER,
                title TEXT NOT NULL, -- e.g., "Day 1", "Week 2"
                group_order INTEGER,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
            )`);

            // Tasks table (can link to either checklists or task_groups)
            db.run(`CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                checklist_id INTEGER, -- For single_list tasks directly under checklist
                task_group_id INTEGER, -- For tasks under a task_group
                description TEXT NOT NULL,
                completed INTEGER DEFAULT 0, -- 0 for false, 1 for true
                task_order INTEGER,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
                FOREIGN KEY (task_group_id) REFERENCES task_groups(id) ON DELETE CASCADE
            )`);
            
            // Onboarding Sessions table
            db.run(`CREATE TABLE IF NOT EXISTS onboarding_sessions (
                session_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL, -- The new hire's user_id
                company_id INTEGER NOT NULL,
                checklist_id INTEGER NOT NULL,
                start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                completion_date DATETIME,
                status TEXT DEFAULT 'active', -- 'active', 'archived'
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE SET NULL
            )`);

            // Documents table
            db.run(`CREATE TABLE IF NOT EXISTS documents (
                document_id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL, -- Uploader
                title TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                description TEXT,
                upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )`);

            // Job Postings table
            db.run(`CREATE TABLE IF NOT EXISTS job_postings (
                job_posting_id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                requirements TEXT,
                location_id INTEGER, -- Optional: links to locations table
                status TEXT DEFAULT 'Open', -- 'Open', 'Closed'
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            )`);

            // Applicants table
            db.run(`CREATE TABLE IF NOT EXISTS applicants (
                applicant_id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                job_posting_id INTEGER NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone_number TEXT,
                resume_path TEXT, -- Path to uploaded resume
                status TEXT DEFAULT 'Applied', -- 'Applied', 'Interviewing', 'Rejected', 'Hired'
                application_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_posting_id) REFERENCES job_postings(job_posting_id) ON DELETE CASCADE
            )`);
            // Schedules table
            db.run(`CREATE TABLE IF NOT EXISTS schedules (
                schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL, -- user_id of the employee
                location_id INTEGER NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE
            )`);

            // You might want to add some initial dummy data for testing
            // Example: Create a default super admin if none exists
            db.get(`SELECT user_id FROM users WHERE role = 'super_admin'`, async (err, row) => {
                if (err) {
                    console.error('Error checking for super admin:', err.message);
                    return;
                }
                if (!row) {
                    console.log('No super admin found, creating a default one.');
                    const hashedPassword = await bcrypt.hash('adminpassword', 10); // Default password
                    db.run(`INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)`,
                        ['Super Admin', 'admin@example.com', hashedPassword, 'super_admin'],
                        function (err) {
                            if (err) {
                                console.error('Error creating default super admin:', err.message);
                            } else {
                                console.log(`Default Super Admin created with email admin@example.com and password adminpassword. User ID: ${this.lastID}`);
                            }
                        }
                    );
                }
            });
        });
    }
});


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

// --- Helper function for SQLite queries (using Promises for async/await) ---
const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this); // 'this' contains lastID, changes etc.
        });
    });
};

const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// --- API Routes ---

// User Authentication & Profile
app.post('/api/register', async (req, res) => {
    const { company_name, full_name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Start a transaction for company and user creation
        await dbRun('BEGIN TRANSACTION');

        const companyResult = await dbRun(`INSERT INTO companies (name) VALUES (?)`, [company_name]);
        const companyId = companyResult.lastID;

        const userResult = await dbRun(
            `INSERT INTO users (company_id, full_name, email, password, role) VALUES (?, ?, ?, ?, ?)`,
            [companyId, full_name, email, hashedPassword, 'super_admin'] // First user is super_admin
        );
        await dbRun('COMMIT');
        res.status(201).json({ message: 'Company and Super Admin registered successfully!' });
    } catch (error) {
        await dbRun('ROLLBACK');
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Email already registered.' });
        }
        console.error('Registration error:', error.message);
        res.status(500).json({ error: 'Failed to register company and user.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await dbGet(`SELECT * FROM users WHERE email = ?`, [email]);
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
        const user = await dbGet(`SELECT user_id, full_name, email, role, plan_id FROM users WHERE user_id = ?`, [req.user.id]);
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
        const user = await dbGet(`SELECT * FROM users WHERE user_id = ?`, [userId]);
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
            await dbRun(`UPDATE users SET password = ? WHERE user_id = ?`, [hashedPassword, userId]);
        }

        // Update other profile information
        await dbRun(`UPDATE users SET full_name = ?, email = ? WHERE user_id = ?`, [fullName, email, userId]);

        // Re-issue token if email changed (or just to keep it fresh)
        const updatedUser = await dbGet(`SELECT user_id, full_name, email, role, company_id FROM users WHERE user_id = ?`, [userId]);
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
        const locations = await dbAll(`SELECT * FROM locations WHERE company_id = ?`, [req.user.company_id]);
        res.json(locations);
    } catch (error) {
        console.error('Error fetching locations:', error.message);
        res.status(500).json({ error: 'Failed to fetch locations.' });
    }
});

app.post('/api/locations', authenticateToken, async (req, res) => {
    const { location_name, location_address } = req.body;
    try {
        await dbRun(`INSERT INTO locations (company_id, location_name, location_address) VALUES (?, ?, ?)`,
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
        await dbRun(`DELETE FROM locations WHERE location_id = ? AND company_id = ?`, [locationId, req.user.company_id]);
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
                 WHERE u.company_id = ?`;
    const params = [req.user.company_id];

    if (filterRole) {
        query += ` AND u.role = ?`;
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

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Find or create position for the employee
        let positionId = null;
        if (position) {
            let existingPosition = await dbGet(`SELECT id FROM positions WHERE name = ? AND company_id = ?`, [position, companyId]);
            if (existingPosition) {
                positionId = existingPosition.id;
            } else {
                const newPosition = await dbRun(`INSERT INTO positions (company_id, name) VALUES (?, ?)`, [companyId, position]);
                positionId = newPosition.lastID;
            }
        }

        await dbRun(
            `INSERT INTO users (company_id, full_name, email, password, role, location_id, employee_id, position_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, full_name, email, hashedPassword, role, location_id || null, employee_id || null, positionId]
        );
        res.status(201).json({ message: `${role} invited successfully!` });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Email or Employee ID already exists.' });
        }
        console.error('Invite user error:', error.message);
        res.status(500).json({ error: `Failed to invite ${role}.` });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    const userId = req.params.id;
    try {
        await dbRun(`DELETE FROM users WHERE user_id = ? AND company_id = ?`, [userId, req.user.company_id]);
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

    try {
        // Create a temporary password for the new employee (they'll set a real one on first login)
        const tempPassword = Math.random().toString(36).slice(-8); // Generate a random string
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Find the checklist for the given position
        const checklist = await dbGet(`SELECT id FROM checklists WHERE position_id = ? AND company_id = ?`, [position_id, companyId]);
        if (!checklist) {
            return res.status(400).json({ error: 'No checklist found for this position. Please create one in Task Lists.' });
        }

        // Create the new user with 'employee' role
        const userResult = await dbRun(
            `INSERT INTO users (company_id, full_name, email, password, role, employee_id, position_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [companyId, full_name, email, hashedPassword, 'employee', employee_id || null, position_id]
        );
        const newUserId = userResult.lastID;

        // Create the onboarding session
        await dbRun(
            `INSERT INTO onboarding_sessions (user_id, company_id, checklist_id) VALUES (?, ?, ?)`,
            [newUserId, companyId, checklist.id]
        );

        res.status(201).json({ message: 'Onboarding invite sent successfully!' });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Email or Employee ID already exists.' });
        }
        console.error('Error onboarding employee:', error.message);
        res.status(500).json({ error: 'Failed to onboard employee.' });
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
            WHERE os.company_id = ? AND os.status = 'active'
        `, [req.user.company_id]);

        // For each session, fetch the total tasks and completed tasks
        for (const session of sessions) {
            let totalTasks = 0;
            let completedTasks = 0;

            if (session.structure_type === 'single_list') {
                const tasks = await dbAll(`SELECT completed FROM tasks WHERE checklist_id = ?`, [session.checklist_id]);
                totalTasks = tasks.length;
                completedTasks = tasks.filter(t => t.completed === 1).length;
            } else { // 'daily' or 'weekly'
                const taskGroups = await dbAll(`SELECT id FROM task_groups WHERE checklist_id = ?`, [session.checklist_id]);
                for (const group of taskGroups) {
                    const tasks = await dbAll(`SELECT completed FROM tasks WHERE task_group_id = ?`, [group.id]);
                    totalTasks += tasks.length;
                    completedTasks += tasks.filter(t => t.completed === 1).length;
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
        await dbRun(`UPDATE onboarding_sessions SET status = 'archived', completion_date = CURRENT_TIMESTAMP WHERE session_id = ? AND company_id = ?`,
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
            WHERE os.user_id = ? AND os.company_id = ?
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
            tasks = await dbAll(`SELECT id, description, completed FROM tasks WHERE checklist_id = ? ORDER BY task_order`, [session.checklist_id]);
        } else { // 'daily' or 'weekly'
            const taskGroups = await dbAll(`SELECT id, title, group_order FROM task_groups WHERE checklist_id = ? ORDER BY group_order`, [session.checklist_id]);
            for (const group of taskGroups) {
                const groupTasks = await dbAll(`SELECT id, description, completed FROM tasks WHERE task_group_id = ? ORDER BY task_order`, [group.id]);
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
            WHERE t.id = ? AND c.company_id = ?
        `, [taskId, req.user.company_id]);

        // If not a direct checklist task, check if it's part of a grouped checklist
        if (!task) {
            const groupedTask = await dbGet(`
                SELECT t.id, t.completed, c.company_id FROM tasks t
                JOIN task_groups tg ON t.task_group_id = tg.id
                JOIN checklists c ON tg.checklist_id = c.id
                WHERE t.id = ? AND c.company_id = ?
            `, [taskId, req.user.company_id]);

            if (!groupedTask) {
                return res.status(404).json({ error: 'Task not found or unauthorized.' });
            }
        }


        await dbRun(`UPDATE tasks SET completed = ? WHERE id = ?`, [completed ? 1 : 0, taskId]);
        res.json({ message: 'Task status updated successfully.' });
    } catch (error) {
        console.error('Error updating task status:', error.message);
        res.status(500).json({ error: 'Failed to update task status.' });
    }
});


// --- Checklist Management (Your Primary Request) ---

app.get('/api/checklists', authenticateToken, async (req, res) => {
    try {
        const checklists = await dbAll(`
            SELECT c.id, c.title, c.structure_type, c.group_count, p.name AS position
            FROM checklists c
            JOIN positions p ON c.position_id = p.id
            WHERE c.company_id = ? ORDER BY c.created_at DESC
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
            WHERE c.id = ? AND c.company_id = ?
        `, [checklistId, companyId]);

        if (!checklist) {
            return res.status(404).json({ error: 'Checklist not found or unauthorized.' });
        }

        let tasksData = [];
        if (checklist.structure_type === 'single_list') {
            tasksData = await dbAll(`
                SELECT id, description, completed FROM tasks
                WHERE checklist_id = ? ORDER BY task_order
            `, [checklistId]);
        } else { // 'daily' or 'weekly'
            const taskGroups = await dbAll(`
                SELECT id, title, group_order FROM task_groups
                WHERE checklist_id = ? ORDER BY group_order
            `, [checklistId]);

            for (const group of taskGroups) {
                const tasksInGroup = await dbAll(`
                    SELECT id, description, completed FROM tasks
                    WHERE task_group_id = ? ORDER BY task_order
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

    try {
        // Ensure position exists or create it
        let positionData = await dbGet(`SELECT id FROM positions WHERE name = ? AND company_id = ?`, [position, companyId]);
        let positionId;
        if (positionData) {
            positionId = positionData.id;
        } else {
            const newPositionResult = await dbRun(`INSERT INTO positions (company_id, name) VALUES (?, ?)`, [companyId, position]);
            positionId = newPositionResult.lastID;
        }

        await dbRun('BEGIN TRANSACTION');

        const checklistResult = await dbRun(
            `INSERT INTO checklists (company_id, position_id, title, structure_type, group_count) VALUES (?, ?, ?, ?, ?)`,
            [companyId, positionId, title, structure_type, group_count]
        );
        const checklistId = checklistResult.lastID;

        if (structure_type === 'single_list') {
            for (let i = 0; i < tasks.length; i++) {
                await dbRun(`INSERT INTO tasks (checklist_id, description, completed, task_order) VALUES (?, ?, ?, ?)`,
                    [checklistId, tasks[i].description, tasks[i].completed ? 1 : 0, i]);
            }
        } else {
            for (let i = 0; i < tasks.length; i++) {
                const groupResult = await dbRun(`INSERT INTO task_groups (checklist_id, title, group_order) VALUES (?, ?, ?)`,
                    [checklistId, tasks[i].groupTitle, i]);
                const taskGroupId = groupResult.lastID;
                for (let j = 0; j < tasks[i].tasks.length; j++) {
                    await dbRun(`INSERT INTO tasks (task_group_id, description, completed, task_order) VALUES (?, ?, ?, ?)`,
                        [taskGroupId, tasks[i].tasks[j].description, tasks[i].tasks[j].completed ? 1 : 0, j]);
                }
            }
        }

        await dbRun('COMMIT');
        res.status(201).json({ message: 'Checklist created successfully!', id: checklistId });

    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('Error creating checklist:', error.message);
        res.status(500).json({ error: 'Failed to create checklist.' });
    }
});

app.put('/api/checklists/:id', authenticateToken, async (req, res) => {
    const checklistId = req.params.id;
    const { position, title, structure_type, group_count, tasks } = req.body;
    const companyId = req.user.company_id;

    try {
        // Verify checklist belongs to user's company
        const existingChecklist = await dbGet(`SELECT id FROM checklists WHERE id = ? AND company_id = ?`, [checklistId, companyId]);
        if (!existingChecklist) {
            return res.status(404).json({ error: 'Checklist not found or unauthorized.' });
        }

        // Ensure position exists or create it
        let positionData = await dbGet(`SELECT id FROM positions WHERE name = ? AND company_id = ?`, [position, companyId]);
        let positionId;
        if (positionData) {
            positionId = positionData.id;
        } else {
            const newPositionResult = await dbRun(`INSERT INTO positions (company_id, name) VALUES (?, ?)`, [companyId, position]);
            positionId = newPositionResult.lastID;
        }

        await dbRun('BEGIN TRANSACTION');

        // Update checklist details
        await dbRun(
            `UPDATE checklists SET position_id = ?, title = ?, structure_type = ?, group_count = ? WHERE id = ?`,
            [positionId, title, structure_type, group_count, checklistId]
        );

        // Delete existing tasks and task groups for this checklist
        await dbRun(`DELETE FROM tasks WHERE checklist_id = ?`, [checklistId]);
        await dbRun(`DELETE FROM task_groups WHERE checklist_id = ?`, [checklistId]);

        // Insert new tasks and task groups based on the updated payload
        if (structure_type === 'single_list') {
            for (let i = 0; i < tasks.length; i++) {
                await dbRun(`INSERT INTO tasks (checklist_id, description, completed, task_order) VALUES (?, ?, ?, ?)`,
                    [checklistId, tasks[i].description, tasks[i].completed ? 1 : 0, i]);
            }
        } else {
            for (let i = 0; i < tasks.length; i++) {
                const groupResult = await dbRun(`INSERT INTO task_groups (checklist_id, title, group_order) VALUES (?, ?, ?)`,
                    [checklistId, tasks[i].groupTitle, i]);
                const taskGroupId = groupResult.lastID;
                for (let j = 0; j < tasks[i].tasks.length; j++) {
                    await dbRun(`INSERT INTO tasks (task_group_id, description, completed, task_order) VALUES (?, ?, ?, ?)`,
                        [taskGroupId, tasks[i].tasks[j].description, tasks[i].tasks[j].completed ? 1 : 0, j]);
                }
            }
        }

        await dbRun('COMMIT');
        res.json({ message: 'Checklist updated successfully!' });

    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('Error updating checklist:', error.message);
        res.status(500).json({ error: 'Failed to update checklist.' });
    }
});


app.delete('/api/checklists/:id', authenticateToken, async (req, res) => {
    const checklistId = req.params.id;
    const companyId = req.user.company_id;

    try {
        await dbRun('BEGIN TRANSACTION');
        // Delete tasks first (foreign key constraints)
        await dbRun(`DELETE FROM tasks WHERE checklist_id = ?`, [checklistId]);
        // Delete task groups
        await dbRun(`DELETE FROM task_groups WHERE checklist_id = ?`, [checklistId]);
        // Delete the checklist itself
        await dbRun(`DELETE FROM checklists WHERE id = ? AND company_id = ?`, [checklistId, companyId]);
        await dbRun('COMMIT');
        res.status(204).send(); // No content for successful deletion
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('Error deleting checklist:', error.message);
        res.status(500).json({ error: 'Failed to delete checklist.' });
    }
});


// Job Postings and Applicants
app.get('/api/job-postings', authenticateToken, async (req, res) => {
    const statusFilter = req.query.status;
    let query = `SELECT jp.*, l.location_name FROM job_postings jp LEFT JOIN locations l ON jp.location_id = l.location_id WHERE jp.company_id = ?`;
    const params = [req.user.company_id];

    if (statusFilter) {
        query += ` AND jp.status = ?`;
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
        await dbRun(`INSERT INTO job_postings (company_id, title, description, requirements, location_id) VALUES (?, ?, ?, ?, ?)`,
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
        await dbRun(`DELETE FROM job_postings WHERE job_posting_id = ? AND company_id = ?`, [jobPostingId, req.user.company_id]);
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
        WHERE a.company_id = ?
    `;
    const params = [req.user.company_id];

    if (job_posting_id) {
        query += ` AND a.job_posting_id = ?`;
        params.push(job_posting_id);
    }
    if (status) {
        query += ` AND a.status = ?`;
        params.push(status);
    }
    if (location_id) {
        query += ` AND jp.location_id = ?`;
        params.push(location_id);
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
        await dbRun(`DELETE FROM applicants WHERE applicant_id = ? AND company_id = ?`, [applicantId, req.user.company_id]);
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
        await dbRun(`INSERT INTO documents (company_id, user_id, title, file_name, file_path, description) VALUES (?, ?, ?, ?, ?, ?)`,
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
        const documents = await dbAll(`SELECT document_id, title, file_name, description, upload_date FROM documents WHERE company_id = ? ORDER BY upload_date DESC`, [req.user.company_id]);
        res.json(documents);
    } catch (error) {
        console.error('Error fetching documents:', error.message);
        res.status(500).json({ error: 'Failed to fetch documents.' });
    }
});

app.get('/api/documents/download/:id', authenticateToken, async (req, res) => {
    const documentId = req.params.id;
    try {
        const document = await dbGet(`SELECT file_path, file_name, company_id FROM documents WHERE document_id = ?`, [documentId]);
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
        const document = await dbGet(`SELECT file_path, company_id FROM documents WHERE document_id = ?`, [documentId]);
        if (!document || document.company_id !== req.user.company_id) {
            return res.status(404).json({ error: 'Document not found or unauthorized.' });
        }

        await dbRun(`DELETE FROM documents WHERE document_id = ?`, [documentId]);
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
        WHERE s.company_id = ?
    `;
    const params = [req.user.company_id];

    if (start_date) {
        query += ` AND s.start_time >= ?`;
        params.push(start_date);
    }
    if (end_date) {
        query += ` AND s.end_time <= ?`;
        params.push(end_date);
    }
    if (employee_id) {
        query += ` AND s.employee_id = ?`;
        params.push(employee_id);
    }
    if (location_id) {
        query += ` AND s.location_id = ?`;
        params.push(location_id);
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
        await dbRun(`INSERT INTO schedules (company_id, employee_id, location_id, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?)`,
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
        await dbRun(`DELETE FROM schedules WHERE schedule_id = ? AND company_id = ?`, [scheduleId, req.user.company_id]);
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
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

