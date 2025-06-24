// server.js

// --- 1. Imports and Setup ---
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// --- 2. Initialize Express App ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

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

const seedDatabase = async (client) => {
    const adminEmail = "xarcy123@gmail.com";
    const adminPassword = "kain6669";
    const adminFullName = "Xarcy";

    try {
        const checkRes = await client.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
        if (checkRes.rows.length > 0) {
            console.log("Super admin user already exists. Seeding not required.");
            return;
        }

        console.log("Default super admin not found, creating one...");
        const hash = await bcrypt.hash(adminPassword, 10);
        await client.query(
            `INSERT INTO users (full_name, email, password, role) VALUES ($1, $2, $3, $4)`,
            [adminFullName, adminEmail, hash, 'super_admin']
        );
        console.log("Default super admin created successfully.");

    } catch (err) {
        console.error("Error during database seeding:", err);
    }
};

const initializeDatabase = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');

        // --- ONE-TIME FIX: Drop all tables to ensure a clean schema ---
        // This is a temporary measure. REMOVE THIS BLOCK after a successful deployment.
        console.log("Ensuring a clean slate for schema creation...");
        await client.query('DROP TABLE IF EXISTS onboarding_sessions CASCADE;');
        await client.query('DROP TABLE IF EXISTS checklists CASCADE;');
        await client.query('DROP TABLE IF EXISTS users CASCADE;');
        await client.query('DROP TABLE IF EXISTS locations CASCADE;');
        console.log("Existing tables dropped to ensure a fresh start.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                location_name TEXT NOT NULL,
                location_address TEXT
            );
        `);
        console.log("Locations table is ready.");

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
        console.log("Users table is ready.");
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                position TEXT NOT NULL,
                title TEXT NOT NULL,
                tasks JSONB NOT NULL,
                structure_type TEXT,
                time_group_count INTEGER
            );
        `);
        console.log("Checklists table is ready.");

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
        console.log("Onboarding sessions table is ready.");
        
        await seedDatabase(client);
        
        console.log("Database initialization complete.");
    } catch (err) {
        console.error('Error connecting to or initializing PostgreSQL database:', err.stack);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
    }
};

initializeDatabase();


// --- 4. Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));


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
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
    next();
};


// --- 6. API Routes ---
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
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
            s.session_id,
            u.user_id,
            u.full_name,
            u.email,
            c.position,
            s.tasks_status,
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
        console.error("Error fetching onboarding sessions:", err);
        res.status(500).json({ error: 'Failed to load onboarding sessions.' });
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
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const userRes = await client.query(
            `INSERT INTO users (full_name, email, password, role, position) VALUES ($1, $2, $3, 'employee', (SELECT position FROM checklists WHERE id = $4)) RETURNING user_id`,
            [full_name, email, hashedPassword, position_id]
        );
        const newUserId = userRes.rows[0].user_id;
        const checklistRes = await client.query('SELECT tasks FROM checklists WHERE id = $1', [position_id]);
        if (checklistRes.rows.length === 0) {
            throw new Error('Checklist for the selected position not found.');
        }
        const tasks = checklistRes.rows[0].tasks;
        const initialTasksStatus = tasks.map(task => ({ description: task.description, completed: false, documentId: task.documentId || null, documentName: task.documentName || null }));

        await client.query(
            `INSERT INTO onboarding_sessions (user_id, checklist_id, tasks_status) VALUES ($1, $2, $3)`,
            [newUserId, position_id, JSON.stringify(initialTasksStatus)]
        );
        await client.query('COMMIT');
        console.log(`Onboarding invite for ${email} complete. Temporary password: ${tempPassword}`);
        res.status(201).json({ message: 'Onboarding started successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error onboarding employee:", err);
        if (err.code === '23505') return res.status(400).json({ error: 'This email address is already in use.' });
        res.status(500).json({ error: 'An error occurred during the onboarding process.' });
    } finally {
        client.release();
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

app.delete('/checklists/:id', isAuthenticated, (req, res) => {
    res.status(501).send("Not yet implemented");
});


// --- 7. Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
