// js/pages/admin.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

// SVG icon for the delete button, extracted to a constant for cleaner template literals
const DELETE_SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`;

/**
 * Handles all logic for the admin settings page.
 */
export function handleAdminPage() {
    // Security check: Redirect to login page if no authentication token is found in local storage
    const authToken = localStorage.getItem("authToken");
    const userRole = localStorage.getItem('userRole');

    if (!authToken || (userRole !== 'super_admin' && userRole !== 'location_admin')) {
        window.location.href = "login.html";
        return;
    }

    // Hide sections based on user role for UI consistency (backend also enforces this)
    if (userRole === 'location_admin') {
        const inviteAdminCard = document.getElementById('invite-admin-card');
        if (inviteAdminCard) {
            inviteAdminCard.style.display = 'none';
        }
        const manageLocationsCard = document.getElementById('manage-locations-card');
        if (manageLocationsCard) {
            manageLocationsCard.style.display = 'none';
        }
    }

    // --- DOM Element Selection ---
    const locationListDiv = document.getElementById('location-list');
    const newLocationForm = document.getElementById('new-location-form');
    const newLocationNameInput = document.getElementById('new-location-name');
    const newLocationAddressInput = document.getElementById('new-location-address');
    const newLocationStatusMessage = document.getElementById('new-location-status-message');
    const userListDiv = document.getElementById('user-list');
    const inviteAdminForm = document.getElementById('invite-admin-form');
    const adminLocationSelect = document.getElementById('admin-location-select');
    const inviteAdminStatusMessage = document.getElementById('invite-admin-status-message');
    const inviteEmployeeForm = document.getElementById('invite-employee-form');
    const employeeLocationSelect = document.getElementById('employee-location-select'); 
    const employeeAvailabilityGrid = document.getElementById('employee-availability-grid'); // This ID is not in admin.html, but keep for now if it's used elsewhere
    const inviteEmployeeStatusMessage = document.getElementById('invite-employee-status-message');

    // Business Settings Form Elements
    const businessSettingsForm = document.getElementById('business-settings-form');
    const operatingHoursStartInput = document.getElementById('operating-hours-start');
    const operatingHoursEndInput = document.getElementById('operating-hours-end');
    const currentOperatingHoursDisplay = document.getElementById('current-operating-hours-display');
    const businessSettingsStatusMessage = document.getElementById('business-settings-status-message');


    // Default business hours for availability generation, fetched from backend if available
    let businessOperatingStartHour = 0; // Default to 00:00 (midnight)
    let businessOperatingEndHour = 24; // Default to 24:00 (midnight next day)

    // --- Helper function to display local status messages ---
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

    // NEW: Helper function to convert 24-hour time string to 12-hour format
    function convertTo12Hour(time24) {
        if (!time24) return 'N/A';
        const [hour, minute] = time24.split(':');
        const h = parseInt(hour, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHour = h % 12 === 0 ? 12 : h % 12;
        return `${displayHour}:${minute} ${ampm}`;
    }

    // --- Data Loading Functions ---

    /**
     * Fetches and displays existing locations.
     */
    async function loadLocations() {
        if (!locationListDiv) return;
        locationListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading locations...</p>'; // Show loading state
        try {
            // API call to get locations (backend filters by location_admin role)
            const locations = await apiRequest('GET', '/api/locations');
            locationListDiv.innerHTML = ''; // Clear loading message

            if (locations && locations.length > 0) {
                locations.forEach(loc => {
                    const listItem = document.createElement('div');
                    listItem.className = 'list-item';
                    listItem.innerHTML = `
                        <span><strong>${loc.location_name}</strong> (${loc.location_address})</span>
                        <button class="btn-delete" data-id="${loc.location_id}" data-type="location" title="Delete Location">
                            ${DELETE_SVG_ICON}
                        </button>
                    `;
                    locationListDiv.appendChild(listItem);
                });
            } else {
                locationListDiv.innerHTML = '<p style="color: var(--text-medium);">No locations added yet.</p>';
            }
        } catch (error) {
            showModalMessage(`Error loading locations: ${error.message}`, true); 
            console.error('Error loading locations:', error);
        }
    }

    /**
     * Populates the location dropdowns for inviting new admins and employees.
     */
    async function populateLocationDropdowns() {
        if (!adminLocationSelect || !employeeLocationSelect) return;
        try {
            // API call to get locations (backend filters by location_admin role)
            const locations = await apiRequest('GET', '/api/locations');
            
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
            // Display a message to the user if dropdowns can't be loaded
            showModalMessage('Failed to load locations for dropdowns. Please try again.', true);
        }
    }

    /**
     * Fetches and displays all users (admins and employees).
     */
    async function loadUsers() {
        if (!userListDiv) return;
        userListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading users...</p>'; // Show loading state
        try {
            // API call to get users (backend filters by location_admin role)
            const users = await apiRequest('GET', '/api/users');
            userListDiv.innerHTML = ''; // Clear loading message

            if (users && users.length > 0) {
                const userGroups = {
                    super_admin: [],
                    location_admin: [],
                    employee: []
                };

                // Categorize users by role
                users.forEach(user => {
                    if (userGroups[user.role]) {
                        userGroups[user.role].push(user);
                    }
                });

                const groupOrder = ['super_admin', 'location_admin', 'employee'];
                const groupTitles = {
                    super_admin: 'Super Admins',
                    location_admin: 'Location Admins',
                    employee: 'Employees'
                };

                // Render users grouped by role
                groupOrder.forEach(role => {
                    const group = userGroups[role];
                    if (group.length > 0) {
                        const groupHeader = document.createElement('h4');
                        groupHeader.textContent = groupTitles[role];
                        userListDiv.appendChild(groupHeader);
                        
                        group.forEach(user => {
                            let userDisplayTitle;
                            // Determine the title to display based on role or position
                            // NEW LOGIC: Use role for Super Admin and Location Admin
                            if (user.role === 'super_admin') {
                                userDisplayTitle = 'Super Admin';
                            } else if (user.role === 'location_admin') {
                                userDisplayTitle = 'Location Admin';
                            } else { // employee role
                                userDisplayTitle = (user.position && user.position.trim() !== '') ? user.position : 'N/A';
                            }

                            const userLocationDisplay = (user.location_name && user.location_name.trim() !== '') 
                                ? `<br><small style="color:var(--text-medium);">Location: ${user.location_name}</small>` 
                                : ''; // Only display location line if location_name exists

                            const listItem = document.createElement('div');
                            listItem.className = 'list-item';
                            listItem.innerHTML = `
                                <span>
                                    <strong>${user.full_name}</strong> (${userDisplayTitle}) 
                                    ${userLocationDisplay}
                                </span>
                                <button class="btn-delete" data-id="${user.user_id}" data-type="user" title="Delete User">
                                    ${DELETE_SVG_ICON}
                                </button>
                            `;
                            userListDiv.appendChild(listItem);
                        });
                    }
                });
            } else {
                userListDiv.innerHTML = '<p style="color: var(--text-medium);">No users found.</p>';
            }
        } catch (error) {
            showModalMessage(`Error loading users: ${error.message}`, true);
            console.error('Error loading users:', error);
        }
    }

    /**
     * Fetches business operating hours to set the range for availability inputs.
     * Also displays current hours.
     */
    async function fetchBusinessHours() {
        if (!currentOperatingHoursDisplay || !operatingHoursStartInput || !operatingHoursEndInput) return;

        currentOperatingHoursDisplay.textContent = 'Loading current hours...';
        try {
            const settings = await apiRequest('GET', '/api/settings/business');
            if (settings) {
                // Update internal variables for availability generation
                businessOperatingStartHour = parseInt((settings.operating_hours_start || '00:00').split(':')[0], 10);
                businessOperatingEndHour = parseInt((settings.operating_hours_end || '24:00').split(':')[0], 10);
                
                // Set the form input values (still 24-hour format for input type="time")
                operatingHoursStartInput.value = settings.operating_hours_start || '';
                operatingHoursEndInput.value = settings.operating_hours_end || '';

                // Display current hours in 12-hour format
                const displayStart = convertTo12Hour(settings.operating_hours_start);
                const displayEnd = convertTo12Hour(settings.operating_hours_end);
                currentOperatingHoursDisplay.textContent = `Current: ${displayStart} - ${displayEnd}`;
                currentOperatingHoursDisplay.style.color = 'var(--text-light)'; // Reset color if it was an error before

                generateAvailabilityInputs(); // Regenerate inputs with correct hours
            } else {
                currentOperatingHoursDisplay.textContent = 'Current hours: Not set';
                currentOperatingHoursDisplay.style.color = 'var(--text-medium)';
                generateAvailabilityInputs(); // Use defaults if no settings
            }
        } catch (error) {
            console.error("Failed to fetch business hours, using defaults:", error);
            currentOperatingHoursDisplay.textContent = `Error loading current hours: ${error.message}`;
            currentOperatingHoursDisplay.style.color = '#ff8a80'; // Error color
            generateAvailabilityInputs(); // Continue with default 0-24 hours if fetch fails
        }
    }

    /**
     * Generates time input dropdowns for weekly availability.
     */
    function generateAvailabilityInputs() {
        if (!employeeAvailabilityGrid) return; // Check if the element exists
        employeeAvailabilityGrid.innerHTML = ''; // Clear existing inputs
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        days.forEach(day => {
            const dayId = day.toLowerCase();
            const availabilityHtml = `
                <label for="avail-${dayId}-start">${day}</label>
                <div class="time-range">
                    <select id="avail-${dayId}-start" data-day="${dayId}" data-type="start">
                        ${generateTimeOptions(businessOperatingStartHour, businessOperatingEndHour)}
                    </select>
                    <span>-</span>
                    <select id="avail-${dayId}-end" data-day="${dayId}" data-type="end">
                        ${generateTimeOptions(businessOperatingStartHour, businessOperatingEndHour)}
                    </select>
                </div>
            `;
            const div = document.createElement('div');
            div.className = 'availability-day';
            div.innerHTML = availabilityHtml;
            employeeAvailabilityGrid.appendChild(div);
        });
    }

    /**
     * Generates <option> tags for time select dropdowns.
     * @param {number} startHour - The starting hour (0-23).
     * @param {number} endHour - The ending hour (0-24, where 24 means end of day).
     * @returns {string} HTML string of option tags.
     */
    function generateTimeOptions(startHour = 0, endHour = 24) {
        let options = '<option value="">Not Available</option>'; // Default "Not Available"
        for (let i = startHour; i <= endHour; i++) { // Include endHour for full range, e.g., 17:00
            const hour24 = i;
            const displayHour = hour24 % 12 === 0 ? 12 : hour24 % 12;
            const ampm = hour24 < 12 ? 'AM' : 'PM';
            const timeValue = `${String(hour24).padStart(2, '0')}:00`; // Value for input type="time" (24-hour)
            const displayText = `${displayHour}:00 ${ampm}`; // Text for display (12-hour)
            options += `<option value="${timeValue}">${displayText}</option>`;
        }
        return options;
    }

    // --- Event Listeners ---

    // Handle new location form submission
    if (newLocationForm) {
        newLocationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const locationData = {
                location_name: newLocationNameInput.value.trim(),
                location_address: newLocationAddressInput.value.trim()
            };
            if (!locationData.location_name || !locationData.location_address) {
                return displayStatusMessage(newLocationStatusMessage, 'Location name and address are required.', true);
            }
            try {
                await apiRequest('POST', '/api/locations', locationData);
                displayStatusMessage(newLocationStatusMessage, 'Location created successfully!', false);
                newLocationForm.reset(); // Clear the form
                loadLocations(); // Reload location list
                populateLocationDropdowns(); // Update dropdowns
            } catch (error) {
                displayStatusMessage(newLocationStatusMessage, `Error creating location: ${error.message}`, true);
                console.error('Error creating location:', error);
            }
        });
    }

    // Handle delete actions for locations and users using event delegation
    const handleDelete = async (e) => {
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const type = deleteBtn.dataset.type; // 'user' or 'location'
            
            let confirmMessage = `Are you sure you want to delete this ${type}? This action cannot be undone.`;
            if (type === 'location') {
                confirmMessage = `Are you sure you want to delete this location? All users associated with this location must be reassigned or deleted first. This cannot be undone.`;
            } else if (type === 'user') {
                 confirmMessage = `Are you sure you want to delete this user? This will also remove any onboarding tasks assigned to them. This cannot be undone.`;
            }

            const confirmed = await showConfirmModal(confirmMessage);
            if (confirmed) {
                try {
                    await apiRequest('DELETE', `/api/${type}s/${id}`); // Call the generic delete endpoint
                    showModalMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully.`, false);
                    if (type === 'location') {
                        loadLocations(); // Reload locations
                        populateLocationDropdowns(); // Update dropdowns
                    } else if (type === 'user') {
                        loadUsers(); // Reload users
                    }
                } catch (error) {
                    showModalMessage(`Error deleting ${type}: ${error.message}`, true);
                    console.error(`Error deleting ${type}:`, error);
                }
            }
        }
    };

    // Attach delegated event listeners to the parent containers
    if (locationListDiv) locationListDiv.addEventListener('click', handleDelete);
    if (userListDiv) userListDiv.addEventListener('click', handleDelete);

    // Handle invite new admin form submission
    if (inviteAdminForm) {
        inviteAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminData = {
                full_name: document.getElementById('admin-name').value.trim(),
                email: document.getElementById('admin-email').value.trim(),
                password: document.getElementById('admin-password').value,
                location_id: adminLocationSelect.value || null
            };
            if (!adminData.full_name || !adminData.email || !adminData.password || !adminData.location_id) {
                return displayStatusMessage(inviteAdminStatusMessage, 'Full name, email, password, and location are required.', true);
            }
            try {
                await apiRequest('POST', '/api/invite-admin', adminData);
                displayStatusMessage(inviteAdminStatusMessage, 'Admin invited successfully!', false);
                inviteAdminForm.reset(); // Clear the form
                loadUsers(); // Reload user list to show new admin
            } catch (error) {
                displayStatusMessage(inviteAdminStatusMessage, `Error: ${error.message}`, true);
                console.error('Error inviting admin:', error);
            }
        });
    }

    // Handle invite new employee form submission
    if (inviteEmployeeForm) {
        inviteEmployeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const availability = {};
            // Collect availability data from generated selects
            // Ensure employeeAvailabilityGrid exists before querying its children
            if (employeeAvailabilityGrid) {
                document.querySelectorAll('#employee-availability-grid select').forEach(select => {
                    const day = select.dataset.day;
                    const type = select.dataset.type; // 'start' or 'end'
                    if (select.value) { // Only add if a time is selected (not "Not Available")
                        if (!availability[day]) availability[day] = {};
                        availability[day][type] = select.value;
                    }
                });
            }

            const employeeData = {
                full_name: document.getElementById('employee-name').value.trim(),
                email: document.getElementById('employee-email').value.trim(),
                password: document.getElementById('employee-password').value,
                position: document.getElementById('employee-position').value.trim(),
                employee_id: document.getElementById('employee-id').value.trim(), // Ensure this element exists in HTML
                employment_type: document.getElementById('employee-type').value, // Ensure this element exists in HTML
                location_id: employeeLocationSelect.value || null,
                availability: Object.keys(availability).length > 0 ? availability : null // Send as JSON object or null
            };

            if (!employeeData.full_name || !employeeData.email || !employeeData.password || !employeeData.location_id) {
                return displayStatusMessage(inviteEmployeeStatusMessage, 'Name, email, password, and location are required.', true);
            }
            try {
                await apiRequest('POST', '/api/invite-employee', employeeData);
                displayStatusMessage(inviteEmployeeStatusMessage, 'Employee invited successfully!', false);
                inviteEmployeeForm.reset(); // Clear the form
                // Only call generateAvailabilityInputs if employeeAvailabilityGrid exists to avoid errors
                if (employeeAvailabilityGrid) {
                    generateAvailabilityInputs(); // Regenerate default availability inputs
                }
                loadUsers(); // Reload user list to show new employee
            } catch (error) {
                displayStatusMessage(inviteEmployeeStatusMessage, `Error: ${error.message}`, true);
                console.error('Error inviting employee:', error);
            }
        });
    }

    // Handle business settings form submission
    if (businessSettingsForm) {
        businessSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const start_time = operatingHoursStartInput.value;
            const end_time = operatingHoursEndInput.value;

            if (!start_time || !end_time) {
                displayStatusMessage(businessSettingsStatusMessage, 'Both start and end times are required.', true);
                return;
            }

            try {
                // Send update request to backend
                await apiRequest('PUT', '/api/settings/business', {
                    operating_hours_start: start_time,
                    operating_hours_end: end_time
                });
                displayStatusMessage(businessSettingsStatusMessage, 'Operating hours updated successfully!', false);
                fetchBusinessHours(); // Refresh displayed hours and availability inputs
            } catch (error) {
                displayStatusMessage(businessSettingsStatusMessage, `Error updating hours: ${error.message}`, true);
                console.error('Error updating business settings:', error);
            }
        });
    }

    // --- Initial Page Load Actions ---
    // Fetch business hours first to correctly set availability input ranges
    fetchBusinessHours().then(() => {
        // Then load other data that might depend on business hours or just needs to be loaded
        loadLocations();
        populateLocationDropdowns();
        loadUsers();
    });
}
