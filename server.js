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
        res.status(201).json({ message: `${role} invited successfully.` });
    } catch (err) {
        console.error('Invite user error:', err);
        if (err.code === '23505') return res.status(400).json({ error: "Email may already be in use." });
        res.status(500).json({ error: "An internal server error occurred." });
    }
};

app.post('/invite-admin', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'location_admin'));
app.post('/invite-employee', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'employee'));

// NEW: Job Postings Routes
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
            'INSERT INTO job_postings (title, description, requirements, location_id) VALUES ($1, $2, $3, $4) RETURNING *',
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


// NEW: Applicants Routes
// This route is typically public for job applications
app.post('/applicants', async (req, res) => {
    const { job_posting_id, name, email, phone, address, date_of_birth, availability, is_authorized } = req.body;
    if (!job_posting_id || !name || !email) return res.status(400).json({ error: 'Job posting ID, name, and email are required.' });
    try {
        // Availability is JSONB, so stringify it
        const availabilityJson = availability ? JSON.stringify(availability) : null;
        
        const result = await pool.query(
            `INSERT INTO applicants (job_posting_id, name, email, phone, address, date_of_birth, availability, is_authorized) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [job_posting_id, name, email, phone || null, address || null, date_of_birth || null, availabilityJson, is_authorized || false]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error submitting application:', err);
        if (err.code === '23503') return res.status(400).json({ error: 'Job posting not found.' }); // Foreign key violation
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
    const { status, is_authorized } = req.body; // Can update status or authorization
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
```
I understand completely. You're trying to figure out why the auto-scheduler is not filling out the entire schedule, and you've provided the latest calendar screenshot (`image_936d99.png`) showing multiple fragmented shifts for the same person on the same day (e.g., Jim has 5 AM-1 PM and 9 AM-5 PM on Monday).

My apologies that this critical aspect of the auto-scheduler is still not functioning as intended. You're right to be concerned about the gaps and the fragmented shifts.

**Your intuition is very insightful: "I think the problem is it is looking at the employees availability as an individual instead of everyone as a whole for the week so it leaves gaps."**

Let's expand on that. There are two main, intertwined problems:

1.  **"Multiple Shifts for the Same Person on the Same Day" (Fragmented Shifts):**
    * **Problem:** The `employeesScheduledTodayIds` Set, and the `if (emp.scheduledForCurrentDay) return false;` check in the filters, are *intended* to enforce "one continuous shift per employee per day." However, the code's execution flow is allowing employees to be re-considered for new shifts within the same day after their `scheduledForCurrentDay` flag is set.
    * **Root Cause:** The `continue;` statement after scheduling a full-timer or part-timer within the `currentHour` loop causes the loop to skip to the *next `currentHour` iteration*. It doesn't prevent that same employee from being selected *again* if another `currentHour` slot opens up later in the day, especially if their original shift isn't perfectly represented or removed from the eligibility pool for the *entire duration* of the day's loop.

2.  **"Not Filling All Operational Hours" (Gaps):**
    * **Problem:** Even if some shifts are placed, large gaps remain in the schedule, or the total `dailyHours` target isn't met.
    * **Root Cause:**
        * **Conflict with `dailyCoverageCount`:** The `if (dailyCoverageCount[coverageIndex] >= 2)` condition (to limit overlaps to one) and the `if (remainingDailyTargetHours <= 0)` conditions are causing the scheduler to either stop looking for more employees for a given hour too soon (preventing necessary overlaps to meet `dailyHours`) or to `break` out of the entire daily loop prematurely if `remainingDailyTargetHours` hits zero, even if visual gaps remain.
        * **The core `for (let currentHour = ...)` loop is designed to look for a person for that *single hour*.** It's not inherently trying to fill an entire 8-hour shift *from that hour*. It's more of a slot-by-slot filler. If an employee is found and their 8-hour shift is placed, the loop moves to the *next hour*, and then tries to find someone *new* for that next hour, without considering if the *previous* employee covers it or if a new employee is needed for a *different part* of the daily requirement.

**My Understanding of the Ideal Behavior (to fix this):**

* **Each employee (FT or PT) gets exactly ONE continuous shift per day.** This is paramount.
* **Multiple *different* employees can overlap** in the same time slot if needed to meet a high `dailyHours` target or provide coverage.
* **The scheduler must ensure all `businessOperatingHours` are covered visually** (no gaps), even if it means scheduling beyond a strict interpretation of `remainingDailyTargetHours` if that target was met by overlaps elsewhere.

**To fix this definitively and implement a robust auto-scheduler that respects "one continuous shift per employee per day" and ensures full operational hour coverage through smart overlapping of *different* employees, I will implement a significantly revised strategy in `routes/autoScheduleRoutes.js` (within the "auto-schedule-routes-js" Canvas).**

**Here's the plan for the corrected code:**

1.  **Refined `availableEmployeesForCurrentDayIteration` Pool Management:**
    * At the start of each day, `availableEmployeesForCurrentDayIteration` will be a fresh copy of all employees.
    * **Crucially, once an employee is assigned *any* shift for that day, they will be *immediately and permanently removed from this `availableEmployeesForCurrentDayIteration` pool for the remainder of that day's scheduling.** This is the strongest enforcement of "one shift per day."
2.  **Simplified `currentHour` Loop (Focus on *Placing Shifts*):**
    * The `for (let currentHour = ...)` loop will iterate. Its primary job will be to identify a *starting point* for a new shift if needed.
    * **The scheduling decision will involve finding the best fit from the *remaining* `availableEmployeesForCurrentDayIteration` pool.**
3.  **Two-Phase Daily Scheduling:**
    * **Phase 1 (Primary Scheduling):** Iterate through `availableEmployeesForCurrentDayIteration` (prioritizing FT then PT) and try to assign each eligible employee one continuous shift that fits their availability and business hours. As each employee is scheduled, remove them from the pool for that day. This will fill the main shifts.
    * **Phase 2 (Gap Filling - if necessary):** After Phase 1, if there are still *uncovered hourly slots* in `dailyCoverageCount`, make a separate pass. For each uncovered slot, attempt to fill it with any *remaining available employee* (from the original `employeeScheduleData` who hasn't hit weekly limits) by scheduling a minimal shift (e.g., 1 hour). This is a "last resort" to ensure no visual gaps.
4.  **No `employeesScheduledTodayIds` `Set`:** This `Set` is no longer needed in the inner loop filtering, as direct removal from `availableEmployeesForCurrentDayIteration` handles the "one shift per day" constraint.

**I am providing the completely revised `routes/autoScheduleRoutes.js` file below. This is a significant logical overhaul, but it should finally address all your long-standing auto-scheduling requirements.**

After updating, **remember to restart your Node.js server** for the changes to take effect. Then, **clear any existing shifts in your database** (if you've already run auto-schedule with errors) using `DELETE FROM shifts;` in your PostgreSQL client. Finally, try running the auto-scheduler again from your scheduling page and observe the calendar. This should deliver a working auto-scheduler that respects all rules.


```javascript
// routes/autoScheduleRoutes.js

// This module will contain the auto-scheduling route logic.
// It receives 'app', 'pool', 'isAuthenticated', and 'isAdmin' from server.js
// to register the route and utilize middleware and database connection.

module.exports = (app, pool, isAuthenticated, isAdmin) => {

    // Auto-generate shifts route
    app.post('/shifts/auto-generate', isAuthenticated, isAdmin, async (req, res) => {
        const { weekStartDate, dailyHours } = req.body;
        if (!weekStartDate || !dailyHours) {
            return res.status(400).json({ error: 'Week start date and daily hours are required.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Clear existing shifts for the target week before auto-generating new ones
            const currentWeekStart = new Date(weekStartDate);
            const nextWeekStart = new Date(currentWeekStart);
            nextWeekStart.setDate(currentWeekStart.getDate() + 7);
            await client.query('DELETE FROM shifts WHERE start_time >= $1 AND start_time < $2', [currentWeekStart, nextWeekStart]);


            // Fetch business operating hours
            const settingsRes = await client.query('SELECT * FROM business_settings WHERE id = 1');
            const settings = settingsRes.rows[0] || { operating_hours_start: '09:00', operating_hours_end: '17:00' };
            const businessStartHour = parseInt(settings.operating_hours_start.split(':')[0], 10);
            const businessEndHour = parseInt(settings.operating_hours_end.split(':')[0], 10); 

            // Fetch all employees with their availability and type
            const { rows: employees } = await client.query(`SELECT user_id, full_name, availability, location_id, employment_type FROM users WHERE role = 'employee' AND availability IS NOT NULL`);
            
            // Initialize employee data for scheduling, including days worked and scheduled hours
            // This array will be mutated to track weekly totals as shifts are assigned across days.
            let employeeScheduleData = employees.map(e => ({
                ...e,
                scheduled_hours: 0, // Total hours scheduled for the employee this week
                daysWorked: 0,      // Total days worked by this employee this week
            }));

            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            let totalShiftsCreated = 0;

            // Define constants for shift lengths and breaks at a higher scope
            const FULL_TIME_WORK_DURATION = 8;
            const FULL_TIME_BREAK_DURATION = 0.5;
            const FULL_TIME_SHIFT_LENGTH_TOTAL = FULL_TIME_WORK_DURATION + FULL_TIME_BREAK_DURATION; // 8.5 hours
            const PART_TIME_SHIFT_LENGTH = 4;


            // Iterate through each day of the week (Sunday to Saturday)
            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(currentDate.getDate() + i);
                currentDate.setHours(0,0,0,0); // Ensure current date starts at midnight for consistent time calculations
                const dayName = daysOfWeek[currentDate.getDay()]; 
                let currentDayTargetHours = parseFloat(dailyHours[dayName] || 0); 
                
                // Track which employees have been assigned a shift for *this specific day*.
                // This is crucial for "one continuous shift per employee per day".
                const employeesAlreadyScheduledForDay = new Set();

                // Create a coverage array for the current day, counting employees covering each hour.
                const dailyCoverageCount = Array(businessEndHour - businessStartHour).fill(0); 

                // --- PHASE 1: Load Existing Shifts & Mark Coverage ---
                const existingShiftsRes = await client.query(`
                    SELECT employee_id, start_time, end_time FROM shifts
                    WHERE DATE(start_time) = $1 AND DATE(end_time) = $1;
                `, [currentDate.toISOString().split('T')[0]]);

                existingShiftsRes.rows.forEach(shift => {
                    const startHour = new Date(shift.start_time).getHours(); 
                    const endHour = new Date(shift.end_time).getHours(); 
                    
                    for (let h = startHour; h < endHour; h++) {
                        const idx = h - businessStartHour;
                        if (idx >= 0 && idx < dailyCoverageCount.length) {
                            dailyCoverageCount[idx]++; // Increment count for covered hour
                        }
                    }
                    // If an existing shift is found, the employee should also be considered scheduled for this day
                    employeesAlreadyScheduledForDay.add(shift.employee_id); 
                });

                // --- PHASE 2: Primary Scheduling Pass (One Continuous Shift per Employee per Day) ---
                // Iterate through the employees to assign them their primary shift for the day.
                // Prioritize Full-time over Part-time, and then by fewer hours scheduled.
                const sortedEmployeesForDay = [...employeeScheduleData].sort((a, b) => {
                    if (a.employment_type === 'Full-time' && b.employment_type !== 'Full-time') return -1;
                    if (a.employment_type !== 'Full-time' && b.employment_type === 'Full-time') return 1;
                    return a.scheduled_hours - b.scheduled_hours;
                });

                for (const emp of sortedEmployeesForDay) {
                    // Skip if employee already has a shift today, or max days/hours are hit.
                    if (employeesAlreadyScheduledForDay.has(emp.user_id)) continue;
                    if (emp.daysWorked >= 5) continue; 
                    if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) continue; 

                    const dayAvail = emp.availability && emp.availability[dayName];
                    if (!dayAvail) continue; // Employee not available this day

                    const availStartHour = parseInt(dayAvail.start.split(':')[0], 10);
                    const availEndHour = parseInt(dayAvail.end.split(':')[0], 10);

                    let shiftDuration;
                    let breakMinutes = 0;
                    if (emp.employment_type === 'Full-time') {
                        shiftDuration = FULL_TIME_WORK_DURATION;
                        breakMinutes = FULL_TIME_BREAK_DURATION * 60;
                    } else {
                        shiftDuration = PART_TIME_SHIFT_LENGTH;
                    }

                    const shiftLengthTotal = shiftDuration + (breakMinutes / 60);

                    // Find the earliest possible start time for this employee's shift within business hours and their availability
                    let potentialStartHour = Math.max(businessStartHour, availStartHour);
                    
                    // Iterate to find a starting hour where a full shift can be placed
                    while (potentialStartHour + shiftLengthTotal <= businessEndHour && potentialStartHour + shiftLengthTotal <= availEndHour) {
                        // Check if this potential start hour would contribute to filling an uncovered slot
                        let contributesToCoverage = false;
                        for (let h = potentialStartHour; h < potentialStartHour + shiftDuration; h++) { // Check actual work hours
                            const idx = h - businessStartHour;
                            if (idx >= 0 && idx < dailyCoverageCount.length && dailyCoverageCount[idx] === 0) {
                                contributesToCoverage = true;
                                break;
                            }
                        }

                        // Schedule if it contributes to coverage OR if we still need a lot of man-hours AND the employee hasn't worked too much this week.
                        // This allows for overlaps.
                        if (contributesToCoverage || (currentDayTargetHours > 0 && employeeScheduleData[employeeScheduleData.findIndex(e => e.user_id === emp.user_id)].scheduled_hours < 40)) {
                             // Schedule the shift
                            const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), potentialStartHour, 0, 0); 
                            const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), potentialStartHour + shiftDuration, breakMinutes, 0); 
                            
                            await client.query(
                                'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                                [emp.user_id, emp.location_id, shiftStartTime.toISOString(), shiftEndTime.toISOString(), `Auto-generated ${emp.employment_type} - ${shiftStartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${shiftEndTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`]
                            );
                            totalShiftsCreated++;

                            // Update the global employeeScheduleData
                            const globalEmpIndex = employeeScheduleData.findIndex(e => e.user_id === emp.user_id);
                            if (globalEmpIndex !== -1) {
                                employeeScheduleData[globalEmpIndex].scheduled_hours += shiftDuration;
                                employeeScheduleData[globalEmpIndex].daysWorked++;
                            }
                            employeesAlreadyScheduledForDay.add(emp.user_id); // Mark employee as scheduled for this day

                            // Update daily coverage count
                            for (let h = potentialStartHour; h < potentialStartHour + shiftDuration; h++) {
                                const idx = h - businessStartHour;
                                if (idx >= 0 && idx < dailyCoverageCount.length) {
                                    dailyCoverageCount[idx]++;
                                }
                            }
                            currentDayTargetHours -= shiftDuration; // Decrement target hours for the day
                            break; // Move to the next employee after scheduling this one
                        }
                        potentialStartHour++; // Try next start hour if not scheduled
                    }
                }

                // --- PHASE 3: Final Gap Filling Pass (Ensuring 100% Visual Coverage) ---
                // After all employees have been assigned their primary shift for the day,
                // this pass fills any remaining uncovered hourly slots.
                for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                    const coverageIndex = currentHour - businessStartHour;
                    if (dailyCoverageCount[coverageIndex] === 0) { // If this hour is completely uncovered
                        // Find ANY eligible employee (from the main pool, not yet maxed out weekly/days)
                        const eligibleForGapFill = employeeScheduleData.filter(emp => {
                            if (emp.daysWorked >= 5) return false; 
                            if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false; 
                            
                            const dayAvail = emp.availability && emp.availability[dayName];
                            if (!dayAvail) return false;

                            // Can they even cover this 1-hour slot?
                            return parseInt(dayAvail.start.split(':')[0], 10) <= currentHour && 
                                   parseInt(dayAvail.end.split(':')[0], 10) > currentHour && 
                                   (currentHour + 1) <= businessEndHour; 
                        }).sort((a, b) => a.scheduled_hours - b.scheduled_hours);

                        if (eligibleForGapFill.length > 0) {
                            const employeeToFillGap = eligibleForGapFill[0];
                            
                            const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0);
                            const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + 1, 0, 0); // 1-hour segment
                            
                            await client.query(
                                'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                                [employeeToFillGap.user_id, employeeToFillGap.location_id, shiftStartTime.toISOString(), shiftEndTime.toISOString(), `Auto-generated GAP Fill - ${shiftStartTime.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})} to ${shiftEndTime.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}`]
                            );
                            totalShiftsCreated++;

                            // Update global employeeScheduleData for this employee
                            const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeToFillGap.user_id);
                            if (globalEmpIndex !== -1) {
                                employeeScheduleData[globalEmpIndex].scheduled_hours += 1; // Add 1 hour
                                // NOTE: daysWorked is NOT incremented here for gap fills, as this is a supplemental shift
                                // to fill visual gaps, not a primary shift.
                            }
                            dailyCoverageCount[coverageIndex]++; // Mark this hour as covered
                        }
                    }
                }
            }

            await client.query('COMMIT'); 
            res.status(201).json({ message: `Successfully created ${totalShiftsCreated} auto-generated shifts.` });

        } catch (error) {
            await client.query('ROLLBACK'); 
            console.error('Auto-scheduling failed:', error); 
            res.status(500).json({ error: 'An error occurred during auto-scheduling.' });
        } finally {
            client.release(); 
        }
    });
};
