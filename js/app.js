// app.js - Client-Side JavaScript for Flow Business Suite
// This file handles all client-side logic, form submissions, and API requests.

// IMPORTANT: Set this to your deployed backend API URL.
// Your frontend is deployed at https://flow-gz1r.onrender.com/
// Assuming your backend API is accessible at the same root with '/api' suffix (as per server.js routes configuration).
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

// Initialize Stripe.js with your public key (replace with your actual publishable key)
// This key should be retrieved from your backend or securely stored in your client-side config.
// IMPORTANT: Replace 'pk_live_YOUR_STRIPE_PUBLISHABLE_KEY' with your actual Stripe Publishable Key
// from your Stripe dashboard (e.g., pk_live_************************).
// This key should NOT be stored as a backend environment variable.
const stripe = Stripe('pk_live_YOUR_STRIPE_PUBLISHABLE_KEY'); 


/**
 * Handles API requests to the backend.
 * Includes authentication token in headers if available.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {string} path - API endpoint path (e.g., '/login', '/profile'). Note: path here
 * should NOT include the '/api' prefix as API_BASE_URL already contains it
 * or handles the base path. Our server.js routes are now defined without '/api' prefix.
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

    // Construct the full API URL. Since server.js routes are now /login, /register etc.,
    // we append the path directly to API_BASE_URL.
    const response = await fetch(`${API_BASE_URL}${path}`, options); // Corrected: Path directly appended

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
 * Ensure your HTML includes elements with ids: 'message-modal-overlay', 'modal-message-text', 'modal-close-button'
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
        modalOverlay.style.zIndex = '1000'; // Ensure it's on top

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
        console.error("Modal elements not found for showModalMessage. Message:", message);
        // Fallback for debugging if modal not available
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

/**
 * Sets up the settings dropdown and logout functionality.
 * Assumes elements with IDs 'settings-button', 'settings-dropdown', and 'logout-button' exist on relevant pages.
 */
function setupSettingsDropdown() {
    console.log('setupSettingsDropdown: Initializing.'); // DEBUG
    const settingsButton = document.getElementById('settings-button');
    const settingsDropdown = document.getElementById('settings-dropdown');
    if (settingsButton && settingsDropdown) {
        console.log('setupSettingsDropdown: Found settings button and dropdown.'); // DEBUG
        settingsButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent document click from closing it immediately
            settingsDropdown.style.display = settingsDropdown.style.display === 'block' ? 'none' : 'block';
            console.log('setupSettingsDropdown: Button clicked, toggling dropdown.'); // DEBUG
        });
        // Close dropdown if clicked outside
        document.addEventListener('click', (event) => {
            if (!settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
                settingsDropdown.style.display = 'none';
                // console.log('setupSettingsDropdown: Clicked outside, closing dropdown.'); // DEBUG (too verbose)
            }
        });
    } else {
        console.log('setupSettingsDropdown: Settings button or dropdown not found on this page.'); // DEBUG
    }

    // Handle the logout button if it's present on the page
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        console.log('setupSettingsDropdown: Found logout button.'); // DEBUG
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('authToken'); // Clear token
            localStorage.removeItem('userRole'); // Clear role
            console.log('setupSettingsDropdown: Logout button clicked, redirecting.'); // DEBUG
            window.location.href = 'login.html'; // Redirect to login page
        });
    } else {
        console.log('setupSettingsDropdown: Logout button not found on this page.'); // DEBUG
    }
}


// --- Page Specific Handlers (DEFINED BEFORE DOMContentLoaded to ensure they are available) ---

/**
 * Handles the logic for the login page.
 * Manages form submission and redirects on successful login.
 */
