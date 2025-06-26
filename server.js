// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleSchedulingPage() {
    // Security check: Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Element Selection ---
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

    // Initialize currentStartDate to the Sunday of the current week
    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay()); // Set to Sunday
    currentStartDate.setHours(0, 0, 0, 0); // Normalize to start of the day

    /**
     * Dynamically creates input fields for daily operating hours in the sidebar.
     * These inputs allow admins to specify the total hours to be scheduled for each day
     * when using the auto-generate schedule feature.
     */
    function createDailyHoursInputs() {
        console.log("createDailyHoursInputs: Starting to create daily hours inputs.");
        if (!dailyHoursContainer) {
            console.warn("createDailyHoursInputs: dailyHoursContainer not found. Skipping daily hours input creation.");
            return; 
        }
        dailyHoursContainer.innerHTML = ''; // Clear previous inputs
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach(day => {
            const dayId = day.toLowerCase(); // e.g., 'sunday', 'monday'
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            formGroup.innerHTML = `
                <label for="hours-${dayId}">${day}</label>
                <input type="number" id="hours-${dayId}" class="daily-hours-input" min="0" value="8" step="1" data-day="${dayId}">
            `;
            dailyHoursContainer.appendChild(formGroup);
        });
        console.log("createDailyHoursInputs: Finished creating daily hours inputs.");
    }

    /**
     * Renders the calendar grid for the specified week.
     * This function is responsible for dynamically generating all the HTML elements
     * that make up the calendar's visual structure (headers, time slots, day columns).
     * It then triggers loading of shifts and availability.
     * @param {Date} startDate - The starting date of the week to render (always a Sunday).
     */
    async function renderCalendar(startDate) {
        console.log("renderCalendar: Starting calendar rendering for date:", startDate.toDateString());
        if (!calendarGrid || !currentWeekDisplay) {
            console.error("renderCalendar: Required DOM elements (calendarGrid or currentWeekDisplay) not found.");
            return;
        }
        
        // Calculate the end date for the week display in the header
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6); // End of the week (Saturday)
        const options = { month: 'short', day: 'numeric' };
        currentWeekDisplay.textContent = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
        
        calendarGrid.innerHTML = ''; // Clear existing calendar content before re-rendering
        console.log("renderCalendar: Calendar grid cleared for new rendering.");

        // Create the top-left corner header cell (empty)
        const cornerHeader = document.createElement('div');
        cornerHeader.className = 'calendar-corner-header';
        cornerHeader.innerHTML = `&nbsp;`; // Non-breaking space for visual spacing
        cornerHeader.style.gridColumn = '1 / 2'; // Position in the first column
        cornerHeader.style.gridRow = '1 / 2';    // Position in the first row
        calendarGrid.appendChild(cornerHeader);
        console.log("renderCalendar: Corner header added.");

        // Add day headers (Mon, Tue, Wed, etc.) across the top row
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + i); // Increment date for each day of the week
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = dayDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            // Assign header to the first row and its respective column (columns 2 through 8)
            dayHeader.style.gridColumn = `${i + 2} / span 1`; 
            dayHeader.style.gridRow = '1 / 2';
            calendarGrid.appendChild(dayHeader); 
        }
        console.log("renderCalendar: Day headers added.");

        // Create time slots (12 AM, 1 AM, ..., 11 PM) down the first column
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            const displayHour = hour % 12 === 0 ? 12 : hour % 12; // Convert to 12-hour format (12-hour, not 0-23)
            const ampm = hour < 12 ? 'AM' : 'PM';
            timeSlot.textContent = `${displayHour} ${ampm}`;
            // Position each time slot in its specific row (rows 2 through 25) in the first column
            timeSlot.style.gridRow = `${hour + 2} / span 1`; 
            timeSlot.style.gridColumn = '1 / 2'; 
            calendarGrid.appendChild(timeSlot);
        }
        console.log("renderCalendar: Time slots added.");

        // Create individual day columns, which will span all 24 hourly rows
        for (let i = 0; i < 7; i++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            dayColumn.id = `day-column-${i}`; // Assign unique ID for referencing by shifts/availability
            // Position each day column to span from row 2 to the end, in its respective column
            dayColumn.style.gridColumn = `${i + 2} / span 1`; 
            dayColumn.style.gridRow = '2 / -1'; 
            calendarGrid.appendChild(dayColumn);
        }
        console.log("renderCalendar: Day columns (containers) added.");

        // Concurrently load and display shifts and employee availability for efficiency
        try {
            await Promise.all([
                loadAndDisplayShifts(startDate, endDate),
                loadAndRenderAvailability()
            ]);
            console.log("renderCalendar: Shifts and availability loaded successfully.");
        } catch (error) {
            console.error("renderCalendar: Error during concurrent loading of shifts or availability:", error);
            showModalMessage(`Failed to load calendar data: ${error.message}`, true);
        }
        console.log("renderCalendar: Calendar rendering and data loading finished.");
    }

    /**
     * Fetches shifts from the API for the current week and displays them on the calendar.
     * Shifts are positioned absolutely within their respective day columns based on start and end times,
     * converting time to pixels for accurate vertical placement.
     * @param {Date} start - The start date for fetching shifts.
     * @param {Date} end - The end date for fetching shifts.
     */
    async function loadAndDisplayShifts(start, end) {
        console.log("loadAndDisplayShifts: Fetching shifts for:", start.toDateString(), "-", end.toDateString());
        // Remove any previously rendered shifts to prevent duplicates before loading new ones
        document.querySelectorAll('.calendar-shift').forEach(el => el.remove());

        // Format dates for API request (YYYY-MM-DD)
        const formatDate = (d) => d.toISOString().split('T')[0];
        // Adjust end date to include the entire last day for filtering on the backend
        let endOfRange = new Date(end);
        endOfRange.setDate(endOfRange.getDate() + 1); // Get all shifts up to the beginning of the next day
        
        try {
            const shifts = await apiRequest('GET', `/shifts?startDate=${formatDate(start)}&endDate=${formatDate(endOfRange)}`);
            console.log("loadAndDisplayShifts: Received shifts:", shifts);

            if (shifts && shifts.length > 0) {
                shifts.forEach(shift => {
                    const shiftStart = new Date(shift.start_time);
                    const shiftEnd = new Date(shift.end_time);
                    
                    const dayIndex = shiftStart.getDay(); // Get day of week (0=Sunday, 6=Saturday)
                    const dayColumn = document.getElementById(`day-column-${dayIndex}`);

                    // Only render if the corresponding day column exists
                    if (dayColumn) {
                        // Calculate pixel positioning for the shift within its day column
                        const startMinutes = (shiftStart.getHours() * 60) + shiftStart.getMinutes();
                        const endMinutes = (shiftEnd.getHours() * 60) + shiftEnd.getMinutes();
                        const heightMinutes = endMinutes - startMinutes;
                        
                        const shiftElement = document.createElement('div');
                        shiftElement.className = 'calendar-shift';
                        shiftElement.style.top = `${startMinutes}px`; // Position from top of the day column (0px = 12 AM)
                        shiftElement.style.height = `${heightMinutes}px`; // Height based on duration
                        
                        // Format times for display within the shift element
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
                        // Add a title for hover information
                        shiftElement.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || 'None'}`;
                        
                        dayColumn.appendChild(shiftElement);
                    }
                });
            } else {
                console.log("loadAndDisplayShifts: No shifts found for the current week.");
            }
        } catch (error) {
            console.error("loadAndDisplayShifts: Error fetching shifts:", error);
            showModalMessage(`Error loading shifts: ${error.message}`, true);
            throw error; // Re-throw the error to be caught by the parent renderCalendar's try-catch
        }
    }
    
    /**
     * Fetches employee availability from the API and renders it as background blocks on the calendar.
     * These blocks visually represent when employees are available to work.
     * Availability is typically stored as JSONB in the users table, with start/end times per day.
     */
    async function loadAndRenderAvailability() {
        console.log("loadAndRenderAvailability: Fetching employee availability.");
        // Remove any previously rendered availability blocks
        document.querySelectorAll('.availability-block').forEach(el => el.remove());
        
        try {
            const employees = await apiRequest('GET', '/users/availability');
            console.log("loadAndRenderAvailability: Received employees availability:", employees);
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

            employees.forEach(employee => {
                // Ensure employee has availability data before proceeding
                if (!employee.availability) return; 

                daysOfWeek.forEach((day, index) => {
                    const dayAvailability = employee.availability[day];
                    // Check if availability data exists for the current day and has valid start/end times
                    if (dayAvailability && dayAvailability.start && dayAvailability.end) {
                        const dayColumn = document.getElementById(`day-column-${index}`);
                        if(dayColumn) {
                            // Parse start and end times into total minutes from midnight for pixel calculation
                            const startHour = parseInt(dayAvailability.start.split(':')[0], 10);
                            const startMinute = parseInt(dayAvailability.start.split(':')[1], 10) || 0;
                            const endHour = parseInt(dayAvailability.end.split(':')[0], 10);
                            const endMinute = parseInt(dayAvailability.end.split(':')[1], 10) || 0;
                            
                            const startPixels = (startHour * 60) + startMinute;
                            const endPixels = (endHour * 60) + endMinute;
                            const heightPixels = endPixels - startPixels;
                            
                            // Only render if there's a positive duration for availability
                            if (heightPixels > 0) {
                                const availabilityBlock = document.createElement('div');
                                availabilityBlock.className = 'availability-block';
                                // Hide availability block if the toggle is unchecked (defensive check for availabilityToggle)
                                if (availabilityToggle && !availabilityToggle.checked) {
                                    availabilityBlock.classList.add('hidden'); 
                                }
                                availabilityBlock.style.top = `${startPixels}px`; 
                                availabilityBlock.style.height = `${heightPixels}px`; 
                                dayColumn.appendChild(availabilityBlock);
                            }
                        }
                    }
                });
            });
        } catch (error) {
            console.error("loadAndRenderAvailability: Error fetching availability:", error);
            showModalMessage(`Error loading availability: ${error.message}`, true);
            throw error; // Re-throw the error to be caught by the parent renderCalendar's try-catch
        }
    }

    /**
     * Populates the employee and location dropdowns in the shift creation form
     * by fetching data from the API.
     */
    async function populateDropdowns() {
        console.log("populateDropdowns: Starting to populate dropdowns.");
        try {
            // Fetch users and locations concurrently for efficiency
            const [users, locations] = await Promise.all([
                apiRequest('GET', '/users'),
                apiRequest('GET', '/locations')
            ]);
            console.log("populateDropdowns: Received users and locations:", { users, locations });
            
            // Populate employee select dropdown
            if (employeeSelect) {
                employeeSelect.innerHTML = '<option value="">Select Employee</option>'; // Default initial option
                // Filter for 'employee' role users only
                const employees = users.filter(u => u.role === 'employee'); 
                employees.forEach(user => {
                    const option = new Option(user.full_name, user.user_id);
                    employeeSelect.add(option);
                });
            }

            // Populate location select dropdown
            if (locationSelect) {
                locationSelect.innerHTML = '<option value="">Select Location</option>'; // Default initial option
                locations.forEach(loc => {
                    const option = new Option(loc.location_name, loc.location_id);
                    locationSelect.add(option);
                });
            }
            console.log("populateDropdowns: Dropdowns populated successfully.");
        } catch (error) {
            console.error("populateDropdowns: Failed to load data for form dropdowns:", error);
            showModalMessage('Failed to load data for form dropdowns.', true);
        }
    }

    // --- Event Handlers ---

    // Event listener for deleting shifts using event delegation on the calendar grid
    if (calendarGrid) {
        calendarGrid.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-shift-btn');
            if (deleteBtn) {
                e.stopPropagation(); // Prevent other click events on the shift element
                const shiftId = deleteBtn.dataset.shiftId; // Get the ID of the shift to delete
                const confirmed = await showConfirmModal('Are you sure you want to delete this shift?');
                if (confirmed) {
                    try {
                        await apiRequest('DELETE', `/shifts/${shiftId}`);
                        showModalMessage('Shift deleted successfully!', false);
                        renderCalendar(currentStartDate); // Re-render calendar to reflect the deletion
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
            // Collect daily hours input from the dynamically created fields
            document.querySelectorAll('.daily-hours-input').forEach(input => {
                dailyHours[input.dataset.day] = input.value;
            });
            
            const confirmed = await showConfirmModal(
                `This will attempt to generate a schedule based on the specified daily hours. Do you want to continue?`,
                'Generate'
            );

            if (confirmed) {
                try {
                    // Send request to backend for auto-generation
                    const response = await apiRequest('POST', '/shifts/auto-generate', { 
                        weekStartDate: currentStartDate.toISOString(), // Send current week's start date
                        dailyHours: dailyHours // Send the configured daily hours
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
                // Toggle the 'hidden' class based on the checkbox's checked state
                block.classList.toggle('hidden', !availabilityToggle.checked);
            });
        });
    }
    
    // Event listener for the "Previous Week" button
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentStartDate.setDate(currentStartDate.getDate() - 7); // Subtract 7 days to go to previous week
            renderCalendar(currentStartDate); // Re-render calendar with new start date
        });
    }

    // Event listener for the "Next Week" button
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => { 
            currentStartDate.setDate(currentStartDate.getDate() + 7); // Add 7 days to go to next week
            renderCalendar(currentStartDate); // Re-render calendar with new start date
        });
    }
    
    // Event listener for the "Create New Shift" form submission
    if (createShiftForm) {
        createShiftForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission
            // Collect shift data from form inputs
            const shiftData = {
                employee_id: document.getElementById('employee-select').value,
                location_id: document.getElementById('location-select').value,
                start_time: document.getElementById('start-time-input').value,
                end_time: document.getElementById('end-time-input').value,
                notes: document.getElementById('notes-input').value
            };

            // Basic client-side validation
            if (!shiftData.employee_id || !shiftData.location_id || !shiftData.start_time || !shiftData.end_time) {
                showModalMessage('Please fill all required fields.', true);
                return;
            }

            try {
                await apiRequest('POST', '/shifts', shiftData);
                showModalMessage('Shift created successfully!', false);
                createShiftForm.reset(); // Clear the form fields
                renderCalendar(currentStartDate); // Re-render calendar to show the newly created shift
            } catch (error) {
                showModalMessage(`Error creating shift: ${error.message}`, true);
            }
        });
    }
    
    // --- Initial Page Load ---
    console.log("handleSchedulingPage: Initializing page components and rendering calendar.");
    createDailyHoursInputs(); // Populate the daily hours inputs in the sidebar
    renderCalendar(currentStartDate); // Render the calendar for the current week
    populateDropdowns(); // Fill employee and location dropdowns in the shift creation form
}
