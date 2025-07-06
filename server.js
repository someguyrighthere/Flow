// server.js - FINAL VERSION WITH ALL ROUTES, INCLUDING OWNER DASHBOARD

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createOnboardingRouter = require('./routes/onboardingRoutes');

const app = express();
const apiRoutes = express.Router();
const ownerRoutes = express.Router();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'default-secret-password-change-me';

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

if (!DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is NOT set.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));

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
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'location_admin')) {
        next();
    } else {
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
};

// --- API ROUTES DEFINITION ---

// Authentication
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const locationRes = await client.query(`INSERT INTO locations (location_name) VALUES ($1) RETURNING location_id`, [`${companyName} HQ`]);
        const newLocationId = locationRes.rows[0].location_id;
        const hash = await bcrypt.hash(password, 10);
        await client.query(`INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4) RETURNING user_id`, [fullName, email, hash, newLocationId]);
        await client.query('COMMIT');
        res.status(201).json({ message: "Registration successful!" });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(409).json({ error: "Email address is already registered." });
        res.status(500).json({ error: "An internal server error occurred." });
    } finally {
        client.release();
    }
});
apiRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(`SELECT user_id, full_name, email, password, role, location_id FROM users WHERE email = $1`, [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Invalid email or password." });
        const user = result.rows[0];
        if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid email or password." });
        
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id, iat: Math.floor(Date.now() / 1000) };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, role: user.role, userId: user.user_id });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

