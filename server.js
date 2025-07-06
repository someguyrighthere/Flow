// server.js - FINAL VERSION WITH ALL ROUTES, INCLUDING OWNER DASHBOARD

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const createOnboardingRouter = require('./routes/onboardingRoutes');

const app = express();
const apiRoutes = express.Router();
const ownerRoutes = express.Router();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'default-secret-password-change-me';

// ... (multer, pool, middleware setup remains the same) ...

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

        // --- NEW: Process user data for charts ---
        const processSignups = (users, unit) => {
            const counts = {};
            users.forEach(user => {
                const date = new Date(user.created_at);
                let key;
                if (unit === 'day') {
                    key = date.toISOString().split('T')[0]; // YYYY-MM-DD
                } else if (unit === 'week') {
                    const firstDay = new Date(date.setDate(date.getDate() - date.getDay()));
                    key = firstDay.toISOString().split('T')[0];
                } else if (unit === 'month') {
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                } else if (unit === 'year') {
                    key = date.getFullYear().toString();
                }
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

// --- MOUNT ROUTERS ---
app.use('/api', apiRoutes); // All public-facing API routes
app.use('/owner', ownerRoutes); // Private owner dashboard routes


// ... (The rest of server.js remains the same) ...
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
