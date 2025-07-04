// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the scheduling page.
 * This version has been rewritten for robust, sequential data loading to prevent server hangs.
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
    const calendarGrid = document.getElementById('calendar-grid');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const createShiftForm = document.getElementById('create-shift-form');
    const employeeSelect = document.getElementById('employee-select');
    const locationSelect = document.getElementById('location-select');
    const availabilityToggle = document.getElementById('toggle-availability');
    const superAdminLocationSelectorDiv = document.getElementById('super-admin-location-selector');
    const superAdminLocationSelect = document.getElementById('super-admin-location-select');

    // --- State Management ---
    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);

    let allLocations = [];
    let currentLocationId = null;

    /**
     * Main entry point for loading all schedule data for a specific location, one step at a time.
     * @param {string} locationId - The ID of the location to load data for.
     */
    const loadAndRenderScheduleForLocation = async (locationId) => {
        if (!locationId) {
            calendarGrid.innerHTML = '<p style="color: var(--text-medium); text-align: center; padding-top: 50px;">Please select a location to view the schedule.</p>';
            currentWeekDisplay.textContent = 'No Location Selected';
            return;
        }

        currentLocationId = locationId;
        console.log(`[Scheduling] Starting sequential load for location ID: ${locationId}`);

        // Show loading state
        currentWeekDisplay.textContent = 'Loading...';
        calendarGrid.innerHTML = '<p style="color: var(--text-medium); text-align: center; padding-top: 50px;">Fetching schedule data...</p>';

        try {
            // STEP 1: Render the basic calendar grid structure first.
            renderWeeklyCalendar(currentStartDate);

            // STEP 2: Fetch users for the dropdowns.
            const users = await apiRequest('GET', `/api/users?location_id=${locationId}`);
            populateShiftFormDropdowns(users);
            
            // STEP 3: Fetch the shifts for the current week.
            const shifts = await apiRequest('GET', `/api/shifts?startDate=${getApiDate(currentStartDate)}&endDate=${getApiDate(getEndDate(currentStartDate))}&location_id=${locationId}`);
            renderShifts(shifts);

            // STEP 4: Fetch business settings and render them.
            const businessSettings = await apiRequest('GET', `/api/settings/business?location_id=${locationId}`);
            renderBusinessHours(businessSettings);

            // STEP 5: Fetch employee availability and render it.
            const availability = await apiRequest('GET', `/api/users/availability?location_id=${locationId}`);
            renderAvailability(availability);

            console.log("[Scheduling] All data loaded and rendered successfully.");

        } catch (error) {
            showModalMessage(`Failed to load schedule data: ${error.message}`, true);
            console.error('Error in loadAndRenderScheduleForLocation:', error);
            currentWeekDisplay.textContent = 'Error Loading Data';
            calendarGrid.innerHTML = `<p style="color: #e74c3c; text-align: center; padding-top: 50px;">An error occurred while loading the schedule.</p>`;
        }
    };

    /**
     * Renders the main calendar structure (grid, headers, time slots).
     */
    const renderWeeklyCalendar = (startDate) => {
        const endDate = getEndDate(startDate);
        const options = { month: 'short', day: 'numeric' };
        currentWeekDisplay.textContent = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
        
        calendarGrid.innerHTML = ''; // Clear for fresh render

        const headerContainer = document.createElement('div');
        headerContainer.className = 'calendar-grid-header';
        headerContainer.innerHTML = `<div class="calendar-day-header">&nbsp;</div>`; // Placeholder for time
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + i);
            headerContainer.innerHTML += `<div class="calendar-day-header">${dayDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</div>`;
        }
        calendarGrid.appendChild(headerContainer);

        const calendarBody = document.createElement('div');
        calendarBody.className = 'calendar-body';
        
        const timeColumn = document.createElement('div');
        timeColumn.className = 'time-column';
        for (let hour = 0; hour < 24; hour++) {
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour < 12 ? 'AM' : 'PM';
            timeColumn.innerHTML += `<div class="time-slot">${displayHour} ${ampm}</div>`;
        }
        calendarBody.appendChild(timeColumn);

        for (let i = 0; i < 7; i++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            dayColumn.id = `day-column-${i}`;
            for (let j = 0; j < 24; j++) {
                dayColumn.innerHTML += `<div class="hour-line"></div>`;
            }
            calendarBody.appendChild(dayColumn);
        }
        calendarGrid.appendChild(calendarBody);
    };
    
    /** Populates the "Create New Shift" form dropdowns. */
    const populateShiftFormDropdowns = (users) => {
        employeeSelect.innerHTML = '<option value="">Select Employee</option>';
        if(users) {
            users.forEach(user => {
                if (user.role === 'employee' || user.role === 'location_admin') {
                    employeeSelect.add(new Option(user.full_name, user.user_id));
                }
            });
        }

        locationSelect.innerHTML = '';
        allLocations.forEach(loc => {
            locationSelect.add(new Option(loc.location_name, loc.location_id));
        });
        locationSelect.value = currentLocationId;
    };

    /** Renders shift blocks onto the calendar grid. */
    const renderShifts = (shifts) => {
        document.querySelectorAll('.calendar-shift').forEach(el => el.remove());
        if (!shifts || shifts.length === 0) return;

        shifts.forEach(shift => {
            const shiftStart = new Date(shift.start_time);
            const dayIndex = shiftStart.getDay();
            const targetColumn = document.getElementById(`day-column-${dayIndex}`);
            if (targetColumn) {
                const shiftElement = createVisualBlock(shiftStart, new Date(shift.end_time), 'calendar-shift');
                shiftElement.innerHTML = `
                    <strong>${shift.employee_name}</strong>
                    <button class="delete-shift-btn" data-shift-id="${shift.id}" title="Delete Shift">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                    </button>
                `;
                targetColumn.appendChild(shiftElement);
            }
        });
    };

    /** Renders employee availability blocks. */
    const renderAvailability = (employees) => {
        document.querySelectorAll('.availability-block').forEach(el => el.remove());
        if (!employees) return;
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        employees.forEach(employee => {
            if (!employee.availability) return;
            daysOfWeek.forEach((day, index) => {
                const dayAvail = employee.availability[day];
                if (dayAvail && dayAvail.start && dayAvail.end) {
                    const targetColumn = document.getElementById(`day-column-${index}`);
                    if (targetColumn) {
                        const start = new Date(`1970-01-01T${dayAvail.start}`);
                        const end = new Date(`1970-01-01T${dayAvail.end}`);
                        const availBlock = createVisualBlock(start, end, 'availability-block');
                        if (!availabilityToggle.checked) {
                            availBlock.classList.add('hidden');
                        }
                        targetColumn.appendChild(availBlock);
                    }
                }
            });
        });
    };

    /** Renders business hours blocks. */
    const renderBusinessHours = (settings) => {
        document.querySelectorAll('.business-hours-block').forEach(el => el.remove());
        if (!settings || !settings.operating_hours_start || !settings.operating_hours_end) return;
        
        const start = new Date(`1970-01-01T${settings.operating_hours_start}`);
        const end = new Date(`1970-01-01T${settings.operating_hours_end}`);

        for (let i = 0; i < 7; i++) {
            const targetColumn = document.getElementById(`day-column-${i}`);
            if (targetColumn) {
                const bizBlock = createVisualBlock(start, end, 'business-hours-block');
                targetColumn.appendChild(bizBlock);
            }
        }
    };

    /** Helper to create a positioned div for shifts, availability, etc. */
    const createVisualBlock = (start, end, className) => {
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        const height = Math.max(0, endMinutes - startMinutes);
        
        const block = document.createElement('div');
        block.className = className;
        block.style.top = `${startMinutes}px`;
        block.style.height = `${height}px`;
        return block;
    };

    /** Helper to get the end date of the week. */
    const getEndDate = (startDate) => {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7); // Corrected to get the day after the last day of the week for API query
        return endDate;
    };

    /** Helper to format date for API calls. */
    const getApiDate = (d) => d.toISOString().split('T')[0];

    // --- Event Handlers ---
    const handleWeekChange = (days) => {
        if (!currentLocationId) return; // Don't change week if no location is selected
        currentStartDate.setDate(currentStartDate.getDate() + days);
        loadAndRenderScheduleForLocation(currentLocationId);
    };

    prevWeekBtn.addEventListener('click', () => handleWeekChange(-7));
    nextWeekBtn.addEventListener('click', () => handleWeekChange(7));

    createShiftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const shiftData = {
            employee_id: employeeSelect.value,
            location_id: locationSelect.value,
            start_time: document.getElementById('start-time-input').value,
            end_time: document.getElementById('end-time-input').value,
            notes: document.getElementById('notes-input').value
        };
        if (!shiftData.employee_id || !shiftData.location_id || !shiftData.start_time || !shiftData.end_time) {
            return showModalMessage('Please fill all required fields.', true);
        }
        try {
            await apiRequest('POST', '/api/shifts', shiftData);
            showModalMessage('Shift created successfully!', false);
            createShiftForm.reset();
            loadAndRenderScheduleForLocation(currentLocationId); // Reload data
        } catch (error) {
            showModalMessage(`Error creating shift: ${error.message}`, true);
        }
    });
    
    calendarGrid.addEventListener('click', async (e) => {
        const deleteButton = e.target.closest('.delete-shift-btn');
        if (deleteButton) {
            const shiftId = deleteButton.dataset.shiftId;
            const confirmed = await showConfirmModal('Are you sure you want to delete this shift?');
            if (confirmed) {
                try {
                    await apiRequest('DELETE', `/api/shifts/${shiftId}`);
                    showModalMessage('Shift deleted.', false);
                    loadAndRenderScheduleForLocation(currentLocationId); // Reload data
                } catch (error) {
                    showModalMessage(`Error deleting shift: ${error.message}`, true);
                }
            }
        }
    });

    availabilityToggle.addEventListener('change', () => {
        document.querySelectorAll('.availability-block').forEach(block => {
            block.classList.toggle('hidden', !availabilityToggle.checked);
        });
    });

    superAdminLocationSelect.addEventListener('change', () => {
        const selectedLocationId = superAdminLocationSelect.value;
        if (selectedLocationId) {
            loadAndRenderScheduleForLocation(selectedLocationId);
        }
    });

    // --- INITIALIZATION LOGIC ---
    const initializePage = async () => {
        if (userRole === 'super_admin') {
            superAdminLocationSelectorDiv.style.display = 'block';
            try {
                const locations = await apiRequest('GET', '/api/locations');
                allLocations = locations;
                superAdminLocationSelect.innerHTML = '<option value="">Select a Location</option>';
                if (locations && locations.length > 0) {
                    locations.forEach(loc => {
                        superAdminLocationSelect.add(new Option(loc.location_name, loc.location_id));
                    });
                    // Automatically load the first location
                    superAdminLocationSelect.value = locations[0].location_id;
                    loadAndRenderScheduleForLocation(locations[0].location_id);
                } else {
                    currentWeekDisplay.textContent = 'No Locations Created';
                    calendarGrid.innerHTML = '<p style="color: var(--text-medium); text-align: center; padding-top: 50px;">Please create a location in Admin Settings first.</p>';
                }
            } catch (error) {
                showModalMessage(`Could not load locations: ${error.message}`, true);
            }
        } else { // For location_admin
            superAdminLocationSelectorDiv.style.display = 'none';
            try {
                const user = await apiRequest('GET', '/api/users/me');
                if (user && user.location_id) {
                    const singleLocation = await apiRequest('GET', `/api/locations`);
                    allLocations = singleLocation;
                    loadAndRenderScheduleForLocation(user.location_id);
                } else {
                    showModalMessage('Your account is not assigned to a location.', true);
                    currentWeekDisplay.textContent = 'No Location Assigned';
                }
            } catch (error) {
                showModalMessage(`Could not determine your location: ${error.message}`, true);
            }
        }
    };

    initializePage();
}
