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

    // --- Helper function for local status messages (within modal) ---
    function displayStatusMessage(element, message, isError = false) {
        if (!element) return;
        element.innerHTML = message;
        element.classList.remove('success', 'error');
        element.classList.add(isError ? 'error' : 'success');
        setTimeout(() => {
            element.textContent = '';
            element.classList.remove('success', 'error');
        }, 5000);
    }

    // --- Data Loading Functions ---

    /**
     * Loads existing employees (users with role 'employee') and populates the dropdown.
     */
    async function loadExistingEmployeesForOnboard() {
        if (!existingEmployeeSelect) {
            console.error('Error: Existing employee select element (existing-employee-select) not found.');
            return;
        }
        existingEmployeeSelect.innerHTML = '<option value="">Loading employees...</option>'; 
        try {
            const users = await apiRequest('GET', '/users');
            allUsers = users; 

            const employeesOnly = users.filter(user => user.role === 'employee' || user.role === 'location_admin'); 

            existingEmployeeSelect.innerHTML = '<option value="">Select Employee</option>'; 

            if (employeesOnly && employeesOnly.length > 0) {
                employeesOnly.forEach(emp => {
                    const option = new Option(`${emp.full_name} (${emp.email})`, emp.user_id);
                    existingEmployeeSelect.add(option);
                });
            } else {
                existingEmployeeSelect.innerHTML = '<option value="">No employees found</option>';
            }
        } catch (error) {
            console.error('Error loading existing employees for onboard modal:', error);
            existingEmployeeSelect.innerHTML = '<option value="">Error loading employees</option>';
            displayStatusMessage(onboardModalStatusMessage, `Error loading employees: ${error.message}`, true);
        }
    }

    /**
     * Fetches all checklists.
     */
    async function fetchAllChecklists() {
        try {
            const checklists = await apiRequest('GET', '/checklists');
            allChecklists = checklists; 
        } catch (error) {
            console.error('Error fetching all checklists:', error);
        }
    }

    /**
     * Displays the associated task list information when an employee is selected.
     */
    function displayAssignedTaskListInfo() {
        if (!assignedTaskListInfo || !existingEmployeeSelect || !allChecklists.length || !allUsers.length) return;

        const selectedUserId = existingEmployeeSelect.value;
        const selectedEmployee = allUsers.find(user => user.user_id == selectedUserId);

        if (selectedEmployee && selectedEmployee.position) {
            const matchingChecklist = allChecklists.find(checklist => 
                checklist.position && checklist.position.toLowerCase() === selectedEmployee.position.toLowerCase()
            );

            if (matchingChecklist) {
                assignedTaskListInfo.textContent = `This employee will be assigned the task list: "${matchingChecklist.title}"`;
                assignedTaskListInfo.style.color = 'var(--text-light)';
            } else {
                assignedTaskListInfo.textContent = `No task list found for position: "${selectedEmployee.position}". Please create one in Admin Settings > Task Lists.`;
                assignedTaskListInfo.style.color = '#ff8a80'; 
            }
        } else {
            assignedTaskListInfo.textContent = ''; 
        }
    }

    /**
     * Loads and displays dashboard metrics and recent activity.
     */
    async function loadDashboardData() {
        try {
            // Fetch all onboarding tasks
            const onboardingTasks = await apiRequest('GET', '/onboarding-tasks');

            let pendingCount = 0;
            let inProgressCountVal = 0;
            let completedCountVal = 0;
            const activityItems = [];

            // Group by completion status
            onboardingTasks.forEach(task => {
                if (task.completed) {
                    completedCountVal++;
                } else {
                    // Check if a task is 'in progress' based on some criteria (e.g., has tasks started but not all completed)
                    // For now, assuming if not completed, it's either pending or in progress
                    // A more robust solution would check sub-tasks.
                    if (task.completed_at) { // Assuming completed_at being set means "in progress" state
                        inProgressCountVal++;
                    } else {
                        pendingCount++;
                    }
                }
                
                // Add to activity feed (get user name and checklist title)
                const user = allUsers.find(u => u.user_id === task.user_id);
                const checklist = allChecklists.find(c => c.id === task.checklist_id);

                if (user && checklist) {
                    const taskStatus = task.completed ? 'completed' : (task.completed_at ? 'in progress' : 'pending');
                    activityItems.push({
                        timestamp: new Date(task.uploaded_at || task.created_at).toLocaleString(), // Use uploaded_at or created_at
                        description: `<strong>${user.full_name}</strong>'s task list "<em>${checklist.title}</em>" is ${taskStatus}.`
                    });
                }
            });

            // Update UI counts
            pendingOnboardsCount.textContent = pendingCount;
            inProgressCount.textContent = inProgressCountVal;
            completedCount.textContent = completedCountVal;

            // Sort activity items by timestamp (most recent first)
            activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            // Render activity feed
            if (activityItems.length > 0) {
                activityList.innerHTML = ''; // Clear placeholder
                activityFeedPlaceholder.style.display = 'none'; // Hide placeholder
                activityItems.forEach(item => {
                    const li = document.createElement('li');
                    li.innerHTML = `${item.timestamp}: ${item.description}`; // Use innerHTML for bold/italic tags
                    activityList.appendChild(li);
                });
            } else {
                activityFeedPlaceholder.style.display = 'block';
                activityList.innerHTML = '';
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

            const selectedEmployee = allUsers.find(user => user.user_id == selectedUserId);
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
                loadDashboardData(); 

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
            showModalMessage('Viewing applicants functionality is not yet fully implemented.', false);
        });
    }


    // --- Initial Page Load ---
    loadDashboardData(); // Load dashboard data when the page loads
    fetchAllChecklists(); // Fetch all checklists in background when dashboard loads
}
