// js/pages/onboardingView.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles the logic for the employee's onboarding view page (new-hire-view.html).
 */
export function handleOnboardingViewPage() {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
        window.location.href = "login.html";
        return;
    }

    const welcomeMessage = document.getElementById('welcome-message');
    const onboardingTaskListDiv = document.getElementById('onboarding-task-list');
    const taskListOverviewDiv = document.getElementById('task-list-overview');
    const onboardingStatusMessageElement = document.getElementById('onboarding-status-message');
    const employeeScheduleListDiv = document.getElementById('employee-schedule-list');
    const printScheduleBtn = document.getElementById('print-employee-schedule-btn');

    let currentUserId = null;
    let userTasks = [];

    const confetti = window.confetti || ((opts) => {
        console.warn('Confetti library not loaded.');
        return Promise.resolve(null);
    });

    function getUserIdFromToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            return payload.id;
        } catch (e) {
            console.error("Error decoding token:", e);
            return null;
        }
    }

    function displayStatusMessage(message, isError = false) {
        if (!onboardingStatusMessageElement) {
            showModalMessage(message, isError);
            return;
        }
        onboardingStatusMessageElement.textContent = message;
        onboardingStatusMessageElement.className = isError ? 'error' : 'success';
        setTimeout(() => onboardingStatusMessageElement.textContent = '', 5000);
    }

    async function loadOnboardingTasks() {
        if (!onboardingTaskListDiv) return;
        onboardingTaskListDiv.innerHTML = '<p>Loading your onboarding tasks...</p>';
        
        try {
            const tasks = await apiRequest('GET', `/api/onboarding-tasks?user_id=${currentUserId}`);
            userTasks = tasks;
            renderOnboardingTasks();
            updateTaskListOverview();
        } catch (error) {
            onboardingTaskListDiv.innerHTML = '<p style="color: #e74c3c;">Error loading tasks.</p>';
        }
    }

    function renderOnboardingTasks() {
        if (!onboardingTaskListDiv) return;
        onboardingTaskListDiv.innerHTML = '';

        if (userTasks && userTasks.length > 0) {
            userTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = `checklist-item ${task.completed ? 'completed' : ''}`;
                taskItem.dataset.taskId = task.id;

                taskItem.innerHTML = `
                    <div class="checklist-item-title">
                        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                        <span>${task.description}</span>
                        ${task.document_name ? `<br><small>Attached: <a href="/uploads/${encodeURIComponent(task.document_name)}" target="_blank">${task.document_name}</a></small>` : ''}
                    </div>
                `;
                onboardingTaskListDiv.appendChild(taskItem);

                taskItem.querySelector('.task-checkbox').addEventListener('change', async (e) => {
                    const isCompleted = e.target.checked;
                    const taskId = e.target.closest('.checklist-item').dataset.taskId;
                    
                    try {
                        await apiRequest('PUT', `/api/onboarding-tasks/${taskId}`, { completed: isCompleted });
                        e.target.closest('.checklist-item').classList.toggle('completed', isCompleted);
                        const updatedTask = userTasks.find(t => String(t.id) === String(taskId));
                        if (updatedTask) updatedTask.completed = isCompleted;
                        updateTaskListOverview();
                        if (userTasks.every(t => t.completed)) triggerFireworks();
                    } catch (error) {
                        e.target.checked = !isCompleted;
                        displayStatusMessage(`Error updating task: ${error.message}`, true);
                    }
                });
            });
        } else {
            onboardingTaskListDiv.innerHTML = '<p>No onboarding tasks assigned yet.</p>';
        }
    }

    function updateTaskListOverview() {
        if (!taskListOverviewDiv) return;
        const completedTasks = userTasks.filter(task => task.completed).length;
        const totalTasks = userTasks.length;
        taskListOverviewDiv.textContent = `${completedTasks}/${totalTasks} tasks complete`;
        if (completedTasks === totalTasks && totalTasks > 0) {
            taskListOverviewDiv.textContent += " - All done!";
            taskListOverviewDiv.style.color = 'var(--primary-accent)';
        } else {
             taskListOverviewDiv.style.color = 'var(--text-light)';
        }
    }

    async function loadEmployeeSchedule() {
        if (!employeeScheduleListDiv) return;
        employeeScheduleListDiv.innerHTML = '<p>Loading your schedule...</p>';

        const today = new Date();
        const startDate = new Date(today.setDate(today.getDate() - today.getDay())).toISOString().split('T')[0];
        const endDate = new Date(today.setDate(today.getDate() + 7)).toISOString().split('T')[0];

        try {
            const shifts = await apiRequest('GET', `/api/shifts?user_id=${currentUserId}&startDate=${startDate}&endDate=${endDate}`);
            employeeScheduleListDiv.innerHTML = '';
            if (shifts && shifts.length > 0) {
                shifts.forEach(shift => {
                    const shiftItem = document.createElement('div');
                    shiftItem.className = 'schedule-list-item';
                    const shiftDate = new Date(shift.start_time);
                    const startTime = shiftDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                    const endTime = new Date(shift.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                    shiftItem.innerHTML = `
                        <strong>${shiftDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
                        <p>${startTime} - ${endTime} at ${shift.location_name}</p>
                    `;
                    employeeScheduleListDiv.appendChild(shiftItem);
                });
            } else {
                employeeScheduleListDiv.innerHTML = '<p>You have no shifts scheduled for this week.</p>';
            }
        } catch (error) {
            employeeScheduleListDiv.innerHTML = '<p style="color: #e74c3c;">Could not load schedule.</p>';
        }
    }

    function triggerFireworks() {
        if (typeof confetti === 'function') {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
    }

    // --- Initial Page Load Actions ---
    currentUserId = getUserIdFromToken(authToken);
    if (!currentUserId) {
        showModalMessage('Could not verify user. Please log in again.', true);
        window.location.href = 'login.html';
        return;
    }

    loadOnboardingTasks();
    loadEmployeeSchedule();

    if(printScheduleBtn) {
        printScheduleBtn.addEventListener('click', () => {
             const printWindow = window.open('', '_blank');
             printWindow.document.write('<html><head><title>Your Weekly Schedule</title>');
             printWindow.document.write('<link rel="stylesheet" href="dist/css/Theme.min.css">');
             printWindow.document.write('<style>body{padding: 20px; background: #fff; color: #000;} .schedule-list-item{padding: 10px 0; border-bottom: 1px solid #ccc;}</style>');
             printWindow.document.write('</head><body>');
             printWindow.document.write('<h1>Your Schedule</h1>');
             printWindow.document.write(employeeScheduleListDiv.innerHTML);
             printWindow.document.write('</body></html>');
             printWindow.document.close();
             printWindow.print();
        });
    }
}
