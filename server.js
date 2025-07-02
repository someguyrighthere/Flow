// server.js

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const apiRoutes = express.Router();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

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
    throw new Error("DATABASE_URL environment variable is not set.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
});

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    console.log('Serving static files from /dist');
}
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// ... (Paste all of your other routes for login, register, etc. here) ...

apiRoutes.get('/users/me', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role FROM users WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
});


app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const startServer = async () => {
    try {
        const client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        client.release();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to initialize database or start server:', err.stack);
        process.exit(1);
    }
};

startServer();