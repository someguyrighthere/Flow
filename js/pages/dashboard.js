// js/pages/dashboard.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles all logic for the dashboard page.
 */
export function handleDashboardPage() {
    // Security check: Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // Get all necessary elements from the DOM
    const onboardUserModal = document.getElementById("onboard-user-modal");
    const showOnboardModalBtn = document.getElementById("show-onboard-modal-btn");
    const modalCancelOnboardBtn = document.getElementById("modal-cancel-onboard");
    const onboardUserForm = document.getElementById("onboard-user-form");
    const newHirePositionSelect = document.getElementById("new-hire-position");
    const sessionListDiv = document.getElementById("session-list");

    // --- Event Listeners ---

    // Show the "Onboard New Employee" modal when the main button is clicked
    if (showOnboardModalBtn) {
        showOnboardModalBtn.addEventListener("click", () => {
            if (onboardUserModal) onboardUserModal.style.display = "flex";
            loadPositions(); // Load positions when the modal opens
        });
    }

    // Hide the modal if the cancel button is clicked
    if (modalCancelOnboardBtn) {
        modalCancelOnboardBtn.addEventListener("click", () => {
            if (onboardUserModal) onboardUserModal.style.display = "none";
        });
    }

    // Hide the modal if the user clicks on the overlay background
    if (onboardUserModal) {
        onboardUserModal.addEventListener("click", event => {
            if (event.target === onboardUserModal) {
                onboardUserModal.style.display = "none";
            }
        });
    }
    
    // Handle the submission of the "Onboard New Employee" form
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
                // In this reverted version, we are not sending to a backend.
                // This would need to be re-implemented when the backend routes are added back.
                showModalMessage("Onboarding functionality is temporarily disabled due to backend changes. Please contact support.", true);
                onboardUserForm.reset();
                if (onboardUserModal) onboardUserModal.style.display = "none";
                // loadOnboardingSessions(); // No longer valid without backend
            } catch (error) {
                showModalMessage(error.message, true);
            }
        });
    }

    // --- Data Loading Functions ---

    /**
     * Fetches available positions from the API and populates the dropdown.
     * This function is now a placeholder as the backend route is removed.
     */
    async function loadPositions() {
        if (!newHirePositionSelect) return;
        newHirePositionSelect.innerHTML = '<option value="">(Functionality Disabled)</option>'; // Indicate disabled
        // Removed API call as the route is removed from server.js
        // try {
        //     const response = await apiRequest("GET", "/positions");
        //     newHirePositionSelect.innerHTML = '<option value="">Select Position</option>';
        //     if (response && response.positions && response.positions.length > 0) {
        //         response.positions.forEach(pos => {
        //             const option = document.createElement("option");
        //             option.value = pos.id;
        //             option.textContent = pos.name;
        //             newHirePositionSelect.appendChild(option);
        //         });
        //     } else {
        //         newHirePositionSelect.innerHTML = '<option value="">No positions available</option>';
        //     }
        // } catch (error) {
        //     console.error("Error loading positions:", error);
        //     newHirePositionSelect.innerHTML = '<option value="">Error loading positions</option>';
        // }
    }

    /**
     * Fetches active onboarding sessions and renders them on the page.
     * This function is now a placeholder as the backend route is removed.
     */
    async function loadOnboardingSessions() {
        if (!sessionListDiv) return;
        sessionListDiv.innerHTML = '<p style="color: var(--text-medium);">Onboarding sessions functionality temporarily disabled.</p>';
        // Removed API call as the route is removed from server.js
        // try {
        //     const sessions = await apiRequest("GET", "/onboarding-sessions");
        //     sessionListDiv.innerHTML = ''; // Clear loading message
        //     if (sessions && sessions.length > 0) {
        //         sessions.forEach(session => {
        //             const sessionItem = document.createElement("div");
        //             sessionItem.className = "onboarding-item";
        //             let completionStatus = session.completedTasks === session.totalTasks ? 'Completed' : `${session.completedTasks}/${session.totalTasks} Tasks Completed`;
                    
        //             sessionItem.innerHTML = `
        //                 <div class="onboarding-item-info">
        //                     <p style="color: var(--text-light); font-weight: 600;">${session.full_name} (${session.position || 'N/A'})</p>
        //                     <p style="color: var(--text-medium);">Email: ${session.email}</p>
        //                     <p style="color: ${session.completedTasks === session.totalTasks ? 'var(--primary-accent)' : 'var(--text-medium)'};">Status: ${completionStatus}</p>
        //                 </div>
        //                 <div class="onboarding-item-actions">
        //                     <button class="btn btn-secondary btn-sm view-details-btn" data-user-id="${session.user_id}">View Progress</button>
        //                 </div>`;
        //             sessionListDiv.appendChild(sessionItem);
        //         });

        //         // Add event listeners to the newly created "View Progress" buttons
        //         sessionListDiv.querySelectorAll('.view-details-btn').forEach(button => {
        //             button.addEventListener('click', (event) => {
        //                 window.location.href = `new-hire-view.html?userId=${event.target.dataset.userId}`;
        //             });
        //         });
        //     } else {
        //         sessionListDiv.innerHTML = '<p>No active onboardings.</p>';
        //     }
        // } catch (error) {
        //     sessionListDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        // }
    }

    // --- Initial Page Load ---
    // Only call placeholder functions or functions that don't rely on removed backend routes
    loadPositions();
    loadOnboardingSessions();
}
