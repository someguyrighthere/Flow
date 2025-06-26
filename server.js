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

// NOTE: utils.js is a frontend file and should NOT be imported here in the backend.
// If you see an import statement for utils.js here, please remove it.
// Example of what NOT to have:
// import { apiRequest, showModalMessage, showConfirmModal } from './utils.js'; 

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
// Serve static files from the root of the project (your HTML, CSS, JS folders)
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));


// --- 5. Authentication Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401); // Unauthorized
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden (invalid token)
        req.user = user; // Attach user payload to request
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

// Serve the main index.html file for the root URL
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
        
        // Compare provided password with hashed password in database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials." });
        
        // Generate JWT token for authentication
        const payload = { id: user.user_id, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' }); // Token expires in 1 day
        
        res.json({ message: "Logged in successfully!", token: token, role: user.role });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "An internal server error occurred during login." });
    }
});

// Get current user's profile
app.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Get user profile error:", err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

// Update current user's profile
app.put('/users/me', isAuthenticated, async (req, res) => {
    const { full_name, email, current_password, new_password } = req.body;
    const userId = req.user.id;
    try {
        // Handle password change if new_password is provided
        if (new_password) {
            if (!current_password) return res.status(400).json({ error: 'Current password is required to change password.' });
            const userRes = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
            const user = userRes.rows[0];
            // Verify current password before updating to new password
            const isMatch = await bcrypt.compare(current_password, user.password);
            if (!isMatch) return res.status(401).json({ error: 'Incorrect current password.' });
            const newHashedPassword = await bcrypt.hash(new_password, 10);
            await pool.query('UPDATE users SET password = $1 WHERE user_id = $2', [newHashedPassword, userId]);
        }
        // Update user's name and email
        await pool.query('UPDATE users SET full_name = $1, email = $2 WHERE user_id = $3', [full_name, email, userId]);
        res.json({ message: 'Profile updated successfully.' });
    } catch (err) {
        console.error("Update user profile error:", err);
        if (err.code === '23505') return res.status(400).json({ error: 'This email is already in use by another account.' });
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// Admin & Business Settings Routes
// Get business operating hours
app.get('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM business_settings WHERE id = 1');
        if (result.rows.length === 0) {
            // Return default settings if none are configured yet
            return res.json({ operating_hours_start: '09:00', operating_hours_end: '17:00' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Get business settings error:", err);
        res.status(500).json({ error: 'Failed to retrieve business settings.' });
    }
});

// Set or update business operating hours
app.post('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    const { operating_hours_start, operating_hours_end } = req.body;
    try {
        // Use INSERT ON CONFLICT DO UPDATE to upsert settings (create if not exists, update if exists)
        const query = `
            INSERT INTO business_settings (id, operating_hours_start, operating_hours_end) 
            VALUES (1, $1, $2)
            ON CONFLICT (id) 
            DO UPDATE SET operating_hours_start = EXCLUDED.operating_hours_start, operating_hours_end = EXCLUDED.operating_hours_end;
        `;
        await pool.query(query, [operating_hours_start, operating_hours_end]);
        res.json({ message: 'Business settings saved successfully.' });
    } catch (err) {
        console.error("Save business settings error:", err);
        res.status(500).json({ error: 'Failed to save business settings.' });
    }
});

// Get all locations
app.get('/locations', isAuthenticated, async (req, res) => {
    // Both admins and employees need to see locations for various features (e.g., scheduling)
    // Removed isAdmin middleware as per broader app requirements
    try {
        const result = await pool.query("SELECT * FROM locations ORDER BY location_name");
        res.json(result.rows);
    } catch (err) {
        console.error("Get locations error:", err);
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});

// Create a new location (Admin only)
app.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
    const { location_name, location_address } = req.body;
    if (!location_name || !location_address) return res.status(400).json({ error: 'Location name and address are required.' });
    try {
        const result = await pool.query(`INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING *`, [location_name, location_address]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error("Create location error:", err);
        res.status(400).json({ error: 'Failed to create location. Location name might already exist.' });
    }
});

// Delete a location (Admin only)
app.delete('/locations/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`DELETE FROM locations WHERE location_id = $1`, [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Location not found.' });
        res.status(204).send(); // No content to send back on successful deletion
    } catch (err) {
        console.error("Delete location error:", err);
        res.status(500).json({ error: 'Failed to delete location.' });
    }
});

