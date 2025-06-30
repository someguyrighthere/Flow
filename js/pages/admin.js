// js/pages/admin.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleAdminPage() {
    // Security check
    const userRole = localStorage.getItem('userRole');
    if (!localStorage.getItem("authToken") || (userRole !== 'super_admin' && userRole !== 'location_admin')) {
        window.location.href = "login.html";
        return;
    }

    // DOM Element Selection
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
    const employeeAvailabilityGrid = document.getElementById('employee-availability-grid');
    const inviteEmployeeStatusMessage = document.getElementById('invite-employee-status-message');

    let businessOperatingStartHour = 0; // Default start hour
    let businessOperatingEndHour = 24; // Default end hour

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

    async function loadLocations() {
        if (!locationListDiv) return;
        locationListDiv.innerHTML = '<p>Loading...</p>';
        try {
            const locations = await apiRequest('GET', '/api/locations');
            locationListDiv.innerHTML = '';

            if (locations && locations.length > 0) {
                locations.forEach(loc => {
                    const listItem = document.createElement('div');
                    listItem.className = 'list-item';
                    listItem.innerHTML = `
                        <span><strong>${loc.location_name}</strong></span>
                        <button class="btn-delete" data-id="${loc.location_id}" data-type="location">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                        </button>
                    `;
                    locationListDiv.appendChild(listItem);
                });
            } else {
                locationListDiv.innerHTML = '<p>No locations added yet.</p>';
            }
        } catch (error) {
            showModalMessage(`Error loading locations: ${error.message}`, true); 
        }
    }

    async function populateLocationDropdowns() {
        if (!adminLocationSelect || !employeeLocationSelect) return;
        try {
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
        }
    }

    async function loadUsers() {
        if (!userListDiv) return;
        userListDiv.innerHTML = '<p>Loading users...</p>';
        try {
            const users = await apiRequest('GET', '/api/users');
            userListDiv.innerHTML = '';

            if (users && users.length > 0) {
                const userGroups = {
                    super_admin: [],
                    location_admin: [],
                    employee: []
                };

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

                groupOrder.forEach(role => {
                    const group = userGroups[role];
                    if (group.length > 0) {
                        const groupHeader = document.createElement('h4');
                        groupHeader.textContent = groupTitles[role];
                        userListDiv.appendChild(groupHeader);
                        
                        group.forEach(user => {
                            const listItem = document.createElement('div');
                            listItem.className = 'list-item';
                            listItem.innerHTML = `
                                <span><strong>${user.full_name}</strong> (${user.email})</span>
                                <button class="btn-delete" data-id="${user.user_id}" data-type="user">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                                </button>
                            `;
                            userListDiv.appendChild(listItem);
                        });
                    }
                });
            } else {
                userListDiv.innerHTML = '<p>No users found.</p>';
            }
        } catch (error) {
            showModalMessage(`Error loading users: ${error.message}`, true);
        }
    }

    function generateAvailabilityInputs() {
        if (!employeeAvailabilityGrid) return;
        employeeAvailabilityGrid.innerHTML = '';
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

    function generateTimeOptions(startHour = 0, endHour = 24) {
        let options = '<option value="">Not Available</option>';
        for (let i = startHour; i < endHour; i++) {
            const hour = i < 10 ? '0' + i : '' + i;
            options += `<option value="${hour}:00">${hour}:00</option>`;
        }
        return options;
    }

    // Event Listeners
    if (newLocationForm) {
        newLocationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const locationData = {
                location_name: newLocationNameInput.value.trim(),
                location_address: newLocationAddressInput.value.trim()
            };
            if (!locationData.location_name || !locationData.location_address) {
                return displayStatusMessage(newLocationStatusMessage, 'Name and address are required.', true);
            }
            try {
                await apiRequest('POST', '/api/locations', locationData);
                displayStatusMessage(newLocationStatusMessage, 'Location created!', false);
                newLocationForm.reset();
                loadLocations();
                populateLocationDropdowns();
            } catch (error) {
                displayStatusMessage(newLocationStatusMessage, `Error: ${error.message}`, true);
            }
        });
    }

    const handleDelete = async (e) => {
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const type = deleteBtn.dataset.type;
            const confirmed = await showConfirmModal(`Are you sure you want to delete this ${type}?`);
            if (confirmed) {
                try {
                    await apiRequest('DELETE', `/api/${type}s/${id}`);
                    showModalMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully.`, false);
                    if (type === 'location') {
                        loadLocations();
                        populateLocationDropdowns();
                    } else if (type === 'user') {
                        loadUsers();
                    }
                } catch (error) {
                    showModalMessage(`Error deleting ${type}: ${error.message}`, true);
                }
            }
        }
    };

    if (locationListDiv) locationListDiv.addEventListener('click', handleDelete);
    if (userListDiv) userListDiv.addEventListener('click', handleDelete);

    if (inviteAdminForm) {
        inviteAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminData = {
                full_name: document.getElementById('admin-name').value.trim(),
                email: document.getElementById('admin-email').value.trim(),
                password: document.getElementById('admin-password').value,
                location_id: document.getElementById('admin-location-select').value || null
            };
            if (!adminData.full_name || !adminData.email || !adminData.password) {
                return displayStatusMessage(inviteAdminStatusMessage, 'All fields are required.', true);
            }
            try {
                await apiRequest('POST', '/api/invite-admin', adminData);
                displayStatusMessage(inviteAdminStatusMessage, 'Admin invited successfully!', false);
                inviteAdminForm.reset();
                loadUsers();
            } catch (error) {
                displayStatusMessage(inviteAdminStatusMessage, `Error: ${error.message}`, true);
            }
        });
    }

    if (inviteEmployeeForm) {
        inviteEmployeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const availability = {};
            document.querySelectorAll('#employee-availability-grid select').forEach(select => {
                if(select.value) {
                    const day = select.dataset.day;
                    const type = select.dataset.type;
                    if(!availability[day]) availability[day] = {};
                    availability[day][type] = select.value;
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
                availability: Object.keys(availability).length > 0 ? availability : null
            };

            if (!employeeData.full_name || !employeeData.email || !employeeData.password || !employeeData.location_id) {
                return displayStatusMessage(inviteEmployeeStatusMessage, 'Name, email, password, and location are required.', true);
            }
            try {
                await apiRequest('POST', '/api/invite-employee', employeeData);
                displayStatusMessage(inviteEmployeeStatusMessage, 'Employee invited successfully!', false);
                inviteEmployeeForm.reset();
                loadUsers();
            } catch (error) {
                displayStatusMessage(inviteEmployeeStatusMessage, `Error: ${error.message}`, true);
            }
        });
    }

    // Initial Page Load
    generateAvailabilityInputs();
    loadLocations();
    populateLocationDropdowns();
    loadUsers();
}
