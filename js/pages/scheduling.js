// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the scheduling page.
 */
export function handleSchedulingPage() {
    // Security check
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Element Selection ---
    const calendarGrid = document.getElementById('calendar-grid');
    const timeColumn = document.getElementById('time-column');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const createShiftForm = document.getElementById('create-shift-form');

    // --- State Management ---
    let currentStartDate = new Date();
    // Adjust to the beginning of the week (Sunday)
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());

    // --- Calendar Generation ---

    /**
     * Generates the time slots for the calendar (e.g., 12 AM, 1 AM).
     */
    function generateTimeSlots() {
        if (!timeColumn) return;
        timeColumn.innerHTML = ''; // Clear existing
        for (let i = 0; i < 24; i++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'calendar-time-slot';
            const hour = i % 12 === 0 ? 12 : i % 12;
            const ampm = i < 12 ? 'AM' : 'PM';
            timeSlot.textContent = `${hour} ${ampm}`;
            timeColumn.appendChild(timeSlot);
        }
    }

    /**
     * Renders the entire calendar for the week starting on the given date.
     * @param {Date} startDate - The starting date of the week (should be a Sunday).
     */
    async function renderCalendar(startDate) {
        if (!calendarGrid || !currentWeekDisplay) return;
        
        // --- Update Week Display Header ---
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        const options = { month: 'short', day: 'numeric' };
        currentWeekDisplay.textContent = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
        
        // --- Clear and Rebuild Day Columns ---
        // Clear everything except the time column elements
        calendarGrid.innerHTML = ''; 
        calendarGrid.appendChild(timeColumn.previousElementSibling); // Re-add Time header
        calendarGrid.appendChild(timeColumn);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + i);
            days.push(dayDate);

            // Create Day Header
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = dayDate.toLocaleDateString(undefined, { weekday: 'short' });
            dayHeader.style.gridColumn = i + 2;
            dayHeader.style.gridRow = 1;
            calendarGrid.appendChild(dayHeader);

            // Create Day Cell Container
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day-cell';
            dayCell.id = `day-cell-${i}`;
            dayCell.style.gridColumn = i + 2;
            dayCell.style.gridRow = `2 / span 24`;
            calendarGrid.appendChild(dayCell);
        }
        
        // --- Load and Display Shifts ---
        await loadAndDisplayShifts(startDate, endDate);
    }

    /**
     * Fetches shifts for the given date range and displays them on the calendar.
     * @param {Date} start - The start of the date range.
     * @param {Date} end - The end of the date range.
     */
    async function loadAndDisplayShifts(start, end) {
        // Format dates to YYYY-MM-DD for the API request
        const formatDate = (d) => d.toISOString().split('T')[0];
        try {
            const shifts = await apiRequest('GET', `/shifts?startDate=${formatDate(start)}&endDate=${formatDate(end)}`);
            if (shifts && shifts.length > 0) {
                shifts.forEach(shift => {
                    const shiftStart = new Date(shift.start_time);
                    const shiftEnd = new Date(shift.end_time);
                    
                    const dayIndex = shiftStart.getDay();
                    const dayCell = document.getElementById(`day-cell-${dayIndex}`);

                    if (dayCell) {
                        const startHour = shiftStart.getHours();
                        const startMinute = shiftStart.getMinutes();
                        const endHour = shiftEnd.getHours();
                        const endMinute = shiftEnd.getMinutes();
                        
                        // Calculate position and height
                        const topPosition = (startHour + startMinute / 60) * 30; // 30px per hour
                        const durationHours = (shiftEnd - shiftStart) / (1000 * 60 * 60);
                        const height = durationHours * 30;

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


    // --- Event Handlers ---

    // Week navigation buttons
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

    // Create new shift form submission
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
                renderCalendar(currentStartDate); // Refresh calendar
            } catch (error) {
                showModalMessage(`Error creating shift: ${error.message}`, true);
            }
        });
    }
    
    // --- Initial Page Load ---
    generateTimeSlots();
    renderCalendar(currentStartDate);
    // NOTE: You would also need functions to populate the employee and location dropdowns in the sidebar.
}
