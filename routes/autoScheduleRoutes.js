// routes/autoScheduleRoutes.js

// This module will contain the auto-scheduling route logic.
// It receives 'app', 'pool', 'isAuthenticated', and 'isAdmin' from server.js
// to register the route and utilize middleware and database connection.

module.exports = (app, pool, isAuthenticated, isAdmin) => {

    // --- CONSTANTS (Defined INSIDE module.exports function scope for guaranteed access by nested functions) ---
    const FULL_TIME_WORK_DURATION_MINUTES = 8 * 60; // 8 hours
    const FULL_TIME_BREAK_DURATION_MINUTES = 0.5 * 60; // 30 minutes
    const FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES = FULL_TIME_WORK_DURATION_MINUTES + FULL_TIME_BREAK_DURATION_MINUTES; // 8.5 hours in minutes
    const PART_TIME_WORK_DURATION_MINUTES = 4 * 60; // 4 hours
    const PART_TIME_SHIFT_LENGTH_MINUTES = PART_TIME_WORK_DURATION_MINUTES; // Part-time assumed no integrated break

    const SCHEDULING_RESOLUTION_MINUTES = 15; // 15-minute intervals
    const PART_TIME_MAX_HOURS_PER_WEEK = 20; // Rule: Part-time max hours
    // --- END CONSTANTS ---

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

                    // PRIORITY 1: Fill UNCOVERED slots first.
                    if (isSlotUncovered) {
                        console.log(`[SCHEDULER-REWRITE-DEBUG]   SLOT UNCOVERED. Prioritizing primary coverage.`);
                        
                        // Try FT first for primary coverage
                        let eligibleFTEmployees = employeeScheduleData.filter(emp => {
                            // Hard constraints:
                            if (emp.days_worked_this_week >= 5) { console.log(`[SCHEDULER-REWRITE-DEBUG]     FT Check for ${emp.full_name}: Exceeds 5 days worked.`); return false; }
                            if (emp.shifts_today_ids.has(currentDayDate.getTime())) { console.log(`[SCHEDULER-REWRITE-DEBUG]     FT Check for ${emp.full_name}: Already scheduled today.`); return false; }
                            const dayAvail = emp.availability && emp.availability[dayName];
                            if (!dayAvail) { console.log(`[SCHEDULER-REWRITE-DEBUG]     FT Check for ${emp.full_name}: Not available on ${dayName}.`); return false; }
                            
                            const availStart = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                            const availEnd = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);
                            const requiredShiftEnd = currentSlotMinute + FULL_TIME_SHIFT_LENGTH_TOTAL_MINUTES;

                            const fitsTime = availStart <= currentSlotMinute && 
                                             availEnd >= requiredShiftEnd &&
                                             currentSlotMinute >= businessStartTotalMinutes && 
                                             requiredShiftEnd <= businessEndTotalMinutes; 
                            
                            console.log(`[SCHEDULER-REWRITE-DEBUG]     FT Primary Elig Check for ${emp.full_name}: FitsTime=${fitsTime}. WeeklyHours=${emp.scheduled_hours_this_week}.`);
                            return fitsTime;
                        }).sort((a, b) => a.scheduled_hours_this_week - b.scheduled_hours_this_week); 

                        if (eligibleFTEmployees.length > 0) {
                            employeeScheduledThisSlot = eligibleFTEmployees[0];
                            console.log(`[SCHEDULER-REWRITE-DEBUG]   FT Employee ${employeeScheduledThisSlot.full_name} selected for PRIMARY coverage of UNCOVERED slot.`);
                        } else {
                            // If no FT found for primary coverage, try PT
                            const eligiblePTEmployees = employeeScheduleData.filter(emp => {
                                // Hard limits for basic eligibility
                                if (emp.employment_type !== 'Part-time') return false; 
                                if (emp.days_worked_this_week >= 5) return false; 
                                if (emp.shifts_today_ids.has(currentDayDate.getTime())) return false; 
                                const dayAvail = emp.availability && emp.availability[dayName];
                                if (!dayAvail) return false;
                                
                                const availStart = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                                const availEnd = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);
                                const requiredShiftEnd = currentSlotMinute + PART_TIME_SHIFT_LENGTH_MINUTES; 
                                const fitsTime = availStart <= currentSlotMinute && 
                                                 availEnd >= requiredShiftEnd &&
                                                 currentSlotMinute >= businessStartTotalMinutes && 
                                                 requiredShiftEnd <= businessEndTotalMinutes;
                                console.log(`[SCHEDULER-REWRITE-DEBUG]     PT Primary Elig Check for ${emp.full_name}: FitsTime=${fitsTime}. WeeklyHours=${emp.scheduled_hours_this_week}.`);
                                return fitsTime;
                            }).sort((a, b) => a.scheduled_hours_this_week - b.scheduled_hours_this_week); 

                            if (eligiblePTEmployees.length > 0) {
                                employeeScheduledThisSlot = eligiblePTEmployees[0]; 
                                console.log(`[SCHEDULER-REWRITE-DEBUG]   PT Employee ${employeeScheduledThisSlot.full_name} selected for PRIMARY coverage of UNCOVERED slot.`);
                            }
                        }

                        if (!employeeScheduledThisSlot) {
                            console.log(`[SCHEDULER-REWRITE-DEBUG] Minute ${currentSlotMinute}: UNCOVERED, but NO ELIGIBLE employee found to cover this slot.`);
                        }
                    } 
                    // PRIORITY 2: Add OVERLAP if slot is already covered AND we still need man-hours.
                    else if (needsMoreManHours) { // Slot is already covered, but we need more man-hours
                        console.log(`[SCHEDULER-REWRITE-DEBUG] Slot ${currentSlotMinute}: COVERED, but remaining daily target (${currentDayManMinutesScheduled} of ${dailyManHoursTarget * 60}) not met. Attempting to add OVERLAP.`);

                        // Try FT for overlap (only if not at max weekly)
                        let eligibleFTEmployeesForOverlap = employeeScheduleData.filter(emp => {
                            // Hard constraints:
                            if (emp.days_worked_this_week >= 5) return false; 
                            if (employeesScheduledTodayIds.has(emp.user_id)) return false; 
                            const dayAvail = emp.availability && emp.availability[dayName];
                            if (!dayAvail) return false;
                            const availStart = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                            const availEnd = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);
                            const requiredShiftEnd = currentSlotMinute + FULL_TIME_SHIFT_TOTAL_MINUTES;
                            const fitsTime = availStart <= currentSlotMinute && 
                                             availEnd >= requiredShiftEnd &&
                                             currentSlotMinute >= businessStartTotalMinutes && 
                                             requiredShiftEnd <= businessEndTotalMinutes; 
                            
                            // SOFT CONSTRAINT for overlap: Only add if they are not already at their weekly max.
                            if (emp.scheduled_hours_this_week >= 40) {
                                console.log(`[SCHEDULER-REWRITE-DEBUG]     FT Overlap Check for ${emp.full_name}: Exceeds 40 hours. Skipping for overlap.`);
                                return false; 
                            }
                            console.log(`[SCHEDULER-REWRITE-DEBUG]     FT Overlap Elig Check for ${emp.full_name}: FitsTime=${fitsTime}`);
                            return fitsTime;
                        }).sort((a, b) => a.scheduled_hours_this_week - b.scheduled_hours_this_week); 

                        if (eligibleFTEmployeesForOverlap.length > 0) {
                            employeeScheduledThisSlot = eligibleFTEmployeesForOverlap[0];
                            console.log(`[SCHEDULER-REWRITE-DEBUG]   FT Employee ${employeeScheduledThisSlot.full_name} selected for OVERLAP.`);
                        } else {
                            // If no FT, try to find a Part-time employee for overlap
                            const eligiblePTEmployeesForOverlap = employeeScheduleData.filter(emp => {
                                if (emp.employment_type !== 'Part-time') return false; 
                                if (emp.days_worked_this_week >= 5) return false; 
                                if (emp.shifts_today_ids.has(currentDayDate.getTime())) return false; 
                                const dayAvail = emp.availability && emp.availability[dayName];
                                if (!dayAvail) return false;
                                const availStart = parseInt(dayAvail.start.split(':')[0], 10) * 60 + parseInt(dayAvail.start.split(':')[1], 10);
                                const availEnd = parseInt(dayAvail.end.split(':')[0], 10) * 60 + parseInt(dayAvail.end.split(':')[1], 10);
                                const requiredShiftEnd = currentSlotMinute + PT_SHIFT_TOTAL_MINUTES; 
                                const isEligible = availStart <= currentSlotMinute && 
                                                   availEnd >= requiredShiftEnd &&
                                                   currentSlotMinute >= businessStartTotalMinutes && 
                                                   requiredShiftEnd <= businessEndTotalMinutes;
                                
                                if (emp.scheduled_hours_this_week >= PART_TIME_MAX_HOURS_PER_WEEK) {
                                    console.log(`[SCHEDULER-REWRITE-DEBUG]   PT Overlap Check for ${emp.full_name}: Exceeds ${PART_TIME_MAX_HOURS_PER_WEEK} hours. Skipping for overlap.`);
                                    return false; 
                                }
                                console.log(`[SCHEDULER-REWRITE-DEBUG]   PT Overlap Elig Check for ${emp.full_name}: FitsTime=${fitsTime}`);
                                return isEligible;
                            }).sort((a, b) => a.scheduled_hours_this_week - b.scheduled_hours_this_week); 

                            if (eligiblePTEmployeesForOverlap.length > 0) {
                                employeeScheduledThisSlot = eligiblePTEmployeesForOverlap[0]; 
                                console.log(`[SCHEDULER-REWRITE-DEBUG]   PT Employee ${employeeScheduledThisSlot.full_name} selected for OVERLAP.`);
                            }
                        }

                        if (!employeeScheduledThisSlot) {
                            console.log(`[SCHEDULER-REWRITE-DEBUG] Minute ${currentSlotMinute}: Need OVERLAP, but NO ELIGIBLE employee found.`);
                        }
                    } else {
                        // Slot is covered and daily man-hours target is met, so no need to schedule.
                        console.log(`[SCHEDULER-REWRITE-DEBUG] Slot ${currentSlotMinute}: Covered and daily target met. Skipping scheduling for this slot.`);
                    }


                    if (employeeScheduledThisSlot) {
                        const shiftDurationForUpdate = (employeeScheduledThisSlot.employment_type === 'Full-time') ? FT_WORK_MINUTES : PT_WORK_MINUTES;
                        const shiftLengthForCoverage = (employeeScheduledThisSlot.employment_type === 'Full-time') ? FT_SHIFT_TOTAL_MINUTES : PT_SHIFT_TOTAL_MINUTES;
                        
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
                        console.log(`[SCHEDULER-REWRITE-DEBUG] Shift CREATED for ${employeeScheduledThisSlot.full_name} (${employeeScheduledThisSlot.user_id}, Type: ${employeeScheduledThisSlot.employment_type}) on ${dayName}. Local Start: ${shiftStartTimeStr}. Local End: ${shiftEndTimeStr}. Man-Minutes Today: ${currentDayManMinutesScheduled}. Daily Coverage: ${JSON.stringify(dailySlotCoverage.slice(coverageIndex, coverageIndex + (shiftLengthForCoverage / SCHEDULING_RESOLUTION_MINUTES)))}`);
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
