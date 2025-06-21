// app.js - Client-Side JavaScript for Flow Business Suite
// This file handles all client-side logic, form submissions, and API requests.

// IMPORTANT: Set this to your deployed backend API URL.
// Your frontend is deployed at https://flow-gz1r.onrender.com/
// Assuming your backend API is accessible at the same root with '/api' suffix (as per server.js routes configuration).
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

// Initialize Stripe.js with your public key
// This key should be retrieved from your backend or securely stored in your client-side config.
// The Stripe object is defined by the Stripe.js script loaded in pricing.html.
let stripe; // Declare as 'let' because it will be initialized conditionally

// Add a check to ensure Stripe is defined before initializing
if (typeof Stripe !== 'undefined') {
    stripe = Stripe('pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td');
} else {
    // This warning will appear on pages where Stripe is not expected/needed
    console.warn("Stripe.js not loaded. Stripe functionalities will not work on this page.");
}


/**
 * Displays a custom modal message to the user.
 * Ensure your HTML includes elements with ids: 'message-modal-overlay', 'modal-message-text', 'modal-close-button'
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message, false otherwise.
 */
function showModalMessage(message, isError = false) {
    const modalOverlay = document.getElementById("message-modal-overlay");
    const modalMessage = document.getElementById("modal-message-text");
    const modalCloseButton = document.getElementById("modal-close-button");
    if (modalOverlay && modalMessage && modalCloseButton) {
        modalMessage.textContent = message;
        modalMessage.style.color = isError ? "#ff8a80" : "var(--text-light)";
        modalOverlay.style.display = "flex";
        modalOverlay.style.zIndex = "1000";
        modalCloseButton.onclick = () => {
            modalOverlay.style.display = "none";
        };
        modalOverlay.onclick = event => {
            if (event.target === modalOverlay) {
                modalOverlay.style.display = "none";
            }
        };
    } else {
        console.error("Modal elements not found for showModalMessage. Message:", message);
        if (isError) {
            console.error(`ERROR: ${message}`);
        } else {
            console.log(`MESSAGE: ${message}`);
        }
    }
}

/**
 * Displays a confirmation modal to the user.
 * Ensure your HTML includes elements with ids: 'confirm-modal-overlay', 'confirm-modal-message', 'modal-confirm', 'modal-cancel'
 * @param {string} message - The confirmation message to display.
 * @param {string} confirmButtonText - Text for the confirm button.
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled.
 */
function showConfirmModal(message, confirmButtonText = "Confirm") {
    return new Promise(resolve => {
        const confirmModalOverlay = document.getElementById("confirm-modal-overlay");
        const confirmModalMessage = document.getElementById("confirm-modal-message");
        const modalConfirmButton = document.getElementById("modal-confirm");
        const modalCancelButton = document.getElementById("modal-cancel");

        if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
            console.error("Confirmation modal elements not found. Falling back to native confirm.");
            resolve(window.confirm(message)); // Fallback is generally not ideal in production for consistent UX
            return;
        }

        confirmModalMessage.innerHTML = message; // Use innerHTML to allow for bolding etc.
        modalConfirmButton.textContent = confirmButtonText;
        confirmModalOverlay.style.display = "flex";

        const handleConfirm = () => {
            confirmModalOverlay.style.display = "none";
            modalConfirmButton.removeEventListener("click", handleConfirm);
            modalCancelButton.removeEventListener("click", handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            confirmModalOverlay.style.display = "none";
            modalConfirmButton.removeEventListener("click", handleConfirm);
            modalCancelButton.removeEventListener("click", handleCancel);
            resolve(false);
        };

        modalConfirmButton.addEventListener("click", handleConfirm);
        modalCancelButton.addEventListener("click", handleCancel);
        confirmModalOverlay.onclick = event => {
            if (event.target === confirmModalOverlay) {
                handleCancel();
            }
        };
    });
}


/**
 * Sets up the functionality for the settings dropdown menu.
 * This includes showing/hiding the dropdown and handling logout.
 * The "Upgrade Plan" link is now assumed to be directly visible in HTML or handled by backend rendering.
 */
function setupSettingsDropdown() {
    const settingsButton = document.getElementById("settings-button");
    const settingsDropdown = document.getElementById("settings-dropdown");
    const logoutButton = document.getElementById("logout-button");
    const upgradePlanLink = document.getElementById("upgrade-plan-link"); // Get the new link

    if (settingsButton && settingsDropdown) {
        settingsButton.addEventListener("click", async event => { // Made async to fetch profile
            event.stopPropagation(); // Prevent the document click from immediately closing it
            settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";

            // If the dropdown is being opened and the upgrade link exists
            // This logic will be active if the HTML still contains id="upgrade-plan-link"
            if (settingsDropdown.style.display === "block" && upgradePlanLink) {
                // Only fetch profile if a token exists to avoid unnecessary API calls for unauthenticated users
                if (localStorage.getItem("authToken")) {
                    try {
                        const profile = await apiRequest("GET", "/profile");
                        // Corrected: Use profile.plan_id (with underscore) to match backend response
                        if (profile && profile.plan_id === 'free') {
                            upgradePlanLink.style.display = 'block';
                        } else {
                            // If the user has a pro/enterprise plan, or if profile fetching fails, hide the link
                            upgradePlanLink.style.display = 'none';
                        }
                    } catch (error) {
                        console.error("Error fetching profile for upgrade link:", error);
                        // Hide on error to prevent confusion
                        upgradePlanLink.style.display = 'none';
                    }
                } else {
                    // Hide if not logged in
                    upgradePlanLink.style.display = 'none';
                }
            }
        });
        // Close dropdown if user clicks outside
        document.addEventListener("click", event => {
            if (!settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
                settingsDropdown.style.display = "none";
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            localStorage.removeItem("authToken");
            localStorage.removeItem("userRole"); // Clear user role too
            window.location.href = "login.html"; // Redirect to login page
        });
    }
}


/**
 * Handles API requests to the backend.
 * Includes authentication token in headers if available.
 * Supports file uploads with progress tracking for FormData.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {string} path - API endpoint path (e.g., '/login', '/profile').
 * @param {object} body - Request body data (for POST, PUT).
 * @param {boolean} isFormData - Set to true if sending FormData (e.g., file uploads).
 * @param {function} onProgress - Callback function for upload progress (takes event as argument). Only used if isFormData is true.
 * @returns {Promise<object|null>} - JSON response data or null if 204.
 * @throws {Error} - If the API response is not OK.
 */
async function apiRequest(method, path, body = null, isFormData = false, onProgress = null) {
    const token = localStorage.getItem('authToken');
    const endpoint = `${API_BASE_URL}${path}`;

    if (isFormData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);

            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            // Progress event for uploads
            if (onProgress && xhr.upload) {
                xhr.upload.addEventListener('progress', onProgress);
            }

            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    if (xhr.status === 204 || (xhr.status === 200 && xhr.responseText.length === 0)) {
                        resolve({}); // Resolve with empty object for 204 or empty 200
                    } else {
                        try {
                            // Attempt to parse JSON. If it fails, resolve with empty object or raw text.
                            const responseData = JSON.parse(xhr.responseText);
                            resolve(responseData);
                        } catch (e) {
                            console.warn("API response was not JSON, resolving with success status:", xhr.responseText);
                            resolve({ message: "Operation successful", rawResponse: xhr.responseText }); // Generic success
                        }
                    }
                } else if (xhr.status === 401 || xhr.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    // Add a sessionExpired parameter for specific messages on login page
                    window.location.href = 'login.html?sessionExpired=true';
                    reject(new Error('Authentication token missing or invalid.'));
                } else {
                    // Handle non-2xx responses
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error || `HTTP error! Status: ${xhr.status}`));
                    } catch (e) {
                        // If response is not JSON (e.g., plain text error from server), use generic message
                        reject(new Error(`HTTP error! Status: ${xhr.status} - ${xhr.statusText || 'Unknown Error'}`));
                    }
                }
            };

            xhr.onerror = function () {
                reject(new Error('Network error or request failed. Please check your internet connection.'));
            };

            xhr.send(body);
        });
    } else {
        // Original fetch API logic for non-FormData requests
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(endpoint, options);
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            window.location.href = 'login.html?sessionExpired=true';
            throw new Error('Authentication token missing or invalid.');
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Something went wrong");
        }
        if (response.status === 204 || (response.status === 200 && response.headers.get("content-length") === "0")) {
            return null;
        }
        return response.json();
    }
}


