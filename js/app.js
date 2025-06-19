const API_BASE_URL = 'https://flow-business-suite.onrender.com/api'; // <--- UPDATED WITH YOUR RENDER BACKEND URL

/**
 * Handles API requests to the backend.
 * Includes authentication token in headers if available.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {string} path - API endpoint path (e.g., '/login', '/profile').
 * @param {object} body - Request body data (for POST, PUT).
 * @returns {Promise<object|null>} - JSON response data or null if 204.
 * @throws {Error} - If the API response is not OK.
 */
async function apiRequest(method, path, body = null) {
    const token = localStorage.getItem('authToken');
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE_URL}${path}`, options);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Something went wrong');
    }
    // Return null for No Content responses (204) or empty 200 responses
    if (response.status === 204 || (response.status === 200 && response.headers.get('content-length') === '0')) {
        return null;
    }
    return response.json();
}

/**
 * Displays a custom modal message to the user.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message, false otherwise.
 */
function showModalMessage(message, isError = false) {
    const modalOverlay = document.getElementById('message-modal-overlay');
    const modalMessage = document.getElementById('modal-message-text');
    const modalCloseButton = document.getElementById('modal-close-button');

    if (modalOverlay && modalMessage && modalCloseButton) {
        modalMessage.textContent = message;
        modalMessage.style.color = isError ? '#ff8a80' : 'var(--text-light)'; // Apply error color or default
        modalOverlay.style.display = 'flex'; // Show the modal

        // Hide the modal when the close button is clicked
        modalCloseButton.onclick = () => {
            modalOverlay.style.display = 'none';
        };

        // Hide the modal if clicking outside the content (optional)
        modalOverlay.onclick = (event) => {
            if (event.target === modalOverlay) {
                handleCancel(); // Treat outside click as cancel
            }
        };
    } else {
        // Fallback to console log if modal elements are not found
        console.error("Modal elements not found for showModalMessage. Message:", message);
        // Fallback to alert for critical errors if modal isn't available
        // Note: For a production app, ensure your modal is reliably present.
        if (isError) {
            console.error(`ERROR: ${message}`);
        } else {
            console.log(`MESSAGE: ${message}`);
        }
    }
}

/**
 * Displays a custom confirmation modal.
 * @param {string} message - The confirmation message to display.
 * @param {string} confirmButtonText - Text for the confirm button (e.g., "Delete", "Proceed").
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled.
 */
function showConfirmModal(message, confirmButtonText = 'Confirm') {
    return new Promise((resolve) => {
        const confirmModalOverlay = document.getElementById('confirm-modal-overlay');
        const confirmModalMessage = document.getElementById('confirm-modal-message');
        const modalConfirmButton = document.getElementById('modal-confirm');
        const modalCancelButton = document.getElementById('modal-cancel');

        if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
            console.error("Confirmation modal elements not found. Falling back to native confirm.");
            resolve(window.confirm(message)); // Fallback to native confirm
            return;
        }

        confirmModalMessage.textContent = message;
        modalConfirmButton.textContent = confirmButtonText;

        confirmModalOverlay.style.display = 'flex'; // Show the modal

        const handleConfirm = () => {
            confirmModalOverlay.style.display = 'none';
            modalConfirmButton.removeEventListener('click', handleConfirm);
            modalCancelButton.removeEventListener('click', handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            confirmModalOverlay.style.display = 'none';
            modalConfirmButton.removeEventListener('click', handleConfirm);
            modalCancelButton.removeEventListener('click', handleCancel);
            resolve(false);
        };

        modalConfirmButton.addEventListener('click', handleConfirm);
        modalCancelButton.addEventListener('click', handleCancel);

        // Allow clicking outside the modal to cancel (optional, but consistent with message modal)
        confirmModalOverlay.onclick = (event) => {
            if (event.target === modalOverlay) {
                handleCancel(); // Treat outside click as cancel
            }
        };
    });
}

/**
 * Sets up the functionality for the settings dropdown.
 * Toggles visibility on button click and hides on outside click.
 */
function setupSettingsDropdown() {
    const settingsButton = document.getElementById('settings-button');
    const settingsDropdown = document.getElementById('settings-dropdown');
    const logoutButton = document.getElementById('logout-button'); // Get the logout button

    if (settingsButton && settingsDropdown) {
        settingsButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent the document click from immediately closing it
            settingsDropdown.style.display = settingsDropdown.style.display === 'block' ? 'none' : 'block';
        });

        // Close dropdown if clicked outside
        document.addEventListener('click', (event) => {
            if (settingsDropdown.style.display === 'block' && !settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
                settingsDropdown.style.display = 'none';
            }
        });
    }

    // Add logout functionality
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const confirmed = await showConfirmModal('Are you sure you want to log out?', 'Logout');
            if (confirmed) {
                localStorage.removeItem('authToken'); // Clear authentication token
                window.location.href = 'login.html'; // Redirect to login page
            }
        });
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname;
    if (page.includes('login.html')) {
        handleLoginPage();
    } else if (page.includes('register.html')) { // New registration page handler
        handleRegisterPage();
    }
    else if (page.includes('suite-hub.html')) {
        handleSuiteHubPage();
    } else if (page.includes('account.html')) {
        handleAccountPage();
    } else if (page.includes('admin.html')) {
        handleAdminPage();
    } else if (page.includes('pricing.html')) { // Handle pricing page
        handlePricingPage();
    } else if (page.includes('scheduling.html')) { // Handle scheduling page
        handleSchedulingPage();
    } else if (page.includes('hiring.html')) { // Handle hiring page
        handleHiringPage();
    } /* Removed Sales & Analytics page handler
    else if (page.includes('sales-analytics.html')) { // Handle Sales & Analytics page
        handleSalesAnalyticsPage();
    } */
    else if (page.includes('documents.html')) { // Handle Documents page
        handleDocumentsPage();
    }
    setupSettingsDropdown(); // This is called on every page that includes app.js
});

/**
 * Handles the logic for the login page.
 * Manages form submission and redirects on successful login.
 */
function handleLoginPage() {
    const loginForm = document.getElementById('login-form');
    // Ensure the loginForm exists before adding an event listener
    if (!loginForm) {
        console.error("Login form not found on this page.");
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const email = emailInput.value;
        const password = passwordInput.value;
        const errorMessage = document.getElementById('error-message'); // Existing error message p tag

        // Clear previous error messages and hide
        if (errorMessage) { // Defensive check
            errorMessage.textContent = '';
            errorMessage.classList.remove('visible'); // Hide it visually and from screen readers
        }

        // Basic Client-Side Validation
        if (!email || !password) {
            if (errorMessage) {
                errorMessage.textContent = 'Email and password are required.';
                errorMessage.classList.add('visible'); // Show it
            }
            return;
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (errorMessage) {
                errorMessage.textContent = 'Please enter a valid email address.';
                errorMessage.classList.add('visible'); // Show it
            }
            return;
        }

        // Password length validation (matches minlength on input)
        if (password.length < 6) {
            if (errorMessage) {
                errorMessage.textContent = 'Password must be at least 6 characters long.';
                errorMessage.classList.add('visible'); // Show it
            }
            return;
        }

        try {
            const data = await apiRequest('POST', '/login', { email, password });
            localStorage.setItem('authToken', data.token);
            if (data.role === 'super_admin' || data.role === 'location_admin') {
                window.location.href = 'suite-hub.html';
            } else {
                window.location.href = 'new-hire-view.html';
            }
        } catch (error) {
            if (errorMessage) {
                errorMessage.textContent = `Login Failed: ${error.message}`;
                errorMessage.classList.add('visible'); // Show it
            }
            console.error("Login API error:", error); // Log the actual error
        }
    });
}

/**
 * Handles the logic for the registration page.
 * Manages form submission for new company and super admin registration.
 */
function handleRegisterPage() {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) {
        console.error("Register form not found on this page.");
        return;
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const companyNameInput = document.getElementById('company-name');
        const fullNameInput = document.getElementById('full-name');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const errorMessage = document.getElementById('error-message');

        const company_name = companyNameInput.value;
        const full_name = fullNameInput.value;
        const email = emailInput.value;
        const password = passwordInput.value;

        // Clear previous error messages
        if (errorMessage) {
            errorMessage.textContent = '';
            errorMessage.classList.remove('visible');
        }

        // Client-side validation
        if (!company_name || !full_name || !email || !password) {
            if (errorMessage) {
                errorMessage.textContent = 'All fields are required.';
                errorMessage.classList.add('visible');
            }
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (errorMessage) {
                errorMessage.textContent = 'Please enter a valid email address.';
                errorMessage.classList.add('visible');
            }
            return;
        }

        if (password.length < 6) {
            if (errorMessage) {
                errorMessage.textContent = 'Password must be at least 6 characters long.';
                errorMessage.classList.add('visible');
            }
            return;
        }

        try {
            // Send registration data to the backend
            const data = await apiRequest('POST', '/register', { company_name, full_name, email, password });
            
            // Assuming successful registration logs the user in automatically or provides a token
            // For now, let's just show a success message and redirect to login
            showModalMessage('Registration successful! Please log in with your new account.', false);
            // After a short delay, redirect to login page
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000); // 2 second delay
            
        } catch (error) {
            if (errorMessage) {
                errorMessage.textContent = `Registration failed: ${error.message}`;
                errorMessage.classList.add('visible');
            }
            console.error("Registration API error:", error);
        }
    });
}

/**
 * Handles the logic for the suite-hub page.
 * Redirects to login if no auth token is found.
 * Also handles post-payment feedback from Stripe.
 */
function handleSuiteHubPage() {
    // Redirect to login if no authentication token is present
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }

    // Check for payment success/cancel parameters after Stripe redirect
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    if (paymentStatus === 'success') {
        showModalMessage('Payment successful! Your subscription has been updated.', false);
        // You might want to remove these query parameters from the URL
        history.replaceState({}, document.title, window.location.pathname);
        // Optionally, make an API call to verify session and update user status if not already done by webhook
        // For now, we assume webhook handles DB update, so just show message.
    } else if (paymentStatus === 'cancelled') {
        showModalMessage('Payment cancelled. You can try again or choose another plan.', true);
        history.replaceState({}, document.title, window.location.pathname);
    }
}

/**
 * Handles the logic for the account page.
 * Loads profile information and handles profile updates including password changes.
 */
function handleAccountPage() {
    // Redirect to login if no authentication token is present
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }

    const displayProfileName = document.getElementById('display-profile-name');
    const displayProfileEmail = document.getElementById('display-profile-email');
    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const updateProfileForm = document.getElementById('update-profile-form');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');

    /**
     * Fetches and displays the current user's profile information.
     */
    async function loadProfileInfo() {
        try {
            const profile = await apiRequest('GET', '/profile');
            if (displayProfileName) displayProfileName.textContent = profile.fullName || 'N/A';
            if (displayProfileEmail) displayProfileEmail.textContent = profile.email || 'N/A';
            if (profileNameInput) profileNameInput.value = profile.fullName || '';
            if (profileEmailInput) profileEmailInput.value = profile.email || '';
        } catch (error) {
            console.error("Error loading profile info:", error);
            showModalMessage(`Failed to load profile: ${error.message}`, true);
        }
    }

    /**
     * Handles the submission of the profile update form.
     * Updates name, email, and/or password.
     */
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = profileNameInput ? profileNameInput.value : '';
            const email = profileEmailInput ? profileEmailInput.value : '';
            const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';
            const newPassword = newPasswordInput ? newPasswordInput.value : '';

            const updatePayload = { fullName, email };
            if (currentPassword && newPassword) {
                updatePayload.currentPassword = currentPassword;
                updatePayload.newPassword = newPassword;
            }

            try {
                // Send the update request
                const result = await apiRequest('PUT', '/profile', updatePayload);
                
                // If a new token is returned, update it in localStorage
                if (result && result.token) {
                    localStorage.setItem('authToken', result.token);
                }

                showModalMessage(result.message || 'Profile updated successfully!', false);
                
                // Clear password fields after successful update for security
                if (currentPasswordInput) currentPasswordInput.value = '';
                if (newPasswordInput) newPasswordInput.value = '';
                
                // Reload profile info to reflect changes immediately
                loadProfileInfo(); 
            } catch (error) {
                console.error("Error updating profile:", error);
                showModalMessage(`Failed to update profile: ${error.message}`, true);
            }
        });
    }

    loadProfileInfo(); // Load profile info when the account page is accessed
}

/**
 * Handles the logic for the admin page.
 * Manages location creation and user invitations.
 */
function handleAdminPage() {
    // Redirect to login if no authentication token is present
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }

    const locationListDiv = document.getElementById('location-list');
    const userListDiv = document.getElementById('user-list'); // Get the user list div
    const newLocationForm = document.getElementById('new-location-form');
    const inviteAdminForm = document.getElementById('invite-admin-form');
    const adminLocationSelect = document.getElementById('admin-location-select');
    const inviteEmployeeForm = document.getElementById('invite-employee-form'); // New employee form
    const employeeLocationSelect = document.getElementById('employee-location-select'); // New employee location dropdown

    /**
     * Loads and displays the list of company locations.
     */
    async function loadLocations() {
        if (!locationListDiv) return;
        locationListDiv.innerHTML = '<p>Loading locations...</p>';
        try {
            const locations = await apiRequest('GET', '/locations');
            locationListDiv.innerHTML = ''; // Clear loading message
            if (locations.length === 0) {
                locationListDiv.innerHTML = '<p style="color: var(--text-medium);">No locations created yet.</p>';
                if(adminLocationSelect) { // Defensive check
                    adminLocationSelect.innerHTML = '<option value="">No locations available</option>';
                    adminLocationSelect.disabled = true;
                }
                if(employeeLocationSelect) { // Defensive check for new employee form
                    employeeLocationSelect.innerHTML = '<option value="">No locations available</option>';
                    employeeLocationSelect.disabled = true;
                }
            } else {
                if(adminLocationSelect) adminLocationSelect.disabled = false; // Defensive check
                if(employeeLocationSelect) employeeLocationSelect.disabled = false; // Defensive check for new employee form

                // Populate admin location select dropdown
                if(adminLocationSelect) {
                    adminLocationSelect.innerHTML = '<option value="">Select a location</option>'; // Default option
                    locations.forEach(loc => {
                        const option = document.createElement('option');
                        option.value = loc.location_id;
                        option.textContent = loc.location_name;
                        adminLocationSelect.appendChild(option);
                    });
                }
                 // Populate employee location select dropdown
                if(employeeLocationSelect) {
                    employeeLocationSelect.innerHTML = '<option value="">Select a location</option>'; // Default option
                    locations.forEach(loc => {
                        const option = document.createElement('option');
                        option.value = loc.location_id;
                        option.textContent = loc.location_name;
                        employeeLocationSelect.appendChild(option);
                    });
                }

                locations.forEach(loc => {
                    const locDiv = document.createElement('div');
                    locDiv.className = 'list-item';
                    locDiv.innerHTML = `<span>${loc.location_name} - ${loc.location_address}</span>
                                        <button class="btn-delete" data-type="location" data-id="${loc.location_id}">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                                        </button>`;
                    locDiv.addEventListener('click', (e) => {
                        // Prevent click on parent from triggering if button is clicked
                        if (!e.target.closest('.btn-delete')) {
                            showModalMessage(`Location: ${loc.location_name} (ID: ${loc.location_id}) - Address: ${loc.location_address}`, false);
                        }
                    });
                    locationListDiv.appendChild(locDiv);
                });
            }
        } catch (error) {
            console.error("Error loading locations:", error);
            showModalMessage(`Failed to load locations: ${error.message}`, true);
        }
    }

    /**
     * Loads and displays the list of users (admins and potentially employees).
     */
    async function loadUsers() {
        if (!userListDiv) return;
        userListDiv.innerHTML = '<p>Loading users...</p>';
        try {
            const users = await apiRequest('GET', '/users');
            userListDiv.innerHTML = ''; 
            if (users.length === 0) {
                userListDiv.innerHTML = '<p style="color: var(--text-medium);">No users invited yet.</p>';
            } else {
                users.forEach(user => {
                    const userDiv = document.createElement('div');
                    userDiv.className = 'list-item';
                    let userInfo = `${user.full_name} - Role: ${user.role}`;
                    if (user.location_name) {
                        userInfo += ` @ ${user.location_name}`;
                    }
                    userDiv.innerHTML = `<span>${userInfo}</span>
                                         <button class="btn-delete" data-type="user" data-id="${user.user_id}">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                                        </button>`;
                    userListDiv.appendChild(userDiv);
                });
            }
        } catch (error) {
            console.error("Error loading users:", error);
            userListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading users: ${error.message}</p>`;
        }
    }

    // Consolidated event listener for delete buttons (for both locations and users)
    // This uses event delegation on a common parent (e.g., locationListDiv or userListDiv's parent)
    // For simplicity, attaching to document body, but ideally should be on a more specific common parent
    document.body.addEventListener('click', async (e) => {
        const targetButton = e.target.closest('.btn-delete');
        if (targetButton) {
            const id = targetButton.dataset.id;
            const type = targetButton.dataset.type; // 'location' or 'user'
            const confirmationMessage = `Are you sure you want to delete this ${type}?`;
            
            const confirmed = await showConfirmModal(confirmationMessage, 'Delete');

            if (confirmed) {
                try {
                    if (type === 'location') {
                        await apiRequest('DELETE', `/locations/${id}`);
                        showModalMessage('Location deleted successfully!', false);
                        loadLocations(); 
                        loadUsers(); 
                    } else if (type === 'user') {
                        await apiRequest('DELETE', `/users/${id}`);
                        showModalMessage('User deleted successfully!', false);
                        loadUsers(); 
                    }
                } catch (error) {
                    showModalMessage(`Error deleting ${type}: ${error.message}`, true);
                }
            }
        });
    });

    // Handle new location form submission
    if (newLocationForm) {
        newLocationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-location-name');
            const addressInput = document.getElementById('new-location-address');
            const location_name = nameInput.value;
            const location_address = addressInput.value;

            try {
                await apiRequest('POST', '/locations', { location_name, location_address });
                nameInput.value = '';
                addressInput.value = '';
                showModalMessage('Location created successfully!', false);
                loadLocations(); 
            } catch (error) {
                console.error("Error creating location:", error);
                showModalMessage(`Error creating location: ${error.message}`, true);
            }
        });
    }

    // Handle invite admin form submission
    if (inviteAdminForm) {
        inviteAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminName = document.getElementById('admin-name') ? document.getElementById('admin-name').value : '';
            const adminEmail = document.getElementById('admin-email') ? document.getElementById('admin-email').value : '';
            const adminPassword = document.getElementById('admin-password') ? document.getElementById('admin-password').value : '';
            const adminLocationSelectElement = document.getElementById('admin-location-select'); 
            const adminLocationId = adminLocationSelectElement ? adminLocationSelectElement.value : ''; 

            if (!adminLocationId) {
                showModalMessage('Please select a location to assign the admin.', true);
                return;
            }
            if (!adminPassword) {
                showModalMessage('Please enter a temporary password for the new admin.', true);
                return;
            }

            try {
                await apiRequest('POST', '/invite-admin', {
                    full_name: adminName,
                    email: adminEmail,
                    location_id: adminLocationId,
                    password: adminPassword
                });
                
                if (document.getElementById('admin-name')) document.getElementById('admin-name').value = '';
                if (document.getElementById('admin-email')) document.getElementById('admin-email').value = '';
                if (document.getElementById('admin-password')) document.getElementById('admin-password').value = '';
                if (adminLocationSelectElement) adminLocationSelectElement.value = '';

                showModalMessage(`Admin invite sent to ${adminEmail} for selected location with the provided temporary password.`, false);
                loadUsers(); 
            } catch (error) { 
                console.error("Error inviting admin:", error);
                showModalMessage(`Failed to invite admin: ${error.message}`, true);
            }
        });
    }

    // Handle invite employee form submission
    if (inviteEmployeeForm) {
        inviteEmployeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const employeeName = document.getElementById('employee-name') ? document.getElementById('employee-name').value : '';
            const employeeEmail = document.getElementById('employee-email') ? document.getElementById('employee-email').value : '';
            const employeePassword = document.getElementById('employee-password') ? document.getElementById('employee-password').value : '';
            const employeePosition = document.getElementById('employee-position') ? document.getElementById('employee-position').value : '';
            const employeeId = document.getElementById('employee-id') ? document.getElementById('employee-id').value : '';
            const employeeLocationSelectElement = document.getElementById('employee-location-select');
            
            let employeeLocationId = null; 
            if (employeeLocationSelectElement && employeeLocationSelectElement.value !== "") {
                employeeLocationId = parseInt(employeeLocationSelectElement.value);
            }

            const hasLocationsInDropdown = employeeLocationSelectElement && employeeLocationSelectElement.options.length > 1; 
            if (!employeeName || !employeeEmail || !employeePassword || (hasLocationsInDropdown && employeeLocationId === null)) { 
                showModalMessage('Full name, email, temporary password, and a valid location (if available) are required for new employees.', true);
                return;
            }

            try {
                await apiRequest('POST', '/invite-employee', { 
                    full_name: employeeName,
                    email: employeeEmail,
                    password: employeePassword,
                    position: employeePosition,
                    employee_id: employeeId,
                    location_id: employeeLocationId 
                });

                if (document.getElementById('employee-name')) document.getElementById('employee-name').value = '';
                if (document.getElementById('employee-email')) document.getElementById('employee-email').value = '';
                if (document.getElementById('employee-password')) document.getElementById('employee-password').value = '';
                if (document.getElementById('employee-position')) document.getElementById('employee-position').value = '';
                if (document.getElementById('employee-id')) document.getElementById('employee-id').value = '';
                if (employeeLocationSelectElement) employeeLocationSelectElement.value = '';

                showModalMessage(`Employee invite sent to ${employeeEmail} for selected location.`, false);
                loadUsers(); 
            } catch (error) {
                console.error("Error inviting employee:", error);
                showModalMessage(`Failed to invite employee: ${error.message}`, true);
            }
        });
    }

    // Initial load for admin page
    loadLocations(); 
    loadUsers(); 
}