// Get all users (Admin only)
app.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    const sql = `SELECT u.user_id, u.full_name, u.email, u.role, u.position, u.employment_type, u.availability, l.location_name 
                 FROM users u 
                 LEFT JOIN locations l ON u.location_id = l.location_id 
                 ORDER BY u.full_name`;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error("Get users error:", err);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

// Delete a user (Admin only)
app.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    // Prevent admin from deleting their own account
    if (req.user.id == req.params.id) return res.status(403).json({ error: "You cannot delete your own account." });
    try {
        const result = await pool.query(`DELETE FROM users WHERE user_id = $1`, [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
        res.status(204).send(); // No content
    } catch (err) {
        console.error("Delete user error:", err);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

// Helper function to invite users (admins/employees)
const inviteUser = async (req, res, role) => {
    const { full_name, email, password, location_id, position, employment_type, availability } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: "Full name, email, and password are required." });
    try {
        const hash = await bcrypt.hash(password, 10); // Hash password before storing
        const result = await pool.query(
            `INSERT INTO users (full_name, email, password, role, position, location_id, employment_type, availability) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING user_id;`,
            [full_name, email, hash, role, position || null, location_id || null, employment_type || null, availability ? JSON.stringify(availability) : null]
        );
        res.status(201).json({ message: `${role} invited successfully.`, userId: result.rows[0].user_id, tempPassword: password }); // Return temp password for display once
    } catch (err) {
        console.error('Invite user error:', err);
        if (err.code === '23505') return res.status(400).json({ error: "Email already in use. Please use a different email." });
        res.status(500).json({ error: "An internal server error occurred during user invitation." });
    }
};

// Invite new location admin (Super admin only)
app.post('/invite-admin', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'location_admin'));
// Invite new employee (Admin only)
app.post('/invite-employee', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'employee'));


// Scheduling Routes
// Get employee availability (accessible to authenticated users, but filtered for employees)
app.get('/users/availability', isAuthenticated, async (req, res) => {
    // This route can be accessed by any authenticated user to get employee availability.
    // Frontend logic should ensure only admins typically see this.
    try {
        const result = await pool.query("SELECT user_id, full_name, availability FROM users WHERE role = 'employee' AND availability IS NOT NULL");
        res.json(result.rows);
    } catch (err) {
        console.error("Get employee availability error:", err);
        res.status(500).json({ error: 'Failed to retrieve employee availability.' });
    }
});

// Get shifts within a date range
app.get('/shifts', isAuthenticated, async (req, res) => {
    // Admins need all shifts. Employees only need their own shifts.
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start date and end date are required for fetching shifts.' });

    let sql = `
        SELECT s.id, s.employee_id, s.location_id, s.start_time, s.end_time, s.notes, 
               u.full_name as employee_name, l.location_name
        FROM shifts s
        JOIN users u ON s.employee_id = u.user_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        WHERE s.start_time >= $1 AND s.start_time < $2
    `;
    const params = [startDate, endDate];

    // If the user is an employee, filter shifts by their user_id
    if (req.user.role === 'employee') {
        sql += ` AND s.employee_id = $3`;
        params.push(req.user.id);
    }

    sql += ` ORDER BY s.start_time;`;

    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Get shifts error:", err);
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});

// Create a new shift (Admin only)
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
        console.error("Create shift error:", err);
        res.status(500).json({ error: 'Failed to create shift.' });
    }
});

// Delete a shift (Admin only)
app.delete('/shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM shifts WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Shift not found.' });
        }
        res.status(204).send(); // No content to send back on successful deletion
    } catch (err) {
        console.error('Delete shift error:', err);
        res.status(500).json({ error: 'Failed to delete shift.' });
    }
});

