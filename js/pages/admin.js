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
    const availabilityGrid = document.getElementById("employee-availability-grid");

    // --- Data Loading and Rendering Functions ---

    /**
     * Generates the structured availability input fields.
     */
    function generateAvailabilityInputs() {
        if (!availabilityGrid) return;
        availabilityGrid.innerHTML = ''; // Clear previous content
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        const timeOptions = ['Not Available'];
        for (let i = 0; i < 24; i++) {
            const hour = i % 12 === 0 ? 12 : i % 12;
            const ampm = i < 12 ? 'AM' : 'PM';
            const time = `${hour}:00 ${ampm}`;
            timeOptions.push(`<option value="${i}:00">${time}</option>`);
        }

        days.forEach(day => {
            const dayId = day.toLowerCase();
            const dayHtml = `
                <div class="availability-day">
                    <label for="available-${dayId}">
                        <input type="checkbox" id="available-${dayId}" data-day="${dayId}">
                        ${day}
                    </label>
                    <div class="time-range">
                        <select id="start-time-${dayId}" disabled>
                            ${timeOptions.join('')}
                        </select>
                        <span>to</span>
                        <select id="end-time-${dayId}" disabled>
                            ${timeOptions.join('')}
                        </select>
                    </div>
                </div>
            `;
            availabilityGrid.insertAdjacentHTML('beforeend', dayHtml);
        });

        // Add event listeners to enable/disable time selects based on checkbox
        availabilityGrid.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const day = e.target.dataset.day;
                const startTimeSelect = document.getElementById(`start-time-${day}`);
                const endTimeSelect = document.getElementById(`end-time-${day}`);
                startTimeSelect.disabled = !e.target.checked;
                endTimeSelect.disabled = !e.target.checked;
                if (!e.target.checked) {
                    startTimeSelect.value = "Not Available";
                    endTimeSelect.value = "Not Available";
                } else {
                    startTimeSelect.value = "9:00"; // Default start time
                    endTimeSelect.value = "17:00"; // Default end time
                }
            });
        });
    }

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

            // Collect structured availability data
            const availability = {};
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            days.forEach(day => {
                const checkbox = document.getElementById(`available-${day}`);
                if (checkbox.checked) {
                    const startTime = document.getElementById(`start-time-${day}`).value;
                    const endTime = document.getElementById(`end-time-${day}`).value;
                    availability[day] = { start: startTime, end: endTime };
                } else {
                    availability[day] = null; // Mark as not available
                }
            });

            const payload = {
                full_name: document.getElementById('employee-name').value,
                email: document.getElementById('employee-email').value,
                password: document.getElementById('employee-password').value,
                position: document.getElementById('employee-position').value,
                employee_id: document.getElementById('employee-id').value,
                location_id: parseInt(document.getElementById('employee-location-select').value),
                employment_type: document.getElementById('employee-type').value,
                availability: availability
            };
            
            try {
                await apiRequest('POST', '/invite-employee', payload);
                showModalMessage('Employee invited successfully!', false);
                inviteEmployeeForm.reset();
                generateAvailabilityInputs(); // Reset the availability grid
                loadUsers();
            } catch (error) {
                showModalMessage(`Error: ${error.message}`, true);
            }
        });
    }

    // Initial page load
    generateAvailabilityInputs();
    loadLocations();
    loadUsers();
}
