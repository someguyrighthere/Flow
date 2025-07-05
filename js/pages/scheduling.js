// js/pages/scheduling.js - MASTER SOLUTION: Final Version with Timezone Fix

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
    
    const startDateInput = document.getElementById('start-date-input');
    const startTimeSelect = document.getElementById('start-time-select');
    const endDateInput = document.getElementById('end-date-input');
    const endTimeSelect = document.getElementById('end-time-select');


    // --- State Management ---
    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);
    let currentLocationId = null; 

    // --- Constants ---
    const PIXELS_PER_HOUR = 60;
    const START_HOUR = 0;
    const END_HOUR = 24;

    const SUPER_ADMIN_PREF_LOCATION_KEY = 'superAdminPrefLocationId';

    /**
     * TIMEZONE FIX: Parses a date string as if it were local, ignoring timezone conversions.
     * @param {string} dateTimeString - The ISO-like date-time string from the database (e.g., "YYYY-MM-DDTHH:MI:SS.MSZ").
     * @returns {Date} A Date object representing the local time.
     */
    const parseAsLocalDate = (dateTimeString) => {
        const [datePart, timePart] = dateTimeString.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        // Create a new Date object using local time components. Month is 0-indexed.
        return new Date(year, month - 1, day, hour, minute);
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
     */
    const renderShifts = (shifts) => {
        if (!shifts || shifts.length === 0) return;

        shifts.forEach(shift => {
            // TIMEZONE FIX: Use the new local date parser
            const shiftStart = parseAsLocalDate(shift.start_time);
            const shiftEnd = parseAsLocalDate(shift.end_time);

            if (isNaN(shiftStart.getTime()) || isNaN(shiftEnd.getTime())) return;

            const startDayIndex = shiftStart.getDay();
            const endDayIndex = shiftEnd.getDay();
            
            if (startDayIndex === endDayIndex) {
                createShiftBlock(shift, shiftStart, shiftEnd, startDayIndex);
            } else {
                const midnight = new Date(shiftStart);
                midnight.setHours(24, 0, 0, 0); 
                
                createShiftBlock(shift, shiftStart, midnight, startDayIndex);
                
                if (endDayIndex > startDayIndex || (startDayIndex === 6 && endDayIndex === 0)) {
                    createShiftBlock(shift, midnight, shiftEnd, endDayIndex);
                }
            }
        });
    };

    /**
     * Creates and appends a single shift block to the calendar.
     */
    const createShiftBlock = (shift, startTime, endTime, dayIndex) => {
        const targetColumn = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
        if (!targetColumn) return;

        const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
        const endMinutes = (endTime.getHours() * 60 + endTime.getMinutes()) || (24 * 60);

        const top = (startMinutes / 60) * PIXELS_PER_HOUR;
        const height = ((endMinutes - startMinutes) / 60) * PIXELS_PER_HOUR;

        if (height <= 0) return;

        const shiftBlock = document.createElement('div');
        shiftBlock.className = 'shift-block';
        shiftBlock.style.top = `${top}px`;
        shiftBlock.style.height = `${height}px`;
        shiftBlock.innerHTML = `
            <strong>${shift.employee_name}</strong>
            <button class="delete-shift-btn" data-shift-id="${shift.id}">&times;</button>
        `;
        shiftBlock.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || 'None'}`;
        
        targetColumn.appendChild(shiftBlock);
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

    calendarGridWrapper.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-shift-btn')) {
            const shiftId = e.target.dataset.shiftId;
            const confirmed = await showConfirmModal('Are you sure you want to delete this shift?');
            if (confirmed) {
                try {
                    await apiRequest('DELETE', `/api/shifts/${shiftId}`);
                    showModalMessage('Shift deleted successfully!', false);
                    loadAndRenderWeeklySchedule(currentLocationId);
                } catch (error) {
                    showModalMessage(`Error deleting shift: ${error.message}`, true);
                }
            }
        }
    });

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