// Auto-generate shifts (Admin only)
app.post('/shifts/auto-generate', isAuthenticated, isAdmin, async (req, res) => {
    const { weekStartDate, dailyHours } = req.body;
    if (!weekStartDate || !dailyHours) {
        return res.status(400).json({ error: 'Week start date and daily hours are required for auto-generation.' });
    }

    const client = await pool.connect(); // Acquire a client from the pool
    try {
        await client.query('BEGIN'); // Start a transaction for atomicity

        const settingsRes = await client.query('SELECT * FROM business_settings WHERE id = 1');
        const settings = settingsRes.rows[0] || { operating_hours_start: '09:00', operating_hours_end: '17:00' };
        const businessStartHour = parseInt(settings.operating_hours_start.split(':')[0], 10);
        
        // Fetch all employees with availability
        const { rows: employees } = await client.query(`SELECT user_id, availability, location_id, employment_type FROM users WHERE role = 'employee' AND availability IS NOT NULL`);
        
        let employeeScheduleData = employees.map(e => ({...e, scheduled_hours: 0})); // Track scheduled hours per employee

        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        let totalShiftsCreated = 0;

        // Helper function to create a shift and update scheduled hours
        const scheduleEmployee = async (employee, shiftLength) => {
            const shiftStartTime = new Date(weekStartDate);
            shiftStartTime.setDate(shiftStartTime.getDate() + daysOfWeek.indexOf(dayName)); // Set correct day
            shiftStartTime.setHours(businessStartHour, 0, 0, 0);

            const shiftEndTime = new Date(shiftStartTime);
            shiftEndTime.setHours(shiftStartTime.getHours() + shiftLength, 0, 0, 0);

            await client.query(
                'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                [employee.user_id, employee.location_id, shiftStartTime, shiftEndTime, 'Auto-generated']
            );
            employee.scheduled_hours += shiftLength;
            totalShiftsCreated++;
        };

        // Loop through each day of the week
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(weekStartDate);
            currentDate.setDate(currentDate.getDate() + i); // Set to the specific day of the week
            const dayName = daysOfWeek[currentDate.getDay()]; // Get the lowercase day name (e.g., 'monday')
            let hoursToSchedule = parseFloat(dailyHours[dayName] || 0); // Get desired hours for this day

            // Prioritize full-time employees
            for (const emp of employeeScheduleData.filter(e => e.employment_type === 'Full-time')) {
                if (hoursToSchedule <= 0) break; // Stop if target hours for the day are met
                // Basic check for availability and max hours
                if (emp.scheduled_hours < 40) { // Max 40 hours for full-time
                    const dayAvail = emp.availability[dayName];
                    // Check if employee is available for an 8-hour block starting at business hours
                    if (dayAvail && parseInt(dayAvail.start.split(':')[0]) <= businessStartHour && parseInt(dayAvail.end.split(':')[0]) >= (businessStartHour + 8)) {
                       await scheduleEmployee(emp, 8); // Schedule an 8-hour shift
                       hoursToSchedule -= 8;
                    }
                }
            }

            // Then schedule part-time employees
            for (const emp of employeeScheduleData.filter(e => e.employment_type === 'Part-time')) {
                if (hoursToSchedule <= 0) break; // Stop if target hours for the day are met
                 // Basic check for availability
                 const dayAvail = emp.availability[dayName];
                 // Check if employee is available for a 4-hour block
                 if (dayAvail && parseInt(dayAvail.start.split(':')[0]) <= businessStartHour && parseInt(dayAvail.end.split(':')[0]) >= (businessStartHour + 4)) {
                    await scheduleEmployee(emp, 4); // Schedule a 4-hour shift
                    hoursToSchedule -= 4;
                }
            }
        }

        await client.query('COMMIT'); // Commit the transaction
        res.status(201).json({ message: `Successfully auto-generated ${totalShiftsCreated} shifts.` });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Auto-scheduling failed:', error);
        res.status(500).json({ error: 'An error occurred during auto-scheduling: ' + error.message });
    } finally {
        client.release(); // Release the client back to the pool
    }
});


