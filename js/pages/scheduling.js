import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the NEW horizontal timeline scheduling page.
 */
export function handleSchedulingPage() {
    // --- Security & Role Check ---
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Element References ---
    const currentDayDisplay = document.getElementById('current-day-display');
    const prevDayBtn = document.getElementById('prev-day-btn');
    const nextDayBtn = document.getElementById('next-day-btn');
    const timelineHoursDiv = document.getElementById('timeline-hours');
    const timelineEmployeesDiv = document.getElementById('timeline-employees');
    const timelineGridDiv = document.getElementById('timeline-grid');

    // --- State Management ---
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Normalize to the start of the day

    // --- Constants ---
    const PIXELS_PER_MINUTE = 2; // Each minute is 2px wide, so an hour is 120px

    /**
     * Main function to initialize the calendar for a specific date.
     * @param {Date} date - The date to display the schedule for.
     */
    const loadScheduleForDate = async (date) => {
        currentDayDisplay.textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        
        // Clear previous state
        timelineHoursDiv.innerHTML = 'Loading...';
        timelineEmployeesDiv.innerHTML = '';
        timelineGridDiv.innerHTML = '';

        try {
            // For a daily view, we need all users and all shifts for that day
            const [users, allShifts] = await Promise.all([
                apiRequest('GET', '/api/users'),
                apiRequest('GET', `/api/shifts?startDate=${getApiDate(date)}&endDate=${getApiDate(getNextDay(date))}`)
            ]);

            // Filter users to only include employees with assigned locations
            const employees = users.filter(u => u.role === 'employee' && u.location_id);
            
            if (employees.length === 0) {
                timelineGridDiv.innerHTML = '<p style="padding: 20px; color: var(--text-medium);">No employees found to schedule.</p>';
                timelineHoursDiv.innerHTML = '';
                return;
            }

            // Render the timeline structure
            renderTimelineHeaders();
            renderEmployeeRows(employees);

            // Filter shifts to only include those for the displayed employees
            const employeeIds = employees.map(e => e.user_id);
            const shiftsForDay = allShifts.filter(s => employeeIds.includes(s.employee_id));

            // Place the shifts on the grid
            renderShifts(shiftsForDay, employees);

        } catch (error) {
            showModalMessage(`Error loading schedule: ${error.message}`, true);
            console.error("Error loading schedule data:", error);
            timelineGridDiv.innerHTML = `<p style="padding: 20px; color: #e74c3c;">Could not load schedule.</p>`;
        }
    };

    /**
     * Renders the hour markers at the top of the timeline.
     */
    const renderTimelineHeaders = () => {
        timelineHoursDiv.innerHTML = '';
        for (let hour = 0; hour < 24; hour++) {
            const hourMarker = document.createElement('div');
            hourMarker.className = 'hour-marker';
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour < 12 ? 'AM' : 'PM';
            hourMarker.textContent = `${displayHour} ${ampm}`;
            timelineHoursDiv.appendChild(hourMarker);
        }
    };

    /**
     * Renders the employee name column and the empty grid rows.
     * @param {Array} employees - The list of employees to display.
     */
    const renderEmployeeRows = (employees) => {
        timelineEmployeesDiv.innerHTML = '';
        timelineGridDiv.innerHTML = '';

        employees.forEach(employee => {
            // Add employee name to the left column
            const employeeHeader = document.createElement('div');
            employeeHeader.className = 'employee-row-header';
            employeeHeader.textContent = employee.full_name;
            timelineEmployeesDiv.appendChild(employeeHeader);

            // Add a corresponding empty row in the grid
            const employeeRow = document.createElement('div');
            employeeRow.className = 'employee-row';
            employeeRow.id = `employee-row-${employee.user_id}`; // ID for placing shifts
            timelineGridDiv.appendChild(employeeRow);
        });
    };

    /**
     * Places shift blocks onto the correct employee rows in the timeline.
     * @param {Array} shifts - The shifts for the current day.
     * @param {Array} employees - The list of employees.
     */
    const renderShifts = (shifts, employees) => {
        shifts.forEach(shift => {
            const targetRow = document.getElementById(`employee-row-${shift.employee_id}`);
            if (targetRow) {
                const shiftStart = new Date(shift.start_time);
                const shiftEnd = new Date(shift.end_time);

                // Calculate position and width based on time
                const startMinutes = shiftStart.getHours() * 60 + shiftStart.getMinutes();
                const endMinutes = shiftEnd.getHours() * 60 + shiftEnd.getMinutes();
                
                const leftPosition = startMinutes * PIXELS_PER_MINUTE;
                const width = (endMinutes - startMinutes) * PIXELS_PER_MINUTE;

                if (width > 0) {
                    const shiftBlock = document.createElement('div');
                    shiftBlock.className = 'shift-block';
                    shiftBlock.style.left = `${leftPosition}px`;
                    shiftBlock.style.width = `${width}px`;
                    
                    const timeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
                    const startTimeString = shiftStart.toLocaleTimeString('en-US', timeFormatOptions);
                    const endTimeString = shiftEnd.toLocaleTimeString('en-US', timeFormatOptions);

                    shiftBlock.textContent = `${startTimeString} - ${endTimeString}`;
                    shiftBlock.title = `Shift for ${shift.employee_name}\n${startTimeString} - ${endTimeString}\nLocation: ${shift.location_name}\nNotes: ${shift.notes || 'None'}`;
                    
                    targetRow.appendChild(shiftBlock);
                }
            }
        });
    };

    /**
     * Helper to get the next day for API date range queries.
     * @param {Date} d - The current date.
     * @returns {Date} The next day.
     */
    const getNextDay = (d) => {
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        return next;
    };

    /**
     * Helper to format a date as YYYY-MM-DD for the API.
     * @param {Date} d - The date to format.
     * @returns {string} The formatted date string.
     */
    const getApiDate = (d) => d.toISOString().split('T')[0];

    // --- Event Handlers ---
    const handleDayChange = (days) => {
        currentDate.setDate(currentDate.getDate() + days);
        loadScheduleForDate(currentDate);
    };

    prevDayBtn.addEventListener('click', () => handleDayChange(-1));
    nextDayBtn.addEventListener('click', () => handleDayChange(1));

    // --- Initial Page Load ---
    loadScheduleForDate(currentDate);
}
