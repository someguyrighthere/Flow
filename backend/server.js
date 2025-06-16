// --- Imports ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// --- App Initialization ---
const app = express();
app.use(cors());
const PORT = 3000;
app.use(express.json());

// --- JWT Secret ---
const JWT_SECRET = 'your-super-secret-and-long-string-for-jwt';

// --- Database Setup ---
const db = new sqlite3.Database('./onboardflow.db', (err) => {
    if (err) { console.error("Error opening database", err.message); } 
    else {
        console.log("Successfully connected to the database.");
        db.get("PRAGMA foreign_keys = ON");
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS Companies (company_id INTEGER PRIMARY KEY AUTOINCREMENT, company_name TEXT NOT NULL UNIQUE)`);
            db.run(`CREATE TABLE IF NOT EXISTS Locations (location_id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER, location_name TEXT NOT NULL, FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE)`);
            db.run(`CREATE TABLE IF NOT EXISTS Users (user_id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER, location_id INTEGER, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, position TEXT, employee_id TEXT, role TEXT NOT NULL, FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE, FOREIGN KEY (location_id) REFERENCES Locations(location_id) ON DELETE CASCADE)`);
        });
    }
});

// --- Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
    const { company_name, full_name, email, password } = req.body;
    if (!company_name || !full_name || !email || !password) { return res.status(400).json({ error: "All fields are required." }); }
    try {
        const password_hash = await bcrypt.hash(password, 10);
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('INSERT INTO Companies (company_name) VALUES (?)', [company_name], function(err) {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: "Could not create company." }); }
                const newCompanyId = this.lastID;
                db.run(`INSERT INTO Users (company_id, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, 'super_admin')`, [newCompanyId, full_name, email, password_hash], function(err) {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: "Could not create user." }); }
                    db.run('COMMIT');
                    res.status(201).json({ message: "Company and user registered successfully!", userId: this.lastID });
                });
            });
        });
    } catch (error) { res.status(500).json({ error: "A server error occurred." }); }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM Users WHERE email = ?", [email], async (err, user) => {
        if (err || !user) { return res.status(401).json({ error: "Invalid credentials." }); }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) { return res.status(401).json({ error: "Invalid credentials." }); }
        const payload = { userId: user.user_id, email: user.email, role: user.role, fullName: user.full_name, companyId: user.company_id, locationId: user.location_id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: "Login successful!", token, role: user.role });
    });
});

// --- Location Management Routes ---
app.get('/api/locations', authenticateToken, (req, res) => {
    const { companyId, role } = req.user;
    if (role !== 'super_admin') return res.status(403).json({ error: 'Access Denied' });
    db.all('SELECT * FROM Locations WHERE company_id = ?', [companyId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/locations', authenticateToken, (req, res) => {
    const { location_name } = req.body;
    const { companyId, role } = req.user;
    if (role !== 'super_admin') return res.status(403).json({ error: 'Access Denied' });
    if (!location_name) return res.status(400).json({ error: 'Location name is required.' });
    db.run('INSERT INTO Locations (company_id, location_name) VALUES (?, ?)', [companyId, location_name], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to create location.' });
        res.status(201).json({ message: 'Location created!', locationId: this.lastID });
    });
});

app.listen(PORT, () => { console.log(`Server is running successfully on http://localhost:${PORT}`); });
