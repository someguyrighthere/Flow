// js/pages/scheduling.js
import { apiRequest, showModalMessage } from '../utils.js';

export function handleSchedulingPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const calendarGrid = document.getElementById('calendar-grid');
    const timeColumn = document.getElementById('time-column');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const createShiftForm = document.getElementById('create-shift-form');
    
    const employeeSelect = document.getElementById('employee-select');
    const locationSelect = document.getElementById('location-select');

    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);

    function generateTimeSlots() {
        if (!timeColumn) return;
        timeColumn.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'calendar-time-slot';
            const hour = i % 12 === 0 ? 12 : i % 12;
            const ampm = i < 12 ? 'AM' : 'PM';
            timeSlot.textContent = `${hour} ${ampm}`;
            timeColumn.appendChild(timeSlot);
        }
    }

    async function renderCalendar(startDate) {
        if (!calendarGrid || !currentWeekDisplay) return;
        
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        const options = { month: 'short', day: 'numeric' };
        currentWeekDisplay.textContent = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
        
        const oldDayCells = calendarGrid.querySelectorAll('.calendar-day-header, .calendar-day-cell');
        oldDayCells.forEach(cell => cell.remove());
        
        calendarGrid.appendChild(timeColumn.previousElementSibling);
        calendarGrid.appendChild(timeColumn);

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + i);

            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = dayDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            dayHeader.style.gridColumn = i + 2;
            calendarGrid.appendChild(dayHeader);

            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day-cell';
            dayCell.id = `day-cell-${i}`;
            dayCell.style.gridColumn = i + 2;
            dayCell.style.gridRow = `2 / span 24`;
            calendarGrid.appendChild(dayCell);
        }
        
        await loadAndDisplayShifts(startDate, endDate);
    }

    async function loadAndDisplayShifts(start, end) {
        const formatDate = (d) => d.toISOString().split('T')[0];
        let endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        
        try {
            const shifts = await apiRequest('GET', `/shifts?startDate=${formatDate(start)}&endDate=${formatDate(endOfDay)}`);
            document.querySelectorAll('.calendar-shift').forEach(el => el.remove());

            if (shifts && shifts.length > 0) {
                shifts.forEach(shift => {
                    const shiftStart = new Date(shift.start_time);
                    const shiftEnd = new Date(shift.end_time);
                    
                    const dayIndex = shiftStart.getDay();
                    const dayCell = document.getElementById(`day-cell-${dayIndex}`);

                    if (dayCell) {
                        const startHour = shiftStart.getHours();
                        const startMinute = shiftStart.getMinutes();
                        
                        const topPosition = (startHour + startMinute / 60) * 30; // 30px per hour
                        const durationHours = (shiftEnd - shiftStart) / (1000 * 60 * 60);
                        const height = Math.max(15, durationHours * 30);

                        const shiftElement = document.createElement('div');
                        shiftElement.className = 'calendar-shift';
                        shiftElement.style.top = `${topPosition}px`;
                        shiftElement.style.height = `${height}px`;
                        shiftElement.innerHTML = `<strong>${shift.employee_name}</strong><br>${shift.location_name}`;
                        shiftElement.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || 'None'}`;
                        
                        dayCell.appendChild(shiftElement);
                    }
                });
            }
        } catch (error) {
            showModalMessage(`Error loading shifts: ${error.message}`, true);
        }
    }

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
                showModalMessage('Please fill all required fields.', true);
                return;
            }

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
    
    // --- Initial Page Load ---
    generateTimeSlots();
    renderCalendar(currentStartDate);
    populateDropdowns();
}
