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

const onboardingRoutes = require('./routes/onboardingRoutes'); // Import modular onboarding routes

// --- 2. Initialize Express App ---
const app = express();
const apiRoutes = express.Router(); // Use a router for API routes
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

// --- Multer Storage Setup for Document Uploads ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

// --- 3. Database Connection ---
if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
}
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Render's PostgreSQL
});

// --- 4. Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use('/api', apiRoutes); // Mount the API router at /api

// Static file serving - serves all files from the root directory
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files
app.use('/css', express.static(path.join(__dirname, 'css'))); // Serve CSS files
app.use('/js', express.static(path.join(__dirname, 'js'))); // Serve JavaScript files

// --- 5. Authentication Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    if (token == null) return res.sendStatus(401); // No token, unauthorized

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Token invalid/expired, forbidden
        req.user = user; // Attach user payload to request
        next(); // Proceed to the next middleware/route handler
    });
};

const isAdmin = (req, res, next) => {
    // Check if user role is super_admin or location_admin
    if (req.user.role !== 'super_admin' && req.user.role !== 'location_admin') {
        return res.status(403).json({ error: 'Access denied.' }); // Not an admin, forbidden
    }
    next(); // Proceed if authorized
};

// --- 6. API Routes ---

// Public Registration and Login
apiRoutes.post('/register', async (req, res) => {
    const { companyName, fullName, email, password } = req.body;
    if (!companyName || !fullName || !email || !password) {
        return res.status(400).json({ error: "All fields are required." });
    }
    const client = await pool.connect(); // Get a client from the pool for a transaction
    try {
        await client.query('BEGIN'); // Start transaction
        // Insert new location for the company
        const locationRes = await client.query(
            `INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING location_id`,
            [`${companyName} HQ`, 'Default Address']
        );
        const locationId = locationRes.rows[0].location_id;
        // Hash the password
        const hash = await bcrypt.hash(password, 10);
        // Insert the new super_admin user
        await client.query(
            `INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'super_admin', $4)`,
            [fullName, email, hash, locationId]
        );
        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ message: "Registration successful! You can now log in." });
    } catch (err) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Registration error:', err);
        if (err.code === '23505') { // PostgreSQL unique violation error code
            return res.status(409).json({ error: "An account with this email already exists." });
        }
        res.status(500).json({ error: "An internal server error occurred during registration." });
    } finally {
        client.release(); // Release client back to pool
    }
});

