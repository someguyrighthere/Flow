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

    // --- NEW: Availability Toggle ---
    const availabilityToggle = document.getElementById('toggle-availability');

    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);

    function generateTimeSlots() {
        // ... (this function remains the same)
    }

    async function renderCalendar(startDate) {
        if (!calendarGrid || !currentWeekDisplay) return;
        
        // ... (existing calendar rendering logic remains the same)

        // Clear previous day cells and headers
        const oldDayCells = calendarGrid.querySelectorAll('.calendar-day-header:not(:first-child), .calendar-day-cell');
        oldDayCells.forEach(cell => cell.remove());
        
        for (let i = 0; i < 7; i++) {
            // ... (existing day header and cell creation logic)
        }
        
        // Load both shifts and availability
        await Promise.all([
            loadAndDisplayShifts(startDate, endDate),
            loadAndRenderAvailability() // *** NEW FUNCTION CALL ***
        ]);
    }

    async function loadAndDisplayShifts(start, end) {
        // ... (this function remains the same)
    }
    
    // *** NEW FUNCTION to load and display availability ***
    async function loadAndRenderAvailability() {
        // Clear previous availability blocks
        document.querySelectorAll('.availability-block').forEach(el => el.remove());
        
        try {
            const employees = await apiRequest('GET', '/users/availability');
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

            employees.forEach(employee => {
                if (!employee.availability) return;

                daysOfWeek.forEach((day, index) => {
                    const dayAvailability = employee.availability[day];
                    if (dayAvailability && dayAvailability.start && dayAvailability.end) {
                        const dayCell = document.getElementById(`day-cell-${index}`);
                        if (dayCell) {
                            const startHour = parseFloat(dayAvailability.start.split(':')[0]);
                            const endHour = parseFloat(dayAvailability.end.split(':')[0]);

                            if (endHour > startHour) {
                                const topPosition = startHour * 30; // 30px per hour
                                const durationHours = endHour - startHour;
                                const height = durationHours * 30;

                                const availabilityBlock = document.createElement('div');
                                availabilityBlock.className = 'availability-block';
                                if (!availabilityToggle.checked) {
                                    availabilityBlock.classList.add('hidden');
                                }
                                availabilityBlock.style.top = `${topPosition}px`;
                                availabilityBlock.style.height = `${height}px`;
                                availabilityBlock.title = `${employee.full_name} is available`;
                                dayCell.appendChild(availabilityBlock);
                            }
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Failed to load availability:", error);
            // Don't show a modal for this, as it's a background feature
        }
    }

    async function populateDropdowns() {
        // ... (this function remains the same)
    }

    // --- Event Handlers ---
    
    // *** NEW: Add event listener for the availability toggle ***
    if (availabilityToggle) {
        availabilityToggle.addEventListener('change', () => {
            const blocks = document.querySelectorAll('.availability-block');
            blocks.forEach(block => {
                block.classList.toggle('hidden', !availabilityToggle.checked);
            });
        });
    }

    // ... (rest of your event handlers remain the same)
    
    // --- Initial Page Load ---
    generateTimeSlots();
    renderCalendar(currentStartDate);
    populateDropdowns();
}
