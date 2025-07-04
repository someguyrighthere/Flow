import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the NEW "Classic Week" scheduling page.
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


    // --- State Management ---
    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);
    let allLocations = [];
    let currentLocationId = null;

    // --- Constants ---
    const PIXELS_PER_HOUR = 60;
    const START_HOUR = 7; // Display calendar from 7 AM
    const END_HOUR = 22;  // Display calendar until 10 PM

    /**
     * Main function to initialize and render the calendar for a specific location and week.
     */
    const loadAndRenderWeeklySchedule = async (locationId) => {
        if (!locationId) {
            currentWeekDisplay.textContent = 'Select a location';
            calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please select a location to view the schedule.</p>';
            return;
        }
        currentLocationId = locationId;
        currentWeekDisplay.textContent = 'Loading...';
        calendarGridWrapper.innerHTML = ''; // Clear previous grid

        try {
            // Fetch all necessary data for the selected location and week
            const [users, shifts] = await Promise.all([
                apiRequest('GET', `/api/users?location_id=${locationId}`),
                apiRequest('GET', `/api/shifts?startDate=${getApiDate(currentStartDate)}&endDate=${getApiDate(getEndDate(currentStartDate))}&location_id=${locationId}`)
            ]);

            // Populate the sidebar dropdowns with the fetched users and all locations
            populateSidebarDropdowns(users, allLocations);

            // Render the calendar structure and then the shifts
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
        employeeSelect.innerHTML = '<option value="">Select Employee</option>';
        if (users) {
            users.filter(u => u.role === 'employee' || u.role === 'location_admin').forEach(user => {
                employeeSelect.add(new Option(user.full_name, user.user_id));
            });
        }

        locationSelect.innerHTML = '<option value="">Select Location</option>';
        if (locations) {
            locations.forEach(loc => {
                locationSelect.add(new Option(loc.location_name, loc.location_id));
            });
        }
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

        // Create headers (Time + Sun-Sat)
        grid.innerHTML += `<div class="grid-header time-slot-header"></div>`;
        weekDates.forEach(date => {
            grid.innerHTML += `<div class="grid-header">${date.toLocaleDateString(undefined, {weekday: 'short', day: 'numeric'})}</div>`;
        });

        // Create time slots and day columns
        for (let hour = START_HOUR; hour < END_HOUR; hour++) {
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour < 12 ? 'AM' : 'PM';
            grid.innerHTML += `<div class="time-slot">${displayHour} ${ampm}</div>`;
        }

        for (let i = 0; i < 7; i++) {
            const dayCol = document.createElement('div');
            dayCol.className = 'day-column';
            dayCol.style.gridColumn = `${i + 2}`;
            dayCol.style.gridRow = `2 / span ${END_HOUR - START_HOUR}`;
            dayCol.dataset.dayIndex = i;
            grid.appendChild(dayCol);
        }

        calendarGridWrapper.appendChild(grid);
    };

    /**
     * Renders the shift blocks onto the calendar grid.
     */
    const renderShifts = (shifts) => {
        if (!shifts) return;

        shifts.forEach(shift => {
            const shiftStart = new Date(shift.start_time);
            const shiftEnd = new Date(shift.end_time);
            const dayIndex = shiftStart.getDay();
            
            const targetColumn = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);

            if (targetColumn) {
                const startMinutes = (shiftStart.getHours() * 60 + shiftStart.getMinutes()) - (START_HOUR * 60);
                const endMinutes = (shiftEnd.getHours() * 60 + shiftEnd.getMinutes()) - (START_HOUR * 60);

                const top = (startMinutes / 60) * PIXELS_PER_HOUR;
                const height = ((endMinutes - startMinutes) / 60) * PIXELS_PER_HOUR;

                if (height > 0 && top >= 0) {
                    const shiftBlock = document.createElement('div');
                    shiftBlock.className = 'shift-block';
                    shiftBlock.style.top = `${top}px`;
                    shiftBlock.style.height = `${height}px`;
                    shiftBlock.innerHTML = `<strong>${shift.employee_name}</strong><br><small>${shift.location_name}</small>`;
                    shiftBlock.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || 'None'}`;
                    targetColumn.appendChild(shiftBlock);
                }
            }
        });
    };

    // --- Helper Functions ---
    const getWeekDates = (startDate) => Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        return date;
    });

    const getEndDate = (startDate) => {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        return endDate;
    };
    
    const getApiDate = (d) => d.toISOString().split('T')[0];

    // --- Event Handlers ---
    const handleWeekChange = (days) => {
        currentStartDate.setDate(currentStartDate.getDate() + days);
        loadAndRenderWeeklySchedule(currentLocationId);
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
            loadAndRenderWeeklySchedule(currentLocationId); // Reload schedule for the current location
        } catch (error) {
            showModalMessage(`Error creating shift: ${error.message}`, true);
        }
    });
    
    locationSelector.addEventListener('change', () => {
        const newLocationId = locationSelector.value;
        if (newLocationId) {
            loadAndRenderWeeklySchedule(newLocationId);
        }
    });

    // --- Initial Page Load ---
    const initializePage = async () => {
        try {
            const locations = await apiRequest('GET', '/api/locations');
            allLocations = locations;

            if (userRole === 'super_admin') {
                locationSelectorContainer.style.display = 'block';
                locationSelector.innerHTML = '<option value="">Select a Location</option>';
                if (locations && locations.length > 0) {
                    locations.forEach(loc => {
                        locationSelector.add(new Option(loc.location_name, loc.location_id));
                    });
                    // Automatically load the first location
                    locationSelector.value = locations[0].location_id;
                    loadAndRenderWeeklySchedule(locations[0].location_id);
                } else {
                    currentWeekDisplay.textContent = 'No Locations';
                    calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please create a location in Admin Settings.</p>';
                }
            } else { // For location_admin
                locationSelectorContainer.style.display = 'none';
                const user = await apiRequest('GET', '/api/users/me');
                if (user && user.location_id) {
                    loadAndRenderWeeklySchedule(user.location_id);
                } else {
                    showModalMessage('Your account is not assigned to a location.', true);
                    currentWeekDisplay.textContent = 'No Location Assigned';
                }
            }
        } catch (error) {
             showModalMessage(`Failed to initialize page: ${error.message}`, true);
        }
    };

    initializePage();
}
