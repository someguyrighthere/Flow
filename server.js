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

app.post('/shifts/auto-generate', isAuthenticated, isAdmin, async (req, res) => {
    const { weekStartDate, dailyHours } = req.body;
    if (!weekStartDate || !dailyHours) {
        return res.status(400).json({ error: 'Week start date and daily hours are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch business operating hours
        const settingsRes = await client.query('SELECT * FROM business_settings WHERE id = 1');
        const settings = settingsRes.rows[0] || { operating_hours_start: '09:00', operating_hours_end: '17:00' };
        const businessStartHour = parseInt(settings.operating_hours_start.split(':')[0], 10);
        const businessEndHour = parseInt(settings.operating_hours_end.split(':')[0], 10); // Added businessEndHour

        // Fetch all employees with their availability and type
        const { rows: employees } = await client.query(`SELECT user_id, full_name, availability, location_id, employment_type FROM users WHERE role = 'employee' AND availability IS NOT NULL`);
        
        // Initialize employee data for scheduling, including days worked and scheduled hours
        let employeeScheduleData = employees.map(e => ({
            ...e,
            scheduled_hours: 0,
            daysWorked: 0 // Track days worked by each employee for the current week
        }));

        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        let totalShiftsCreated = 0;

        // Iterate through each day of the week (Sunday to Saturday)
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(weekStartDate);
            currentDate.setDate(currentDate.getDate() + i);
            currentDate.setHours(0,0,0,0); // Ensure current date starts at midnight for consistent time calculations
            const dayName = daysOfWeek[currentDate.getDay()]; // Get day name (e.g., 'monday')
            let remainingDailyTargetHours = parseFloat(dailyHours[dayName] || 0); // Target hours for this specific day
            
            // Create a coverage array for the current day, representing each hour (or half-hour)
            // Initialize with false (no coverage)
            const dailyCoverage = Array(businessEndHour - businessStartHour).fill(false); 
            // Or if you need 30 min intervals: Array((businessEndHour - businessStartHour) * 2).fill(false);

            // First, load existing shifts to mark occupied time slots
            const existingShiftsRes = await client.query(`
                SELECT start_time, end_time FROM shifts
                WHERE DATE(start_time) = $1 AND DATE(end_time) = $1;
            `, [currentDate.toISOString().split('T')[0]]);

            existingShiftsRes.rows.forEach(shift => {
                const shiftStartHour = new Date(shift.start_time).getHours();
                const shiftEndHour = new Date(shift.end_time).getHours(); // Simplified to hour for now
                
                for (let h = shiftStartHour; h < shiftEndHour; h++) {
                    const coverageIndex = h - businessStartHour;
                    if (coverageIndex >= 0 && coverageIndex < dailyCoverage.length) {
                        dailyCoverage[coverageIndex] = true;
                    }
                }
                // Consider more granular coverage if needed (e.g., half-hour blocks)
            });


            // Iterate through each hour (or smaller time slot) within business hours
            for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                const coverageIndex = currentHour - businessStartHour;
                if (remainingDailyTargetHours <= 0) break; // Daily target met
                // If this hour is already covered by an existing shift or previously scheduled shift
                if (dailyCoverage[coverageIndex]) {
                    // console.log(`Hour ${currentHour} is already covered.`); // Debugging
                    continue; 
                }

                // Try to fill this specific hour slot
                let scheduledForThisHour = false;

                // Step 1: Try to schedule a Full-time employee first
                const eligibleFTEmployees = employeeScheduleData.filter(emp => {
                    if (emp.employment_type !== 'Full-time') return false; // Only FT
                    if (emp.daysWorked >= 5) return false; // Max days worked (2 days off rule)
                    if (emp.scheduled_hours >= 40) return false; // Max weekly hours for FT (40 hours)

                    const dayAvail = emp.availability && emp.availability[dayName];
                    const FULL_TIME_WORK_DURATION = 8;
                    const FULL_TIME_BREAK_DURATION = 0.5;
                    const FULL_TIME_SHIFT_LENGTH_TOTAL = FULL_TIME_WORK_DURATION + FULL_TIME_BREAK_DURATION;

                    // Check if employee's availability covers the full shift starting from currentHour
                    // And if the shift would end within business hours
                    return dayAvail && 
                           parseInt(dayAvail.start.split(':')[0], 10) <= currentHour && // Check start time
                           parseInt(dayAvail.end.split(':')[0], 10) >= (currentHour + FULL_TIME_SHIFT_LENGTH_TOTAL) && // Check end time
                           (currentHour + FULL_TIME_SHIFT_LENGTH_TOTAL) <= businessEndHour; // Ensure shift does not extend beyond business operating end hour
                }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize FTs with fewer hours scheduled

                if (eligibleFTEmployees.length > 0) {
                    const employeeScheduled = eligibleFTEmployees[0]; // Take the first eligible FT
                    const FULL_TIME_WORK_DURATION = 8;
                    const FULL_TIME_BREAK_DURATION = 0.5;

                    const shiftStartTime = new Date(currentDate);
                    shiftStartTime.setHours(currentHour, 0, 0, 0); // Shift starts at currentHour

                    const shiftEndTime = new Date(currentDate);
                    // Shift ends after actual work duration + break duration (e.g., 8 hours work + 30 min lunch)
                    shiftEndTime.setHours(currentHour + FULL_TIME_WORK_DURATION, FULL_TIME_BREAK_DURATION * 60, 0, 0); 

                    await client.query(
                        'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                        [employeeScheduled.user_id, employeeScheduled.location_id, shiftStartTime, shiftEndTime, `Auto-generated FT - Covers ${currentHour}-${currentHour + FULL_TIME_WORK_DURATION} + Break`] // Added more descriptive note
                    );
                    employeeScheduled.scheduled_hours += FULL_TIME_WORK_DURATION; // Add actual work hours to weekly total
                    employeeScheduled.daysWorked++; // Increment days worked
                    remainingDailyTargetHours -= FULL_TIME_WORK_DURATION; // Reduce remaining target for the day
                    totalShiftsCreated++;
                    scheduledForThisHour = true;

                    // Mark covered hours
                    for (let h = currentHour; h < currentHour + FULL_TIME_WORK_DURATION; h++) {
                        const idx = h - businessStartHour;
                        if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                    }
                    // No break here, allow other shifts to overlap to ensure coverage
                }

                // Step 2: If no FT was scheduled for this slot, try to schedule a Part-time employee
                if (!scheduledForThisHour && remainingDailyTargetHours > 0) {
                    const eligiblePTEmployees = employeeScheduleData.filter(emp => {
                        if (emp.employment_type !== 'Part-time') return false; // Only PT
                        if (emp.daysWorked >= 5) return false; // Max days worked (2 days off rule)

                        const dayAvail = emp.availability && emp.availability[dayName];
                        const PART_TIME_SHIFT_LENGTH = 4; // Hours
                        
                        // Check if employee's availability covers the full shift starting from currentHour
                        // And if the shift would end within business hours
                        return dayAvail && 
                               parseInt(dayAvail.start.split(':')[0], 10) <= currentHour && 
                               parseInt(dayAvail.end.split(':')[0], 10) >= (currentHour + PART_TIME_SHIFT_LENGTH) &&
                               (currentHour + PART_TIME_SHIFT_LENGTH) <= businessEndHour;
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize PTs with fewer hours scheduled

                    if (eligiblePTEmployees.length > 0) {
                        const employeeScheduled = eligiblePTEmployees[0]; // Take the first eligible PT
                        const PART_TIME_SHIFT_LENGTH = 4; // Hours

                        const shiftStartTime = new Date(currentDate);
                        shiftStartTime.setHours(currentHour, 0, 0, 0);

                        const shiftEndTime = new Date(currentDate);
                        shiftEndTime.setHours(currentHour + PART_TIME_SHIFT_LENGTH, 0, 0, 0);

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduled.user_id, employeeScheduled.location_id, shiftStartTime, shiftEndTime, `Auto-generated PT - Covers ${currentHour}-${currentHour + PART_TIME_SHIFT_LENGTH}`] // Added descriptive note
                        );
                        employeeScheduled.scheduled_hours += PART_TIME_SHIFT_LENGTH;
                        employeeScheduled.daysWorked++;
                        remainingDailyTargetHours -= PART_TIME_SHIFT_LENGTH;
                        totalShiftsCreated++;
                        scheduledForThisHour = true;

                        // Mark covered hours
                        for (let h = currentHour; h < currentHour + PART_TIME_SHIFT_LENGTH; h++) {
                            const idx = h - businessStartHour;
                            if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                        }
                    }
                }

                // If this hour could not be scheduled, the loop will naturally advance to the next currentHour
                // No explicit currentSchedulingTime advancement here as the loop iterates hour by hour.
            }
        }

        await client.query('COMMIT'); // Commit the transaction if all operations succeed
        res.status(201).json({ message: `Successfully auto-generated ${totalShiftsCreated} shifts.` });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback the transaction if any error occurs
        console.error('Auto-scheduling failed:', error);
        res.status(500).json({ error: 'An error occurred during auto-scheduling.' });
    } finally {
        client.release(); // Release the database client back to the pool
    }
};


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
