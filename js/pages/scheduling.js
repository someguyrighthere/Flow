// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleSchedulingPage() {
    // Security check
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // Get references to key DOM elements
    const calendarGrid = document.getElementById('calendar-grid');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const createShiftForm = document.getElementById('create-shift-form');
    
    const employeeSelect = document.getElementById('employee-select');
    const locationSelect = document.getElementById('location-select');
    const availabilityToggle = document.getElementById('toggle-availability');

    // Initialize state
    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);

    /**
     * Renders the calendar grid for a given week.
     * @param {Date} startDate - The first day (Sunday) of the week to render.
     */
    async function renderCalendar(startDate) {
        if (!calendarGrid || !currentWeekDisplay) return;
        
        try {
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            const options = { month: 'short', day: 'numeric' };
            currentWeekDisplay.textContent = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
            
            calendarGrid.innerHTML = ''; 

            const headerContainer = document.createElement('div');
            headerContainer.className = 'calendar-grid-header';
            calendarGrid.appendChild(headerContainer);

            const timeHeader = document.createElement('div');
            timeHeader.className = 'calendar-day-header';
            timeHeader.innerHTML = `&nbsp;`;
            headerContainer.appendChild(timeHeader);

            for (let i = 0; i < 7; i++) {
                const dayDate = new Date(startDate);
                dayDate.setDate(startDate.getDate() + i);
                const dayHeader = document.createElement('div');
                dayHeader.className = 'calendar-day-header';
                dayHeader.textContent = dayDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
                headerContainer.appendChild(dayHeader);
            }

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
                dayColumn.id = `day-column-${i}`;
                for (let j = 0; j < 24; j++) {
                    const hourLine = document.createElement('div');
                    hourLine.className = 'hour-line';
                    dayColumn.appendChild(hourLine);
                }
                calendarBody.appendChild(dayColumn);
            }

            await Promise.all([
                loadAndDisplayShifts(startDate, endDate),
                loadAndRenderAvailability(),
                loadAndRenderBusinessHours()
            ]);
        } catch (error) {
            console.error("Failed to render calendar:", error);
            if(calendarGrid) calendarGrid.innerHTML = `<p style="color:red; text-align:center;">Could not render calendar. ${error.message}</p>`;
        }
    }

    /**
     * Fetches and displays shifts for the given date range.
     * @param {Date} start - The start date for fetching shifts.
     * @param {Date} end - The end date for fetching shifts.
     */
    async function loadAndDisplayShifts(start, end) {
        document.querySelectorAll('.calendar-shift').forEach(el => el.remove());
        
        const formatDate = (d) => d.toISOString().split('T')[0];
        let endOfDay = new Date(end);
        endOfDay.setDate(endOfDay.getDate() + 1);

        try {
            const shifts = await apiRequest('GET', `/api/shifts?startDate=${formatDate(start)}&endDate=${formatDate(endOfDay)}`);
            
            if (shifts && shifts.length > 0) {
                shifts.forEach(shift => {
                    const shiftStart = new Date(shift.start_time);
                    const shiftEnd = new Date(shift.end_time);
                    const dayIndex = shiftStart.getDay();
                    const dayColumn = document.getElementById(`day-column-${dayIndex}`);

                    if (dayColumn) {
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
        }
    }
    
    /**
     * Fetches and renders employee availability.
     */
    async function loadAndRenderAvailability() {
        document.querySelectorAll('.availability-block').forEach(el => el.remove());
        
        try {
            const employees = await apiRequest('GET', '/api/users/availability');
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

            employees.forEach(employee => {
                if (!employee.availability) return;

                daysOfWeek.forEach((day, index) => {
                    const dayAvailability = employee.availability[day];
                    if (dayAvailability && dayAvailability.start && dayAvailability.end) {
                        const dayColumn = document.getElementById(`day-column-${index}`);
                        if(dayColumn) {
                            const startHour = parseInt(dayAvailability.start.split(':')[0], 10);
                            const endHour = parseInt(dayAvailability.end.split(':')[0], 10);
                            const duration = endHour - startHour;
                            
                            if (duration > 0) {
                                const availabilityBlock = document.createElement('div');
                                availabilityBlock.className = 'availability-block';
                                if (availabilityToggle && !availabilityToggle.checked) {
                                    availabilityBlock.classList.add('hidden');
                                }
                                availabilityBlock.style.top = `${startHour * 60}px`;
                                availabilityBlock.style.height = `${duration * 60}px`;
                                dayColumn.appendChild(availabilityBlock);
                            }
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Failed to load availability:", error.message);
        }
    }

    /**
     * Fetches and renders business operating hours.
     */
    async function loadAndRenderBusinessHours() {
        document.querySelectorAll('.business-hours-block').forEach(el => el.remove());
        try {
            const settings = await apiRequest('GET', '/api/settings/business');
            const businessStartHour = parseInt((settings.operating_hours_start || '00:00').split(':')[0], 10);
            const businessEndHour = parseInt((settings.operating_hours_end || '00:00').split(':')[0], 10);
            const durationHours = businessEndHour - businessStartHour;

            if (durationHours > 0) {
                for (let i = 0; i < 7; i++) {
                    const dayColumn = document.getElementById(`day-column-${i}`);
                    if (dayColumn) {
                        const businessHoursBlock = document.createElement('div');
                        businessHoursBlock.className = 'business-hours-block';
                        businessHoursBlock.style.top = `${businessStartHour * 60}px`;
                        businessHoursBlock.style.height = `${durationHours * 60}px`;
                        dayColumn.appendChild(businessHoursBlock);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load business hours:", error.message);
        }
    }

    /**
     * Populates form dropdowns with employees and locations.
     */
    async function populateDropdowns() {
        try {
            const [users, locations] = await Promise.all([
                apiRequest('GET', '/api/users'),
                apiRequest('GET', '/api/locations')
            ]);
            
            if (employeeSelect) {
                employeeSelect.innerHTML = '<option value="">Select Employee</option>';
                const employees = users.filter(u => u.role === 'employee' || u.role === 'location_admin');
                employees.forEach(user => {
                    const option = new Option(user.full_name, user.user_id);
                    employeeSelect.add(option);
                });
            }

            if (locationSelect) {
                locationSelect.innerHTML = '<option value="">Select Location</option>';
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

    if (calendarGrid) {
        calendarGrid.addEventListener('click', async (e) => {
            const deleteButton = e.target.closest('.delete-shift-btn');
            if (deleteButton) {
                e.stopPropagation();
                const shiftIdToDelete = String(deleteButton.dataset.shiftId);
                if (!shiftIdToDelete || shiftIdToDelete === "undefined") {
                    return showModalMessage('Shift ID not found.', true);
                }
                const isConfirmed = await showConfirmModal('Are you sure you want to delete this shift?');
                if (isConfirmed) {
                    try {
                        await apiRequest('DELETE', `/api/shifts/${shiftIdToDelete}`);
                        showModalMessage('Shift deleted successfully!', false);
                        renderCalendar(currentStartDate);
                    } catch (error) {
                        showModalMessage(`Error deleting shift: ${error.message}`, true);
                    }
                }
            }
        });
    }

    if (availabilityToggle) {
        availabilityToggle.addEventListener('change', () => {
            document.querySelectorAll('.availability-block').forEach(block => {
                block.classList.toggle('hidden', !availabilityToggle.checked);
            });
        });
    }
    
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentStartDate.setDate(currentStartDate.getDate() - 7);
            renderCalendar(currentStartDate);
        });
    }

    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => { 
            currentStartDate.setDate(currentStartDate.getDate() + 7);
            renderCalendar(currentStartDate);
        });
    } 
    
    if (createShiftForm) {
        createShiftForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const shiftData = {
                employee_id: document.getElementById('employee-select').value,
                location_id: document.getElementById('location-select').value,
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
                renderCalendar(currentStartDate);
            } catch (error) {
                showModalMessage(`Error creating shift: ${error.message}`, true);
            }
        });
    }
    
    // --- Initial Page Load Actions ---
    renderCalendar(currentStartDate);
    populateDropdowns();
}