function handleLoginPage() {
    console.log('handleLoginPage: Initializing.'); // DEBUG
    const loginForm = document.getElementById('login-form');
    if (!loginForm) {
        console.log('handleLoginPage: Login form not found.'); // DEBUG
        return; // Exit if form not found on this page
    }
    console.log('handleLoginPage: Login form found, attaching listener.'); // DEBUG
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default form submission (page reload)
        console.log('handleLoginPage: Form submitted.'); // DEBUG

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const email = emailInput.value.trim(); // Trim whitespace
        const password = passwordInput.value;
        const errorMessage = document.getElementById('error-message');

        // Clear previous error messages and hide
        if (errorMessage) {
            errorMessage.textContent = '';
            errorMessage.classList.remove('visible');
        }

        // Basic Client-Side Validation (should mirror backend validation)
        if (!email || !password) {
            console.log('handleLoginPage: Client-side validation failed: Missing email or password.'); // DEBUG
            if (errorMessage) {
                errorMessage.textContent = 'Email and password are required.';
                errorMessage.classList.add('visible');
            }
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('handleLoginPage: Client-side validation failed: Invalid email format.'); // DEBUG
            if (errorMessage) {
                errorMessage.textContent = 'Please enter a valid email address.';
                errorMessage.classList.add('visible');
            }
            return;
        }

        if (password.length < 6) {
            console.log('handleLoginPage: Client-side validation failed: Password too short.'); // DEBUG
            if (errorMessage) {
                errorMessage.textContent = 'Password must be at least 6 characters long.';
                errorMessage.classList.add('visible');
            }
            return;
        }

        try {
            console.log('handleLoginPage: Making API request to /login...'); // DEBUG
            // Make API request to backend login endpoint
            const data = await apiRequest('POST', '/login', { email, password }); // Note: '/login' as API_BASE_URL handles the root path
            console.log('handleLoginPage: API request successful, data:', data); // DEBUG

            localStorage.setItem('authToken', data.token); // Store JWT
            localStorage.setItem('userRole', data.role); // Store user role

            // Redirect based on user role after successful login
            if (data.role === 'super_admin' || data.role === 'location_admin') {
                console.log('handleLoginPage: Redirecting to suite-hub.html.'); // DEBUG
                window.location.href = 'suite-hub.html';
            } else {
                console.log('handleLoginPage: Redirecting to new-hire-view.html.'); // DEBUG
                window.location.href = 'new-hire-view.html'; // Assuming this is for general employees
            }
        } catch (error) {
            // Handle API errors (e.g., 'Invalid credentials' from backend, or network errors)
            console.error("Login API error:", error); // DEBUG
            if (errorMessage) {
                errorMessage.textContent = `Login Failed: ${error.message}`;
                errorMessage.classList.add('visible');
            }
            // Also show modal for more prominent feedback
            showModalMessage(`Login Failed: ${error.message}`, true);
        }
    });
}

/**
 * Handles the logic for the registration page.
 * Manages form submission and redirects on successful registration.
 */
function handleRegisterPage() {
    console.log('handleRegisterPage: Initializing.'); // DEBUG
    const registerForm = document.getElementById('register-form');
    if (!registerForm) {
        console.log('handleRegisterPage: Register form not found.'); // DEBUG
        return; // Exit if form not found on this page
    }
    console.log('handleRegisterPage: Register form found, attaching listener.'); // DEBUG

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default form submission
        console.log('handleRegisterPage: Form submitted.'); // DEBUG

        const companyNameInput = document.getElementById('company-name');
        const fullNameInput = document.getElementById('full-name');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const errorMessage = document.getElementById('error-message');

        const company_name = companyNameInput.value.trim();
        const full_name = fullNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Clear previous error messages
        errorMessage.textContent = '';
        errorMessage.classList.remove('visible');

        // Basic Client-Side Validation (ensure this matches server-side validation)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!company_name || !full_name || !email || !password || password.length < 6 || !emailRegex.test(email)) {
            console.log('handleRegisterPage: Client-side validation failed.'); // DEBUG
            errorMessage.textContent = 'Please fill all fields correctly. Password must be at least 6 characters and email valid.';
            errorMessage.classList.add('visible');
            return;
        }

        try {
            console.log('handleRegisterPage: Making API request to /register...'); // DEBUG
            // Make API request to backend register endpoint
            const data = await apiRequest('POST', '/register', { company_name, full_name, email, password }); // Note: '/register' as API_BASE_URL handles the root path
            console.log('handleRegisterPage: API request successful, data:', data); // DEBUG

            showModalMessage('Account created successfully! Please log in.', false);
            // Clear form fields on success
            companyNameInput.value = '';
            fullNameInput.value = '';
            emailInput.value = '';
            passwordInput.value = '';

            // Redirect to login page after a short delay
            console.log('handleRegisterPage: Redirecting to login.html.'); // DEBUG
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (error) {
            // Handle API errors (e.g., 'Email already registered' from backend, or network errors)
            console.error("Registration API error:", error); // DEBUG
            if (errorMessage) {
                errorMessage.textContent = `Registration Failed: ${error.message}`;
                errorMessage.classList.add('visible');
            }
            // Also show modal for more prominent feedback
            showModalMessage(`Registration Failed: ${error.message}`, true);
        }
    });
}


