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
            pool.query('SELECT created_at, subscription_plan FROM users ORDER BY created_at ASC'),
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

        const subscriptionCounts = { free: 0, pro: 0, enterprise: 0, total: users.length };
        users.forEach(user => {
            const plan = (user.subscription_plan || 'free').toLowerCase();
            if (subscriptionCounts.hasOwnProperty(plan)) {
                subscriptionCounts[plan]++;
            } else {
                subscriptionCounts.free++;
            }
        });

        const accountCreationData = {
            daily: processSignups(users.rows, 'day'),
            weekly: processSignups(users.rows, 'week'),
            monthly: processSignups(users.rows, 'month'),
            yearly: processSignups(users.rows, 'year')
        };
        
        res.json({
            feedback: feedback.rows,
            accountCreationData: accountCreationData,
            subscriptionCounts: subscriptionCounts
        });
    } catch (err) {
        console.error('Error fetching owner data:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
});

// NEW: Route to delete a feedback message
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
        res.status(204).send(); // Success, no content
    } catch (err) {
        console.error('Error deleting feedback:', err);
        res.status(500).json({ error: 'Failed to delete feedback message.' });
    }
});


// --- MOUNT ROUTERS ---
app.use('/api', apiRoutes);
app.use('/owner', ownerRoutes);

// ... (The rest of server.js, including all other routes and startup logic, remains here) ...
