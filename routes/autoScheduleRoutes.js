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
                
                // This pool will be filtered and reduced as employees are scheduled for the current day.
                let availableEmployeesForDay = JSON.parse(JSON.stringify(employeeScheduleData)); 

                // Create a coverage array for the current day, counting employees covering each hour.
                const dailyCoverageCount = Array(businessEndHour - businessStartHour).fill(0); 

                // Mark existing shifts (from manual entries or prior auto-runs in the transaction) in dailyCoverageCount.
                const existingShiftsRes = await client.query(`
                    SELECT start_time, end_time FROM shifts
                    WHERE DATE(start_time) = $1 AND DATE(end_time) = $1;
                `, [currentDate.toISOString().split('T')[0]]);

                existingShiftsRes.rows.forEach(shift => {
                    const shiftStartLocalHour = new Date(shift.start_time).getHours(); 
                    const shiftEndLocalHour = new Date(shift.end_time).getHours(); 
                    
                    for (let h = shiftStartLocalHour; h < shiftEndLocalHour; h++) {
                        const coverageIndex = h - businessStartHour;
                        if (coverageIndex >= 0 && coverageIndex < dailyCoverageCount.length) {
                            dailyCoverageCount[coverageIndex]++; // Increment count for covered hour
                        }
                    }
                });

                // Iterate through each hour within business hours to ensure full coverage
                for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                    const coverageIndex = currentHour - businessStartHour;

                    // Decision Point: Do we need to schedule another person for this hour?
                    // This is where the 'only one overlap unless all time slots are filled and man hours are not met' comes in.
                    // If current coverage is 0, we need a primary. If it's 1, we can add 1 overlap if target needs it.
                    // If it's >=2, we stop for this specific hour, UNLESS overall daily target isn't met and NO other hour has 0 or 1 person.
                    // For now, let's keep it simple: target max 2 people per hour.
                    // If dailyCoverageCount[coverageIndex] is 0 or 1, we try to schedule more.
                    // If dailyCoverageCount[coverageIndex] >= 2, we skip this specific hour's scheduling,
                    // relying on the remainingDailyTargetHours to drive overall daily coverage.

                    if (dailyCoverageCount[coverageIndex] >= 2) {
                        // Max 2 employees (1 overlap) per hour already scheduled for this specific hour slot.
                        // Continue to next hour, unless remainingDailyTargetHours are critically low AND we still have gaps.
                        // For this implementation, we will skip if 2 or more are already covering this hour.
                        if (remainingDailyTargetHours <= 0) { // If target met, AND 2+ people here, no more for this hour.
                            continue;
                        }
                        // If target not met, but 2+ people here, we still skip this *exact* hour, assuming we need to fill *other* hours.
                        // This implies we prioritize filling gaps with 1-2 people before triple-stacking.
                        // If the rule is strictly 'max one overlap', this continues.
                        continue; 
                    }


                    // Filter employees who are available for this slot, haven't met weekly limits,
                    // and have not yet been assigned a shift for *this specific day*.
                    const trulyAvailableForNewShiftToday = availableEmployeesForDay.filter(emp => {
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false; 
                        
                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;
                        
                        const availStartHour = parseInt(dayAvail.start.split(':')[0], 10);
                        const availEndHour = parseInt(dayAvail.end.split(':')[0], 10);

                        const potentialShiftEndHourFT = currentHour + FULL_TIME_SHIFT_LENGTH_TOTAL;
                        const potentialShiftEndHourPT = currentHour + PART_TIME_SHIFT_LENGTH;

                        if (emp.employment_type === 'Full-time') {
                             return availStartHour <= currentHour && 
                                    availEndHour >= potentialShiftEndHourFT &&
                                    potentialShiftEndHourFT <= businessEndHour;
                        } else { // Part-time
                             return availStartHour <= currentHour && 
                                    availEndHour >= potentialShiftEndHourPT &&
                                    potentialShiftEndHourPT <= businessEndHour;
                        }
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); 

                    // --- Attempt to schedule a Full-time employee first ---
                    const selectedFTEmployee = trulyAvailableForNewShiftToday.find(emp => emp.employment_type === 'Full-time');

                    if (selectedFTEmployee) {
                        // Construct Date objects based on the currentDate's local components and currentHour
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + FULL_TIME_WORK_DURATION, FULL_TIME_BREAK_DURATION * 60, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [selectedFTEmployee.user_id, selectedFTEmployee.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData for persistent tracking across days
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === selectedFTEmployee.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += FULL_TIME_WORK_DURATION; 
                            employeeScheduleData[globalEmpIndex].daysWorked++; 
                        }
                        // IMPORTANT: Remove this employee from availableEmployeesForDay for the rest of the day
                        availableEmployeesForDay = availableEmployeesForDay.filter(emp => emp.user_id !== selectedFTEmployee.user_id);
                        
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

                    // --- If no FT was scheduled for this slot, try to schedule a Part-time employee ---
                    const selectedPTEmployee = trulyAvailableForNewShiftToday.find(emp => emp.employment_type === 'Part-time');

                    if (selectedPTEmployee) {
                        // We schedule PT here only if no FT was scheduled for this slot.
                        // This maintains FT prioritization for covering the initial slot needs.
                        
                        // Construct Date objects based on the currentDate's local components and currentHour
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + PART_TIME_SHIFT_LENGTH, 0, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [selectedPTEmployee.user_id, selectedPTEmployee.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated PT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === selectedPTEmployee.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += PART_TIME_SHIFT_LENGTH;
                            employeeScheduleData[globalEmpIndex].daysWorked++;
                        }
                        // IMPORTANT: Remove this employee from availableEmployeesForDay for the rest of the day
                        availableEmployeesForDay = availableEmployeesForDay.filter(emp => emp.user_id !== selectedPTEmployee.user_id);
                        
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