/**
 * Handles all client-side logic for the login.html page.
 */
function handleLoginPage() {
    const loginForm = document.getElementById("login-form");
    if (!loginForm) {
        return; // Exit if form not found (e.g., on a different page)
    }

    // Display session expired message if redirected from an authenticated page
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('sessionExpired') && urlParams.get('sessionExpired') === 'true') {
        const errorMessageDiv = document.getElementById("error-message");
        if (errorMessageDiv) {
            errorMessageDiv.textContent = 'Your session has expired or is invalid. Please log in again.';
            errorMessageDiv.classList.add('visible');
            errorMessageDiv.setAttribute('aria-hidden', 'false');
        }
        // Clear the URL parameter to avoid showing the message on refresh
        urlParams.delete('sessionExpired');
        window.history.replaceState({}, document.title, window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : ''));
    }


    loginForm.addEventListener("submit", async e => {
        e.preventDefault(); // Prevent default form submission
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const errorMessage = document.getElementById("error-message");

        // Clear previous error messages
        if (errorMessage) {
            errorMessage.textContent = "";
            errorMessage.classList.remove("visible");
            errorMessage.setAttribute('aria-hidden', 'true');
        }

        // Basic client-side validation
        if (!email || !password) {
            if (errorMessage) {
                errorMessage.textContent = "Email and password are required.";
                errorMessage.classList.add("visible");
                errorMessage.setAttribute('aria-hidden', 'false');
            }
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (errorMessage) {
                errorMessage.textContent = "Please enter a valid email address.";
                errorMessage.classList.add("visible");
                errorMessage.setAttribute('aria-hidden', 'false');
            }
            return;
        }

        if (password.length < 6) {
            if (errorMessage) {
                errorMessage.textContent = "Password must be at least 6 characters long.";
                errorMessage.classList.add("visible");
                errorMessage.setAttribute('aria-hidden', 'false');
            }
            return;
        }

        try {
            // Send login request to backend
            const data = await apiRequest("POST", "/login", {
                email: email,
                password: password
            });

            // Store authentication token and user role
            localStorage.setItem("authToken", data.token);
            localStorage.setItem("userRole", data.role); // Store user role

            // Redirect based on user role
            if (data.role === "super_admin" || data.role === "location_admin") {
                window.location.href = "suite-hub.html"; // Admins go to app hub
            } else {
                window.location.href = "new-hire-view.html"; // Employees go to their onboarding view
            }
        } catch (error) {
            console.error("Login API error:", error);
            if (errorMessage) {
                errorMessage.textContent = `Login Failed: ${error.message}`;
                errorMessage.classList.add("visible");
                errorMessage.setAttribute('aria-hidden', 'false');
            }
            // Also show a modal message for more prominent feedback
            showModalMessage(`Login Failed: ${error.message}`, true);
        }
    });
}

/**
 * Handles all client-side logic for the register.html page.
 */
function handleRegisterPage() {
    const registerForm = document.getElementById("register-form");
    if (!registerForm) {
        return; // Exit if form not found
    }

    registerForm.addEventListener("submit", async e => {
        e.preventDefault();
        const companyNameInput = document.getElementById("company-name");
        const fullNameInput = document.getElementById("full-name");
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const errorMessage = document.getElementById("error-message");

        const company_name = companyNameInput.value.trim();
        const full_name = fullNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        errorMessage.textContent = ""; // Clear any previous error
        errorMessage.classList.remove("visible");
        errorMessage.setAttribute('aria-hidden', 'true');

        // Client-side validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!company_name || !full_name || !email || !password || password.length < 6 || !emailRegex.test(email)) {
            errorMessage.textContent = "Please fill all fields correctly. Password must be at least 6 characters and email valid.";
            errorMessage.classList.add("visible");
            errorMessage.setAttribute('aria-hidden', 'false');
            return;
        }

        try {
            // Send registration request
            const data = await apiRequest("POST", "/register", {
                company_name: company_name,
                full_name: full_name,
                email: email,
                password: password
            });

            showModalMessage("Account created successfully! Please log in.", false);

            // Clear form fields after successful registration
            companyNameInput.value = "";
            fullNameInput.value = "";
            emailInput.value = "";
            passwordInput.value = "";

            // Redirect to login page after a short delay
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000); // 2-second delay
        } catch (error) {
            console.error("Registration API error:", error);
            if (errorMessage) {
                errorMessage.textContent = `Registration Failed: ${error.message}`;
                errorMessage.classList.add("visible");
                errorMessage.setAttribute('aria-hidden', 'false');
            }
            showModalMessage(`Registration Failed: ${error.message}`, true);
        }
    });
}

/**
 * Handles logic for the suite-hub.html page, including payment status messages.
 */
function handleSuiteHubPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // Check for payment status from Stripe redirect
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get("payment");
    const sessionId = urlParams.get("session_id"); // Could be used for further verification if needed

    if (paymentStatus === "success") {
        showModalMessage("Payment successful! Your subscription has been updated.", false);
        // Clear the URL parameters to prevent showing the message again on refresh
        history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === "cancelled") {
        showModalMessage("Payment cancelled. You can try again or choose another plan.", true);
        history.replaceState({}, document.title, window.location.pathname);
    }
    // Add other suite-hub specific logic here if any.
}

/**
 * Handles all client-side logic for the account.html page.
 */
function handleAccountPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const displayProfileName = document.getElementById("display-profile-name");
    const displayProfileEmail = document.getElementById("display-profile-email");
    const profileNameInput = document.getElementById("profile-name");
    const profileEmailInput = document.getElementById("profile-email");
    const updateProfileForm = document.getElementById("update-profile-form");
    const currentPasswordInput = document.getElementById("current-password");
    const newPasswordInput = document.getElementById("new-password");

    // Function to load and display user profile information
    async function loadProfileInfo() {
        try {
            const profile = await apiRequest("GET", "/profile");
            if (displayProfileName)
                displayProfileName.textContent = profile.fullName || "N/A";
            if (displayProfileEmail)
                displayProfileEmail.textContent = profile.email || "N/A";
            if (profileNameInput)
                profileNameInput.value = profile.fullName || "";
            if (profileEmailInput)
                profileEmailInput.value = profile.email || "";
        } catch (error) {
            console.error("Error loading profile info:", error);
            showModalMessage(`Failed to load profile: ${error.message}`, true);
        }
    }

    // Handle profile update form submission
    if (updateProfileForm) {
        updateProfileForm.addEventListener("submit", async e => {
            e.preventDefault();
            const fullName = profileNameInput ? profileNameInput.value : "";
            const email = profileEmailInput ? profileEmailInput.value : "";
            const currentPassword = currentPasswordInput ? currentPasswordInput.value : "";
            const newPassword = newPasswordInput ? newPasswordInput.value : "";

            const updatePayload = {
                fullName: fullName,
                email: email
            };
            if (currentPassword && newPassword) {
                updatePayload.currentPassword = currentPassword;
                updatePayload.newPassword = newPassword;
            }

            try {
                const result = await apiRequest("PUT", "/profile", updatePayload);
                // If token is returned (e.g., email changed), update it in localStorage
                if (result && result.token) {
                    localStorage.setItem("authToken", result.token);
                }
                showModalMessage(result.message || "Profile updated successfully!", false);
                // Clear password fields
                if (currentPasswordInput)
                    currentPasswordInput.value = "";
                if (newPasswordInput)
                    newPasswordInput.value = "";
                // Reload profile info to reflect changes
                loadProfileInfo();
            } catch (error) {
                console.error("Error updating profile:", error);
                showModalMessage(`Failed to update profile: ${error.message}`, true);
            }
        });
    }

    // Load profile info when the page loads
    loadProfileInfo();
}


/**
 * Handles all client-side logic for the admin.html page.
 */
function handleAdminPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const locationListDiv = document.getElementById("location-list");
    const userListDiv = document.getElementById("user-list");
    const newLocationForm = document.getElementById("new-location-form");
    const inviteAdminForm = document.getElementById("invite-admin-form");
    const inviteEmployeeForm = document.getElementById("invite-employee-form"); // Get employee form
    const adminLocationSelect = document.getElementById("admin-location-select");
    const employeeLocationSelect = document.getElementById("employee-location-select"); // Get employee location select

    /**
     * Fetches and displays the list of locations.
     */
    async function loadLocations() {
        if (!locationListDiv) {
            return;
        }
        locationListDiv.innerHTML = "<p>Loading locations...</p>";
        try {
            const locations = await apiRequest("GET", "/locations");
            locationListDiv.innerHTML = "";
            if (locations.length === 0) {
                locationListDiv.innerHTML = '<p style="color: var(--text-medium);">No locations created yet.</p>';
                if (adminLocationSelect) {
                    adminLocationSelect.innerHTML = '<option value="">Select a location</option>';
                    adminLocationSelect.disabled = true;
                }
                if (employeeLocationSelect) { // Also disable/reset for employee form
                    employeeLocationSelect.innerHTML = '<option value="">Select a location</option>';
                    employeeLocationSelect.disabled = true;
                }
            } else {
                if (adminLocationSelect)
                    adminLocationSelect.disabled = false;
                if (employeeLocationSelect) // Also enable for employee form
                    employeeLocationSelect.disabled = false;

                locations.forEach(loc => {
                    const locDiv = document.createElement("div");
                    locDiv.className = "list-item";
                    locDiv.innerHTML = `<span>${loc.location_name} - ${loc.location_address}</span>
                                        <button class="btn-delete" data-type="location" data-id="${loc.location_id}">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                                        </button>`;
                    locDiv.addEventListener("click", e => {
                        if (!e.target.closest(".btn-delete")) {
                            showModalMessage(`Location: ${loc.location_name} (ID: ${loc.location_id}) - Address: ${loc.location_address}`, false);
                        }
                    });
                    locationListDiv.appendChild(locDiv);
                });
                // Populate both admin and employee location selects
                const locationOptionsHtml = locations.map(loc => `<option value="${loc.location_id}">${loc.location_name}</option>`).join('');
                if (adminLocationSelect) {
                    adminLocationSelect.innerHTML = `<option value="">Select a location</option>${locationOptionsHtml}`;
                }
                if (employeeLocationSelect) {
                    employeeLocationSelect.innerHTML = `<option value="">Select a location</option>${locationOptionsHtml}`;
                }
            }
        } catch (error) {
            console.error("Error loading locations:", error);
            showModalMessage(`Failed to load locations: ${error.message}`, true);
        }
    }

    /**
     * Fetches and displays the list of users.
     */
    async function loadUsers() {
        if (!userListDiv)
            return; // Exit if div not found
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
                    if (user.location_name) {
                        userInfo += ` @ ${user.location_name}`;
                    }
                    userDiv.innerHTML = `<span>${userInfo}</span>
                                         <button class="btn-delete" data-type="user" data-id="${user.user_id}">
                                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                                         </button>`;
                    userDiv.appendChild(userDiv);
                });
            }
        } catch (error) {
            console.error("Error loading users:", error);
            userListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading users: ${error.message}</p>`;
        }
    }

    // Event listener for delete buttons (delegated to body for dynamically added elements)
    document.body.addEventListener("click", async e => {
        const targetButton = e.target.closest(".btn-delete");
        if (targetButton) {
            console.log("handleAdminPage: Delete button clicked.");
            const id = targetButton.dataset.id;
            const type = targetButton.dataset.type; // 'location' or 'user'
            const confirmationMessage = `Are you sure you want to delete this ${type}? This action cannot be undone.`;
            const confirmed = await showConfirmModal(confirmationMessage, "Delete");

            if (confirmed) {
                try {
                    console.log(`handleAdminPage: Deleting ${type} with ID: ${id}.`);
                    if (type === "location") {
                        await apiRequest("DELETE", `/locations/${id}`);
                        showModalMessage("Location deleted successfully!", false);
                        loadLocations(); // Reload locations list
                        loadUsers();     // Reload users list as some might be linked to this location
                    } else if (type === "user") {
                        await apiRequest("DELETE", `/users/${id}`);
                        showModalMessage("User deleted successfully!", false);
                        loadUsers(); // Reload users list
                    }
                    console.log(`handleAdminPage: ${type} deleted successfully.`);
                } catch (error) {
                    showModalMessage(`Error deleting ${type}: ${error.message}`, true);
                }
            }
        }
    });

    // Handle new location form submission
    if (newLocationForm) {
        console.log("handleAdminPage: New location form found, attaching listener.");
        newLocationForm.addEventListener("submit", async e => {
            e.preventDefault();
            console.log("handleAdminPage: New location form submitted.");
            const nameInput = document.getElementById("new-location-name");
            const addressInput = document.getElementById("new-location-address");
            const location_name = nameInput.value.trim();
            const location_address = addressInput.value.trim();

            try {
                console.log("handleAdminPage: Creating location via API.");
                await apiRequest("POST", "/locations", {
                    location_name: location_name,
                    location_address: location_address
                });
                nameInput.value = ""; // Clear form
                addressInput.value = ""; // Clear form
                showModalMessage("Location created successfully!", false);
                console.log("handleAdminPage: Location created, reloading lists.");
                loadLocations(); // Reload locations to show new entry
            } catch (error) {
                console.error("Error creating location:", error);
                showModalMessage(`Error creating location: ${error.message}`, true);
            }
        });
    }

    // Handle invite admin form submission
    if (inviteAdminForm) {
        console.log("handleAdminPage: Invite admin form found, attaching listener.");
        inviteAdminForm.addEventListener("submit", async e => {
            e.preventDefault();
            console.log("handleAdminPage: Invite admin form submitted.");
            const adminName = document.getElementById("admin-name") ? document.getElementById("admin-name").value.trim() : "";
            const adminEmail = document.getElementById("admin-email") ? document.getElementById("admin-email").value.trim() : "";
            const adminPassword = document.getElementById("admin-password") ? document.getElementById("admin-password").value : "";
            const adminLocationSelectElement = document.getElementById("admin-location-select");
            const adminLocationId = adminLocationSelectElement ? adminLocationSelectElement.value : "";

            if (!adminName || !adminEmail || !adminPassword || adminPassword.length < 6 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
                showModalMessage("Please provide a full name, valid email, and a password (min 6 chars) for the new admin.", true);
                return;
            }
            if (!adminLocationId) {
                showModalMessage("Please select a location to assign the admin.", true);
                return;
            }

            try {
                console.log("handleAdminPage: Inviting admin via API.");
                await apiRequest("POST", "/invite-admin", {
                    full_name: adminName,
                    email: adminEmail,
                    location_id: parseInt(adminLocationId), // Ensure it's an integer
                    password: adminPassword
                });
                // Clear form fields
                if (document.getElementById("admin-name")) document.getElementById("admin-name").value = "";
                if (document.getElementById("admin-email")) document.getElementById("admin-email").value = "";
                if (document.getElementById("admin-password")) document.getElementById("admin-password").value = "";
                if (adminLocationSelectElement) adminLocationSelectElement.value = ""; // Reset dropdown

                showModalMessage(`Admin invite sent to ${adminEmail} for selected location with the provided temporary password.`, false);
                console.log("handleAdminPage: Admin invited, reloading users.");
                loadUsers(); // Reload users to show new admin
            } catch (error) {
                console.error("Error inviting admin:", error);
                showModalMessage(`Failed to invite admin: ${error.message}`, true);
            }
        });
    }

    // Handle invite employee form submission
    if (inviteEmployeeForm) {
        console.log("handleAdminPage: Invite employee form found, attaching listener.");
        inviteEmployeeForm.addEventListener("submit", async e => {
            e.preventDefault();
            console.log("handleAdminPage: Invite employee form submitted.");
            const employeeName = document.getElementById("employee-name") ? document.getElementById("employee-name").value.trim() : "";
            const employeeEmail = document.getElementById("employee-email") ? document.getElementById("employee-email").value.trim() : "";
            const employeePassword = document.getElementById("employee-password") ? document.getElementById("employee-password").value : "";
            const employeePosition = document.getElementById("employee-position") ? document.getElementById("employee-position").value.trim() : "";
            const employeeId = document.getElementById("employee-id") ? document.getElementById("employee-id").value.trim() : null; // Can be null or empty string
            const employeeLocationSelectElement = document.getElementById("employee-location-select");
            const employeeLocationId = employeeLocationSelectElement ? employeeLocationSelectElement.value : "";

            // Client-side validation for employee invite
            if (!employeeName || !employeeEmail || !employeePassword || employeePassword.length < 6 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail)) {
                showModalMessage("Full name, valid email, and a password (min 6 chars) are required for employee invitation.", true);
                return;
            }

            // Convert location ID to number or null (if empty string)
            const locationIdToSend = employeeLocationId ? parseInt(employeeLocationId) : null;
            // Convert employee_id to number or string or null (if empty string)
            const employeeIdToSend = employeeId ? (isNaN(parseInt(employeeId)) ? employeeId : parseInt(employeeId)) : null;

            try {
                console.log("handleAdminPage: Inviting employee via API.");
                await apiRequest("POST", "/invite-employee", {
                    full_name: employeeName,
                    email: employeeEmail,
                    password: employeePassword,
                    position: employeePosition || null, // Send null if empty
                    employee_id: employeeIdToSend,     // Send null if empty, or parsed value
                    location_id: locationIdToSend      // Send null if empty/unassigned
                });
                // Clear form fields
                if (document.getElementById("employee-name")) document.getElementById("employee-name").value = "";
                if (document.getElementById("employee-email")) document.getElementById("employee-email").value = "";
                if (document.getElementById("employee-password")) document.getElementById("employee-password").value = "";
                if (document.getElementById("employee-position")) document.getElementById("employee-position").value = "";
                if (document.getElementById("employee-id")) document.getElementById("employee-id").value = "";
                if (employeeLocationSelectElement) employeeLocationSelectElement.value = ""; // Reset dropdown

                showModalMessage(`Employee invite sent to ${employeeEmail} with the provided temporary password.`, false);
                console.log("handleAdminPage: Employee invited, reloading users.");
                loadUsers(); // Reload users to show new employee
            } catch (error) {
                console.error("Error inviting employee:", error);
                showModalMessage(`Failed to invite employee: ${error.message}`, true);
            }
        });
    }

    // Initial loads when the admin page loads
    loadLocations();
    loadUsers();
}

/**
 * Handles all client-side logic for the pricing.html page.
 */
function handlePricingPage() {
    console.log("handlePricingPage: Initializing pricing page logic.");
    const freePlanBtn = document.getElementById("free-plan-btn");
    const proPlanBtn = document.getElementById("pro-plan-btn");
    const enterprisePlanBtn = document.getElementById("enterprise-plan-btn");

    // Ensure all required elements are present
    if (!freePlanBtn || !proPlanBtn || !enterprisePlanBtn) {
        console.error("handlePricingPage: One or more pricing plan buttons not found. Check IDs in HTML.");
        return;
    }
    console.log("handlePricingPage: All pricing plan buttons found.");

    // Get references to the new registration/checkout modal elements
    const registerCheckoutModalOverlay = document.getElementById('register-checkout-modal-overlay');
    const registerCheckoutForm = document.getElementById('register-checkout-form');
    const regCheckoutModalTitle = document.getElementById('register-checkout-modal-title');
    const regCheckoutErrorMessage = document.getElementById('register-checkout-error-message');
    const regCheckoutCancelBtn = document.getElementById('reg-checkout-cancel-btn');

    let selectedPlanForRegistration = null; // Stores the plan ID chosen when the modal is shown

    // Handle Free plan button click (no checkout needed)
    if (freePlanBtn) {
        freePlanBtn.addEventListener("click", () => {
            console.log("handlePricingPage: Free plan button clicked.");
            showModalMessage("You are currently on the Free plan. No action needed.", false);
        });
    }

    /**
     * Centralized function to initiate Stripe Checkout.
     * @param {string} planId - The ID of the plan to subscribe to ('pro' or 'enterprise').
     * @param {string} token - The authentication token of the user.
     */
    async function initiateStripeCheckout(planId, token) {
        console.log(`initiateStripeCheckout: Proceeding with checkout for plan: ${planId}`);
        try {
            // Check if stripe object is defined. It should be on pricing.html due to script order.
            if (typeof stripe === 'undefined' || stripe === null) {
                console.error("Stripe object is not initialized. Cannot proceed with checkout.");
                showModalMessage("Payment processing is unavailable. Please refresh the page.", true);
                return;
            }

            // Call backend to create a Stripe Checkout Session
            // The apiRequest function will automatically include the token in headers
            const response = await apiRequest("POST", "/create-checkout-session", {
                planId: planId
            });
            const sessionId = response.sessionId;
            console.log("initiateStripeCheckout: Received session ID from backend:", sessionId);

            if (sessionId) {
                console.log("initiateStripeCheckout: Redirecting to Stripe Checkout.");
                // Redirect to Stripe's hosted checkout page
                const result = await stripe.redirectToCheckout({
                    sessionId: sessionId
                });

                if (result.error) {
                    // This typically occurs if there's an issue with the Stripe.js client
                    console.error("Stripe Checkout Error:", result.error.message);
                    showModalMessage(`Stripe Checkout Error: ${result.error.message}`, true);
                }
            } else {
                console.error("initiateStripeCheckout: Session ID not received from backend.");
                showModalMessage("Failed to create Stripe Checkout session. Please try again.", true);
            }
        } catch (error) {
            // Handle errors from the API request itself (e.g., network issues, backend errors)
            console.error("Error initiating checkout:", error);
            showModalMessage(`Error initiating checkout: ${error.message}`, true);
        }
    }

    /**
     * Main handler for Pro/Enterprise plan button clicks.
     * Checks authentication status and either shows registration modal or initiates checkout.
     */
    const handlePlanButtonClick = async event => {
        console.log("handlePricingPage: Plan button clicked. Target:", event.target);
        const planId = event.target.dataset.planId;
        if (!planId) {
            console.error("handlePricingPage: Plan ID not found on button. Check data-plan-id attribute.");
            showModalMessage("Plan ID not found. Cannot proceed with checkout.", true);
            return;
        }

        selectedPlanForRegistration = planId; // Store the selected plan ID for the modal flow

        const authToken = localStorage.getItem("authToken");
        if (!authToken) {
            console.log("handlePricingPage: No auth token found, displaying registration modal.");
            // Customize modal title based on selected plan
            regCheckoutModalTitle.textContent = `Sign Up & Subscribe to ${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`;
            regCheckoutErrorMessage.textContent = ""; // Clear previous errors
            regCheckoutErrorMessage.classList.remove("visible"); // Hide error message div
            registerCheckoutModalOverlay.style.display = "flex"; // Show the modal
            // Clear previous inputs in the modal if any
            document.getElementById('reg-co-name').value = '';
            document.getElementById('reg-full-name').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            return; // Stop execution here, user needs to interact with modal
        }

        // If user is already logged in, proceed directly to Stripe checkout
        console.log("handlePricingPage: Auth token found, proceeding directly with checkout.");
        await initiateStripeCheckout(planId, authToken);
    };

    // Attach click listeners to Pro and Enterprise plan buttons
    if (proPlanBtn) {
        proPlanBtn.addEventListener("click", handlePlanButtonClick);
        console.log("handlePricingPage: Attached click listener to Pro button.");
    }
    if (enterprisePlanBtn) {
        enterprisePlanBtn.addEventListener("click", handlePlanButtonClick);
        console.log("handlePricingPage: Attached click listener to Enterprise button.");
    }

    // Handle submission of the new registration/checkout form inside the modal
    if (registerCheckoutForm) {
        registerCheckoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Register/Checkout Form Submitted from modal.");

            const companyName = document.getElementById('reg-co-name').value.trim();
            const fullName = document.getElementById('reg-full-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;

            // Client-side validation for the modal form
            regCheckoutErrorMessage.textContent = "";
            regCheckoutErrorMessage.classList.remove("visible");

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!companyName || !fullName || !email || !password || password.length < 6 || !emailRegex.test(email)) {
                regCheckoutErrorMessage.textContent = "Please fill all fields correctly. Password must be at least 6 characters and email valid.";
                regCheckoutErrorMessage.classList.add("visible");
                return;
            }

            try {
                console.log("Attempting to register new user via API call.");
                const registerResponse = await apiRequest("POST", "/register", {
                    company_name: companyName,
                    full_name: fullName,
                    email: email,
                    password: password
                });

                if (registerResponse) {
                    console.log("Registration successful. Now attempting to log in the new user to get an auth token for checkout.");
                    // After successful registration, immediately log in to get a token
                    const loginResponse = await apiRequest("POST", "/login", {
                        email: email,
                        password: password
                    });

                    if (loginResponse && loginResponse.token) {
                        localStorage.setItem("authToken", loginResponse.token);
                        localStorage.setItem("userRole", loginResponse.role);
                        registerCheckoutModalOverlay.style.display = "none"; // Hide the registration modal

                        showModalMessage("Account created successfully! Redirecting to payment...", false);

                        // Proceed to Stripe checkout with the newly acquired token and the previously selected plan
                        await initiateStripeCheckout(selectedPlanForRegistration, loginResponse.token);
                    } else {
                        // This case should ideally not happen if registration was successful, but good for robust error handling
                        throw new Error("Failed to log in after successful registration. Please try logging in manually.");
                    }
                } else {
                    // This implies the API returned a non-OK status, but didn't throw an error with errorData (unlikely with current apiRequest)
                    throw new Error("Registration failed unexpectedly. Please try again.");
                }
            } catch (error) {
                console.error("Registration/Checkout process error:", error);
                regCheckoutErrorMessage.textContent = `Error: ${error.message}`;
                regCheckoutErrorMessage.classList.add("visible"); // Show error message in modal
                showModalMessage(`Registration/Payment failed: ${error.message}`, true); // Also show global modal message
            }
        });
    }

    // Handle cancel button click for the new registration modal
    if (regCheckoutCancelBtn) {
        regCheckoutCancelBtn.addEventListener('click', () => {
            registerCheckoutModalOverlay.style.display = 'none'; // Hide the modal
        });
    }
}


/**
 * Function to format a date as YYYY-MM-DD.
 * @param {Date|string} date - The date object or string to format.
 * @returns {string} Formatted date string.
 */
function formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

/**
 * Function to format time for display (e.g., "9:00 AM").
 * @param {Date|string} date - The date object or string to format.
 * @returns {string} Formatted time string.
 */
function formatTime(date) {
    const d = new Date(date);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${strMinutes} ${ampm}`;
}

/**
 * Function to calculate top and height for a shift in the calendar grid.
 * Assumes 30px per hour.
 * @param {string} startTime - ISO string for start time.
 * @param {string} endTime - ISO string for end time.
 * @returns {{top: number, height: number}} Object with top offset and height in pixels.
 */
function calculateShiftPosition(startTime, endTime) {
    const startHour = new Date(startTime).getHours();
    const startMinutes = new Date(startTime).getMinutes();
    const endHour = new Date(endTime).getHours();
    const endMinutes = new Date(endTime).getMinutes();

    const startTotalMinutes = startHour * 60 + startMinutes;
    const endTotalMinutes = endHour * 60 + endMinutes;
    const durationMinutes = endTotalMinutes - startTotalMinutes;

    const slotHeight = 30; // px per hour slot

    const top = (startTotalMinutes / 60) * slotHeight;
    const height = (durationMinutes / 60) * slotHeight;

    return { top, height };
}

/**
 * Function to render the time column in the calendar grid.
 */
function renderTimeColumn() {
    const timeColumn = document.getElementById('time-column');
    if (!timeColumn) return;
    timeColumn.innerHTML = ''; // Clear previous content

    for (let i = 0; i < 24; i++) {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'calendar-time-slot';
        const hour = i % 12 === 0 ? 12 : i % 12;
        const ampm = i < 12 ? 'AM' : 'PM';
        timeSlot.textContent = `${hour}:00 ${ampm}`;
        timeColumn.appendChild(timeSlot);
    }
}


/**
 * Handles all client-side logic for the scheduling.html page.
 */
function handleSchedulingPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const employeeSelect = document.getElementById('employee-select');
    const locationSelect = document.getElementById('location-select');
    const createShiftForm = document.getElementById('create-shift-form');
    const filterEmployeeSelect = document.getElementById('filter-employee-select');
    const filterLocationSelect = document.getElementById('filter-location-select');
    const filterStartDateInput = document.getElementById('filter-start-date');
    const filterEndDateInput = document.getElementById('filter-end-date');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    const calendarGrid = document.getElementById('calendar-grid');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');

    let currentWeekStart = new Date(); // Start of the currently displayed week

    // Adjust currentWeekStart to be the Sunday of the current week
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    // Initial render of time column (already in global scope, but safe to call)
    renderTimeColumn();

    // Load data for dropdowns
    async function loadDropdowns() {
        try {
            // Fetch users from backend (employees and location_admins)
            const users = await apiRequest("GET", "/users");
            const locations = await apiRequest("GET", "/locations");

            // Filter for schedulable users (employees and location_admins who are not super_admin)
            const allSchedulableUsers = users.filter(user => user.role === 'employee' || user.role === 'location_admin')
                                             .sort((a, b) => a.full_name.localeCompare(b.full_name));

            // Populate employee dropdowns for creation and filtering
            [employeeSelect, filterEmployeeSelect].forEach(selectElement => {
                if (!selectElement) return;
                selectElement.innerHTML = `<option value="">${selectElement.id === 'employee-select' ? 'Select Employee' : 'All Employees'}</option>`;
                allSchedulableUsers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.user_id;
                    option.textContent = `${user.full_name} (${user.role.replace('_', ' ')})`;
                    selectElement.appendChild(option);
                });
            });

            // Populate location dropdowns for creation and filtering
            [locationSelect, filterLocationSelect].forEach(selectElement => {
                if (!selectElement) return;
                selectElement.innerHTML = `<option value="">${selectElement.id === 'location-select' ? 'Select Location' : 'All Locations'}</option>`;
                locations.forEach(loc => {
                    const option = document.createElement('option');
                    option.value = loc.location_id;
                    option.textContent = loc.location_name;
                    selectElement.appendChild(option);
                });
            });

        } catch (error) {
            console.error("Error loading scheduling dropdowns:", error);
            showModalMessage(`Failed to load options: ${error.message}`, true);
        }
    }

    // Function to render the calendar grid with shifts
    async function renderCalendar() {
        if (!calendarGrid) return;

        // Clear previous day headers and cells (keeping the time column header and time column itself)
        // Find existing day headers excluding the first one (Time header)
        const existingDayHeaders = Array.from(calendarGrid.children).filter(child => child.classList.contains('calendar-day-header') && child.style.gridColumn !== '1');
        existingDayHeaders.forEach(el => el.remove());
        const existingDayCells = calendarGrid.querySelectorAll('.calendar-day-cell');
        existingDayCells.forEach(el => el.remove());

        // Create a new container for day headers to maintain grid layout
        const dayHeadersFragment = document.createDocumentFragment();

        // Update week display
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to get to Saturday
        currentWeekDisplay.textContent = `${formatDate(currentWeekStart)} - ${formatDate(weekEnd)}`;

        const daysToRender = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);
            daysToRender.push(date);

            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.style.gridColumn = `${i + 2}`; // +2 because first column is 'Time'
            dayHeader.style.gridRow = '1';
            dayHeader.textContent = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            calendarGrid.appendChild(dayHeader); // Append directly to grid to preserve order
        }

        const dayCells = {}; // Store references to day cells keyed by date string
        daysToRender.forEach((date, i) => {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day-cell';
            dayCell.id = `day-cell-${formatDate(date)}`;
            dayCell.style.gridColumn = `${i + 2}`; // +2 because first column is 'Time'
            dayCell.style.gridRow = '2 / span 24'; // Spans 24 rows for 24 hours
            dayCells[formatDate(date)] = dayCell; // Store reference
            calendarGrid.appendChild(dayCell); // Append directly to grid
        });

        // Fetch shifts for the current week based on filters
        const filters = {
            start_date: formatDate(currentWeekStart),
            end_date: formatDate(weekEnd),
            employee_id: filterEmployeeSelect.value || undefined,
            location_id: filterLocationSelect.value || undefined
        };
        // If a specific filter date range is set, prioritize it over the current week
        if (filterStartDateInput.value) filters.start_date = filterStartDateInput.value;
        if (filterEndDateInput.value) filters.end_date = filterEndDateInput.value;


        try {
            const shifts = await apiRequest("GET", `/schedules?${new URLSearchParams(filters).toString()}`);
            console.log("Fetched shifts:", shifts);

            shifts.forEach(shift => {
                const shiftStart = new Date(shift.start_time);
                const shiftEnd = new Date(shift.end_time);
                const shiftDate = formatDate(shiftStart);

                const targetCell = dayCells[shiftDate];
                if (targetCell) {
                    const { top, height } = calculateShiftPosition(shiftStart, shiftEnd);

                    const shiftElement = document.createElement('div');
                    shiftElement.className = 'calendar-shift';
                    // Add overdue class if end time is in the past
                    if (shiftEnd < new Date()) {
                        shiftElement.classList.add('overdue');
                    }
                    shiftElement.style.top = `${top}px`;
                    shiftElement.style.height = `${height}px`;
                    shiftElement.dataset.scheduleId = shift.schedule_id; // Store ID for actions
                    shiftElement.dataset.employeeName = shift.employee_name;
                    shiftElement.dataset.locationName = shift.location_name;
                    shiftElement.dataset.startTime = shift.start_time;
                    shiftElement.dataset.endTime = shift.end_time;
                    shiftElement.dataset.notes = shift.notes || 'No notes.';

                    shiftElement.innerHTML = `
                        <strong>${shift.employee_name}</strong><br>
                        ${formatTime(shiftStart)} - ${formatTime(shiftEnd)}
                        <span style="font-size: 0.7em;">(${shift.location_name})</span>
                    `;
                    targetCell.appendChild(shiftElement);
                }
            });
        } catch (error) {
            console.error("Error fetching schedules:", error);
            showModalMessage(`Failed to load schedules: ${error.message}`, true);
        }
    }

    // Event listener for creating a new shift
    if (createShiftForm) {
        createShiftForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const employeeId = employeeSelect.value;
            const locationId = locationSelect.value;
            const startTime = document.getElementById('start-time-input').value;
            const endTime = document.getElementById('end-time-input').value;
            const notes = document.getElementById('notes-input').value.trim();

            if (!employeeId || !locationId || !startTime || !endTime) {
                showModalMessage("Please fill in all required fields for the new shift.", true);
                return;
            }
            if (new Date(startTime) >= new Date(endTime)) {
                showModalMessage("Start time must be before end time.", true);
                return;
            }

            try {
                await apiRequest("POST", "/schedules", {
                    employee_id: parseInt(employeeId),
                    location_id: parseInt(locationId),
                    start_time: startTime,
                    end_time: endTime,
                    notes: notes || null
                });
                showModalMessage("Shift created successfully!", false);
                createShiftForm.reset();
                renderCalendar(); // Re-render calendar to show new shift
            } catch (error) {
                console.error("Error creating shift:", error);
                showModalMessage(`Failed to create shift: ${error.message}`, true);
            }
        });
    }

    // Event listeners for calendar navigation
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            renderCalendar();
        });
    }
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            renderCalendar();
        });
    }

    // Event listeners for filter buttons
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            // When filters are applied, reset the current week display to the first date in the filter range
            if (filterStartDateInput.value) {
                currentWeekStart = new Date(filterStartDateInput.value);
                currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay()); // Adjust to start of week
                currentWeekStart.setHours(0,0,0,0);
            } else {
                // If no start date filter, reset to current week
                currentWeekStart = new Date();
                currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
                currentWeekStart.setHours(0,0,0,0);
            }
            renderCalendar(); // Re-render calendar with filters
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            filterEmployeeSelect.value = '';
            filterLocationSelect.value = '';
            filterStartDateInput.value = '';
            filterEndDateInput.value = '';
            // Reset to current week
            currentWeekStart = new Date();
            currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
            currentWeekStart.setHours(0,0,0,0);
            renderCalendar(); // Re-render calendar without filters
        });
    }

    // Event listener for clicking on a shift to view/delete
    if (calendarGrid) {
        calendarGrid.addEventListener('click', async (e) => {
            const shiftElement = e.target.closest('.calendar-shift');
            if (shiftElement) {
                const scheduleId = shiftElement.dataset.scheduleId;
                const employeeName = shiftElement.dataset.employeeName;
                const locationName = shiftElement.dataset.locationName;
                const startTime = new Date(shiftElement.dataset.startTime);
                const endTime = new Date(shiftElement.dataset.endTime);
                const notes = shiftElement.dataset.notes;

                const confirmed = await showConfirmModal(`
                    <h3>Shift Details</h3>
                    <p><strong>Employee:</strong> ${employeeName}</p>
                    <p><strong>Location:</strong> ${locationName}</p>
                    <p><strong>Time:</strong> ${formatTime(startTime)} - ${formatTime(endTime)}</p>
                    <p><strong>Date:</strong> ${formatDate(startTime)}</p>
                    <p><strong>Notes:</strong> ${notes}</p>
                    <p style="margin-top:15px;">Do you want to delete this shift?</p>
                `, 'Delete Shift');

                if (confirmed) {
                    try {
                        await apiRequest("DELETE", `/schedules/${scheduleId}`);
                        showModalMessage("Shift deleted successfully!", false);
                        renderCalendar(); // Re-render to remove deleted shift
                    } catch (error) {
                        console.error("Error deleting shift:", error);
                        showModalMessage(`Failed to delete shift: ${error.message}`, true);
                    }
                }
            }
        });
    }

    // Initial loads when the scheduling page loads
    loadDropdowns();
    renderCalendar(); // Initial calendar render
}


