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

            // Clear existing shifts for the target week before auto-generating new ones
            const currentWeekStart = new Date(weekStartDate);
            const nextWeekStart = new Date(currentWeekStart);
            nextWeekStart.setDate(currentWeekStart.getDate() + 7);
            await client.query('DELETE FROM shifts WHERE start_time >= $1 AND start_time < $2', [currentWeekStart, nextWeekStart]);


            // Fetch business operating hours
            const settingsRes = await client.query('SELECT * FROM business_settings WHERE id = 1');
            const settings = settingsRes.rows[0] || { operating_hours_start: '09:00', operating_hours_end: '17:00' };
            const businessStartHour = parseInt(settings.operating_hours_start.split(':')[0], 10);
            const businessEndHour = parseInt(settings.operating_hours_end.split(':')[0], 10); 

            // Fetch all employees with their availability and type
            const { rows: employees } = await client.query(`SELECT user_id, full_name, availability, location_id, employment_type FROM users WHERE role = 'employee' AND availability IS NOT NULL`);
            
            // Initialize employee data for scheduling, including days worked and scheduled hours
            let employeeScheduleData = employees.map(e => ({
                ...e,
                scheduled_hours: 0, // Total hours scheduled for the employee this week
                daysWorked: 0,      // Total days worked by this employee this week
            }));

            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            let totalShiftsCreated = 0;

            // Define constants for shift lengths and breaks at a higher scope
            const FULL_TIME_WORK_DURATION = 8;
            const FULL_TIME_BREAK_DURATION = 0.5;
            const FULL_TIME_SHIFT_LENGTH_TOTAL = FULL_TIME_WORK_DURATION + FULL_TIME_BREAK_DURATION; // 8.5 hours
            const PART_TIME_SHIFT_LENGTH = 4;


            // Iterate through each day of the week (Sunday to Saturday)
            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(currentDate.getDate() + i);
                currentDate.setHours(0,0,0,0); // Ensure current date starts at midnight for consistent time calculations
                const dayName = daysOfWeek[currentDate.getDay()]; 
                let remainingDailyTargetHours = parseFloat(dailyHours[dayName] || 0); 
                
                // Create a temporary daily state for employees to track who has been scheduled for *this specific day*
                // This copy is crucial because we will remove employees from it once they are scheduled for the current day.
                let currentDayEmployeesPool = employeeScheduleData.map(emp => ({ ...emp, scheduledForCurrentDay: false })); 

                // Create a coverage array for the current day, representing each hour within business hours.
                const dailyCoverage = Array(businessEndHour - businessStartHour).fill(false); 

                // Mark existing shifts (from manual entries or prior auto-runs in the transaction) as covered.
                const existingShiftsRes = await client.query(`
                    SELECT start_time, end_time FROM shifts
                    WHERE DATE(start_time) = $1 AND DATE(end_time) = $1;
                `, [currentDate.toISOString().split('T')[0]]);

                existingShiftsRes.rows.forEach(shift => {
                    const shiftStartLocalHour = new Date(shift.start_time).getHours(); 
                    const shiftEndLocalHour = new Date(shift.end_time).getHours(); 
                    
                    for (let h = shiftStartLocalHour; h < shiftEndLocalHour; h++) {
                        const coverageIndex = h - businessStartHour;
                        if (coverageIndex >= 0 && coverageIndex < dailyCoverage.length) {
                            dailyCoverage[coverageIndex] = true;
                        }
                    }
                });

                // Iterate through each hour within business hours to ensure full coverage
                for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                    const coverageIndex = currentHour - businessStartHour;

                    if (remainingDailyTargetHours <= 0 && dailyCoverage[coverageIndex]) {
                        continue; 
                    }
                    if (remainingDailyTargetHours <= 0 && !dailyCoverage[coverageIndex]) {
                         break;
                    }

                    let employeeScheduledThisHour = null; // Will hold the employee scheduled for this hour slot

                    // --- Attempt to schedule a Full-time employee first ---
                    const eligibleFTEmployees = currentDayEmployeesPool.filter(emp => { // Filter from currentDayEmployeesPool
                        // Global weekly limits
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.scheduled_hours >= 40) return false; 
                        // Per-day limit (one shift per employee per day)
                        if (emp.scheduledForCurrentDay) return false; // Skip if already assigned a shift today

                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;
                        
                        // Parse availability start/end hours from their string format
                        const availStartHour = parseInt(dayAvail.start.split(':')[0], 10);
                        const availEndHour = parseInt(dayAvail.end.split(':')[0], 10);

                        // Ensure proposed shift START is within business hours and employee availability
                        if (currentHour < businessStartHour || currentHour >= businessEndHour) return false;

                        // Check if employee's availability actually starts at or before currentHour
                        // and ends at or after the required shift end time (including break for FT)
                        const requiredShiftEndHourTotal = currentHour + FULL_TIME_SHIFT_LENGTH_TOTAL;

                        return availStartHour <= currentHour && 
                               availEndHour >= requiredShiftEndHourTotal &&
                               requiredShiftEndHourTotal <= businessEndHour; // Ensure shift ends within business hours
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize FTs with fewer hours scheduled

                    if (eligibleFTEmployees.length > 0) {
                        employeeScheduledThisHour = eligibleFTEmployees[0]; 
                        
                        // Construct Date objects representing the intended local time, then convert to ISO UTC for TIMESTAMPTZ
                        // Use currentDate's year/month/day with currentHour for local time construction on server.
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + FULL_TIME_WORK_DURATION, FULL_TIME_BREAK_DURATION * 60, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduledThisHour.user_id, employeeScheduledThisHour.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData for persistent tracking across days
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduledThisHour.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += FULL_TIME_WORK_DURATION; 
                            employeeScheduleData[globalEmpIndex].daysWorked++; 
                        }
                        // Mark employee as scheduled for THIS day in the temporary pool
                        employeeScheduledThisHour.scheduledForCurrentDay = true; 
                        
                        remainingDailyTargetHours -= FULL_TIME_WORK_DURATION; 
                        totalShiftsCreated++;
                        
                        // Mark covered hours
                        for (let h = currentHour; h < currentHour + FULL_TIME_WORK_DURATION; h++) { 
                            const idx = h - businessStartHour;
                            if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                        }
                        // NEW: Remove this employee from currentDayEmployeesPool so they are not scheduled again today
                        currentDayEmployeesPool = currentDayEmployeesPool.filter(emp => emp.user_id !== employeeScheduledThisHour.user_id);
                        continue; 
                    }

                    // --- If no FT was scheduled, try to schedule a Part-time employee ---
                    const eligiblePTEmployees = currentDayEmployeesPool.filter(emp => { // Filter from currentDayEmployeesPool
                        if (emp.employment_type !== 'Part-time') return false; 
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.scheduledForCurrentDay) return false; // Exclude if already assigned a shift today

                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;

                        const requiredShiftEndHour = currentHour + PART_TIME_SHIFT_LENGTH;
                        
                        // Ensure proposed shift START is within business hours and employee availability
                        if (currentHour < businessStartHour || currentHour >= businessEndHour) return false;

                        return parseInt(dayAvail.start.split(':')[0], 10) <= currentHour && 
                               parseInt(dayAvail.end.split(':')[0], 10) >= requiredShiftEndHour &&
                               requiredShiftEndHour <= businessEndHour;
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); 

                    if (eligiblePTEmployees.length > 0) {
                        employeeScheduledThisHour = eligiblePTEmployees[0]; 
                        
                        // Construct Date objects representing the intended local time, then convert to ISO UTC for TIMESTAMPTZ
                        // Use currentDate's year/month/day with currentHour for local time construction on server.
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + PART_TIME_SHIFT_LENGTH, 0, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduledThisHour.user_id, employeeScheduledThisHour.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated PT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduledThisHour.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += PART_TIME_SHIFT_LENGTH;
                            employeeScheduleData[globalEmpIndex].daysWorked++;
                        }
                        employeesScheduledTodayIds.add(employeeScheduledThisHour.user_id); // Mark employee as scheduled for this day
                        remainingDailyTargetHours -= PART_TIME_SHIFT_LENGTH;
                        totalShiftsCreated++;
                        
                        // Mark covered hours
                        for (let h = currentHour; h < currentHour + PART_TIME_SHIFT_LENGTH; h++) {
                            const idx = h - businessStartHour;
                            if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                        }
                        // NEW: Remove this employee from currentDayEmployeesPool so they are not scheduled again today
                        currentDayEmployeesPool = currentDayEmployeesPool.filter(emp => emp.user_id !== employeeAssignedThisHour.user_id);
                    }
                }
            }

            await client.query('COMMIT'); 
            res.status(201).json({ message: `Successfully created ${totalShiftsCreated} auto-generated shifts.` });

        } catch (error) {
            await client.query('ROLLBACK'); 
            console.error('Auto-scheduling failed:', error);
            res.status(500).json({ error: 'An error occurred during auto-scheduling.' });
        } finally {
            client.release(); 
        }
    });
};
