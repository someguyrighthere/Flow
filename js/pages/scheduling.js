// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

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

    const availabilityToggle = document.getElementById('toggle-availability');
    
    // --- NEW: Auto-generate button ---
    const autoGenerateBtn = document.getElementById('auto-generate-schedule-btn');

    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);

    function generateTimeSlots() {
        // ... (this function remains the same)
    }

    async function renderCalendar(startDate) {
        // ... (this function remains the same)
    }

    async function loadAndDisplayShifts(start, end) {
        // ... (this function remains the same)
    }
    
    async function loadAndRenderAvailability() {
        // ... (this function remains the same)
    }

    async function populateDropdowns() {
        // ... (this function remains the same)
    }

    // --- Event Handlers ---

    // *** NEW: Event listener for auto-generate button ***
    if (autoGenerateBtn) {
        autoGenerateBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmModal(
                `This will attempt to auto-generate shifts for the week of ${currentStartDate.toLocaleDateString()}. Existing shifts will not be affected. Do you want to continue?`,
                'Generate'
            );

            if (confirmed) {
                try {
                    const response = await apiRequest('POST', '/shifts/auto-generate', { 
                        weekStartDate: currentStartDate.toISOString() 
                    });
                    showModalMessage(response.message || 'Schedule generation complete!', false);
                    // Rerender the calendar to show the new shifts
                    await renderCalendar(currentStartDate);
                } catch (error) {
                    showModalMessage(`Auto-scheduling failed: ${error.message}`, true);
                }
            }
        });
    }

    if (availabilityToggle) {
        // ... (this handler remains the same)
    }

    // ... (rest of your event handlers remain the same)
    
    // --- Initial Page Load ---
    generateTimeSlots();
    renderCalendar(currentStartDate);
    populateDropdowns();
}
