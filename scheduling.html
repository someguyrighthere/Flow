// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleSchedulingPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const calendarGrid = document.getElementById('calendar-grid');
    // ... (other element selections)

    // ... (all other functions remain the same up to loadAndDisplayShifts)

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

                        // *** MODIFIED: Added delete button to the shift element ***
                        shiftElement.innerHTML = `
                            <strong>${shift.employee_name}</strong><br>
                            <span style="font-size: 0.9em;">${startTimeString} - ${endTimeString}</span><br>
                            <span style="color: #ddd;">${shift.location_name}</span>
                            <button class="delete-shift-btn" data-shift-id="${shift.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                            </button>
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

    // ... (loadAndRenderAvailability and populateDropdowns remain the same)

    // --- Event Handlers ---

    // *** NEW: Event listener for deleting shifts ***
    if (calendarGrid) {
        calendarGrid.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-shift-btn');
            if (deleteBtn) {
                e.stopPropagation(); // Prevent other click events
                const shiftId = deleteBtn.dataset.shiftId;
                const confirmed = await showConfirmModal('Are you sure you want to delete this shift?');
                if (confirmed) {
                    try {
                        await apiRequest('DELETE', `/shifts/${shiftId}`);
                        showModalMessage('Shift deleted successfully.', false);
                        renderCalendar(currentStartDate); // Refresh calendar
                    } catch (error) {
                        showModalMessage(`Error deleting shift: ${error.message}`, true);
                    }
                }
            }
        });
    }

    // ... (rest of the event handlers)
}
