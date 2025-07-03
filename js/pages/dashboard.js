// Submit onboard employee form (now assigns task list to existing employee)
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

            // --- CORRECTED CODE ---
            // Safely get the employee's position before using it.
            const employeePosition = selectedEmployee.position;
            if (!employeePosition) {
                displayStatusMessage(onboardModalStatusMessage, `This employee does not have a position set and cannot be assigned a task list.`, true);
                return;
            }
            // --- END CORRECTION ---

            // Find the task list associated with the employee's position
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
                
                // Close modal after a short delay
                setTimeout(() => {
                    if (onboardUserModal) onboardUserModal.style.display = 'none';
                }, 1500);

                loadDashboardData(); // Reload dashboard data to reflect new assignment

            } catch (error) {
                displayStatusMessage(onboardModalStatusMessage, `Error assigning task list: ${error.message}`, true);
                console.error('Error assigning task list:', error);
            }
        });
    }