/**
 * Handles logic for the pricing page.
 * Sets up event listeners for plan selection and Stripe checkout.
 */
function handlePricingPage() {
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }

    const freePlanBtn = document.getElementById('free-plan-btn');
    const proPlanBtn = document.getElementById('pro-plan-btn');
    const enterprisePlanBtn = document.getElementById('enterprise-plan-btn');

    const stripe = Stripe('pk_test_51Ra4RJG06NHrwsY922jS3wPjF0020WbJ3PjF0020WbJ3PjF0020WbJ3f0L3hW9yTjY00l8Z7zrHY'); 

    async function selectPlan(planId) {
        try {
            const response = await apiRequest('POST', '/create-checkout-session', { planId: planId });
            const { url } = response;
            window.location.href = url;

        } catch (error) {
            console.error('Error selecting plan:', error);
            showModalMessage(`Failed to initiate checkout: ${error.message}`, true);
        }
    }

    if (proPlanBtn) {
        proPlanBtn.addEventListener('click', () => selectPlan('pro'));
    }
    if (enterprisePlanBtn) {
        enterprisePlanBtn.addEventListener('click', () => selectPlan('enterprise'));
    }

    if (freePlanBtn) {
        freePlanBtn.addEventListener('click', () => {
            showModalMessage('You are currently on the Free plan. To upgrade, choose Pro or Enterprise.', false);
        });
    }
}

