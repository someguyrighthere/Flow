import { apiRequest, showModalMessage } from '../utils.js';

export function handleDashboardPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const onboardUserModal = document.getElementById("onboard-user-modal");
    const showOnboardModalBtn = document.getElementById("show-onboard-modal-btn");
    const modalCancelOnboardBtn = document.getElementById("modal-cancel-onboard");
    const onboardUserForm = document.getElementById("onboard-user-form");
    const newHirePositionSelect = document.getElementById("new-hire-position");
    const sessionListDiv = document.getElementById("session-list");

    if (showOnboardModalBtn) {
        showOnboardModalBtn.addEventListener("click", () => {
            if (onboardUserModal) onboardUserModal.style.display = "flex";
        });
    }

    if (modalCancelOnboardBtn) {
        modalCancelOnboardBtn.addEventListener("click", () => {
            if (onboardUserModal) onboardUserModal.style.display = "none";
        });
    }

    if (onboardUserModal) {
        onboardUserModal.addEventListener("click", event => {
            if (event.target === onboardUserModal) onboardUserModal.style.display = "none";
        });
    }

    async function loadPositions() {
        if (!newHirePositionSelect) return;
        newHirePositionSelect.innerHTML = '<option value="">Loading positions...</option>';
        try {
            const response = await apiRequest("GET", "/positions");
            newHirePositionSelect.innerHTML = '<option value="">Select Position</option>';
            if (response && response.positions && response.positions.length > 0) {
                response.positions.forEach(pos => {
                    const option = document.createElement("option");
                    option.value = pos.id;
                    option.textContent = pos.name;
                    newHirePositionSelect.appendChild(option);
                });
            } else {
                newHirePositionSelect.innerHTML = '<option value="">No positions available</option>';
            }
        } catch (error) {
            console.error("Error loading positions:", error);
            newHirePositionSelect.innerHTML = '<option value="">Error loading positions</option>';
        }
    }

    async function loadOnboardingSessions() {
        if (!sessionListDiv) return;
        sessionListDiv.innerHTML = '<p>Loading active onboardings...</p>';
        try {
            const sessions = await apiRequest("GET", "/onboarding-sessions");
            sessionListDiv.innerHTML = '';
            if (sessions && sessions.length > 0) {
                sessions.forEach(session => {
                    const sessionItem = document.createElement("div");
                    sessionItem.className = "onboarding-item";
                    let completionStatus = session.completedTasks === session.totalTasks ? 'Completed' : `${session.completedTasks}/${session.totalTasks} Tasks Completed`;
                    sessionItem.innerHTML = `<div class="onboarding-item-info">
                            <p style="color: var(--text-light); font-weight: 600;">${session.full_name} (${session.position || 'N/A'})</p>
                            <p style="color: var(--text-medium);">Email: ${session.email}</p>
                            <p style="color: ${session.completedTasks === session.totalTasks ? 'var(--primary-accent)' : 'var(--text-medium)'};">Status: ${completionStatus}</p>
                        </div>
                        <div class="onboarding-item-actions">
                            <button class="btn btn-secondary btn-sm view-details-btn" data-user-id="${session.user_id}">View Progress</button>
                        </div>`;
                    sessionListDiv.appendChild(sessionItem);
                });
                sessionListDiv.querySelectorAll('.view-details-btn').forEach(button => {
                    button.addEventListener('click', (event) => {
                        window.location.href = `new-hire-view.html?userId=${event.target.dataset.userId}`;
                    });
                });
            } else {
                sessionListDiv.innerHTML = '<p>No active onboardings.</p>';
            }
        } catch (error) {
            sessionListDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        }
    }

    if (onboardUserForm) {
        onboardUserForm.addEventListener("submit", async e => {
            e.preventDefault();
            const newHireName = document.getElementById("new-hire-name").value.trim();
            const newHireEmail = document.getElementById("new-hire-email").value.trim();
            const newHirePosition = newHirePositionSelect ? newHirePositionSelect.value : "";
            const newHireId = document.getElementById("new-hire-id").value.trim();
            if (!newHireName || !newHireEmail || !newHirePosition) {
                showModalMessage("Please fill all required fields.", true);
                return;
            }
            try {
                await apiRequest("POST", "/onboard-employee", { full_name: newHireName, email: newHireEmail, position_id: newHirePosition, employee_id: newHireId || null });
                showModalMessage(`Onboarding invite sent.`, false);
                onboardUserForm.reset();
                if (onboardUserModal) onboardUserModal.style.display = "none";
                loadOnboardingSessions();
            } catch (error) {
                showModalMessage(error.message, true);
            }
        });
    }

    loadPositions();
    loadOnboardingSessions();
}
