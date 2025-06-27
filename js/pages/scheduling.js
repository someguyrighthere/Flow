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
    currentStartDate.setHours(0, 0, 0, 0); // Ensure it's local midnight for consistency

    // Define the constant offset for visual alignment (30 minutes = 30 pixels)
    // This value was determined by visual inspection and remains for now.
    const VISUAL_OFFSET_MINUTES = 30; 

    /**
     * Dynamically creates input fields for setting target daily hours for each day of the week.
     * These inputs are used in the auto-scheduling feature.
     */
    function createDailyHoursInputs() {
        if (!dailyHoursContainer) return;
        dailyHoursContainer.innerHTML = '';
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach(day => {
            const dayId = day.toLowerCase();
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
     * @param {Date} startDate - The Date object representing the first day (Sunday) of the week to render.
     */
    async function renderCalendar(startDate) {
        if (!calendarGrid || !currentWeekDisplay) return;
        
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
    }

    /**
     * Fetches shift data from the backend API and renders each shift as a visual block.
     * @param {Date} start - The start date for fetching shifts.
     * @param {Date} end - The end date for fetching shifts.
     */
    async function loadAndDisplayShifts(start, end) {
        document.querySelectorAll('.calendar-shift').forEach(el => el.remove());
        
        const formatDate = (d) => d.toISOString().split('T')[0];
        
        let endOfDay = new Date(end);
        endOfDay.setDate(endOfDay.getDate() + 1);

        try {
            const shifts = await apiRequest('GET', `/shifts?startDate=${formatDate(start)}&endDate=${formatDate(endOfDay)}`);
            
            if (shifts && shifts.length > 0) {
                shifts.forEach(shift => {
                    // FIX: Create Date objects directly from the raw string.
                    // The Date object constructor handles ISO 8601 strings (like "2025-06-23T09:00:00.000Z") correctly.
                    // This will create a Date object in the browser's local timezone.
                    const shiftStartDateTime = new Date(shift.start_time); 
                    const shiftEndDateTime = new Date(shift.end_time);     
                    
                    // FIX: Get hours and minutes using LOCAL methods (getHours, getMinutes)
                    // since the Date object is now in the browser's local timezone.
                    const shiftStartTotalMinutes = (shiftStartDateTime.getHours() * 60) + shiftStartDateTime.getMinutes();
                    const shiftEndTotalMinutes = (shiftEndDateTime.getHours() * 60) + shiftEndDateTime.getMinutes();
                    const heightMinutes = shiftEndTotalMinutes - shiftStartTotalMinutes;
                    
                    // To get the day index (0-6 for Sun-Sat), use getDay() for consistency with local time.
                    const shiftDayOfWeek = shiftStartDateTime.getDay(); 
                    const dayColumn = document.getElementById(`day-column-${shiftDayOfWeek}`);

                    if (dayColumn) {
                        const shiftElement = document.createElement('div');
                        shiftElement.className = 'calendar-shift';
                        shiftElement.style.top = `${shiftStartTotalMinutes + VISUAL_OFFSET_MINUTES}px`; // Add offset
                        shiftElement.style.height = `${heightMinutes}px`;
                        
                        const timeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true }; 
                        // Now, toLocaleTimeString will correctly format the local time from shiftStartDateTime.
                        const startTimeString = shiftStartDateTime.toLocaleTimeString('en-US', timeFormatOptions);
                        const endTimeString = shiftEndDateTime.toLocaleTimeString('en-US', timeFormatOptions);

                        shiftElement.innerHTML = `
                            <strong>${shift.employee_name}</strong><br>
                            <span style="font-size: 0.9em;">${startTimeString} - ${endTimeString}</span><br>
                            <span style="color: #ddd;">${shift.location_name || ''}</span>
                            <button class="delete-shift-btn" data-shift-id="${shift.id}" title="Delete Shift">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1 0-.708z"/></svg>
                            </button>
                        `;
                        shiftElement.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || 'None'}`;
                        
                        dayColumn.appendChild(shiftElement);

                        // --- DEBUG LOGS (SCHEDULING: SHIFT RENDERING) ---
                        console.log(`[SCHEDULING-DEBUG] Shift Render: Raw Start: ${shift.start_time}, Raw End: ${shift.end_time}`);
                        console.log(`[SCHEDULING-DEBUG] Shift Render: Local Start Hour: ${shiftStartDateTime.getHours()}, Minute: ${shiftStartDateTime.getMinutes()}`);
                        console.log(`[SCHEDULING-DEBUG] Shift Render: Local End Hour: ${shiftEndDateTime.getHours()}, Minute: ${shiftEndDateTime.getMinutes()}`);
                        console.log(`[SCHEDULING-DEBUG] Shift Render: Start Minutes for TOP: ${shiftStartTotalMinutes}`);
                        console.log(`[SCHEDULING-DEBUG] Shift Render: Height Minutes: ${heightMinutes}`);
                        // --- END DEBUG LOGS ---
                    }
                });
            }
        }
        catch (error) {
            showModalMessage(`Error loading shifts: ${error.message}`, true);
        }
    }
    
    /**
     * Fetches employee availability and renders it as blocks on the calendar.
     */
    async function loadAndRenderAvailability() {
        document.querySelectorAll('.availability-block').forEach(el => el.remove());
        
        try {
            const employees = await apiRequest('GET', '/users/availability');
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

            employees.forEach(employee => {
                if (!employee.availability) return;

                daysOfWeek.forEach((day, index) => {
                    const dayAvailability = employee.availability[day];
                    if (dayAvailability && dayAvailability.start && dayAvailability.end) {
                        const dayColumn = document.getElementById(`day-column-${index}`);
                        if(dayColumn) {
                            const startTotalMinutes = parseInt(dayAvailability.start.split(':')[0], 10) * 60 + parseInt(dayAvailability.start.split(':')[1], 10);
                            const endTotalMinutes = parseInt(dayAvailability.end.split(':')[0], 10) * 60 + parseInt(dayAvailability.end.split(':')[1], 10);
                            const durationMinutes = endTotalMinutes - startTotalMinutes;
                            
                            if (durationMinutes > 0) {
                                const availabilityBlock = document.createElement('div');
                                availabilityBlock.className = 'availability-block';
                                if (availabilityToggle && !availabilityToggle.checked) {
                                    availabilityBlock.classList.add('hidden');
                                }
                                availabilityBlock.style.top = `${startTotalMinutes + VISUAL_OFFSET_MINUTES}px`; // Add offset
                                availabilityBlock.style.height = `${durationMinutes}px`;
                                dayColumn.appendChild(availabilityBlock);
                            }
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Failed to load availability:", error);
        }
    }

    /**
     * NEW FUNCTION: Fetches and renders the business operating hours as a subtle background.
     */
    async function loadAndRenderBusinessHours() {
        document.querySelectorAll('.business-hours-block').forEach(el => el.remove());

        try {
            const settings = await apiRequest('GET', '/settings/business');
            const businessStartHour = parseInt((settings.operating_hours_start || '00:00').split(':')[0], 10);
            const businessStartMinute = parseInt((settings.operating_hours_start || '00:00').split(':')[1], 10);
            const businessEndHour = parseInt((settings.operating_hours_end || '00:00').split(':')[0], 10);
            const businessEndMinute = parseInt((settings.operating_hours_end || '00:00').split(':')[1], 10);

            // Calculate total minutes for rendering based on fetched business hours
            const businessStartTotalMinutes = businessStartHour * 60 + businessStartMinute;
            const businessEndTotalMinutes = businessEndHour * 60 + businessEndMinute;
            const durationMinutes = businessEndTotalMinutes - businessStartTotalMinutes;

            if (durationMinutes > 0) {
                for (let i = 0; i < 7; i++) {
                    const dayColumn = document.getElementById(`day-column-${i}`);
                    if (dayColumn) {
                        const businessHoursBlock = document.createElement('div');
                        businessHoursBlock.className = 'business-hours-block';
                        businessHoursBlock.style.top = `${businessStartTotalMinutes + VISUAL_OFFSET_MINUTES}px`; // Add offset
                        businessHoursBlock.style.height = `${durationMinutes}px`;
                        dayColumn.appendChild(businessHoursBlock);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load or render business operating hours:", error);
        }
    }

    /**
     * Populates the employee and location dropdowns in the shift creation form.
     */
    async function populateDropdowns() {
        try {
            const [users, locations] = await Promise.all([
                apiRequest('GET', '/users'),
                apiRequest('GET', '/locations')
            ]);
            
            if (employeeSelect) {
                employeeSelect.innerHTML = '<option value="">Select Employee</option>';
                const employees = users.filter(u => u.role === 'employee');
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
                if (!shiftIdToDelete || shiftIdToDelete === "undefined" || shiftIdToDelete === "null") {
                    showModalMessage('Shift ID not found. Cannot delete.', true);
                    return;
                }
                const isConfirmed = await showConfirmModal('Are you sure you want to delete this shift? This action cannot be undone.');
                if (isConfirmed) {
                    try {
                        await apiRequest('DELETE', `/shifts/${shiftIdToDelete}`);
                        showModalMessage('Shift deleted successfully!', false);
                        renderCalendar(currentStartDate);
                    } catch (error) {
                        showModalMessage(`Error deleting shift: ${error.message}`, true);
                    }
                } else {
                    showModalMessage('Shift deletion cancelled.', false);
                }
            }
        });
    }

    if (autoGenerateBtn) {
        autoGenerateBtn.addEventListener('click', async () => {
            const dailyHours = {};
            document.querySelectorAll('.daily-hours-input').forEach(input => {
                dailyHours[input.dataset.day] = input.value;
            });
            
            const confirmed = await showConfirmModal(
                `This will attempt to generate a schedule based on the specified daily hours. Do you want to continue?`,
                'Generate'
            );

            if (confirmed) {
                try {
                    const response = await apiRequest('POST', '/shifts/auto-generate', { 
                        weekStartDate: currentStartDate.toISOString(), // Send as ISO string
                        dailyHours: dailyHours
                    });
                    showModalMessage(response.message || 'Schedule generation complete!', false);
                    await renderCalendar(currentStartDate);
                } catch (error) {
                    showModalMessage(`Auto-scheduling failed: ${error.message}`, true);
                }
            }
        });
    }

    if (availabilityToggle) {
        availabilityToggle.addEventListener('change', () => {
            const blocks = document.querySelectorAll('.availability-block');
            blocks.forEach(block => {
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
            const rawStartTime = document.getElementById('start-time-input').value;
            const rawEndTime = document.getElementById('end-time-input').value;

            const shiftData = {
                employee_id: document.getElementById('employee-select').value,
                location_id: document.getElementById('location-select').value,
                // Use a custom format for TIMESTAMP WITHOUT TIME ZONE
                start_time: `${rawStartTime.split('T')[0]} ${rawStartTime.split('T')[1]}:00`,
                end_time: `${rawEndTime.split('T')[0]} ${rawEndTime.split('T')[1]}:00`,
                notes: document.getElementById('notes-input').value
            };

            if (!shiftData.employee_id || !shiftData.location_id || !rawStartTime || !rawEndTime) {
                showModalMessage('Please fill all required fields.', true);
                return;
            }

            console.log("Client sending start_time (formatted for TIMESTAMP):", shiftData.start_time);
            console.log("Client sending end_time (formatted for TIMESTAMP):", shiftData.end_time);

            try {
                await apiRequest('POST', '/shifts', shiftData);
                showModalMessage('Shift created successfully!', false);
                createShiftForm.reset();
                renderCalendar(currentStartDate);
            } catch (error) {
                showModalMessage(`Error creating shift: ${error.message}`, true);
            }
        });
    }
    
    /**
     * Helper function to generate <option> tags for time select inputs.
     * Generates options in 15-minute intervals.
     * @param {number} startHour - The starting hour for options (inclusive).
     * @param {number} endHour - The ending hour for options (exclusive).
     * @returns {string} HTML string of time options.
     */
    function generateTimeOptions(startHour = 0, endHour = 24) {
        let options = '<option value="">Not Available</option>';
        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const hourFormatted = hour < 10 ? `0${hour}` : `${hour}`;
                const minuteFormatted = minute < 10 ? `0${minute}` : `${minute}`;
                const timeValue = `${hourFormatted}:${minuteFormatted}`;
                options += `<option value="${timeValue}">${timeValue}</option>`;
            }
        }
        return options;
    }


    // --- Initial Page Load Actions ---
    createDailyHoursInputs();
    renderCalendar(currentStartDate);
    populateDropdowns();
}
