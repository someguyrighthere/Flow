// js/pages/onboardingView.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

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
    const messagesContainer = document.getElementById('messages-container');
    const onboardingInfoContainer = document.getElementById('onboarding-info-container');
    const onboardingTaskListDiv = document.getElementById('onboarding-task-list');
    const taskListOverviewDiv = document.getElementById('task-list-overview');
    const employeeScheduleListDiv = document.getElementById('employee-schedule-list');
    const printScheduleBtn = document.getElementById('print-employee-schedule-btn');

    let currentUserId = null;

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

    async function loadWelcomeMessage() {
        if (!welcomeMessage) return;
        try {
            const user = await apiRequest('GET', '/api/users/me');
            const userName = user && user.full_name ? user.full_name.split(' ')[0] : 'Employee';
            welcomeMessage.textContent = `Welcome, ${userName}!`;
        } catch (error) {
            console.error("Failed to fetch user for welcome message:", error);
            welcomeMessage.textContent = 'Welcome!';
        }
    }

    async function loadMessages() {
        if (!messagesContainer) return;
        try {
            const messages = await apiRequest('GET', '/api/messages');
            messagesContainer.innerHTML = '';
            if (messages && messages.length > 0) {
                const messagesHeader = document.createElement('h3');
                messagesHeader.textContent = "Messages for You";
                messagesContainer.appendChild(messagesHeader);

                messages.forEach(msg => {
                    const msgItem = document.createElement('div');
                    msgItem.className = 'message-item';
                    
                    msgItem.innerHTML = `
                        <p>${msg.content}</p> 
                        <div class="message-actions">
                            ${!msg.is_read ? '<span class="new-message-indicator">New</span>' : ''}
                            <button class="btn btn-danger btn-sm delete-message-btn" data-message-id="${msg.message_id}">Delete</button>
                        </div>
                    `;
                    messagesContainer.appendChild(msgItem);
                });
            }
        } catch (error) {
            console.error("Failed to load messages:", error);
        }
    }

    messagesContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-message-btn')) {
            const messageId = e.target.dataset.messageId;
            
            const confirmed = await showConfirmModal("Are you sure you want to permanently delete this message?");

            if (confirmed) {
                try {
                    await apiRequest('DELETE', `/api/messages/${messageId}`);
                    e.target.closest('.message-item').remove();
                } catch (error) {
                    showModalMessage(`Could not delete message: ${error.message}`, true);
                }
            }
        }
    });

    // ... (rest of the functions like loadOnboardingTasks, loadEmployeeSchedule, etc. are unchanged) ...
    async function loadOnboardingTasks() {
        if (!onboardingTaskListDiv) return;
        onboardingTaskListDiv.innerHTML = '<p>Loading your onboarding tasks...</p>';
        
        try {
            const tasks = await apiRequest('GET', `/api/onboarding-tasks?user_id=${currentUserId}`);
            renderOnboardingTasks(tasks);
        } catch (error) {
            onboardingTaskListDiv.innerHTML = '<p style="color: #e74c3c;">Error loading tasks.</p>';
        }
    }

    function renderOnboardingTasks(tasks) {
        if (!onboardingTaskListDiv) return;
        onboardingTaskListDiv.innerHTML = '';

        if (tasks && tasks.length > 0) {
            onboardingInfoContainer.style.display = 'block';
            tasks.forEach(task => {
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
            });
        } else {
            if (onboardingInfoContainer) onboardingInfoContainer.style.display = 'none';
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

    // --- Initial Page Load Actions ---
    currentUserId = getUserIdFromToken(authToken);
    if (!currentUserId) {
        showModalMessage('Could not verify user. Please log in again.', true);
        window.location.href = 'login.html';
        return;
    }

    loadWelcomeMessage();
    loadMessages();
    loadOnboardingTasks();
    loadEmployeeSchedule();
}