// Onboarding & Checklists Routes (existing or placeholders)
app.post('/onboard-employee', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, position_id, employee_id } = req.body;
    // Assuming 'position_id' from frontend maps to a checklist position text
    // Generate a temporary password for the new employee
    const tempPassword = Math.random().toString(36).slice(-8); // Simple random password
    try {
        const hash = await bcrypt.hash(tempPassword, 10);
        const userResult = await pool.query(
            `INSERT INTO users (full_name, email, password, role, position, employee_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id;`,
            [full_name, email, hash, 'employee', position_id, employee_id]
        );
        const newUserId = userResult.rows[0].user_id;

        // Fetch the checklist for the given position
        const checklistRes = await pool.query(`SELECT id, tasks, structure_type, time_group_count FROM checklists WHERE position = $1`, [position_id]);
        const checklist = checklistRes.rows[0];

        if (checklist && checklist.tasks && checklist.tasks.length > 0) {
            // Create initial onboarding tasks for the new user based on the checklist template
            for (const task of checklist.tasks) {
                await pool.query(
                    `INSERT INTO onboarding_tasks (user_id, checklist_id, description, completed, document_id, document_name, task_order, group_index) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
                    [newUserId, checklist.id, task.description, false, task.documentId || null, task.documentName || null, task.order, task.group_index || null]
                );
            }
        }

        res.status(201).json({ message: 'Onboarding invite sent.', tempPassword: tempPassword, userId: newUserId });

    } catch (err) {
        console.error('Onboard employee error:', err);
        if (err.code === '23505') return res.status(400).json({ error: "Email or Employee ID already in use." });
        res.status(500).json({ error: "Failed to onboard employee." });
    }
});

app.get('/positions', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT position as name, id FROM checklists WHERE position IS NOT NULL AND position != \'\'');
        res.json({ positions: result.rows });
    } catch (err) {
        console.error("Error fetching positions:", err);
        res.status(500).json({ error: "Failed to retrieve positions." });
    }
});

app.get('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, position, title, structure_type, time_group_count, tasks FROM checklists ORDER BY position, title');
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching checklists:", err);
        res.status(500).json({ error: "Failed to retrieve checklists." });
    }
});

app.post('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    const { position, title, tasks, structure_type, time_group_count } = req.body;
    if (!position || !title || !tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: "Position, title, and at least one task are required." });
    }
    try {
        const result = await pool.query(
            `INSERT INTO checklists (position, title, tasks, structure_type, time_group_count) VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
            [position, title, JSON.stringify(tasks), structure_type, time_group_count]
        );
        res.status(201).json({ message: "Checklist created successfully!", id: result.rows[0].id });
    } catch (err) {
        console.error("Error creating checklist:", err);
        res.status(500).json({ error: "Failed to create checklist." });
    }
});

app.delete('/checklists/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM checklists WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Checklist not found.' });
        res.status(204).send();
    } catch (err) {
        console.error("Error deleting checklist:", err);
        res.status(500).json({ error: 'Failed to delete checklist.' });
    }
});


// New-Hire View related routes
app.get('/onboarding-tasks/:userId', isAuthenticated, async (req, res) => {
    const { userId } = req.params;
    // Allow employee to see their own tasks, or admin to see any employee's tasks
    if (req.user.role === 'employee' && req.user.id != userId) {
        return res.status(403).json({ error: 'Access denied. You can only view your own onboarding tasks.' });
    }
    try {
        // Fetch user details along with their tasks
        const userResult = await pool.query('SELECT user_id, full_name, position FROM users WHERE user_id = $1', [userId]);
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const tasksResult = await pool.query(
            'SELECT id, description, completed, document_id, document_name, task_order, group_index FROM onboarding_tasks WHERE user_id = $1 ORDER BY task_order',
            [userId]
        );
        
        res.json({
            full_name: user.full_name,
            position: user.position,
            tasks: tasksResult.rows
        });

    } catch (err) {
        console.error("Error fetching onboarding tasks:", err);
        res.status(500).json({ error: 'Failed to retrieve onboarding tasks.' });
    }
});

app.put('/onboarding-tasks/:taskId', isAuthenticated, async (req, res) => {
    const { taskId } = req.params;
    const { completed } = req.body; // Expecting `completed` (boolean) in body

    // Ensure only the owner or an admin can update the task
    try {
        const taskResult = await pool.query('SELECT user_id FROM onboarding_tasks WHERE id = $1', [taskId]);
        if (taskResult.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });
        const taskOwnerId = taskResult.rows[0].user_id;

        if (req.user.role === 'employee' && req.user.id !== taskOwnerId) {
            return res.status(403).json({ error: 'Access denied. You can only update your own tasks.' });
        }
        
        await pool.query('UPDATE onboarding_tasks SET completed = $1 WHERE id = $2', [completed, taskId]);
        res.json({ message: 'Task updated successfully.' });
    } catch (err) {
        console.error("Error updating onboarding task:", err);
        res.status(500).json({ error: 'Failed to update onboarding task.' });
    }
});


