// routes/autoScheduleRoutes.js

// This module will contain the auto-scheduling route logic.
// It receives 'app', 'pool', 'isAuthenticated', and 'isAdmin' from server.js
// to register the route and utilize middleware and database connection.

module.exports = (app, pool, isAuthenticated, isAdmin) => {

    // Auto-generate shifts route
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
                WHERE role = 'location_admin' AND availability IS NOT NULL
            `);

            let employeeScheduleData = employees.map(e => ({
                ...e,
                scheduled_hours: 0,
                daysWorked: 0,
                scheduledForCurrentDay: false // This flag tracks if an employee is scheduled for the current day being processed
            }));

            // Separate manager tracking, could have their own total hours/days logic if needed
            let managerScheduleData = managers.map(m => ({
                ...m,
                scheduledForCurrentDay: false
            }));


            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            let totalShiftsCreated = 0;
            const FULL_TIME_WORK_DURATION = 8;
            const FULL_TIME_BREAK_DURATION = 0.5;
            const FULL_TIME_SHIFT_LENGTH_TOTAL = FULL_TIME_WORK_DURATION + FULL_TIME_BREAK_DURATION;
            const PART_TIME_SHIFT_LENGTH = 4;

            let uncoveredHoursLog = {}; // To log any hours that couldn't be covered


            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(currentDate.getDate() + i);
                currentDate.setHours(0, 0, 0, 0);
                const dayName = daysOfWeek[currentDate.getDay()];
                let remainingDailyTargetHours = parseFloat(dailyHours[dayName] || 0);

                // Reset scheduledForCurrentDay flag for all employees AND managers at the start of each new day
                employeeScheduleData.forEach(emp => emp.scheduledForCurrentDay = false);
                managerScheduleData.forEach(mgr => mgr.scheduledForCurrentDay = false);

                const dailyCoverageCount = Array(businessEndHour - businessStartHour).fill(0);

                const existingShiftsRes = await client.query(`
                    SELECT employee_id, start_time, end_time FROM shifts
                    WHERE DATE(start_time) = $1 AND DATE(end_time) = $1;
                `, [currentDate.toISOString().split('T')[0]]);

                existingShiftsRes.rows.forEach(shift => {
                    const startHour = new Date(shift.start_time).getHours();
                    const endHour = new Date(shift.end_time).getHours();
                    for (let h = startHour; h < endHour; h++) {
                        const idx = h - businessStartHour;
                        if (idx >= 0 && idx < dailyCoverageCount.length) {
                            dailyCoverageCount[idx]++;
                        }
                    }
                });

                // === Schedule Managers to Cover Gaps First (One Manager Shift per Day) ===
                // This ensures essential manager coverage.
                const scheduledManagerIdsForDay = new Set();
                for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                    // Check if this specific hour needs manager coverage (if no manager is currently covering it in this auto-run)
                    const isManagerCovered = dailyCoverageCount[currentHour - businessStartHour] > 0 &&
                                             managers.some(m => !m.scheduledForCurrentDay && // if a manager is already scheduled via auto-run this hour
                                             new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), m.availability?.[dayName]?.start.split(':')[0], 0, 0).getHours() <= currentHour &&
                                             new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), m.availability?.[dayName]?.end.split(':')[0], 0, 0).getHours() > currentHour);

                    if (isManagerCovered && managers.length > 0) {
                         // Manager is already covering this exact hour, or we don't have managers.
                         continue;
                    }
                    
                    const eligibleManagers = managerScheduleData.filter(mgr => {
                        if (mgr.scheduledForCurrentDay) return false; // Ensure only one manager shift per day

                        const avail = mgr.availability?.[dayName];
                        if (!avail) return false;

                        const availStart = parseInt(avail.start.split(':')[0], 10);
                        const availEnd = parseInt(avail.end.split(':')[0], 10);
                        
                        // Check if manager can cover a block of at least 4 hours from currentHour
                        const potentialShiftEnd = currentHour + 4; // Managers might take 4-hour chunks
                        return availStart <= currentHour && availEnd >= potentialShiftEnd && potentialShiftEnd <= businessEndHour;
                    }).sort((a, b) => a.user_id - b.user_id); // Stable sort

                    if (eligibleManagers.length > 0) {
                        const managerToSchedule = eligibleManagers[0];
                        // Schedule manager for the full available block they can cover from this currentHour
                        const managerShiftStartHour = currentHour;
                        const managerShiftEndHour = Math.min(businessEndHour, parseInt(managerToSchedule.availability[dayName].end.split(':')[0], 10));
                        
                        // Ensure shift is at least minimum duration, e.g. 1 hour
                        if (managerShiftEndHour - managerShiftStartHour < 1) continue;

                        const shiftStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), managerShiftStartHour, 0, 0);
                        const shiftEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), managerShiftEndHour, 0, 0);

                        await client.query(`
                            INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes)
                            VALUES ($1, $2, $3, $4, $5)
                        `, [
                            managerToSchedule.user_id,
                            managerToSchedule.location_id,
                            shiftStart.toISOString(),
                            shiftEnd.toISOString(),
                            `Auto-assigned Manager - ${shiftStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${shiftEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                        ]);

                        // Mark manager as scheduled for this day
                        const mgrIndex = managerScheduleData.findIndex(m => m.user_id === managerToSchedule.user_id);
                        if (mgrIndex !== -1) managerScheduleData[mgrIndex].scheduledForCurrentDay = true;

                        // Mark covered hours
                        for (let h = managerShiftStartHour; h < managerShiftEndHour; h++) {
                            const idx = h - businessStartHour;
                            if (idx >= 0 && idx < dailyCoverageCount.length) {
                                dailyCoverageCount[idx]++;
                            }
                        }
                        // After scheduling a manager, we continue to the next hour for *employee* scheduling.
                        // We don't break the manager loop, as we might try to cover other periods if needed.
                        totalShiftsCreated++;
                    }
                }


                // === Schedule Employees (one continuous shift per day per employee) ===
                // This loop now iterates through employees and assigns them one shift for the day,
                // attempting to fill in available gaps from business start hour.

                // Sort employees to prioritize full-time over part-time, then by fewer hours scheduled
                const sortedEmployees = employeeScheduleData.filter(emp => !emp.scheduledForCurrentDay) // Only employees not yet scheduled today
                                                          .sort((a, b) => {
                                                              if (a.employment_type === 'Full-time' && b.employment_type !== 'Full-time') return -1;
                                                              if (a.employment_type !== 'Full-time' && b.employment_type === 'Full-time') return 1;
                                                              return a.scheduled_hours - b.scheduled_hours;
                                                          });

                for (const emp of sortedEmployees) {
                    // Check if employee has already been scheduled for the day (redundant if filtered above, but defensive)
                    if (emp.scheduledForCurrentDay) continue; 
                    
                    const dayAvail = emp.availability?.[dayName];
                    if (!dayAvail) continue;

                    const availStartHour = parseInt(dayAvail.start.split(':')[0], 10);
                    const availEndHour = parseInt(dayAvail.end.split(':')[0], 10);

                    // Determine the ideal start time for this employee's shift on this day.
                    // It should be the greater of businessStartHour and their availability start hour.
                    const shiftStartCandidateHour = Math.max(businessStartHour, availStartHour);
                    
                    let shiftLength;
                    let shiftWorkHours;
                    let shiftBreakMinutes = 0;

                    if (emp.employment_type === 'Full-time') {
                        shiftLength = FULL_TIME_SHIFT_LENGTH_TOTAL;
                        shiftWorkHours = FULL_TIME_WORK_DURATION;
                        shiftBreakMinutes = FULL_TIME_BREAK_DURATION * 60;
                    } else {
                        shiftLength = PART_TIME_SHIFT_LENGTH;
                        shiftWorkHours = PART_TIME_SHIFT_LENGTH;
                    }

                    const shiftEndCandidateHour = shiftStartCandidateHour + shiftLength;

                    // Ensure the shift fits within business hours AND employee's availability
                    if (shiftEndCandidateHour > businessEndHour || shiftEndCandidateHour > availEndHour) {
                        continue; // Cannot schedule a full shift for this employee
                    }

                    // Before scheduling, check if this shift actually covers any "uncovered" hours.
                    // This helps prioritize filling gaps if the daily target isn't met.
                    let coversUncovered = false;
                    for (let h = shiftStartCandidateHour; h < shiftEndCandidateHour; h++) {
                        const idx = h - businessStartHour;
                        if (idx >= 0 && idx < dailyCoverageCount.length && dailyCoverageCount[idx] === 0) {
                            coversUncovered = true;
                            break;
                        }
                    }

                    // Only schedule if it covers an uncovered spot OR if remainingDailyTargetHours needs more staffing
                    if (!coversUncovered && remainingDailyTargetHours <= 0) {
                         // If it doesn't cover new ground and target is met, don't schedule.
                        continue;
                    }

                    const shiftStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), shiftStartCandidateHour, 0, 0);
                    const shiftEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), shiftStartCandidateHour + shiftWorkHours, shiftBreakMinutes, 0);

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

                    const globalEmpIndex = employeeScheduleData.findIndex(e => e.user_id === emp.user_id);
                    if (globalEmpIndex !== -1) {
                        employeeScheduleData[globalEmpIndex].scheduled_hours += shiftWorkHours;
                        employeeScheduleData[globalEmpIndex].daysWorked++;
                        employeeScheduleData[globalEmpIndex].scheduledForCurrentDay = true; // Mark as scheduled for today
                    }

                    remainingDailyTargetHours -= shiftWorkHours;
                    totalShiftsCreated++;

                    // Mark covered hours
                    for (let h = shiftStartCandidateHour; h < shiftEndCandidateHour; h++) {
                        const idx = h - businessStartHour;
                        if (idx >= 0 && idx < dailyCoverageCount.length) {
                            dailyCoverageCount[idx]++;
                        }
                    }
                    // After scheduling one shift for this employee for the day, move to the next employee.
                }
            }

            await client.query('COMMIT');
            res.status(201).json({
                message: `Successfully created ${totalShiftsCreated} auto-generated shifts.`,
                uncovered_hours: uncoveredHoursLog // Ensure this is populated if needed
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
