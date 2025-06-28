// routes/autoScheduleRoutes.js

function isTimeWindowFree(startHour, endHour, coverageArray, businessStartHour) {
    for (let h = startHour; h < endHour; h++) {
        const idx = h - businessStartHour;
        if (coverageArray[idx] >= 1) return false;
    }
    return true;
}

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

            let employeeScheduleData = employees.map(e => ({
                ...e,
                scheduled_hours: 0,
                daysWorked: 0,
                scheduledForCurrentDay: false
            }));

            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            let totalShiftsCreated = 0;
            const FULL_TIME_WORK_DURATION = 8;
            const FULL_TIME_BREAK_DURATION = 0.5;
            const FULL_TIME_SHIFT_LENGTH_TOTAL = FULL_TIME_WORK_DURATION + FULL_TIME_BREAK_DURATION;
            const PART_TIME_SHIFT_LENGTH = 4;

            let uncoveredHoursLog = {};

            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(currentDate.getDate() + i);
                currentDate.setHours(0, 0, 0, 0);
                const dayName = daysOfWeek[currentDate.getDay()];
                const remainingDailyTargetHours = parseFloat(dailyHours[dayName] || 0);

                employeeScheduleData.forEach(emp => emp.scheduledForCurrentDay = false);

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

                for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                    const coverageIndex = currentHour - businessStartHour;
                    if (dailyCoverageCount[coverageIndex] >= 1) continue;

                    const eligibleEmployees = employeeScheduleData.filter(emp => {
                        if (emp.daysWorked >= 5) return false;
                        if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false;
                        if (emp.scheduledForCurrentDay) return false;

                        const dayAvail = emp.availability?.[dayName];
                        if (!dayAvail) return false;

                        const availStart = parseInt(dayAvail.start.split(':')[0], 10);
                        const availEnd = parseInt(dayAvail.end.split(':')[0], 10);

                        const shiftLength = emp.employment_type === 'Full-time' ? FULL_TIME_SHIFT_LENGTH_TOTAL : PART_TIME_SHIFT_LENGTH;
                        const shiftEndHour = currentHour + shiftLength;

                        return (
                            availStart <= currentHour &&
                            availEnd >= shiftEndHour &&
                            shiftEndHour <= businessEndHour &&
                            isTimeWindowFree(currentHour, shiftEndHour, dailyCoverageCount, businessStartHour)
                        );
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours);

                    const selectedEmp = eligibleEmployees.find(e => e.employment_type === 'Full-time') ||
                                        eligibleEmployees.find(e => e.employment_type === 'Part-time');

                    if (!selectedEmp) {
                        if (!uncoveredHoursLog[dayName]) uncoveredHoursLog[dayName] = [];
                        uncoveredHoursLog[dayName].push(currentHour);
                        continue;
                    }

                    const shiftLength = selectedEmp.employment_type === 'Full-time'
                        ? FULL_TIME_SHIFT_LENGTH_TOTAL
                        : PART_TIME_SHIFT_LENGTH;

                    const shiftWorkHours = selectedEmp.employment_type === 'Full-time'
                        ? FULL_TIME_WORK_DURATION
                        : PART_TIME_SHIFT_LENGTH;

                    const shiftStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0);
                    const shiftEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + shiftWorkHours, selectedEmp.employment_type === 'Full-time' ? FULL_TIME_BREAK_DURATION * 60 : 0, 0);

                    await client.query(`
                        INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [
                        selectedEmp.user_id,
                        selectedEmp.location_id,
                        shiftStart.toISOString(),
                        shiftEnd.toISOString(),
                        `Auto-generated ${selectedEmp.employment_type === 'Full-time' ? 'FT' : 'PT'} - ${shiftStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${shiftEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                    ]);

                    const empIndex = employeeScheduleData.findIndex(e => e.user_id === selectedEmp.user_id);
                    employeeScheduleData[empIndex].scheduled_hours += shiftWorkHours;
                    employeeScheduleData[empIndex].daysWorked++;
                    employeeScheduleData[empIndex].scheduledForCurrentDay = true;

                    for (let h = currentHour; h < currentHour + shiftWorkHours; h++) {
                        const idx = h - businessStartHour;
                        if (idx >= 0 && idx < dailyCoverageCount.length) {
                            dailyCoverageCount[idx]++;
                        }
                    }

                    currentHour += shiftWorkHours - 1;
                    totalShiftsCreated++;
                }
            }

            await client.query('COMMIT');
            res.status(201).json({
                message: `Successfully created ${totalShiftsCreated} auto-generated shifts.`,
                uncovered_hours: uncoveredHoursLog
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
