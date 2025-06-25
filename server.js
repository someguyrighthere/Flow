// ... (all previous code in server.js remains the same)

// --- 6. API Routes ---
// ...

// --- NEW: Route to get a single applicant's details ---
app.get('/applicants/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM applicants WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Applicant not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve applicant details.' });
    }
});

// ... (all other API routes remain here)

// --- 7. Server Startup Logic ---
// ...
