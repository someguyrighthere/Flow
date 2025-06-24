// server.js

// --- 1. Imports and Setup ---
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// --- 2. Initialize Express App ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

// --- 3. Database Connection and Initialization ---
if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- NEW: ONE-TIME PASSWORD RESET SCRIPT ---
/**
 * This script runs once to reset the password for a specific user,
 * allowing you to regain access.
 */
const oneTimePasswordReset = async (client) => {
    // --- User details for the reset ---
    const adminEmailToReset = "xarcy123@gmail.com";
    const newTemporaryPassword = "kain6669";
    
    try {
        console.log(`Attempting to reset password for ${adminEmailToReset}...`);
        const hash = await bcrypt.hash(newTemporaryPassword, 10);
        const result = await client.query(
            'UPDATE users SET password = $1 WHERE email = $2',
            [hash, adminEmailToReset]
        );

        if (result.rowCount > 0) {
            console.log(`SUCCESS: Password for ${adminEmailToReset} has been reset.`);
            console.log("IMPORTANT: You can now log in with the new temporary password.");
        } else {
            console.warn(`WARNING: User with email ${adminEmailToReset} not found. Could not reset password.`);
        }
    } catch (err) {
        console.error("Error during one-time password reset:", err);
    }
};

const initializeDatabase = async () => {
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
        console.log("Locations table is ready.");

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
        console.log("Users table is ready.");
        
        // --- THIS WILL RUN THE ONE-TIME PASSWORD RESET ---
        // For security, delete this line after you have successfully logged in.
        await oneTimePasswordReset(client);
        
        console.log("Database initialization complete.");
    } catch (err) {
        console.error('Error connecting to or initializing PostgreSQL database:', err.stack);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
    }
};

// Call the initialization function
initializeDatabase();


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

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin' && req.user.role !== 'location_admin') {
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
    next();
};


// --- 6. API Routes ---
// (The rest of your routes remain unchanged)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    try {
        const sql = `SELECT * FROM users WHERE email = $1`;
        const result = await pool.query(sql, [email]);
        const user = result.rows[0];

        if (!user || !user.password) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials." });
        }
        
        const payload = { id: user.user_id, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        res.json({ message: "Logged in successfully!", token: token, role: user.role });

    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

// Location Management Routes
app.get('/locations', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM locations");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/locations', isAuthenticated, isAdmin, async (req, res) => {
    const { location_name, location_address } = req.body;
    try {
        const result = await pool.query(`INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING location_id`, [location_name, location_address]);
        res.status(201).json({ id: result.rows[0].location_id, location_name, location_address });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/locations/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`DELETE FROM locations WHERE location_id = $1`, [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Location not found.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// User Management Routes
app.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    const sql = `
        SELECT u.user_id, u.full_name, u.email, u.role, u.position, l.location_name
        FROM users u
        LEFT JOIN locations l ON u.location_id = l.location_id
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    if (req.user.id == req.params.id) {
        return res.status(403).json({ error: "You cannot delete your own account." });
    }
    try {
        const result = await pool.query(`DELETE FROM users WHERE user_id = $1`, [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const inviteUser = async (req, res, role) => {
    const { full_name, email, password, location_id, position } = req.body;
    if (!full_name || !email || !password) {
        return res.status(400).json({ error: "Full name, email, and password are required." });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (full_name, email, password, role, position, location_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id`;
        const result = await pool.query(sql, [full_name, email, hash, role, position || null, location_id || null]);
        res.status(201).json({ id: result.rows[0].user_id });
    } catch (err) {
        console.error("Error inviting user:", err.message);
        if (err.code === '23505') { // Unique constraint violation
            return res.status(400).json({ error: "Email may already be in use." });
        }
        res.status(500).json({ error: "An internal server error occurred." });
    }
};

app.post('/invite-admin', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'location_admin'));
app.post('/invite-employee', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'employee'));

// Placeholder for future routes
app.delete('/checklists/:id', isAuthenticated, (req, res) => {
    res.status(501).send("Not yet implemented");
});


// --- 7. Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