apiRoutes.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        if (!user || !user.password) return res.status(401).json({ error: "Invalid credentials." });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials." });
        
        // Create JWT payload with user ID, role, and location ID
        const payload = { id: user.user_id, role: user.role, location_id: user.location_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' }); // Token expires in 1 day
        
        res.json({ message: "Logged in successfully!", token: token, role: user.role, location_id: user.location_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

// Authenticated Route to get current user's profile
apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});

// Authenticated Route to update current user's profile
apiRoutes.put('/users/me', isAuthenticated, async (req, res) => {
    const { full_name, email, current_password, new_password } = req.body;
    const userId = req.user.id;
    
    if (!full_name || !email) {
        return res.status(400).json({ error: 'Full name and email are required.' });
    }

    try {
        let updateQuery = `UPDATE users SET full_name = $1, email = $2`;
        const queryParams = [full_name, email];
        let paramIndex = 3;

        // Handle password change if new_password is provided
        if (new_password) {
            if (!current_password) {
                return res.status(400).json({ error: 'Current password is required to change password.' });
            }
            // Verify current password
            const userResult = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
            const user = userResult.rows[0];
            if (!user || !(await bcrypt.compare(current_password, user.password))) {
                return res.status(401).json({ error: 'Invalid current password.' });
            }
            // Hash new password and add to update query
            const hashedNewPassword = await bcrypt.hash(new_password, 10);
            updateQuery += `, password = $${paramIndex++}`;
            queryParams.push(hashedNewPassword);
        }

        updateQuery += ` WHERE user_id = $${paramIndex} RETURNING user_id, full_name, email, role`;
        queryParams.push(userId);

        const result = await pool.query(updateQuery, queryParams);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found or no changes made.' });
        }
        res.json({ message: 'Profile updated successfully!', user: result.rows[0] });

    } catch (err) {
        console.error('Error updating user profile:', err);
        if (err.code === '23505') { // Unique violation for email
            return res.status(409).json({ error: 'This email is already in use by another account.' });
        }
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});


// Subscription Status (Placeholder)
apiRoutes.get('/subscription-status', isAuthenticated, async (req, res) => {
    // In a real app, this would fetch the user's actual subscription status from a database
    // or a Stripe customer object. For now, it's a placeholder.
    res.json({ plan: 'Free' });
});

// --- Admin Routes ---

// Get all users (super_admin sees all, location_admin sees only their location's users)
apiRoutes.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    let sql;
    const params = [];
    if (req.user.role === 'super_admin') {
        sql = `SELECT u.user_id, u.full_name, u.email, u.role, u.position, l.location_name 
               FROM users u LEFT JOIN locations l ON u.location_id = l.location_id 
               ORDER BY u.role, u.full_name`;
    } else { // location_admin
        sql = `SELECT u.user_id, u.full_name, u.email, u.role, u.position, l.location_name 
               FROM users u LEFT JOIN locations l ON u.location_id = l.location_id 
               WHERE u.location_id = $1 ORDER BY u.role, u.full_name`;
        params.push(req.user.location_id);
    }
    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

// Invite new admin
apiRoutes.post('/invite-admin', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, password, location_id } = req.body;
    if (!full_name || !email || !password || !location_id) {
        return res.status(400).json({ error: "Full name, email, password, and location are required." });
    }
    // Only super_admin can invite other admins
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only super admins can invite new admins.' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO users (full_name, email, password, role, location_id) VALUES ($1, $2, $3, 'location_admin', $4)`,
            [full_name, email, hash, location_id]
        );
        res.status(201).json({ message: "Location admin invited successfully!" });
    } catch (err) {
        console.error('Error inviting admin:', err);
        if (err.code === '23505') return res.status(409).json({ error: "An account with this email already exists." });
        res.status(500).json({ error: "Failed to invite admin." });
    }
});