/**
 * Handles logic for the scheduling page.
 * Fetches and displays schedules, handles filter and create shift forms.
 */
function handleSchedulingPage() {
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }

    const calendarGrid = document.getElementById('calendar-grid');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const employeeSelect = document.getElementById('employee-select');
    const locationSelect = document.getElementById('location-select');
    const createShiftForm = document.getElementById('create-shift-form');

    const filterEmployeeSelect = document.getElementById('filter-employee-select');
    const filterLocationSelect = document.getElementById('filter-location-select');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    let currentWeekStart = new Date(); 

    function initializeWeek() {
        const today = new Date();
        const dayOfWeek = today.getDay(); 
        currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - dayOfWeek); 
        currentWeekStart.setHours(0, 0, 0, 0); 
    }

    async function populateDropdowns() {
        try {
            const employees = await apiRequest('GET', '/users?filterRole=employee'); 
            const locations = await apiRequest('GET', '/locations');

            if (employeeSelect) {
                employeeSelect.innerHTML = '<option value="">Select Employee</option>';
                employees.forEach(emp => {
                    const option = document.createElement('option');
                    option.value = emp.user_id;
                    option.textContent = emp.full_name;
                    employeeSelect.appendChild(option);
                });
            }
            if (filterEmployeeSelect) {
                filterEmployeeSelect.innerHTML = '<option value="">All Employees</option>';
                employees.forEach(emp => {
                    const option = document.createElement('option');
                    option.value = emp.user_id;
                    option.textContent = emp.full_name;
                    filterEmployeeSelect.appendChild(option);
                });
            }

            if (locationSelect) {
                locationSelect.innerHTML = '<option value="">Select Location</option>';
                locations.forEach(loc => {
                    const option = document.createElement('option');
                    option.value = loc.location_id;
                    option.textContent = loc.location_name;
                    locationSelect.appendChild(option);
                });
            }
            if (filterLocationSelect) {
                filterLocationSelect.innerHTML = '<option value="">All Locations</option>';
                locations.forEach(loc => {
                    const option = document.createElement('option');
                    option.value = loc.location_id;
                    option.textContent = loc.location_name;
                    filterLocationSelect.appendChild(option);
                });
            }

        } catch (error) {
            console.error("Error populating dropdowns:", error);
            showModalMessage(`Failed to load employees or locations: ${error.message}`, true);
        }
    }

    async function renderCalendar(schedules = []) {
        if (!calendarGrid) return;

        calendarGrid.querySelectorAll('.calendar-day-header:not(:first-child), .calendar-day-cell').forEach(el => el.remove());

        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentWeekEndDate = new Date(currentWeekStart);
        currentWeekEndDate.setDate(currentWeekEndDate.getDate() + 6); 

        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${currentWeekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);

            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = `${daysOfWeek[date.getDay()]} (${date.getMonth() + 1}/${date.getDate()})`;
            dayHeader.style.gridColumn = i + 2; 
            dayHeader.style.gridRow = 1;
            calendarGrid.appendChild(dayHeader);

            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day-cell';
            dayCell.dataset.date = date.toISOString().split('T')[0]; 
            dayCell.style.gridColumn = i + 2;
            dayCell.style.gridRow = '2 / span 24'; 
            calendarGrid.appendChild(dayCell);
            dayCells[date.toISOString().split('T')[0]] = dayCell; 
        }

        const timeColumn = document.getElementById('time-column');
        if (timeColumn && timeColumn.children.length === 0) { 
            for (let i = 0; i < 24; i++) {
                const timeSlot = document.createElement('div');
                timeSlot.className = 'calendar-time-slot';
                const hour = i < 10 ? `0${i}` : `${i}`;
                timeSlot.textContent = `${hour}:00`;
                timeColumn.appendChild(timeSlot);
            }
        }

        schedules.forEach(shift => {
            const shiftStartTime = new Date(shift.start_time);
            const shiftEndTime = new Date(shift.end_time);
            const shiftDate = shiftStartTime.toISOString().split('T')[0]; 

            const targetCell = dayCells[shiftDate];
            if (targetCell) {
                const shiftDiv = document.createElement('div');
                shiftDiv.className = 'calendar-shift';
                
                const startHour = shiftStartTime.getHours() + shiftStartTime.getMinutes() / 60;
                const endHour = shiftEndTime.getHours() + shiftEndTime.getMinutes() / 60;
                const durationHours = endHour - startHour;

                const topOffset = (startHour * 30); 
                const height = (durationHours * 30);

                shiftDiv.style.top = `${topOffset}px`;
                shiftDiv.style.height = `${height}px`;

                shiftDiv.innerHTML = `<strong>${shift.employee_name}</strong><br>${shiftStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${shiftEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                if (shift.notes) {
                    shiftDiv.title = shift.notes; 
                }

                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn-delete';
                deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`;
                deleteButton.onclick = async (e) => {
                    e.stopPropagation(); 
                    const confirmDelete = await showConfirmModal(`Are you sure you want to delete this shift for ${shift.employee_name}?`, 'Delete Shift');
                    if (confirmDelete) {
                        try {
                            await apiRequest('DELETE', `/schedules/${shift.schedule_id}`);
                            showModalMessage('Shift deleted successfully!', false);
                            loadSchedules(); 
                        } catch (error) {
                            showModalMessage(`Failed to delete shift: ${error.message}`, true);
                        }
                    }
                };
                shiftDiv.appendChild(deleteButton);


                targetCell.appendChild(shiftDiv);
            }
        });
    }

    async function loadSchedules() {
        const employeeId = filterEmployeeSelect ? filterEmployeeSelect.value : '';
        const locationId = filterLocationSelect ? filterLocationSelect.value : '';
        const startDate = filterStartDate ? filterStartDate.value : '';
        const endDate = filterEndDate ? filterEndDate.value : '';

        const apiStartDate = currentWeekStart.toISOString().split('T')[0];
        const apiEndDate = new Date(currentWeekStart);
        apiEndDate.setDate(currentWeekStart.getDate() + 6); 
        const apiEndDateString = apiEndDate.toISOString().split('T')[0];

        const queryParams = new URLSearchParams({
            start_date: apiStartDate,
            end_date: apiEndDateString
        });
        if (employeeId) queryParams.append('employee_id', employeeId);
        if (locationId) queryParams.append('location_id', locationId);
        if (startDate && endDate) {
            queryParams.set('start_date', startDate);
            queryParams.set('end_date', endDate);
        }

        try {
            const schedules = await apiRequest('GET', `/schedules?${queryParams.toString()}`);
            renderCalendar(schedules);
        } catch (error) {
            console.error("Error loading schedules:", error);
            showModalMessage(`Failed to load schedules: ${error.message}`, true);
            renderCalendar([]); 
        }
    }

    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            loadSchedules();
        });
    }
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            loadSchedules();
        });
    }

    if (createShiftForm) {
        createShiftForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const employeeId = document.getElementById('employee-select').value;
            const locationId = document.getElementById('location-select').value;
            const startTime = document.getElementById('start-time-input').value;
            const endTime = document.getElementById('end-time-input').value;
            const notes = document.getElementById('notes-input').value;

            try {
                await apiRequest('POST', '/schedules', {
                    employee_id: employeeId,
                    location_id: locationId,
                    start_time: startTime,
                    end_time: endTime,
                    notes: notes
                });
                showModalMessage('Shift created successfully!', false);
                createShiftForm.reset(); 
                loadSchedules(); 
            } catch (error) {
                console.error("Error creating shift:", error);
                showModalMessage(`Failed to create shift: ${error.message}`, true);
            }
        });
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', loadSchedules);
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (filterEmployeeSelect) filterEmployeeSelect.value = '';
            if (filterLocationSelect) filterLocationSelect.value = '';
            if (filterStartDate) filterStartDate.value = '';
            if (filterEndDate) filterEndDate.value = '';
            initializeWeek(); 
            loadSchedules();
        });
    }

    initializeWeek(); 
    populateDropdowns(); 
    loadSchedules(); 
}

