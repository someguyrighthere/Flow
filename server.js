const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const apiRoutes = express.Router();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use('/api', apiRoutes);

// --- MINIMAL TEST ROUTE ---
// This is the only API route. It doesn't use the database.
// It just sends back a fake user to prove the server is responding.
apiRoutes.get('/users/me', (req, res) => {
    console.log('--- TEST: /api/users/me route was successfully hit! ---');
    res.json({
        user_id: 1,
        full_name: 'Test User',
        email: 'test@example.com',
        role: 'super_admin'
    });
});


// --- STATIC FILE SERVING ---
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
}
app.use(express.static(path.join(__dirname)));
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- SERVER STARTUP ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Minimal test server is running on port ${PORT}`);
});