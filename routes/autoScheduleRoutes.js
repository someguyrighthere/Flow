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
                
                // Create a coverage array for the current day, representing each hour within business hours.
                // This tracks if an hour is covered by *any* shift.
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

                    // If the current hour is already covered AND the daily target has been met, skip this hour.
                    // This prevents *unnecessary* extra overlaps beyond the target total hours.
                    if (dailyCoverage[coverageIndex] && remainingDailyTargetHours <= 0) {
                        continue; 
                    }
                    
                    // Filter employees who are available and haven't met their weekly limits.
                    // IMPORTANT: We do NOT filter by 'scheduledForCurrentDay' here to ALLOW multiple employees
                    // to be scheduled for the same day (overlapping) if needed to meet daily target hours.
                    const eligibleEmployeesForCurrentHour = employeeScheduleData.filter(emp => {
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false; 
                        
                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;
                        
                        const availStartHour = parseInt(dayAvail.start.split(':')[0], 10);
                        const availEndHour = parseInt(dayAvail.end.split(':')[0], 10);

                        // Ensure availability starts at or before currentHour
                        if (availStartHour > currentHour) return false;

                        // Calculate shift end based on employee type for checking availability
                        const potentialShiftEndHour = currentHour + (emp.employment_type === 'Full-time' ? FULL_TIME_SHIFT_LENGTH_TOTAL : PART_TIME_SHIFT_LENGTH);

                        // Ensure employee is available until potentialShiftEndHour and within business bounds
                        return availEndHour >= potentialShiftEndHour && potentialShiftEndHour <= businessEndHour;

                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize those with fewer hours this week

                    // --- Attempt to schedule a Full-time employee first ---
                    let employeeScheduledInCurrentSlot = null;
                    const selectedFTEmployee = eligibleEmployeesForCurrentHour.find(emp => emp.employment_type === 'Full-time');

                    if (selectedFTEmployee) {
                        employeeScheduledInCurrentSlot = selectedFTEmployee; 
                        
                        // Construct Date objects based on the currentDate's local components and currentHour
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + FULL_TIME_WORK_DURATION, FULL_TIME_BREAK_DURATION * 60, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduledInCurrentSlot.user_id, employeeScheduledInCurrentSlot.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData for persistent tracking across days
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduledInCurrentSlot.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += FULL_TIME_WORK_DURATION; 
                            // Only increment daysWorked IF this is the first shift for them today
                            // We need to track this differently or ensure it's not double-counted if multiple overlaps occur.
                            // For simplicity, for now, we'll assume one day increment per shift assigned.
                            // If "2 days off" means "no shifts on 2 days", this logic is fine.
                            // If it means max 5 days worked, it's covered by `daysWorked >= 5`.
                            employeeScheduleData[globalEmpIndex].daysWorked++; 
                        }
                        
                        remainingDailyTargetHours -= FULL_TIME_WORK_DURATION; 
                        totalShiftsCreated++;
                        
                        // Mark covered hours
                        for (let h = currentHour; h < currentHour + FULL_TIME_WORK_DURATION; h++) { 
                            const idx = h - businessStartHour;
                            if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                        }
                        // Continue processing the same currentHour if there are still needs or other employees.
                        // Do NOT use continue here; let the loop finish for currentHour to try PTs.
                    }

                    // --- If no FT was scheduled OR still need more hours, try to schedule a Part-time employee ---
                    const selectedPTEmployee = eligibleEmployeesForCurrentHour.find(emp => emp.employment_type === 'Part-time');

                    if (selectedPTEmployee) {
                        // Only schedule PT if no FT was scheduled OR if FT was scheduled but daily target still needs more
                        // This prevents PTs from getting scheduled if FTs are available and sufficient.
                        if (!selectedFTEmployee || remainingDailyTargetHours > 0) { // Schedule PT if no FT, or if FT scheduled but still need more hours
                            employeeScheduledInCurrentSlot = selectedPTEmployee; 
                            
                            const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                            const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + PART_TIME_SHIFT_LENGTH, 0, 0); 
                            
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
                            
                            remainingDailyTargetHours -= PART_TIME_SHIFT_LENGTH;
                            totalShiftsCreated++;
                            
                            // Mark covered hours
                            for (let h = currentHour; h < currentHour + PART_TIME_SHIFT_LENGTH; h++) {
                                const idx = h - businessStartHour;
                                if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                            }
                        }
                    }
                    // The loop naturally advances currentHour += 1;
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
                
                // Track which specific hours within the business day are covered.
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

                    // If the current hour is already covered AND the daily target has been met, skip this hour.
                    // This prevents *unnecessary* extra overlaps beyond the target total hours.
                    if (dailyCoverage[coverageIndex] && remainingDailyTargetHours <= 0) {
                        continue; 
                    }
                    // If target hours are met, but this hour is NOT covered, this is a scenario where
                    // we need to schedule just to get visual coverage if the target was soft.
                    // For now, if remainingDailyTargetHours <= 0 and !dailyCoverage[coverageIndex], we will proceed to schedule
                    // to ensure visual coverage is met, as per "all the business open hours need to have coverage."


                    // Filter employees who are available and haven't met their weekly limits.
                    // IMPORTANT: We do NOT filter by 'scheduledForCurrentDay' here.
                    // This allows multiple employees to be scheduled for the same day (overlapping) if needed to meet daily target hours.
                    const eligibleEmployeesForCurrentHour = employeeScheduleData.filter(emp => {
                        if (emp.daysWorked >= 5) return false; 
                        if (emp.employment_type === 'Full-time' && emp.scheduled_hours >= 40) return false; 
                        
                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;
                        
                        const availStartHour = parseInt(dayAvail.start.split(':')[0], 10);
                        const availEndHour = parseInt(dayAvail.end.split(':')[0], 10);

                        // Ensure potential shift START and END are strictly within business hours and employee availability
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
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize those with fewer hours this week

                    // --- Attempt to schedule a Full-time employee first ---
                    let employeeScheduledThisSlot = null; // Track if any employee was scheduled in this currentHour slot
                    const selectedFTEmployee = eligibleEmployeesForCurrentHour.find(emp => emp.employment_type === 'Full-time');

                    if (selectedFTEmployee) {
                        employeeScheduledThisSlot = selectedFTEmployee; 
                        
                        // Construct Date objects based on the currentDate's local components and currentHour
                        const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                        const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + FULL_TIME_WORK_DURATION, FULL_TIME_BREAK_DURATION * 60, 0); 
                        
                        const shiftStartTimeISO = shiftStartTime.toISOString();
                        const shiftEndTimeISO = shiftEndTime.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduledThisSlot.user_id, employeeScheduledThisSlot.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                        );
                        
                        // Update the global employeeScheduleData for persistent tracking across days
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduledThisSlot.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += FULL_TIME_WORK_DURATION; 
                            // daysWorked should only increment once per actual *day worked*, not per shift if overlapping.
                            // This part of the logic needs care if the rule is strict '5 days max'.
                            // For now, let's assume one increment per shift for simple demonstration of overlapping.
                            // A more advanced solution would track shifts per day by employee.
                            employeeScheduleData[globalEmpIndex].daysWorked++; 
                        }
                        
                        remainingDailyTargetHours -= FULL_TIME_WORK_DURATION; 
                        totalShiftsCreated++;
                        
                        // Mark covered hours by this shift
                        for (let h = currentHour; h < currentHour + FULL_TIME_WORK_DURATION; h++) { 
                            const idx = h - businessStartHour;
                            if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                        }
                        // Do NOT use continue here; allow PTs or other FTs to be scheduled starting at the same currentHour if needed.
                    }

                    // --- If no FT was scheduled OR still need more hours, try to schedule a Part-time employee ---
                    const selectedPTEmployee = eligibleEmployeesForCurrentHour.find(emp => emp.employment_type === 'Part-time');

                    if (selectedPTEmployee) {
                        // Only schedule PT if no FT was scheduled OR if FT was scheduled but daily target still needs more
                        // This prioritizes FT, but allows PT to fill gaps or contribute to target hours.
                        if (!selectedFTEmployee || remainingDailyTargetHours > 0 || !dailyCoverage[coverageIndex]) {
                            employeeScheduledThisSlot = selectedPTEmployee; 
                            
                            const shiftStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, 0, 0); 
                            const shiftEndTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour + PART_TIME_SHIFT_LENGTH, 0, 0); 
                            
                            const shiftStartTimeISO = shiftStartTime.toISOString();
                            const shiftEndTimeISO = shiftEndTime.toISOString();

                            await client.query(
                                'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                                [employeeScheduledThisSlot.user_id, employeeScheduledThisSlot.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated PT - Covers ${shiftStartTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})} to ${shiftEndTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}`]
                            );
                            
                            // Update the global employeeScheduleData
                            const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduledInCurrentSlot.user_id);
                            if (globalEmpIndex !== -1) {
                                employeeScheduleData[globalEmpIndex].scheduled_hours += PART_TIME_SHIFT_LENGTH;
                                employeeScheduleData[globalEmpIndex].daysWorked++;
                            }
                            
                            remainingDailyTargetHours -= PART_TIME_SHIFT_LENGTH;
                            totalShiftsCreated++;
                            
                            // Mark covered hours
                            for (let h = currentHour; h < currentHour + PART_TIME_SHIFT_LENGTH; h++) {
                                const idx = h - businessStartHour;
                                if (idx >= 0 && idx < dailyCoverage.length) dailyCoverage[idx] = true;
                            }
                        }
                    }
                    // The loop naturally advances currentHour += 1;
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