/**
 * Handles logic for the hiring page.
 * Manages job posting creation, listing, and applicant tracking.
 */
function handleHiringPage() {
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }

    const createJobPostingForm = document.getElementById('create-job-posting-form');
    const jobPostingList = document.getElementById('job-posting-list');
    const jobPostingLocationSelect = document.getElementById('job-posting-location-select'); 
    
    const applicantList = document.getElementById('applicant-list');
    const filterApplicantJobPostingSelect = document.getElementById('filter-applicant-job-posting-select');
    const filterApplicantStatus = document.getElementById('filter-applicant-status');
    const filterApplicantLocationSelect = document.getElementById('filter-applicant-location-select');
    const applyApplicantFiltersBtn = document.getElementById('apply-applicant-filters-btn');
    const clearApplicantFiltersBtn = document.getElementById('clear-applicant-filters-btn');

    const shareLinkModalOverlay = document.getElementById('share-link-modal-overlay');
    const shareJobLinkInput = document.getElementById('share-job-link-input');
    const shareJobEmbedCodeInput = document.getElementById('share-job-embed-code-input');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const copyEmbedBtn = document.getElementById('copy-embed-btn');
    const shareLinkModalCloseButton = document.getElementById('share-link-modal-close-button');


    async function populateLocationDropdowns() {
        try {
            const locations = await apiRequest('GET', '/locations');
            const defaultOption = '<option value="">Company Wide (All Locations)</option>';
            
            if (jobPostingLocationSelect) {
                jobPostingLocationSelect.innerHTML = defaultOption;
                locations.forEach(loc => {
                    const option = document.createElement('option');
                    option.value = loc.location_id;
                    option.textContent = loc.location_name;
                    jobPostingLocationSelect.appendChild(option);
                });
            }
            if (filterApplicantLocationSelect) {
                filterApplicantLocationSelect.innerHTML = defaultOption;
                locations.forEach(loc => {
                    const option = document.createElement('option');
                    option.value = loc.location_id;
                    option.textContent = loc.location_name;
                    filterApplicantLocationSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error populating location dropdowns:", error);
            showModalMessage(`Failed to load locations: ${error.message}`, true);
        }
    }

    async function populateJobPostingDropdown() {
        try {
            const jobPostings = await apiRequest('GET', '/job-postings');
            const defaultOption = '<option value="">All Job Postings</option>';
            if (filterApplicantJobPostingSelect) {
                filterApplicantJobPostingSelect.innerHTML = defaultOption;
                jobPostings.forEach(job => {
                    const option = document.createElement('option');
                    option.value = job.job_posting_id;
                    option.textContent = job.title;
                    filterApplicantJobPostingSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error populating job posting dropdown:", error);
            showModalMessage(`Failed to load job postings for filter: ${error.message}`, true);
        }
    }


    async function loadJobPostings() {
        if (!jobPostingList) return;
        jobPostingList.innerHTML = '<p style="color: var(--text-medium);">Loading job postings...</p>';
        try {
            const postings = await apiRequest('GET', '/job-postings');
            jobPostingList.innerHTML = '';
            if (postings.length === 0) {
                jobPostingList.innerHTML = '<p style="color: var(--text-medium);">No job postings found.</p>';
            } else {
                postings.forEach(posting => {
                    const jobCard = document.createElement('div');
                    jobCard.className = 'job-posting-item';
                    jobCard.innerHTML = `
                        <h4>${posting.title}</h4>
                        <p><strong>Description:</strong> ${posting.description.substring(0, 100)}...</p>
                        ${posting.requirements ? `<p><strong>Requirements:</strong> ${posting.requirements.substring(0, 100)}...</p>` : ''}
                        <p><strong>Status:</strong> ${posting.status}</p>
                        <p><strong>Posted:</strong> ${new Date(posting.created_date).toLocaleDateString()}</p>
                        <div class="actions">
                            <button class="btn btn-secondary btn-sm edit-job-btn" data-id="${posting.job_posting_id}">Edit</button>
                            <button class="btn share-btn" data-id="${posting.job_posting_id}" data-title="${posting.title}">Share Link</button>
                            <button class="btn-delete" data-type="job-posting" data-id="${posting.job_posting_id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    jobPostingList.appendChild(jobCard);
                });
                attachJobPostingListeners(); 
            }
        } catch (error) {
            console.error("Error loading job postings:", error);
            showModalMessage(`Failed to load job postings: ${error.message}`, true);
        }
    }

    function attachJobPostingListeners() {
        jobPostingList.querySelectorAll('.btn-delete[data-type="job-posting"]').forEach(button => { 
            button.onclick = async (e) => {
                e.stopPropagation(); 
                const id = button.dataset.id;
                const confirmDelete = await showConfirmModal('Are you sure you want to delete this job posting? This will also remove associated applicants.', 'Delete Job Posting');
                if (confirmDelete) {
                    try {
                        await apiRequest('DELETE', `/job-postings/${id}`);
                        showModalMessage('Job posting deleted successfully!', false);
                        loadJobPostings(); 
                        populateJobPostingDropdown(); 
                        loadApplicants(); 
                    }
                    catch (error) {
                        showModalMessage(`Failed to delete job posting: ${error.message}`, true);
                    }
                }
            };
        });

        jobPostingList.querySelectorAll('.share-btn').forEach(button => {
            button.onclick = (e) => {
                e.stopPropagation(); 
                const id = button.dataset.id;
                const title = button.dataset.title;
                const directLink = `http://localhost:8000/apply.html?job_id=${id}`;
                const embedCode = `<iframe src="http://localhost:8000/embed-job-apply.html?job_id=${id}" width="600" height="400" frameborder="0"></iframe>`;
                
                if (shareJobLinkInput) shareJobLinkInput.value = directLink;
                if (shareJobEmbedCodeInput) shareJobEmbedCodeInput.value = embedCode;
                if (shareLinkModalOverlay) shareLinkModalOverlay.style.display = 'flex';
            };
        });

        if (shareLinkModalCloseButton) {
            shareLinkModalCloseButton.onclick = () => {
                if (shareLinkModalOverlay) shareLinkModalOverlay.style.display = 'none';
            };
        }
        if (copyLinkBtn) {
            copyLinkBtn.onclick = () => {
                if (shareJobLinkInput) {
                    shareJobLinkInput.select();
                    document.execCommand('copy');
                    showModalMessage('Direct link copied to clipboard!', false);
                }
            };
        }
        if (copyEmbedBtn) {
            copyEmbedBtn.onclick = () => {
                if (shareJobEmbedCodeInput) {
                    shareJobEmbedCodeInput.select();
                    document.execCommand('copy');
                    showModalMessage('Embed code copied to clipboard!', false);
                }
            };
        });

        jobPostingList.querySelectorAll('.edit-job-btn').forEach(button => {
            button.onclick = (e) => {
                e.stopPropagation();
                const id = button.dataset.id;
                showModalMessage(`Edit functionality for Job Posting ID: ${id} is coming soon!`, false);
            };
        });
    }

    async function loadApplicants() {
        if (!applicantList) return;
        applicantList.innerHTML = '<p style="color: var(--text-medium);">Loading applicants...</p>';
        
        const params = new URLSearchParams();
        if (filterApplicantJobPostingSelect && filterApplicantJobPostingSelect.value) {
            params.append('job_posting_id', filterApplicantJobPostingSelect.value);
        }
        if (filterApplicantStatus && filterApplicantStatus.value) {
            params.append('status', filterApplicantStatus.value);
        }
        if (filterApplicantLocationSelect && filterApplicantLocationSelect.value) {
            params.append('location_id', filterApplicantLocationSelect.value);
        }

        try {
            const applicants = await apiRequest('GET', `/applicants?${params.toString()}`);
            applicantList.innerHTML = ''; 
            if (applicants.length === 0) {
                applicantList.innerHTML = '<p style="color: var(--text-medium);">No applicants found matching criteria.</p>';
            } else {
                applicants.forEach(applicant => {
                    const applicantCard = document.createElement('div');
                    applicantCard.className = 'applicant-item';
                    applicantCard.innerHTML = `
                        <h4>${applicant.full_name}</h4>
                        <p><strong>Email:</strong> ${applicant.email}</p>
                        <p><strong>Phone:</strong> ${applicant.phone_number || 'N/A'}</p>
                        <p><strong>Job Applied:</strong> ${applicant.job_title_name || 'N/A'}</p>
                        <p><strong>Status:</strong> ${applicant.status}</p>
                        <p><strong>Applied:</strong> ${new Date(applicant.application_date).toLocaleDateString()}</p>
                        <div class="actions">
                            <button class="btn btn-secondary btn-sm edit-applicant-btn" data-id="${applicant.applicant_id}">Edit Status</button>
                            ${applicant.resume_url ? `<a href="${applicant.resume_url}" target="_blank" class="btn btn-secondary btn-sm">View Resume</a>` : ''}
                            <button class="btn-delete" data-type="applicant" data-id="${applicant.applicant_id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    applicantList.appendChild(applicantCard);
                });
                attachApplicantListeners(); 
            }
        } catch (error) {
            console.error("Error loading applicants:", error);
            showModalMessage(`Failed to load applicants: ${error.message}`, true);
        }
    }

    function attachApplicantListeners() {
        applicantList.querySelectorAll('.btn-delete[data-type="applicant"]').forEach(button => { 
            button.onclick = async (e) => {
                e.stopPropagation();
                const id = button.dataset.id;
                const confirmDelete = await showConfirmModal('Are you sure you want to delete this document?', 'Delete Document');
                if (confirmDelete) {
                    try {
                        await apiRequest('DELETE', `/documents/${id}`);
                        showModalMessage('Document deleted successfully!', false);
                        loadDocuments(); 
                    } catch (error) {
                        showModalMessage(`Failed to delete document: ${error.message}`, true);
                    }
                }
            };
        });
    }

    if (uploadDocumentForm) {
        uploadDocumentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('document-title').value;
            const fileInput = document.getElementById('document-file');
            const description = document.getElementById('document-description').value;
            const file = fileInput.files[0];

            if (!file) {
                showModalMessage('Please select a file to upload.', true);
                return;
            }

            const mockFileUploadResponse = {
                file_url: `https://placehold.co/300x200/C86DD7/ffffff?text=${encodeURIComponent(file.name)}`, 
                file_type: file.type || 'application/octet-stream'
            };
            
            if (!isImageFile(file.type)) {
                mockFileUploadResponse.file_url = `https://example.com/uploads/${Date.now()}-${file.name}`; 
            }

            try {
                await apiRequest('POST', '/documents', {
                    title: title,
                    file_name: file.name,
                    file_type: mockFileUploadResponse.file_type,
                    file_url: mockFileUploadResponse.file_url,
                    description: description
                });

                showModalMessage('Document uploaded and saved successfully!', false);
                uploadDocumentForm.reset(); 
                loadDocuments(); 
            } catch (error) {
                console.error("Error uploading document:", error);
                showModalMessage(`Failed to upload document: ${error.message}`, true);
            }
        });
    }

    loadDocuments(); 
}
