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

// --- Multer Setup ---
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
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
app.use('/uploads', express.static(uploadDir));
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
        if (err.code === '23505') return res.status(400).json({ error: 'This email is already in use.' });
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// Admin Routes
app.get('/locations', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM locations ORDER BY location_name");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
    const { location_name, location_address } = req.body;
    try {
        const result = await pool.query(`INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING *`, [location_name, location_address]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/locations/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`DELETE FROM locations WHERE location_id = $1`, [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Location not found.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    const sql = `SELECT u.user_id, u.full_name, u.email, u.role, u.position, u.employment_type, u.availability, l.location_name FROM users u LEFT JOIN locations l ON u.location_id = l.location_id ORDER BY u.full_name`;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/users/availability', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT user_id, full_name, availability FROM users WHERE role = 'employee' AND availability IS NOT NULL");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve employee availability.' });
    }
});

app.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    if (req.user.id == req.params.id) return res.status(403).json({ error: "You cannot delete your own account." });
    try {
        const result = await pool.query(`DELETE FROM users WHERE user_id = $1`, [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const inviteUser = async (req, res, role) => {
    const { full_name, email, password, location_id, position, employment_type, availability } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: "All fields are required." });
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (full_name, email, password, role, position, location_id, employment_type, availability) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING user_id`,
            [full_name, email, hash, role, position || null, location_id || null, employment_type || null, JSON.stringify(availability) || null]
        );
        res.status(201).json({ id: result.rows[0].user_id });
    } catch (err) {
        console.error('Invite user error:', err);
        if (err.code === '23505') return res.status(400).json({ error: "Email may already be in use." });
        res.status(500).json({ error: "An internal server error occurred." });
    }
};

app.post('/invite-admin', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'location_admin'));
app.post('/invite-employee', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'employee'));

// Onboarding & Checklist Routes
app.post('/onboard-employee', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, position_id } = req.body;
    if (!full_name || !email || !position_id) return res.status(400).json({ error: 'Full name, email, and position are required.' });
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
        res.status(201).json({ message: 'Onboarding started successfully.', tempPassword: tempPassword });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(400).json({ error: 'This email address is already in use.' });
        res.status(500).json({ error: 'An error occurred during the onboarding process.' });
    } finally {
        client.release();
    }
});

// ... (Other routes like /checklists, /job-postings, etc. remain here)


// Scheduling Routes
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
        res.status(500).json({ error: 'Failed to create shift.' });
    }
});

app.get('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    // *** FIX: Changed req.body to req.query ***
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start date and end date are required.' });
    const sql = `
        SELECT s.id, s.start_time, s.end_time, s.notes, u.full_name as employee_name, l.location_name
        FROM shifts s
        JOIN users u ON s.employee_id = u.user_id
        JOIN locations l ON s.location_id = l.location_id
        WHERE s.start_time >= $1 AND s.start_time <= $2
        ORDER BY s.start_time;
    `;
    try {
        const result = await pool.query(sql, [startDate, endDate]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});

app.post('/shifts/auto-generate', isAuthenticated, isAdmin, async (req, res) => {
    const { weekStartDate } = req.body;
    if (!weekStartDate) {
        return res.status(400).json({ error: 'Week start date is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: employees } = await client.query(`
            SELECT user_id, availability, location_id FROM users 
            WHERE role = 'employee' AND availability IS NOT NULL
        `);

        if (employees.length === 0) {
            return res.status(400).json({ error: 'No employees with availability found to generate a schedule.' });
        }
        
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        let shiftsCreated = 0;

        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(weekStartDate);
            currentDate.setDate(currentDate.getDate() + i);
            const dayName = daysOfWeek[currentDate.getDay()];

            const availableEmployee = employees.find(emp => {
                const dayAvail = emp.availability[dayName];
                return dayAvail && parseFloat(dayAvail.start) <= 9 && parseFloat(dayAvail.end) >= 17;
            });
            
            if (availableEmployee) {
                const shiftStartTime = new Date(currentDate);
                shiftStartTime.setHours(9, 0, 0, 0);

                const shiftEndTime = new Date(currentDate);
                shiftEndTime.setHours(17, 0, 0, 0);

                await client.query(
                    'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                    [availableEmployee.user_id, availableEmployee.location_id, shiftStartTime, shiftEndTime, 'Auto-generated']
                );
                shiftsCreated++;
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: `Successfully auto-generated ${shiftsCreated} shifts.` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Auto-scheduling failed:', error);
        res.status(500).json({ error: 'An error occurred during auto-scheduling.' });
    } finally {
        client.release();
    }
});


// --- 7. Server Startup Logic ---
const startServer = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        
        // --- Schema Migrations ---
        console.log("Checking for database migrations...");
        const hasEmploymentType = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='employment_type'");
        if (hasEmploymentType.rowCount === 0) {
            await client.query("ALTER TABLE users ADD COLUMN employment_type VARCHAR(50)");
            console.log("Migrated: Added 'employment_type' column to users table.");
        }

        const hasAvailability = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='availability'");
        if (hasAvailability.rowCount === 0) {
            await client.query("ALTER TABLE users ADD COLUMN availability JSONB");
            console.log("Migrated: Added 'availability' column to users table.");
        }
        console.log("Database schema migrations complete.");

        client.release();

        // Start the server
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