/**
 * Handles all client-side logic for the hiring.html page.
 */
function handleHiringPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }
    // Placeholder for actual hiring page logic
    console.log("Hiring page logic goes here. (Implementation pending)");
}

/**
 * Handles all client-side logic for the sales-analytics.html page.
 */
function handleSalesAnalyticsPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }
    // Placeholder for actual sales analytics page logic
    console.log("Sales Analytics page logic goes here. (Implementation pending)");
}

/**
 * Handles all client-side logic for the dashboard.html page (Onboarding Dashboard).
 */
function handleDashboardPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }
    // Placeholder for actual dashboard page logic
    console.log("Dashboard page logic goes here. (Implementation pending)");
}

/**
 * Handles all client-side logic for the documents.html page.
 */
function handleDocumentsPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const uploadDocumentForm = document.getElementById("upload-document-form");
    const documentTitleInput = document.getElementById("document-title");
    const documentFileInput = document.getElementById("document-file");
    const documentDescriptionInput = document.getElementById("document-description");
    const documentListDiv = document.getElementById("document-list");

    // NEW: Progress bar UI elements
    const uploadProgressContainer = document.getElementById('upload-progress-container');
    const uploadProgressBarFill = document.getElementById('upload-progress-fill');
    const uploadProgressText = document.getElementById('upload-progress-text');
    const uploadStatusText = document.getElementById('upload-status-text');
    const uploadButton = uploadDocumentForm ? uploadDocumentForm.querySelector('button[type="submit"]') : null;

    // Function to load and display documents
    async function loadDocuments() {
        console.log("Loading documents...");
        documentListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading documents...</p>';
        try {
            // Re-added mime_type and uploaded_by_user_id for join in server.js
            const documents = await apiRequest("GET", "/documents");
            documentListDiv.innerHTML = ''; // Clear existing list

            if (documents.length === 0) {
                documentListDiv.innerHTML = '<p style="color: var(--text-medium);">No documents uploaded yet.</p>';
            } else {
                documents.forEach(doc => {
                    const docItem = document.createElement("div");
                    docItem.className = "document-item";
                    docItem.innerHTML = `
                        <h4>${doc.title}</h4>
                        <p>File: ${doc.file_name} (${(doc.mime_type || 'Unknown Type')})</p>
                        <p>${doc.description || 'No description provided.'}</p>
                        <p style="font-size:0.8em; color:var(--text-medium);">Uploaded by: ${doc.uploaded_by || doc.uploaded_by_user_id || 'N/A'} on ${new Date(doc.upload_date).toLocaleDateString()}</p>
                        <div class="actions">
                            <button class="btn-download" data-document-id="${doc.document_id}">Download</button>
                            <button class="btn-delete" data-document-id="${doc.document_id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    documentListDiv.appendChild(docItem);
                });
            }
        } catch (error) {
            console.error("Error loading documents:", error);
            documentListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading documents: ${error.message}</p>`;
        }
    }

    // Handle document upload form submission
    if (uploadDocumentForm) {
        uploadDocumentForm.addEventListener("submit", async e => {
            e.preventDefault();
            console.log("Upload document form submitted.");

            const title = documentTitleInput.value.trim();
            const description = documentDescriptionInput.value.trim();
            const file = documentFileInput.files[0]; // Get the selected file

            if (!title || !file) {
                showModalMessage("Document title and a file are required for upload.", true);
                return;
            }

            // Show and reset progress bar
            if (uploadProgressContainer) {
                uploadProgressContainer.style.display = 'block';
                uploadProgressBarFill.style.width = '0%';
                uploadProgressText.textContent = '0%';
                uploadStatusText.textContent = 'Uploading...';
            }
            if (uploadButton) {
                uploadButton.disabled = true; // Disable upload button during upload
            }

            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('document_file', file);

            try {
                console.log("Attempting to upload document via API with progress tracking.");
                await apiRequest("POST", "/documents/upload", formData, true, (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        if (uploadProgressBarFill) uploadProgressBarFill.style.width = `${percentComplete}%`;
                        if (uploadProgressText) uploadProgressText.textContent = `${Math.round(percentComplete)}%`;
                        if (uploadStatusText) uploadStatusText.textContent = `Uploading: ${Math.round(percentComplete)}% Complete`;
                    }
                });
                showModalMessage("Document uploaded successfully!", false);

                // Clear form fields after successful upload
                documentTitleInput.value = "";
                documentFileInput.value = "";
                documentDescriptionInput.value = "";

                loadDocuments(); // Reload the list to show the new document
            } catch (error) {
                console.error("Error uploading document:", error);
                showModalMessage(`Error uploading document: ${error.message}`, true);
            } finally {
                // Hide progress bar and re-enable button after upload completes or fails
                if (uploadProgressContainer) uploadProgressContainer.style.display = 'none';
                if (uploadButton) uploadButton.disabled = false;
                uploadStatusText.textContent = 'Upload complete (or failed).'; // Reset status text
            }
        });
    }

    // Handle clicks for download and delete buttons using event delegation
    if (documentListDiv) {
        documentListDiv.addEventListener("click", async e => {
            const downloadButton = e.target.closest(".btn-download");
            const deleteButton = e.target.closest(".btn-delete");

            if (downloadButton) {
                const documentId = downloadButton.dataset.documentId;
                console.log(`Download button clicked for document ID: ${documentId}`);
                // Construct the download URL and trigger a download
                // Re-added mime_type to download route (will need to be fetched from DB again)
                const docInfo = await apiRequest("GET", `/documents/download/${documentId}`); // This is wrong, it should be a GET to /documents to get info, not /download
                if (docInfo && docInfo.file_path) { // Assuming docInfo contains necessary fields
                    window.location.href = `${API_BASE_URL}/documents/download/${documentId}`;
                } else {
                    // Correct approach: directly trigger download if mime type is re-added to documents GET route
                    window.location.href = `${API_BASE_URL}/documents/download/${documentId}`;
                }
            } else if (deleteButton) {
                const documentId = deleteButton.dataset.documentId;
                console.log(`Delete button clicked for document ID: ${documentId}`);
                const confirmed = await showConfirmModal("Are you sure you want to delete this document? This action cannot be undone.", "Delete");
                if (confirmed) {
                    try {
                        console.log(`Attempting to delete document ID: ${documentId} via API.`);
                        await apiRequest("DELETE", `/documents/${documentId}`);
                        showModalMessage("Document deleted successfully!", false);
                        loadDocuments(); // Reload list after deletion
                    } catch (error) {
                        console.error("Error deleting document:", error);
                        showModalMessage(`Error deleting document: ${error.message}`, true);
                    }
                }
            }
        });
    }

    // Initial load of documents when the page loads
    loadDocuments();
}


/**
 * Handles all client-side logic for the checklists.html page.
 */
function handleChecklistsPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }
    // Placeholder for actual checklists page logic
    console.log("Checklists page logic goes here. (Implementation pending)");
}

