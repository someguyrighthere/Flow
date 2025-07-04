// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the scheduling page.
 */
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
    // Removed: dailyHoursInputsDiv, autoGenerateScheduleBtn, autoScheduleStatusMessage

    // Initialize currentStartDate to the beginning of the current week (Sunday)
    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0); // Set to midnight for consistent date comparison

    // Removed: dailyTargetHours state variable
    // Removed: displayAutoScheduleStatus helper function

    /**
     * Renders the calendar grid for a given week.
     * @param {Date} startDate - The Date object representing the first day (Sunday) of the week to render.
     */
    async function renderCalendar(startDate) {
        if (!calendarGrid || !currentWeekDisplay) return;
        
        // Calculate end date for the week display
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        const options = { month: 'short', day: 'numeric' };
        currentWeekDisplay.textContent = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
        
        calendarGrid.innerHTML = ''; // Clear existing calendar content

        // Create calendar header (Time column + 7 days)
        const headerContainer = document.createElement('div');
        headerContainer.className = 'calendar-grid-header';
        calendarGrid.appendChild(headerContainer);

        const timeHeader = document.createElement('div');
        timeHeader.className = 'calendar-day-header';
        timeHeader.innerHTML = `&nbsp;`; // Empty cell for time column header
        headerContainer.appendChild(timeHeader);

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + i);
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = dayDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            headerContainer.appendChild(dayHeader);
        }

        // Create calendar body (Time column + 7 day columns with hour lines)
        const calendarBody = document.createElement('div');
        calendarBody.className = 'calendar-body';
        calendarGrid.appendChild(calendarBody);

        const timeColumn = document.createElement('div');
        timeColumn.className = 'time-column';
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour < 12 ? 'AM' : 'PM';
            timeSlot.textContent = `${displayHour} ${ampm}`;
            timeColumn.appendChild(timeSlot);
        }
        calendarBody.appendChild(timeColumn);

        for (let i = 0; i < 7; i++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            dayColumn.id = `day-column-${i}`; // Assign ID for easy access
            for (let j = 0; j < 24; j++) {
                const hourLine = document.createElement('div');
                hourLine.className = 'hour-line';
                dayColumn.appendChild(hourLine);
            }
            calendarBody.appendChild(dayColumn);
        }

        // Load and display data (shifts, availability, business hours) concurrently
        await Promise.all([
            loadAndDisplayShifts(startDate, endDate),
            loadAndRenderAvailability(),
            loadAndRenderBusinessHours()
        ]);
    }

    /**
     * Fetches shift data from the backend API for the current week and renders each shift as a visual block.
     * @param {Date} start - The start date for fetching shifts (beginning of the week).
     * @param {Date} end - The end date for fetching shifts (end of the week).
     */
    async function loadAndDisplayShifts(start, end) {
        // Remove existing shifts before rendering new ones
        document.querySelectorAll('.calendar-shift').forEach(el => el.remove());
        
        // Format dates for API request (YYYY-MM-DD)
        const formatDate = (d) => d.toISOString().split('T')[0];
        
        // Adjust end date to include the full last day for the API query
        let endOfDay = new Date(end);
        endOfDay.setDate(endOfDay.getDate() + 1); // Go to the start of the next day

        try {
            const shifts = await apiRequest('GET', `/api/shifts?startDate=${formatDate(start)}&endDate=${formatDate(endOfDay)}`);
            
            if (shifts && shifts.length > 0) {
                shifts.forEach(shift => {
                    const shiftStart = new Date(shift.start_time);
                    const shiftEnd = new Date(shift.end_time);
                    
                    const dayIndex = shiftStart.getDay(); // 0 for Sunday, 1 for Monday, etc.
                    const dayColumn = document.getElementById(`day-column-${dayIndex}`);

                    if (dayColumn) {
                        // Calculate top and height for the shift block in pixels (1 minute = 1 pixel)
                        const startMinutes = (shiftStart.getHours() * 60) + shiftStart.getMinutes();
                        const endMinutes = (shiftEnd.getHours() * 60) + shiftEnd.getMinutes();
                        const heightMinutes = endMinutes - startMinutes;
                        
                        const shiftElement = document.createElement('div');
                        shiftElement.className = 'calendar-shift';
                        shiftElement.style.top = `${startMinutes}px`;
                        shiftElement.style.height = `${heightMinutes}px`;
                        
                        const timeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
                        const startTimeString = shiftStart.toLocaleTimeString('en-US', timeFormatOptions);
                        const endTimeString = shiftEnd.toLocaleTimeString('en-US', timeFormatOptions);

                        shiftElement.innerHTML = `
                            <strong>${shift.employee_name}</strong><br>
                            <span style="font-size: 0.9em;">${startTimeString} - ${endTimeString}</span><br>
                            <span style="color: #ddd;">${shift.location_name || ''}</span>
                            <button class="delete-shift-btn" data-shift-id="${shift.id}" title="Delete Shift">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                            </button>
                        `;
                        shiftElement.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || 'None'}`;
                        
                        dayColumn.appendChild(shiftElement);
                    }
                });
            }
        }
        catch (error) {
            showModalMessage(`Error loading shifts: ${error.message}`, true);
            console.error('Error loading shifts:', error);
        }
    }
    
    /**
     * Fetches employee availability data and renders it as semi-transparent overlay blocks.
     * These blocks visually indicate when an employee is available.
     */
    async function loadAndRenderAvailability() {
        // Remove existing availability blocks before rendering new ones
        document.querySelectorAll('.availability-block').forEach(el => el.remove());
        
        try {
            const employees = await apiRequest('GET', '/api/users/availability');
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

            employees.forEach(employee => {
                if (!employee.availability) return; // Skip if no availability data

                daysOfWeek.forEach((day, index) => {
                    const dayAvailability = employee.availability[day];
                    if (dayAvailability && dayAvailability.start && dayAvailability.end) {
                        const dayColumn = document.getElementById(`day-column-${index}`);
                        if(dayColumn) {
                            // Convert time strings to minutes from midnight for positioning
                            const startMinutes = parseInt(dayAvailability.start.split(':')[0], 10) * 60 + parseInt(dayAvailability.start.split(':')[1], 10);
                            const endMinutes = parseInt(dayAvailability.end.split(':')[0], 10) * 60 + parseInt(dayAvailability.end.split(':')[1], 10);
                            const heightMinutes = endMinutes - startMinutes;
                            
                            if (heightMinutes > 0) {
                                const availabilityBlock = document.createElement('div');
                                availabilityBlock.className = 'availability-block';
                                // Hide if the toggle is off
                                if (availabilityToggle && !availabilityToggle.checked) {
                                    availabilityBlock.classList.add('hidden');
                                }
                                availabilityBlock.style.top = `${startMinutes}px`; // Position in pixels
                                availabilityBlock.style.height = `${heightMinutes}px`; // Height in pixels
                                dayColumn.appendChild(availabilityBlock);
                            }
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Failed to load availability:", error);
            // No modal message here as it's a background visual enhancement
        }
    }

    /**
     * Fetches and renders the business operating hours as a subtle background block.
     * This visually indicates the standard business hours for the location.
     */
    async function loadAndRenderBusinessHours() {
        // Remove existing business hours blocks before rendering new ones
        document.querySelectorAll('.business-hours-block').forEach(el => el.remove());

        try {
            const settings = await apiRequest('GET', '/api/settings/business');
            const businessStartHour = parseInt((settings.operating_hours_start || '00:00').split(':')[0], 10);
            const businessEndHour = parseInt((settings.operating_hours_end || '00:00').split(':')[0], 10);
            const durationHours = businessEndHour - businessStartHour;

            if (durationHours > 0) {
                for (let i = 0; i < 7; i++) { // Apply to all 7 days of the week
                    const dayColumn = document.getElementById(`day-column-${i}`);
                    if (dayColumn) {
                        const businessHoursBlock = document.createElement('div');
                        businessHoursBlock.className = 'business-hours-block';
                        businessHoursBlock.style.top = `${businessStartHour * 60}px`; // Convert hours to pixels
                        businessHoursBlock.style.height = `${durationHours * 60}px`; // Convert hours to pixels
                        dayColumn.appendChild(businessHoursBlock);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load or render business operating hours:", error);
            // No modal message here as it's a background visual
        }
    }

    /**
     * Populates the employee and location dropdowns in the shift creation form.
     */
    async function populateDropdowns() {
        try {
            // Fetch users and locations concurrently
            const [users, locations] = await Promise.all([
                apiRequest('GET', '/api/users'), // Get all users (backend filters by role/location)
                apiRequest('GET', '/api/locations') // Get all locations (backend filters by role)
            ]);
            
            // Populate Employee Select
            if (employeeSelect) {
                employeeSelect.innerHTML = '<option value="">Select Employee</option>'; // Default empty option
                // Filter for employees and location_admins (who might also be scheduled)
                const employees = users.filter(u => u.role === 'employee' || u.role === 'location_admin');
                employees.forEach(user => {
                    const option = new Option(user.full_name, user.user_id);
                    employeeSelect.add(option);
                });
            }

            // Populate Location Select
            if (locationSelect) {
                locationSelect.innerHTML = '<option value="">Select Location</option>'; // Default empty option
                locations.forEach(loc => {
                    const option = new Option(loc.location_name, loc.location_id);
                    locationSelect.add(option);
                });
            }
        } catch (error) {
            showModalMessage('Failed to load data for form dropdowns. Please try again.', true);
            console.error('Error populating dropdowns:', error);
        }
    }

    // Removed: generateDailyHoursInputs function
    // Removed: loadDailyHours function
    // Removed: saveDailyHours function

    // --- Event Handlers ---

    // Event listener for deleting shifts using event delegation on the calendar grid
    if (calendarGrid) {
        calendarGrid.addEventListener('click', async (e) => {
            const deleteButton = e.target.closest('.delete-shift-btn');

            if (deleteButton) {
                e.stopPropagation(); // Prevent click from bubbling to parent elements
                const shiftIdToDelete = String(deleteButton.dataset.shiftId); // Get shift ID from data attribute

                if (!shiftIdToDelete || shiftIdToDelete === "undefined" || shiftIdToDelete === "null") {
                    showModalMessage('Shift ID not found. Cannot delete.', true);
                    return;
                }
                
                const isConfirmed = await showConfirmModal('Are you sure you want to delete this shift? This action cannot be undone.');
                
                if (isConfirmed) {
                    try {
                        await apiRequest('DELETE', `/api/shifts/${shiftIdToDelete}`); // Call backend delete endpoint
                        showModalMessage('Shift deleted successfully!', false); 
                        renderCalendar(currentStartDate); // Re-render calendar to show updated shifts
                    } catch (error) {
                        showModalMessage(`Error deleting shift: ${error.message}`, true);
                        console.error('Error deleting shift:', error);
                    }
                }
            }
        });
    }

    // Event listener for the availability toggle switch
    if (availabilityToggle) {
        availabilityToggle.addEventListener('change', () => {
            const blocks = document.querySelectorAll('.availability-block');
            blocks.forEach(block => {
                block.classList.toggle('hidden', !availabilityToggle.checked); // Toggle 'hidden' class
            });
        });
    }
    
    // Event listener for "Previous Week" button
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentStartDate.setDate(currentStartDate.getDate() - 7); // Subtract 7 days
            renderCalendar(currentStartDate); // Re-render calendar for the new week
        });
    }

    // Event listener for "Next Week" button
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => { 
            currentStartDate.setDate(currentStartDate.getDate() + 7); // Add 7 days
            renderCalendar(currentStartDate); // Re-render calendar for the new week
        });
    } 
    
    // Event listener for the "Create New Shift" form submission
    if (createShiftForm) {
        createShiftForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission
            const shiftData = {
                employee_id: employeeSelect.value,
                location_id: locationSelect.value,
                start_time: document.getElementById('start-time-input').value,
                end_time: document.getElementById('end-time-input').value,
                notes: document.getElementById('notes-input').value
            };

            // Basic validation
            if (!shiftData.employee_id || !shiftData.location_id || !shiftData.start_time || !shiftData.end_time) {
                showModalMessage('Please fill all required fields (Employee, Location, Start Time, End Time).', true);
                return;
            }

            // Validate that end time is after start time
            if (new Date(shiftData.start_time) >= new Date(shiftData.end_time)) {
                showModalMessage('End time must be after start time.', true);
                return;
            }

            try {
                await apiRequest('POST', '/api/shifts', shiftData); // Send shift data to backend
                showModalMessage('Shift created successfully!', false); 
                createShiftForm.reset(); // Clear the form
                renderCalendar(currentStartDate); // Re-render calendar to show the new shift
            } catch (error) {
                showModalMessage(`Error creating shift: ${error.message}`, true);
                console.error('Error creating shift:', error);
            }
        });
    }

    // Removed: Event listener for the "Auto-Generate Schedule" button
    
    // --- Initial Page Load Actions ---
    renderCalendar(currentStartDate); // Render the initial calendar view
    populateDropdowns(); // Populate employee and location dropdowns
    // Removed: loadDailyHours()
}
