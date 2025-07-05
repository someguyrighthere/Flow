// server.js - FINAL VERSION

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createOnboardingRouter = require('./routes/onboardingRoutes');

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
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is NOT set.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));

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
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'location_admin')) {
        next();
    } else {
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
};

// --- API ROUTES ---

// ... (All other routes like /login, /register, /users, etc. remain here) ...

// --- Messaging Routes ---
apiRoutes.post('/messages', isAuthenticated, async (req, res) => {
    const { recipient_id, content } = req.body;
    const sender_id = req.user.id;

    if (!recipient_id || !content) {
        return res.status(400).json({ error: 'Recipient and message content are required.' });
    }

    try {
        await pool.query(
            'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
            [sender_id, recipient_id, content]
        );
        res.status(201).json({ message: 'Message sent successfully.' });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: 'Failed to send message.' });
    }
});

apiRoutes.get('/messages', isAuthenticated, async (req, res) => {
    const recipient_id = req.user.id;

    try {
        const result = await pool.query(
            `SELECT message_id, content, sent_at, is_read, u.full_name as sender_name
             FROM messages m
             JOIN users u ON m.sender_id = u.user_id
             WHERE m.recipient_id = $1
             ORDER BY m.sent_at DESC`,
            [recipient_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Failed to retrieve messages.' });
    }
});

// ADD THIS ROUTE: This is the new route to delete a message
apiRoutes.delete('/messages/:id', isAuthenticated, async (req, res) => {
    const messageId = req.params.id;
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'DELETE FROM messages WHERE message_id = $1 AND recipient_id = $2',
            [messageId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Message not found or you do not have permission to delete it.' });
        }

        res.status(204).send();
    } catch (err) {
        console.error('Error deleting message:', err);
        res.status(500).json({ error: 'Failed to delete message.' });
    }
});


// --- MOUNT ROUTERS ---
const onboardingRouter = createOnboardingRouter(pool, isAuthenticated, isAdmin);
apiRoutes.use('/onboarding-tasks', onboardingRouter);

app.use('/api', apiRoutes);

// --- Server Startup Logic ---
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
