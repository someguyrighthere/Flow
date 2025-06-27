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
            await client.query('DELETE FROM shifts WHERE start_time::date >= $1::date AND start_time::date < $2::date', [currentWeekStart.toISOString().split('T')[0], nextWeekStart.toISOString().split('T')[0]]);


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
            
            // --- ULTIMATE DEBUG LOGS (AUTO-SCHEDULE: BUSINESS HOURS) ---
            console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] Business Hours (from DB): Raw Start=${settings.operating_hours_start}, Raw End=${settings.operating_hours_end}`);
            console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] Business Hours (Parsed Minutes): Start=${businessStartTotalMinutes}, End=${businessEndTotalMinutes}`);
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
            const PART_TIME_WORK_DURATION_MINUTES = 4 * 60; // 4 hours
            const PART_TIME_SHIFT_LENGTH_MINUTES = PART_TIME_WORK_DURATION_MINUTES; // Part-time doesn't have a specific break added

            // Define the smallest scheduling interval (e.g., 15 minutes)
            const SCHEDULING_INTERVAL_MINUTES = 15;

            // Rule: Part-time max hours
            const PART_TIME_MAX_HOURS_PER_WEEK = 20;


            // Iterate through each day of the week (Sunday to Saturday)
            for (let i = 0; i < 7; i++) {
                const currentDayDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + i); 
                currentDayDate.setHours(0,0,0,0); // Explicitly set to local midnight for consistency.

                const dayName = daysOfWeek[currentDayDate.getDay()]; 
                let remainingDailyTargetHours = parseFloat(dailyHours[dayName] || 0); 
                let remainingDailyTargetMinutes = remainingDailyTargetHours * 60; // Convert target hours to minutes
                
                // Track employees already assigned a shift for *this specific day*
                const employeesScheduledTodayIds = new Set(); 

                // Daily coverage slots: Now counts required coverage (for overlapping coverage rule).
                const totalBusinessMinutesDuration = businessEndTotalMinutes - businessStartTotalMinutes;
                const dailyCoverageSlots = Array(Math.ceil(totalBusinessMinutesDuration / SCHEDULING_INTERVAL_MINUTES)).fill(0); 

                // Mark existing shifts (from manual entries or prior auto-runs in the transaction) as covered.
                const existingShiftsRes = await client.query(`
                    SELECT start_time::text as start_time, end_time::text as end_time FROM shifts
                    WHERE start_time::date = $1::date;
                `, [currentDayDate.toISOString().split('T')[0]]); 

                existingShiftsRes.rows.forEach(shift => {
                    const shiftTimeRegex = /(\d{2}):(\d{2}):(\d{2})$/;
                    const shiftStartMatch = shift.start_time.match(shiftTimeRegex);
                    const shiftEndMatch = shift.end_time.match(shiftTimeRegex);

                    if (!shiftStartMatch || !shiftEndMatch) {
                        console.error(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] ERROR: Could not parse existing shift time: Start=${shift.start_time}, End=${shift.end_time}`);
                        return; 
                    }
                    
                    const shiftStartTotalMinutes = parseInt(shiftStartMatch[1], 10) * 60 + parseInt(shiftStartMatch[2], 10); 
                    const shiftEndTotalMinutes = parseInt(shiftEndMatch[1], 10) * 60 + parseInt(shiftEndMatch[2], 10);     
                    
                    for (let m = shiftStartTotalMinutes; m < shiftEndTotalMinutes; m += SCHEDULING_INTERVAL_MINUTES) {
                        const coverageIndex = Math.floor((m - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES);
                        if (coverageIndex >= 0 && coverageIndex < dailyCoverageSlots.length) {
                            dailyCoverageSlots[coverageIndex]++; // Increment count
                        }
                    }
                });

                // --- ULTIMATE DEBUG LOGS (AUTO-SCHEDULE: DAILY STATUS) ---
                console.log(`\n--- [AUTO-SCHEDULE-ULTIMATE-DEBUG] Processing Day: ${dayName} (Local Date: ${currentDayDate.toLocaleDateString()}) ---`);
                console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] Initial Remaining Daily Target Minutes: ${remainingDailyTargetMinutes}`);
                console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] Daily Coverage Slots (count of shifts per 15-min interval):`);
                console.log(dailyCoverageSlots); 
                // --- END DEBUG LOGS ---


                // Iterate through 15-minute intervals within business hours
                // The loop now goes through all defined business minutes to ensure full coverage.
                for (let currentMinute = businessStartTotalMinutes; currentMinute < businessEndTotalMinutes; currentMinute += SCHEDULING_INTERVAL_MINUTES) {
                    const coverageIndex = Math.floor((currentMinute - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES); 

                    // Define employee to schedule for this slot
                    let employeeScheduled = null; // Reset for each minute slot

                    // PRIORITY 1: Fill UNCOVERED slots with FT first, then PT.
                    if (dailyCoverageSlots[coverageIndex] === 0) {
                        console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] Slot ${currentMinute}: UNCOVERED. Prioritizing primary coverage.`);

                        // Try to find an eligible FT employee for primary coverage
                        const eligibleFTEmployeesForCoverage = employeeScheduleData.filter(emp => {
                            // Hard constraints:
                            if (emp.daysWorked >= 5) return false; 
                            if (employeesScheduledTodayIds.has(emp.user_id)) return false; 
                            const dayAvail = emp.availability && emp.availability[dayName];
                            if (!dayAvail) return false;
                            
                            const availStartTotalMinutes = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                            const availEndTotalMinutes = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);

                            const requiredShiftEndTotalMinutes = currentMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES;

                            const isEligible = availStartTotalMinutes <= currentMinute && 
                                               availEndTotalMinutes >= requiredShiftEndTotalMinutes &&
                                               currentMinute >= businessStartTotalMinutes && 
                                               requiredShiftEndTotalMinutes <= businessEndTotalMinutes; 
                            return isEligible;
                        }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); // Least scheduled FT first

                        if (eligibleFTEmployeesForCoverage.length > 0) {
                            employeeScheduled = eligibleFTEmployeesForCoverage[0];
                            console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG]   FT Employee ${employeeScheduled.full_name} selected for PRIMARY coverage of UNCOVERED slot.`);
                        } else {
                            // If no FT found for primary coverage, try PT employee for primary coverage
                            const eligiblePTEmployeesForCoverage = employeeScheduleData.filter(emp => {
                                // Hard constraints:
                                if (emp.employment_type !== 'Part-time') return false; 
                                if (emp.daysWorked >= 5) return false; 
                                if (employeesScheduledTodayIds.has(emp.user_id)) return false; 
                                const dayAvail = emp.availability && emp.availability[dayName];
                                if (!dayAvail) return false;
                                const availStartTotalMinutes = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                                const availEndTotalMinutes = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);
                                const requiredShiftEndTotalMinutes = currentMinute + PART_TIME_SHIFT_LENGTH_MINUTES; 
                                const isEligible = availStartTotalMinutes <= currentMinute && 
                                                   availEndTotalMinutes >= requiredShiftEndTotalMinutes &&
                                                   currentMinute >= businessStartTotalMinutes && 
                                                   requiredShiftEndTotalMinutes <= businessEndTotalMinutes;
                                return isEligible;
                            }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); 

                            if (eligiblePTEmployeesForCoverage.length > 0) {
                                employeeScheduled = eligiblePTEmployeesForCoverage[0]; 
                                console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG]   PT Employee ${employeeScheduled.full_name} selected for PRIMARY coverage of UNCOVERED slot.`);
                            }
                        }

                        if (!employeeScheduled) {
                            console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] Minute ${currentMinute}: UNCOVERED, but NO ELIGIBLE employee found to cover this slot.`);
                        }
                    } 
                    // PRIORITY 2: If slot is already covered AND we still need man-hours, try to add OVERLAP.
                    else if (dailyCoverageSlots[coverageIndex] > 0 && remainingDailyTargetMinutes > 0) {
                        console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] Slot ${currentMinute}: Covered, but remaining daily target (${remainingDailyTargetMinutes}) > 0. Attempting to add OVERLAP.`);

                        // Try to find a Full-time employee for overlap
                        const eligibleFTEmployeesForOverlap = employeeScheduleData.filter(emp => {
                            // Hard constraints:
                            if (emp.daysWorked >= 5) return false; 
                            if (employeesScheduledTodayIds.has(emp.user_id)) return false; 
                            const dayAvail = emp.availability && emp.availability[dayName];
                            if (!dayAvail) return false;
                            const availStartTotalMinutes = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                            const availEndTotalMinutes = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);
                            const requiredShiftEndTotalMinutes = currentMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES;
                            const isEligible = availStartTotalMinutes <= currentMinute && 
                                               availEndTotalMinutes >= requiredShiftEndTotalMinutes &&
                                               currentMinute >= businessStartTotalMinutes && 
                                               requiredShiftEndTotalMinutes <= businessEndTotalMinutes; 
                            
                            // SOFT CONSTRAINT for overlap: Only add if they are not already at their weekly max.
                            if (emp.scheduled_hours >= 40) {
                                console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG]   FT Overlap Check for ${emp.full_name} (${emp.user_id}): Exceeds 40 hours. Skipping for overlap.`);
                                return false; 
                            }
                            return isEligible;
                        }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); 

                        if (eligibleFTEmployeesForOverlap.length > 0) {
                            employeeScheduled = eligibleFTEmployeesForOverlap[0];
                            console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG]   FT Employee ${employeeScheduled.full_name} selected for OVERLAP.`);
                        } else {
                            // If no FT, try to find a Part-time employee for overlap
                            const eligiblePTEmployeesForOverlap = employeeScheduleData.filter(emp => {
                                // Hard constraints:
                                if (emp.employment_type !== 'Part-time') return false; 
                                if (emp.daysWorked >= 5) return false; 
                                if (employeesScheduledTodayIds.has(emp.user_id)) return false; 
                                const dayAvail = emp.availability && emp.availability[dayName];
                                if (!dayAvail) return false;
                                const availStartTotalMinutes = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                                const availEndTotalMinutes = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);
                                const requiredShiftEndTotalMinutes = currentMinute + PART_TIME_SHIFT_LENGTH_MINUTES; 
                                const isEligible = availStartTotalMinutes <= currentMinute && 
                                                   availEndTotalMinutes >= requiredShiftEndTotalMinutes &&
                                                   currentMinute >= businessStartTotalMinutes && 
                                                   requiredShiftEndTotalMinutes <= businessEndTotalMinutes;
                                
                                // SOFT CONSTRAINT for overlap: Only add if they are not already at their weekly max.
                                if (emp.scheduled_hours >= PART_TIME_MAX_HOURS_PER_WEEK) {
                                    console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG]   PT Overlap Check for ${emp.full_name} (${emp.user_id}): Exceeds ${PART_TIME_MAX_HOURS_PER_WEEK} hours. Skipping for overlap.`);
                                    return false; 
                                }
                                return isEligible;
                            }).sort((a, b) => a.scheduled_hours - b.scheduled_hours); 

                            if (eligiblePTEmployeesForOverlap.length > 0) {
                                employeeScheduled = eligiblePTEmployeesForOverlap[0]; 
                                console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG]   PT Employee ${employeeScheduled.full_name} selected for OVERLAP.`);
                            }
                        }

                        if (!employeeScheduled) {
                            console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] Minute ${currentMinute}: Need OVERLAP, but NO ELIGIBLE employee found.`);
                        }
                    } else {
                        // Slot is covered and remainingDailyTargetMinutes <= 0, so no need to schedule.
                        console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] Minute ${currentMinute}: Covered and daily target met. Skipping scheduling for this slot.`);
                    }


                    if (employeeScheduled) {
                        // Schedule the chosen employee
                        const shiftDurationForUpdate = (employeeScheduled.employment_type === 'Full-time') ? FULL_TIME_WORK_DURATION_MINUTES : PART_TIME_WORK_DURATION_MINUTES;
                        const shiftLengthForCoverage = (employeeScheduled.employment_type === 'Full-time') ? FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES : PART_TIME_SHIFT_LENGTH_MINUTES;
                        
                        const shiftStartDateTime = new Date(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), Math.floor(currentMinute / 60), currentMinute % 60, 0); 
                        const shiftEndDateTime = new Date(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), Math.floor((currentMinute + shiftLengthForCoverage) / 60), (currentMinute + shiftLengthForCoverage) % 60, 0); 
                        
                        const formatDateTime = (dateObj) => {
                            const year = dateObj.getFullYear();
                            const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                            const day = dateObj.getDate().toString().padStart(2, '0');
                            const hours = dateObj.getHours().toString().padStart(2, '0');
                            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
                            const seconds = dateObj.getSeconds().toString().padStart(2, '0');
                            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                        };

                        const shiftStartTimeStr = formatDateTime(shiftStartDateTime); 
                        const shiftEndTimeStr = formatDateTime(shiftEndDateTime);

                        await client.query(
                            'INSERT INTO shifts (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5)',
                            [employeeScheduled.user_id, employeeScheduled.location_id, shiftStartTimeStr, shiftEndTimeStr, `Auto-generated ${employeeScheduled.employment_type} for ${employeeScheduled.full_name}.`]
                        );
                        
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduled.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours += (shiftDurationForUpdate / 60); 
                            employeeScheduleData[globalEmpIndex].daysWorked++; 
                        }
                        employeesScheduledTodayIds.add(employeeScheduled.user_id); 
                        remainingDailyTargetMinutes -= shiftDurationForUpdate; 
                        totalShiftsCreated++;
                        
                        for (let m = currentMinute; m < currentMinute + shiftLengthForCoverage; m += SCHEDULING_INTERVAL_MINUTES) { 
                            const idx = Math.floor((m - businessStartTotalMinutes) / SCHEDULING_INTERVAL_MINUTES);
                            if (idx >= 0 && idx < dailyCoverageSlots.length) dailyCoverageSlots[idx]++; 
                        }
                        console.log(`[AUTO-SCHEDULE-ULTIMATE-DEBUG] Shift CREATED for ${employeeScheduled.full_name} (${employeeScheduled.user_id}, Type: ${employeeScheduled.employment_type}) on ${dayName}. Local Start: ${shiftStartTimeStr}. Local End: ${shiftEndTimeStr}. Remaining Daily Target: ${remainingDailyTargetMinutes}. Daily Coverage: ${JSON.stringify(dailyCoverageSlots.slice(coverageIndex, coverageIndex + (shiftLengthForCoverage / SCHEDULING_INTERVAL_MINUTES)))}`);
                        // No continue needed here, the loop will naturally increment to the next minute interval.
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
