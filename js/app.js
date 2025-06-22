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
    // Removed specific upgradePlanLink ID and logic here, as it's now handled by the backend routing or general visibility
    // The link should be shown/hidden based on server-side rendering or a different client-side check if needed.
    // However, if your HTML *still* contains an element with ID 'upgrade-plan-link' that you want dynamically controlled:
    const upgradePlanLink = document.getElementById("upgrade-plan-link");

    if (settingsButton && settingsDropdown) {
        settingsButton.addEventListener("click", async event => {
            event.stopPropagation(); // Prevent the document click from immediately closing it
            settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";

            // Conditional logic for "Upgrade Plan" visibility moved here if you want it client-side driven.
            // If the link is dynamically shown/hidden by the backend based on user role/plan, this block can be removed.
            if (settingsDropdown.style.display === "block" && upgradePlanLink) {
                if (localStorage.getItem("authToken")) {
                    try {
                        const profile = await apiRequest("GET", "/profile");
                        if (profile && profile.plan_id === 'free') { // Check if user is on free plan
                            upgradePlanLink.style.display = 'block';
                        } else {
                            upgradePlanLink.style.display = 'none'; // Hide if not free or profile fetch fails
                        }
                    } catch (error) {
                        console.error("Error fetching profile for upgrade link:", error);
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
 * @param {boolean} expectBlobResponse - Set to true if the API is expected to return a file (Blob).
 * @returns {Promise<object|Blob|null>} - JSON response data, Blob, or null if 204.
 * @throws {Error} - If the API response is not OK.
 */
async function apiRequest(method, path, body = null, isFormData = false, onProgress = null, expectBlobResponse = false) {
    const token = localStorage.getItem('authToken');
    const endpoint = `${API_BASE_URL}${path}`;

    // For FormData, use XMLHttpRequest for progress tracking
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
                            const responseData = JSON.parse(xhr.responseText);
                            resolve(responseData);
                        } catch (e) {
                            console.warn("API response was not JSON, resolving with success status:", xhr.responseText);
                            resolve({ message: "Operation successful", rawResponse: xhr.responseText });
                        }
                    }
                } else if (xhr.status === 401 || xhr.status === 403) {
                    // Unauthorized or Forbidden - clear token and redirect to login
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    window.location.href = 'login.html?sessionExpired=true';
                    reject(new Error('Authentication token missing or invalid.'));
                } else {
                    // Handle non-2xx responses
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error || `HTTP error! Status: ${xhr.status}`));
                    } catch (e) {
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
        // Use Fetch API for standard JSON or Blob requests
        const options = {
            method: method,
            headers: {} // Start with empty headers to add Content-Type conditionally
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        // Set Content-Type for JSON bodies on POST/PUT
        if (body && (method === 'POST' || method === 'PUT')) {
             options.headers['Content-Type'] = 'application/json';
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
            // Attempt to parse error as JSON, fallback to status text
            try {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            } catch (e) {
                throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText || 'Unknown Error'}`);
            }
        }

        // Special handling for file downloads: return blob instead of JSON
        if (expectBlobResponse) {
            return response.blob(); // Return the raw binary data as a Blob
        }

        if (response.status === 204 || (response.status === 200 && response.headers.get("content-length") === "0")) {
            return null;
        }

        // Default to JSON response
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
                showModalMessage(`Error inviting admin: ${error.message}`, true);
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
                showModalMessage(`Error inviting employee: ${error.message}`, true);
            }
        });
    }

    // Initial loads when the admin page loads
    loadLocations();
    loadUsers();
}
