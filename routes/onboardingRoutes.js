// routes/onboardingRoutes.js

module.exports = (app, pool, isAuthenticated, isAdmin) => {

    // NEW: Onboarding Tasks API (for assigning checklists to existing users)
    app.post('/onboarding-tasks', isAuthenticated, isAdmin, async (req, res) => {
        const { user_id, checklist_id } = req.body;
        if (!user_id || !checklist_id) {
            return res.status(400).json({ error: 'User ID and Checklist ID are required.' });
        }

        const client = await pool.connect(); // Use a client from the pool for transactions
        try {
            // First, check if the user already has this checklist assigned
            const existingAssignment = await client.query(
                'SELECT * FROM onboarding_tasks WHERE user_id = $1 AND checklist_id = $2',
                [user_id, checklist_id]
            );
            if (existingAssignment.rows.length > 0) {
                await client.query('ROLLBACK'); // Rollback previous operations if any
                return res.status(409).json({ error: 'This task list is already assigned to this user.' });
            }

            // Fetch tasks from the selected checklist
            const checklistRes = await client.query('SELECT tasks FROM checklists WHERE id = $1', [checklist_id]);
            if (checklistRes.rows.length === 0) {
                await client.query('ROLLBACK'); // Rollback previous operations if any
                return res.status(404).json({ error: 'Checklist not found.' });
            }
            const tasks = checklistRes.rows[0].tasks;

            // Begin transaction for inserting multiple onboarding tasks
            await client.query('BEGIN'); 

            for (const [index, task] of tasks.entries()) {
                await client.query(
                    `INSERT INTO onboarding_tasks (user_id, checklist_id, description, completed, document_id, document_name, task_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [user_id, checklist_id, task.description, false, task.documentId || null, task.documentName || null, index + 1]
                );
            }

            await client.query('COMMIT');

            res.status(201).json({ message: 'Task list assigned successfully.' });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error assigning onboarding tasks:', err);
            res.status(500).json({ error: 'Failed to assign onboarding tasks.' });
        } finally {
            client.release(); // Release client back to pool
        }
    });

    app.get('/onboarding-tasks', isAuthenticated, async (req, res) => {
        const { user_id } = req.query; // Allow filtering by user_id
        try {
            let query = `
                SELECT ot.*, u.full_name as user_name, c.title as checklist_title, c.position as checklist_position
                FROM onboarding_tasks ot
                JOIN users u ON ot.user_id = u.user_id
                JOIN checklists c ON ot.checklist_id = c.id
            `;
            const params = [];
            if (user_id) {
                query += ' WHERE ot.user_id = $1';
                params.push(user_id);
            }
            query += ' ORDER BY ot.id'; // Order by ID to keep consistent
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (err) {
            console.error('Error fetching onboarding tasks:', err);
            res.status(500).json({ error: 'Failed to retrieve onboarding tasks.' });
        }
    });

    // NEW: PUT route for individual onboarding tasks (to mark complete)
    app.put('/onboarding-tasks/:id', isAuthenticated, async (req, res) => {
        const { id } = req.params;
        const { completed } = req.body;
        // Only 'completed' status can be updated from frontend for now.
        // If you need to update description, etc., add those fields to req.body and the query.
        if (typeof completed !== 'boolean') {
            return res.status(400).json({ error: 'Completion status (boolean) is required.' });
        }

        try {
            const result = await pool.query(
                `UPDATE onboarding_tasks SET completed = $1 WHERE id = $2 RETURNING *`,
                [completed, id]
            );
            if (result.rowCount === 0) return res.status(404).json({ error: 'Onboarding task not found.' });
            res.json(result.rows[0]);
        } catch (err) {
            console.error('Error updating onboarding task status:', err);
            res.status(500).json({ error: 'Failed to update onboarding task status.' });
        }
    });
};
