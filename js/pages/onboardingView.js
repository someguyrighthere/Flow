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
    const onboardingStatusMessageElement = document.getElementById('onboarding-status-message'); // For general status messages

    let currentUserId = null; // Will store the ID of the logged-in user
    let userTasks = []; // Store the tasks fetched for the user

    // --- Load confetti library ---
    // The confetti library is expected to be loaded via a script tag in new-hire-view.html.
    // This provides a fallback if it's not globally available.
    const confetti = window.confetti || ((opts) => {
        console.warn('Confetti library not loaded. Add <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.1/dist/confetti.browser.min.js"></script> to your HTML.');
        return Promise.resolve(null); // Return a resolved promise to avoid breaking async flow
    });


    // --- Helper function to get user ID from token (simple parsing, robust check on backend) ---
    /**
     * Decodes the JWT token to extract the user ID.
     * @param {string} token - The JWT token from local storage.
     * @returns {string|null} The user ID or null if decoding fails.
     */
    function getUserIdFromToken(token) {
        try {
            // JWTs have three parts: header.payload.signature
            const base64Url = token.split('.')[1];
            // Decode base64url to base64, then to string, then parse JSON
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            return payload.id; // Assuming the user ID is stored in the 'id' claim of the JWT
        } catch (e) {
            console.error("Error decoding token to get user ID:", e);
            return null;
        }
    }

    // --- Helper for local status messages ---
    /**
     * Displays a status message on the onboarding view page.
     * @param {string} message - The message text.
     * @param {boolean} [isError=false] - True if the message is an error, false for success.
     */
    function displayStatusMessage(message, isError = false) {
        if (!onboardingStatusMessageElement) {
            console.warn("Onboarding status message element not found. Message:", message);
            // Fallback to showModalMessage if no inline element is available
            showModalMessage(message, isError);
            return;
        }
        onboardingStatusMessageElement.textContent = message;
        onboardingStatusMessageElement.classList.remove('success', 'error'); // Clear previous states
        onboardingStatusMessageElement.classList.add(isError ? 'error' : 'success');
        setTimeout(() => {
            onboardingStatusMessageElement.textContent = '';
            onboardingStatusMessageElement.classList.remove('success', 'error');
        }, 5000); // Clear message after 5 seconds
    }


    // --- Data Loading and Rendering Functions ---

    /**
     * Fetches onboarding tasks for the current user and renders them.
     */
    async function loadOnboardingTasks() {
        if (!onboardingTaskListDiv) return;

        onboardingTaskListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading your onboarding tasks...</p>'; // Show loading state
        
        currentUserId = getUserIdFromToken(authToken);
        if (!currentUserId) {
            displayStatusMessage('Error: User ID not found in token. Please log in again.', true);
            // Optionally redirect to login if no user ID can be determined
            setTimeout(() => { window.location.href = 'login.html?sessionExpired=true'; }, 1500);
            return;
        }

        try {
            // Fetch onboarding tasks specific to the current user
            const tasks = await apiRequest('GET', `/onboarding-tasks?user_id=${currentUserId}`);
            userTasks = tasks; // Store fetched tasks in a global variable for this module
            renderOnboardingTasks(); // Render the tasks into the DOM
            updateTaskListOverview(); // Update the completion status display

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
        onboardingTaskListDiv.innerHTML = ''; // Clear loading message and any previous tasks

        if (userTasks && userTasks.length > 0) {
            userTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = `checklist-item ${task.completed ? 'completed' : ''}`;
                taskItem.dataset.taskId = task.id; // Store task ID for updates

                taskItem.innerHTML = `
                    <div class="checklist-item-title">
                        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                        <span>${task.description}</span>
                        ${task.document_name && task.document_id ? 
                            `<br><small style="color:var(--text-medium);">Attached: <a href="/uploads/${encodeURIComponent(task.document_name)}" target="_blank" style="color: var(--primary-accent);">${task.document_name}</a></small>` 
                            : ''
                        }
                    </div>
                `;
                onboardingTaskListDiv.appendChild(taskItem);

                // Add event listener for checkbox change
                taskItem.querySelector('.task-checkbox').addEventListener('change', async (e) => {
                    const isCompleted = e.target.checked;
                    const taskId = e.target.closest('.checklist-item').dataset.taskId;
                    
                    try {
                        // Send PUT request to update the task's completion status
                        await apiRequest('PUT', `/onboarding-tasks/${taskId}`, { completed: isCompleted });
                        
                        // Update UI immediately by toggling class
                        e.target.closest('.checklist-item').classList.toggle('completed', isCompleted);
                        
                        // Update the specific task in the local userTasks array
                        const updatedTaskIndex = userTasks.findIndex(t => String(t.id) === String(taskId)); // Ensure type comparison
                        if (updatedTaskIndex !== -1) {
                            userTasks[updatedTaskIndex].completed = isCompleted;
                        }

                        updateTaskListOverview(); // Update the completion overview after task status changes
                        displayStatusMessage(`Task "${task.description}" marked ${isCompleted ? 'complete' : 'incomplete'}.`, false);

                        // If all tasks are completed, trigger fireworks!
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
     * Updates the task list overview display (e.g., "X/Y tasks complete").
     */
    function updateTaskListOverview() {
        if (!taskListOverviewDiv) return;
        const completedTasks = userTasks.filter(task => task.completed).length;
        const totalTasks = userTasks.length;
        taskListOverviewDiv.textContent = `${completedTasks}/${totalTasks} tasks complete`;
        if (completedTasks === totalTasks && totalTasks > 0) {
            taskListOverviewDiv.textContent += " - All tasks completed!";
            taskListOverviewDiv.style.color = 'var(--primary-accent)'; // Highlight when all tasks are done
        } else {
             taskListOverviewDiv.style.color = 'var(--text-light)'; // Normal color
        }
    }

    /**
     * Triggers a confetti/fireworks animation.
     */
    function triggerFireworks() {
        // Check if confetti is loaded and callable before attempting to use it
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 } // Start from the middle-bottom of the screen
            });
        } else {
            console.warn("Confetti function not available. Make sure 'canvas-confetti' script is loaded.");
        }
    }

    // --- Initial Page Load Actions ---
    loadOnboardingTasks(); // Load tasks when the page initializes
}
