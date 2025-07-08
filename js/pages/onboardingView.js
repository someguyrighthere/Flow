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
    const taskListOverviewDiv = document.getElementById('taskList-overview'); // Corrected ID to match HTML
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

    async function loadOnboardingTasks() {
        if (!onboardingTaskListDiv) return;
        onboardingTaskListDiv.innerHTML = '<p>Loading your onboarding tasks...</p>';
        
        try {
            const tasks = await apiRequest('GET', `/api/onboarding-tasks?user_id=${currentUserId}`);
            renderOnboardingTasks(tasks);
        } catch (error) {
            onboardingTaskListDiv.innerHTML = '<p style="color: #e74c3c;">Error loading tasks.</p>';
            console.error('Error loading onboarding tasks:', error); // Added detailed error log
        }
    }

    function renderOnboardingTasks(tasks) {
        if (!onboardingTaskListDiv) return;
        onboardingTaskListDiv.innerHTML = '';

        if (tasks && tasks.length > 0) {
            onboardingInfoContainer.style.display = 'block';
            
            // Filter out completed tasks for display
            const incompleteTasks = tasks.filter(task => !task.completed);

            if (incompleteTasks.length > 0) {
                incompleteTasks.forEach(task => {
                    const taskItem = document.createElement('div');
                    taskItem.className = `checklist-item`; // No 'completed' class here as we only show incomplete
                    taskItem.dataset.taskId = task.id;

                    taskItem.innerHTML = `
                        <div class="checklist-item-title">
                            <input type="checkbox" class="task-checkbox" data-task-id="${task.id}">
                            <span>${task.description}</span>
                            ${task.document_name ? `<br><small>Attached: <a href="${task.document_name}" target="_blank">${task.document_name.split('/').pop()}</a></small>` : ''}
                        </div>
                    `;
                    onboardingTaskListDiv.appendChild(taskItem);
                });
            } else {
                onboardingTaskListDiv.innerHTML = '<p>All assigned tasks completed! Great job!</p>';
            }

            // Update task list overview (always based on all tasks, including completed)
            const completedTasksCount = tasks.filter(task => task.completed).length;
            const totalTasks = tasks.length;
            if (taskListOverviewDiv) {
                taskListOverviewDiv.textContent = `You have completed ${completedTasksCount} of ${totalTasks} tasks.`;
            }

            // Fire confetti if all tasks are completed
            if (completedTasksCount === totalTasks && totalTasks > 0) {
                if (typeof confetti !== 'undefined') { // Check if confetti library is loaded
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                }
            }

        } else {
            if (onboardingInfoContainer) onboardingInfoContainer.style.display = 'none';
            if (taskListOverviewDiv) taskListOverviewDiv.textContent = 'No onboarding tasks assigned.';
        }
    }
    
    // NEW: Event listener for task checkboxes (using event delegation)
    onboardingTaskListDiv.addEventListener('change', async (e) => {
        if (e.target.classList.contains('task-checkbox')) {
            const checkbox = e.target;
            const taskId = checkbox.dataset.taskId;
            const isCompleted = checkbox.checked;

            try {
                await apiRequest('PUT', `/api/onboarding-tasks/${taskId}`, { completed: isCompleted });
                // No need to toggle 'completed' class here, as loadOnboardingTasks will re-render
                // Reload tasks to update the overview count and re-render the list (hiding completed tasks)
                loadOnboardingTasks(); 
            } catch (error) {
                showModalMessage(`Failed to update task: ${error.message}`, true);
                console.error('Error updating task completion:', error);
                // Revert checkbox state if API call fails
                checkbox.checked = !isCompleted;
            }
        }
    });

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
            console.error('Error loading employee schedule:', error); // Added detailed error log
        }
    }

    // NEW: Event listener for Print Schedule button
    if (printScheduleBtn) {
        printScheduleBtn.addEventListener('click', async () => {
            // Fetch current user's location to pass to printable schedule
            let userLocationId = null;
            let userLocationName = 'Your Location'; // Default name
            try {
                const user = await apiRequest('GET', '/api/users/me');
                if (user && user.location_id) {
                    userLocationId = user.location_id;
                    // Attempt to get location name from API, or use a default
                    const locations = await apiRequest('GET', '/api/locations');
                    const currentLocation = locations.find(loc => String(loc.location_id) === String(userLocationId));
                    if (currentLocation) {
                        userLocationName = currentLocation.location_name;
                    }
                }
            } catch (error) {
                console.error('Error fetching user location for print schedule:', error);
            }

            if (!currentUserId || !userLocationId) {
                showModalMessage('Could not retrieve necessary information to print schedule. Please ensure your account is assigned to a location.', true);
                return;
            }

            // Calculate current week's start and end dates for the printable schedule
            const today = new Date();
            const startDate = new Date(today.setDate(today.getDate() - today.getDay())); // Start of current week (Sunday)
            startDate.setHours(0, 0, 0, 0); // Set to beginning of the day
            
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 7); // End of current week (next Sunday, exclusive)
            endDate.setHours(0, 0, 0, 0);

            // Encode parameters for URL
            const url = `printable-schedule.html?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}&user_id=${currentUserId}&locationId=${userLocationId}&locationName=${encodeURIComponent(userLocationName)}`;
            window.open(url, '_blank');
        });
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
