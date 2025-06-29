module.exports = (app, pool, isAuthenticated, isAdmin) => {
    // Helper function to format date as YYYY-MM-DD HH:MM:SS without time zone
    const formatDateTime = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    app.post('/shifts/auto-generate', isAuthenticated, isAdmin, async (req, res) => {
        const { weekStartDate, dailyHours, business_id } = req.body;
        if (!weekStartDate || !dailyHours || !business_id) {
            return res.status(400).json({ error: 'Week start date, daily hours, and business ID are required.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const currentWeekStart = new Date(weekStartDate);
            const nextWeekStart = new Date(currentWeekStart);
            nextWeekStart.setDate(currentWeekStart.getDate() + 7);
            await client.query('DELETE FROM shifts WHERE start_time >= $1 AND start_time < $2 AND business_id = $3', [
                formatDateTime(currentWeekStart),
                formatDateTime(nextWeekStart),
                business_id
            ]);

            const settingsRes = await client.query('SELECT operating_hours_start, operating_hours_end FROM business_settings WHERE business_id = $1', [business_id]);
            if (settingsRes.rows.length === 0) {
                return res.status(400).json({ error: 'Operating hours not configured for this business. Please update business settings.' });
            }
            const settings = settingsRes.rows[0];
            const businessStartHour = parseInt(settings.operating_hours_start.split(':')[0], 10);
            const businessEndHour = parseInt(settings.operating_hours_end.split(':')[0], 10);

            const { rows: employees } = await client.query(`
                SELECT user_id, full_name, availability, location_id, employment_type FROM users 
                WHERE role = 'employee' AND availability IS NOT NULL AND business_id = $1
            `, [business_id]);

            const { rows: managers } = await client.query(`
                SELECT user_id, full_name, availability, location_id FROM users 
                WHERE role = 'manager' AND availability IS NOT NULL AND business_id = $1
            `, [business_id]);

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
            const MINIMUM_EMPLOYEES_PER_HOUR = 2;
            const MINIMUM_MANAGERS_PER_HOUR = 1;

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
                const hoursInDay = businessEndHour - businessStartHour;

                // Validate dailyTarget against minimum staffing requirement
                const minimumEmployeeHours = MINIMUM_EMPLOYEES_PER_HOUR * hoursInDay;
                let warnings = [];
                if (dailyTarget < minimumEmployeeHours) {
                    warnings.push(`Daily hours target (${dailyTarget}) is less than minimum required (${minimumEmployeeHours}) for ${MINIMUM_EMPLOYEES_PER_HOUR} employees over ${hoursInDay} hours.`);
                }

                // Manager Scheduling with Partial Coverage
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
                        INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes, business_id)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        mgr.user_id,
                        mgr.location_id,
                        formatDateTime(shiftStart),
                        formatDateTime(shiftEnd),
                        `Auto-assigned Manager Partial Coverage`,
                        business_id
                    ]);
                    for (let h = availStart; h < availEnd; h++) {
                        const index = h - businessStartHour;
                        if (index >= 0 && index < managerCoverage.length) {
                            managerCoverage[index]++;
                        }
                    }
                }

                // Employee Scheduling with Break for Full-Time
                const employeeCoverage = Array(hoursInDay).fill(0);
                while (employeeCoverage.some(count => count < MINIMUM_EMPLOYEES_PER_HOUR) || scheduledHoursToday < dailyTarget) {
                    let bestCandidate = null;
                    let bestScore = -1;

                    for (let currentHour = businessStartHour; currentHour <= businessEndHour - PART_TIME_SHIFT_LENGTH; currentHour++) {
                        const eligibleEmployees = employeeScheduleData.filter(emp => {
                            if (emp.daysWorked >= 5 || scheduledToday.has(emp.user_id)) return false;
                            if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= MINIMUM_HOURS_FULL_TIME) return false;

                            const dayAvail = emp.availability?.[dayName];
                            if (!dayAvail) return false;
                            const availStart = Math.max(parseInt(dayAvail.start.split(':')[0], 10), businessStartHour);
                            const availEnd = Math.min(parseInt(dayAvail.end.split(':')[0], 10), businessEndHour);

                            const shiftLength = emp.employment_type === 'Full-time' ? FULL_TIME_SHIFT_LENGTH_TOTAL : PART_TIME_SHIFT_LENGTH;
                            const shiftEndHour = currentHour + shiftLength;

                            return availStart <= currentHour && availEnd >= shiftEndHour && currentHour >= businessStartHour && shiftEndHour <= businessEndHour;
                        });

                        for (const emp of eligibleEmployees) {
                            const shiftLength = emp.employment_type === 'Full-time' ? FULL_TIME_SHIFT_LENGTH_TOTAL : PART_TIME_SHIFT_LENGTH;
                            const shiftWorkHours = emp.employment_type === 'Full-time' ? FULL_TIME_WORK_DURATION : PART_TIME_SHIFT_LENGTH;

                            let coverageScore = 0;
                            let hoursScore = Math.min(dailyTarget - scheduledHoursToday, shiftWorkHours) / dailyTarget; // Normalize contribution to dailyTarget
                            if (emp.employment_type === 'Full-time') {
                                // Calculate coverage for full-time with break after 4 hours
                                const breakStartHour = currentHour + 4;
                                for (let h = currentHour; h < breakStartHour; h++) {
                                    const idx = h - businessStartHour;
                                    if (idx >= 0 && idx < employeeCoverage.length && employeeCoverage[idx] < MINIMUM_EMPLOYEES_PER_HOUR) {
                                        coverageScore += (MINIMUM_EMPLOYEES_PER_HOUR - employeeCoverage[idx]);
                                    }
                                }
                                for (let h = breakStartHour + 0.5; h < currentHour + shiftWorkHours; h++) {
                                    const idx = h - businessStartHour;
                                    if (idx >= 0 && idx < employeeCoverage.length && employeeCoverage[idx] < MINIMUM_EMPLOYEES_PER_HOUR) {
                                        coverageScore += (MINIMUM_EMPLOYEES_PER_HOUR - employeeCoverage[idx]);
                                    }
                                }
                            } else {
                                // Part-time, no break
                                for (let h = currentHour; h < currentHour + shiftWorkHours; h++) {
                                    const idx = h - businessStartHour;
                                    if (idx >= 0 && idx < employeeCoverage.length && employeeCoverage[idx] < MINIMUM_EMPLOYEES_PER_HOUR) {
                                        coverageScore += (MINIMUM_EMPLOYEES_PER_HOUR - employeeCoverage[idx]);
                                    }
                                }
                            }

                            // Combine coverage and hours scores (weight coverage higher to prioritize minimum staffing)
                            const score = (0.7 * coverageScore) + (0.3 * hoursScore);

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
                        notes += `, Off-the-clock break from ${breakStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${breakEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
                    }

                    await client.query(`
                        INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes, business_id)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        emp.user_id,
                        emp.location_id,
                        formatDateTime(shiftStart),
                        formatDateTime(shiftEnd),
                        notes,
                        business_id
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
                            if (index >= 0 && index < employeeCoverage.length) {
                                employeeCoverage[index]++;
                            }
                        }
                        for (let h = breakStartHour + 0.5; h < currentHour + shiftWorkHours; h++) {
                            const index = h - businessStartHour;
                            if (index >= 0 && index < employeeCoverage.length) {
                                employeeCoverage[index]++;
                            }
                        }
                    } else {
                        // Part-time, mark continuous coverage
                        for (let h = currentHour; h < currentHour + shiftWorkHours; h++) {
                            const index = h - businessStartHour;
                            if (index >= 0 && index < employeeCoverage.length) {
                                employeeCoverage[index]++;
                            }
                        }
                    }

                    scheduledHoursToday += shiftWorkHours;
                    totalShiftsCreated++;
                }

                // Log uncovered hours for managers and employees
                if (!uncoveredHoursLog[dayName]) uncoveredHoursLog[dayName] = [];
                for (let h = 0; h < hoursInDay; h++) {
                    if (managerCoverage[h] < MINIMUM_MANAGERS_PER_HOUR || employeeCoverage[h] < MINIMUM_EMPLOYEES_PER_HOUR) {
                        uncoveredHoursLog[dayName].push({
                            hour: businessStartHour + h,
                            managers: managerCoverage[h],
                            employees: employeeCoverage[h]
                        });
                    }
                }

                scheduledHoursByDay[dayName] = {
                    target: dailyTarget,
                    scheduled: scheduledHoursToday,
                    warnings: warnings.length > 0 ? warnings : undefined
                };
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

                        const availStart = Math.max(parseInt(dayAvail.start.split(':')[0], 10), businessStartHour);
                        const availEnd = Math.min(parseInt(dayAvail.end.split(':')[0], 10), businessEndHour);
                        const shiftStartHour = Math.max(availStart, businessStartHour);
                        const shiftEndHour = shiftStartHour + FULL_TIME_SHIFT_LENGTH_TOTAL;

                        if (shiftEndHour > availEnd || shiftEndHour > businessEndHour) continue;

                        const shiftStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), shiftStartHour, 0, 0);
                        const shiftEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), shiftStartHour + FULL_TIME_SHIFT_LENGTH_TOTAL, 0, 0);
                        const breakStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), shiftStartHour + 4, 0, 0);
                        const breakEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), shiftStartHour + 4, 30, 0);

                        await client.query(`
                            INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes, business_id)
                            VALUES ($1, $2, $3, $4, $5, $6)
                        `, [
                            emp.user_id,
                            emp.location_id,
                            formatDateTime(shiftStart),
                            formatDateTime(shiftEnd),
                            `Minimum hours adjustment, Off-the-clock break from ${breakStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${breakEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
                            business_id
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