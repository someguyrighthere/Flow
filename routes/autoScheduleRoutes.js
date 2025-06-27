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
            
            // FIX: Parse business hours into total minutes for accurate comparisons
            const businessStartTotalMinutes = parseInt(settings.operating_hours_start.split(':')[0], 10) * 60 + parseInt(settings.operating_hours_start.split(':')[1], 10);
            const businessEndTotalMinutes = parseInt(settings.operating_hours_end.split(':')[0], 10) * 60 + parseInt(settings.operating_hours_end.split(':')[1], 10);
            
            // --- DEBUG LOGS: Business Hours ---
            console.log(`[AUTO-SCHEDULE-LOG] Fetched Business Start Time: ${settings.operating_hours_start}`);
            console.log(`[AUTO-SCHEDULE-LOG] Fetched Business End Time: ${settings.operating_hours_end}`);
            console.log(`[AUTO-SCHEDULE-LOG] Parsed Business Start Total Minutes: ${businessStartTotalMinutes}`);
            console.log(`[AUTO-SCHEDULE-LOG] Parsed Business End Total Minutes: ${businessEndTotalMinutes}`);
            // --- END DEBUG LOGS ---


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

            // Define constants for shift lengths and breaks in MINUTES for consistency
            const FULL_TIME_WORK_DURATION_MINUTES = 8 * 60; // 8 hours
            const FULL_TIME_BREAK_DURATION_MINUTES = 0.5 * 60; // 30 minutes
            const FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES = FULL_TIME_WORK_DURATION_MINUTES + FULL_TIME_BREAK_DURATION_MINUTES; // 8.5 hours in minutes
            const PART_TIME_SHIFT_LENGTH_MINUTES = 4 * 60; // 4 hours

            // Define the smallest scheduling interval (e.g., 15 minutes)
            const SCHEDULING_INTERVAL_MINUTES = 15;


            // Iterate through each day of the week (Sunday to Saturday)
            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(currentDate.getDate() + i);
                currentDate.setHours(0,0,0,0); // Ensure current date starts at midnight for consistent time calculations
                const dayName = daysOfWeek[currentDate.getDay()]; 
                let remainingDailyTargetHours = parseFloat(dailyHours[dayName] || 0); 
                let remainingDailyTargetMinutes = remainingDailyTargetHours * 60; // Convert target hours to minutes
                
                // Track employees already assigned a shift for *this specific day*
                const employeesScheduledTodayIds = new Set(); 

                // Create a coverage array for the current day, representing each 15-minute slot within business hours.
                const totalBusinessMinutes = businessEndTotalMinutes - businessStartTotalMinutes;
                const dailyCoverageSlots = Array(Math.ceil(totalBusinessMinutes / SCHEDULING_INTERVAL_MINUTES)).fill(false); 

                // Mark existing shifts (from manual entries or prior auto-runs in the transaction) as covered.
                const existingShiftsRes = await client.query(`
                    SELECT start_time, end_time FROM shifts
                    WHERE DATE(start_time) = $1 AND DATE(end_time) = $1;
                `, [currentDate.toISOString().split('T')[0]]);

                existingShiftsRes.rows.forEach(shift => {
                    const shiftStartTotalMinutes = new Date(shift.start_time).getHours() * 60 + new Date(shift.start_time).getMinutes(); 
                    const shiftEndTotalMinutes = new Date(shift.end_time).getHours() * 60 + new Date(shift.end_time).getMinutes(); 
                    
                    for (let m = shiftStartTotalMinutes; m < shiftEndTotalMinutes; m += SCHEDULING_INTERVAL_MINUTES) {
                        const coverageIndex = (m - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES;
                        if (coverageIndex >= 0 && coverageIndex < dailyCoverageSlots.length) {
                            dailyCoverageSlots[coverageIndex] = true;
                        }
                    }
                });

                // --- DEBUG LOGS: Daily Status ---
                console.log(`\n--- [AUTO-SCHEDULE-LOG] Processing Day: ${dayName} (${currentDate.toISOString().split('T')[0]}) ---`);
                console.log(`[AUTO-SCHEDULE-LOG] Initial Remaining Daily Target Minutes: ${remainingDailyTargetMinutes}`);
                console.log(`[AUTO-SCHEDULE-LOG] Daily Coverage Slots after existing shifts: ${dailyCoverageSlots}`);
                // --- END DEBUG LOGS ---


                // FIX: Iterate through 15-minute intervals instead of hourly
                for (let currentMinute = businessStartTotalMinutes; currentMinute < businessEndTotalMinutes; currentMinute += SCHEDULING_INTERVAL_MINUTES) {
                    const coverageIndex = (currentMinute - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES;

                    // Skip if target minutes are met and current slot is already covered
                    if (remainingDailyTargetMinutes <= 0 && dailyCoverageSlots[coverageIndex]) {
                        continue; 
                    }
                    // Break if target minutes are met and current slot is not covered (no more need to schedule for this day)
                    if (remainingDailyTargetMinutes <= 0 && !dailyCoverageSlots[coverageIndex]) {
                         break;
                    }
                    
                    // Check if current 15-min slot is already covered
                    if (dailyCoverageSlots[coverageIndex]) {
                        continue;
                    }

                    // --- Attempt to schedule a Full-time employee ---
                    const eligibleFTEmployees = employeeScheduleData.filter(emp => {
                        // Global weekly limits
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.scheduled_hours >= 40) return false; 
                        // Per-day limit (one shift per employee per day)
                        if (employeesScheduledTodayIds.has(emp.user_id)) return false; 

                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;
                        
                        // FIX: Parse availability start/end into total minutes
                        const availStartTotalMinutes = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                        const availEndTotalMinutes = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);

                        // Check if employee's availability actually starts at or before currentMinute
                        // and ends at or after the required shift end time (including break for FT)
                        const requiredShiftEndTotalMinutes = currentMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES;

                        // Ensure shift starts within available hours and ends within business hours
                        return availStartTotalMinutes <= currentMinute && 
                               availEndTotalMinutes >= requiredShiftEndTotalMinutes &&
                               requiredShiftEndTotalMinutes <= businessEndTotalMinutes;
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize FTs with fewer hours scheduled

                    if (eligibleFTEmployees.length > 0) {
                        const employeeScheduled = eligibleFTEmployees[0]; 
                        
                        // Construct Date objects representing the intended local time, then convert to ISO UTC for TIMESTAMPTZ
                        const shiftStartTime = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), Math.floor(currentMinute / 60), currentMinute % 60, 0)); 
                        const shiftEndTime = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), Math.floor(currentMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES) / 60, (currentMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES) % 60, 0)); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduled.user_id, employeeScheduled.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT for ${employeeScheduled.full_name}.`]
                        );
                        
                        // Update the global employeeScheduleData for persistent tracking across days
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduled.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += (FULL_TIME_WORK_DURATION_MINUTES / 60); // Store hours, not minutes
                            employeeScheduleData[globalEmpIndex].daysWorked++; 
                        }
                        employeesScheduledTodayIds.add(employeeScheduled.user_id); // Mark employee as scheduled for this day
                        remainingDailyTargetMinutes -= FULL_TIME_WORK_DURATION_MINUTES; // Reduce by work duration, not total shift length
                        totalShiftsCreated++;
                        
                        // Mark covered 15-min slots
                        for (let m = currentMinute; m < currentMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES; m += SCHEDULING_INTERVAL_MINUTES) { 
                            const idx = (m - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES;
                            if (idx >= 0 && idx < dailyCoverageSlots.length) dailyCoverageSlots[idx] = true;
                        }
                        continue; 
                    }

                    // --- If no FT was scheduled, try to schedule a Part-time employee ---
                    const eligiblePTEmployees = employeeScheduleData.filter(emp => {
                        if (emp.employment_type !== 'Part-time') return false; 
                        if (emp.daysWorked >= 5) return false; 
                        if (employeesScheduledTodayIds.has(emp.user_id)) return false; // Exclude if already assigned a shift today

                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;

                        // FIX: Parse availability start/end into total minutes
                        const availStartTotalMinutes = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                        const availEndTotalMinutes = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);

                        const requiredShiftEndTotalMinutes = currentMinute + PART_TIME_SHIFT_LENGTH_MINUTES; 
                        
                        return availStartTotalMinutes <= currentMinute && 
                               availEndTotalMinutes >= requiredShiftEndTotalMinutes &&
                               requiredShiftEndTotalMinutes <= businessEndTotalMinutes;
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); 

                    if (eligiblePTEmployees.length > 0) {
                        const employeeScheduled = eligiblePTEmployees[0]; 
                        
                        // Construct Date objects representing the intended local time, then convert to ISO UTC for TIMESTAMPTZ
                        const shiftStartTime = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), Math.floor(currentMinute / 60), currentMinute % 60, 0)); 
                        const shiftEndTime = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), Math.floor(currentMinute + PART_TIME_SHIFT_LENGTH_MINUTES) / 60, (currentMinute + PART_TIME_SHIFT_LENGTH_MINUTES) % 60, 0)); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduled.user_id, employeeScheduled.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated PT for ${employeeScheduled.full_name}.`]
                        );
                        
                        // Update the global employeeScheduleData
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduled.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += (PART_TIME_SHIFT_LENGTH_MINUTES / 60);
                            employeeScheduleData[globalEmpIndex].daysWorked++;
                        }
                        employeesScheduledTodayIds.add(employeeScheduled.user_id); // Mark employee as scheduled for this day
                        remainingDailyTargetMinutes -= PART_TIME_SHIFT_LENGTH_MINUTES;
                        totalShiftsCreated++;
                        
                        // Mark covered 15-min slots
                        for (let m = currentMinute; m < currentMinute + PART_TIME_SHIFT_LENGTH_MINUTES; m += SCHEDULING_INTERVAL_MINUTES) {
                            const idx = (m - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES;
                            if (idx >= 0 && idx < dailyCoverageSlots.length) dailyCoverageSlots[idx] = true;
                        }
                        continue; 
                    }
                }
            }

            await client.query('COMMIT'); 
            res.status(201).json({ message: `Successfully auto-generated ${totalShiftsCreated} shifts.` });

        } catch (error) {
            await client.query('ROLLBACK'); 
            console.error('Auto-scheduling failed:', error);
            res.status(500).json({ error: 'An error occurred during auto-scheduling.' });
        } finally {
            client.release(); 
        }
    });
};