/**
 * Handles all client-side logic for the new-hire-view.html page.
 */
function handleNewHireViewPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }
    // Placeholder for actual new hire view page logic
    console.log("New Hire View page logic goes here. (Implementation pending)");
}


// --- Main Entry Point: Execute appropriate page handler on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    // Setup general UI elements like the settings dropdown that are present on many pages
    setupSettingsDropdown();

    // Route to specific page handlers based on the current URL
    const path = window.location.pathname;
    console.log("DOMContentLoaded: Current path is", path); // Debugging log to see which path is detected

    if (path.includes('login.html')) {
        handleLoginPage();
    } else if (path.includes('register.html')) {
        handleRegisterPage();
    } else if (path.includes('pricing.html')) {
        handlePricingPage();
    } else if (path.includes('suite-hub.html')) {
        handleSuiteHubPage();
    } else if (path.includes('account.html')) {
        handleAccountPage();
    } else if (path.includes('admin.html')) {
        handleAdminPage();
    } else if (path.includes('scheduling.html')) {
        handleSchedulingPage();
    } else if (path.includes('hiring.html')) {
        handleHiringPage();
    } else if (path.includes('dashboard.html')) {
        handleDashboardPage();
    } else if (path.includes('documents.html')) {
        handleDocumentsPage();
    } else if (path.includes('checklists.html')) {
        handleChecklistsPage();
    } else if (path.includes('new-hire-view.html')) {
        handleNewHireViewPage();
    }
    // For the root path ('/' or empty), or index.html, no specific handler might be needed beyond setupSettingsDropdown
    else if (path === '/' || path === '/index.html' || path === '') {
        console.log("Index or root page loaded.");
        // Add any specific logic for the landing page here if needed
    } else {
        console.warn(`No specific handler found for path: ${path}`);
    }
});