// Invite new employee
apiRoutes.post('/invite-employee', isAuthenticated, isAdmin, async (req, res) => {
    const { full_name, email, password, position, employee_id, employment_type, location_id, availability } = req.body;
    if (!full_name || !email || !password || !location_id) {
        return res.status(400).json({ error: "Name, email, password, and location are required." });
    }
    // Location admin can only invite employees to their own location
    if (req.user.role === 'location_admin' && req.user.location_id != location_id) {
        return res.status(403).json({ error: 'Location admins can only invite employees to their assigned location.' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO users (full_name, email, password, role, position, employee_id, employment_type, location_id, availability) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [full_name, email, hash, position, employee_id, employment_type, location_id, availability]
        );
        res.status(201).json({ message: "Employee invited successfully!" });
    } catch (err) {
        console.error('Error inviting employee:', err);
        if (err.code === '23505') return res.status(409).json({ error: "An account with this email already exists." });
        res.status(500).json({ error: "Failed to invite employee." });
    }
});

// Delete user or location
apiRoutes.delete('/:type/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { type, id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (type === 'user') {
            // Prevent super_admin from deleting themselves or other super_admins (optional, but good practice)
            const userToDelete = await client.query('SELECT role, location_id FROM users WHERE user_id = $1', [id]);
            if (userToDelete.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'User not found.' });
            }
            const { role: targetRole, location_id: targetLocationId } = userToDelete.rows[0];

            if (targetRole === 'super_admin' && req.user.role !== 'super_admin') {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Only super admins can delete other super admins.' });
            }
            if (req.user.id == id) { // Prevent user from deleting their own account
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'You cannot delete your own account.' });
            }
            // If location_admin, ensure they can only delete users from their own location
            if (req.user.role === 'location_admin' && targetLocationId !== req.user.location_id) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Location admins can only delete users from their own location.' });
            }

            // Delete associated onboarding tasks first
            await client.query(`DELETE FROM onboarding_tasks WHERE user_id = $1`, [id]);
            await client.query(`DELETE FROM users WHERE user_id = $1`, [id]);
            res.json({ message: 'User deleted successfully.' });
        } else if (type === 'location') {
            // Only super_admin can delete locations
            if (req.user.role !== 'super_admin') {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Only super admins can delete locations.' });
            }
            // Check if there are any users associated with this location
            const usersAtLocation = await client.query('SELECT COUNT(*) FROM users WHERE location_id = $1', [id]);
            if (parseInt(usersAtLocation.rows[0].count) > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Cannot delete location with associated users. Please reassign or delete users first.' });
            }
            await client.query(`DELETE FROM locations WHERE location_id = $1`, [id]);
            res.json({ message: 'Location deleted successfully.' });
        } else {
            res.status(400).json({ error: 'Invalid type for deletion.' });
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error deleting ${type}:`, err);
        res.status(500).json({ error: `Failed to delete ${type}.` });
    } finally {
        client.release();
    }
});

// Get all locations
apiRoutes.get('/locations', isAuthenticated, async (req, res) => {
    let sql = `SELECT location_id, location_name, location_address FROM locations`;
    const params = [];
    // Location admins can only see their own location
    if (req.user.role === 'location_admin') {
        sql += ` WHERE location_id = $1`;
        params.push(req.user.location_id);
    }
    sql += ` ORDER BY location_name`;
    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching locations:', err);
        res.status(500).json({ error: 'Failed to retrieve locations.' });
    }
});

// Create new location
apiRoutes.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
    const { location_name, location_address } = req.body;
    if (!location_name || !location_address) {
        return res.status(400).json({ error: "Location name and address are required." });
    }
    // Only super_admin can create new locations
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only super admins can create new locations.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING *`,
            [location_name, location_address]
        );
        res.status(201).json({ message: "Location created successfully!", location: result.rows[0] });
    } catch (err) {
        console.error('Error creating location:', err);
        if (err.code === '23505') return res.status(409).json({ error: "A location with this name already exists." });
        res.status(500).json({ error: "Failed to create location." });
    }
});


// --- Job Postings & Applicants Routes ---

// Get all job postings
apiRoutes.get('/job-postings', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT jp.*, l.location_name
            FROM job_postings jp
            LEFT JOIN locations l ON jp.location_id = l.location_id
            ORDER BY jp.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching job postings:', err);
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});

// Create new job posting
apiRoutes.post('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const { title, description, requirements, location_id } = req.body;
    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required.' });
    }
    // Location admin can only create job postings for their own location
    if (req.user.role === 'location_admin' && req.user.location_id != location_id) {
        return res.status(403).json({ error: 'You are not authorized to create job postings for this location.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO job_postings (title, description, requirements, location_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [title, description, requirements, location_id]
        );
        res.status(201).json({ message: 'Job posting created successfully!', jobPosting: result.rows[0] });
    } catch (err) {
        console.error('Error creating job posting:', err);
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});

// Delete job posting
apiRoutes.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Optional: Add a check to ensure location_admin can only delete postings from their location
        if (req.user.role === 'location_admin') {
            const jobPosting = await pool.query('SELECT location_id FROM job_postings WHERE id = $1', [id]);
            if (jobPosting.rows.length === 0) return res.status(404).json({ error: 'Job posting not found.' });
            if (jobPosting.rows[0].location_id !== req.user.location_id) {
                return res.status(403).json({ error: 'You are not authorized to delete this job posting.' });
            }
        }
        // Delete associated applicants first (optional, or set job_posting_id to NULL)
        await pool.query('DELETE FROM applicants WHERE job_posting_id = $1', [id]);
        const result = await pool.query(`DELETE FROM job_postings WHERE id = $1 RETURNING *`, [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Job posting not found.' });
        res.json({ message: 'Job posting deleted successfully.' });
    } catch (err) {
        console.error('Error deleting job posting:', err);
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});

