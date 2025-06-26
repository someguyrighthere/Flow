// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleSchedulingPage() {
    // Redirect to login page if no authentication token is found in local storage
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // Get references to key DOM elements for the scheduling page
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

    // Initialize currentStartDate to the beginning of the current week (Sunday)
    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);

    /**
     * Dynamically creates input fields for setting target daily hours for each day of the week.
     * These inputs are used in the auto-scheduling feature.
     */
    function createDailyHoursInputs() {
        if (!dailyHoursContainer) return; // Exit if the container element is not found
        dailyHoursContainer.innerHTML = ''; // Clear existing content
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach(day => {
            const dayId = day.toLowerCase(); // Create a lowercase ID for each day
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
     * Renders the calendar grid for a given week.
     * This involves creating the day headers, time column, and individual day columns.
     * It also triggers fetching and displaying shifts and employee availability for the week.
     * @param {Date} startDate - The Date object representing the first day (Sunday) of the week to render.
     */
    async function renderCalendar(startDate) {
        if (!calendarGrid || !currentWeekDisplay) return; // Exit if essential elements are missing
        
        // Calculate the end date for the current week (6 days after the start date)
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        // Format options for displaying the date range
        const options = { month: 'short', day: 'numeric' };
        // Update the display to show the current week's date range (e.g., "Jun 22 - Jun 28")
        currentWeekDisplay.textContent = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
        
        calendarGrid.innerHTML = ''; // Clear any existing content in the calendar grid

        // Create the header row container for day names
        const headerContainer = document.createElement('div');
        headerContainer.className = 'calendar-grid-header'; // Apply CSS class for grid header styling
        calendarGrid.appendChild(headerContainer); // Append to the main calendar grid element

        // Create an empty cell in the top-left corner of the header (for alignment with time column)
        const timeHeader = document.createElement('div');
        timeHeader.className = 'calendar-day-header';
        timeHeader.innerHTML = `&nbsp;`; // Use a non-breaking space for an empty but styled cell
        headerContainer.appendChild(timeHeader);

        // Create individual day headers (e.g., "Sun 23", "Mon 24")
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + i); // Increment date for each day of the week
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = dayDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            headerContainer.appendChild(dayHeader);
        }

        // Create the main body container for time column and daily shift columns
        const calendarBody = document.createElement('div');
        calendarBody.className = 'calendar-body'; // Apply CSS class for calendar body styling
        calendarGrid.appendChild(calendarBody); // Append to the main calendar grid element

        // Create the time column (vertical list of hours: 12 AM, 1 AM, etc.)
        const timeColumn = document.createElement('div');
        timeColumn.className = 'time-column'; // Apply CSS class for time column styling
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot'; // Apply CSS class for individual time slots
            const displayHour = hour % 12 === 0 ? 12 : hour % 12; // Convert 24-hour to 12-hour format
            const ampm = hour < 12 ? 'AM' : 'PM'; // Determine AM/PM
            timeSlot.textContent = `${displayHour} ${ampm}`;
            timeColumn.appendChild(timeSlot);
        }
        calendarBody.appendChild(timeColumn); // Append time column to the calendar body

        // Create individual day columns where shifts and availability blocks will be rendered
        for (let i = 0; i < 7; i++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column'; // Apply CSS class for day column styling
            dayColumn.id = `day-column-${i}`; // Assign a unique ID (0 for Sunday, 6 for Saturday)
            // Create 24 hour lines within each day column for visual separation
            for (let j = 0; j < 24; j++) {
                const hourLine = document.createElement('div');
                hourLine.className = 'hour-line';
                dayColumn.appendChild(hourLine);
            }
            calendarBody.appendChild(dayColumn); // Append day column to the calendar body
        }

        // Concurrently load and display shifts, employee availability, and business operating hours
        await Promise.all([
            loadAndDisplayShifts(startDate, endDate),
            loadAndRenderAvailability(),
            loadAndRenderBusinessHours() // NEW: Call to render business hours
        ]);
    }

    /**
     * Fetches shift data from the backend API and renders each shift as a visual block
     * on the calendar grid in its corresponding day and time slot.
     * @param {Date} start - The start date for fetching shifts.
     * @param {Date} end - The end date for fetching shifts.
     */
    async function loadAndDisplayShifts(start, end) {
        // Remove all existing shift elements from the DOM before rendering new ones
        document.querySelectorAll('.calendar-shift').forEach(el => el.remove());
        
        // Helper function to format a Date object to "YYYY-MM-DD" string
        const formatDate = (d) => d.toISOString().split('T')[0];
        
        // Adjust end date to fetch shifts up to the end of the last day in the week
        let endOfDay = new Date(end);
        endOfDay.setDate(endOfDay.getDate() + 1); // Go to the next day's start to include current end day's shifts

        try {
            // Fetch shifts from the API for the specified date range
            const shifts = await apiRequest('GET', `/shifts?startDate=${formatDate(start)}&endDate=${formatDate(endOfDay)}`);
            
            // If shifts are returned, iterate and create elements for each
            if (shifts && shifts.length > 0) {
                shifts.forEach(shift => {
                    const shiftStart = new Date(shift.start_time);
                    const shiftEnd = new Date(shift.end_time);
                    
                    // Determine which day column the shift belongs to (0=Sunday, 6=Saturday)
                    const dayIndex = shiftStart.getDay();
                    const dayColumn = document.getElementById(`day-column-${dayIndex}`);

                    if (dayColumn) {
                        // Calculate the top position and height of the shift element in pixels
                        // (assuming 1 minute = 1 pixel for positioning within a 60px/hour slot)
                        const startMinutes = (shiftStart.getHours() * 60) + shiftStart.getMinutes();
                        const endMinutes = (shiftEnd.getHours() * 60) + shiftEnd.getMinutes();
                        const heightMinutes = endMinutes - startMinutes;
                        
                        const shiftElement = document.createElement('div');
                        shiftElement.className = 'calendar-shift'; // Apply CSS class for shift styling
                        shiftElement.style.top = `${startMinutes}px`; // Set vertical position
                        shiftElement.style.height = `${heightMinutes}px`; // Set height based on duration
                        
                        // Format start and end times for display within the shift element
                        const timeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
                        const startTimeString = shiftStart.toLocaleTimeString('en-US', timeFormatOptions);
                        const endTimeString = shiftEnd.toLocaleTimeString('en-US', timeFormatOptions);

                        // Populate the shift element with shift details and a delete button
                        shiftElement.innerHTML = `
                            <strong>${shift.employee_name}</strong><br>
                            <span style="font-size: 0.9em;">${startTimeString} - ${endTimeString}</span><br>
                            <span style="color: #ddd;">${shift.location_name || ''}</span>
                            <button class="delete-shift-btn" data-shift-id="${shift.id}" title="Delete Shift">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                            </button>
                        `;
                        // Add a title attribute for tooltip on hover
                        shiftElement.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || 'None'}`;
                        
                        dayColumn.appendChild(shiftElement); // Append the shift element to its day column
                    }
                });
            }
        }
        catch (error) {
            // Display an error message if shifts fail to load
            showModalMessage(`Error loading shifts: ${error.message}`, true);
        }
    }
    
    /**
     * Fetches employee availability data and renders it as semi-transparent overlay blocks
     * on the calendar, indicating when employees are available to work.
     */
    async function loadAndRenderAvailability() {
        // Remove all existing availability blocks from the DOM
        document.querySelectorAll('.availability-block').forEach(el => el.remove());
        
        try {
            // Fetch employee availability from the API
            const employees = await apiRequest('GET', '/users/availability');
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

            employees.forEach(employee => {
                if (!employee.availability) return; // Skip employees without availability data

                daysOfWeek.forEach((day, index) => {
                    const dayAvailability = employee.availability[day];
                    // Check if availability data exists for the current day and has start/end times
                    if (dayAvailability && dayAvailability.start && dayAvailability.end) {
                        const dayColumn = document.getElementById(`day-column-${index}`);
                        if(dayColumn) {
                            // Parse start and end hours from "HH:MM" format
                            const startHour = parseInt(dayAvailability.start.split(':')[0], 10);
                            const endHour = parseInt(dayAvailability.end.split(':')[0], 10);
                            const duration = endHour - startHour; // Calculate duration in hours
                            
                            if (duration > 0) {
                                const availabilityBlock = document.createElement('div');
                                availabilityBlock.className = 'availability-block'; // Apply CSS class
                                // Hide the block if the availability toggle switch is unchecked
                                if (availabilityToggle && !availabilityToggle.checked) {
                                    availabilityBlock.classList.add('hidden');
                                }
                                // Set vertical position and height based on availability times
                                availabilityBlock.style.top = `${startHour * 60}px`; // Convert hours to pixels
                                availabilityBlock.style.height = `${duration * 60}px`;
                                dayColumn.appendChild(availabilityBlock); // Append to the respective day column
                            }
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Failed to load availability:", error);
            // Optionally, show a modal message to the user:
            // showModalMessage(`Error loading availability: ${error.message}`, true);
        }
    }

    /**
     * NEW FUNCTION: Fetches and renders the business operating hours as a subtle background.
     */
    async function loadAndRenderBusinessHours() {
        // Remove any existing business hours blocks from the DOM
        document.querySelectorAll('.business-hours-block').forEach(el => el.remove());

        try {
            const settings = await apiRequest('GET', '/settings/business');
            // Ensure settings.operating_hours_start is not null before splitting
            // If settings.operating_hours_start is null, default to '00:00' to prevent errors.
            const businessStartHour = parseInt((settings.operating_hours_start || '00:00').split(':')[0], 10);
            const businessEndHour = parseInt((settings.operating_hours_end || '00:00').split(':')[0], 10);
            const durationHours = businessEndHour - businessStartHour;

            if (durationHours > 0) {
                // For each day column, create a business hours block
                for (let i = 0; i < 7; i++) {
                    const dayColumn = document.getElementById(`day-column-${i}`);
                    if (dayColumn) {
                        const businessHoursBlock = document.createElement('div');
                        businessHoursBlock.className = 'business-hours-block'; // New CSS class for styling
                        businessHoursBlock.style.top = `${businessStartHour * 60}px`; // Position from top
                        businessHoursBlock.style.height = `${durationHours * 60}px`; // Height based on duration
                        dayColumn.appendChild(businessHoursBlock);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load or render business operating hours:", error);
        }
    }

    /**
     * Populates the employee and location dropdowns in the shift creation form
     * by fetching user and location data from the API.
     */
    async function populateDropdowns() {
        try {
            // Fetch users and locations concurrently
            const [users, locations] = await Promise.all([
                apiRequest('GET', '/users'),
                apiRequest('GET', '/locations')
            ]);
            
            if (employeeSelect) {
                employeeSelect.innerHTML = '<option value="">Select Employee</option>'; // Default option
                const employees = users.filter(u => u.role === 'employee'); // Filter for employees only
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

    /**
     * Completely re-implemented delete shift functionality.
     * Handles click events on the calendar grid via event delegation.
     * When a delete button is clicked, it extracts the shift ID,
     * prompts for confirmation, calls the delete API, and re-renders the calendar.
     */
    if (calendarGrid) {
        calendarGrid.addEventListener('click', async (e) => {
            // Log the element that was actually clicked
            // console.log("Calendar grid clicked on:", e.target); 
            // Find the closest parent element with the class 'delete-shift-btn' starting from the clicked target
            const deleteButton = e.target.closest('.delete-shift-btn');
            // console.log("Delete button found by closest():", deleteButton); // Log what closest() found

            if (deleteButton) {
                e.stopPropagation(); // Prevent the click event from bubbling up to parent elements
                const shiftIdToDelete = String(deleteButton.dataset.shiftId); // Get the shift ID from the data attribute

                // Basic validation for shift ID
                if (!shiftIdToDelete || shiftIdToDelete === "undefined" || shiftIdToDelete === "null") {
                    showModalMessage('Shift ID not found. Cannot delete.', true);
                    return;
                }
                
                // Show confirmation modal to the user
                const isConfirmed = await showConfirmModal('Are you sure you want to delete this shift? This action cannot be undone.');
                // console.log("Confirmation modal resolved with:", isConfirmed); // DEBUG: Log confirmed value
                
                if (isConfirmed) {
                    try {
                        // Call the API to delete the shift
                        await apiRequest('DELETE', `/shifts/${shiftIdToDelete}`);
                        showModalMessage('Shift deleted successfully!', false); // Show success message
                        renderCalendar(currentStartDate); // Re-render the calendar to show the updated shifts
                    } catch (error) {
                        // Display an error message if the API call fails
                        showModalMessage(`Error deleting shift: ${error.message}`, true);
                    }
                } else {
                    // User cancelled the deletion
                    showModalMessage('Shift deletion cancelled.', false);
                }
            }
        });
    }

    /**
     * Handles the click event for the "Auto-Generate Schedule" button.
     * Collects daily hour targets and sends a request to the backend to generate shifts.
     */
    if (autoGenerateBtn) {
        autoGenerateBtn.addEventListener('click', async () => {
            const dailyHours = {};
            // Collect the target daily hours for each day from the input fields
            document.querySelectorAll('.daily-hours-input').forEach(input => {
                dailyHours[input.dataset.day] = input.value;
            });
            
            // Show a confirmation modal for auto-scheduling
            const confirmed = await showConfirmModal(
                `This will attempt to generate a schedule based on the specified daily hours. Do you want to continue?`,
                'Generate'
            );

            if (confirmed) {
                try {
                    const response = await apiRequest('POST', '/shifts/auto-generate', { 
                        weekStartDate: currentStartDate.toISOString(), // Pass the current week's start date
                        dailyHours: dailyHours // Pass the target daily hours
                    });
                    showModalMessage(response.message || 'Schedule generation complete!', false);
                    await renderCalendar(currentStartDate); // Re-render calendar to show newly generated shifts
                } catch (error) {
                    showModalMessage(`Auto-scheduling failed: ${error.message}`, true);
                }
            }
        });
    }

    /**
     * Handles the change event for the availability toggle switch.
     * Toggles the visibility of availability blocks on the calendar.
     */
    if (availabilityToggle) {
        availabilityToggle.addEventListener('change', () => {
            const blocks = document.querySelectorAll('.availability-block');
            blocks.forEach(block => {
                // Toggle the 'hidden' CSS class based on whether the checkbox is checked
                block.classList.toggle('hidden', !availabilityToggle.checked);
            });
        });
    }
    
    /**
     * Handles the click event for the "Previous Week" button.
     * Decrements the current week's start date by 7 days and re-renders the calendar.
     */
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentStartDate.setDate(currentStartDate.getDate() - 7); // Move back one week
            renderCalendar(currentStartDate); // Re-render calendar for the new week
        });
    }

    /**
     * Handles the click event for the "Next Week" button.
     * Increments the current week's start date by 7 days and re-renders the calendar.
     */
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => { 
            currentStartDate.setDate(currentStartDate.getDate() + 7); // Move forward one week
            renderCalendar(currentStartDate); // Re-render calendar for the new week
        });
    } 
    
    /**
     * Handles the submission of the "Create New Shift" form.
     * Collects shift data from form inputs, validates it, and sends it to the backend API.
     */
    if (createShiftForm) {
        createShiftForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission behavior (page reload)
            // Get raw datetime-local values
            const rawStartTime = document.getElementById('start-time-input').value;
            const rawEndTime = document.getElementById('end-time-input').value;

            // FIX: Convert raw datetime-local string to Date objects then to ISO strings
            // This handles local timezone interpretation and sends clear UTC to TIMESTAMPTZ
            const shiftData = {
                employee_id: document.getElementById('employee-select').value,
                location_id: document.getElementById('location-select').value,
                start_time: new Date(rawStartTime).toISOString(), // Convert local input to ISO UTC
                end_time: new Date(rawEndTime).toISOString(),     // Convert local input to ISO UTC
                notes: document.getElementById('notes-input').value
            };

            // Client-side validation: Check if required fields are filled
            if (!shiftData.employee_id || !shiftData.location_id || !rawStartTime || !rawEndTime) { // Check raw inputs for emptiness
                showModalMessage('Please fill all required fields.', true);
                return;
            }

            // DEBUG: Log the ISO strings being sent
            console.log("Client sending start_time (ISO):", shiftData.start_time);
            console.log("Client sending end_time (ISO):", shiftData.end_time);

            try {
                // Send a POST request to create the new shift
                await apiRequest('POST', '/shifts', shiftData);
                showModalMessage('Shift created successfully!', false); // Show success message
                createShiftForm.reset(); // Clear the form fields
                renderCalendar(currentStartDate); // Re-render the calendar to display the new shift
            } catch (error) {
                // Display an error message if shift creation fails
                showModalMessage(`Error creating shift: ${error.message}`, true);
            }
        });
    }
    
    // --- Initial Page Load Actions ---
    // These functions are called when the page loads to set up the UI
    createDailyHoursInputs(); // Populate the daily hours input fields
    renderCalendar(currentStartDate); // Render the calendar for the initial week
    populateDropdowns(); // Populate the employee and location dropdowns
}
