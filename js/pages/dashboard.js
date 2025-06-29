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
    // NEW: Existing employee select dropdown
    const existingEmployeeSelect = document.getElementById('existing-employee-select'); 
    // NEW: Element to display assigned task list info
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
            // Fetch all users
            const users = await apiRequest('GET', '/users');
            allUsers = users; // Store all users globally

            // Filter for employees who are not Super Admin or Location Admin
            const employeesOnly = users.filter(user => user.role === 'employee' || user.role === 'location_admin'); // Include managers who might be onboarded

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
            allChecklists = checklists; // Store all checklists globally
        } catch (error) {
            console.error('Error fetching all checklists:', error);
            // Don't display modal message here, just log, as this is a background fetch.
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
            // Find a checklist that matches the employee's position
            const matchingChecklist = allChecklists.find(checklist => 
                checklist.position && checklist.position.toLowerCase() === selectedEmployee.position.toLowerCase()
            );

            if (matchingChecklist) {
                assignedTaskListInfo.textContent = `This employee will be assigned the task list: "${matchingChecklist.title}"`;
                assignedTaskListInfo.style.color = 'var(--text-light)';
            } else {
                assignedTaskListInfo.textContent = `No task list found for position: "${selectedEmployee.position}". Please create one in Admin Settings > Task Lists.`;
                assignedTaskListInfo.style.color = '#ff8a80'; // Error-like color
            }
        } else {
            assignedTaskListInfo.textContent = ''; // Clear if no employee or position selected/found
        }
    }

    /**
     * Loads and displays dashboard metrics and recent activity.
     */
    async function loadDashboardData() {
        // Placeholder for fetching actual dashboard stats
        // try {
        //     const stats = await apiRequest('GET', '/dashboard/stats');
        //     pendingOnboardsCount.textContent = stats.pending;
        //     inProgressCount.textContent = stats.inProgress;
        //     completedCount.textContent = stats.completed;
        //
        //     const activity = await apiRequest('GET', '/dashboard/activity');
        //     if (activity && activity.length > 0) {
        //         activityList.innerHTML = ''; // Clear placeholder
        //         activity.forEach(item => {
        //             const li = document.createElement('li');
        //             li.textContent = `${item.timestamp}: ${item.description}`;
        //             activityList.appendChild(li);
        //         });
        //     } else {
        //         activityFeedPlaceholder.style.display = 'block';
        //     }
        // } catch (error) {
        //     console.error('Error loading dashboard data:', error);
        //     showModalMessage('Failed to load dashboard data. Please try again.', true); // Use global modal for dashboard
        // }
    }


    // --- Event Listeners ---

    // Show onboard employee modal
    if (showOnboardModalBtn) {
        showOnboardModalBtn.addEventListener('click', () => {
            if (onboardUserModal) {
                onboardUserModal.style.display = 'flex';
                onboardUserForm.reset(); // Clear form state on open
                displayStatusMessage(onboardModalStatusMessage, '', false); // Clear previous messages
                assignedTaskListInfo.textContent = ''; // Clear task list info on open
                loadExistingEmployeesForOnboard(); // Load employees when modal is shown
            }
        });
    }

    // Cancel onboard employee modal
    if (modalCancelOnboardBtn) {
        modalCancelOnboardBtn.addEventListener('click', () => {
            if (onboardUserModal) {
                onboardUserModal.style.display = 'none';
                onboardUserForm.reset(); // Clear form on cancel
                displayStatusMessage(onboardModalStatusMessage, '', false); // Clear any messages
                assignedTaskListInfo.textContent = ''; // Clear task list info
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
                checklist.position && selectedEmployee.position && // Ensure both exist
                checklist.position.toLowerCase() === selectedEmployee.position.toLowerCase()
            );

            if (!matchingChecklist) {
                displayStatusMessage(onboardModalStatusMessage, `No task list found for position: "${selectedEmployee.position}". Please create one in Admin Settings > Task Lists.`, true);
                return;
            }

            try {
                // NEW API call to assign a checklist to a user (onboarding_tasks table)
                // This route needs to be added to server.js
                await apiRequest('POST', '/onboarding-tasks', {
                    user_id: selectedUserId,
                    checklist_id: matchingChecklist.id
                }); 

                displayStatusMessage(onboardModalStatusMessage, `Task list "${matchingChecklist.title}" assigned to ${selectedEmployee.full_name} successfully!`, false);
                onboardUserForm.reset(); 
                assignedTaskListInfo.textContent = ''; // Clear task list info
                onboardUserModal.style.display = 'none'; // Close modal after successful assignment
                loadDashboardData(); // Reload dashboard data to reflect new onboarding status

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
    // loadExistingEmployeesForOnboard() is called when the modal is shown
}