// Document Management Routes
const upload = multer({ dest: 'uploads/' }); // Files will be stored in the 'uploads/' directory

app.post('/documents', isAuthenticated, upload.single('document'), async (req, res) => {
    const { title, description } = req.body;
    const file = req.file; // 'file' contains information about the uploaded file

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    if (!title) {
        // If title is missing, delete the uploaded file to clean up
        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });
        return res.status(400).json({ error: 'Document title is required.' });
    }

    try {
        // Insert document metadata into the database
        const result = await pool.query(
            'INSERT INTO documents (user_id, title, description, file_name, file_path, mime_type, size) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING document_id;',
            [req.user.id, title, description || null, file.originalname, file.path, file.mimetype, file.size]
        );
        res.status(201).json({ message: 'Document uploaded successfully!', documentId: result.rows[0].document_id });
    } catch (err) {
        console.error('Document upload database error:', err);
        // If DB insertion fails, delete the uploaded file
        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });
        res.status(500).json({ error: 'Failed to store document metadata. ' + err.message });
    }
});

app.get('/documents', isAuthenticated, async (req, res) => {
    try {
        let sql = 'SELECT document_id, title, description, file_name, uploaded_at FROM documents';
        const params = [];
        // Employees should only see documents they uploaded or those specifically shared (future feature)
        // For now, let's assume all documents are visible to admins, and employees only see theirs if filtered.
        if (req.user.role === 'employee') {
            sql += ' WHERE user_id = $1';
            params.push(req.user.id);
        }
        sql += ' ORDER BY uploaded_at DESC;';

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Get documents error:", err);
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});

app.get('/documents/download/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT file_path, file_name FROM documents WHERE document_id = $1', [id]);
        const document = result.rows[0];

        if (!document) {
            return res.status(404).json({ error: 'Document not found.' });
        }

        // Check file existence
        const filePath = path.join(__dirname, document.file_path);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found on disk: ${filePath}`);
            return res.status(500).json({ error: 'File not found on server storage.' });
        }

        res.download(filePath, document.file_name, (err) => {
            if (err) {
                console.error('File download error:', err);
                res.status(500).json({ error: 'Error downloading the file.' });
            }
        });
    } catch (err) {
        console.error('Download document error:', err);
        res.status(500).json({ error: 'Failed to prepare document for download.' });
    }
});

app.delete('/documents/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch document details to get file_path for deletion from disk
        const docResult = await pool.query('SELECT file_path FROM documents WHERE document_id = $1', [id]);
        const document = docResult.rows[0];

        if (!document) return res.status(404).json({ error: 'Document not found.' });

        // Delete from database
        const dbResult = await pool.query('DELETE FROM documents WHERE document_id = $1', [id]);

        if (dbResult.rowCount > 0) {
            // Attempt to delete file from disk after successful DB deletion
            const filePath = path.join(__dirname, document.file_path);
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting file from disk:', err);
            });
            res.status(204).send();
        } else {
            res.status(404).json({ error: 'Document not found in database.' });
        }
    } catch (err) {
        console.error('Delete document error:', err);
        res.status(500).json({ error: 'Failed to delete document.' });
    }
});


// Hiring Routes
app.get('/job-postings', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT jp.id, jp.title, jp.description, jp.requirements, jp.location_id, l.location_name,
                   (SELECT COUNT(*) FROM applicants a WHERE a.job_posting_id = jp.id) AS applicant_count
            FROM job_postings jp
            LEFT JOIN locations l ON jp.location_id = l.location_id
            ORDER BY jp.created_at DESC;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching job postings:', err);
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});

app.get('/job-postings/:id', async (req, res) => {
    // Public endpoint for job application page
    try {
        const result = await pool.query(`
            SELECT jp.id, jp.title, jp.description, jp.requirements, jp.location_id, l.location_name
            FROM job_postings jp
            LEFT JOIN locations l ON jp.location_id = l.location_id
            WHERE jp.id = $1;
        `, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Job posting not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching single job posting:', err);
        res.status(500).json({ error: 'Failed to retrieve job posting details.' });
    }
});

app.post('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const { title, description, requirements, location_id } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Title and description are required.' });
    try {
        const result = await pool.query(
            'INSERT INTO job_postings (title, description, requirements, location_id) VALUES ($1, $2, $3, $4) RETURNING *;',
            [title, description, requirements || null, location_id || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating job posting:', err);
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});

app.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM job_postings WHERE id = $1', [req.params.id]);
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
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });
    try {
        await pool.query(
            `INSERT INTO applicants (job_posting_id, name, email, phone, address, date_of_birth, availability, is_authorized, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending');`,
            [jobId, name, email, phone || null, address || null, date_of_birth || null, availability || null, is_authorized || false]
        );
        res.status(201).json({ message: 'Application submitted successfully.' });
    } catch (err) {
        console.error('Error submitting application:', err);
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});

