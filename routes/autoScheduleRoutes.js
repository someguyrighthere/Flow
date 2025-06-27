// routes/autoScheduleRoutes.js

// This module will contain the auto-scheduling route logic.
// It receives 'app', 'pool', 'isAuthenticated', and 'isAdmin' from server.js
// to register the route and utilize middleware and database connection.

module.exports = (app, pool, isAuthenticated, isAdmin) => {

    // Auto-generate shifts route
    app.post('/shifts/auto-generate', isAuthenticated, isAdmin, async (req, res) => {
        // --- CONSTANTS (Defined INSIDE the handler function for guaranteed access) ---
        const FULL_TIME_WORK_DURATION_MINUTES = 8 * 60; // 8 hours
        const FULL_TIME_BREAK_DURATION_MINUTES = 0.5 * 60; // 30 minutes
        const FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES = FULL_TIME_WORK_DURATION_MINUTES + FULL_TIME_BREAK_DURATION_MINUTES; // 8.5 hours in minutes
        const PART_TIME_WORK_DURATION_MINUTES = 4 * 60; // 4 hours
        const PART_TIME_SHIFT_LENGTH_MINUTES = PART_TIME_WORK_DURATION_MINUTES; // Part-time assumed no integrated break

        const SCHEDULING_RESOLUTION_MINUTES = 15; // 15-minute intervals
        const PART_TIME_MAX_HOURS_PER_WEEK = 20; // Rule: Part-time max hours
        // --- END CONSTANTS ---

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
            
            const businessStartHour = parseInt(settings.operating_hours_start.split(':')[0], 10);
            const businessStartMinute = parseInt(settings.operating_hours_start.split(':')[1], 10);
            const businessEndHour = parseInt(settings.operating_hours_end.split(':')[0], 10);
            const businessEndMinute = parseInt(settings.operating_hours_end.split(':')[1], 10);

            const businessStartTotalMinutes = businessStartHour * 60 + businessStartMinute;
            const businessEndTotalMinutes = businessEndHour * 60 + businessEndMinute;
            const totalBusinessHoursDuration = (businessEndTotalMinutes - businessStartTotalMinutes) / 60; // Duration in hours
            
            // --- ULTIMATE DEBUG LOGS (AUTO-SCHEDULE: BUSINESS HOURS) ---
            console.log(`[SCHEDULER-REWRITE-DEBUG] Business Hours (from DB): Raw Start=${settings.operating_hours_start}, Raw End=${settings.operating_hours_end}`);
            console.log(`[SCHEDULER-REWRITE-DEBUG] Business Hours (Parsed Minutes): Start=${businessStartTotalMinutes}, End=${businessEndTotalMinutes}`);
            // --- END DEBUG LOGS ---


            // Fetch all eligible employees
            const { rows: employees } = await client.query(`SELECT user_id, full_name, availability, location_id, employment_type FROM users WHERE role = 'employee' AND availability IS NOT NULL`);
            
            // Initialize employee data for scheduling, including weekly tracking
            let employeeScheduleData = employees.map(e => ({
                ...e,
                scheduled_hours_this_week: 0, // Total hours for the week
                days_worked_this_week: 0,     // Total days worked this week
                shifts_today_ids: new Set(),  // IDs of shifts assigned to this employee today (to enforce one shift/day)
            }));

            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            let totalShiftsCreatedOverall = 0;

            // --- 2. Main Scheduling Loop: Iterate Day by Day ---
            for (let i = 0; i < 7; i++) {
                const currentDayDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + i); 
                currentDayDate.setHours(0,0,0,0); // Explicitly set to local midnight for consistency.

                const dayName = daysOfWeek[currentDayDate.getDay()]; 
                const dailyManHoursTarget = parseFloat(dailyHours[dayName] || 0); 
                let currentDayManMinutesScheduled = 0; // Track man-minutes added for today to hit target

                console.log(`\n--- [SCHEDULER-REWRITE-DEBUG] Processing Day: ${dayName} (Local Date: ${currentDayDate.toLocaleDateString()}) ---`);
                console.log(`[SCHEDULER-REWRITE-DEBUG] Daily Man-Hours Target: ${dailyManHoursTarget}`);

                // Daily coverage grid: Tracks how many shifts are covering each 15-min slot
                const totalBusinessMinutesDuration = businessEndTotalMinutes - businessStartTotalMinutes;
                const dailySlotCoverage = Array(Math.ceil(totalBusinessMinutesDuration / SCHEDULING_RESOLUTION_MINUTES)).fill(0); 
                
                // Reset employees' daily shift tracking for the new day
                employeeScheduleData.forEach(emp => emp.shifts_today_ids.clear());

                // --- 2.1. Mark existing shifts (manual or previous runs) in dailySlotCoverage ---
                const existingShiftsRes = await client.query(`
                    SELECT start_time::text as start_time, end_time::text as end_time FROM shifts
                    WHERE start_time::date = $1::date;
                `, [currentDayDate.toISOString().split('T')[0]]); 

                existingShiftsRes.rows.forEach(shift => {
                    const shiftTimeRegex = /(\d{2}):(\d{2}):(\d{2})$/;
                    const shiftStartMatch = shift.start_time.match(shiftTimeRegex);
                    const shiftEndMatch = shift.end_time.match(shiftTimeRegex);

                    if (!shiftStartMatch || !shiftEndMatch) {
                        console.error(`[SCHEDULER-REWRITE-DEBUG] ERROR: Could not parse existing shift time: Start=${shift.start_time}, End=${shift.end_time}`);
                        return; 
                    }
                    
                    const shiftStartTotalMinutes = parseInt(shiftStartMatch[1], 10) * 60 + parseInt(shiftStartMatch[2], 10); 
                    const shiftEndTotalMinutes = parseInt(shiftEndMatch[1], 10) * 60 + parseInt(shiftEndMatch[2], 10);     
                    
                    for (let m = shiftStartTotalMinutes; m < shiftEndTotalMinutes; m += SCHEDULING_RESOLUTION_MINUTES) {
                        const coverageIndex = Math.floor((m - businessStartTotalMinutes) / SCHEDULING_RESOLUTION_MINUTES);
                        if (coverageIndex >= 0 && coverageIndex < dailySlotCoverage.length) {
                            dailySlotCoverage[coverageIndex]++; // Increment count
                        }
                    }
                });

                console.log(`[SCHEDULER-REWRITE-DEBUG] Daily Slot Coverage after existing shifts: ${dailySlotCoverage}`);


                // --- 2.2. Iterate through each 15-minute slot in business hours ---
                for (let currentSlotMinute = businessStartTotalMinutes; currentSlotMinute < businessEndTotalMinutes; currentSlotMinute += SCHEDULING_RESOLUTION_MINUTES) {
                    const slotIndex = Math.floor((currentSlotMinute - businessStartTotalMinutes) / SCHEDULING_RESOLUTION_MINUTES); 
                    let employeeScheduledThisSlot = null; // Reset for each minute slot

                    console.log(`[SCHEDULER-REWRITE-DEBUG] Checking Slot: ${currentSlotMinute} mins. Current Coverage: ${dailySlotCoverage[slotIndex]}. Man-Minutes Today: ${currentDayManMinutesScheduled}`);

                    // Determine if we need to schedule at this specific minute slot.
                    const isSlotUncovered = dailySlotCoverage[slotIndex] === 0;
                    const needsMoreManHours = currentDayManMinutesScheduled < dailyManHoursTarget * 60;

                    // This is the core decision logic based on your priorities:
                    // Try to schedule if:
                    // 1. The slot is completely UNCOVERED.
                    // 2. OR the slot is COVERED, but we still need more man-hours for the day.
                    let shouldAttemptScheduleForSlot = isSlotUncovered || (dailySlotCoverage[slotIndex] > 0 && needsMoreManHours);

                    if (!shouldAttemptScheduleForSlot) {
                        // Slot is covered and daily man-hours target is met, so no need to schedule more for this slot.
                        console.log(`[SCHEDULER-REWRITE-DEBUG] Slot ${currentSlotMinute}: Covered and daily target met. Skipping scheduling for this slot.`);
                        continue; 
                    }

                    // --- Find an eligible employee (FT first, then PT) ---
                    // This section now lives outside the specific `if` branches to avoid redundancy.
                    const getEligibleEmployee = (shiftTypeMinutes, maxWeeklyHours, isPartTimeCheck) => {
                        return employeeScheduleData.filter(emp => {
                            // Hard constraints:
                            if (emp.days_worked_this_week >= 5) { return false; } // Max 5 days/week
                            if (emp.shifts_today_ids.has(currentDayDate.getTime())) { return false; } // Only one shift per employee per day

                            const dayAvail = emp.availability && emp.availability[dayName];
                            if (!dayAvail) { return false; } // Not available on this day
                            
                            const availStart = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                            const availEnd = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);
                            const requiredShiftEnd = currentSlotMinute + shiftTypeMinutes;

                            const fitsTime = availStart <= currentSlotMinute && 
                                             availEnd >= requiredShiftEnd &&
                                             currentSlotMinute >= businessStartTotalMinutes && 
                                             requiredShiftEnd <= businessEndTotalMinutes; 
                            if (!fitsTime) return false; // Does not fit time/availability

                            // SOFT CONSTRAINT for overlap: Only add if they are not already at their weekly max.
                            // This check applies if the slot is *already covered* OR if the employee is already at their max hours.
                            // If `isSlotUncovered` is true, we will try to schedule them even if they are at max hours,
                            // to ensure basic coverage. We prioritize coverage over soft limits.
                            if (emp.scheduled_hours_this_week >= maxWeeklyHours && !isSlotUncovered) {
                                return false; // Disqualify for overlap if already at max hours and slot is covered
                            }
                            
                            // Specific check for Part-time vs Full-time type
                            if (isPartTimeCheck && emp.employment_type !== 'Part-time') return false;
                            if (!isPartTimeCheck && emp.employment_type === 'Part-time') return false; // FT check
                            
                            return true;
                        }).sort((a, b) => a.scheduled_hours_this_week - b.scheduled_hours_this_week); // Prioritize least scheduled
                    };


                    // --- Attempt to schedule ---
                    // Prioritize FT for primary coverage, then PT for primary coverage
                    // Then FT for overlap, then PT for overlap.

                    if (isSlotUncovered) {
                        console.log(`[SCHEDULER-REWRITE-DEBUG]   Attempting PRIMARY coverage for UNCOVERED Slot ${currentSlotMinute}.`);
                        let eligible = getEligibleEmployee(FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES, 40, false);
                        if (eligible.length > 0) {
                            employeeScheduledThisSlot = eligible[0];
                            console.log(`[SCHEDULER-REWRITE-DEBUG]     FT selected for PRIMARY coverage: ${employeeScheduledThisSlot.full_name}`);
                        } else {
                            eligible = getEligibleEmployee(PART_TIME_SHIFT_LENGTH_MINUTES, PART_TIME_MAX_HOURS_PER_WEEK, true);
                            if (eligible.length > 0) {
                                employeeScheduledThisSlot = eligible[0];
                                console.log(`[SCHEDULER-REWRITE-DEBUG]     PT selected for PRIMARY coverage: ${employeeScheduledThisSlot.full_name}`);
                            }
                        }
                        if (!employeeScheduledThisSlot) {
                            console.log(`[SCHEDULER-REWRITE-DEBUG]   Slot ${currentSlotMinute}: UNCOVERED, but NO ELIGIBLE employee found for PRIMARY coverage.`);
                        }
                    } else if (needsMoreManHours) { // Slot is covered, but need more man-hours
                        console.log(`[SCHEDULER-REWRITE-DEBUG]   Attempting OVERLAP coverage for Slot ${currentSlotMinute}.`);
                        let eligible = getEligibleEmployee(FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES, 40, false);
                        if (eligible.length > 0) {
                            employeeScheduledThisSlot = eligible[0];
                            console.log(`[SCHEDULER-REWRITE-DEBUG]     FT selected for OVERLAP coverage: ${employeeScheduledThisSlot.full_name}`);
                        } else {
                            eligible = getEligibleEmployee(PART_TIME_SHIFT_LENGTH_MINUTES, PART_TIME_MAX_HOURS_PER_WEEK, true);
                            if (eligible.length > 0) {
                                employeeScheduledThisSlot = eligible[0];
                                console.log(`[SCHEDULER-REWRITE-DEBUG]     PT selected for OVERLAP coverage: ${employeeScheduledThisSlot.full_name}`);
                            }
                        }
                        if (!employeeScheduledThisSlot) {
                            console.log(`[SCHEDULER-REWRITE-DEBUG]   Slot ${currentSlotMinute}: COVERED, but needs more man-hours. NO ELIGIBLE employee found for OVERLAP.`);
                        }
                    }
                    // Else, if not uncovered and not needing more man-hours, we just skip this slot.


                    if (employeeScheduledThisSlot) {
                        const shiftDurationForUpdate = (employeeScheduledThisSlot.employment_type === 'Full-time') ? FULL_TIME_WORK_DURATION_MINUTES : PART_TIME_WORK_DURATION_MINUTES;
                        const shiftLengthForCoverage = (employeeScheduledThisSlot.employment_type === 'Full-time') ? FULL_TIME_SHIFT_TOTAL_MINUTES : PART_TIME_SHIFT_TOTAL_MINUTES;
                        
                        const shiftStartDateTime = new Date(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), Math.floor(currentSlotMinute / 60), currentSlotMinute % 60, 0); 
                        const shiftEndDateTime = new Date(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), Math.floor((currentSlotMinute + shiftLengthForCoverage) / 60), (currentSlotMinute + shiftLengthForCoverage) % 60, 0); 
                        
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
                            [employeeScheduledThisSlot.user_id, employeeScheduledThisSlot.location_id, shiftStartTimeStr, shiftEndTimeStr, `Auto-generated ${employeeScheduledThisSlot.employment_type} for ${employeeScheduledThisSlot.full_name}.`]
                        );
                        
                        const globalEmpIndex = employeeScheduleData.findIndex(emp => emp.user_id === employeeScheduledThisSlot.user_id);
                        if (globalEmpIndex !== -1) {
                            employeeScheduleData[globalEmpIndex].scheduled_hours_this_week += (shiftDurationForUpdate / 60); 
                            employeeScheduleData[globalEmpIndex].days_worked_this_week++; 
                            employeeScheduleData[globalEmpIndex].shifts_today_ids.add(currentDayDate.getTime());
                        }
                        
                        currentDayManMinutesScheduled += shiftDurationForUpdate; 
                        totalShiftsCreatedOverall++;
                        
                        for (let m = currentSlotMinute; m < currentSlotMinute + shiftLengthForCoverage; m += SCHEDULING_RESOLUTION_MINUTES) { 
                            const idx = Math.floor((m - businessStartTotalMinutes) / SCHEDULING_RESOLUTION_MINUTES);
                            if (idx >= 0 && idx < dailySlotCoverage.length) dailySlotCoverage[idx]++; 
                        }
                        console.log(`[SCHEDULER-REWRITE-DEBUG] Shift CREATED for ${employeeScheduledThisSlot.full_name} (${employeeScheduledThisSlot.user_id}, Type: ${employeeScheduledThisSlot.employment_type}) on ${dayName}. Local Start: ${shiftStartTimeStr}. Local End: ${shiftEndTimeStr}. Man-Minutes Today: ${currentDayManMinutesScheduled}. Daily Coverage: ${JSON.stringify(dailySlotCoverage.slice(slotIndex, slotIndex + (shiftLengthForCoverage / SCHEDULING_RESOLUTION_MINUTES)))}`);
                    }
                }
            }

            await client.query('COMMIT'); 
            res.status(201).json({ message: `Successfully auto-generated ${totalShiftsCreatedOverall} shifts.` });

        } catch (error) {
            await client.query('ROLLBACK'); 
            console.error('Auto-scheduling failed:', error);
            res.status(500).json({ error: 'An error occurred during auto-scheduling.' });
        } finally {
            client.release(); 
        }
    });
};
