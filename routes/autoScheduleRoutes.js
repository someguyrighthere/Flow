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
            const MINIMUM_HOURS_FULL_TIME = 40;

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

                // Manager Scheduling with Partial Coverage
                const hoursInDay = businessEndHour - businessStartHour;
                const managerCoverage = Array(hoursInDay).fill(0);
                const availableManagers = managers.filter(mgr => {
                    const avail = mgr.availability?.[dayName];
                    if (!avail) return false;
                    const availStart = parseInt(avail.start.split(':')[0], 10);
                    const availEnd = parseInt(avail.end.split(':')[0], 10);
                    return availStart < businessEndHour && availEnd > businessStartHour;
                });

                for (const mgr of availableManagers) {
                    const avail = mgr.availability[dayName];
                    const availStart = Math.max(parseInt(avail.start.split(':')[0], 10), businessStartHour);
                    const availEnd = Math.min(parseInt(avail.end.split(':')[0], 10), businessEndHour);
                    const shiftStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), availStart, 0, 0);
                    const shiftEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), availEnd, 0, 0);
                    await client.query(`
                        INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [
                        mgr.user_id,
                        mgr.location_id,
                        shiftStart.toISOString(),
                        shiftEnd.toISOString(),
                        `Auto-assigned Manager Partial Coverage`
                    ]);
                    for (let h = availStart; h < availEnd; h++) {
                        const index = h - businessStartHour;
                        if (index >= 0 && index < managerCoverage.length) {
                            managerCoverage[index] = 1;
                        }
                    }
                }

                // Log uncovered manager hours
                if (!uncoveredHoursLog[dayName]) uncoveredHoursLog[dayName] = [];
                for (let h = 0; h < managerCoverage.length; h++) {
                    if (managerCoverage[h] === 0) {
                        uncoveredHoursLog[dayName].push(businessStartHour + h);
                    }
                }

                // Employee Scheduling with Break for Full-Time
                const coverage = Array(hoursInDay).fill(0);
                while (scheduledHoursToday < dailyTarget || coverage.includes(0)) {
                    let bestCandidate = null;
                    let bestScore = -1;

                    for (let currentHour = businessStartHour; currentHour <= businessEndHour - PART_TIME_SHIFT_LENGTH; currentHour++) {
                        const eligibleEmployees = employeeScheduleData.filter(emp => {
                            if (emp.daysWorked >= 5 || scheduledToday.has(emp.user_id)) return false;
                            if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= MINIMUM_HOURS_FULL_TIME) return false;

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
                            if (emp.employment_type === 'Full-time') {
                                // Calculate coverage for full-time with break after 4 hours
                                const breakStartHour = currentHour + 4;
                                for (let h = currentHour; h < currentHour + 4; h++) {
                                    const idx = h - businessStartHour;
                                    if (idx >= 0 && idx < coverage.length && coverage[idx] === 0) score++;
                                }
                                for (let h = breakStartHour + 0.5; h < currentHour + shiftWorkHours; h++) {
                                    const idx = h - businessStartHour;
                                    if (idx >= 0 && idx < coverage.length && coverage[idx] === 0) score++;
                                }
                            } else {
                                // Part-time, no break
                                for (let h = currentHour; h < currentHour + shiftWorkHours; h++) {
                                    const idx = h - businessStartHour;
                                    if (idx >= 0 && idx < coverage.length && coverage[idx] === 0) score++;
                                }
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
                    const shiftEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + shiftLength, 0, 0);
                    let notes = `Auto-generated ${emp.employment_type === 'Full-time' ? 'FT' : 'PT'} - ${shiftStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${shiftEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
                    if (emp.employment_type === 'Full-time') {
                        const breakStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + 4, 0, 0);
                        const breakEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + 4, 30, 0);
                        notes += `, Break from ${breakStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${breakEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
                    }

                    await client.query(`
                        INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [
                        emp.user_id,
                        emp.location_id,
                        shiftStart.toISOString(),
                        shiftEnd.toISOString(),
                        notes
                    ]);

                    const empIndex = employeeScheduleData.findIndex(e => e.user_id === emp.user_id);
                    employeeScheduleData[empIndex].scheduled_hours += shiftWorkHours;
                    employeeScheduleData[empIndex].daysWorked++;
                    scheduledToday.add(emp.user_id);

                    if (emp.employment_type === 'Full-time') {
                        // Mark coverage for work periods, excluding break
                        const breakStartHour = currentHour + 4;
                        for (let h = currentHour; h < breakStartHour; h++) {
                            const index = h - businessStartHour;
                            if (index >= 0 && index < coverage.length) {
                                coverage[index] = 1;
                            }
                        }
                        for (let h = breakStartHour + 0.5; h < currentHour + shiftWorkHours; h++) {
                            const index = h - businessStartHour;
                            if (index >= 0 && index < coverage.length) {
                                coverage[index] = 1;
                            }
                        }
                    } else {
                        // Part-time, mark continuous coverage
                        for (let h = currentHour; h < currentHour + shiftWorkHours; h++) {
                            const index = h - businessStartHour;
                            if (index >= 0 && index < coverage.length) {
                                coverage[index] = 1;
                            }
                        }
                    }

                    scheduledHoursToday += shiftWorkHours;
                    totalShiftsCreated++;
                }

                // Log uncovered employee hours
                for (let h = 0; h < coverage.length; h++) {
                    if (coverage[h] === 0) {
                        if (!uncoveredHoursLog[dayName]) uncoveredHoursLog[dayName] = [];
                        uncoveredHoursLog[dayName].push(businessStartHour + h);
                    }
                }

                scheduledHoursByDay[dayName] = scheduledHoursToday;
            }

            // Enforce Minimum Hours for Full-time Employees and Managers
            for (const emp of employeeScheduleData) {
                const isFullTime = emp.employment_type === 'Full-time';
                const isManager = managers.some(m => m.user_id === emp.user_id);
                if ((isFullTime || isManager) && emp.scheduled_hours < MINIMUM_HOURS_FULL_TIME) {
                    for (let d = 0; d < 7; d++) {
                        if (emp.daysWorked >= 5 || emp.scheduled_hours >= MINIMUM_HOURS_FULL_TIME) break;

                        const currentDate = new Date(weekStartDate);
                        currentDate.setDate(currentDate.getDate() + d);
                        const dayName = daysOfWeek[currentDate.getDay()];

                        const dayAvail = emp.availability?.[dayName];
                        if (!dayAvail) continue;

                        const availStart = parseInt(dayAvail.start.split(':')[0], 10);
                        const availEnd = parseInt(dayAvail.end.split(':')[0], 10);
                        const shiftStartHour = Math.max(availStart, businessStartHour);
                        const shiftEndHour = shiftStartHour + FULL_TIME_SHIFT_LENGTH_TOTAL;

                        if (shiftEndHour > availEnd || shiftEndHour > businessEndHour) continue;

                        const shiftStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), shiftStartHour, 0, 0);
                        const shiftEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), shiftStartHour + FULL_TIME_SHIFT_LENGTH_TOTAL, 0, 0);
                        const breakStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), shiftStartHour + 4, 0, 0);
                        const breakEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), shiftStartHour + 4, 30, 0);

                        await client.query(`
                            INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes)
                            VALUES ($1, $2, $3, $4, $5)
                        `, [
                            emp.user_id,
                            emp.location_id,
                            shiftStart.toISOString(),
                            shiftEnd.toISOString(),
                            `Minimum hours adjustment, Break from ${breakStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${breakEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                        ]);

                        emp.scheduled_hours += FULL_TIME_WORK_DURATION;
                        emp.daysWorked++;
                        totalShiftsCreated++;
                    }
                }
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