// Get a single job posting (for public apply page)
app.get('/job-postings/:id', async (req, res) => { // Note: This is `app.get` not `apiRoutes.get` as it's public
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT jp.*, l.location_name
            FROM job_postings jp
            LEFT JOIN locations l ON jp.location_id = l.location_id
            WHERE jp.id = $1
        `, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Job posting not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching single job posting:', err);
        res.status(500).json({ error: 'Failed to retrieve job posting.' });
    }
});


// Get all applicants
apiRoutes.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    let sql = `
        SELECT a.*, jp.title as job_title, l.location_id, l.location_name
        FROM applicants a
        JOIN job_postings jp ON a.job_posting_id = jp.id
        LEFT JOIN locations l ON jp.location_id = l.location_id
    `;
    const params = [];
    // Location admins can only see applicants for their location's job postings
    if (req.user.role === 'location_admin') {
        sql += ` WHERE l.location_id = $1`;
        params.push(req.user.location_id);
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

// Submit job application (public endpoint)
app.post('/apply/:jobId', async (req, res) => { // Note: This is `app.post` not `apiRoutes.post` as it's public
    const { jobId } = req.params;
    const { name, email, address, phone, date_of_birth, availability, is_authorized } = req.body;

    if (!name || !email || !jobId) {
        return res.status(400).json({ error: 'Name, email, and job ID are required.' });
    }

    try {
        // Basic check if job posting exists
        const jobExists = await pool.query('SELECT id FROM job_postings WHERE id = $1', [jobId]);
        if (jobExists.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found.' });
        }

        await pool.query(
            `INSERT INTO applicants (job_posting_id, name, email, address, phone, date_of_birth, availability, is_authorized)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [jobId, name, email, address, phone, date_of_birth, availability, is_authorized]
        );
        res.status(201).json({ message: 'Application submitted successfully!' });
    } catch (err) {
        console.error('Error submitting application:', err);
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});

// Delete applicant (archive)
apiRoutes.delete('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Optional: Add a check to ensure location_admin can only delete applicants from their location's job postings
        if (req.user.role === 'location_admin') {
            const applicant = await pool.query(`
                SELECT a.id, jp.location_id
                FROM applicants a
                JOIN job_postings jp ON a.job_posting_id = jp.id
                WHERE a.id = $1
            `, [id]);
            if (applicant.rows.length === 0) return res.status(404).json({ error: 'Applicant not found.' });
            if (applicant.rows[0].location_id !== req.user.location_id) {
                return res.status(403).json({ error: 'You are not authorized to archive this applicant.' });
            }
        }
        const result = await pool.query(`DELETE FROM applicants WHERE id = $1 RETURNING *`, [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Applicant not found.' });
        res.json({ message: 'Applicant archived successfully.' });
    } catch (err) {
        console.error('Error archiving applicant:', err);
        res.status(500).json({ error: 'Failed to archive applicant.' });
    }
});

