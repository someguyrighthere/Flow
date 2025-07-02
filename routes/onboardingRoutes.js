// routes/onboardingRoutes.js

module.exports = (app, pool, isAuthenticated, isAdmin) => {

    app.post('/onboarding-tasks', isAuthenticated, isAdmin, async (req, res) => {
        const { user_id, checklist_id } = req.body;
        if (!user_id || !checklist_id) {
            return res.status(400).json({ error: 'User ID and Checklist ID are required.' });
        }

        const client = await pool.connect();
        try {
            const existingAssignment = await client.query('SELECT * FROM onboarding_tasks WHERE user_id = $1 AND checklist_id = $2', [user_id, checklist_id]);
            if (existingAssignment.rows.length > 0) {
                return res.status(409).json({ error: 'This task list is already assigned to this user.' });
            }

            const checklistRes = await client.query('SELECT tasks FROM checklists WHERE id = $1', [checklist_id]);
            if (checklistRes.rows.length === 0) {
                return res.status(404).json({ error: 'Checklist not found.' });
            }
            const tasks = checklistRes.rows[0].tasks ? (typeof checklistRes.rows[0].tasks === 'string' ? JSON.parse(checklistRes.rows[0].tasks) : checklistRes.rows[0].tasks) : [];

            await client.query('BEGIN');
            for (const task of tasks) {
                await client.query(
                    `INSERT INTO onboarding_tasks (user_id, checklist_id, description, completed, document_id, document_name, task_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [user_id, checklist_id, task.description, false, task.documentId || null, task.documentName || null, task.task_order || 0]
                );
            }
            await client.query('COMMIT');
            res.status(201).json({ message: 'Task list assigned successfully.' });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error assigning onboarding tasks:', err);
            res.status(500).json({ error: 'Failed to assign onboarding tasks.' });
        } finally {
            client.release();
        }
    });
    
    // --- THIS ROUTE IS NOW FIXED (isAdmin removed) ---
    app.get('/onboarding-tasks', isAuthenticated, async (req, res) => {
        const { user_id } = req.query;
        const requestingUserId = req.user.id;
        const requestingUserRole = req.user.role;
        const requestingUserLocationId = req.user.location_id;

        let query = `
            SELECT ot.*, u.full_name as user_name
            FROM onboarding_tasks ot
            JOIN users u ON ot.user_id = u.user_id
        `;
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (requestingUserRole === 'super_admin' || requestingUserRole === 'location_admin') {
            if (requestingUserRole === 'location_admin') {
                 whereClauses.push(`u.location_id = $${paramIndex++}`);
                 params.push(requestingUserLocationId);
            }
            if (user_id) {
                whereClauses.push(`ot.user_id = $${paramIndex++}`);
                params.push(user_id);
            }
        } else {
            whereClauses.push(`ot.user_id = $${paramIndex++}`);
            params.push(requestingUserId);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }
        query += ' ORDER BY ot.assigned_at DESC, ot.task_order ASC';

        try {
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (err) {
            console.error('Error fetching onboarding tasks:', err);
            res.status(500).json({ error: 'Failed to retrieve onboarding tasks.' });
        }
    });

    app.put('/onboarding-tasks/:id', isAuthenticated, async (req, res) => {
        const { id } = req.params;
        const { completed } = req.body;
        const requestingUserId = req.user.id;
        const requestingUserRole = req.user.role;

        if (typeof completed !== 'boolean') {
            return res.status(400).json({ error: 'Completion status (boolean) is required.' });
        }

        try {
            const taskResult = await pool.query('SELECT user_id FROM onboarding_tasks WHERE id = $1', [id]);
            if (taskResult.rows.length === 0) {
                return res.status(404).json({ error: 'Onboarding task not found.' });
            }
            const taskOwnerId = taskResult.rows[0].user_id;

            if (requestingUserRole === 'employee' && String(taskOwnerId) !== String(requestingUserId)) {
                return res.status(403).json({ error: 'Access denied. You can only update your own tasks.' });
            }

            const result = await pool.query(
                `UPDATE onboarding_tasks SET completed = $1, completed_at = $2 WHERE id = $3 RETURNING *`,
                [completed, completed ? new Date() : null, id]
            );
            res.json(result.rows[0]);
        } catch (err) {
            console.error('Error updating onboarding task status:', err);
            res.status(500).json({ error: 'Failed to update onboarding task status.' });
        }
    });
};