import { apiRequest } from '../utils.js';

export function handlePrintableSchedulePage() {
    const scheduleContainer = document.getElementById('schedule-container');

    const urlParams = new URLSearchParams(window.location.search);
    const startDate = urlParams.get('startDate');
    const endDate = urlParams.get('endDate');
    const locationId = urlParams.get('locationId');
    const locationName = urlParams.get('locationName');

    if (!startDate || !endDate || !locationId) {
        scheduleContainer.innerHTML = '<p>Error: Missing schedule information.</p>';
        return;
    }

    async function loadAndRenderPrintableSchedule() {
        try {
            const shifts = await apiRequest('GET', `/api/shifts?startDate=${startDate}&endDate=${endDate}&location_id=${locationId}`);
            
            const weekEndingDate = new Date(endDate);
            weekEndingDate.setDate(weekEndingDate.getDate() - 1);

            let tableHtml = `
                <div class="schedule-header">
                    <h1>Work Schedule</h1>
                </div>
                <div class="schedule-info">
                    <span><strong>Location:</strong> ${locationName}</span>
                    <span><strong>Week Ending:</strong> ${weekEndingDate.toLocaleDateString()}</span>
                </div>
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Sun</th>
                            <th>Mon</th>
                            <th>Tue</th>
                            <th>Wed</th>
                            <th>Thu</th>
                            <th>Fri</th>
                            <th>Sat</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            const employees = {};
            shifts.forEach(shift => {
                if (!employees[shift.employee_name]) {
                    employees[shift.employee_name] = Array(7).fill('');
                }
                const shiftDate = new Date(shift.start_time);
                const dayIndex = shiftDate.getDay();
                const startTime = shiftDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                const endTime = new Date(shift.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                employees[shift.employee_name][dayIndex] += `<div>${startTime} - ${endTime}</div>`;
            });

            for (const [name, schedule] of Object.entries(employees)) {
                tableHtml += `<tr><td>${name}</td>`;
                schedule.forEach(dayHtml => {
                    tableHtml += `<td>${dayHtml}</td>`;
                });
                tableHtml += `</tr>`;
            }

            tableHtml += `
                    </tbody>
                </table>
            `;

            scheduleContainer.innerHTML = tableHtml;

        } catch (error) {
            scheduleContainer.innerHTML = `<p>Error loading schedule: ${error.message}</p>`;
        }
    }

    loadAndRenderPrintableSchedule();
}
