// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the NEW "Classic Week" scheduling page.
 * This version includes logic to display employee names on shifts.
 */
export function handleSchedulingPage() {
    // --- Security & Role Check ---
    const authToken = localStorage.getItem("authToken");
    const userRole = localStorage.getItem('userRole');
    if (!authToken) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Element References ---
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const calendarGridWrapper = document.getElementById('calendar-grid-wrapper');
    const employeeSelect = document.getElementById('employee-select');
    const locationSelect = document.getElementById('location-select');
    const createShiftForm = document.getElementById('create-shift-form');
    const locationSelectorContainer = document.getElementById('location-selector-container');
    const locationSelector = document.getElementById('location-selector');
    
    const startDateInput = document.getElementById('start-date-input');
    const startTimeSelect = document.getElementById('start-time-select');
    const endDateInput = document.getElementById('end-date-input');
    const endTimeSelect = document.getElementById('end-time-select');


    // --- State Management ---
    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);
    let currentLocationId = null; // Will be set during initialization based on user role or selection

    // --- Constants ---
    const PIXELS_PER_HOUR = 60;
    const START_HOUR = 7; // Display calendar from 7 AM
    const END_HOUR = 22;  // Display calendar until 10 PM

    /**
     * Helper function to robustly parse a "YYYY-MM-DD HH:MM:SS" string as a local Date object.
     * This avoids timezone interpretation issues with `new Date()` directly.
     * @param {string} dateTimeString - The date-time string from the database (e.g., "2025-07-04 09:00:00").
     * @returns {Date} A Date object representing the local time, or an Invalid Date.
     */
    const parseLocalTimeLiteral = (dateTimeString) => {
        // Replace space with 'T' for ISO 8601 compatibility without timezone.
        // This is generally the most reliable way for new Date() to parse local times.
        const isoFormattedString = dateTimeString.replace(' ', 'T');
        const date = new Date(isoFormattedString);

        // Verify if the parsed date is valid
        if (isNaN(date.getTime())) {
            console.error(`Failed to parse date string "${dateTimeString}". Resulted in Invalid Date.`);
        }
        return date;
    };


    /**
     * Main function to initialize and render the calendar for a specific location and week.
     */
    const loadAndRenderWeeklySchedule = async (locationId) => {
        // Essential check: If no locationId is provided or set, display a message and exit.
        if (!locationId) {
            currentWeekDisplay.textContent = 'Select a location';
            calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please select a location to view the schedule.</p>';
            return;
        }
        
        currentLocationId = locationId; // Update the module-level state variable for the current location
        currentWeekDisplay.textContent = 'Loading...';
        calendarGridWrapper.innerHTML = ''; // Clear previous grid

        try {
            // Fetch users and shifts for the *currently selected* location
            const [users, shifts, allLocations] = await Promise.all([
                apiRequest('GET', `/api/users?location_id=${currentLocationId}`), // Use currentLocationId here
                apiRequest('GET', `/api/shifts?startDate=${getApiDate(currentStartDate)}&endDate=${getApiDate(getEndDate(currentStartDate))}&location_id=${currentLocationId}`), // And here
                apiRequest('GET', '/api/locations') // Fetch all locations for dropdowns
            ]);

            populateSidebarDropdowns(users, allLocations);
            renderCalendarGrid();
            renderShifts(shifts);

        } catch (error) {
            showModalMessage(`Error loading schedule: ${error.message}`, true);
            console.error("Error loading schedule data:", error);
            currentWeekDisplay.textContent = 'Error';
        }
    };

    /**
     * Populates the Employee and Location dropdowns in the sidebar.
     */
    const populateSidebarDropdowns = (users, locations) => {
        // Populate the Employee dropdown
        employeeSelect.innerHTML = '<option value="">Select Employee</option>';
        if (users) {
            // Filter for 'employee' or 'location_admin' roles, as these can be assigned shifts.
            users.filter(u => u.role === 'employee' || u.role === 'location_admin').forEach(user => {
                employeeSelect.add(new Option(user.full_name, user.user_id));
            });
        }

        // Populate the top 'View Schedule For' location dropdown (only visible for super_admin)
        if (locationSelectorContainer && locationSelectorContainer.style.display !== 'none' && locationSelector) {
            locationSelector.innerHTML = '<option value="">Select a Location</option>';
            if (locations) {
                locations.forEach(loc => {
                    locationSelector.add(new Option(loc.location_name, loc.location_id));
                });
            }
            // Ensure the displayed location selector matches the current schedule's location
            if (currentLocationId) {
                locationSelector.value = currentLocationId;
            }
        }

        // Populate the 'Create New Shift' form's Location dropdown
        locationSelect.innerHTML = '<option value="">Select Location</option>';
        if (locations) {
            locations.forEach(loc => {
                locationSelect.add(new Option(loc.location_name, loc.location_id));
            });
        }
        // If currentLocationId is set, pre-select it in the create shift form's location dropdown
        if (currentLocationId) {
            locationSelect.value = currentLocationId;
        }
    };

    /**
     * Generates and populates the time dropdowns with 15-minute increments.
     */
    const populateTimeSelects = () => {
        let optionsHtml = '<option value="">Select Time</option>';
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                const ampm = hour < 12 ? 'AM' : 'PM';
                const displayText = `${displayHour}:${String(minute).padStart(2, '0')} ${ampm}`;
                optionsHtml += `<option value="${timeValue}">${displayText}</option>`;
            }
        }
        startTimeSelect.innerHTML = optionsHtml;
        endTimeSelect.innerHTML = optionsHtml;
    };

    /**
     * Renders the main calendar grid structure (headers, time slots, day columns).
     */
    const renderCalendarGrid = () => {
        const weekDates = getWeekDates(currentStartDate);
        const dateRangeString = `${weekDates[0].toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - ${weekDates[6].toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;
        currentWeekDisplay.textContent = dateRangeString;

        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        // Add empty header for time column, then headers for days
        grid.innerHTML += `<div class="grid-header time-slot-header"></div>`;
        weekDates.forEach(date => {
            grid.innerHTML += `<div class="grid-header">${date.toLocaleDateString(undefined, {weekday: 'short', day: 'numeric'})}</div>`;
        });

        // Add time slots to the first column
        for (let hour = START_HOUR; hour < END_HOUR; hour++) {
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour < 12 ? 'AM' : 'PM';
            grid.innerHTML += `<div class="time-slot">${displayHour} ${ampm}</div>`;
        }

        // Add empty day columns for shift placement
        for (let i = 0; i < 7; i++) {
            const dayCol = document.createElement('div');
            dayCol.className = 'day-column';
            // Grid column starts at 2 because the first column is for time slots
            dayCol.style.gridColumn = `${i + 2}`; 
            // Grid row starts at 2 because the first row is for day headers
            dayCol.style.gridRow = `2 / span ${END_HOUR - START_HOUR}`; 
            dayCol.dataset.dayIndex = i; // Store day index for identifying column
            grid.appendChild(dayCol);
        }

        calendarGridWrapper.innerHTML = ''; // Clear existing content
        calendarGridWrapper.appendChild(grid); // Append the newly created grid
    };

    /**
     * Renders the shift blocks onto the calendar grid.
     * @param {Array} shifts - An array of shift objects.
     */
    const renderShifts = (shifts) => {
        if (!shifts || shifts.length === 0) {
            console.log("No shifts to render or shifts array is empty.");
            return;
        }

        shifts.forEach(shift => {
            // Use the robust parser for database strings that might have spaces instead of 'T'
            const shiftStart = parseLocalTimeLiteral(shift.start_time);
            const shiftEnd = parseLocalTimeLiteral(shift.end_time);

            // Check if dates are valid after parsing
            if (isNaN(shiftStart.getTime()) || isNaN(shiftEnd.getTime())) {
                console.warn(`Shift for ${shift.employee_name} (ID: ${shift.id}) not rendered: Invalid date format from DB. Start: "${shift.start_time}", End: "${shift.end_time}"`);
                return; // Skip rendering this problematic shift
            }

            const dayIndex = shiftStart.getDay(); // 0 for Sunday, 1 for Monday, etc.
            
            // Find the correct day column in the rendered grid
            const targetColumn = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);

            if (targetColumn) {
                // Calculate position and height of the shift block using local time components
                const startHourLocal = shiftStart.getHours();
                const startMinuteLocal = shiftStart.getMinutes();
                const endHourLocal = shiftEnd.getHours();
                const endMinuteLocal = shiftEnd.getMinutes();

                const startMinutes = (startHourLocal * 60 + startMinuteLocal) - (START_HOUR * 60);
                const endMinutes = (endHourLocal * 60 + endMinuteLocal) - (START_HOUR * 60);

                const top = (startMinutes / 60) * PIXELS_PER_HOUR;
                const height = ((endMinutes - startMinutes) / 60) * PIXELS_PER_HOUR;

                // Only render if shift has a valid duration and starts within or after calendar view
                if (height > 0 && top >= 0) {
                    const shiftBlock = document.createElement('div');
                    shiftBlock.className = 'shift-block';
                    shiftBlock.style.top = `${top}px`;
                    shiftBlock.style.height = `${height}px`;
                    shiftBlock.innerHTML = `<strong>${shift.employee_name}</strong><br><small>${shift.location_name}</small>`;
                    
                    // Format title to show local times as they appear in the database
                    const formattedStartTime = shiftStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    const formattedEndTime = shiftEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    shiftBlock.title = `Shift for ${shift.employee_name} at ${shift.location_name} from ${formattedStartTime} to ${formattedEndTime}. Notes: ${shift.notes || 'None'}`;
                    
                    targetColumn.appendChild(shiftBlock);
                } else {
                    console.warn(`Shift for ${shift.employee_name} (ID: ${shift.id}) not rendered due to invalid time/height. Start: ${shiftStart.toLocaleTimeString()}, End: ${shiftEnd.toLocaleTimeString()}. Calculated top: ${top}, height: ${height}`);
                }
            } else {
                console.warn(`Could not find target column for dayIndex: ${dayIndex} for shift ID: ${shift.id}`);
            }
        });
    };

    // --- Helper Functions for Dates ---
    const getWeekDates = (startDate) => Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        return date;
    });

    const getEndDate = (startDate) => {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7); // Get date 7 days from start (exclusive end for API)
        return endDate;
    };
    
    // Formats a Date object into 'YYYY-MM-DD' for API requests
    const getApiDate = (d) => d.toISOString().split('T')[0];

    // --- Event Handlers ---
    const handleWeekChange = (days) => {
        currentStartDate.setDate(currentStartDate.getDate() + days);
        // Ensure currentLocationId is valid before trying to load a new week
        if (currentLocationId) {
            loadAndRenderWeeklySchedule(currentLocationId);
        } else {
            showModalMessage('Please select a location first.', true);
        }
    };

    prevWeekBtn.addEventListener('click', () => handleWeekChange(-7));
    nextWeekBtn.addEventListener('click', () => handleWeekChange(7));

    // Event listener for creating a new shift
    createShiftForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default form submission
        
        const startDate = startDateInput.value;
        const startTime = startTimeSelect.value;
        const endDate = endDateInput.value;
        const endTime = endTimeSelect.value;

        if (!startDate || !startTime || !endDate || !endTime) {
            return showModalMessage('Please select a valid date and time for both start and end.', true);
        }

        // Combine date and time inputs into full ISO format strings (without Z for UTC)
        // These will be saved to the database as `timestamp without time zone`
        const startDateTime = `${startDate}T${startTime}:00`; // Append :00 for seconds
        const endDateTime = `${endDate}T${endTime}:00`; // Append :00 for seconds

        const shiftData = {
            employee_id: employeeSelect.value,
            location_id: locationSelect.value,
            start_time: startDateTime,
            end_time: endDateTime,
            notes: document.getElementById('notes-input').value
        };

        if (!shiftData.employee_id || !shiftData.location_id) {
            return showModalMessage('Please select an employee and location.', true);
        }
        
        try {
            await apiRequest('POST', '/api/shifts', shiftData);
            showModalMessage('Shift created successfully!', false);
            createShiftForm.reset(); // Clear the form
            // Crucial: After successful creation, re-render the schedule for the current location
            // This will fetch the newly created shift and display it.
            loadAndRenderWeeklySchedule(currentLocationId); 
        } catch (error) {
            showModalMessage(`Error creating shift: ${error.message}`, true);
        }
    });
    
    // Event listener for the top 'View Schedule For' location selector (for super_admin)
    if (locationSelector) {
        locationSelector.addEventListener('change', () => {
            const newLocationId = locationSelector.value;
            if (newLocationId) {
                currentLocationId = newLocationId; // Update the module-level state
                loadAndRenderWeeklySchedule(newLocationId);
            } else {
                 // If "Select a Location" is chosen, clear the schedule view
                currentLocationId = null;
                currentWeekDisplay.textContent = 'Select a location';
                calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please select a location to view the schedule.</p>';
            }
        });
    }

    // --- Initial Page Load ---
    const initializePage = async () => {
        populateTimeSelects(); // Populate time dropdowns on page load

        try {
            const locations = await apiRequest('GET', '/api/locations'); //
            
            if (userRole === 'super_admin') {
                if(locationSelectorContainer) locationSelectorContainer.style.display = 'block';
                if (locationSelector) {
                    locationSelector.innerHTML = '<option value="">Select a Location</option>';
                    if (locations && locations.length > 0) {
                        // Corrected: Iterate over the 'locations' array received from the API.
                        locations.forEach(loc => {
                            locationSelector.add(new Option(loc.location_name, loc.location_id));
                        });
                        // Set the initial location to the first one available for super_admin
                        const initialLocationId = locations[0].location_id; 
                        locationSelector.value = initialLocationId; // Pre-select in the top dropdown
                        currentLocationId = initialLocationId; // Crucial: Set the module-level state
                        loadAndRenderWeeklySchedule(initialLocationId); // Load schedule for this initial location
                    } else {
                        currentWeekDisplay.textContent = 'No Locations';
                        calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please create a location in Admin Settings.</p>';
                    }
                }
            } else { // For location_admin role
                if(locationSelectorContainer) locationSelectorContainer.style.display = 'none'; // Hide location selector for location_admin
                const user = await apiRequest('GET', '/api/users/me'); // Get the location_admin's assigned location
                if (user && user.location_id) {
                    currentLocationId = user.location_id; // Set the module-level state
                    loadAndRenderWeeklySchedule(user.location_id); // Load schedule for their assigned location
                } else {
                    showModalMessage('Your account is not assigned to a location. Please contact your administrator.', true);
                    currentWeekDisplay.textContent = 'No Location Assigned';
                }
            }
        } catch (error) {
             showModalMessage(`Failed to initialize scheduling page: ${error.message}`, true);
             console.error('Failed to initialize scheduling page:', error);
        }
    };

    initializePage(); // Call the initialization function when the script loads
}