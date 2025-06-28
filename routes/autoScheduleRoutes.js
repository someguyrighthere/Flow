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
            // This array will be mutated to track weekly totals as shifts are assigned across days.
            let employeeScheduleData = employees.map(e => ({
                ...e,
                scheduled_hours: 0, // Total hours scheduled for the employee this week
                daysWorked: 0,      // Total days worked by this employee this week
                scheduledForCurrentDay: false // Track if this employee has been scheduled for the current day
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
                
                // Reset scheduledForCurrentDay flag for all employees at the start of each new day
                employeeScheduleData.forEach(emp => emp.scheduledForCurrentDay = false);

                // This pool will be filtered and reduced as employees are scheduled for the current day.
                let availableEmployeesForCurrentDayIteration = [...employeeScheduleData]; // Shallow copy for iteration purposes

                // Create a coverage array for the current day, counting employees covering each hour.
                const dailyCoverageCount = Array(businessEndHour - businessStartHour).fill(0); 

                // Mark existing shifts (from manual entries or prior auto-runs in the transaction) in dailyCoverageCount.
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
                            dailyCoverageCount[idx]++; // Increment count for covered hour
                        }
                    }
                });

                // Iterate through each hour within business hours to ensure full coverage
                for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                    const coverageIndex = currentHour - businessStartHour;

                    // If daily target is met AND this hour is already covered by 2+ people, move to the next hour.
                    // This prevents excessive overlapping if target is already met.
                    if (remainingDailyTargetHours <= 0 && dailyCoverageCount[coverageIndex] >= 2) {
                        continue; 
                    }
                    // If target hours are met, but this hour is NOT covered (dailyCoverageCount is 0 or 1), 
                    // or if remainingDailyTargetHours is still > 0, we need to try to schedule.
                    // This ensures full visual coverage even if target man-hours are theoretically met.


                    // Filter employees who are available for this slot, haven't met weekly limits,
                    // and have NOT yet been assigned a shift for *this specific day*.
                    const eligibleEmployeesForCurrentHour = availableEmployeesForCurrentDayIteration.filter(emp => { // Filter from the mutable pool
                        // Global weekly limits
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false; 
                        // IMPORTANT: emp.scheduledForCurrentDay is ALREADY checked by filtering availableEmployeesForCurrentDayIteration
                        // because once assigned, they are removed from this pool.

                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;
                        
                        const availStartHour = parseInt(dayAvail.start.split(':')[0], 10);
                        const availEndHour = parseInt(dayAvail.end.split(':')[0], 10);

                        // Ensure potential shift START is strictly within business hours
                        if (currentHour < businessStartHour || currentHour >= businessEndHour) return false;

                        // Calculate potential shift end based on employee type for checking availability and business bounds
                        let potentialShiftEndHour;
                        if (emp.employment_type === 'Full-time') {
                            potentialShiftEndHour = currentHour + FULL_TIME_SHIFT_LENGTH_TOTAL;
                        } else { // Part-time
                            potentialShiftEndHour = currentHour + PART_TIME_SHIFT_LENGTH;
                        }
                        
                        // Check if employee's availability covers the full shift starting from currentHour
                        // and if the shift would end within business hours
                        return availStartHour <= currentHour && 
                               availEndHour >= potentialShiftEndHour &&
                               potentialShiftEndHour <= businessEndHour; 

                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize those with fewer hours this week

                    // --- Attempt to schedule a Full-time employee first ---
                    const selectedFTEmployee = eligibleEmployeesForCurrentHour.find(emp => emp.employment_type === 'Full-time');

                    if (selectedFTEmployee) {
                        // Only allow scheduling if this hour slot is not yet covered by more than one person (max one overlap)
                        if (dailyCoverageCount[coverageIndex] < 2 || remainingDailyTargetHours > 0) { // Schedule if <2 people OR if target not met
                            // Construct Date objects based on the currentDate's local components and currentHour
                            const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                            const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + FULL_TIME_WORK_DURATION, FULL_TIME_BREAK_DURATION * 60, 0); 
                            
                            const shiftStartTimeISO = shiftStartTime.toISOString();
                            const shiftEndTimeISO = shiftEndTime.toISOString();

                            await client.query(
                                'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                                [selectedFTEmployee.user_id, selectedFTEmployee.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT - ${shiftStartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${shiftEndTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`]
                            );
                            
                            // Update the global employeeScheduleData for persistent tracking across weeks
                            const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === selectedFTEmployee.user_id);
                            if (globalEmpIndex !== -1) {
                                employeeScheduleData[globalEmpIndex].scheduled_hours += FULL_TIME_WORK_DURATION; 
                                employeeScheduleData[globalEmpIndex].daysWorked++; 
                                employeeScheduleData[globalEmpIndex].scheduledForCurrentDay = true; // Mark as scheduled for today
                            }
                            // NEW: Remove this employee from the available pool for the rest of the day
                            availableEmployeesForCurrentDayIteration = availableEmployeesForCurrentDayIteration.filter(emp => emp.user_id !== selectedFTEmployee.user_id);

                            remainingDailyTargetHours -= FULL_TIME_WORK_DURATION; 
                            totalShiftsCreated++;
                            
                            // Mark covered hours in dailyCoverageCount
                            for (let h = currentHour; h < currentHour + FULL_TIME_WORK_DURATION; h++) { 
                                const idx = h - businessStartHour;
                                if (idx >= 0 && idx < dailyCoverageCount.length) {
                                    dailyCoverageCount[idx]++; // Increment count for covered hour
                                }
                            }
                            continue; // Move to the next currentHour after scheduling this employee.
                        }
                    }

                    // --- If no FT was scheduled, try to schedule a Part-time employee ---
                    const selectedPTEmployee = eligibleEmployeesForCurrentHour.find(emp => emp.employment_type === 'Part-time');

                    if (selectedPTEmployee) {
                         // Only allow scheduling if this hour slot is not yet covered by more than one person (max one overlap)
                        if (dailyCoverageCount[coverageIndex] < 2 || remainingDailyTargetHours > 0) { // Schedule if <2 people OR if target not met
                            
                            // Construct Date objects based on the currentDate's local components and currentHour
                            const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                            const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + PART_TIME_SHIFT_LENGTH, 0, 0); 
                            
                            const shiftStartTimeISO = shiftStartTime.toISOString();
                            const shiftEndTimeISO = shiftEndTime.toISOString();

                            await client.query(
                                'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                                [selectedPTEmployee.user_id, selectedPTEmployee.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated PT - ${shiftStartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${shiftEndTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`]
                            );
                            
                            // Update the global employeeScheduleData
                            const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === selectedPTEmployee.user_id);
                            if (globalEmpIndex !== -1) {
                                employeeScheduleData[globalEmpIndex].scheduled_hours += PART_TIME_SHIFT_LENGTH;
                                employeeScheduleData[globalEmpIndex].daysWorked++;
                            }
                            // NEW: Remove this employee from the available pool for the rest of the day
                            availableEmployeesForCurrentDayIteration = availableEmployeesForCurrentDayIteration.filter(emp => emp.user_id !== selectedPTEmployee.user_id);
                            
                            remainingDailyTargetHours -= PART_TIME_SHIFT_LENGTH;
                            totalShiftsCreated++;
                            
                            // Mark covered hours
                            for (let h = currentHour; h < currentHour + PART_TIME_SHIFT_LENGTH; h++) {
                                const idx = h - businessStartHour;
                                if (idx >= 0 && idx < dailyCoverageCount.length) {
                                    dailyCoverageCount[idx]++; // Increment count for covered hour
                                }
                            }
                            continue; 
                        }
                    }
                }
            }

            // FINAL PASS: Fill any remaining completely uncovered hours with any available employee
            // This is the "unless all time slots are filled" part of the rule.
            // This ensures no visual gaps if the target hours were met but distribution wasn't perfect.
            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(currentDate.getDate() + i);
                currentDate.setHours(0,0,0,0);
                const dayName = daysOfWeek[currentDate.getDay()];

                for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                    const coverageIndex = currentHour - businessStartHour;
                    if (dailyCoverageCount[coverageIndex] === 0) { // If this hour is completely uncovered after primary pass
                        // Try to find ANY eligible employee (who hasn't hit max weekly hours/days) to cover this single hour.
                        const eligibleForGapFill = employeeScheduleData.filter(emp => {
                            if (emp.daysWorked >= 5) return false; 
                            if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false; 
                            
                            const dayAvail = emp.availability && emp.availability[dayName];
                            if (!dayAvail) return false;

                            // Can they even cover a minimal 1-hour slot starting here?
                            return parseInt(dayAvail.start.split(':')[0], 10) <= currentHour && 
                                   parseInt(dayAvail.end.split(':')[0], 10) > currentHour && // Must be available for at least part of the hour
                                   (currentHour + 1) <= businessEndHour; // Ensure 1 hour segment ends within business hours
                        }).sort((a, b) => a.scheduled_hours - b.scheduled_hours);

                        if (eligibleForGapFill.length > 0) {
                            const employeeToFillGap = eligibleForGapFill[0];
                            
                            // Schedule a minimal 1-hour shift to cover the gap
                            const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0);
                            const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + 1, 0, 0); // 1-hour block

                            await client.query(
                                'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                                [employeeToFillGap.user_id, employeeToFillGap.location_id, shiftStartTime.toISOString(), shiftEndTime.toISOString(), `Auto-generated GAP Fill - ${shiftStartTime.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})} to ${shiftEndTime.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}`]
                            );
                            
                            // Update global employeeScheduleData for this employee
                            const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeToFillGap.user_id);
                            if (globalEmpIndex !== -1) {
                                employeeScheduleData[globalEmpIndex].scheduled_hours += 1; // Add 1 hour
                            }
                            totalShiftsCreated++;
                            dailyCoverageCount[coverageIndex]++; // Mark this hour as covered
                            // We don't mark scheduledForCurrentDay here for gap fills, as they might have had their main shift.
                            // The primary concern is filling the visual gap.
                        }
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