/**
 * Handles the logic for the suite-hub page.
 * Redirects to login if no auth token is found.
 * Also handles post-payment feedback from Stripe.
 */
function handleSuiteHubPage() {
    console.log('handleSuiteHubPage: Initializing.'); // DEBUG
    // Redirect to login if no authentication token is present
    if (!localStorage.getItem('authToken')) {
        console.log('handleSuiteHubPage: No auth token found, redirecting to login.'); // DEBUG
        window.location.href = 'login.html';
        return;
    }

    // Check for payment success/cancel parameters after Stripe redirect
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    if (paymentStatus === 'success') {
        console.log('handleSuiteHubPage: Payment success detected.'); // DEBUG
        showModalMessage('Payment successful! Your subscription has been updated.', false);
        // You might want to remove these query parameters from the URL
        history.replaceState({}, document.title, window.location.pathname);
        // Optionally, make an API call to verify session and update user status if not already done by webhook
        // For now, we assume webhook handles DB update, so just show message.
    } else if (paymentStatus === 'cancelled') {
        console.log('handleSuiteHubPage: Payment cancelled detected.'); // DEBUG
        showModalMessage('Payment cancelled. You can try again or choose another plan.', true);
        history.replaceState({}, document.title, window.location.pathname);
    }
}

/**
 * Handles the logic for the account page.
 * Loads profile information and handles profile updates including password changes.
 */
