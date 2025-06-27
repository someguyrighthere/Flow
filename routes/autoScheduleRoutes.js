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
            // We use a deep copy for employeeScheduleData as properties like scheduled_hours and daysWorked
            // need to persist across day iterations within the same auto-generation run.
            let employeeScheduleData = employees.map(e => ({
                ...e,
                scheduled_hours: 0, // Total hours scheduled for the employee this week
                daysWorked: 0,      // Total days worked by this employee this week
                // scheduledForCurrentDay is handled by filtering out already assigned employees for the current day
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
                const dayName = daysOfWeek[currentDate.getDay()]; // Get day name (e.g., 'monday')
                let remainingDailyTargetHours = parseFloat(dailyHours[dayName] || 0); // Target hours for this specific day
                
                // Track employees already assigned a shift for *this specific day*
                // This prevents scheduling the same employee twice on the same day for a new shift.
                const employeesScheduledTodayIds = new Set(); 

                // Create a coverage array for the current day, representing each hour
                // This tracks if a specific hour slot is covered by *any* scheduled shift
                const dailyCoverage = Array(businessEndHour - businessStartHour).fill(false); 

                // Mark existing shifts (from previous manual entries or prior auto-runs in the transaction)
                // as covered for this day.
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

                // Iterate through each hour within business hours to ensure full coverage
                for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                    const coverageIndex = currentHour - businessStartHour;

                    if (remainingDailyTargetHours <= 0 && dailyCoverage[coverageIndex]) {
                         // If daily target met and this hour is covered, no need to schedule more for this hour.
                        continue; 
                    }
                    if (remainingDailyTargetHours <= 0 && !dailyCoverage[coverageIndex]) {
                        break; // If target hours are met, and this hour is NOT covered, break if we prioritize target over full coverage.
                               // For 'all business open hours need to have coverage', this condition should be reconsidered.
                               // Given the latest instruction, we need to ensure ALL business hours are covered.
                               // The `remainingDailyTargetHours` might be just a guideline, while `dailyCoverage` indicates actual need.
                               // Let's modify the break condition to prioritize coverage.
                    }

                    // Only attempt to schedule if the currentHour slot needs coverage.
                    // This implies the dailyCoverage check before this loop.
                    // Let's refine the overall loop control logic.
                }

                // NEW: Reset scheduledForCurrentDay for employees at the start of each day's scheduling pass
                employeeScheduleData.forEach(emp => {
                    emp.scheduledForCurrentDay = false; 
                });

                // Iterate through each hour within business hours to ensure full coverage
                // This loop now focuses on filling 'dailyCoverage' based on 'remainingDailyTargetHours'
                // and available employees.
                let currentSlotHour = businessStartHour; // Use a separate variable for iteration for clarity

                while (remainingDailyTargetHours > 0 && currentSlotHour < businessEndHour) {
                    const coverageIndex = currentSlotHour - businessStartHour;
                    // If this exact hour slot is already covered, try the next hour.
                    if (coverageIndex >= 0 && coverageIndex < dailyCoverage.length && dailyCoverage[coverageIndex]) {
                        currentSlotHour++;
                        continue;
                    }

                    let employeeScheduledInCurrentSlot = null;

                    // Step 1: Try to schedule a Full-time employee first
                    const eligibleFTEmployees = employeeScheduleData.filter(emp => {
                        if (emp.employment_type !== 'Full-time') return false; 
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.scheduled_hours >= 40) return false; 
                        if (emp.scheduledForCurrentDay) return false; // Exclude if already assigned a shift today

                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;
                        
                        // Check if employee's availability covers the full shift starting from currentSlotHour
                        // And if the shift would end within business hours
                        return parseInt(dayAvail.start.split(':')[0], 10) <= currentSlotHour && 
                               parseInt(dayAvail.end.split(':')[0], 10) >= (currentSlotHour + FULL_TIME_SHIFT_LENGTH_TOTAL) &&
                               (currentSlotHour + FULL_TIME_SHIFT_LENGTH_TOTAL) <= businessEndHour;
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize FTs with fewer hours scheduled

                    if (eligibleFTEmployees.length > 0) {
                        employeeScheduledInCurrentSlot = eligibleFTEmployees[0]; 
                        
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentSlotHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentSlotHour + FULL_TIME_WORK_DURATION, FULL_TIME_BREAK_DURATION * 60, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduledInCurrentSlot.user_id, employeeScheduledInCurrentSlot.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduledInCurrentSlot.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += FULL_TIME_WORK_DURATION; 
                            employeeScheduleData[globalEmpIndex].daysWorked++; 
                        }
                        employeeScheduledInCurrentSlot.scheduledForCurrentDay = true; // Mark as scheduled for THIS day
                        remainingDailyTargetHours -= FULL_TIME_WORK_DURATION; 
                        totalShiftsCreated++;
                        
                        // Mark covered hours by this new shift
                        for (let h = currentSlotHour; h < currentSlotHour + FULL_TIME_WORK_DURATION; h++) { 
                            const idx = h - businessStartHour;
                            if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                        }
                        currentSlotHour += FULL_TIME_WORK_DURATION; // Advance time to after this shift for next iteration
                        continue; // Proceed to next iteration of while loop
                    }

                    // Step 2: If no FT was scheduled for this slot, try to schedule a Part-time employee
                    const eligiblePTEmployees = employeeScheduleData.filter(emp => {
                        if (emp.employment_type !== 'Part-time') return false; 
                        if (emp.daysWorked >= 5) return false; 
                        if (employeesScheduledTodayIds.has(emp.user_id)) return false; // Exclude if already assigned a shift today

                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;

                        // Check if employee's availability covers the full shift starting from currentSlotHour
                        // And if the shift would end within business hours
                        return parseInt(dayAvail.start.split(':')[0], 10) <= currentSlotHour && 
                               parseInt(dayAvail.end.split(':')[0], 10) >= (currentSlotHour + PART_TIME_SHIFT_LENGTH) &&
                               (currentSlotHour + PART_TIME_SHIFT_LENGTH) <= businessEndHour;
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize PTs with fewer hours scheduled

                    if (eligiblePTEmployees.length > 0) {
                        employeeScheduledInCurrentSlot = eligiblePTEmployees[0]; 
                        
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentSlotHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentSlotHour + PART_TIME_SHIFT_LENGTH, 0, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduledInCurrentSlot.user_id, employeeScheduledInCurrentSlot.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated PT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduledInCurrentSlot.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += PART_TIME_SHIFT_LENGTH;
                            employeeScheduleData[globalEmpIndex].daysWorked++;
                        }
                        employeesScheduledTodayIds.add(employeeScheduledInCurrentSlot.user_id); // Mark this employee scheduled for today
                        remainingDailyTargetHours -= PART_TIME_SHIFT_LENGTH;
                        totalShiftsCreated++;
                        
                        // Mark covered hours
                        for (let h = currentSlotHour; h < currentSlotHour + PART_TIME_SHIFT_LENGTH; h++) {
                            const idx = h - businessStartHour;
                            if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                        }
                        currentSlotHour += PART_TIME_SHIFT_LENGTH; // Advance time
                        continue; // Proceed to next iteration of while loop
                    }

                    // If no employee was scheduled for this 'currentSlotHour', advance to the next hour to try again.
                    // This prevents infinite loops if no one is available for a standard shift at the current time.
                    currentSlotHour++;
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
