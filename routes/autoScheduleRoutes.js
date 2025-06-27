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
                scheduled_hours: 0,
                daysWorked: 0, // Track days worked by each employee for the current week
            }));

            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            let totalShiftsCreated = 0;

            // Define constants for shift lengths and breaks at a higher scope
            const FULL_TIME_WORK_DURATION = 8;
            const FULL_TIME_BREAK_DURATION = 0.5;
            const FULL_TIME_SHIFT_LENGTH_TOTAL = FULL_TIME_WORK_DURATION + FULL_TIME_BREAK_DURATION;
            const PART_TIME_SHIFT_LENGTH = 4;


            // Iterate through each day of the week (Sunday to Saturday)
            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(currentDate.getDate() + i);
                currentDate.setHours(0,0,0,0); // Ensure current date starts at midnight for consistent time calculations
                const dayName = daysOfWeek[currentDate.getDay()]; // Get day name (e.g., 'monday')
                let remainingDailyTargetHours = parseFloat(dailyHours[dayName] || 0); // Target hours for this specific day
                
                // Create a temporary daily state for employees to track who has been scheduled for *this specific day*
                let currentDayEmployees = JSON.parse(JSON.stringify(employeeScheduleData)); // Deep copy to modify per day

                // Create a coverage array for the current day, representing each hour (or half-hour)
                // Initialize with false (no coverage)
                const dailyCoverage = Array(businessEndHour - businessStartHour).fill(false); 

                // First, load existing shifts to mark occupied time slots
                const existingShiftsRes = await client.query(`
                    SELECT start_time, end_time FROM shifts
                    WHERE DATE(start_time) = $1 AND DATE(end_time) = $1;
                `, [currentDate.toISOString().split('T')[0]]);

                existingShiftsRes.rows.forEach(shift => {
                    const shiftStartHour = new Date(shift.start_time).getHours();
                    const shiftEndHour = new Date(shift.end_time).getHours(); 
                    
                    for (let h = shiftStartHour; h < shiftEndHour; h++) {
                        const coverageIndex = h - businessStartHour;
                        if (coverageIndex >= 0 && coverageIndex < dailyCoverage.length) {
                            dailyCoverage[coverageIndex] = true;
                        }
                    }
                });


                // Iterate through each hour within business hours to ensure coverage
                for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                    const coverageIndex = currentHour - businessStartHour;
                    if (remainingDailyTargetHours <= 0) break; // Daily target met

                    // If this hour is already covered by an existing shift or previously scheduled shift in this run
                    if (dailyCoverage[coverageIndex]) {
                        continue; 
                    }

                    let employeeAssignedThisHour = null; // Will hold the employee scheduled for this hour slot

                    // Step 1: Try to schedule a Full-time employee first
                    // Filter and sort eligible FT employees for this hour
                    const eligibleFTEmployees = currentDayEmployees.filter(emp => { // Filter from currentDayEmployees
                        if (emp.employment_type !== 'Full-time') return false; 
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.scheduled_hours >= 40) return false; 
                        if (emp.scheduledForCurrentDay) return false; // Skip if already scheduled today

                        const dayAvail = emp.availability && emp.availability[dayName];
                        // Check if employee's availability covers the full shift starting from currentHour AND stays within business bounds
                        return dayAvail && 
                               parseInt(dayAvail.start.split(':')[0], 10) <= currentHour && 
                               parseInt(dayAvail.end.split(':')[0], 10) >= (currentHour + FULL_TIME_SHIFT_LENGTH_TOTAL) &&
                               (currentHour + FULL_TIME_SHIFT_LENGTH_TOTAL) <= businessEndHour;
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize FTs with fewer hours scheduled

                    if (eligibleFTEmployees.length > 0) {
                        employeeAssignedThisHour = eligibleFTEmployees[0]; // Assign the employee here
                        
                        // Construct Date objects representing the intended local time, then convert to ISO UTC for TIMESTAMPTZ
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + FULL_TIME_WORK_DURATION, FULL_TIME_BREAK_DURATION * 60, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeAssignedThisHour.user_id, employeeAssignedThisHour.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData for persistent tracking across days
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeAssignedThisHour.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += FULL_TIME_WORK_DURATION; 
                            employeeScheduleData[globalEmpIndex].daysWorked++; 
                        }
                        employeeAssignedThisHour.scheduledForCurrentDay = true; // Mark as scheduled for THIS day's current iteration
                        remainingDailyTargetHours -= FULL_TIME_WORK_DURATION; 
                        totalShiftsCreated++;
                        
                        // Mark covered hours
                        for (let h = currentHour; h < currentHour + FULL_TIME_WORK_DURATION; h++) { 
                            const idx = h - businessStartHour;
                            if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                        }
                        // NEW: Remove scheduled employee from currentDayEmployees for the rest of the day
                        currentDayEmployees = currentDayEmployees.filter(emp => emp.user_id !== employeeAssignedThisHour.user_id);
                        continue; 
                    }

                    // Step 2: If no FT was scheduled for this slot, try to schedule a Part-time employee
                    // Only attempt if no employee was assigned in the FT step for this currentHour, and still target hours left
                    if (!employeeAssignedThisHour && remainingDailyTargetHours > 0) {
                        const eligiblePTEmployees = currentDayEmployees.filter(emp => { // Filter from currentDayEmployees
                            if (emp.employment_type !== 'Part-time') return false; 
                            if (emp.daysWorked >= 5) return false; 
                            if (emp.scheduledForCurrentDay) return false; // Skip if already scheduled today

                            const dayAvail = emp.availability && emp.availability[dayName];
                            // Check if availability covers the full shift starting from currentHour AND stays within business bounds
                            return dayAvail && 
                                   parseInt(dayAvail.start.split(':')[0], 10) <= currentHour && 
                                   parseInt(dayAvail.end.split(':')[0], 10) >= (currentHour + PART_TIME_SHIFT_LENGTH) &&
                                   (currentHour + PART_TIME_SHIFT_LENGTH) <= businessEndHour;
                        }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize PTs with fewer hours scheduled

                        if (eligiblePTEmployees.length > 0) {
                            employeeAssignedThisHour = eligiblePTEmployees[0]; // Assign the employee here
                            
                            // Construct Date objects representing the intended local time, then convert to ISO UTC for TIMESTAMPTZ
                            const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                            const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + PART_TIME_SHIFT_LENGTH, 0, 0); 
                            
                            const shiftStartTimeISO = shiftStartTime.toISOString();
                            const shiftEndTimeISO = shiftEndTime.toISOString();

                            await client.query(
                                'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                                [employeeAssignedThisHour.user_id, employeeAssignedThisHour.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated PT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                            );
                            
                            // Update the global employeeScheduleData for persistent tracking across days
                            const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeAssignedThisHour.user_id);
                            if (globalEmpIndex !== -1) {
                                employeeScheduleData[globalEmpIndex].scheduled_hours += PART_TIME_SHIFT_LENGTH;
                                employeeScheduleData[globalEmpIndex].daysWorked++;
                            }
                            employeeAssignedThisHour.scheduledForCurrentDay = true; // Mark as scheduled for today
                            remainingDailyTargetHours -= PART_TIME_SHIFT_LENGTH;
                            totalShiftsCreated++;
                            
                            // Mark covered hours
                            for (let h = currentHour; h < currentHour + PART_TIME_SHIFT_LENGTH; h++) {
                                const idx = h - businessStartHour;
                                if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                            }
                            // NEW: Remove scheduled employee from currentDayEmployees for the rest of the day
                            currentDayEmployees = currentDayEmployees.filter(emp => emp.user_id !== employeeAssignedThisHour.user_id);
                        }
                    }
                }
            }

            await client.query('COMMIT'); // Commit the transaction if all operations succeed
            res.status(201).json({ message: `Successfully auto-generated ${totalShiftsCreated} shifts.` });

        } catch (error) {
            await client.query('ROLLBACK'); // Rollback the transaction if any error occurs
            console.error('Auto-scheduling failed:', error);
            res.status(500).json({ error: 'An error occurred during auto-scheduling.' });
        } finally {
            client.release(); // Release the database client back to the pool
        }
    });
};