app.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    const { jobId, status, locationId } = req.query;
    let sql = `
        SELECT a.id, a.name, a.email, a.status, a.phone, a.address, a.date_of_birth, a.availability, a.is_authorized, 
               jp.title as job_title, l.location_name
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
    try {
        const result = await pool.query(`
            SELECT a.id, a.name, a.email, a.status, a.phone, a.address, a.date_of_birth, a.availability, a.is_authorized, 
                   jp.title as job_title, l.location_name
            FROM applicants a
            JOIN job_postings jp ON a.job_posting_id = jp.id
            LEFT JOIN locations l ON jp.location_id = l.location_id
            WHERE a.id = $1;
        `, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Applicant not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching single applicant:', err);
        res.status(500).json({ error: 'Failed to retrieve applicant details.' });
    }
});

app.put('/applicants/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    if (!status) return res.status(400).json({ error: 'Status is required.' });
    try {
        await pool.query('UPDATE applicants SET status = $1 WHERE id = $2', [status, id]);
        res.json({ message: 'Applicant status updated successfully.' });
    } catch (err) {
        console.error('Error updating applicant status:', err);
        res.status(500).json({ error: 'Failed to update applicant status.' });
    }
});

app.delete('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM applicants WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Applicant not found.' });
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting applicant:', err);
        res.status(500).json({ error: 'Failed to delete applicant.' });
    }
});


// --- 7. Server Startup Logic ---
const startServer = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        
        // Database schema creation queries
        const schemaQueries = `
            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                location_name VARCHAR(255) NOT NULL UNIQUE, -- Added UNIQUE constraint
                location_address TEXT
            );
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'location_admin', 'employee')),
                position VARCHAR(255),
                employee_id VARCHAR(255) UNIQUE, -- Added UNIQUE and made nullable
                location_id INT,
                employment_type VARCHAR(50),
                availability JSONB, -- Stores JSON object for availability
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
                tasks JSONB NOT NULL, -- Array of task objects {description, completed, documentId, documentName, order, group_index}
                structure_type VARCHAR(50) NOT NULL DEFAULT 'single_list', -- 'single_list', 'daily', 'weekly'
                time_group_count INT -- e.g., number of days/weeks for structured lists
            );
            CREATE TABLE IF NOT EXISTS onboarding_tasks (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                checklist_id INT,
                description TEXT NOT NULL,
                completed BOOLEAN DEFAULT FALSE,
                document_id INT, -- Link to uploaded documents
                document_name VARCHAR(255),
                task_order INT, -- To maintain order
                group_index INT, -- For daily/weekly grouping (Day 1, Week 2, etc.)
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
                status VARCHAR(50) DEFAULT 'pending', -- e.g., pending, interviewing, hired, rejected
                applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS documents (
                document_id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                file_name VARCHAR(255) NOT NULL,
                file_path TEXT NOT NULL, -- Path on the server's file system
                mime_type VARCHAR(255),
                size BIGINT,
                uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );
        `;
        
        await client.query(schemaQueries);
        console.log("Database schema verified/created.");

        client.release(); // Release the client back to the pool

        // Start the Express server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (err) {
        console.error('Failed to initialize database or start server:', err.stack);
        // Ensure client is released even on error
        if (client) client.release();
        process.exit(1); // Exit the process with a failure code
    }
};

// Start the server initialization process
startServer();