function handleAccountPage() {
    console.log('handleAccountPage: Initializing.'); // DEBUG
    // Redirect to login if no authentication token is present
    if (!localStorage.getItem('authToken')) {
        console.log('handleAccountPage: No auth token found, redirecting to login.'); // DEBUG
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
        console.log('handleAccountPage: Loading profile info...'); // DEBUG
        try {
            const profile = await apiRequest('GET', '/profile');
            console.log('handleAccountPage: Profile info loaded:', profile); // DEBUG
            if (displayProfileName) displayProfileName.textContent = profile.fullName || 'N/A';
            if (displayProfileEmail) displayProfileEmail.textContent = profile.email || 'N/A';
            if (profileNameInput) profileNameInput.value = profile.fullName || '';
            if (profileEmailInput) profileEmailInput.value = profile.email || '';
        }
        catch (error) {
            console.error("Error loading profile info:", error); // DEBUG
            showModalMessage(`Failed to load profile: ${error.message}`, true);
        }
    }

    /**
     * Handles the submission of the profile update form.
     * Updates name, email, and/or password.
     */
    if (updateProfileForm) {
        console.log('handleAccountPage: Profile update form found, attaching listener.'); // DEBUG
        updateProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('handleAccountPage: Profile form submitted.'); // DEBUG

            const fullName = profileNameInput ? profileNameInput.value : '';
            const email = profileEmailInput ? profileEmailInput.value : '';
            const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';
            const newPassword = newPasswordInput ? newPasswordInput.value : '';

            const updatePayload = { fullName, email };
            if (currentPassword && newPassword) {
                updatePayload.currentPassword = currentPassword;
                updatePayload.newPassword = newPassword;
            }
            console.log('handleAccountPage: Update payload:', updatePayload); // DEBUG

            try {
                console.log('handleAccountPage: Making API request to /profile (PUT)...'); // DEBUG
                // Send the update request
                const result = await apiRequest('PUT', '/profile', updatePayload);
                console.log('handleAccountPage: Profile update API successful, result:', result); // DEBUG
                
                // If a new token is returned, update it in localStorage
                if (result && result.token) {
                    localStorage.setItem('authToken', result.token);
                    console.log('handleAccountPage: New auth token received and stored.'); // DEBUG
                }

                showModalMessage(result.message || 'Profile updated successfully!', false);
                
                // Clear password fields after successful update for security
                if (currentPasswordInput) currentPasswordInput.value = '';
                if (newPasswordInput) newPasswordInput.value = '';
                
                // Reload profile info to reflect changes immediately
                loadProfileInfo(); 
            } catch (error) {
                console.error("Error updating profile:", error); // DEBUG
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
    console.log('handleAdminPage: Initializing.'); // DEBUG
    // Redirect to login if no authentication token is present
    if (!localStorage.getItem('authToken')) {
        console.log('handleAdminPage: No auth token found, redirecting to login.'); // DEBUG
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
        console.log('handleAdminPage: Loading locations...'); // DEBUG
        if (!locationListDiv) {
            console.log('handleAdminPage: Location list div not found.'); // DEBUG
            return;
        }
        locationListDiv.innerHTML = '<p>Loading locations...</p>';
        try {
            const locations = await apiRequest('GET', '/locations');
            console.log('handleAdminPage: Locations loaded:', locations); // DEBUG
            locationListDiv.innerHTML = ''; // Clear loading message
            if (locations.length === 0) {
                locationListDiv.innerHTML = '<p style="color: var(--text-medium);">No locations created yet.</p>';
                if(adminLocationSelect) { // Defensive check
                    adminLocationSelect.innerHTML = '<option value="">Select a location</option>'; // Default option
                    locations.forEach(loc => {
                        const option = document.createElement('option');
                        option.value = loc.location_id;
                        option.textContent = loc.location_name;
                        adminLocationSelect.appendChild(option);
                    });
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
            console.error("Error loading locations:", error); // DEBUG
            showModalMessage(`Failed to load locations: ${error.message}`, true);
        }
    }

    /**
     * Loads and displays the list of users (admins and potentially employees).
     */
    async function loadUsers() {
        console.log('handleAdminPage: Loading users...'); // DEBUG
        if (!userListDiv) {
            console.log('handleAdminPage: User list div not found.'); // DEBUG
            return;
        }
        userListDiv.innerHTML = '<p>Loading users...</p>';
        try {
            // Fetch users. Assuming '/users' endpoint returns users for the current company.
            // You might want to filter by role if you only want to show non-super-admins
            const users = await apiRequest('GET', '/users');
            console.log('handleAdminPage: Users loaded:', users); // DEBUG
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
            console.error("Error loading users:", error); // DEBUG
            userListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading users: ${error.message}</p>`;
        }
    }

    // Consolidated event listener for delete buttons (for both locations and users)
    // This uses event delegation on a common parent (e.g., locationListDiv or userListDiv's parent)
    // For simplicity, attaching to document body, but ideally should be on a more specific common parent
    document.body.addEventListener('click', async (e) => {
        const targetButton = e.target.closest('.btn-delete');
        if (targetButton) {
            console.log('handleAdminPage: Delete button clicked.'); // DEBUG
            const id = targetButton.dataset.id;
            const type = targetButton.dataset.type; // 'location' or 'user'
            const confirmationMessage = `Are you sure you want to delete this ${type}?`;
            
            // Replaced native confirm() with custom showConfirmModal
            const confirmed = await showConfirmModal(confirmationMessage, 'Delete');

            if (confirmed) {
                try {
                    console.log(`handleAdminPage: Deleting ${type} with ID: ${id}...`); // DEBUG
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
                    console.log(`handleAdminPage: ${type} deleted successfully.`); // DEBUG
                } catch (error) {
                    console.error(`Error deleting ${type}:`, error); // DEBUG
                    showModalMessage(`Error deleting ${type}: ${error.message}`, true);
                }
            }
        }
    });


    // Handle new location form submission
    if (newLocationForm) {
        console.log('handleAdminPage: New location form found, attaching listener.'); // DEBUG
        newLocationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('handleAdminPage: New location form submitted.'); // DEBUG
            const nameInput = document.getElementById('new-location-name');
            const addressInput = document.getElementById('new-location-address');
            const location_name = nameInput.value;
            const location_address = addressInput.value;

            try {
                console.log('handleAdminPage: Creating location via API...'); // DEBUG
                await apiRequest('POST', '/locations', { location_name, location_address });
                nameInput.value = '';
                addressInput.value = '';
                showModalMessage('Location created successfully!', false);
                console.log('handleAdminPage: Location created, reloading lists.'); // DEBUG
                loadLocations(); // Reload locations to show new entry and update dropdown
            } catch (error) {
                console.error("Error creating location:", error); // DEBUG
                showModalMessage(`Error creating location: ${error.message}`, true);
            }
        });
    }

    // Handle invite admin form submission
    if (inviteAdminForm) {
        console.log('handleAdminPage: Invite admin form found, attaching listener.'); // DEBUG
        inviteAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('handleAdminPage: Invite admin form submitted.'); // DEBUG
            const adminName = document.getElementById('admin-name') ? document.getElementById('admin-name').value : '';
            const adminEmail = document.getElementById('admin-email') ? document.getElementById('admin-email').value : '';
            const adminPassword = document.getElementById('admin-password') ? document.getElementById('admin-password').value : '';
            const adminLocationSelectElement = document.getElementById('admin-location-select'); // Get the element
            const adminLocationId = adminLocationSelectElement ? adminLocationSelectElement.value : ''; // Safely get its value

            if (!adminLocationId) {
                console.log('handleAdminPage: Admin invite validation failed: No location selected.'); // DEBUG
                showModalMessage('Please select a location to assign the admin.', true);
                return;
            }
            if (!adminPassword) {
                console.log('handleAdminPage: Admin invite validation failed: No temporary password.'); // DEBUG
                showModalMessage('Please enter a temporary password for the new admin.', true);
                return;
            }

            try {
                console.log('handleAdminPage: Inviting admin via API...'); // DEBUG
                await apiRequest('POST', '/invite-admin', {
                    full_name: adminName,
                    email: adminEmail,
                    location_id: parseInt(adminLocationId), // Ensure ID is parsed as integer
                    password: adminPassword
                });
                
                if (document.getElementById('admin-name')) document.getElementById('admin-name').value = '';
                if (document.getElementById('admin-email')) document.getElementById('admin-email').value = '';
                if (document.getElementById('admin-password')) document.getElementById('admin-password').value = '';
                if (adminLocationSelectElement) adminLocationSelectElement.value = '';

                showModalMessage(`Admin invite sent to ${adminEmail} for selected location with the provided temporary password.`, false);
                console.log('handleAdminPage: Admin invited, reloading users.'); // DEBUG
                loadUsers(); // Reload users to show the newly invited admin
            } catch (error) { // The catch block was indeed missing
                console.error("Error inviting admin:", error); // DEBUG
                showModalMessage(`Failed to invite admin: ${error.message}`, true);
            }
        });
    }

    // Initial load for admin page
    console.log('handleAdminPage: Initial page load, loading locations and users.'); // DEBUG
    loadLocations(); // Load locations and populate dropdown
    loadUsers(); // Load and display users
}

/**
 * Handles the logic for the pricing page.
 * Attaches event listeners to pricing tier buttons to initiate Stripe checkout sessions.
 */
function handlePricingPage() {
    console.log('handlePricingPage: Initializing pricing page logic.'); // DEBUG
    const freePlanBtn = document.getElementById('free-plan-btn');
    const proPlanBtn = document.getElementById('pro-plan-btn');
    const enterprisePlanBtn = document.getElementById('enterprise-plan-btn');

    if (!freePlanBtn || !proPlanBtn || !enterprisePlanBtn) {
        console.error('handlePricingPage: One or more pricing plan buttons not found. Check IDs in HTML.'); // DEBUG
        return;
    }
    console.log('handlePricingPage: All pricing plan buttons found.'); // DEBUG

    // Handle 'Current Plan' button - typically, it would just show current status or lead to account page
    if (freePlanBtn) {
        freePlanBtn.addEventListener('click', () => {
            console.log('handlePricingPage: Free plan button clicked.'); // DEBUG
            // For now, it just shows a message, but it could fetch user's current plan status
            showModalMessage('You are currently on the Free plan. No action needed.', false);
        });
    }

    // Handle 'Choose Pro' and 'Choose Enterprise' buttons to initiate Stripe checkout
    const handlePlanButtonClick = async (event) => {
        console.log('handlePricingPage: Plan button clicked. Target:', event.target); // DEBUG
        const planId = event.target.dataset.planId; // Get the plan ID from data-plan-id attribute

        if (!planId) {
            console.error('handlePricingPage: Plan ID not found on button. Check data-plan-id attribute.'); // DEBUG
            showModalMessage('Plan ID not found. Cannot proceed with checkout.', true);
            return;
        }
        console.log('handlePricingPage: Selected planId:', planId); // DEBUG

        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.log('handlePricingPage: No auth token found, prompting login.'); // DEBUG
            showModalMessage('Please log in to choose a plan.', true);
            // Optionally redirect to login
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        console.log('handlePricingPage: Auth token found, proceeding with checkout session creation.'); // DEBUG

        try {
            console.log('handlePricingPage: Making API request to /create-checkout-session...'); // DEBUG
            // Make an API request to your backend to create a Stripe Checkout Session
            const response = await apiRequest('POST', '/create-checkout-session', { planId: planId });
            const sessionId = response.sessionId;
            console.log('handlePricingPage: Received session ID from backend:', sessionId); // DEBUG

            if (sessionId) {
                console.log('handlePricingPage: Redirecting to Stripe Checkout...'); // DEBUG
                // Redirect to Stripe Checkout page
                const result = await stripe.redirectToCheckout({
                    sessionId: sessionId,
                });

                if (result.error) {
                    console.error('Stripe Checkout Error:', result.error.message); // DEBUG
                    showModalMessage(`Stripe Checkout Error: ${result.error.message}`, true);
                }
            } else {
                console.error('handlePricingPage: Session ID not received from backend.'); // DEBUG
                showModalMessage('Failed to create Stripe Checkout session. Please try again.', true);
            }
        } catch (error) {
            console.error('Error initiating checkout:', error); // DEBUG
            showModalMessage(`Error initiating checkout: ${error.message}`, true);
        }
    };

    if (proPlanBtn) {
        proPlanBtn.addEventListener('click', handlePlanButtonClick);
        console.log('handlePricingPage: Attached click listener to Pro button.'); // DEBUG
    }
    if (enterprisePlanBtn) {
        enterprisePlanBtn.addEventListener('click', handlePlanButtonClick);
        console.log('handlePricingPage: Attached click listener to Enterprise button.'); // DEBUG
    }
}


// --- Placeholder functions for other pages (replace with actual logic) ---

function handleSchedulingPage() {
    console.log('handleSchedulingPage: Initializing.'); // DEBUG
    if (!localStorage.getItem('authToken')) {
        console.log('handleSchedulingPage: No auth token found, redirecting to login.'); // DEBUG
        window.location.href = 'login.html';
        return;
    }
    // ... actual logic for scheduling page ...
    console.log('Scheduling page logic goes here.');
}

function handleHiringPage() {
    console.log('handleHiringPage: Initializing.'); // DEBUG
    if (!localStorage.getItem('authToken')) {
        console.log('handleHiringPage: No auth token found, redirecting to login.'); // DEBUG
        window.location.href = 'login.html';
        return;
    }
    // ... actual logic for hiring page ...
    console.log('Hiring page logic goes here.');
}

function handleSalesAnalyticsPage() {
    console.log('handleSalesAnalyticsPage: Initializing.'); // DEBUG
    if (!localStorage.getItem('authToken')) {
        console.log('handleSalesAnalyticsPage: No auth token found, redirecting to login.'); // DEBUG
        window.location.href = 'login.html';
        return;
    }
    // ... actual logic for sales analytics page ...
    console.log('Sales Analytics page logic goes here.');
}
