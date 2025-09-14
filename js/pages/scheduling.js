// js/pages/scheduling.js - Drag and Drop Version

import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the NEW drag-and-drop scheduling page.
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
    const printScheduleBtn = document.getElementById('print-schedule-btn');
    const calendarGridWrapper = document.getElementById('calendar-grid-wrapper');
    const employeeListContainer = document.getElementById('employee-list-container');
    const locationSelectorContainer = document.getElementById('location-selector-container');
    const locationSelector = document.getElementById('location-selector');
    const deleteShiftsForm = document.getElementById('delete-shifts-form');

    // --- Modal DOM References ---
    const createShiftModal = document.getElementById('create-shift-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalForm = document.getElementById('modal-create-shift-form');
    const modalEmployeeIdInput = document.getElementById('modal-employee-id');
    const modalLocationIdInput = document.getElementById('modal-location-id');
    const modalStartDateInput = document.getElementById('modal-start-date');
    const modalStartTimeSelect = document.getElementById('modal-start-time');
    const modalEndDateInput = document.getElementById('modal-end-date');
    const modalEndTimeSelect = document.getElementById('modal-end-time');
    const modalNotesInput = document.getElementById('modal-notes');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');


    // --- State Management ---
    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);
    let currentLocationId = null; 
    let allLocations = [];

    // --- Constants ---
    const PIXELS_PER_HOUR = 60;
    const START_HOUR = 0;
    const END_HOUR = 24;
    const SUPER_ADMIN_PREF_LOCATION_KEY = 'superAdminPrefLocationId';

    // --- Helper Functions ---
    const parseAsLocalDate = (dateTimeString) => {
        if (!dateTimeString) return new Date(NaN);
        const [datePart, timePart] = dateTimeString.split('T');
        if (!datePart || !timePart) return new Date(NaN);
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute);
    };
    
    const getApiDate = (d) => d.toISOString().split('T')[0];

    /**
     * Main function to initialize and render the calendar for a specific location and week.
     */
    const loadAndRenderWeeklySchedule = async (locationId) => {
        if (!locationId) {
            currentWeekDisplay.textContent = 'Select a location';
            calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please select a location to view the schedule.</p>';
            if (employeeListContainer) employeeListContainer.innerHTML = '<p style="color: var(--text-medium);">Select a location to see employees.</p>';
            return;
        }
        
        currentLocationId = locationId;
        currentWeekDisplay.textContent = 'Loading...';
        calendarGridWrapper.innerHTML = '';
        if (employeeListContainer) employeeListContainer.innerHTML = 'Loading...';

        try {
            const [users, shifts, fetchedLocations] = await Promise.all([
                apiRequest('GET', `/api/users?location_id=${currentLocationId}`),
                apiRequest('GET', `/api/shifts?startDate=${getApiDate(currentStartDate)}&endDate=${getApiDate(getEndDate(currentStartDate))}&location_id=${currentLocationId}`),
                apiRequest('GET', '/api/locations')
            ]);
            
            allLocations = fetchedLocations;
            
            populateDraggableEmployees(users.filter(u => u.role === 'employee'));
            populateLocationSelector(allLocations);
            renderCalendarGrid();
            renderShifts(shifts);

        } catch (error) {
            showModalMessage(`Error loading schedule: ${error.message}`, true);
            console.error("Error loading schedule data:", error);
            currentWeekDisplay.textContent = 'Error';
        }
    };
    
    /**
     * Populates the sidebar with draggable employee elements.
     */
    const populateDraggableEmployees = (employees) => {
        if (!employeeListContainer) return;
        employeeListContainer.innerHTML = '';
        if (employees && employees.length > 0) {
            employees.forEach(emp => {
                const empDiv = document.createElement('div');
                empDiv.className = 'draggable-employee';
                empDiv.textContent = emp.full_name;
                empDiv.draggable = true;
                empDiv.dataset.employeeId = emp.user_id;
                empDiv.dataset.employeeName = emp.full_name;
                empDiv.addEventListener('dragstart', handleDragStart);
                employeeListContainer.appendChild(empDiv);
            });
        } else {
            employeeListContainer.innerHTML = '<p style="color: var(--text-medium); font-size: 0.9em;">No employees found for this location.</p>';
        }
    };

    /**
     * Populates the location selector dropdown (for super admins).
     */
    const populateLocationSelector = (locations) => {
        if (locationSelectorContainer && locationSelectorContainer.style.display !== 'none' && locationSelector) {
            const currentVal = locationSelector.value;
            locationSelector.innerHTML = '<option value="">Select a Location</option>';
            if (locations) {
                locations.forEach(loc => {
                    locationSelector.add(new Option(loc.location_name, loc.location_id));
                });
            }
             locationSelector.value = currentVal || currentLocationId;
        }
    };

    /**
     * Generates and populates the time dropdowns with 15-minute increments for the modal.
     */
    const populateTimeSelects = () => {
        let optionsHtml = ''; // No need for "Select Time" as it will be pre-filled
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                const ampm = hour < 12 ? 'AM' : 'PM';
                const displayText = `${displayHour}:${String(minute).padStart(2, '0')} ${ampm}`;
                optionsHtml += `<option value="${timeValue}">${displayText}</option>`;
            }
        }
        modalStartTimeSelect.innerHTML = optionsHtml;
        modalEndTimeSelect.innerHTML = optionsHtml;
    };

    /**
     * Renders the main calendar grid structure.
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
     * Renders shift blocks onto the calendar grid.
     */
    const renderShifts = (shifts) => {
        if (!shifts || shifts.length === 0) return;
        shifts.forEach(shift => {
            const shiftStart = parseAsLocalDate(shift.start_time);
            const shiftEnd = parseAsLocalDate(shift.end_time);
            if (isNaN(shiftStart.getTime()) || isNaN(shiftEnd.getTime())) return;

            const startDayIndex = shiftStart.getDay();
            createShiftBlock(shift, shiftStart, shiftEnd, startDayIndex);
        });
    };
    
    const createShiftBlock = (shift, startTime, endTime) => {
        const dayIndex = startTime.getDay();
        const targetColumn = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
        if (!targetColumn) return;

        const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
        const durationMinutes = (endTime - startTime) / (1000 * 60);

        if (durationMinutes <= 0) return;

        const top = (startMinutes / 60) * PIXELS_PER_HOUR;
        const height = (durationMinutes / 60) * PIXELS_PER_HOUR;

        const formattedStartTime = startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const formattedEndTime = endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

        const shiftBlock = document.createElement('div');
        shiftBlock.className = 'shift-block';
        shiftBlock.style.top = `${top}px`;
        shiftBlock.style.height = `${height}px`;
        shiftBlock.innerHTML = `
            <strong>${shift.employee_name}</strong>
            <small class="shift-time">${formattedStartTime} - ${formattedEndTime}</small>
            <button class="delete-shift-btn" data-shift-id="${shift.id}">&times;</button>
        `;
        shiftBlock.title = `Shift for ${shift.employee_name}. Notes: ${shift.notes || 'None'}`;
        
        targetColumn.appendChild(shiftBlock);
    };

    // --- Drag and Drop Event Handlers ---
    const handleDragStart = (e) => {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', JSON.stringify({
            employeeId: e.target.dataset.employeeId,
            employeeName: e.target.dataset.employeeName
        }));
        e.dataTransfer.effectAllowed = 'move';
        
        // Add dragend listener to the element being dragged
        e.target.addEventListener('dragend', () => {
            e.target.classList.remove('dragging');
        }, { once: true });
    };

    calendarGridWrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        const targetColumn = e.target.closest('.day-column');
        if (targetColumn) {
            document.querySelectorAll('.day-column.drag-over').forEach(col => col.classList.remove('drag-over'));
            targetColumn.classList.add('drag-over');
        }
    });

    calendarGridWrapper.addEventListener('dragleave', (e) => {
        if (e.target.classList.contains('day-column')) {
            e.target.classList.remove('drag-over');
        }
    });
    
    calendarGridWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        document.querySelectorAll('.day-column.drag-over').forEach(col => col.classList.remove('drag-over'));
        const targetColumn = e.target.closest('.day-column');
        if (!targetColumn) return;

        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        
        const rect = targetColumn.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const totalMinutes = (y / PIXELS_PER_HOUR) * 60;
        const hour = Math.floor(totalMinutes / 60);
        const minute = Math.round((totalMinutes % 60) / 15) * 15;

        const dayIndex = parseInt(targetColumn.dataset.dayIndex, 10);
        const dropDate = new Date(currentStartDate);
        dropDate.setDate(dropDate.getDate() + dayIndex);

        openCreateShiftModal(data.employeeId, data.employeeName, dropDate, hour, minute);
    });

    /**
     * Opens and pre-populates the shift creation modal.
     */
    const openCreateShiftModal = (employeeId, employeeName, date, startHour, startMinute) => {
        modalTitle.textContent = `Create Shift for ${employeeName}`;
        modalForm.reset();
        
        modalEmployeeIdInput.value = employeeId;
        modalLocationIdInput.value = currentLocationId;
        
        const startDate = new Date(date);
        startDate.setHours(startHour, startMinute, 0, 0);
        
        modalStartDateInput.value = getApiDate(startDate);
        modalStartTimeSelect.value = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;

        const endDate = new Date(startDate);
        endDate.setHours(startDate.getHours() + 8);
        modalEndDateInput.value = getApiDate(endDate);
        modalEndTimeSelect.value = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        
        createShiftModal.style.display = 'flex';
    };
    
    const closeCreateShiftModal = () => {
        createShiftModal.style.display = 'none';
    };

    // --- General Event Handlers ---
    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const shiftData = {
            employee_id: modalEmployeeIdInput.value,
            location_id: modalLocationIdInput.value,
            start_time: `${modalStartDateInput.value}T${modalStartTimeSelect.value}:00`,
            end_time: `${modalEndDateInput.value}T${modalEndTimeSelect.value}:00`,
            notes: modalNotesInput.value
        };

        if (new Date(shiftData.start_time) >= new Date(shiftData.end_time)) {
            return showModalMessage('Shift end time must be after the start time.', true);
        }
        
        try {
            await apiRequest('POST', '/api/shifts', shiftData);
            closeCreateShiftModal();
            showModalMessage('Shift created successfully!', false);
            loadAndRenderWeeklySchedule(currentLocationId);
        } catch (error) {
            showModalMessage(`Error creating shift: ${error.message}`, true);
        }
    });

    modalCancelBtn.addEventListener('click', closeCreateShiftModal);
    
    const handleWeekChange = (days) => {
        currentStartDate.setDate(currentStartDate.getDate() + days);
        if (currentLocationId) loadAndRenderWeeklySchedule(currentLocationId);
    };
    prevWeekBtn.addEventListener('click', () => handleWeekChange(-7));
    nextWeekBtn.addEventListener('click', () => handleWeekChange(7));
    
    if (printScheduleBtn) {
        printScheduleBtn.addEventListener('click', () => {
            if (!currentLocationId) {
                showModalMessage('Please select a location to print a schedule.', true);
                return;
            }
            const locationName = allLocations.find(loc => String(loc.location_id) === String(currentLocationId))?.location_name || 'Selected Location';
            const url = `printable-schedule.html?startDate=${getApiDate(currentStartDate)}&endDate=${getApiDate(getEndDate(currentStartDate))}&locationId=${currentLocationId}&locationName=${encodeURIComponent(locationName)}`;
            window.open(url, '_blank');
        });
    }

    if (deleteShiftsForm) {
        deleteShiftsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const beforeDate = document.getElementById('delete-before-date').value;
            if (!beforeDate) {
                showModalMessage('Please select a date.', true);
                return;
            }
            const confirmed = await showConfirmModal(`Are you sure you want to delete all shifts before ${beforeDate}? This action cannot be undone.`);
            if (confirmed) {
                try {
                    const result = await apiRequest('DELETE', `/api/shifts?beforeDate=${beforeDate}`);
                    showModalMessage(result.message || 'Old shifts deleted.', false);
                    loadAndRenderWeeklySchedule(currentLocationId); // Refresh the view
                } catch (error) {
                    showModalMessage(`Error deleting old shifts: ${error.message}`, true);
                }
            }
        });
    }
    
    calendarGridWrapper.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-shift-btn')) {
            const shiftId = e.target.dataset.shiftId;
            if (await showConfirmModal('Are you sure you want to delete this shift?')) {
                try {
                    await apiRequest('DELETE', `/api/shifts/${shiftId}`);
                    showModalMessage('Shift deleted!', false);
                    loadAndRenderWeeklySchedule(currentLocationId);
                } catch (error) {
                    showModalMessage(`Error: ${error.message}`, true);
                }
            }
        }
    });
     
    if (locationSelector) {
        locationSelector.addEventListener('change', () => {
            const newLocationId = locationSelector.value;
            if (newLocationId) {
                localStorage.setItem(SUPER_ADMIN_PREF_LOCATION_KEY, newLocationId);
                loadAndRenderWeeklySchedule(newLocationId);
            }
        });
    }

    // --- Initial Page Load ---
    const initializePage = async () => {
        populateTimeSelects();
        
        try {
            const locations = await apiRequest('GET', '/api/locations');
            allLocations = locations;
            
            if (userRole === 'super_admin') {
                locationSelectorContainer.style.display = 'block';
                populateLocationSelector(locations);
                const savedLocationId = localStorage.getItem(SUPER_ADMIN_PREF_LOCATION_KEY);
                let initialLocationId = (savedLocationId && locations.some(l => String(l.location_id) === savedLocationId)) ? savedLocationId : (locations[0]?.location_id || null);
                
                if (initialLocationId) {
                    locationSelector.value = initialLocationId;
                    await loadAndRenderWeeklySchedule(initialLocationId);
                } else {
                     currentWeekDisplay.textContent = 'No Locations';
                     calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please create a location in Admin Settings.</p>';
                }

            } else { // Location Admin
                locationSelectorContainer.style.display = 'none';
                const user = await apiRequest('GET', '/api/users/me');
                if (user && user.location_id) {
                    await loadAndRenderWeeklySchedule(user.location_id);
                } else {
                    showModalMessage('Your account is not assigned to a location. Please contact your administrator.', true);
                    currentWeekDisplay.textContent = 'No Location Assigned';
                }
            }
        } catch (error) {
             showModalMessage(`Failed to initialize scheduling page: ${error.message}`, true);
        }
    };
    
    initializePage();
}

// Helper functions that can be defined outside the main handler
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

