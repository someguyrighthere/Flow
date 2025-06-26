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
// ... (These routes remain the same)


// Admin Routes
app.get('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM business_settings WHERE id = 1');
        if (result.rows.length === 0) {
            return res.json({ operating_hours_start: '09:00', operating_hours_end: '17:00' });
        }
        res.json(result.rows[0]);
    } catch (err) {
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
        res.status(500).json({ error: 'Failed to save business settings.' });
    }
});

// ... (Other admin routes remain the same)


// Scheduling Routes
// ... (GET /shifts and POST /shifts remain the same)

// *** NEW ADVANCED AUTO-SCHEDULING ENDPOINT ***
app.post('/shifts/auto-generate', isAuthenticated, isAdmin, async (req, res) => {
    const { weekStartDate, dailyHours } = req.body;
    if (!weekStartDate || !dailyHours) {
        return res.status(400).json({ error: 'Week start date and daily hours are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get business settings
        const settingsRes = await client.query('SELECT * FROM business_settings WHERE id = 1');
        const settings = settingsRes.rows[0] || { operating_hours_start: '09:00', operating_hours_end: '17:00' };
        const businessStartHour = parseInt(settings.operating_hours_start.split(':')[0], 10);
        const businessEndHour = parseInt(settings.operating_hours_end.split(':')[0], 10);

        // 2. Get all employees and their existing scheduled hours for the week
        const { rows: employees } = await client.query(`
            SELECT 
                u.user_id, u.availability, u.location_id, u.employment_type,
                COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))) / 3600, 0) as scheduled_hours
            FROM users u
            LEFT JOIN shifts s ON u.user_id = s.employee_id 
                AND s.start_time >= $1::date 
                AND s.start_time < ($1::date + '7 days'::interval)
            WHERE u.role = 'employee' AND u.availability IS NOT NULL
            GROUP BY u.user_id
            ORDER BY u.employment_type DESC, RANDOM()
        `, [weekStartDate]);

        if (employees.length === 0) {
            return res.status(400).json({ error: 'No employees with availability found.' });
        }
        
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        let totalShiftsCreated = 0;

        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(weekStartDate);
            currentDate.setDate(currentDate.getDate() + i);
            const dayName = daysOfWeek[currentDate.getDay()];
            let hoursToSchedule = parseFloat(dailyHours[dayName] || 0);

            // Function to find and schedule an employee
            const scheduleEmployee = async (employee, shiftLength) => {
                const shiftStartTime = new Date(currentDate);
                shiftStartTime.setHours(businessStartHour, 0, 0, 0);

                const shiftEndTime = new Date(currentDate);
                shiftEndTime.setHours(businessStartHour + shiftLength, 0, 0, 0);

                await client.query(
                    'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                    [employee.user_id, employee.location_id, shiftStartTime, shiftEndTime, 'Auto-generated']
                );
                employee.scheduled_hours += shiftLength;
                hoursToSchedule -= shiftLength;
                totalShiftsCreated++;
            };

            // Prioritize Full-time employees
            for (const emp of employees.filter(e => e.employment_type === 'Full-time')) {
                if (hoursToSchedule <= 0) break;
                if (emp.scheduled_hours < 40) {
                    const dayAvail = emp.availability[dayName];
                    if (dayAvail && parseInt(dayAvail.start.split(':')[0]) <= businessStartHour && parseInt(dayAvail.end.split(':')[0]) >= businessEndHour) {
                       await scheduleEmployee(emp, 8);
                    }
                }
            }

            // Fill remaining hours with Part-time employees
            for (const emp of employees.filter(e => e.employment_type === 'Part-time')) {
                if (hoursToSchedule <= 0) break;
                const dayAvail = emp.availability[dayName];
                if (dayAvail && parseInt(dayAvail.start.split(':')[0]) <= businessStartHour && parseInt(dayAvail.end.split(':')[0]) >= (businessStartHour + 4)) {
                    await scheduleEmployee(emp, 4);
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: `Successfully auto-generated ${totalShiftsCreated} shifts.` });

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
        
        const schemaQueries = `
            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                location_name VARCHAR(255) NOT NULL,
                location_address TEXT
            );
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'location_admin', 'employee')),
                position VARCHAR(255),
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
            -- ... (Other tables remain the same)
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
