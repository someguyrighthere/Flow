// Inside server.js

// Find your existing app.delete('/checklists/:id', ...) route and replace it with this.
// This example assumes you are using Express and the 'sqlite3' package.

app.delete('/checklists/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    // First, check if any active onboarding sessions are using this checklist.
    // This provides a proactive, user-friendly error before attempting to delete.
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
            // If the checklist is in use, send a specific, helpful error message.
            return res.status(409).json({ 
                error: `Cannot delete task list: It is currently assigned to ${usage.count} active onboarding session(s). Please complete or re-assign those sessions first.` 
            });
        }

        // If not in use, proceed with deletion.
        const deleteSql = `DELETE FROM checklists WHERE id = ?`;
        await new Promise((resolve, reject) => {
            db.run(deleteSql, [id], function(err) {
                if (err) return reject(err);
                if (this.changes === 0) return reject(new Error('Checklist not found.'));
                resolve();
            });
        });

        res.status(204).send(); // Send 204 No Content for successful deletion.

    } catch (error) {
        // This will catch other unexpected database errors.
        console.error('Error deleting checklist:', error.message);
        res.status(500).json({ error: 'An unexpected server error occurred. Please try again later.' });
    }
});
