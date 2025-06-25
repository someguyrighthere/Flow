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
const uploadDir = 'uploads';
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
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    res.sendFile(__dirname + '/index.html');
});

// Hiring Routes
app.post('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const { title, description, requirements, location_id } = req.body;
    if (!title || !description) return res.status(400).json({error: 'Title and description are required.'});
    try {
        const result = await pool.query(
            `INSERT INTO job_postings (title, description, requirements, location_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [title, description, requirements, location_id || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});

app.get('/job-postings/:id', async (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT jp.*, l.location_name
        FROM job_postings jp
        LEFT JOIN locations l ON jp.location_id = l.location_id
        WHERE jp.id = $1;
    `;
    try {
        const result = await pool.query(sql, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve job posting.' });
    }
});

app.get('/job-postings', isAuthenticated, isAdmin, async (req, res) => {
    const sql = `
        SELECT jp.*, l.location_name, COUNT(a.id) as applicant_count
        FROM job_postings jp
        LEFT JOIN locations l ON jp.location_id = l.location_id
        LEFT JOIN applicants a ON jp.id = a.job_id
        GROUP BY jp.id, l.location_name
        ORDER BY jp.created_at DESC;
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching job postings:", err);
        res.status(500).json({ error: 'Failed to retrieve job postings.' });
    }
});

app.delete('/job-postings/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM job_postings WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Job posting not found.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete job posting.' });
    }
});

app.get('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM applicants WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Applicant not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve applicant details.' });
    }
});

app.get('/applicants', isAuthenticated, isAdmin, async (req, res) => {
    let query = `
        SELECT a.*, jp.title as job_title
        FROM applicants a
        JOIN job_postings jp ON a.job_id = jp.id
    `;
    const filters = [];
    const values = [];
    let counter = 1;

    if (req.query.jobId) {
        filters.push(`a.job_id = $${counter++}`);
        values.push(req.query.jobId);
    }
    if (req.query.status) {
        filters.push(`a.status = $${counter++}`);
        values.push(req.query.status);
    }

    if (filters.length > 0) {
        query += ' WHERE ' + filters.join(' AND ');
    }
    query += ' ORDER BY a.applied_at DESC;';

    try {
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching applicants:", err);
        res.status(500).json({ error: 'Failed to retrieve applicants.' });
    }
});

app.post('/apply/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const { name, email, address, phone, date_of_birth, availability, is_authorized } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required.' });
    }

    const sql = `
        INSERT INTO applicants (
            job_id, name, email, address, phone, date_of_birth, 
            availability, is_authorized
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    const values = [
        jobId, name, email, address, phone, date_of_birth || null,
        availability, is_authorized
    ];

    try {
        await pool.query(sql, values);
        res.status(201).json({ message: 'Application submitted successfully!' });
    } catch (err) {
        console.error("Error submitting application:", err);
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});


// ... all other existing routes

// --- 7. Server Startup Logic ---
const startServer = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                location_name TEXT NOT NULL,
                location_address TEXT
            );
        `);
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
        await client.query(`
            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                position TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                tasks JSONB NOT NULL,
                structure_type TEXT,
                time_group_count INTEGER
            );
        `);
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
        await client.query(`
            CREATE TABLE IF NOT EXISTS documents (
                document_id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS job_postings (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                requirements TEXT,
                location_id INTEGER,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS applicants (
                id SERIAL PRIMARY KEY,
                job_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                address TEXT,
                phone TEXT,
                date_of_birth DATE,
                availability TEXT,
                is_authorized BOOLEAN,
                status VARCHAR(50) DEFAULT 'Applied',
                applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE
            );
        `);
        
        console.log("Database schema verified.");
        client.release();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (err) {
        console.error('Failed to initialize database or start server:', err.stack);
        if (client) client.release();
        process.exit(1);
    }
};

startServer();
