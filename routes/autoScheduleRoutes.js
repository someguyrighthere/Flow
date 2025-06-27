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
            
            // Parse business hours into total minutes from midnight (conceptually local)
            const businessStartHour = parseInt(settings.operating_hours_start.split(':')[0], 10);
            const businessStartMinute = parseInt(settings.operating_hours_start.split(':')[1], 10);
            const businessEndHour = parseInt(settings.operating_hours_end.split(':')[0], 10);
            const businessEndMinute = parseInt(settings.operating_hours_end.split(':')[1], 10);

            const businessStartTotalMinutes = businessStartHour * 60 + businessStartMinute;
            const businessEndTotalMinutes = businessEndHour * 60 + businessEndMinute;
            
            // --- DEBUG LOGS (AUTO-SCHEDULE: BUSINESS HOURS) ---
            console.log(`[AUTO-SCHEDULE-DEBUG] Business Hours (from DB): Raw Start=${settings.operating_hours_start}, Raw End=${settings.operating_hours_end}`);
            console.log(`[AUTO-SCHEDULE-DEBUG] Business Hours (Parsed Minutes): Start=${businessStartTotalMinutes}, End=${businessEndTotalMinutes}`);
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
                // currentDayDate represents the specific date being processed.
                // We'll create it as a simple Date object without timezone concerns, just YYYY-MM-DD.
                const currentDayDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + i); 
                currentDayDate.setHours(0,0,0,0); // Explicitly set to midnight, local time, to represent the start of the day.

                const dayName = daysOfWeek[currentDayDate.getDay()]; 
                let remainingDailyTargetHours = parseFloat(dailyHours[dayName] || 0); 
                let remainingDailyTargetMinutes = remainingDailyTargetHours * 60; // Convert target hours to minutes
                
                // Track employees already assigned a shift for *this specific day*
                const employeesScheduledTodayIds = new Set(); 

                // Create a coverage array for the current day, representing each 15-minute slot within business hours.
                const totalBusinessMinutesDuration = businessEndTotalMinutes - businessStartTotalMinutes;
                const dailyCoverageSlots = Array(Math.ceil(totalBusinessMinutesDuration / SCHEDULING_INTERVAL_MINUTES)).fill(false); 

                // Mark existing shifts (from manual entries or prior auto-runs in the transaction) as covered.
                // When comparing in PostgreSQL, we need to extract the date part of the TIMESTAMPTZ in a fixed timezone.
                // We'll assume the client/server operates in a consistent timezone.
                const existingShiftsRes = await client.query(`
                    SELECT start_time, end_time FROM shifts
                    WHERE TO_CHAR(start_time, 'YYYY-MM-DD') = TO_CHAR($1::timestamp, 'YYYY-MM-DD');
                `, [currentDayDate.toISOString()]); // Pass ISO string for the specific local date

                existingShiftsRes.rows.forEach(shift => {
                    // When reading from TIMESTAMPTZ, `new Date(isoString)` will convert it to the Node.js server's local time.
                    // We need to use its local hours/minutes for consistency with the scheduling logic.
                    const shiftStartLocal = new Date(shift.start_time); 
                    const shiftEndLocal = new Date(shift.end_time);     
                    
                    const shiftStartTotalMinutes = shiftStartLocal.getHours() * 60 + shiftStartLocal.getMinutes(); 
                    const shiftEndTotalMinutes = shiftEndLocal.getHours() * 60 + shiftEndLocal.getMinutes(); 
                    
                    for (let m = shiftStartTotalMinutes; m < shiftEndTotalMinutes; m += SCHEDULING_INTERVAL_MINUTES) {
                        const coverageIndex = Math.floor((m - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES);
                        if (coverageIndex >= 0 && coverageIndex < dailyCoverageSlots.length) {
                            dailyCoverageSlots[coverageIndex] = true;
                        }
                    }
                });

                // --- DEBUG LOGS (AUTO-SCHEDULE: DAILY STATUS) ---
                console.log(`\n--- [AUTO-SCHEDULE-DEBUG] Processing Day: ${dayName} (Local Date: ${currentDayDate.toLocaleDateString()}) ---`);
                console.log(`[AUTO-SCHEDULE-DEBUG] Initial Remaining Daily Target Minutes: ${remainingDailyTargetMinutes}`);
                console.log(`[AUTO-SCHEDULE-DEBUG] Daily Coverage Slots (false = uncovered, true = covered):`);
                console.log(dailyCoverageSlots); 
                // --- END DEBUG LOGS ---


                // Iterate through 15-minute intervals within business hours
                for (let currentMinute = businessStartTotalMinutes; currentMinute < businessEndTotalMinutes; currentMinute += SCHEDULING_INTERVAL_MINUTES) {
                    const coverageIndex = Math.floor((currentMinute - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES); 

                    // If current slot is already covered, skip it
                    if (dailyCoverageSlots[coverageIndex]) {
                        console.log(`[AUTO-SCHEDULE-DEBUG] Skipping Minute ${currentMinute}: Already covered.`);
                        continue;
                    }
                    
                    // If daily target is met, stop scheduling for this day at this point
                    if (remainingDailyTargetMinutes <= 0) {
                         console.log(`[AUTO-SCHEDULE-DEBUG] Minute ${currentMinute}: Daily target met. Breaking loop for ${dayName}.`);
                         break;
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
                        
                        // Parse availability start/end into total minutes
                        const availStartTotalMinutes = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                        const availEndTotalMinutes = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);

                        const requiredShiftEndTotalMinutes = currentMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES;

                        const isEligible = availStartTotalMinutes <= currentMinute && 
                                           availEndTotalMinutes >= requiredShiftEndTotalMinutes &&
                                           requiredShiftEndTotalMinutes <= businessEndTotalMinutes; 

                        console.log(`[AUTO-SCHEDULE-DEBUG] FT Check for Emp ${emp.full_name} (${emp.user_id}, Type: ${emp.employment_type}) at Local Minute ${currentMinute}:`);
                        console.log(`  Avail: ${dayAvail.start}-${dayAvail.end} (${availStartTotalMinutes}-${availEndTotalMinutes})`);
                        console.log(`  Required Shift End Minute: ${requiredShiftEndTotalMinutes}`);
                        console.log(`  Business End Minute: ${businessEndTotalMinutes}`);
                        console.log(`  Is Eligible: ${isEligible}`);

                        return isEligible;
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Prioritize FTs with fewer hours scheduled

                    if (eligibleFTEmployees.length > 0) {
                        const employeeScheduled = eligibleFTEmployees[0]; 
                        
                        // FIX: Construct Date objects as if their components ARE UTC.
                        // This makes 9 AM local become 9 AM UTC in the database, simplifying display.
                        const shiftStartTimeUTC = new Date(Date.UTC(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), Math.floor(currentMinute / 60), currentMinute % 60, 0)); 
                        const shiftEndTimeUTC = new Date(Date.UTC(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), Math.floor((currentMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES) / 60), (currentMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES) % 60, 0)); 
                        
                        const shiftStartTimeISO = shiftStartTimeUTC.toISOString(); 
                        const shiftEndTimeISO = shiftEndTimeUTC.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduled.user_id, employeeScheduled.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated FT for ${employeeScheduled.full_name}.`]
                        );
                        
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduled.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += (FULL_TIME_WORK_DURATION_MINUTES / 60); // Store hours
                            employeeScheduleData[globalEmpIndex].daysWorked++; 
                        }
                        employeesScheduledTodayIds.add(employeeScheduled.user_id); 
                        remainingDailyTargetMinutes -= FULL_TIME_WORK_DURATION_MINUTES; 
                        totalShiftsCreated++;
                        
                        // Mark covered 15-min slots
                        for (let m = currentMinute; m < currentMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES; m += SCHEDULING_INTERVAL_MINUTES) { 
                            const idx = Math.floor((m - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES);
                            if (idx >= 0 && idx < dailyCoverageSlots.length) dailyCoverageSlots[idx] = true;
                        }
                        console.log(`[AUTO-SCHEDULE-DEBUG] FT Shift Created for ${employeeScheduled.full_name} (${employeeScheduled.user_id}) on ${dayName}. Stored ISO: ${shiftStartTimeISO} - ${shiftEndTimeISO}. Remaining Daily Target: ${remainingDailyTargetMinutes}`);
                        continue; 
                    }

                    // --- If no FT was scheduled, try to schedule a Part-time employee ---
                    const eligiblePTEmployees = employeeScheduleData.filter(emp => {
                        if (emp.employment_type !== 'Part-time') return false; 
                        if (emp.daysWorked >= 5) return false; 
                        if (employeesScheduledTodayIds.has(emp.user_id)) return false; 

                        const dayAvail = emp.availability && emp.availability[dayName];
                        if (!dayAvail) return false;

                        // Parse availability start/end into total minutes
                        const availStartTotalMinutes = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                        const availEndTotalMinutes = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);

                        const requiredShiftEndTotalMinutes = currentMinute + PART_TIME_SHIFT_LENGTH_MINUTES; 
                        
                        const isEligible = availStartTotalMinutes <= currentMinute && 
                                           availEndTotalMinutes >= requiredShiftEndTotalMinutes &&
                                           requiredShiftEndTotalMinutes <= businessEndTotalMinutes;

                        console.log(`[AUTO-SCHEDULE-DEBUG] PT Check for Emp ${emp.full_name} (${emp.user_id}, Type: ${emp.employment_type}) at Local Minute ${currentMinute}:`);
                        console.log(`  Avail: ${dayAvail.start}-${dayAvail.end} (${availStartTotalMinutes}-${availEndTotalMinutes})`);
                        console.log(`  Required Shift End Minute: ${requiredShiftEndTotalMinutes}`);
                        console.log(`  Business End Minute: ${businessEndTotalMinutes}`);
                        console.log(`  Is Eligible: ${isEligible}`);

                        return isEligible;
                    }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); 

                    if (eligiblePTEmployees.length > 0) {
                        const employeeScheduled = eligiblePTEmployees[0]; 
                        
                        // FIX: Construct Date objects as if their components ARE UTC.
                        const shiftStartTimeUTC = new Date(Date.UTC(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), Math.floor(currentMinute / 60), currentMinute % 60, 0)); 
                        const shiftEndTimeUTC = new Date(Date.UTC(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), Math.floor((currentMinute + PART_TIME_SHIFT_LENGTH_MINUTES) / 60), (currentMinute + PART_TIME_SHIFT_LENGTH_MINUTES) % 60, 0)); 
                        
                        const shiftStartTimeISO = shiftStartTimeUTC.toISOString();
                        const shiftEndTimeISO = shiftEndTimeUTC.toISOString();

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduled.user_id, employeeScheduled.location_id, shiftStartTimeISO, shiftEndTimeISO, `Auto-generated PT for ${employeeScheduled.full_name}.`]
                        );
                        
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduled.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += (PART_TIME_SHIFT_LENGTH_MINUTES / 60);
                            employeeScheduleData[globalEmpIndex].daysWorked++;
                        }
                        employeesScheduledTodayIds.add(employeeScheduled.user_id); 
                        remainingDailyTargetMinutes -= PART_TIME_SHIFT_LENGTH_MINUTES;
                        totalShiftsCreated++;
                        
                        // Mark covered 15-min slots
                        for (let m = currentMinute; m < currentMinute + PART_TIME_SHIFT_LENGTH_MINUTES; m += SCHEDULING_INTERVAL_MINUTES) {
                            const idx = Math.floor((m - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES);
                            if (idx >= 0 && idx < dailyCoverageSlots.length) dailyCoverageSlots[idx] = true;
                        }
                        console.log(`[AUTO-SCHEDULE-DEBUG] PT Shift Created for ${employeeScheduled.full_name} (${employeeScheduled.user_id}) on ${dayName}. Stored ISO: ${shiftStartTimeISO} - ${shiftEndTimeISO}. Remaining Daily Target: ${remainingDailyTargetMinutes}`);
                        continue; 
                    }
                    console.log(`[AUTO-SCHEDULE-DEBUG] Minute ${currentMinute}: No eligible FT/PT employee found.`);
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
