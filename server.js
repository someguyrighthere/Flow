// server.js

// --- 1. Imports and Setup ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// --- 2. Initialize Express App ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

// --- 3. Database Connection and Initialization ---
const db = new sqlite3.Database('./onboardflow.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Run database initialization directly inside the connection callback
        // to prevent race conditions on deployment.
        db.serialize(() => {
            // Enable foreign key support
            db.run("PRAGMA foreign_keys = ON;");

            // Create Locations table
            db.run(`
                CREATE TABLE IF NOT EXISTS locations (
                    location_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    location_name TEXT NOT NULL,
                    location_address TEXT
                )
            `, (err) => {
                if (err) console.error("Error creating locations table:", err.message);
                else console.log("Locations table is ready.");
            });

            // Create Users table (updated with location_id)
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('super_admin', 'location_admin', 'employee')),
                    location_id INTEGER,
                    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) console.error("Error creating users table:", err.message);
                else console.log("Users table is ready.");
            });

            // You can add other table creations here as we build them out
        });
    }
});


// --- 4. Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));


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

// Admin-only Middleware
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin' && req.user.role !== 'location_admin') {
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
    next();
};


// --- 6. API Routes ---

// Static File and Root Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Login Route
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], (err, user) => {
        if (err) return res.status(500).json({ error: "An internal server error occurred." });
        if (!user) return res.status(401).json({ error: "Invalid credentials." });

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).json({ error: "An internal server error occurred." });
            if (!isMatch) return res.status(401).json({ error: "Invalid credentials." });

            const payload = { id: user.user_id, role: user.role };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
            res.json({ message: "Logged in successfully!", token: token, role: user.role });
        });
    });
});

// Location Management Routes
app.get('/locations', isAuthenticated, isAdmin, (req, res) => {
    db.all("SELECT * FROM locations", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/locations', isAuthenticated, isAdmin, (req, res) => {
    const { location_name, location_address } = req.body;
    db.run(`INSERT INTO locations (location_name, location_address) VALUES (?, ?)`, [location_name, location_address], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.status(201).json({ id: this.lastID, location_name, location_address });
    });
});

app.delete('/locations/:id', isAuthenticated, isAdmin, (req, res) => {
    db.run(`DELETE FROM locations WHERE location_id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Location not found.' });
        res.status(204).send();
    });
});

// User Management Routes
app.get('/users', isAuthenticated, isAdmin, (req, res) => {
    const sql = `
        SELECT u.user_id, u.full_name, u.email, u.role, l.location_name
        FROM users u
        LEFT JOIN locations l ON u.location_id = l.location_id
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.delete('/users/:id', isAuthenticated, isAdmin, (req, res) => {
    if (req.user.id == req.params.id) {
        return res.status(403).json({ error: "You cannot delete your own account." });
    }
    db.run(`DELETE FROM users WHERE user_id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'User not found.' });
        res.status(204).send();
    });
});

const inviteUser = (req, res, role) => {
    const { full_name, email, password, location_id, position } = req.body; // Added position
    if (!full_name || !email || !password) {
        return res.status(400).json({ error: "Full name, email, and password are required to invite a user." });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: "Error hashing password." });
        
        const sql = `INSERT INTO users (full_name, email, password, role, location_id, position) VALUES (?, ?, ?, ?, ?, ?)`;
        db.run(sql, [full_name, email, hash, role, location_id, position || null], function(err) {
            if (err) return res.status(400).json({ error: "Email may already be in use." });
            res.status(201).json({ id: this.lastID });
        });
    });
};

app.post('/invite-admin', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'location_admin'));
app.post('/invite-employee', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'employee'));


// Existing Routes to be filled in later
app.delete('/checklists/:id', isAuthenticated, (req, res) => {
    res.status(501).send("Not yet implemented");
});


// --- 7. Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
