// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleSchedulingPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

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

    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);

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

    async function renderCalendar(startDate) {
        if (!calendarGrid || !currentWeekDisplay) return;
        
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        const options = { month: 'short', day: 'numeric' };
        currentWeekDisplay.textContent = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
        
        calendarGrid.innerHTML = '';

        // Header Row
        const headerRow = document.createElement('div');
        headerRow.className = 'calendar-header-row';
        headerRow.style.display = 'contents'; // Make it part of the grid
        calendarGrid.appendChild(headerRow);
        
        const timeHeader = document.createElement('div');
        timeHeader.className = 'calendar-day-header';
        timeHeader.textContent = 'Time';
        timeHeader.style.gridColumn = '1';
        timeHeader.style.gridRow = '1';
        headerRow.appendChild(timeHeader);

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + i);
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = dayDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            dayHeader.style.gridColumn = `${i + 2}`;
            dayHeader.style.gridRow = '1';
            headerRow.appendChild(dayHeader);
        }

        // Time Column & Day Columns
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour < 12 ? 'AM' : 'PM';
            timeSlot.textContent = `${displayHour} ${ampm}`;
            timeSlot.style.gridRow = `${hour + 2}`;
            timeSlot.style.gridColumn = '1';
            calendarGrid.appendChild(timeSlot);
        }

        for (let day = 0; day < 7; day++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            dayColumn.id = `day-column-${day}`;
            dayColumn.style.gridRow = '2 / 26';
            dayColumn.style.gridColumn = `${day + 2}`;
            calendarGrid.appendChild(dayColumn);
        }

        await Promise.all([
            loadAndDisplayShifts(startDate, endDate),
            loadAndRenderAvailability()
        ]);
    }

    async function loadAndDisplayShifts(start, end) {
        document.querySelectorAll('.calendar-shift').forEach(el => el.remove());
        const formatDate = (d) => d.toISOString().split('T')[0];
        let endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        
        try {
            const shifts = await apiRequest('GET', `/shifts?startDate=${formatDate(start)}&endDate=${formatDate(endOfDay)}`);
            if (shifts && shifts.length > 0) {
                shifts.forEach(shift => {
                    const shiftStart = new Date(shift.start_time);
                    const shiftEnd = new Date(shift.end_time);
                    
                    const dayIndex = shiftStart.getDay();
                    const dayColumn = document.getElementById(`day-column-${dayIndex}`);

                    if (dayColumn) {
                        const startPixels = (shiftStart.getHours() * 60) + shiftStart.getMinutes();
                        const endPixels = (shiftEnd.getHours() * 60) + shiftEnd.getMinutes();
                        const heightPixels = endPixels - startPixels;
                        
                        const shiftElement = document.createElement('div');
                        shiftElement.className = 'calendar-shift';
                        shiftElement.style.top = `${startPixels}px`;
                        shiftElement.style.height = `${heightPixels}px`;
                        
                        const timeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
                        const startTimeString = shiftStart.toLocaleTimeString('en-US', timeFormatOptions);
                        const endTimeString = shiftEnd.toLocaleTimeString('en-US', timeFormatOptions);

                        shiftElement.innerHTML = `
                            <strong>${shift.employee_name}</strong><br>
                            <span style="font-size: 0.9em;">${startTimeString} - ${endTimeString}</span><br>
                            <span style="color: #ddd;">${shift.location_name}</span>
                        `;
                        shiftElement.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || 'None'}`;
                        
                        dayColumn.appendChild(shiftElement);
                    }
                });
            }
        } catch (error) {
            showModalMessage(`Error loading shifts: ${error.message}`, true);
        }
    }
    
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
                            const startHour = parseInt(dayAvailability.start.split(':')[0], 10);
                            const endHour = parseInt(dayAvailability.end.split(':')[0], 10);
                            const duration = endHour - startHour;
                            
                            if (duration > 0) {
                                const availabilityBlock = document.createElement('div');
                                availabilityBlock.className = 'availability-block';
                                if (!availabilityToggle.checked) {
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
            console.error("Failed to load availability:", error);
        }
    }

    async function populateDropdowns() {
        // ... (this function remains the same)
    }

    // --- Event Handlers ---
    // ... (event handlers remain the same)
    
    // --- Initial Page Load ---
    createDailyHoursInputs();
    renderCalendar(currentStartDate);
    populateDropdowns();
}
