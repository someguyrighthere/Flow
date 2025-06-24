// server.js

// --- 1. Imports and Setup ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Import bcrypt for password hashing

// --- 2. Initialize Express App ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key'; // IMPORTANT: Use environment variables for secrets

// --- 3. Database Connection ---
// This connects to the SQLite database file in your project root
const db = new sqlite3.Database('./onboardflow.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // --- NEW: Initialize the database after connecting ---
        initializeDatabase();
    }
});

// --- NEW: Database Initialization Function ---
/**
 * Creates the necessary tables in the database if they don't already exist.
 * This is crucial for environments with ephemeral filesystems like Render.
 */
function initializeDatabase() {
    db.serialize(() => {
        // Create Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('super_admin', 'location_admin', 'employee'))
            )
        `, (err) => {
            if (err) {
                console.error("Error creating users table:", err.message);
            } else {
                console.log("Users table is ready.");
            }
        });

        // Add other table creations here (e.g., checklists, documents)
        // Example:
        // db.run(`CREATE TABLE IF NOT EXISTS checklists (...)`);
    });
}


// --- 4. Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Allow server to accept and parse JSON bodies

// This line tells Express to serve static files (HTML, CSS, JS) from the project's root directory.
// The `__dirname` variable provides the absolute path to the current directory.
app.use(express.static(__dirname));


// --- 5. Authentication Middleware (Helper Function) ---
// This function protects routes that require a user to be logged in.
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // Forbidden
        }
        req.user = user;
        next();
    });
};


// --- 6. API Routes ---

// This route serves your main index.html file when someone visits the root URL of your site.
app.get('/', (req, res) => {
    // Note: The path should be relative to where you run the node command from.
    // Using __dirname ensures the path is always correct.
    res.sendFile(__dirname + '/index.html');
});


// --- Login Route Implementation ---
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    const sql = `SELECT * FROM users WHERE email = ?`;

    db.get(sql, [email], (err, user) => {
        if (err) {
            console.error("Database error during login:", err.message);
            return res.status(500).json({ error: "An internal server error occurred." });
        }
        if (!user) {
            // User not found
            return res.status(401).json({ error: "Invalid credentials." });
        }

        // Compare submitted password with the hashed password from the database
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error("Bcrypt comparison error:", err.message);
                return res.status(500).json({ error: "An internal server error occurred." });
            }
            if (!isMatch) {
                // Passwords do not match
                return res.status(401).json({ error: "Invalid credentials." });
            }

            // Passwords match, generate a JWT
            const payload = {
                id: user.user_id,
                role: user.role
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' }); // Token expires in 1 day

            res.json({
                message: "Logged in successfully!",
                token: token,
                role: user.role
            });
        });
    });
});


// --- THIS IS THE CORRECTED DELETE ROUTE ---
// Place it with your other checklist-related routes.
app.delete('/checklists/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    const checkUsageSql = `
        SELECT COUNT(*) AS count
        FROM onboarding_sessions
        WHERE checklist_id = ? AND status != 'Completed'
    `;

    try {
        const usage = await new Promise((resolve, reject) => {
            db.get(checkUsageSql, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (usage && usage.count > 0) {
            return res.status(409).json({
                error: `Cannot delete task list: It is currently assigned to ${usage.count} active onboarding session(s). Please complete or re-assign those sessions first.`
            });
        }

        const deleteSql = `DELETE FROM checklists WHERE id = ?`;
        await new Promise((resolve, reject) => {
            db.run(deleteSql, [id], function(err) {
                if (err) return reject(err);
                if (this.changes === 0) return reject(new Error('Checklist not found.'));
                resolve();
            });
        });

        res.status(204).send();

    } catch (error) {
        console.error('Error deleting checklist:', error.message);
        res.status(500).json({ error: 'An unexpected server error occurred. Please try again later.' });
    }
});

// Add your other routes (for documents, users, etc.) here...


// --- 7. Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