// Documents API routes
// Upload document
apiRoutes.post('/documents', isAuthenticated, isAdmin, upload.single('document'), async (req, res) => {
    const { title, description } = req.body;
    const file = req.file;

    if (!title || !file) {
        return res.status(400).json({ error: 'Title and document file are required.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO documents (title, description, file_name, file_path, file_type, size, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [title, description, file.originalname, file.path, file.mimetype, file.size, req.user.id]
        );
        res.status(201).json({ message: 'Document uploaded successfully!', document: result.rows[0] });
    } catch (err) {
        console.error('Error uploading document:', err);
        res.status(500).json({ error: 'Failed to upload document.' });
    }
});

// Get all documents
apiRoutes.get('/documents', isAuthenticated, async (req, res) => {
    let sql = `SELECT d.*, u.full_name as uploaded_by_name
               FROM documents d
               JOIN users u ON d.uploaded_by = u.user_id`;
    const params = [];

    // Location admins can only see documents from their location's users (if applicable)
    // This assumes documents are linked to a user's location, or a document has a location_id
    // For simplicity, let's assume super_admin sees all, location_admin sees documents uploaded by users in their location
    if (req.user.role === 'location_admin') {
        sql += ` WHERE u.location_id = $1`;
        params.push(req.user.location_id);
    }
    sql += ` ORDER BY d.uploaded_at DESC`;

    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching documents:', err);
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});

// Delete document
apiRoutes.delete('/documents/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Optional: Add a check to ensure location_admin can only delete documents from their location
        if (req.user.role === 'location_admin') {
            const document = await pool.query(`
                SELECT d.document_id, u.location_id
                FROM documents d
                JOIN users u ON d.uploaded_by = u.user_id
                WHERE d.document_id = $1
            `, [id]);
            if (document.rows.length === 0) return res.status(404).json({ error: 'Document not found.' });
            if (document.rows[0].location_id !== req.user.location_id) {
                return res.status(403).json({ error: 'You are not authorized to delete this document.' });
            }
        }

        // Get file path before deleting record to delete the file from disk
        const fileResult = await pool.query('SELECT file_path FROM documents WHERE document_id = $1', [id]);
        if (fileResult.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found.' });
        }
        const filePath = fileResult.rows[0].file_path;

        const result = await pool.query(`DELETE FROM documents WHERE document_id = $1 RETURNING *`, [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Document not found.' });

        // Delete the actual file from the uploads directory
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting file from disk:', err);
        });

        res.json({ message: 'Document deleted successfully.' });
    } catch (err) {
        console.error('Error deleting document:', err);
        res.status(500).json({ error: 'Failed to delete document.' });
    }
});

