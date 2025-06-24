// server.js

// --- 1. Imports and Setup ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Assuming you use bcrypt for passwords

// --- 2. Initialize Express App ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-is-long';

// --- 3. Database Connection & Schema Setup ---
const db = new sqlite3.Database('./onboardflow.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Use serialize to ensure table creation runs in order
        db.serialize(() => {
            console.log('Running database schema setup...');
            // Enable foreign key support
            db.run('PRAGMA foreign_keys = ON;');

            // Create Users Table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'employee'
                );
            `);
            
            // Create Checklists Table
            db.run(`
                CREATE TABLE IF NOT EXISTS checklists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    position TEXT NOT NULL UNIQUE,
                    structure_type TEXT,
                    time_group_count INTEGER
                );
            `);

            // *** THIS IS THE CORRECTED Onboarding Sessions Table ***
            db.run(`
                CREATE TABLE IF NOT EXISTS onboarding_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    checklist_id INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'In Progress',  -- ADDED THIS COLUMN
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (checklist_id) REFERENCES checklists (id)
                );
            `);

            console.log('Database schema setup complete.');
        });
    }
});

// --- 4. Middleware ---
app.use(cors());
app.use(express.json());

// --- 5. Authentication Middleware ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- 6. API Routes ---

// Your existing /login route would go here...

// Corrected Checklist Deletion Route
app.delete('/checklists/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const checkUsageSql = `SELECT COUNT(*) AS count FROM onboarding_sessions WHERE checklist_id = ? AND status != 'Completed'`;

    try {
        const usage = await new Promise((resolve, reject) => {
            db.get(checkUsageSql, [id], (err, row) => (err ? reject(err) : resolve(row)));
        });

        if (usage && usage.count > 0) {
            return res.status(409).json({ error: `Cannot delete: Task list is in use by ${usage.count} active session(s).` });
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
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
});

// Add all your other API routes here...


// --- 7. Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
