// routes/onboardingRoutes.js

module.exports = (app, pool, isAuthenticated, isAdmin) => {

    // NEW: Onboarding Tasks API (for assigning checklists to existing users)
    // This route requires authentication and admin privileges
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
                // No need to rollback here, as no operations have begun on this client yet if it's an existing assignment
                return res.status(409).json({ error: 'This task list is already assigned to this user.' });
            }

            // Fetch tasks from the selected checklist
            const checklistRes = await client.query('SELECT tasks FROM checklists WHERE id = $1', [checklist_id]);
            if (checklistRes.rows.length === 0) {
                return res.status(404).json({ error: 'Checklist not found.' });
            }
            // Parse tasks from JSONB string, handle potential null/empty
            const tasks = checklistRes.rows[0].tasks ? JSON.parse(checklistRes.rows[0].tasks) : [];

            // Begin transaction for inserting multiple onboarding tasks
            await client.query('BEGIN'); 

            // Insert each task from the checklist as an individual onboarding_task for the user
            for (const task of tasks) { // Iterate directly over the parsed tasks array
                await client.query(
                    `INSERT INTO onboarding_tasks (user_id, checklist_id, description, completed, document_id, document_name, task_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [user_id, checklist_id, task.description, false, task.documentId || null, task.documentName || null, task.task_order || 0] // Use task.task_order
                );
            }

            await client.query('COMMIT'); // Commit transaction

            res.status(201).json({ message: 'Task list assigned successfully.' });

        } catch (err) {
            await client.query('ROLLBACK'); // Rollback on error
            console.error('Error assigning onboarding tasks:', err);
            res.status(500).json({ error: 'Failed to assign onboarding tasks.' });
        } finally {
            client.release(); // Release client back to pool
        }
    });

    // Get onboarding tasks for a specific user or all for admins
    // This route requires authentication and admin privileges for general access,
    // but a regular employee can access their own tasks.
    app.get('/onboarding-tasks', isAuthenticated, isAdmin, async (req, res) => { // Added isAdmin middleware here
        const { user_id } = req.query; // Allow filtering by user_id
        const requestingUserId = req.user.id;
        const requestingUserRole = req.user.role;
        const requestingUserLocationId = req.user.location_id;

        let query = `
            SELECT ot.*, u.full_name as user_name, u.email as user_email, u.position as user_position,
                   c.title as checklist_title, c.position as checklist_position,
                   l.location_name
            FROM onboarding_tasks ot
            JOIN users u ON ot.user_id = u.user_id
            JOIN checklists c ON ot.checklist_id = c.id
            LEFT JOIN locations l ON u.location_id = l.location_id
        `;
        const params = [];
        let whereClauses = [];
        let paramIndex = 1;

        if (requestingUserRole === 'super_admin') {
            // Super admins can view all tasks, possibly filtered by user_id if provided
            if (user_id) {
                whereClauses.push(`ot.user_id = $${paramIndex++}`);
                params.push(user_id);
            }
        } else if (requestingUserRole === 'location_admin') {
            // Location admins can view tasks for users in their location, possibly filtered by user_id
            whereClauses.push(`u.location_id = $${paramIndex++}`);
            params.push(requestingUserLocationId);
            if (user_id) {
                whereClauses.push(`ot.user_id = $${paramIndex++}`);
                params.push(user_id);
            }
        } else { // Regular employee role
            // Employees can only view their own tasks
            whereClauses.push(`ot.user_id = $${paramIndex++}`);
            params.push(requestingUserId);
            // If an employee tries to query for another user's tasks, deny
            if (user_id && String(user_id) !== String(requestingUserId)) {
                return res.status(403).json({ error: 'Access denied. You can only view your own tasks.' });
            }
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }
        query += ' ORDER BY ot.assigned_at DESC, ot.task_order ASC'; // Order by assignment date and task order

        try {
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (err) {
            console.error('Error fetching onboarding tasks:', err);
            res.status(500).json({ error: 'Failed to retrieve onboarding tasks.' });
        }
    });

    // NEW: PUT route for individual onboarding tasks (to mark complete)
    // This route requires authentication. Admins can update any task, employees only their own.
    app.put('/onboarding-tasks/:id', isAuthenticated, async (req, res) => {
        const { id } = req.params;
        const { completed } = req.body;
        const requestingUserId = req.user.id;
        const requestingUserRole = req.user.role;

        if (typeof completed !== 'boolean') {
            return res.status(400).json({ error: 'Completion status (boolean) is required.' });
        }

        try {
            // First, get the task to check ownership/permissions
            const taskResult = await pool.query('SELECT user_id FROM onboarding_tasks WHERE id = $1', [id]);
            if (taskResult.rows.length === 0) {
                return res.status(404).json({ error: 'Onboarding task not found.' });
            }
            const taskOwnerId = taskResult.rows[0].user_id;

            // Authorization check:
            // Admins (super_admin or location_admin) can update any task.
            // Employees can only update their own tasks.
            if (requestingUserRole === 'employee' && String(taskOwnerId) !== String(requestingUserId)) {
                return res.status(403).json({ error: 'Access denied. You can only update your own tasks.' });
            }

            const result = await pool.query(
                `UPDATE onboarding_tasks SET completed = $1, completed_at = $2 WHERE id = $3 RETURNING *`,
                [completed, completed ? new Date() : null, id] // Set completed_at if completed, else null
            );
            if (result.rowCount === 0) return res.status(404).json({ error: 'Onboarding task not found.' });
            res.json(result.rows[0]);
        } catch (err) {
            console.error('Error updating onboarding task status:', err);
            res.status(500).json({ error: 'Failed to update onboarding task status.' });
        }
    });
};