// Checklists API routes
// Create new checklist
apiRoutes.post('/checklists', isAuthenticated, isAdmin, async (req, res) => {
    const { position, title, tasks, structure_type, time_group_count } = req.body;
    if (!position || !title || !Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: 'Position, title, and at least one task are required.' });
    }
    try {
        // Get the user's ID and location_id from the JWT payload
        const createdByUserId = req.user.id;
        const createdByLocationId = req.user.location_id;

        const result = await pool.query(
            `INSERT INTO checklists (position, title, tasks, structure_type, time_group_count, created_by, created_by_location_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [position, title, JSON.stringify(tasks), structure_type, time_group_count, createdByUserId, createdByLocationId] // Store tasks as JSON string
        );
        res.status(201).json({ message: 'Checklist created successfully!', checklist: result.rows[0] });
    } catch (err) {
        console.error('Error creating checklist:', err);
        res.status(500).json({ error: 'Failed to create checklist.' });
    }
});

// Get all checklists
apiRoutes.get('/checklists', isAuthenticated, isAdmin, async (req, res) => { // Added isAdmin middleware here
    let sql = `SELECT c.*
               FROM checklists c`;
    const params = [];
    // Super admin sees all checklists. Location admin sees only checklists created for their location.
    if (req.user.role === 'location_admin') {
        sql += ` WHERE c.created_by_location_id = $1`; 
        params.push(req.user.location_id);
    }
    sql += ` ORDER BY c.title`;
    try {
        const result = await pool.query(sql, params);
        // Parse the tasks JSON string back to an object for the frontend
        const checklists = result.rows.map(row => ({
            ...row,
            tasks: row.tasks ? (typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks) : [] // Handle potential null, empty, or already-parsed tasks
        }));
        res.json(checklists);
    } catch (err) {
        console.error('Error fetching checklists:', err);
        res.status(500).json({ error: 'Failed to retrieve checklists.' });
    }
});

// Delete checklist
apiRoutes.delete('/checklists/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Prevent location_admin from deleting checklists outside their location (if applicable)
        if (req.user.role === 'location_admin') {
            const checklist = await client.query('SELECT created_by_location_id FROM checklists WHERE id = $1', [id]); 
            if (checklist.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Checklist not found.' });
            }
            if (checklist.rows[0].created_by_location_id !== req.user.location_id) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'You are not authorized to delete this checklist.' });
            }
        }
        // Delete associated onboarding tasks first
        await client.query(`DELETE FROM onboarding_tasks WHERE checklist_id = $1`, [id]);
        const result = await client.query(`DELETE FROM checklists WHERE id = $1 RETURNING *`, [id]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Checklist not found.' });
        }
        await client.query('COMMIT');
        res.json({ message: 'Checklist deleted successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting checklist:', err);
        res.status(500).json({ error: 'Failed to delete checklist.' });
    } finally {
        client.release();
    }
});


// Modular Routes (onboardingRoutes)
// This will attach all routes defined in onboardingRoutes.js to the apiRoutes router.
onboardingRoutes(apiRoutes, pool, isAuthenticated, isAdmin);

// Scheduling Routes
// Get shifts
apiRoutes.get('/shifts', isAuthenticated, async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start and end dates are required.' });
    }
    try {
        let sql = `
            SELECT s.*, u.full_name as employee_name, l.location_name
            FROM shifts s
            JOIN users u ON s.employee_id = u.user_id
            JOIN locations l ON s.location_id = l.location_id
            WHERE s.start_time >= $1 AND s.end_time <= $2
        `;
        const params = [startDate, endDate];
        // Location admin can only see shifts for their location
        if (req.user.role === 'location_admin') {
            sql += ` AND l.location_id = $3`;
            params.push(req.user.location_id);
        }
        sql += ` ORDER BY s.start_time`;
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching shifts:', err);
        res.status(500).json({ error: 'Failed to retrieve shifts.' });
    }
});

// Create shift
apiRoutes.post('/shifts', isAuthenticated, isAdmin, async (req, res) => {
    const { employee_id, location_id, start_time, end_time, notes } = req.body;
    if (!employee_id || !location_id || !start_time || !end_time) {
        return res.status(400).json({ error: 'Employee, location, start, and end times are required.' });
    }
    // Location admin can only create shifts for their location
    if (req.user.role === 'location_admin' && req.user.location_id != location_id) {
        return res.status(403).json({ error: 'You are not authorized to create shifts for this location.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [employee_id, location_id, start_time, end_time, notes]
        );
        res.status(201).json({ message: 'Shift created successfully!', shift: result.rows[0] });
    } catch (err) {
        console.error('Error creating shift:', err);
        res.status(500).json({ error: 'Failed to create shift.' });
    }
});

// Delete shift
apiRoutes.delete('/shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Optional: Location admin can only delete shifts from their location
        if (req.user.role === 'location_admin') {
            const shift = await pool.query(`
                SELECT s.id, s.location_id
                FROM shifts s
                WHERE s.id = $1
            `, [id]);
            if (shift.rows.length === 0) return res.status(404).json({ error: 'Shift not found.' });
            if (shift.rows[0].location_id !== req.user.location_id) {
                return res.status(403).json({ error: 'You are not authorized to delete this shift.' });
            }
        }
        const result = await pool.query(`DELETE FROM shifts WHERE id = $1 RETURNING *`, [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Shift not found.' });
        res.json({ message: 'Shift deleted successfully.' });
    } catch (err) {
        console.error('Error deleting shift:', err);
        res.status(500).json({ error: 'Failed to delete shift.' });
    }
});

// Get user availability (for scheduling page)
apiRoutes.get('/users/availability', isAuthenticated, async (req, res) => {
    try {
        let sql = `SELECT user_id, full_name, availability FROM users WHERE role = 'employee' OR role = 'location_admin'`;
        const params = [];
        // Location admin can only see availability for employees in their location
        if (req.user.role === 'location_admin') {
            sql += ` AND location_id = $1`;
            params.push(req.user.location_id);
        }
        const result = await pool.query(sql, params);
        // Parse availability JSON string back to object, handling potential non-JSON values
        const usersWithAvailability = result.rows.map(row => ({
            ...row,
            // Ensure availability is a string before parsing, and handle nulls
            availability: (row.availability && typeof row.availability === 'string') ? JSON.parse(row.availability) : row.availability
        }));
        res.json(usersWithAvailability);
    } catch (err) {
        console.error('Error fetching user availability:', err);
        res.status(500).json({ error: 'Failed to retrieve user availability.' });
    }
});

// Get business settings (for scheduling page, e.g., operating hours)
apiRoutes.get('/settings/business', isAuthenticated, async (req, res) => {
    try {
        // This assumes a 'settings' table or similar where business hours are stored.
        // For simplicity, let's assume a single row for global business settings.
        // In a multi-location setup, this might be linked to a location_id.
        const result = await pool.query(`SELECT operating_hours_start, operating_hours_end FROM business_settings LIMIT 1`);
        if (result.rows.length === 0) {
            // Provide defaults if no settings found
            return res.json({ operating_hours_start: '09:00', operating_hours_end: '17:00' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching business settings:', err);
        res.status(500).json({ error: 'Failed to retrieve business settings.' });
    }
});


// Fallback for serving index.html on any non-API route
// This should be the very last route handler
app.get(/.*/, (req, res) => { // Use a more general regex to catch all non-matched paths
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- 7. Server Startup Logic ---
const startServer = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        // --- Database Schema Creation (only if tables don't exist) ---
        // This is crucial for the app to work.
        await client.query(`
            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                location_name VARCHAR(255) UNIQUE NOT NULL,
                location_address TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'employee', -- 'super_admin', 'location_admin', 'employee'
                position VARCHAR(255),
                employee_id VARCHAR(255),
                employment_type VARCHAR(50), -- 'Full-time', 'Part-time'
                location_id INTEGER REFERENCES locations(location_id),
                availability JSONB, -- Stores weekly availability as JSON object
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS job_postings (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                requirements TEXT,
                location_id INTEGER REFERENCES locations(location_id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS applicants (
                id SERIAL PRIMARY KEY,
                job_posting_id INTEGER REFERENCES job_postings(id),
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                address TEXT,
                phone VARCHAR(50),
                date_of_birth DATE,
                availability VARCHAR(50),
                is_authorized BOOLEAN,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS documents (
                document_id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                file_name VARCHAR(255) NOT NULL,
                file_path TEXT NOT NULL,
                file_type VARCHAR(100),
                size INTEGER,
                uploaded_by INTEGER REFERENCES users(user_id),
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                position VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                tasks JSONB NOT NULL, -- Array of task objects: [{description, completed, documentId, documentName}]
                structure_type VARCHAR(50) DEFAULT 'single_list', -- 'single_list', 'daily', 'weekly'
                time_group_count INTEGER,
                created_by INTEGER REFERENCES users(user_id), -- Added to track who created it
                created_by_location_id INTEGER REFERENCES locations(location_id), -- Added for location-based filtering
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS onboarding_tasks (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(user_id),
                checklist_id INTEGER REFERENCES checklists(id),
                description TEXT NOT NULL,
                completed BOOLEAN DEFAULT FALSE,
                document_id INTEGER REFERENCES documents(document_id), -- Link to a document if attached
                document_name VARCHAR(255), -- Store name for display
                task_order INTEGER NOT NULL, -- To maintain order of tasks within a checklist
                assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE -- When the task was marked complete
            );

            CREATE TABLE IF NOT EXISTS shifts (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER REFERENCES users(user_id),
                location_id INTEGER REFERENCES locations(location_id),
                start_time TIMESTAMP WITH TIME ZONE NOT NULL,
                end_time TIMESTAMP WITH TIME ZONE NOT NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS business_settings (
                id SERIAL PRIMARY KEY,
                operating_hours_start TIME,
                operating_hours_end TIME
            );
            -- Insert default business hours if the table is newly created and empty
            INSERT INTO business_settings (id, operating_hours_start, operating_hours_end)
            SELECT 1, '09:00:00', '17:00:00'
            WHERE NOT EXISTS (SELECT 1 FROM business_settings WHERE id = 1);

        `);
        console.log('Database schema checked/created successfully.');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Your service is live 🎉`);
            console.log(`//////////////////////////////////////////////////`);
            console.log(`Available at your primary URL https://flow-gz1r.onrender.com`);
            console.log(`//////////////////////////////////////////////////`);
        });
    } catch (err) {
        console.error('Failed to initialize database or start server:', err.stack);
        if (client) client.release();
        process.exit(1);
    }
};

startServer();