// Users & Admin
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role, location_id FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User profile not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});
apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT u.user_id, u.full_name, u.position, u.role, l.location_name FROM users u LEFT JOIN locations l ON u.location_id = l.location_id ORDER BY u.full_name`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});
apiRoutes.put('/users/me', isAuthenticated, async (req, res) => {
    const { full_name, email, current_password, new_password } = req.body;
    const userId = req.user.id;
    try {
        const userResult = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        let hashedPassword = userResult.rows[0].password;
        if (new_password) {
            if (!current_password || !(await bcrypt.compare(current_password, userResult.rows[0].password))) {
                return res.status(401).json({ error: 'Current password incorrect.' });
            }
            hashedPassword = await bcrypt.hash(new_password, 10);
        }
        const result = await pool.query(`UPDATE users SET full_name = $1, email = $2, password = $3 WHERE user_id = $4 RETURNING user_id, full_name, email, role`,[full_name, email, hashedPassword, userId]);
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email address is already in use.' });
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});
apiRoutes.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    if (req.user.id === parseInt(id, 10)) return res.status(400).json({ error: "You cannot delete your own account." });
    try {
        await pool.query('DELETE FROM users WHERE user_id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});
apiRoutes.post('/invite-admin', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, password, location_id } = req.body;
    if (!full_name || !email || !password || !location_id) return res.status(400).json({ error: 'All fields are required.' });
    try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query("INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'location_admin', $4)",[full_name, email, hash, location_id]);
        res.status(201).json({ message: 'Location admin invited successfully.' });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
        res.status(500).json({ error: 'Failed to invite location admin.' });
    }
});
apiRoutes.post('/invite-employee', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, password, position, location_id, availability } = req.body;
    if (!full_name || !email || !password || !location_id) return res.status(400).json({ error: 'Name, email, password, and location are required.' });
    try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query("INSERT INTO users (full_name, email, password, role, position, location_id, availability) VALUES ($1, $2, $3, 'employee', $4, $5, $6)",[full_name, email, hash, position, location_id, availability ? JSON.stringify(availability) : null]);
        res.status(201).json({ message: 'Employee invited successfully.' });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
        res.status(500).json({ error: 'Failed to invite employee.' });
    }
});

// Locations & Business Settings
apiRoutes.get('/locations', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY location_name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});
apiRoutes.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
    const { location_name, location_address } = req.body;
    if (!location_name || !location_address) return res.status(400).json({ error: 'Location name and address are required.' });
    try {
        const result = await pool.query('INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING *', [location_name, location_address]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add new location.' });
    }
});
apiRoutes.delete('/locations/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM locations WHERE location_id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete location.' });
    }
});
apiRoutes.get('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM business_settings');
        res.json(result.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve business settings.' });
    }
});
apiRoutes.put('/settings/business', isAuthenticated, isAdmin, async (req, res) => {
    const { operating_hours_start, operating_hours_end } = req.body;
    try {
        await pool.query(`INSERT INTO business_settings (id, operating_hours_start, operating_hours_end) VALUES (1, $1, $2) ON CONFLICT (id) DO UPDATE SET operating_hours_start = $1, operating_hours_end = $2`,[operating_hours_start, operating_hours_end]);
        res.status(200).json({ message: 'Business settings updated.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update business settings.' });
    }
});

// Checklists
apiRoutes.get('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM checklists ORDER BY position, title');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve checklists.' });
    }
});
apiRoutes.post('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    const { title, position, tasks } = req.body;
    if (!title || !position || !tasks) return res.status(400).json({ error: 'Missing required fields.' });
    try {
        const result = await pool.query('INSERT INTO checklists (title, position, tasks) VALUES ($1, $2, $3) RETURNING *',[title, position, JSON.stringify(tasks)]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create checklist.' });
    }
});

// Documents
apiRoutes.get('/documents', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT d.document_id, d.title, d.description, d.file_name, d.uploaded_at, u.full_name as uploaded_by_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.user_id ORDER BY d.uploaded_at DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});
apiRoutes.post('/documents', isAuthenticated, isAdmin, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });
        const { title, description } = req.body;
        const { filename } = req.file;
        const result = await pool.query('INSERT INTO documents (title, description, file_name, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING *',[title, description, filename, req.user.id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to upload document.' });
    }
});
apiRoutes.delete('/documents/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const docResult = await pool.query('SELECT file_name FROM documents WHERE document_id = $1', [id]);
        if (docResult.rows.length === 0) return res.status(404).json({ error: 'Document not found.' });
        await pool.query('DELETE FROM documents WHERE document_id = $1', [id]);
        const filePath = path.join(uploadsDir, docResult.rows[0].file_name);
        fs.unlink(filePath, (err) => {
            if (err) console.error(`Failed to delete file from disk: ${filePath}`, err);
        });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete document.' });
    }
});

// Hiring
apiRoutes.get('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT jp.id, jp.title, jp.created_at, l.location_name FROM job_postings jp LEFT JOIN locations l ON jp.location_id = l.location_id ORDER BY jp.created_at DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});
apiRoutes.post('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const { title, description, requirements, location_id } = req.body;
    if (!title || !description || !location_id) return res.status(400).json({ error: 'Title, description, and location are required.' });
    try {
        const result = await pool.query('INSERT INTO job_postings (title, description, requirements, location_id) VALUES ($1, $2, $3, $4) RETURNING *',[title, description, requirements, location_id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});
apiRoutes.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM job_postings WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});
apiRoutes.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT a.id, a.name, a.email, a.phone, a.applied_at, jp.title AS job_title FROM applicants a JOIN job_postings jp ON a.job_id = jp.id ORDER BY a.applied_at DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve applicants.' });
    }
});
apiRoutes.delete('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM applicants WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete applicant.' });
    }
});

// Scheduling
apiRoutes.get('/shifts', isAuthenticated, async (req, res) => {
    const { startDate, endDate, location_id, user_id } = req.query;
    const requestingUserId = req.user.id;
    const isUserAdmin = req.user.role === 'super_admin' || req.user.role === 'location_admin';
    if (user_id && !isUserAdmin && String(user_id) !== String(requestingUserId)) return res.status(403).json({ error: 'Access denied.' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start and end dates are required.' });
    try {
        let query = `SELECT s.id, s.employee_id, u.full_name AS employee_name, s.location_id, l.location_name, s.start_time, s.end_time FROM shifts s JOIN users u ON s.employee_id = u.user_id JOIN locations l ON s.location_id = l.location_id WHERE s.start_time >= $1 AND s.end_time <= $2`;
        const params = [startDate, endDate];
        let paramIndex = 3;
        if (isUserAdmin) {
            if (location_id) {
                query += ` AND s.location_id = $${paramIndex++}`;
                params.push(location_id);
            }
        } else {
            const targetUserId = user_id || requestingUserId;
            query += ` AND s.employee_id = $${paramIndex++}`;
            params.push(targetUserId);
        }
        query += ' ORDER BY s.start_time ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});
apiRoutes.post('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    if (!employee_id || !location_id || !start_time || !end_time) return res.status(400).json({ error: 'All fields are required.' });
    try {
        const result = await pool.query('INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',[employee_id, location_id, start_time, end_time, notes]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create shift.' });
    }
});
apiRoutes.delete('/shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM shifts WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete shift.' });
    }
});
apiRoutes.delete('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { beforeDate } = req.query;
    if (!beforeDate) return res.status(400).json({ error: 'A "beforeDate" query parameter is required.' });
    try {
        const result = await pool.query('DELETE FROM shifts WHERE start_time < $1', [beforeDate]);
        res.status(200).json({ message: `${result.rowCount} old shifts deleted successfully.` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete old shifts.' });
    }
});

// Messaging
apiRoutes.post('/messages', isAuthenticated, async (req, res) => {
    const { recipient_id, content } = req.body;
    const sender_id = req.user.id;
    if (!recipient_id || !content) return res.status(400).json({ error: 'Recipient and message content are required.' });
    try {
        await pool.query('INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)', [sender_id, recipient_id, content]);
        res.status(201).json({ message: 'Message sent successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send message.' });
    }
});
apiRoutes.get('/messages', isAuthenticated, async (req, res) => {
    const recipient_id = req.user.id;
    try {
        const result = await pool.query(`SELECT message_id, content, sent_at, is_read, u.full_name as sender_name FROM messages m JOIN users u ON m.sender_id = u.user_id WHERE m.recipient_id = $1 ORDER BY m.sent_at DESC`, [recipient_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve messages.' });
    }
});
apiRoutes.delete('/messages/:id', isAuthenticated, async (req, res) => {
    const messageId = req.params.id;
    const userId = req.user.id;
    try {
        const result = await pool.query('DELETE FROM messages WHERE message_id = $1 AND recipient_id = $2', [messageId, userId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Message not found or you do not have permission to delete it.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete message.' });
    }
});

// Subscription Status
apiRoutes.get('/subscription-status', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT subscription_plan, subscription_status FROM locations WHERE location_id = $1', [req.user.location_id]);
        if (result.rows.length === 0) return res.status(404).json({ plan: 'None', status: 'inactive' });
        res.json({ plan: result.rows[0].subscription_plan || 'Free Tier', status: result.rows[0].subscription_status || 'inactive' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get subscription status.' });
    }
});

// Feedback
apiRoutes.post('/feedback', isAuthenticated, async (req, res) => {
    const { feedback_type, message } = req.body;
    const userId = req.user.id;
    if (!feedback_type || !message) return res.status(400).json({ error: 'Feedback type and message are required.' });
    try {
        const userRes = await pool.query('SELECT full_name, email FROM users WHERE user_id = $1', [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'Submitting user not found.' });
        const { full_name, email } = userRes.rows[0];
        await pool.query(
            'INSERT INTO feedback (user_id, user_name, user_email, feedback_type, message) VALUES ($1, $2, $3, $4, $5)',
            [userId, full_name, email, feedback_type, message]
        );
        res.status(201).json({ message: 'Feedback submitted successfully. Thank you!' });
    } catch (err) {
        console.error('Error submitting feedback:', err);
        res.status(500).json({ error: 'Failed to submit feedback.' });
    }
});

// --- MOUNT ROUTERS ---
const onboardingRouter = createOnboardingRouter(pool, isAuthenticated, isAdmin);
apiRoutes.use('/onboarding-tasks', onboardingRouter);

app.use('/api', apiRoutes);

// --- PRIVATE OWNER ROUTES ---
ownerRoutes.post('/data', async (req, res) => {
    const { owner_password } = req.body;
    if (owner_password !== OWNER_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password.' });
    }
    try {
        const [users, feedback] = await Promise.all([
            pool.query('SELECT created_at FROM users ORDER BY created_at ASC'),
            pool.query('SELECT * FROM feedback ORDER BY submitted_at DESC')
        ]);
        const processSignups = (users, unit) => {
            const counts = {};
            users.forEach(user => {
                const date = new Date(user.created_at);
                let key;
                if (unit === 'day') key = date.toISOString().split('T')[0];
                else if (unit === 'week') {
                    const firstDay = new Date(date.setDate(date.getDate() - date.getDay()));
                    key = firstDay.toISOString().split('T')[0];
                } else if (unit === 'month') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                else if (unit === 'year') key = date.getFullYear().toString();
                counts[key] = (counts[key] || 0) + 1;
            });
            const labels = Object.keys(counts).sort();
            const data = labels.map(label => counts[label]);
            return { labels, data };
        };
        const accountCreationData = {
            daily: processSignups(users.rows, 'day'),
            weekly: processSignups(users.rows, 'week'),
            monthly: processSignups(users.rows, 'month'),
            yearly: processSignups(users.rows, 'year')
        };
        res.json({
            feedback: feedback.rows,
            accountCreationData: accountCreationData
        });
    } catch (err) {
        console.error('Error fetching owner data:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
});
ownerRoutes.post('/feedback/delete/:id', async (req, res) => {
    const { owner_password } = req.body;
    const { id } = req.params;
    if (owner_password !== OWNER_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password.' });
    }
    try {
        const result = await pool.query('DELETE FROM feedback WHERE feedback_id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Feedback message not found.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting feedback:', err);
        res.status(500).json({ error: 'Failed to delete feedback message.' });
    }
});
app.use('/owner', ownerRoutes);

// --- Server Startup Logic ---
const startServer = async () => {
    try {
        await pool.connect();
        console.log('--- DATABASE: Successfully Connected to PostgreSQL! ---');
        app.listen(PORT, '0.0.0.0', () => { 
            console.log(`--- SERVER: Express app listening successfully on port ${PORT}! ---`);
        });
    } catch (err) {
        console.error('CRITICAL ERROR: Failed to start server.', err.stack);
        process.exit(1); 
    }
};

startServer();
