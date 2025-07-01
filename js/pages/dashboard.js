// js/pages/dashboard.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the dashboard page.
 */
export function handleDashboardPage() {
    // Redirect to login page if no authentication token is found in local storage
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Elements ---
    const onboardUserModal = document.getElementById('onboard-user-modal');
    const showOnboardModalBtn = document.getElementById('show-onboard-modal');
    const modalCancelOnboardBtn = document.getElementById('modal-cancel-onboard');
    const onboardUserForm = document.getElementById('onboard-user-form');
    const existingEmployeeSelect = document.getElementById('existing-employee-select'); 
    const assignedTaskListInfo = document.getElementById('assigned-task-list-info');

    const onboardModalStatusMessage = document.getElementById('onboard-modal-status-message'); // For messages within the modal

    const pendingOnboardsCount = document.getElementById('pending-onboards-count');
    const inProgressCount = document.getElementById('in-progress-count');
    const completedCount = document.getElementById('completed-count');
    const activityList = document.getElementById('activity-list');
    const activityFeedPlaceholder = document.getElementById('activity-feed-placeholder');
    const viewJobPostingsBtn = document.getElementById('view-job-postings-btn');
    const viewApplicantsBtn = document.getElementById('view-applicants-btn');

    // Store all checklists and users globally once fetched to avoid re-fetching
    let allChecklists = [];
    let allUsers = [];

    // --- Helper function for local status messages (within modal or on page) ---
    /**
     * Displays a status message on a specified DOM element.
     * @param {HTMLElement} element - The DOM element to display the message in.
     * @param {string} message - The message text.
     * @param {boolean} [isError=false] - True if the message is an error, false for success.
     */
    function displayStatusMessage(element, message, isError = false) {
        if (!element) return;
        element.innerHTML = message;
        element.classList.remove('success', 'error'); // Clear previous states
        element.classList.add(isError ? 'error' : 'success');
        setTimeout(() => {
            element.textContent = '';
            element.classList.remove('success', 'error');
        }, 5000); // Clear message after 5 seconds
    }

    // --- Data Loading Functions ---

    /**
     * Loads existing employees (users with role 'employee' or 'location_admin') and populates the dropdown.
     */
    async function loadExistingEmployeesForOnboard() {
        if (!existingEmployeeSelect) {
            console.error('Error: Existing employee select element (existing-employee-select) not found.');
            return;
        }
        existingEmployeeSelect.innerHTML = '<option value="">Loading employees...</option>'; // Show loading state
        try {
            // Fetch all users (admin route, will be filtered by backend based on role)
            const users = await apiRequest('GET', '/api/users'); 
            allUsers = users; // Store all fetched users globally

            // Filter for employees and location admins who can be assigned tasks
            const assignableUsers = users.filter(user => user.role === 'employee' || user.role === 'location_admin'); 

            existingEmployeeSelect.innerHTML = '<option value="">Select Employee</option>'; // Default empty option

            if (assignableUsers && assignableUsers.length > 0) {
                assignableUsers.forEach(emp => {
                    const option = new Option(`${emp.full_name} (${emp.email})`, emp.user_id);
                    existingEmployeeSelect.add(option);
                });
            } else {
                existingEmployeeSelect.innerHTML = '<option value="">No assignable employees found</option>';
            }
        } catch (error) {
            console.error('Error loading existing employees for onboard modal:', error);
            existingEmployeeSelect.innerHTML = '<option value="">Error loading employees</option>';
            displayStatusMessage(onboardModalStatusMessage, `Error loading employees: ${error.message}`, true);
        }
    }

    /**
     * Fetches all checklists from the API.
     */
    async function fetchAllChecklists() {
        try {
            // Fetch all checklists (admin route, will be filtered by backend based on role)
            const checklists = await apiRequest('GET', '/checklists');
            allChecklists = checklists; // Store all fetched checklists globally
        } catch (error) {
            console.error('Error fetching all checklists:', error);
            // Don't show modal message here, as it's a background fetch for data dependency
        }
    }

    /**
     * Displays the associated task list information when an employee is selected.
     * This function uses the globally stored `allChecklists` and `allUsers`.
     */
    function displayAssignedTaskListInfo() {
        if (!assignedTaskListInfo || !existingEmployeeSelect || !allChecklists.length || !allUsers.length) return;

        const selectedUserId = existingEmployeeSelect.value;
        const selectedEmployee = allUsers.find(user => String(user.user_id) === String(selectedUserId)); // Ensure type comparison

        if (selectedEmployee && selectedEmployee.position) {
            const matchingChecklist = allChecklists.find(checklist => 
                checklist.position && checklist.position.toLowerCase() === selectedEmployee.position.toLowerCase()
            );

            if (matchingChecklist) {
                assignedTaskListInfo.textContent = `This employee will be assigned the task list: "${matchingChecklist.title}"`;
                assignedTaskListInfo.style.color = 'var(--text-light)';
            } else {
                assignedTaskListInfo.textContent = `No task list found for position: "${selectedEmployee.position}". Please create one in Admin Settings > Task Lists.`;
                assignedTaskListInfo.style.color = '#ff8a80'; // Error color
            }
        } else {
            // Clear info if no employee selected or no position found
            assignedTaskListInfo.textContent = ''; 
        }
    }

    /**
     * Loads and displays dashboard metrics (pending, in-progress, completed tasks) and recent activity.
     */
    async function loadDashboardData() {
        try {
            // Fetch all onboarding tasks for the current user's scope (admin/location_admin)
            const onboardingTasks = await apiRequest('GET', '/onboarding-tasks');

            let pendingCount = 0;
            let inProgressCountVal = 0;
            let completedCountVal = 0;
            const activityItems = [];

            // Iterate through all onboarding tasks to calculate counts and build activity feed
            onboardingTasks.forEach(task => {
                if (task.completed) {
                    completedCountVal++;
                } else {
                    // For 'in progress', we can assume any task not completed is 'in progress'
                    // or 'pending'. A more granular backend might have a specific 'status' field.
                    // For now, if it's not completed, it contributes to 'in progress' or 'pending'.
                    // Let's refine: if it has an assigned_at date, it's either in progress or pending.
                    // If it has a completed_at date, it's completed.
                    // For simplicity, let's count all non-completed tasks as "Pending/In Progress"
                    // and then divide them if needed.
                    // For now, let's just count completed vs. not completed.
                    // The current UI only has "Pending" and "In Progress" as separate counts,
                    // which implies a more complex state tracking.
                    // Let's simplify: if not completed, it's "Pending/In Progress".
                    // For a true "In Progress" count, we'd need a way to mark a task as started.
                    // Given the current schema, we'll just use pending for non-completed.
                    pendingCount++; // Count all non-completed tasks as pending for now
                }
                
                // Add to activity feed (get user name and checklist title)
                const user = allUsers.find(u => String(u.user_id) === String(task.user_id));
                const checklist = allChecklists.find(c => String(c.id) === String(task.checklist_id));

                if (user && checklist) {
                    const taskStatus = task.completed ? 'completed' : 'pending'; // Simplified status
                    activityItems.push({
                        timestamp: new Date(task.assigned_at || task.created_at).getTime(), // Use timestamp for sorting
                        description: `<strong>${user.full_name}</strong>'s task "<em>${task.description}</em>" from list "<em>${checklist.title}</em>" is ${taskStatus}.`
                    });
                }
            });

            // The dashboard has Pending, In Progress, Completed.
            // Let's adjust counts:
            // Completed is straightforward.
            // For "Pending" and "In Progress", we need a better definition.
            // For now, let's assume 'Pending Onboards' are users who have tasks assigned but haven't completed any.
            // 'In Progress' are users who have started but not finished.
            // This requires joining user data with task data.

            // Let's recalculate based on unique users and their overall task completion status
            const userOnboardingStatus = {}; // { userId: { totalTasks: N, completedTasks: M } }
            onboardingTasks.forEach(task => {
                if (!userOnboardingStatus[task.user_id]) {
                    userOnboardingStatus[task.user_id] = { total: 0, completed: 0 };
                }
                userOnboardingStatus[task.user_id].total++;
                if (task.completed) {
                    userOnboardingStatus[task.user_id].completed++;
                }
            });

            pendingCount = 0;
            inProgressCountVal = 0;
            completedCountVal = 0;

            for (const userId in userOnboardingStatus) {
                const status = userOnboardingStatus[userId];
                if (status.total > 0) {
                    if (status.completed === 0) {
                        pendingCount++; // User has tasks, but none completed
                    } else if (status.completed === status.total) {
                        completedCountVal++; // All tasks completed for this user
                    } else {
                        inProgressCountVal++; // Some tasks completed, but not all
                    }
                }
            }


            // Update UI counts
            if (pendingOnboardsCount) pendingOnboardsCount.textContent = pendingCount;
            if (inProgressCount) inProgressCount.textContent = inProgressCountVal;
            if (completedCount) completedCount.textContent = completedCountVal;

            // Sort activity items by timestamp (most recent first)
            activityItems.sort((a, b) => b.timestamp - a.timestamp);

            // Render activity feed
            if (activityItems.length > 0) {
                if (activityList) activityList.innerHTML = ''; // Clear placeholder
                if (activityFeedPlaceholder) activityFeedPlaceholder.style.display = 'none'; // Hide placeholder
                activityItems.forEach(item => {
                    const li = document.createElement('li');
                    li.innerHTML = `${new Date(item.timestamp).toLocaleString()}: ${item.description}`; // Use innerHTML for bold/italic tags
                    if (activityList) activityList.appendChild(li);
                });
            } else {
                if (activityFeedPlaceholder) activityFeedPlaceholder.style.display = 'block';
                if (activityList) activityList.innerHTML = '';
            }

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showModalMessage('Failed to load dashboard data. Please try again.', true); 
        }
    }


    // --- Event Listeners ---

    // Show onboard employee modal
    if (showOnboardModalBtn) {
        showOnboardModalBtn.addEventListener('click', () => {
            if (onboardUserModal) {
                onboardUserModal.style.display = 'flex';
                onboardUserForm.reset(); 
                displayStatusMessage(onboardModalStatusMessage, '', false); 
                assignedTaskListInfo.textContent = ''; 
                loadExistingEmployeesForOnboard(); // Load employees when modal is shown
            }
        });
    }

    // Cancel onboard employee modal
    if (modalCancelOnboardBtn) {
        modalCancelOnboardBtn.addEventListener('click', () => {
            if (onboardUserModal) {
                onboardUserModal.style.display = 'none';
                onboardUserForm.reset(); 
                displayStatusMessage(onboardModalStatusMessage, '', false); 
                assignedTaskListInfo.textContent = ''; 
            }
        });
    }

    // Event listener for when an employee is selected in the dropdown
    if (existingEmployeeSelect) {
        existingEmployeeSelect.addEventListener('change', displayAssignedTaskListInfo);
    }


    // Submit onboard employee form (now assigns task list to existing employee)
    if (onboardUserForm) {
        onboardUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const selectedUserId = existingEmployeeSelect.value;
            if (!selectedUserId) {
                displayStatusMessage(onboardModalStatusMessage, 'Please select an employee.', true);
                return;
            }

            const selectedEmployee = allUsers.find(user => String(user.user_id) === String(selectedUserId)); // Ensure type comparison
            if (!selectedEmployee) {
                displayStatusMessage(onboardModalStatusMessage, 'Selected employee not found. Please try again.', true);
                return;
            }

            // Find the task list associated with the employee's position
            const matchingChecklist = allChecklists.find(checklist => 
                checklist.position && selectedEmployee.position && 
                checklist.position.toLowerCase() === selectedEmployee.position.toLowerCase()
            );

            if (!matchingChecklist) {
                displayStatusMessage(onboardModalStatusMessage, `No task list found for position: "${selectedEmployee.position}". Please create one in Admin Settings > Task Lists.`, true);
                return;
            }

            try {
                await apiRequest('POST', '/onboarding-tasks', {
                    user_id: selectedUserId,
                    checklist_id: matchingChecklist.id
                }); 

                displayStatusMessage(onboardModalStatusMessage, `Task list "${matchingChecklist.title}" assigned to ${selectedEmployee.full_name} successfully!`, false);
                onboardUserForm.reset(); 
                assignedTaskListInfo.textContent = ''; 
                onboardUserModal.style.display = 'none'; 
                loadDashboardData(); // Reload dashboard data to reflect new assignment

            } catch (error) {
                displayStatusMessage(onboardModalStatusMessage, `Error assigning task list: ${error.message}`, true);
                console.error('Error assigning task list:', error);
            }
        });
    }

    // Navigation for Job Postings/Applicants - assuming these links navigate to separate pages
    if (viewJobPostingsBtn) {
        viewJobPostingsBtn.addEventListener('click', () => {
            window.location.href = 'hiring.html'; 
        });
    }

    if (viewApplicantsBtn) {
        viewApplicantsBtn.addEventListener('click', () => {
            // Direct to hiring.html as applicants are now managed there
            window.location.href = 'hiring.html'; 
        });
    }


    // --- Initial Page Load ---
    // Fetch all checklists first, as it's a dependency for loadDashboardData and displayAssignedTaskListInfo
    fetchAllChecklists().then(() => {
        loadDashboardData(); // Load dashboard data after checklists are fetched
        loadExistingEmployeesForOnboard(); // Load employees for the modal after checklists are fetched
    });
}
