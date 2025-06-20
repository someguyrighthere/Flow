const API_BASE_URL = 'https://flow-gz1r.onrender.com/api';

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
                modalOverlay.style.display = 'none';
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
            if (event.target === confirmModalOverlay) {
                handleCancel(); // Treat outside click as cancel
            }
        };
    });
}


document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname;
    if (page.includes('login.html')) {
        handleLoginPage();
    } else if (page.includes('suite-hub.html')) {
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
    } else if (page.includes('sales-analytics.html')) { // Handle Sales & Analytics page
        handleSalesAnalyticsPage();
    }
    setupSettingsDropdown(); // This is called on every page that includes app.js
});

/**
 * Handles the logic for the login page.
 * Manages form submission and redirects on successful login.
 */
function handleLoginPage() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
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
            } else {
                if(adminLocationSelect) adminLocationSelect.disabled = false; // Defensive check
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

                // Populate admin location select dropdown
                if(adminLocationSelect) { // Defensive check
                    adminLocationSelect.innerHTML = '<option value="">Select a location</option>'; // Default option
                    locations.forEach(loc => {
                        const option = document.createElement('option');
                        option.value = loc.location_id;
                        option.textContent = loc.location_name;
                        adminLocationSelect.appendChild(option);
                    });
                }
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
            // Fetch users. Assuming '/users' endpoint returns users for the current company.
            // You might want to filter by role if you only want to show non-super-admins
            const users = await apiRequest('GET', '/users');
            userListDiv.innerHTML = ''; // Clear loading message

            if (users.length === 0) {
                userListDiv.innerHTML = '<p style="color: var(--text-medium);">No users invited yet.</p>';
            } else {
                users.forEach(user => {
                    const userDiv = document.createElement('div');
                    userDiv.className = 'list-item';
                    // Display full name, role, and location name (if available), without email
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
            
            // Replaced native confirm() with custom showConfirmModal
            const confirmed = await showConfirmModal(confirmationMessage, 'Delete');

            if (confirmed) {
                try {
                    if (type === 'location') {
                        await apiRequest('DELETE', `/locations/${id}`);
                        showModalMessage('Location deleted successfully!', false);
                        loadLocations(); // Reload locations after deletion
                        loadUsers(); // Also reload users as some might be tied to this location
                    } else if (type === 'user') {
                        await apiRequest('DELETE', `/users/${id}`);
                        showModalMessage('User deleted successfully!', false);
                        loadUsers(); // Reload users after deletion
                    }
                } catch (error) {
                    showModalMessage(`Error deleting ${type}: ${error.message}`, true);
                }
            }
        }
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
                loadLocations(); // Reload locations to show new entry and update dropdown
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
            const adminLocationSelectElement = document.getElementById('admin-location-select'); // Get the element
            const adminLocationId = adminLocationSelectElement ? adminLocationSelectElement.value : ''; // Safely get its value

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
                loadUsers(); // Reload users to show the newly invited admin
            } catch (error) { // The catch block was indeed missing
                console.error("Error inviting admin:", error);
                showModalMessage(`Failed to invite admin: ${error.message}`, true);
            }
        });
    }

    // Initial load for admin page
    loadLocations(); // Load locations and populate dropdown
    loadUsers(); // Load and display users
}