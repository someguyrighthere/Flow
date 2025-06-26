// js/pages/admin.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleAdminPage() {
    // Security check: Redirect if not logged in or not an admin
    const userRole = localStorage.getItem('userRole');
    if (!localStorage.getItem("authToken") || (userRole !== 'super_admin' && userRole !== 'location_admin')) {
        window.location.href = "login.html"; // Redirect to login
        return;
    }

    // --- DOM Element Selection ---
    const businessSettingsForm = document.getElementById('business-settings-form');
    const operatingHoursStartInput = document.getElementById('operating-hours-start');
    const operatingHoursEndInput = document.getElementById('operating-hours-end');
    const operatingHoursStatusMessage = document.getElementById('operating-hours-status-message'); // NEW: Reference to status message element
    const locationListDiv = document.getElementById('location-list');
    const newLocationForm = document.getElementById('new-location-form');
    const newLocationNameInput = document.getElementById('new-location-name');
    const newLocationAddressInput = document.getElementById('new-location-address');

    const userListDiv = document.getElementById('user-list');
    const inviteAdminForm = document.getElementById('invite-admin-form');
    const adminLocationSelect = document.getElementById('admin-location-select');
    const inviteEmployeeForm = document.getElementById('invite-employee-form');
    const employeeLocationSelect = document.getElementById('employee-location-select');
    const employeeAvailabilityGrid = document.getElementById('employee-availability-grid');

    // --- Helper function to display local status messages ---
    function displayStatusMessage(element, message, isError = false) {
        if (!element) return;
        element.textContent = message;
        element.classList.remove('success', 'error'); // Clear previous states
        element.classList.add(isError ? 'error' : 'success');
        // Clear message after a few seconds
        setTimeout(() => {
            element.textContent = '';
            element.classList.remove('success', 'error');
        }, 5000); 
    }

    // --- Data Loading Functions ---

    /**
     * Loads and displays current business settings (operating hours).
     */
    async function loadBusinessSettings() {
        if (!businessSettingsForm || !operatingHoursStartInput || !operatingHoursEndInput) return;
        try {
            const settings = await apiRequest('GET', '/settings/business');
            // Ensure values are set, providing defaults if null
            operatingHoursStartInput.value = settings.operating_hours_start || '09:00';
            operatingHoursEndInput.value = settings.operating_hours_end || '17:00';
        } catch (error) {
            displayStatusMessage(operatingHoursStatusMessage, 'Could not load business settings. Using defaults.', true); // Use local status message
            console.error('Error loading business settings:', error);
        }
    }

    /**
     * Loads and displays all locations.
     */
    async function loadLocations() {
        if (!locationListDiv) return;
        locationListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading locations...</p>';
        try {
            const locations = await apiRequest('GET', '/locations');
            locationListDiv.innerHTML = ''; // Clear loading message

            if (locations && locations.length > 0) {
                locations.forEach(loc => {
                    const listItem = document.createElement('div');
                    listItem.className = 'list-item';
                    listItem.innerHTML = `
                        <span><strong>${loc.location_name}</strong> (${loc.location_address})</span>
                        <button class="btn-delete" data-id="${loc.location_id}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 1 0 0 1-2 2H5a2 1 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                        </button>
                    `;
                    locationListDiv.appendChild(listItem);
                });
            } else {
                locationListDiv.innerHTML = '<p style="color: var(--text-medium);">No locations added yet.</p>';
            }
        } catch (error) {
            displayStatusMessage(locationListDiv, `Error loading locations: ${error.message}`, true); // Use local status message
            console.error('Error loading locations:', error);
        }
    }

    /**
     * Populates location dropdowns for inviting users.
     */
    async function populateLocationDropdowns() {
        if (!adminLocationSelect || !employeeLocationSelect) return;
        try {
            const locations = await apiRequest('GET', '/locations');
            
            // Clear existing options, keep default "Select Location" or similar
            adminLocationSelect.innerHTML = '<option value="">Select Location</option>';
            employeeLocationSelect.innerHTML = '<option value="">Select Location</option>';

            if (locations && locations.length > 0) {
                locations.forEach(loc => {
                    const adminOption = new Option(loc.location_name, loc.location_id);
                    const employeeOption = new Option(loc.location_name, loc.location_id);
                    adminLocationSelect.add(adminOption);
                    employeeLocationSelect.add(employeeOption);
                });
            } else {
                adminLocationSelect.innerHTML = '<option value="">No locations available</option>';
                employeeLocationSelect.innerHTML = '<option value="">No locations available</option>';
            }
        } catch (error) {
            console.error("Failed to populate location dropdowns:", error);
            // Since this is a dropdown, not a primary status area, console.error is sufficient.
            // showModalMessage("Could not load locations for user assignment.", true); // Removed showModalMessage for this case
        }
    }

    /**
     * Loads and displays all users (admins and employees).
     */
    async function loadUsers() {
        if (!userListDiv) return;
        userListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading users...</p>';
        try {
            const users = await apiRequest('GET', '/users');
            userListDiv.innerHTML = ''; // Clear loading message

            if (users && users.length > 0) {
                users.forEach(user => {
                    const listItem = document.createElement('div');
                    listItem.className = 'list-item';
                    let userInfo = `<span><strong>${user.full_name}</strong> (${user.email}) - ${user.role}`;
                    if (user.position) userInfo += ` (${user.position})`;
                    if (user.location_name) userInfo += ` at ${user.location_name}`;
                    userInfo += `</span>`;

                    listItem.innerHTML = `
                        ${userInfo}
                        <button class="btn-delete" data-id="${user.user_id}">
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 1 0 0 1-2 2H5a2 1 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                        </button>
                    `;
                    userListDiv.appendChild(listItem);
                });
            } else {
                userListDiv.innerHTML = '<p style="color: var(--text-medium);">No users found.</p>';
            }
        } catch (error) {
            displayStatusMessage(userListDiv, `Error loading users: ${error.message}`, true); // Use local status message
            console.error('Error loading users:', error);
        }
    }

    /**
     * Generates time input fields for employee weekly availability.
     * This creates a grid of select inputs for each day of the week,
     * allowing admins to set start and end availability times for employees.
     */
    function generateAvailabilityInputs() {
        if (!employeeAvailabilityGrid) return;
        employeeAvailabilityGrid.innerHTML = ''; // Clear previous inputs
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        days.forEach(day => {
            const dayId = day.toLowerCase();
            const availabilityHtml = `
                <label for="avail-${dayId}-start">${day}</label>
                <div class="time-range">
                    <select id="avail-${dayId}-start" data-day="${dayId}" data-type="start">
                        ${generateTimeOptions()}
                    </select>
                    <span>-</span>
                    <select id="avail-${dayId}-end" data-day="${dayId}" data-type="end">
                        ${generateTimeOptions()}
                    </select>
                </div>
            `;
            const div = document.createElement('div');
            div.className = 'availability-day'; // Used for CSS grid alignment
            div.innerHTML = availabilityHtml;
            employeeAvailabilityGrid.appendChild(div);
        });
    }

    /**
     * Helper function to generate <option> tags for time select inputs (hourly).
     * Provides options from "Not Available" to "23:00".
     * @returns {string} HTML string of time options.
     */
    function generateTimeOptions() {
        let options = '<option value="">Not Available</option>'; // Default empty option
        for (let i = 0; i < 24; i++) {
            const hour = i < 10 ? '0' + i : '' + i; // Format as HH (e.g., 01, 10)
            options += `<option value="${hour}:00">${hour}:00</option>`;
            // options += `<option value="${hour}:30">${hour}:30</option>`; // Optional: add half-hour slots
        }
        return options;
    }

    // --- Event Listeners ---

    // Event listener for saving Business Settings
    if (businessSettingsForm) {
        businessSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const settingsData = {
                operating_hours_start: operatingHoursStartInput.value,
                operating_hours_end: operatingHoursEndInput.value,
            };
            try {
                await apiRequest('POST', '/settings/business', settingsData);
                displayStatusMessage(operatingHoursStatusMessage, 'Business settings saved successfully!', false); // Use local status message
                loadBusinessSettings(); 
            }
            catch (error) {
                displayStatusMessage(operatingHoursStatusMessage, `Error saving settings: ${error.message}`, true); // Use local status message
                console.error('Error saving business settings:', error);
            }
        });
    }

    // Event listener for adding a New Location
    if (newLocationForm) {
        newLocationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const locationData = {
                location_name: newLocationNameInput.value.trim(),
                location_address: newLocationAddressInput.value.trim()
            };
            if (!locationData.location_name || !locationData.location_address) {
                showModalMessage('Location name and address are required.', true);
                return;
            }
            try {
                await apiRequest('POST', '/locations', locationData);
                showModalMessage('Location created successfully!', false);
                newLocationForm.reset();
                loadLocations(); // Refresh the list of locations
                populateLocationDropdowns(); // Refresh location dropdowns in invite forms
            } catch (error) {
                showModalMessage(`Error creating location: ${error.message}`, true);
                console.error('Error creating location:', error);
            }
        });
    }

    // Event listener for deleting a Location (uses event delegation on location list)
    if (locationListDiv) {
        locationListDiv.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.btn-delete');
            if (deleteBtn) {
                const locationId = deleteBtn.dataset.id; // Get location ID from data attribute
                // Confirmation pop-up removed, deletion proceeds directly
                try {
                    await apiRequest('DELETE', `/locations/${locationId}`);
                    showModalMessage('Location deleted successfully!', false); // Still uses showModalMessage for success
                    loadLocations(); // Refresh the list of locations
                    populateLocationDropdowns(); // Refresh location dropdowns
                } catch (error) {
                    showModalMessage(`Error deleting location: ${error.message}`, true);
                    console.error('Error deleting location:', error);
                }
            }
        });
    }

    // Event listener for deleting a User (uses event delegation on user list)
    if (userListDiv) {
        userListDiv.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.btn-delete');
            if (deleteBtn) {
                const userId = deleteBtn.dataset.id; // Get user ID from data attribute
                // Client-side check to prevent an admin from deleting their own account
                if (userId == localStorage.getItem('userId')) { 
                    showModalMessage('You cannot delete your own account from here.', true);
                    return;
                }
                // Confirmation pop-up removed, deletion proceeds directly
                try {
                    await apiRequest('DELETE', `/users/${userId}`);
                    showModalMessage('User deleted successfully!', false); // Still uses showModalMessage for success
                    loadUsers(); // Refresh the user list
                } catch (error) {
                    showModalMessage(`Error deleting user: ${error.message}`, true);
                    console.error('Error deleting user:', error);
                }
            }
        });
    }

    // Event listener for inviting a New Admin
    if (inviteAdminForm) {
        inviteAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminData = {
                full_name: document.getElementById('admin-name').value.trim(),
                email: document.getElementById('admin-email').value.trim(),
                password: document.getElementById('admin-password').value,
                location_id: document.getElementById('admin-location-select').value || null // Location is optional for super_admin
            };
            if (!adminData.full_name || !adminData.email || !adminData.password) {
                showModalMessage('Full name, email, and temporary password are required for new admin.', true);
                return;
            }
            try {
                const response = await apiRequest('POST', '/invite-admin', adminData);
                // Display the temporary password prominently for the admin to note down
                // The tempPassword should be part of the response from the server-side invite-employee route
                showModalMessage(`Admin invited successfully! Temporary Password: <span style="color: var(--primary-accent); font-weight: bold;">${response.tempPassword}</span>. Please provide this to the new admin.`, false);
                inviteAdminForm.reset(); // Clear the form
                loadUsers(); // Refresh user list to show the new admin
            } catch (error) {
                showModalMessage(`Error inviting admin: ${error.message}`, true);
                console.error('Error inviting admin:', error);
            }
        });
    }

    // Event listener for inviting a New Employee
    if (inviteEmployeeForm) {
        inviteEmployeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const availability = {};
            // Collect availability data from the generated inputs
            daysOfWeek.forEach(day => {
                const startInput = document.getElementById(`avail-${day}-start`);
                const endInput = document.getElementById(`avail-${day}-end`);
                if (startInput && endInput && startInput.value && endInput.value) {
                    availability[day] = {
                        start: startInput.value,
                        end: endInput.value
                    };
                }
            });

            const employeeData = {
                full_name: document.getElementById('employee-name').value.trim(),
                email: document.getElementById('employee-email').value.trim(),
                password: document.getElementById('employee-password').value,
                position: document.getElementById('employee-position').value.trim(),
                employee_id: document.getElementById('employee-id').value.trim(),
                employment_type: document.getElementById('employee-type').value,
                location_id: document.getElementById('employee-location-select').value || null,
                availability: Object.keys(availability).length > 0 ? availability : null // Only send if some availability is set
            };

            // Basic validation for required fields
            if (!employeeData.full_name || !employeeData.email || !employeeData.password || !employeeData.location_id) {
                showModalMessage('Full name, email, temporary password, and a location are required for new employee.', true);
                return;
            }
            try {
                const response = await apiRequest('POST', '/invite-employee', employeeData);
                // Display the temporary password
                // The tempPassword should be part of the response from the server-side invite-employee route
                showModalMessage(`Employee invited successfully! Temporary Password: <span style="color: var(--primary-accent); font-weight: bold;">${response.tempPassword}</span>. Please provide this to the new employee.`, false);
                inviteEmployeeForm.reset(); // Clear form
                // Reset availability inputs to "Not Available" after successful submission
                document.querySelectorAll('.availability-day select').forEach(select => select.value = '');
                loadUsers(); // Refresh user list to show the new employee
            } catch (error) {
                showModalMessage(`Error inviting employee: ${error.message}`, true);
                console.error('Error inviting employee:', error);
            }
        });
    }

    // --- Initial Page Load ---
    // These functions are called when the page loads to set up the UI
    loadBusinessSettings(); // Load business operating hours
    loadLocations(); // Load existing locations and display them
    populateLocationDropdowns(); // Populate location dropdowns in invitation forms
    loadUsers(); // Load existing users (admins and employees) and display them
    generateAvailabilityInputs(); // Generate the availability time selection fields for new employees
}
