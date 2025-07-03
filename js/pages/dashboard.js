import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the dashboard page.
 */
export function handleDashboardPage() {
    // Security check
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Elements ---
    const onboardUserModal = document.getElementById('onboard-user-modal');
    const onboardUserForm = document.getElementById('onboard-user-form');
    const showOnboardModalBtn = document.getElementById('show-onboard-modal');
    const modalCancelBtn = document.getElementById('modal-cancel-onboard');
    const existingEmployeeSelect = document.getElementById('existing-employee-select');
    const assignedTaskListInfo = document.getElementById('assigned-task-list-info');
    const onboardModalStatusMessage = document.getElementById('onboard-modal-status-message');

    const pendingCountEl = document.getElementById('pending-onboards-count');
    const inProgressCountEl = document.getElementById('in-progress-count');
    const completedCountEl = document.getElementById('completed-count');
    const activityListEl = document.getElementById('activity-list');
    
    // --- State Variables ---
    let allUsers = [];
    let allChecklists = [];

    // --- Helper Functions ---
    const displayStatusMessage = (element, message, isError = false) => {
        if (!element) return;
        element.textContent = message;
        element.className = isError ? 'error' : 'success';
        setTimeout(() => element.textContent = '', 5000);
    };

    // --- Data Loading ---
    async function loadDashboardData() {
        try {
            const [users, checklists, tasks] = await Promise.all([
                apiRequest('GET', '/api/users'),
                apiRequest('GET', '/api/checklists'),
                apiRequest('GET', '/api/onboarding-tasks')
            ]);
            
            allUsers = users;
            allChecklists = checklists;

            // Update stats and activity feed
            updateStats(tasks);
            updateActivityFeed(tasks);

        } catch (error) {
            console.error("Error loading dashboard data:", error);
            showModalMessage("Could not load all dashboard data.", true);
        }
    }

    function updateStats(tasks) {
        const userTasks = {};
        tasks.forEach(task => {
            if (!userTasks[task.user_id]) {
                userTasks[task.user_id] = { total: 0, completed: 0 };
            }
            userTasks[task.user_id].total++;
            if (task.completed) {
                userTasks[task.user_id].completed++;
            }
        });

        let pending = 0, inProgress = 0, completed = 0;
        Object.values(userTasks).forEach(status => {
            if (status.completed === 0) pending++;
            else if (status.completed === status.total) completed++;
            else inProgress++;
        });
        
        if(pendingCountEl) pendingCountEl.textContent = pending;
        if(inProgressCountEl) inProgressCountEl.textContent = inProgress;
        if(completedCountEl) completedCountEl.textContent = completed;
    }

    function updateActivityFeed(tasks) {
        if (!activityListEl) return;
        activityListEl.innerHTML = '';
        const recentTasks = tasks
            .filter(t => t.completed)
            .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
            .slice(0, 5);
        
        if(recentTasks.length === 0) {
            const placeholder = document.getElementById('activity-feed-placeholder');
            if(placeholder) placeholder.style.display = 'block';
        } else {
             recentTasks.forEach(task => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${task.user_name}</strong> completed task: "${task.description}"`;
                activityListEl.appendChild(li);
            });
        }
    }
    
    async function populateEmployeeDropdown() {
        if (!existingEmployeeSelect) return;
        // Filter for users who are employees and not yet fully onboarded.
        const unassignedUsers = allUsers.filter(user => user.role === 'employee');
        
        existingEmployeeSelect.innerHTML = '<option value="">Select an employee...</option>';
        unassignedUsers.forEach(user => {
            const option = new Option(user.full_name, user.user_id);
            existingEmployeeSelect.add(option);
        });
    }

    // --- Event Listeners ---
    if (showOnboardModalBtn) {
        showOnboardModalBtn.addEventListener('click', () => {
            populateEmployeeDropdown();
            if (onboardUserModal) onboardUserModal.style.display = 'flex';
        });
    }

    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', () => {
            if (onboardUserModal) onboardUserModal.style.display = 'none';
        });
    }

    if (existingEmployeeSelect) {
        existingEmployeeSelect.addEventListener('change', () => {
            if (!assignedTaskListInfo) return;
            const selectedUserId = existingEmployeeSelect.value;
            const selectedEmployee = allUsers.find(user => String(user.user_id) === String(selectedUserId));
            const position = selectedEmployee ? selectedEmployee.position : null;
            
            if (position) {
                const matchingChecklist = allChecklists.find(c => c.position && c.position.toLowerCase() === position.toLowerCase());
                assignedTaskListInfo.textContent = matchingChecklist 
                    ? `Will be assigned: "${matchingChecklist.title}"`
                    : `No task list found for position: "${position}"`;
            } else {
                assignedTaskListInfo.textContent = 'Selected employee has no position set.';
            }
        });
    }

    // Submit onboard employee form
    if (onboardUserForm) {
        onboardUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const selectedUserId = existingEmployeeSelect.value;
            if (!selectedUserId) {
                displayStatusMessage(onboardModalStatusMessage, 'Please select an employee.', true);
                return;
            }

            const selectedEmployee = allUsers.find(user => String(user.user_id) === String(selectedUserId));
            if (!selectedEmployee) {
                displayStatusMessage(onboardModalStatusMessage, 'Selected employee not found. Please try again.', true);
                return;
            }

            const employeePosition = selectedEmployee.position;
            if (!employeePosition) {
                displayStatusMessage(onboardModalStatusMessage, `This employee does not have a position set and cannot be assigned a task list.`, true);
                return;
            }

            const matchingChecklist = allChecklists.find(checklist => 
                checklist.position && 
                checklist.position.toLowerCase() === employeePosition.toLowerCase()
            );

            if (!matchingChecklist) {
                displayStatusMessage(onboardModalStatusMessage, `No task list found for position: "${employeePosition}". Please create one in Admin Settings > Task Lists.`, true);
                return;
            }

            try {
                await apiRequest('POST', '/api/onboarding-tasks', {
                    user_id: selectedUserId,
                    checklist_id: matchingChecklist.id
                }); 

                displayStatusMessage(onboardModalStatusMessage, `Task list "${matchingChecklist.title}" assigned to ${selectedEmployee.full_name} successfully!`, false);
                onboardUserForm.reset(); 
                assignedTaskListInfo.textContent = ''; 
                
                setTimeout(() => {
                    if (onboardUserModal) onboardUserModal.style.display = 'none';
                }, 1500);

                loadDashboardData();

            } catch (error) {
                displayStatusMessage(onboardModalStatusMessage, `Error assigning task list: ${error.message}`, true);
                console.error('Error assigning task list:', error);
            }
        });
    }
    
    // --- Initial Load ---
    loadDashboardData();
}