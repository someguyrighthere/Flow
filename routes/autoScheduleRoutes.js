// routes/autoScheduleRoutes.js

module.exports = (app, pool, isAuthenticated, isAdmin) => {
    app.post('/shifts/auto-generate', isAuthenticated, isAdmin, async (req, res) => {
        const { weekStartDate, dailyHours } = req.body;
        if (!weekStartDate || !dailyHours) {
            return res.status(400).json({ error: 'Week start date and daily hours are required.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const currentWeekStart = new Date(weekStartDate);
            const nextWeekStart = new Date(currentWeekStart);
            nextWeekStart.setDate(currentWeekStart.getDate() + 7);
            await client.query('DELETE FROM shifts WHERE start_time >= $1 AND start_time < $2', [currentWeekStart, nextWeekStart]);

            const settingsRes = await client.query('SELECT * FROM business_settings WHERE id = 1');
            const settings = settingsRes.rows[0] || { operating_hours_start: '09:00', operating_hours_end: '17:00' };
            const businessStartHour = parseInt(settings.operating_hours_start.split(':')[0], 10);
            const businessEndHour = parseInt(settings.operating_hours_end.split(':')[0], 10);

            const { rows: employees } = await client.query(`
                SELECT user_id, full_name, availability, location_id, employment_type FROM users 
                WHERE role = 'employee' AND availability IS NOT NULL
            `);

            const { rows: managers } = await client.query(`
                SELECT user_id, full_name, availability, location_id FROM users 
                WHERE role = 'manager' AND availability IS NOT NULL
            `);

            let employeeScheduleData = employees.map(e => ({
                ...e,
                scheduled_hours: 0,
                daysWorked: 0
            }));

            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            let totalShiftsCreated = 0;
            const FULL_TIME_WORK_DURATION = 8;
            const FULL_TIME_BREAK_DURATION = 0.5;
            const FULL_TIME_SHIFT_LENGTH_TOTAL = FULL_TIME_WORK_DURATION + FULL_TIME_BREAK_DURATION;
            const PART_TIME_SHIFT_LENGTH = 4;

            let uncoveredHoursLog = {};
            let scheduledHoursByDay = {};

            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(currentDate.getDate() + i);
                currentDate.setHours(0, 0, 0, 0);
                const dayName = daysOfWeek[currentDate.getDay()];
                const dailyTarget = parseFloat(dailyHours[dayName] || 0);
                let scheduledHoursToday = 0;
                const scheduledToday = new Set();

                // === Ensure a manager is scheduled for all hours ===
                const availableManagers = managers.filter(mgr => {
                    const avail = mgr.availability?.[dayName];
                    if (!avail) return false;
                    const availStart = parseInt(avail.start.split(':')[0], 10);
                    const availEnd = parseInt(avail.end.split(':')[0], 10);
                    return availStart <= businessStartHour && availEnd >= businessEndHour;
                });

                if (availableManagers.length > 0) {
                    const mgr = availableManagers[0];
                    const shiftStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), businessStartHour, 0, 0);
                    const shiftEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), businessEndHour, 0, 0);
                    await client.query(`
                        INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [
                        mgr.user_id,
                        mgr.location_id,
                        shiftStart.toISOString(),
                        shiftEnd.toISOString(),
                        `Auto-assigned Manager Full Coverage`
                    ]);
                }

                const hoursInDay = businessEndHour - businessStartHour;
                const coverage = Array(hoursInDay).fill(0);

                while (scheduledHoursToday < dailyTarget || coverage.includes(0)) {
                    let bestCandidate = null;
                    let bestScore = -1;

                    for (let currentHour = businessStartHour; currentHour <= businessEndHour - 4; currentHour++) {
                        const eligibleEmployees = employeeScheduleData.filter(emp => {
                            if (emp.daysWorked >= 5 || scheduledToday.has(emp.user_id)) return false;
                            if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false;

                            const dayAvail = emp.availability?.[dayName];
                            if (!dayAvail) return false;
                            const availStart = parseInt(dayAvail.start.split(':')[0], 10);
                            const availEnd = parseInt(dayAvail.end.split(':')[0], 10);

                            const shiftLength = emp.employment_type === 'Full-time' ? FULL_TIME_SHIFT_LENGTH_TOTAL : PART_TIME_SHIFT_LENGTH;
                            const shiftEndHour = currentHour + shiftLength;

                            return availStart <= currentHour && availEnd >= shiftEndHour && shiftEndHour <= businessEndHour;
                        });

                        for (const emp of eligibleEmployees) {
                            const shiftLength = emp.employment_type === 'Full-time' ? FULL_TIME_SHIFT_LENGTH_TOTAL : PART_TIME_SHIFT_LENGTH;
                            const shiftWorkHours = emp.employment_type === 'Full-time' ? FULL_TIME_WORK_DURATION : PART_TIME_SHIFT_LENGTH;

                            let score = 0;
                            for (let h = currentHour; h < currentHour + shiftWorkHours; h++) {
                                const idx = h - businessStartHour;
                                if (coverage[idx] === 0) score++;
                            }

                            if (score > bestScore) {
                                bestScore = score;
                                bestCandidate = { emp, currentHour, shiftLength, shiftWorkHours };
                            }
                        }
                    }

                    if (!bestCandidate) break;

                    const { emp, currentHour, shiftLength, shiftWorkHours } = bestCandidate;

                    const shiftStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0);
                    const shiftEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + shiftWorkHours, emp.employment_type === 'Full-time' ? FULL_TIME_BREAK_DURATION * 60 : 0, 0);

                    await client.query(`
                        INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [
                        emp.user_id,
                        emp.location_id,
                        shiftStart.toISOString(),
                        shiftEnd.toISOString(),
                        `Auto-generated ${emp.employment_type === 'Full-time' ? 'FT' : 'PT'} - ${shiftStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${shiftEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                    ]);

                    const empIndex = employeeScheduleData.findIndex(e => e.user_id === emp.user_id);
                    employeeScheduleData[empIndex].scheduled_hours += shiftWorkHours;
                    employeeScheduleData[empIndex].daysWorked++;
                    scheduledToday.add(emp.user_id);

                    for (let h = currentHour; h < currentHour + shiftWorkHours; h++) {
                        const index = h - businessStartHour;
                        if (index >= 0 && index < coverage.length) {
                            coverage[index] = 1;
                        }
                    }

                    scheduledHoursToday += shiftWorkHours;
                    totalShiftsCreated++;
                }

                scheduledHoursByDay[dayName] = scheduledHoursToday;
            }

            await client.query('COMMIT');
            res.status(201).json({
                message: `Successfully created ${totalShiftsCreated} auto-generated shifts.`,
                uncovered_hours: uncoveredHoursLog,
                scheduled_hours_summary: scheduledHoursByDay
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Auto-scheduling failed:', error);
            res.status(500).json({ error: 'An error occurred during auto-scheduling.' });
        } finally {
            client.release();
        }
    });
};
