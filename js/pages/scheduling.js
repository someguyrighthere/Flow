// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleSchedulingPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const calendarGrid = document.getElementById('calendar-grid');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const createShiftForm = document.getElementById('create-shift-form');
    
    const employeeSelect = document.getElementById('employee-select');
    const locationSelect = document.getElementById('location-select');

    const availabilityToggle = document.getElementById('toggle-availability');
    const autoGenerateBtn = document.getElementById('auto-generate-schedule-btn');
    const dailyHoursContainer = document.getElementById('daily-hours-inputs');

    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);

    /**
     * Dynamically creates input fields for daily operating hours.
     * These inputs allow admins to specify the total hours to be scheduled for each day
     * when using the auto-generate schedule feature.
     */
    function createDailyHoursInputs() {
        if (!dailyHoursContainer) return; // Ensure the container exists
        dailyHoursContainer.innerHTML = ''; // Clear previous inputs
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach(day => {
            const dayId = day.toLowerCase();
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            formGroup.innerHTML = `
                <label for="hours-${dayId}">${day}</label>
                <input type="number" id="hours-${dayId}" class="daily-hours-input" min="0" value="8" step="1" data-day="${dayId}">
            `;
            dailyHoursContainer.appendChild(formGroup);
        });
    }

    /**
     * Renders the calendar grid for the specified week.
     * It sets up the header with days of the week, the time column,
     * and individual day columns where shifts and availability will be displayed.
     * @param {Date} startDate - The starting date of the week to render (usually a Sunday).
     */
    async function renderCalendar(startDate) {
        if (!calendarGrid || !currentWeekDisplay) return;
        
        // Calculate the end date for the week display
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        const options = { month: 'short', day: 'numeric' };
        currentWeekDisplay.textContent = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
        
        calendarGrid.innerHTML = ''; // Clear existing calendar content

        // Create Header Row (empty corner + 7 days)
        // This element is now simply a placeholder for the top-left corner
        const cornerHeader = document.createElement('div');
        cornerHeader.className = 'calendar-corner-header';
        cornerHeader.innerHTML = `&nbsp;`;
        calendarGrid.appendChild(cornerHeader);

        // Add headers for each day of the week
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + i); // Increment date for each day
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = dayDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            calendarGrid.appendChild(dayHeader); // Append directly to calendarGrid
        }

        // Create Time Column (for hours of the day)
        const timeColumn = document.createElement('div');
        timeColumn.className = 'time-column';
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            const displayHour = hour % 12 === 0 ? 12 : hour % 12; // Convert to 12-hour format
            const ampm = hour < 12 ? 'AM' : 'PM';
            timeSlot.textContent = `${displayHour} ${ampm}`;
            timeColumn.appendChild(timeSlot);
        }
        calendarGrid.appendChild(timeColumn); // Append directly to calendarGrid

        // Create Day Columns (where shifts will be placed)
        for (let i = 0; i < 7; i++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            dayColumn.id = `day-column-${i}`; // Assign a unique ID for easy access
            // Add 24 hour-line divs for visual grid
            for (let j = 0; j < 24; j++) {
                const hourLine = document.createElement('div');
                hourLine.className = 'hour-line';
                dayColumn.appendChild(hourLine);
            }
            calendarGrid.appendChild(dayColumn); // Append directly to calendarGrid
        }

        // Load and display shifts and availability concurrently for better performance
        await Promise.all([
            loadAndDisplayShifts(startDate, endDate),
            loadAndRenderAvailability()
        ]);
    }

    /**
     * Fetches shifts from the API for the current week and displays them on the calendar.
     * Shifts are positioned absolutely within their respective day columns based on start and end times.
     * @param {Date} start - The start date of the week.
     * @param {Date} end - The end date of the week.
     */
    async function loadAndDisplayShifts(start, end) {
        // Remove any previously rendered shifts to prevent duplicates
        document.querySelectorAll('.calendar-shift').forEach(el => el.remove());
        
        // Format dates for API request
        const formatDate = (d) => d.toISOString().split('T')[0];
        let endOfDay = new Date(end);
        endOfDay.setDate(endOfDay.getDate() + 1); // Ensure shifts up to end of end date are included
        
        try {
            const shifts = await apiRequest('GET', `/shifts?startDate=${formatDate(start)}&endDate=${formatDate(endOfDay)}`);
            if (shifts && shifts.length > 0) {
                shifts.forEach(shift => {
                    const shiftStart = new Date(shift.start_time);
                    const shiftEnd = new Date(shift.end_time);
                    
                    const dayIndex = shiftStart.getDay(); // Get day of week (0=Sunday, 6=Saturday)
                    const dayColumn = document.getElementById(`day-column-${dayIndex}`);

                    if (dayColumn) {
                        // Calculate pixel positioning for the shift
                        const startPixels = (shiftStart.getHours() * 60) + shiftStart.getMinutes();
                        const endPixels = (shiftEnd.getHours() * 60) + shiftEnd.getMinutes();
                        const heightPixels = endPixels - startPixels;
                        
                        const shiftElement = document.createElement('div');
                        shiftElement.className = 'calendar-shift';
                        shiftElement.style.top = `${startPixels}px`;
                        shiftElement.style.height = `${heightPixels}px`;
                        
                        const timeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
                        const startTimeString = shiftStart.toLocaleTimeString('en-US', timeFormatOptions);
                        const endTimeString = shiftEnd.toLocaleTimeString('en-US', timeFormatOptions);

                        shiftElement.innerHTML = `
                            <strong>${shift.employee_name}</strong><br>
                            <span style="font-size: 0.9em;">${startTimeString} - ${endTimeString}</span><br>
                            <span style="color: #ddd;">${shift.location_name}</span>
                            <button class="delete-shift-btn" data-shift-id="${shift.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                            </button>
                        `;
                        shiftElement.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || 'None'}`;
                        
                        dayColumn.appendChild(shiftElement);
                    }
                });
            }
        } catch (error) {
            showModalMessage(`Error loading shifts: ${error.message}`, true);
        }
    }
    
    /**
     * Fetches employee availability from the API and renders it as background blocks on the calendar.
     * These blocks visually represent when employees are available to work.
     */
    async function loadAndRenderAvailability() {
        // Clear existing availability blocks
        document.querySelectorAll('.availability-block').forEach(el => el.remove());
        
        try {
            const employees = await apiRequest('GET', '/users/availability');
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

            employees.forEach(employee => {
                if (!employee.availability) return; // Skip if no availability data

                daysOfWeek.forEach((day, index) => {
                    const dayAvailability = employee.availability[day];
                    if (dayAvailability && dayAvailability.start && dayAvailability.end) {
                        const dayColumn = document.getElementById(`day-column-${index}`);
                        if(dayColumn) {
                            // Parse start and end hours
                            const startHour = parseInt(dayAvailability.start.split(':')[0], 10);
                            const endHour = parseInt(dayAvailability.end.split(':')[0], 10);
                            const duration = endHour - startHour;
                            
                            if (duration > 0) {
                                const availabilityBlock = document.createElement('div');
                                availabilityBlock.className = 'availability-block';
                                // FIX: Check if availabilityToggle exists before accessing its 'checked' property
                                if (availabilityToggle && !availabilityToggle.checked) {
                                    availabilityBlock.classList.add('hidden'); // Hide if toggle is off
                                }
                                availabilityBlock.style.top = `${startHour * 60}px`; // Convert hours to pixels (1 hour = 60px)
                                availabilityBlock.style.height = `${duration * 60}px`; // Convert duration to pixels
                                dayColumn.appendChild(availabilityBlock);
                            }
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Failed to load availability:", error);
            // Optionally show a modal message here if desired for user feedback
        }
    }

    /**
     * Populates the employee and location dropdowns in the shift creation form
     * by fetching data from the API.
     */
    async function populateDropdowns() {
        try {
            // Fetch users and locations concurrently
            const [users, locations] = await Promise.all([
                apiRequest('GET', '/users'),
                apiRequest('GET', '/locations')
            ]);
            
            // Populate employee select dropdown
            if (employeeSelect) {
                employeeSelect.innerHTML = '<option value="">Select Employee</option>'; // Default option
                const employees = users.filter(u => u.role === 'employee'); // Only show employees
                employees.forEach(user => {
                    const option = new Option(user.full_name, user.user_id);
                    employeeSelect.add(option);
                });
            }

            if (locationSelect) {
                locationSelect.innerHTML = '<option value="">Select Location</option>'; // Default option
                locations.forEach(loc => {
                    const option = new Option(loc.location_name, loc.location_id);
                    locationSelect.add(option);
                });
            }
        } catch (error) {
            showModalMessage('Failed to load data for form dropdowns.', true);
        }
    }

    // --- Event Handlers ---

    // Event listener for deleting shifts using event delegation on the calendar grid
    if (calendarGrid) {
        calendarGrid.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-shift-btn');
            if (deleteBtn) {
                e.stopPropagation(); // Prevent other clicks on the shift element
                const shiftId = deleteBtn.dataset.shiftId;
                const confirmed = await showConfirmModal('Are you sure you want to delete this shift?');
                if (confirmed) {
                    try {
                        await apiRequest('DELETE', `/shifts/${shiftId}`);
                        showModalMessage('Shift deleted successfully.', false);
                        renderCalendar(currentStartDate); // Re-render calendar to reflect changes
                    } catch (error) {
                        showModalMessage(`Error deleting shift: ${error.message}`, true);
                    }
                }
            }
        });
    }

    // Event listener for the auto-generate schedule button
    if (autoGenerateBtn) {
        autoGenerateBtn.addEventListener('click', async () => {
            const dailyHours = {};
            // Collect daily hours from the dynamically created inputs
            document.querySelectorAll('.daily-hours-input').forEach(input => {
                dailyHours[input.dataset.day] = input.value;
            });
            
            // Confirm with the user before proceeding
            const confirmed = await showConfirmModal(
                `This will attempt to generate a schedule based on the specified daily hours. Do you want to continue?`,
                'Generate'
            );

            if (confirmed) {
                try {
                    // Send request to backend for auto-generation
                    const response = await apiRequest('POST', '/shifts/auto-generate', { 
                        weekStartDate: currentStartDate.toISOString(), // Send as ISO string
                        dailyHours: dailyHours
                    });
                    showModalMessage(response.message || 'Schedule generation complete!', false);
                    await renderCalendar(currentStartDate); // Re-render calendar after generation
                } catch (error) {
                    showModalMessage(`Auto-scheduling failed: ${error.message}`, true);
                }
            }
        });
    }

    // Event listener for the "Show Employee Availability" toggle
    if (availabilityToggle) {
        availabilityToggle.addEventListener('change', () => {
            const blocks = document.querySelectorAll('.availability-block');
            blocks.forEach(block => {
                block.classList.toggle('hidden', !availabilityToggle.checked); // Toggle 'hidden' class
            });
        });
    }
    
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentStartDate.setDate(currentStartDate.getDate() - 7); // Go back one week
            renderCalendar(currentStartDate);
        });
    }

    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            currentStartDate.setDate(currentStartDate.getDate() + 7); // Go forward one week
            renderCalendar(currentStartDate);
        });
    }
    
    // Event listener for the "Create New Shift" form submission
    if (createShiftForm) {
        createShiftForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Collect shift data from form inputs
            const shiftData = {
                employee_id: document.getElementById('employee-select').value,
                location_id: document.getElementById('location-select').value,
                start_time: document.getElementById('start-time-input').value,
                end_time: document.getElementById('end-time-input').value,
                notes: document.getElementById('notes-input').value
            };

            // Basic validation
            if (!shiftData.employee_id || !shiftData.location_id || !shiftData.start_time || !shiftData.end_time) {
                showModalMessage('Please fill all required fields.', true);
                return;
            }

            try {
                await apiRequest('POST', '/shifts', shiftData);
                showModalMessage('Shift created successfully!', false);
                createShiftForm.reset(); // Clear the form
                renderCalendar(currentStartDate); // Re-render calendar to show new shift
            } catch (error) {
                showModalMessage(`Error creating shift: ${error.message}`, true);
            }
        });
    }
    
    // --- Initial Page Load ---
    // These functions are called when the page loads to set up the UI
    createDailyHoursInputs(); // Populate the daily hours inputs
    renderCalendar(currentStartDate); // Render the calendar for the current week
    populateDropdowns(); // Fill employee and location dropdowns
}
