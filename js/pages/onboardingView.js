// js/pages/onboardingView.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles the logic for the employee's onboarding view page (new-hire-view.html).
 */
export function handleOnboardingViewPage() {
    // Security check: Redirect if not logged in
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Elements ---
    const welcomeMessage = document.getElementById('welcome-message'); // Assuming a welcome message element
    const onboardingTaskListDiv = document.getElementById('onboarding-task-list'); // Container for tasks
    const taskListOverviewDiv = document.getElementById('task-list-overview'); // For completion status (e.g., "0/5 tasks complete")
    const onboardingStatusMessageElement = document.getElementById('onboarding-status-message'); // NEW: For general status messages

    let currentUserId = null; // Will store the ID of the logged-in user
    let userTasks = []; // Store the tasks fetched for the user

    // --- Load confetti library ---
    // Make sure this is loaded only once and correctly in your HTML/JS setup.
    // For this example, we'll assume it's available or load it dynamically.
    // If you need a script tag in HTML, it should be <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.1/dist/confetti.browser.min.js"></script>
    // For direct use in module, you might need dynamic import or a global var check.
    const confetti = window.confetti || ((opts) => {
        // Fallback for when confetti library is not loaded
        console.warn('Confetti library not loaded. Add <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.1/dist/confetti.browser.min.js"></script> to your HTML.');
        return Promise.resolve(null);
    });


    // --- Helper function to get user ID from token (simple parsing, robust check on backend) ---
    function getUserIdFromToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            return payload.id; // Assuming the user ID is stored in 'id' claim
        } catch (e) {
            console.error("Error decoding token:", e);
            return null;
        }
    }

    // --- Helper for local status messages ---
    function displayStatusMessage(message, isError = false) {
        if (!onboardingStatusMessageElement) {
            console.warn("Onboarding status message element not found. Message:", message);
            // Fallback to showModalMessage if no inline element.
            showModalMessage(message, isError);
            return;
        }
        onboardingStatusMessageElement.textContent = message;
        onboardingStatusMessageElement.classList.remove('success', 'error');
        onboardingStatusMessageElement.classList.add(isError ? 'error' : 'success');
        setTimeout(() => {
            onboardingStatusMessageElement.textContent = '';
            onboardingStatusMessageElement.classList.remove('success', 'error');
        }, 5000);
    }


    // --- Data Loading and Rendering Functions ---

    /**
     * Fetches onboarding tasks for the current user and renders them.
     */
    async function loadOnboardingTasks() {
        if (!onboardingTaskListDiv) return;

        onboardingTaskListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading your onboarding tasks...</p>';
        
        currentUserId = getUserIdFromToken(authToken);
        if (!currentUserId) {
            displayStatusMessage('Error: User ID not found. Please log in again.', true);
            return;
        }

        try {
            const tasks = await apiRequest('GET', `/onboarding-tasks?user_id=${currentUserId}`);
            userTasks = tasks; // Store fetched tasks
            renderOnboardingTasks(); // Render the tasks
            updateTaskListOverview(); // Update the completion status

        } catch (error) {
            console.error('Error loading onboarding tasks:', error);
            onboardingTaskListDiv.innerHTML = '<p style="color: #e74c3c;">Error loading tasks. Please contact support.</p>';
            displayStatusMessage(`Error loading tasks: ${error.message}`, true);
        }
    }

    /**
     * Renders the fetched onboarding tasks into the DOM.
     */
    function renderOnboardingTasks() {
        if (!onboardingTaskListDiv) return;
        onboardingTaskListDiv.innerHTML = ''; // Clear loading message

        if (userTasks && userTasks.length > 0) {
            userTasks.forEach(task => {
                const taskItem = document.createElement('div');
                // Added data-task-id here to be consistent with usage
                taskItem.className = `checklist-item ${task.completed ? 'completed' : ''}`;
                taskItem.dataset.taskId = task.id; 

                taskItem.innerHTML = `
                    <div class="checklist-item-title">
                        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                        <span>${task.description}</span>
                        ${task.documentName ? `<br><small style="color:var(--text-medium);">Attached: <a href="/uploads/${encodeURIComponent(task.file_path.split('/').pop())}" target="_blank" style="color: var(--primary-accent);">${task.documentName}</a></small>` : ''}
                    </div>
                `;
                onboardingTaskListDiv.appendChild(taskItem);

                // Add event listener for checkbox
                taskItem.querySelector('.task-checkbox').addEventListener('change', async (e) => {
                    const isCompleted = e.target.checked;
                    const taskId = e.target.closest('.checklist-item').dataset.taskId;
                    
                    try {
                        await apiRequest('PUT', `/onboarding-tasks/${taskId}`, { completed: isCompleted });
                        
                        // FIX: Update UI immediately by toggling class
                        e.target.closest('.checklist-item').classList.toggle('completed', isCompleted);
                        
                        // FIX: Update the specific task in the userTasks array
                        const updatedTaskIndex = userTasks.findIndex(t => t.id == taskId);
                        if (updatedTaskIndex !== -1) {
                            userTasks[updatedTaskIndex].completed = isCompleted;
                        }

                        updateTaskListOverview(); // Update overview after task completion
                        displayStatusMessage(`Task "${task.description}" marked ${isCompleted ? 'complete' : 'incomplete'}.`, false);

                        // If all tasks are completed, trigger fireworks
                        const allTasksCompleted = userTasks.every(t => t.completed);
                        if (allTasksCompleted && userTasks.length > 0) {
                            triggerFireworks();
                        }

                    } catch (error) {
                        console.error('Error updating task status:', error);
                        e.target.checked = !isCompleted; // Revert checkbox state on error
                        displayStatusMessage(`Error updating task status: ${error.message}`, true);
                    }
                });
            });
        } else {
            onboardingTaskListDiv.innerHTML = '<p style="color: var(--text-medium);">No onboarding tasks assigned yet. Contact your administrator.</p>';
        }
    }

    /**
     * Updates the task list overview (e.g., "X/Y tasks complete").
     */
    function updateTaskListOverview() {
        if (!taskListOverviewDiv) return;
        const completedTasks = userTasks.filter(task => task.completed).length;
        const totalTasks = userTasks.length;
        taskListOverviewDiv.textContent = `${completedTasks}/${totalTasks} tasks complete`;
        if (completedTasks === totalTasks && totalTasks > 0) {
            taskListOverviewDiv.textContent += " - All tasks completed!";
            taskListOverviewDiv.style.color = 'var(--primary-accent)';
        } else {
             taskListOverviewDiv.style.color = 'var(--text-light)';
        }
    }

    /**
     * Triggers a confetti/fireworks animation.
     */
    function triggerFireworks() {
        // Check if confetti is loaded and callable
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        } else {
            console.warn("Confetti function not available. Make sure 'canvas-confetti' script is loaded.");
        }
    }

    // --- Initial Page Load ---
    loadOnboardingTasks(); // Load tasks when the page initializes
}
