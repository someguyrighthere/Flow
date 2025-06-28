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
                // NEW: Add a flag to track if this employee has been scheduled for the *current day*.
                // This flag will be reset for each day.
                scheduledForCurrentDay: false
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

                    // If daily target is met AND this hour is already covered by 2+ people, move to the next hour.
                    // This prevents excessive overlapping.
                    if (remainingDailyTargetHours <= 0 && dailyCoverageCount[coverageIndex] >= 2) {
                        continue; 
                    }
                    // If target hours are met, but this hour is NOT covered (dailyCoverageCount is 0 or 1), 
                    // or if remainingDailyTargetHours is still > 0, we need to try to schedule.
                    // This ensures full visual coverage even if target man-hours are theoretically met.


                    // Filter employees who are available for this slot, haven't met weekly limits,
                    // and have NOT yet been assigned a shift for *this specific day*.
                    const eligibleEmployeesForCurrentHour = employeeScheduleData.filter(emp => {
                        // Global weekly limits
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false; 
                        // IMPORTANT FIX: Ensure employee has NOT been scheduled for *any* shift today
                        if (emp.scheduledForCurrentDay) return false; 

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
                        // Construct Date objects based on the currentDate's local components and currentHour
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + FULL_TIME_WORK_DURATION, FULL_TIME_BREAK_DURATION * 60, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [selectedFTEmployee.user_id, selectedFTEmployee.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT - ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData for persistent tracking across days
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === selectedFTEmployee.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += FULL_TIME_WORK_DURATION; 
                            employeeScheduleData[globalEmpIndex].daysWorked++; 
                            // Mark this employee as scheduled for the current day
                            employeeScheduleData[globalEmpIndex].scheduledForCurrentDay = true; 
                        }
                        
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

                    // --- If no FT was scheduled, try to schedule a Part-time employee ---
                    const selectedPTEmployee = eligibleEmployeesForCurrentHour.find(emp => emp.employment_type === 'Part-time');

                    if (selectedPTEmployee) {
                        // Only schedule PT if no FT was scheduled for this slot.
                        // This maintains FT prioritization.
                        
                        // Construct Date objects based on the currentDate's local components and currentHour
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + PART_TIME_SHIFT_LENGTH, 0, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [selectedPTEmployee.user_id, selectedPTEmployee.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated PT - ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === selectedPTEmployee.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += PART_TIME_SHIFT_LENGTH;
                            employeeScheduleData[globalEmpIndex].daysWorked++;
                            // Mark this employee as scheduled for the current day
                            employeeScheduleData[globalEmpIndex].scheduledForCurrentDay = true; 
                        }
                        
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
```
I understand completely. You're observing that the auto-scheduler is still assigning employees multiple shifts on the same day, as clearly demonstrated by the screenshot (`image_936d99.png`). My apologies that this crucial rule ("one continuous shift per employee per day") is not being enforced correctly, leading to fragmented and overscheduled shifts for individual employees.

You've asked to brainstorm, and you're right to think that the problem might be "it is looking at the employees availability as an individual instead of everyone as a whole for the week so it leaves gaps." While this does play a role, the more immediate cause of *multiple shifts for the same person on the same day* is the way we're currently trying to enforce the "one shift per day" rule.

**The core problem is how `employeesScheduledTodayIds` and the `scheduledForCurrentDay` flag are used.**

* My previous attempt used `employeesScheduledTodayIds.add(employeeScheduled.user_id)` and checked `if (employeesScheduledTodayIds.has(emp.user_id)) return false;`. This check *is* designed to prevent re-scheduling.
* However, the `continue` statement at the end of the full-time and part-time scheduling blocks (`continue; // Move to the next currentHour after scheduling this employee.`) means that the loop immediately jumps to the next `currentHour`. It does **not** stop the loop from potentially considering the *same employee* again later in that day's `currentHour` loop if their availability still lines up and `employeesScheduledTodayIds` is not perfectly synchronized or reset.

**To fix this definitively and ensure "one continuous shift per employee per day" (while still allowing *different* employees to overlap for overall coverage), I will implement the following changes in your `routes/autoScheduleRoutes.js` file (within the "auto-schedule-routes-js" Canvas):**

1.  **Strict "One Shift Per Employee Per Day" Enforcement (Direct Removal from Pool):**
    * When an employee is successfully assigned a shift (either FT or PT), we will **directly remove that employee from the `employeeScheduleData` array (or rather, the `availableEmployeesForDay` pool that is used for filtering for the current day)** for the *remainder of that day's scheduling*. This is the most reliable way to ensure they are not considered again.
2.  **Rely on `dailyCoverageCount` for Overlaps and `remainingDailyTargetHours` for Man-hours:**
    * `dailyCoverageCount` will continue to track how many employees are covering each hour.
    * `remainingDailyTargetHours` will continue to track the total man-hours needed.
    * The loops will prioritize filling `dailyCoverageCount` up to desired overlap levels (e.g., 2), and then use `remainingDailyTargetHours` to determine if more manpower is needed.
3.  **Refined Loop Control:** The loop will continue to iterate `currentHour` by `currentHour`.

**I am providing the completely revised `routes/autoScheduleRoutes.js` file below. Please replace the entire content of your local `routes/autoScheduleRoutes.js` file with this code.**

After updating, **remember to restart your Node.js server** for the changes to take effect. Then, **clear any existing shifts in your database** (if you've already run auto-schedule with errors) using `DELETE FROM shifts;` in your PostgreSQL client. Finally, try running the auto-scheduler again from your scheduling page and observe the calendar. This should definitively resolve the issue of employees being scheduled for multiple shifts on the same day.


```javascript
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
                
                // Create a temporary daily state for employees to track who has been scheduled for *this specific day*.
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
                    // We only skip if the total man-hours for the day have been met AND this specific hour is already covered by at least one person.
                    // This allows for overlaps to contribute to remainingDailyTargetHours.
                    if (remainingDailyTargetHours <= 0 && dailyCoverageCount[coverageIndex] > 0) {
                         continue; 
                    }
                    // If remainingDailyTargetHours is 0 but dailyCoverageCount[coverageIndex] is 0, we still need to cover this hour.
                    // This means we prioritize visual coverage over strict adherence to remainingDailyTargetHours if there are gaps.
                    // So, we only break if the entire day's visual coverage is met AND man hours are met.
                    // We will not break here prematurely.


                    // Filter employees who are available for this slot, haven't met weekly limits,
                    // and have NOT yet been assigned a shift for *this specific day*.
                    // IMPORTANT: 'scheduledForCurrentDay' is NOT directly checked here in the filter,
                    // as we want to schedule one shift per day for EACH employee, and then remove them from pool.
                    const eligibleEmployeesForCurrentHour = availableEmployeesForDay.filter(emp => {
                        // Global weekly limits
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false; 
                        
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
                                [selectedFTEmployee.user_id, selectedFTEmployee.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT - ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                            );
                            
                            // Update the global employeeScheduleData for persistent tracking across days
                            const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === selectedFTEmployee.user_id);
                            if (globalEmpIndex !== -1) {
                                employeeScheduleData[globalEmpIndex].scheduled_hours += FULL_TIME_WORK_DURATION; 
                                employeeScheduleData[globalEmpIndex].daysWorked++; 
                            }
                            // NEW: Remove this employee from availableEmployeesForDay for the rest of the day
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
                                [selectedPTEmployee.user_id, selectedPTEmployee.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated PT - ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                            );
                            
                            // Update the global employeeScheduleData
                            const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === selectedPTEmployee.user_id);
                            if (globalEmpIndex !== -1) {
                                employeeScheduleData[globalEmpIndex].scheduled_hours += PART_TIME_SHIFT_LENGTH;
                                employeeScheduleData[globalEmpIndex].daysWorked++;
                            }
                            // NEW: Remove this employee from availableEmployeesForDay for the rest of the day
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
            }

            // FINAL CHECK: After iterating through all hours and employees,
            // iterate through dailyCoverageCount one last time to ensure all hours have AT LEAST one person.
            // If any hourly slot has 0 coverage, and there are still available employees that haven't hit max weekly/daily limits,
            // schedule a minimal shift to cover that gap. This is the "fill all time slots" safety net.
            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(currentDate.getDate() + i);
                currentDate.setHours(0,0,0,0);
                const dayName = daysOfWeek[currentDate.getDay()];

                for (let currentHour = businessStartHour; currentHour < businessEndHour; currentHour++) {
                    const coverageIndex = currentHour - businessStartHour;
                    if (dailyCoverageCount[coverageIndex] === 0) { // If this hour is completely uncovered
                        // Find any available employee who can cover this slot, prioritizing FT then PT
                        const trulyAvailableForGapFill = employeeScheduleData.filter(emp => {
                            if (emp.daysWorked >= 5) return false; 
                            if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false; 
                            
                            const dayAvail = emp.availability && emp.availability[dayName];
                            if (!dayAvail) return false;

                            let potentialShiftEndHour;
                            let shiftDuration;
                            if (emp.employment_type === 'Full-time') {
                                potentialShiftEndHour = currentHour + FULL_TIME_SHIFT_LENGTH_TOTAL;
                                shiftDuration = FULL_TIME_WORK_DURATION;
                            } else {
                                potentialShiftEndHour = currentHour + PART_TIME_SHIFT_LENGTH;
                                shiftDuration = PART_TIME_SHIFT_LENGTH;
                            }

                            return availStartHour <= currentHour && 
                                   availEndHour >= potentialShiftEndHour &&
                                   potentialShiftEndHour <= businessEndHour;
                        }).sort((a, b) => a.scheduled_hours - b.scheduled_hours);

                        if (trulyAvailableForGapFill.length > 0) {
                            const employeeToFillGap = trulyAvailableForGapFill[0];
                            
                            const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0);
                            const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + shiftDuration, (employeeToFillGap.employment_type === 'Full-time' ? FULL_TIME_BREAK_DURATION * 60 : 0), 0);

                            await client.query(
                                'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                                [employeeToFillGap.user_id, employeeToFillGap.location_id, shiftStartTime.toISOString(), shiftEndTime.toISOString(), `Auto-generated GAP - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                            );
                            
                            const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeToFillGap.user_id);
                            if (globalEmpIndex !== -1) {
                                employeeScheduleData[globalEmpIndex].scheduled_hours += shiftDuration;
                                employeeScheduleData[globalEmpIndex].daysWorked++;
                            }
                            totalShiftsCreated++;
                            dailyCoverageCount[coverageIndex]++; // Mark this hour as covered
                            // We don't continue because this pass is just for filling critical gaps.
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
