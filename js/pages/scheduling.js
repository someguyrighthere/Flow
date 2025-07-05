// js/pages/scheduling.js - MASTER SOLUTION: Final Version

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
    const START_HOUR = 0;  // Display calendar from 00:00 (12 AM)
    const END_HOUR = 24;   // Display calendar until 24:00 (end of day, effectively covers up to 11:59 PM)

    // Key for storing Super Admin's preferred location in localStorage
    const SUPER_ADMIN_PREF_LOCATION_KEY = 'superAdminPrefLocationId';

    /**
     * Helper function to robustly parse an ISO 8601 string (with or without 'Z') into a Date object.
     * @param {string} dateTimeString - The ISO 8601 date-time string from the database.
     * @returns {Date} A Date object, or an Invalid Date if parsing fails.
     */
    const parseISODateString = (dateTimeString) => {
        const date = new Date(dateTimeString);
        if (isNaN(date.getTime())) {
            console.error(`Failed to parse ISO date string "${dateTimeString}". Resulted in Invalid Date.`);
        }
        return date;
    };


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
        calendarGridWrapper.innerHTML = '';

        try {
            const [users, shifts, allLocations] = await Promise.all([
                apiRequest('GET', `/api/users?location_id=${currentLocationId}`),
                apiRequest('GET', `/api/shifts?startDate=${getApiDate(currentStartDate)}&endDate=${getApiDate(getEndDate(currentStartDate))}&location_id=${currentLocationId}`),
                apiRequest('GET', '/api/locations')
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
        employeeSelect.innerHTML = '<option value="">Select Employee</option>';
        if (users) {
            users.filter(u => u.role === 'employee' || u.role === 'location_admin').forEach(user => {
                employeeSelect.add(new Option(user.full_name, user.user_id));
            });
        }

        if (locationSelectorContainer && locationSelectorContainer.style.display !== 'none' && locationSelector) {
            locationSelector.innerHTML = '<option value="">Select a Location</option>';
            if (locations) {
                locations.forEach(loc => {
                    locationSelector.add(new Option(loc.location_name, loc.location_id));
                });
            }
            if (currentLocationId) {
                locationSelector.value = currentLocationId;
            }
        }

        locationSelect.innerHTML = '<option value="">Select Location</option>';
        if (locations) {
            locations.forEach(loc => {
                locationSelect.add(new Option(loc.location_name, loc.location_id));
            });
        }
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

        grid.innerHTML += `<div class="grid-header time-slot-header"></div>`;
        weekDates.forEach(date => {
            grid.innerHTML += `<div class="grid-header">${date.toLocaleDateString(undefined, {weekday: 'short', day: 'numeric'})}</div>`;
        });

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

        calendarGridWrapper.innerHTML = '';
        calendarGridWrapper.appendChild(grid);
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
            const shiftStart = parseISODateString(shift.start_time);
            const shiftEnd = parseISODateString(shift.end_time);

            if (isNaN(shiftStart.getTime()) || isNaN(shiftEnd.getTime())) {
                console.warn(`Shift for ${shift.employee_name} (ID: ${shift.id}) not rendered: Invalid date format from DB. Start: "${shift.start_time}", End: "${shift.end_time}"`);
                return;
            }

            const dayIndex = shiftStart.getDay(); 
            const targetColumn = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);

            // FIX: Declare these variables outside the 'if' block so they are accessible in the 'else' block.
            const formattedStartTime = shiftStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            const formattedEndTime = shiftEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

            if (targetColumn) {
                const startHourLocal = shiftStart.getHours();
                const startMinuteLocal = shiftStart.getMinutes();
                const endHourLocal = shiftEnd.getHours();
                const endMinuteLocal = shiftEnd.getMinutes();

                const totalStartMinutesFromMidnight = startHourLocal * 60 + startMinuteLocal;
                const totalEndMinutesFromMidnight = endHourLocal * 60 + endMinuteLocal;

                let durationMinutes = totalEndMinutesFromMidnight - totalStartMinutesFromMidnight;
                if (durationMinutes < 0) {
                    durationMinutes += (24 * 60);
                }

                const calendarDisplayStartMinutes = START_HOUR * 60; 

                const top = (totalStartMinutesFromMidnight - calendarDisplayStartMinutes) / 60 * PIXELS_PER_HOUR;
                const height = durationMinutes / 60 * PIXELS_PER_HOUR;

                if (height > 0 && top >= 0 && (top + height) <= ((END_HOUR - START_HOUR) * PIXELS_PER_HOUR)) {
                    const shiftBlock = document.createElement('div');
                    shiftBlock.className = 'shift-block';
                    shiftBlock.style.top = `${top}px`;
                    shiftBlock.style.height = `${height}px`;
                    shiftBlock.innerHTML = `<strong>${shift.employee_name}</strong><br><small>${shift.location_name}</small>`;
                    
                    shiftBlock.title = `Shift for ${shift.employee_name} at ${shift.location_name} from ${formattedStartTime} to ${formattedEndTime}. Notes: ${shift.notes || 'None'}`;
                    
                    targetColumn.appendChild(shiftBlock);
                } else {
                    console.warn(`Shift for ${shift.employee_name} (ID: ${shift.id}) not rendered due to invalid calculated rendering size. Start: ${formattedStartTime}, End: ${formattedEndTime}. Calculated top: ${top}, height: ${height}`);
                }
            } else {
                console.warn(`Could not find target column for dayIndex: ${dayIndex} for shift ID: ${shift.id}. (Shift might be on a different day than the displayed week)`);
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
        endDate.setDate(endDate.getDate() + 7);
        return endDate;
    };
    
    const getApiDate = (d) => d.toISOString().split('T')[0];

    // --- Event Handlers ---
    const handleWeekChange = (days) => {
        currentStartDate.setDate(currentStartDate.getDate() + days);
        if (currentLocationId) {
            loadAndRenderWeeklySchedule(currentLocationId);
        } else {
            showModalMessage('Please select a location first.', true);
        }
    };

    prevWeekBtn.addEventListener('click', () => handleWeekChange(-7));
    nextWeekBtn.addEventListener('click', () => handleWeekChange(7));

    createShiftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const startDate = startDateInput.value;
        const startTime = startTimeSelect.value;
        const endDate = endDateInput.value;
        const endTime = endTimeSelect.value;

        if (!startDate || !startTime || !endDate || !endTime) {
            return showModalMessage('Please provide all date and time fields for the shift.', true);
        }

        const shiftStartDateTimeString = `${startDate}T${startTime}:00`; 
        const shiftEndDateTimeString = `${endDate}T${endTime}:00`; 
        
        if (new Date(shiftStartDateTimeString).getTime() >= new Date(shiftEndDateTimeString).getTime()) {
             showModalMessage('Shift end time must be after start time.', true);
             return;
        }

        const shiftData = {
            employee_id: employeeSelect.value,
            location_id: locationSelect.value,
            start_time: shiftStartDateTimeString,
            end_time: shiftEndDateTimeString,
            notes: document.getElementById('notes-input').value
        };

        if (!shiftData.employee_id || !shiftData.location_id) {
            return showModalMessage('Please select an employee and location for the shift.', true);
        }
        
        try {
            await apiRequest('POST', '/api/shifts', shiftData);
            showModalMessage('Shift created successfully!', false);
            createShiftForm.reset();
            loadAndRenderWeeklySchedule(currentLocationId); 
        } catch (error) {
            showModalMessage(`Error creating shift: ${error.message}`, true);
        }
    });
    
    if (locationSelector) {
        locationSelector.addEventListener('change', () => {
            const newLocationId = locationSelector.value;
            if (newLocationId) {
                localStorage.setItem(SUPER_ADMIN_PREF_LOCATION_KEY, newLocationId);
                currentLocationId = newLocationId;
                loadAndRenderWeeklySchedule(newLocationId);
            } else {
                 localStorage.removeItem(SUPER_ADMIN_PREF_LOCATION_KEY);
                 currentLocationId = null;
                 currentWeekDisplay.textContent = 'Select a location';
                 calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please select a location to view the schedule.</p>';
            }
        });
    }

    // --- Initial Page Load ---
    const initializePage = async () => {
        populateTimeSelects();

        try {
            const locations = await apiRequest('GET', '/api/locations');
            
            if (userRole === 'super_admin') {
                if(locationSelectorContainer) locationSelectorContainer.style.display = 'block';
                if (locationSelector) {
                    locationSelector.innerHTML = '<option value="">Select a Location</option>';
                    if (locations && locations.length > 0) {
                        locations.forEach(loc => {
                            locationSelector.add(new Option(loc.location_name, loc.location_id));
                        });

                        const savedLocationId = localStorage.getItem(SUPER_ADMIN_PREF_LOCATION_KEY);
                        let initialLocationId = null;

                        if (savedLocationId && locations.some(loc => String(loc.location_id) === savedLocationId)) {
                            initialLocationId = savedLocationId;
                        } else {
                            initialLocationId = locations[0].location_id; 
                        }
                        
                        locationSelector.value = initialLocationId;
                        currentLocationId = initialLocationId;
                        loadAndRenderWeeklySchedule(initialLocationId);

                    } else {
                        currentWeekDisplay.textContent = 'No Locations';
                        calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please create a location in Admin Settings.</p>';
                    }
                }
            } else {
                if(locationSelectorContainer) locationSelectorContainer.style.display = 'none';
                const user = await apiRequest('GET', '/api/users/me');
                if (user && user.location_id) {
                    currentLocationId = user.location_id;
                    loadAndRenderWeeklySchedule(user.location_id);
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

    initializePage();
}
