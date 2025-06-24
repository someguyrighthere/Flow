// js/pages/admin.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the admin settings page.
 */
export function handleAdminPage() {
    // Security check
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // Get all necessary elements from the DOM
    const adminContentDiv = document.getElementById("admin-settings-content");
    const newLocationForm = document.getElementById("new-location-form");
    const inviteAdminForm = document.getElementById("invite-admin-form");
    const inviteEmployeeForm = document.getElementById("invite-employee-form");
    const adminLocationSelect = document.getElementById("admin-location-select");
    const employeeLocationSelect = document.getElementById("employee-location-select");

    // --- Data Loading and Rendering Functions ---

    /**
     * Fetches locations from the API and populates the location list and select dropdowns.
     */
    async function loadLocations() {
        const locationListDiv = document.getElementById("location-list");
        if (!locationListDiv) return;

        locationListDiv.innerHTML = "<p>Loading locations...</p>";
        
        try {
            const locations = await apiRequest("GET", "/locations");
            locationListDiv.innerHTML = "";
            
            if (locations.length === 0) {
                locationListDiv.innerHTML = '<p style="color: var(--text-medium);">No locations created yet.</p>';
                if(adminLocationSelect) {
                    adminLocationSelect.innerHTML = '<option value="">No locations available</option>';
                    adminLocationSelect.disabled = true;
                }
                if(employeeLocationSelect) {
                    employeeLocationSelect.innerHTML = '<option value="">No locations available</option>';
                    employeeLocationSelect.disabled = true;
                }
            } else {
                if(adminLocationSelect) adminLocationSelect.disabled = false;
                if(employeeLocationSelect) employeeLocationSelect.disabled = false;

                const locationOptionsHtml = locations.map(loc => `<option value="${loc.location_id}">${loc.location_name}</option>`).join('');
                if (adminLocationSelect) adminLocationSelect.innerHTML = `<option value="">Select a location</option>${locationOptionsHtml}`;
                if (employeeLocationSelect) employeeLocationSelect.innerHTML = `<option value="">Select a location</option>${locationOptionsHtml}`;
                
                locations.forEach(loc => {
                    const locDiv = document.createElement("div");
                    locDiv.className = "list-item";
                    locDiv.innerHTML = `<span>${loc.location_name} - ${loc.location_address}</span>
                                        <button class="btn-delete" data-type="location" data-id="${loc.location_id}">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 1 0 0 1-2 2H5a2 1 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                                        </button>`;
                    locationListDiv.appendChild(locDiv);
                });
            }
        } catch (error) {
            console.error("Error loading locations:", error);
            showModalMessage(`Failed to load locations: ${error.message}`, true);
        }
    }

    /**
     * Fetches users from the API and populates the user list.
     */
    async function loadUsers() {
        const userListDiv = document.getElementById("user-list");
        if (!userListDiv) return;
        userListDiv.innerHTML = "<p>Loading users...</p>";
        try {
            const users = await apiRequest("GET", "/users");
            userListDiv.innerHTML = "";
            if (users.length === 0) {
                userListDiv.innerHTML = '<p style="color: var(--text-medium);">No users invited yet.</p>';
            } else {
                users.forEach(user => {
                    const userDiv = document.createElement("div");
                    userDiv.className = "list-item";
                    let userInfo = `${user.full_name} - Role: ${user.role}`;
                    if (user.location_name) userInfo += ` @ ${user.location_name}`;
                    userDiv.innerHTML = `<span>${userInfo}</span>
                                         <button class="btn-delete" data-type="user" data-id="${user.user_id}">
                                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 1 0 0 1-2 2H5a2 1 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                                         </button>`;
                    userListDiv.appendChild(userDiv);
                });
            }
        } catch (error) {
            console.error("Error loading users:", error);
            userListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading users: ${error.message}</p>`;
        }
    }
    
    // --- Event Listeners ---

    // Generic delete handler for locations and users
    if (adminContentDiv) {
        adminContentDiv.addEventListener('click', async (e) => {
            const deleteButton = e.target.closest('.btn-delete');
            if (!deleteButton) return;
            
            const id = deleteButton.dataset.id;
            const type = deleteButton.dataset.type;
            const confirmed = await showConfirmModal(`Are you sure you want to delete this ${type}? This action cannot be undone.`, 'Delete');
            
            if (confirmed) {
                try {
                    let endpoint = type === 'location' ? `/locations/${id}` : `/users/${id}`;
                    await apiRequest('DELETE', endpoint);
                    showModalMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`, false);
                    loadLocations(); 
                    loadUsers();
                } catch (error) {
                    showModalMessage(`Error deleting ${type}: ${error.message}`, true);
                }
            }
        });
    }

    // New location form submission
    if (newLocationForm) {
        newLocationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-location-name');
            const addressInput = document.getElementById('new-location-address');
            try {
                await apiRequest('POST', '/locations', { location_name: nameInput.value, location_address: addressInput.value });
                showModalMessage('Location created!', false);
                nameInput.value = '';
                addressInput.value = '';
                loadLocations();
            } catch (error) {
                showModalMessage(`Error: ${error.message}`, true);
            }
        });
    }

    // Invite admin form submission
    if (inviteAdminForm) {
        inviteAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('admin-name').value;
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            const locationId = document.getElementById('admin-location-select').value;
            try {
                await apiRequest('POST', '/invite-admin', { full_name: fullName, email, password, location_id: parseInt(locationId) });
                showModalMessage('Admin invited successfully!', false);
                inviteAdminForm.reset();
                loadUsers();
            } catch (error) {
                showModalMessage(`Error: ${error.message}`, true);
            }
        });
    }

    // Invite employee form submission
    if (inviteEmployeeForm) {
        inviteEmployeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('employee-name').value;
            const email = document.getElementById('employee-email').value;
            const password = document.getElementById('employee-password').value;
            const position = document.getElementById('employee-position').value;
            const employee_id = document.getElementById('employee-id').value;
            const locationId = document.getElementById('employee-location-select').value;
            try {
                await apiRequest('POST', '/invite-employee', { full_name: fullName, email, password, position, employee_id, location_id: parseInt(locationId) });
                showModalMessage('Employee invited successfully!', false);
                inviteEmployeeForm.reset();
                loadUsers();
            } catch (error) {
                showModalMessage(`Error: ${error.message}`, true);
            }
        });
    }

    // Initial page load
    loadLocations();
    loadUsers();
}
