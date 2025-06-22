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
 */
function setupSettingsDropdown() {
    const settingsButton = document.getElementById("settings-button");
    const settingsDropdown = document.getElementById("settings-dropdown");
    const logoutButton = document.getElementById("logout-button");
    const upgradePlanLink = document.getElementById("upgrade-plan-link");

    if (settingsButton && settingsDropdown) {
        settingsButton.addEventListener("click", async event => {
            event.stopPropagation(); // Prevent the document click from immediately closing it
            settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";

            // Conditional logic for "Upgrade Plan" visibility
            if (settingsDropdown.style.display === "block" && upgradePlanLink) {
                if (localStorage.getItem("authToken")) {
                    try {
                        const profile = await apiRequest("GET", "/profile");
                        if (profile && profile.plan_id === 'free') {
                            upgradePlanLink.style.display = 'block';
                        } else {
                            upgradePlanLink.style.display = 'none';
                        }
                    } catch (error) {
                        console.error("Error fetching profile for upgrade link:", error);
                        upgradePlanLink.style.display = 'none';
                    }
                } else {
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
                    // window.location.href = 'login.html?sessionExpired=true'; // Cannot redirect in sandbox
                    showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
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
            // window.location.href = 'login.html?sessionExpired=true'; // Cannot redirect in sandbox
            showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
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
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('sessionExpired') && urlParams.get('sessionExpired') === 'true') {
        const errorMessageDiv = document.getElementById("error-message");
        if (errorMessageDiv) {
            errorMessageDiv.textContent = 'Your session has expired or is invalid. Please log in again.';
            errorMessageDiv.classList.add('visible');
            errorMessageDiv.setAttribute('aria-hidden', 'false');
        }
        urlParams.delete('sessionExpired');
        window.history.replaceState({}, document.title, window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : ''));
    }


    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const errorMessage = document.getElementById("error-message");

        if (errorMessage) {
            errorMessage.textContent = "";
            errorMessage.classList.remove("visible");
            errorMessage.setAttribute('aria-hidden', 'true');
        }

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
            const data = await apiRequest("POST", "/login", {
                email: email,
                password: password
            });

            localStorage.setItem("authToken", data.token);
            localStorage.setItem("userRole", data.role);

            if (data.role === "super_admin" || data.role === "location_admin") {
                window.location.href = "suite-hub.html";
            } else {
                window.location.href = "new-hire-view.html";
            }
        } catch (error) {
            console.error("Login API error:", error);
            if (errorMessage) {
                errorMessage.textContent = `Login Failed: ${error.message}`;
                errorMessage.classList.add("visible");
                errorMessage.setAttribute('aria-hidden', 'false');
            }
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
        return;
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

        errorMessage.textContent = "";
        errorMessage.classList.remove("visible");
        errorMessage.setAttribute('aria-hidden', 'true');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!company_name || !full_name || !email || !password || password.length < 6 || !emailRegex.test(email)) {
            errorMessage.textContent = "Please fill all fields correctly. Password must be at least 6 characters and email valid.";
            errorMessage.classList.add("visible");
            return;
        }

        try {
            const data = await apiRequest("POST", "/register", {
                company_name: company_name,
                full_name: full_name,
                email: email,
                password: password
            });

            showModalMessage("Account created successfully! Please log in.", false);

            companyNameInput.value = "";
            fullNameInput.value = "";
            emailInput.value = "";
            passwordInput.value = "";

            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);
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
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get("payment");
    const sessionId = urlParams.get("session_id");

    if (paymentStatus === "success") {
        showModalMessage("Payment successful! Your subscription has been updated.", false);
        history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === "cancelled") {
        showModalMessage("Payment cancelled. You can try again or choose another plan.", true);
        history.replaceState({}, document.title, window.location.pathname);
    }
}

/**
 * Handles all client-side logic for the account.html page.
 */
function handleAccountPage() {
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

    async function loadProfileInfo() {
        try {
            const profile = await apiRequest("GET", "/profile");
            if (displayProfileName)
                displayProfileName.textContent = profile.fullName || "N/A";
            if (profileEmailInput)
                profileEmailInput.value = profile.email || "";
        } catch (error) {
            console.error("Error loading profile info:", error);
            showModalMessage(`Failed to load profile: ${error.message}`, true);
        }
    }

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
                if (result && result.token) {
                    localStorage.setItem("authToken", result.token);
                }
                showModalMessage(result.message || "Profile updated successfully!", false);
                if (currentPasswordInput)
                    currentPasswordInput.value = "";
                if (newPasswordInput)
                    newPasswordInput.value = "";
                loadProfileInfo();
            }
            catch (error) {
                console.error("Error updating profile:", error);
                showModalMessage(`Failed to update profile: ${error.message}`, true);
            }
        });
    }

    loadProfileInfo();
}


/**
 * Handles all client-side logic for the admin.html page.
 */
function handleAdminPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const locationListDiv = document.getElementById("location-list");
    const userListDiv = document.getElementById("user-list");
    const newLocationForm = document.getElementById("new-location-form");
    const inviteAdminForm = document.getElementById("invite-admin-form");
    const inviteEmployeeForm = document.getElementById("invite-employee-form");
    const adminLocationSelect = document.getElementById("admin-location-select");
    const employeeLocationSelect = document.getElementById("employee-location-select");

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
                if (employeeLocationSelect) {
                    employeeLocationSelect.innerHTML = '<option value="">Select a location</option>';
                    employeeLocationSelect.disabled = true;
                }
            } else {
                if (adminLocationSelect)
                    adminLocationSelect.disabled = false;
                if (employeeLocationSelect)
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

    async function loadUsers() {
        if (!userListDiv)
            return;
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
                    userListDiv.appendChild(userDiv);
                });
            }
        } catch (error) {
            console.error("Error loading users:", error);
            userListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading users: ${error.message}</p>`;
        }
    }

    document.body.addEventListener("click", async e => {
        const targetButton = e.target.closest(".btn-delete");
        if (targetButton) {
            const id = targetButton.dataset.id;
            const type = targetButton.dataset.type;
            const confirmationMessage = `Are you sure you want to delete this ${type}? This action cannot be undone.`;
            const confirmed = await showConfirmModal(confirmationMessage, "Delete");

            if (confirmed) {
                try {
                    if (type === "location") {
                        await apiRequest("DELETE", `/locations/${id}`);
                        showModalMessage("Location deleted successfully!", false);
                        loadLocations();
                        loadUsers();
                    } else if (type === "user") {
                        await apiRequest("DELETE", `/users/${id}`);
                        showModalMessage("User deleted successfully!", false);
                        loadUsers();
                    } else if (type === "document") {
                        await apiRequest("DELETE", `/documents/${id}`);
                        showModalMessage("Document deleted successfully!", false);
                        handleDocumentsPage();
                    } else if (type === "checklist") {
                        await apiRequest("DELETE", `/checklists/${id}`);
                        showModalMessage("Task list deleted successfully!", false);
                        handleChecklistsPage(); // Reload checklists if on checklists page
                    } else if (type === "job-posting") {
                        await apiRequest("DELETE", `/job-postings/${id}`);
                        showModalMessage("Job posting deleted successfully!", false);
                        handleHiringPage();
                    } else if (type === "schedule") {
                        await apiRequest("DELETE", `/schedules/${id}`);
                        showModalMessage("Schedule deleted successfully!", false);
                        handleSchedulingPage();
                    }
                } catch (error) {
                    showModalMessage(`Error deleting ${type}: ${error.message}`, true);
                }
            }
        } 
    });

    // Initial loads when the admin page loads
    loadLocations();
    loadUsers();
}

/**
 * Handles logic for the dashboard.html page (Onboarding Dashboard).
 */
function handleDashboardPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const onboardUserModal = document.getElementById("onboard-user-modal");
    const showOnboardModalBtn = document.getElementById("show-onboard-modal-btn");
    const modalCancelOnboardBtn = document.getElementById("modal-cancel-onboard");
    const onboardUserForm = document.getElementById("onboard-user-form");
    const newHirePositionSelect = document.getElementById("new-hire-position");
    const sessionListDiv = document.getElementById("session-list");

    if (showOnboardModalBtn) {
        showOnboardModalBtn.addEventListener("click", () => {
            if (onboardUserModal) {
                onboardUserModal.style.display = "flex";
            }
        });
    }

    if (modalCancelOnboardBtn) {
        modalCancelOnboardBtn.addEventListener("click", () => {
            if (onboardUserModal) {
                onboardUserModal.style.display = "none";
            }
        });
    }

    if (onboardUserModal) {
        onboardUserModal.addEventListener("click", event => {
            if (event.target === onboardUserModal) {
                onboardUserModal.style.display = "none";
            }
        });
    }

    async function loadPositions() {
        if (!newHirePositionSelect) return;
        newHirePositionSelect.innerHTML = '<option value="">Loading positions...</option>';
        try {
            const response = await apiRequest("GET", "/positions");
            newHirePositionSelect.innerHTML = '<option value="">Select Position</option>';
            if (response && response.positions && response.positions.length > 0) {
                response.positions.forEach(pos => {
                    const option = document.createElement("option");
                    option.value = pos.id;
                    option.textContent = pos.name;
                    newHirePositionSelect.appendChild(option);
                });
            } else {
                newHirePositionSelect.innerHTML = '<option value="">No positions available</option>';
            }
        } catch (error) {
            console.error("Error loading positions:", error);
            newHirePositionSelect.innerHTML = '<option value="">Error loading positions</option>';
            showModalMessage(`Failed to load positions: ${error.message}`, true);
        }
    }

    async function loadOnboardingSessions() {
        if (!sessionListDiv) return;
        sessionListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading active onboardings...</p>';
        try {
            const sessions = await apiRequest("GET", "/onboarding-sessions");
            sessionListDiv.innerHTML = '';
            if (sessions && sessions.length > 0) {
                sessions.forEach(session => {
                    const sessionItem = document.createElement("div");
                    sessionItem.className = "onboarding-item";
                    let completionStatus = session.completedTasks === session.totalTasks ? 'Completed' : `${session.completedTasks}/${session.totalTasks} Tasks Completed`;
                    let statusColor = session.completedTasks === session.totalTasks ? 'var(--primary-accent)' : 'var(--text-medium)';

                    sessionItem.innerHTML = `
                        <div class="onboarding-item-info">
                            <p style="color: var(--text-light); font-weight: 600;">${session.full_name} (${session.position || 'N/A'})</p>
                            <p style="color: var(--text-medium);">Email: ${session.email}</p>
                            <p style="color: ${statusColor};">Status: ${completionStatus}</p>
                        </div>
                        <div class="onboarding-item-actions">
                            <button class="btn btn-secondary btn-sm view-details-btn" data-user-id="${session.user_id}">View Progress</button>
                            ${session.completedTasks === session.totalTasks ?
                                `<button class="btn btn-primary btn-sm archive-onboarding-btn" data-session-id="${session.session_id}">Archive</button>` : ''}
                        </div>
                    `;
                    sessionListDiv.appendChild(sessionItem);
                });

                sessionListDiv.querySelectorAll('.view-details-btn').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const userId = event.target.dataset.userId;
                        window.location.href = `new-hire-view.html?userId=${userId}`;
                    });
                });

                sessionListDiv.querySelectorAll('.archive-onboarding-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const sessionId = event.target.dataset.sessionId;
                        const confirmed = await showConfirmModal('Are you sure you want to archive this onboarding session?');
                        if (confirmed) {
                            try {
                                await apiRequest("PUT", `/onboarding-sessions/${sessionId}/archive`);
                                showModalMessage('Onboarding session archived successfully!', false);
                                loadOnboardingSessions();
                            } catch (error) {
                                showModalMessage(`Failed to archive session: ${error.message}`, true);
                            }
                        }
                    });
                });


            } else {
                sessionListDiv.innerHTML = '<p style="color: var(--text-medium);">No active onboardings.</p>';
            }
        } catch (error) {
            console.error("Error loading onboarding sessions:", error);
            sessionListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading onboarding sessions: ${error.message}</p>`;
        }
    }

    if (onboardUserForm) {
        onboardUserForm.addEventListener("submit", async e => {
            e.preventDefault();
            const newHireName = document.getElementById("new-hire-name").value.trim();
            const newHireEmail = document.getElementById("new-hire-email").value.trim();
            const newHirePosition = newHirePositionSelect ? newHirePositionSelect.value : "";
            const newHireId = document.getElementById("new-hire-id").value.trim();

            if (!newHireName || !newHireEmail || !newHirePosition) {
                showModalMessage("Please fill all required fields: Full Name, Email, and Position.", true);
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newHireEmail)) {
                showModalMessage("Please enter a valid email address.", true);
                return;
            }

            try {
                const response = await apiRequest("POST", "/onboard-employee", {
                    full_name: newHireName,
                    email: newHireEmail,
                    position_id: newHirePosition,
                    employee_id: newHireId || null
                });

                showModalMessage(`Onboarding invite sent to ${newHireEmail} for position ${newHirePosition}.`, false);
                onboardUserForm.reset();
                if (onboardUserModal) onboardUserModal.style.display = "none";
                loadOnboardingSessions();
            } catch (error) {
                showModalMessage(`Error onboarding employee: ${error.message}`, true);
            }
        });
    }

    loadPositions();
    loadOnboardingSessions();
}


/**
 * Handles logic for checklists.html page.
 */
function handleChecklistsPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const checklistListDiv = document.getElementById("checklist-list");
    const newChecklistForm = document.getElementById("new-checklist-form");
    const structureTypeSelect = document.getElementById("structure-type-select");
    const timeGroupCountContainer = document.getElementById("time-group-count-container");
    const timeGroupCountInput = document.getElementById("time-group-count");
    const timeGroupCountLabel = document.getElementById("time-group-count-label");
    const tasksInputArea = document.getElementById("tasks-input-area");

    // Elements for the Edit Checklist Modal
    const editChecklistModalOverlay = document.getElementById("edit-checklist-modal-overlay");
    const editChecklistIdInput = document.getElementById("edit-checklist-id");
    const editChecklistPositionInput = document.getElementById("edit-checklist-position");
    const editChecklistTitleInput = document.getElementById("edit-checklist-title");
    const editStructureTypeSelect = document.getElementById("edit-structure-type-select");
    const editTimeGroupCountContainer = document.getElementById("edit-time-group-count-container");
    const editTimeGroupCountInput = document.getElementById("edit-time-group-count");
    const editTimeGroupCountLabel = document.getElementById("edit-time-group-count-label");
    const editTasksInputArea = document.getElementById("edit-tasks-input-area");
    const addEditTaskBtn = document.getElementById("add-edit-task-btn");
    const editChecklistCancelBtn = document.getElementById("edit-checklist-cancel-btn");
    const editChecklistForm = document.getElementById("edit-checklist-form");


    let taskCounter = 0; // For new checklist creation
    let editTaskCounter = 0; // For edit checklist modal

    /**
     * Adds a single task input field.
     * @param {HTMLElement} container - The container to add the input to.
     * @param {string|number} taskId - Optional ID for the task input. Used primarily for existing tasks.
     * @param {string} taskText - Optional initial text for the task.
     * @param {boolean} isCompleted - Optional initial completed status for the task. (Note: currently tasks are always saved as `completed:false` from edit modal for simplicity).
     */
    function addSingleTaskInput(container, taskId = null, taskText = '', isCompleted = false) {
        const div = document.createElement('div');
        div.className = 'form-group task-input-group';
        // Use a unique ID for the input field to prevent conflicts across multiple forms/modals
        const uniqueInputId = `task-input-${container.id}-${taskId || (container.id === 'tasks-input-area' ? taskCounter++ : editTaskCounter++)}`;
        div.innerHTML = `
            <label for="${uniqueInputId}">Task Description</label>
            <input type="text" id="${uniqueInputId}" class="task-description-input" value="${taskText}" placeholder="e.g., Complete HR paperwork" required>
            <button type="button" class="btn btn-secondary remove-task-btn" style="margin-top: 5px;">Remove</button>
        `;
        container.appendChild(div);

        div.querySelector('.remove-task-btn').addEventListener('click', () => {
            div.remove();
        });
    }

    // Function to dynamically render task input fields for the NEW checklist form
    function renderNewChecklistTaskInputs() {
        tasksInputArea.innerHTML = ''; // Clear previous inputs
        const structureType = structureTypeSelect.value;
        const groupCount = parseInt(timeGroupCountInput.value, 10) || 1;

        if (structureType === 'single_list') {
            addSingleTaskInput(tasksInputArea);
            const addTaskBtn = document.createElement('button');
            addTaskBtn.type = 'button';
            addTaskBtn.className = 'btn btn-secondary';
            addTaskBtn.textContent = 'Add Another Task +';
            addTaskBtn.style.marginTop = '10px';
            addTaskBtn.addEventListener('click', () => addSingleTaskInput(tasksInputArea));
            tasksInputArea.appendChild(addTaskBtn);
        } else {
            for (let i = 0; i < groupCount; i++) {
                const groupTitle = structureType === 'daily' ? `Day ${i + 1}` : `Week ${i + 1}`;
                const groupContainer = document.createElement('div');
                groupContainer.className = 'card time-group-container';
                groupContainer.innerHTML = `
                    <h4 style="color: var(--text-light); margin-top: 0;'>${groupTitle}</h4>
                    <div class="tasks-in-group" data-group-index="${i}"></div>
                    <button type="button" class="btn btn-secondary add-task-to-group-btn" style="margin-top: 10px;" data-group-index="${i}">Add Task to ${groupTitle} +</button>
                `;
                tasksInputArea.appendChild(groupContainer);

                const tasksInGroupDiv = groupContainer.querySelector('.tasks-in-group');
                addSingleTaskInput(tasksInGroupDiv); // Add one task by default

                groupContainer.querySelector('.add-task-to-group-btn').addEventListener('click', (event) => {
                    const targetGroupIndex = event.target.dataset.groupIndex;
                    const targetGroupDiv = tasksInputArea.querySelector(`.tasks-in-group[data-group-index="${targetGroupIndex}"]`);
                    if (targetGroupDiv) {
                        addSingleTaskInput(targetGroupDiv);
                    }
                });
            }
        }
    }

    // Function to dynamically render task input fields for the EDIT checklist form
    function renderEditChecklistTaskInputs(tasksData, structureType, groupCount) {
        editTasksInputArea.innerHTML = ''; // Clear previous inputs
        editTaskCounter = 0; // Reset counter for edit modal

        if (structureType === 'single_list') {
            if (tasksData && tasksData.length > 0) {
                tasksData.forEach(task => {
                    addSingleTaskInput(editTasksInputArea, task.id, task.description, task.completed);
                });
            } else {
                addSingleTaskInput(editTasksInputArea); // Add at least one empty task input
            }
        } else { // 'daily' or 'weekly'
            for (let i = 0; i < groupCount; i++) {
                const groupTitle = structureType === 'daily' ? `Day ${i + 1}` : `Week ${i + 1}`;
                const groupContainer = document.createElement('div');
                groupContainer.className = 'card time-group-container';
                groupContainer.innerHTML = `
                    <h4 style="color: var(--text-light); margin-top: 0;'>${groupTitle}</h4>
                    <div class="tasks-in-group" data-group-index="${i}"></div>
                    <button type="button" class="btn btn-secondary add-task-to-group-btn" style="margin-top: 10px;" data-group-index="${i}">Add Task to ${groupTitle} +</button>
                `;
                editTasksInputArea.appendChild(groupContainer);

                const tasksInGroupDiv = groupContainer.querySelector('.tasks-in-group');
                const currentGroupTasks = tasksData[i] && tasksData[i].tasks ? tasksData[i].tasks : [];

                if (currentGroupTasks.length > 0) {
                    currentGroupTasks.forEach(task => {
                        addSingleTaskInput(tasksInGroupDiv, task.id, task.description, task.completed);
                    });
                } else {
                    addSingleTaskInput(tasksInGroupDiv); // Add at least one empty task input
                }

                groupContainer.querySelector('.add-task-to-group-btn').addEventListener('click', (event) => {
                    const targetGroupIndex = event.target.dataset.groupIndex;
                    const targetGroupDiv = editTasksInputArea.querySelector(`.tasks-in-group[data-group-index="${targetGroupIndex}"]`);
                    if (targetGroupDiv) {
                        addSingleTaskInput(targetGroupDiv);
                    }
                });
            }
        }
    }


    // Event listener for structure type change (for NEW checklist form)
    if (structureTypeSelect) {
        structureTypeSelect.addEventListener('change', () => {
            const type = structureTypeSelect.value;
            if (type === 'daily' || type === 'weekly') {
                timeGroupCountContainer.style.display = 'block';
                timeGroupCountLabel.textContent = `Number of ${type === 'daily' ? 'Days' : 'Weeks'}`;
            } else {
                timeGroupCountContainer.style.display = 'none';
            }
            renderNewChecklistTaskInputs(); // Re-render tasks based on new structure
        });
    }

    // Event listener for time group count change (for NEW checklist form)
    if (timeGroupCountInput) {
        timeGroupCountInput.addEventListener('input', renderNewChecklistTaskInputs);
    }

    // Initial render of task inputs for NEW checklist form
    renderNewChecklistTaskInputs();

    /**
     * Loads and displays existing task lists.
     */
    async function loadChecklists() {
        if (!checklistListDiv) return;
        checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading task lists...</p>';
        try {
            const checklists = await apiRequest("GET", "/checklists");
            checklistListDiv.innerHTML = '';
            if (checklists && checklists.length > 0) {
                checklists.forEach(checklist => {
                    const checklistItem = document.createElement("div");
                    checklistItem.className = "checklist-item";
                    checklistItem.innerHTML = `
                        <div class="checklist-item-title">
                            <span style="color: var(--primary-accent);">${checklist.position}</span>
                            <span>- ${checklist.title}</span>
                            <span style="font-size: 0.8em; color: var(--text-medium);">(${checklist.structure_type})</span>
                        </div>
                        <div class="checklist-item-actions">
                            <button class="btn btn-secondary btn-sm view-checklist-btn" data-checklist-id="${checklist.id}">View/Edit</button>
                            <button class="btn-delete" data-type="checklist" data-id="${checklist.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    checklistListDiv.appendChild(checklistItem);
                });

                // --- Event Delegation for Checklist Items ---
                // We attach a single click listener to the parent container (checklistListDiv)
                // and then determine which button was clicked based on its class.
                checklistListDiv.addEventListener('click', async (event) => {
                    const viewButton = event.target.closest('.view-checklist-btn');
                    const deleteButton = event.target.closest('.btn-delete[data-type="checklist"]');

                    if (viewButton) {
                        event.stopPropagation(); // Prevent clicks on view button from bubbling up
                        const checklistId = viewButton.dataset.checklistId;
                        
                        // Fetch checklist details and open the edit modal
                        try {
                            const checklistDetails = await apiRequest("GET", `/checklists/${checklistId}`);
                            if (checklistDetails) {
                                editChecklistIdInput.value = checklistDetails.id;
                                editChecklistPositionInput.value = checklistDetails.position;
                                editChecklistTitleInput.value = checklistDetails.title;
                                editStructureTypeSelect.value = checklistDetails.structure_type;

                                // Show/hide time group count based on structure type
                                if (checklistDetails.structure_type === 'daily' || checklistDetails.structure_type === 'weekly') {
                                    editTimeGroupCountContainer.style.display = 'block';
                                    editTimeGroupCountInput.value = checklistDetails.group_count;
                                    editTimeGroupCountLabel.textContent = `Number of ${checklistDetails.structure_type === 'daily' ? 'Days' : 'Weeks'}`;
                                } else {
                                    editTimeGroupCountContainer.style.display = 'none';
                                }
                                
                                // Render tasks in the edit modal
                                renderEditChecklistTaskInputs(checklistDetails.tasks, checklistDetails.structure_type, checklistDetails.group_count);

                                editChecklistModalOverlay.style.display = 'flex'; // Show the modal
                            } else {
                                showModalMessage('Checklist details not found.', true);
                            }
                        } catch (error) {
                            console.error('Error fetching checklist details:', error);
                            showModalMessage(`Failed to load checklist details: ${error.message}`, true);
                        }

                    } else if (deleteButton) {
                        event.stopPropagation(); // Prevent clicks on delete button from bubbling up
                        const checklistId = deleteButton.dataset.id;
                        const confirmed = await showConfirmModal(`Are you sure you want to delete this task list? This action cannot be undone.`, "Delete");
                        if (confirmed) {
                            try {
                                await apiRequest("DELETE", `/checklists/${checklistId}`);
                                showModalMessage("Task list deleted successfully!", false);
                                loadChecklists(); // Reload the list after deletion
                            } catch (error) {
                                showModalMessage(`Failed to delete task list: ${error.message}`, true);
                            }
                        }
                    }
                });

            } else {
                checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">No task lists created yet.</p>';
            }
        } catch (error) {
            console.error("Error loading checklists:", error);
            checklistListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading task lists: ${error.message}</p>`;
        }
    }

    // Event listeners for the NEW checklist form submission
    if (newChecklistForm) {
        newChecklistForm.addEventListener("submit", async e => {
            e.preventDefault();
            const position = document.getElementById("new-checklist-position").value.trim();
            const title = document.getElementById("new-checklist-title").value.trim();
            const structure_type = structureTypeSelect.value;
            const group_count = (structure_type === 'daily' || structure_type === 'weekly') ? parseInt(timeGroupCountInput.value, 10) : 0;

            let tasks = [];
            if (structure_type === 'single_list') {
                document.querySelectorAll('#tasks-input-area .task-description-input').forEach(input => {
                    if (input.value.trim()) {
                        tasks.push({ description: input.value.trim(), completed: false });
                    }
                });
            } else {
                document.querySelectorAll('#tasks-input-area .tasks-in-group').forEach((groupDiv, index) => {
                    const groupTasks = [];
                    groupDiv.querySelectorAll('.task-description-input').forEach(input => {
                        if (input.value.trim()) {
                            groupTasks.push({ description: input.value.trim(), completed: false });
                        }
                    });
                    tasks.push({
                        groupTitle: structure_type === 'daily' ? `Day ${index + 1}` : `Week ${index + 1}`,
                        tasks: groupTasks
                    });
                });
            }

            if (!position || !title || tasks.length === 0 || (structure_type !== 'single_list' && tasks.every(group => group.tasks.length === 0))) {
                showModalMessage("Please provide a position, title, and at least one task for the checklist.", true);
                return;
            }

            try {
                const response = await apiRequest("POST", "/checklists", {
                    position: position,
                    title: title,
                    structure_type: structure_type,
                    group_count: group_count,
                    tasks: tasks
                });

                showModalMessage(`Task List "${title}" created successfully!`, false);
                newChecklistForm.reset();
                renderNewChecklistTaskInputs(); // Reset task inputs for new form
                loadChecklists(); // Reload the list of checklists
            } catch (error) {
                showModalMessage(`Error creating task list: ${error.message}`, true);
            }
        });
    }

    // Event listeners for EDIT checklist modal
    if (editChecklistCancelBtn) {
        editChecklistCancelBtn.addEventListener('click', () => {
            editChecklistModalOverlay.style.display = 'none';
        });
    }

    if (editChecklistModalOverlay) {
        editChecklistModalOverlay.addEventListener('click', (event) => {
            if (event.target === editChecklistModalOverlay) {
                editChecklistModalOverlay.style.display = 'none';
            }
        });
    }

    if (editStructureTypeSelect) {
        editStructureTypeSelect.addEventListener('change', () => {
            const type = editStructureTypeSelect.value;
            if (type === 'daily' || type === 'weekly') {
                editTimeGroupCountContainer.style.display = 'block';
                editTimeGroupCountInput.value = '1'; // Reset to 1 when changing type
                editTimeGroupCountLabel.textContent = `Number of ${type === 'daily' ? 'Days' : 'Weeks'}`;
            } else {
                editTimeGroupCountContainer.style.display = 'none';
            }
            renderEditChecklistTaskInputs([], type, parseInt(editTimeGroupCountInput.value, 10)); // Re-render tasks based on new structure
        });
    }

    if (editTimeGroupCountInput) {
        editTimeGroupCountInput.addEventListener('input', () => {
            renderEditChecklistTaskInputs([], editStructureTypeSelect.value, parseInt(editTimeGroupCountInput.value, 10));
        });
    }

    if (addEditTaskBtn) {
        addEditTaskBtn.addEventListener('click', () => {
            const structureType = editStructureTypeSelect.value;
            if (structureType === 'single_list') {
                addSingleTaskInput(editTasksInputArea);
            } else {
                const lastGroup = editTasksInputArea.querySelector('.tasks-in-group:last-child');
                if (lastGroup) {
                    addSingleTaskInput(lastGroup);
                } else {
                    // This scenario should ideally not happen if groups are always rendered.
                    // But as a fallback, add to the main area.
                    addSingleTaskInput(editTasksInputArea);
                }
            }
        });
    }

    if (editChecklistForm) {
        editChecklistForm.addEventListener("submit", async e => {
            e.preventDefault();
            const checklistId = editChecklistIdInput.value;
            const position = editChecklistPositionInput.value.trim();
            const title = editChecklistTitleInput.value.trim();
            const structure_type = editStructureTypeSelect.value;
            const group_count = (structure_type === 'daily' || structure_type === 'weekly') ? parseInt(editTimeGroupCountInput.value, 10) : 0;

            let tasks = [];
            if (structure_type === 'single_list') {
                editTasksInputArea.querySelectorAll('.task-description-input').forEach(input => {
                    if (input.value.trim()) {
                        tasks.push({ description: input.value.trim(), completed: false }); // Assume not completed on edit for simplicity, or add checkbox
                    }
                });
            } else {
                editTasksInputArea.querySelectorAll('.tasks-in-group').forEach((groupDiv, index) => {
                    const groupTasks = [];
                    groupDiv.querySelectorAll('.task-description-input').forEach(input => {
                        if (input.value.trim()) {
                            groupTasks.push({ description: input.value.trim(), completed: false });
                        }
                    });
                    tasks.push({
                        groupTitle: structure_type === 'daily' ? `Day ${index + 1}` : `Week ${index + 1}`,
                        tasks: groupTasks
                    });
                });
            }

            if (!position || !title || tasks.length === 0 || (structure_type !== 'single_list' && tasks.every(group => group.tasks.length === 0))) {
                showModalMessage("Please provide a position, title, and at least one task for the checklist.", true);
                return;
            }

            try {
                await apiRequest("PUT", `/checklists/${checklistId}`, {
                    position: position,
                    title: title,
                    structure_type: structure_type,
                    group_count: group_count,
                    tasks: tasks
                });

                showModalMessage(`Task List "${title}" updated successfully!`, false);
                editChecklistModalOverlay.style.display = 'none'; // Hide modal
                loadChecklists(); // Reload the list of checklists
            } catch (error) {
                showModalMessage(`Error updating task list: ${error.message}`, true);
            }
        });
    }


    loadChecklists(); // Initial load of checklists when the page loads
}

/**
 * Handles logic for new-hire-view.html (Employee Onboarding View).
 */
function handleNewHireViewPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const welcomeHeading = document.getElementById("welcome-heading");
    const taskListSection = document.getElementById("task-list-section");
    const logoutButton = document.getElementById("logout-button");
    const completionCelebration = document.getElementById("completion-celebration");

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            localStorage.removeItem("authToken");
            localStorage.removeItem("userRole");
            window.location.href = "login.html";
        });
    }

    function triggerFireworks() {
        console.log("Triggering fireworks celebration!");
        if (completionCelebration) {
            completionCelebration.style.display = 'flex';
            setTimeout(() => {
                completionCelebration.style.display = 'none';
            }, 5000);
        }
    }

    async function loadOnboardingTasks() {
        if (!taskListSection) return;
        taskListSection.innerHTML = '<p style="color: var(--text-medium);">Loading your tasks...</p>';
        try {
            const profile = await apiRequest("GET", "/profile");
            if (!profile || !profile.user_id) {
                taskListSection.innerHTML = '<p style="color: #e74c3c;">Could not load user profile.</p>';
                return;
            }
            welcomeHeading.textContent = `Welcome, ${profile.full_name}!`;

            const tasksData = await apiRequest("GET", `/onboarding-tasks/${profile.user_id}`);

            taskListSection.innerHTML = '';

            if (tasksData && tasksData.checklist && tasksData.checklist.tasks) {
                const checklist = tasksData.checklist;
                let allTasksCompleted = true;

                if (checklist.structure_type === 'single_list') {
                    tasksData.tasks.forEach(task => {
                        const taskItem = document.createElement("div");
                        taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
                        taskItem.innerHTML = `
                            <input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''} data-task-id="${task.id}" data-task-type="single">
                            <label for="task-${task.id}">${task.description}</label>
                        `;
                        taskListSection.appendChild(taskItem);
                        if (!task.completed) allTasksCompleted = false;
                    });
                } else {
                    tasksData.tasks.forEach((group, groupIndex) => {
                        const taskGroupDetails = document.createElement('details');
                        taskGroupDetails.className = 'task-group';
                        taskGroupDetails.open = true;

                        const summary = document.createElement('summary');
                        summary.textContent = group.groupTitle;
                        taskGroupDetails.appendChild(summary);

                        group.tasks.forEach(task => {
                            const taskItem = document.createElement("div");
                            taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
                            taskItem.innerHTML = `
                                <input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''} data-task-id="${task.id}" data-task-type="grouped" data-group-index="${groupIndex}">
                                <label for="task-${task.id}">${task.description}</label>
                            `;
                            taskGroupDetails.appendChild(taskItem);
                            if (!task.completed) allTasksCompleted = false;
                        });
                        taskListSection.appendChild(taskGroupDetails);
                    });
                }

                taskListSection.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    checkbox.addEventListener('change', async (event) => {
                        const taskId = event.target.dataset.taskId;
                        const isCompleted = event.target.checked;
                        const taskType = event.target.dataset.taskType;
                        const groupIndex = event.target.dataset.groupIndex;

                        try {
                            await apiRequest("PUT", `/onboarding-tasks/${taskId}`, { completed: isCompleted, type: taskType, groupIndex: groupIndex });
                            event.target.closest('.task-item').classList.toggle('completed', isCompleted);
                            showModalMessage('Task status updated successfully!', false);
                            let currentAllTasksCompleted = true;
                            taskListSection.querySelectorAll('.task-item').forEach(item => {
                                if (!item.classList.contains('completed')) {
                                    currentAllTasksCompleted = false;
                                }
                            });
                            if (currentAllTasksCompleted) {
                                triggerFireworks();
                            }
                        } catch (error) {
                            showModalMessage(`Failed to update task status: ${error.message}`, true);
                            event.target.checked = !isCompleted;
                        }
                    });
                });

                if (allTasksCompleted) {
                    triggerFireworks();
                }

            } else {
                taskListSection.innerHTML = '<p style="color: var(--text-medium);">No onboarding tasks assigned or found.</p>';
            }
        } catch (error) {
            console.error("Error loading onboarding tasks:", error);
            taskListSection.innerHTML = `<p style="color: #e74c3c;">Error loading tasks: ${error.message}</p>`;
        }
    }

    loadOnboardingTasks();
}

/**
 * Handles logic for pricing.html page.
 */
function handlePricingPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const showRegisterCheckout = urlParams.get("registerCheckout");
    const selectedPlanId = urlParams.get("plan");

    const registerCheckoutModalOverlay = document.getElementById("register-checkout-modal-overlay");
    const registerCheckoutModalTitle = document.getElementById("register-checkout-modal-title");
    const registerCheckoutForm = document.getElementById("register-checkout-form");
    const regCoNameInput = document.getElementById("reg-co-name");
    const regFullNameInput = document.getElementById("reg-full-name");
    const regEmailInput = document.getElementById("reg-email");
    const regPasswordInput = document.getElementById("reg-password");
    const regCheckoutCancelBtn = document.getElementById("reg-checkout-cancel-btn");
    const regCheckoutErrorMessage = document.getElementById("register-checkout-error-message");

    let currentSelectedPlan = null;

    function openRegisterCheckoutModal(planId) {
        if (registerCheckoutModalOverlay && registerCheckoutModalTitle && registerCheckoutForm) {
            currentSelectedPlan = planId;
            registerCheckoutModalTitle.textContent = `Sign Up & Subscribe to ${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`;
            registerCheckoutModalOverlay.style.display = 'flex';
            regCheckoutErrorMessage.textContent = '';
            regCheckoutErrorMessage.classList.remove('visible');
            regCheckoutErrorMessage.setAttribute('aria-hidden', 'true');
        }
    }

    if (showRegisterCheckout === 'true' && selectedPlanId) {
        openRegisterCheckoutModal(selectedPlanId);
        history.replaceState({}, document.title, window.location.pathname);
    }

    const freePlanBtn = document.getElementById("free-plan-btn");
    const proPlanBtn = document.getElementById("pro-plan-btn");
    const enterprisePlanBtn = document.getElementById("enterprise-plan-btn");

    if (freePlanBtn) {
        freePlanBtn.addEventListener("click", async () => {
            const userRole = localStorage.getItem("userRole"); 
            if (userRole) {
                const profile = await apiRequest("GET", "/profile");
                if (profile && profile.plan_id === 'free') {
                    showModalMessage("You are already on the Free plan.", false);
                } else {
                    const confirmed = await showConfirmModal("Are you sure you want to downgrade to the Free plan? Your current subscription will be cancelled.", "Downgrade");
                    if (confirmed) {
                        try {
                            await apiRequest("POST", "/cancel-subscription");
                            showModalMessage("Successfully downgraded to Free plan. Your subscription will be updated.", false);
                            setTimeout(() => { window.location.href = 'suite-hub.html'; }, 1500);
                        }
                        catch (error) {
                            showModalMessage(`Failed to downgrade: ${error.message}`, true);
                        }
                    }
                }
            } else {
                showModalMessage("The Free plan is available upon regular sign-up.", false);
                setTimeout(() => { window.location.href = 'register.html'; }, 1500);
            }
        });
    }

    if (proPlanBtn) {
        proPlanBtn.addEventListener("click", () => handlePlanSelection("pro"));
    }
    if (enterprisePlanBtn) {
        enterprisePlanBtn.addEventListener("click", () => handlePlanSelection("enterprise"));
    }

    async function handlePlanSelection(planId) {
        const token = localStorage.getItem("authToken");
        if (token) {
            try {
                const session = await apiRequest("POST", "/create-checkout-session", { planId: planId });
                if (stripe && session.sessionId) {
                    showModalMessage("Account created! Redirecting to payment...", false);
                    stripe.redirectToCheckout({ sessionId: session.sessionId });
                } else {
                    showModalMessage("Account created, but failed to initiate payment. Please log in and try upgrading your plan from My Account.", true);
                }
            } catch (error) {
                console.error("Error creating checkout session:", error);
                showModalMessage(`Failed to proceed with payment: ${error.message}`, true);
            }
        };
    }

    if (regCheckoutCancelBtn) {
        regCheckoutCancelBtn.addEventListener("click", () => {
            if (registerCheckoutModalOverlay) {
                registerCheckoutModalOverlay.style.display = 'none';
                currentSelectedPlan = null;
            }
        });
    }
    if (regCheckoutModalOverlay) {
        regCheckoutModalOverlay.addEventListener("click", event => {
            if (event.target === regCheckoutModalOverlay) {
                registerCheckoutModalOverlay.style.display = "none";
                currentSelectedPlan = null;
            }
        });
    }


    if (registerCheckoutForm) {
        registerCheckoutForm.addEventListener("submit", async e => {
            e.preventDefault();
            const company_name = regCoNameInput.value.trim();
            const full_name = regFullNameInput.value.trim();
            const email = regEmailInput.value.trim();
            const password = regPasswordInput.value;

            regCheckoutErrorMessage.textContent = "";
            regCheckoutErrorMessage.classList.remove('visible');
            regCheckoutErrorMessage.setAttribute('aria-hidden', 'true');

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!company_name || !full_name || !email || !password || password.length < 6 || !emailRegex.test(email)) {
                regCheckoutErrorMessage.textContent = "Please fill all fields correctly. Password must be at least 6 characters and email valid.";
                regCheckoutErrorMessage.classList.add('visible');
                regCheckoutErrorMessage.setAttribute('aria-hidden', 'false');
                return;
            }

            try {
                const registrationData = await apiRequest("POST", "/register", {
                    company_name: company_name,
                    full_name: full_name,
                    email: email,
                    password: password
                });

                const loginData = await apiRequest("POST", "/login", {
                    email: email,
                    password: password
                });
                localStorage.setItem("authToken", loginData.token);
                localStorage.setItem("userRole", loginData.role);

                const session = await apiRequest("POST", "/create-checkout-session", { planId: currentSelectedPlan });
                if (stripe && session.sessionId) {
                    showModalMessage("Account created! Redirecting to payment...", false);
                    stripe.redirectToCheckout({ sessionId: session.sessionId });
                } else {
                    showModalMessage("Account created, but failed to initiate payment. Please log in and try upgrading your plan from My Account.", true);
                    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
                }

            } catch (error) {
                console.error("Register/Checkout error:", error);
                regCheckoutErrorMessage.textContent = `Sign Up Failed: ${error.message}`;
                regCheckoutErrorMessage.classList.add('visible');
                regCheckoutErrorMessage.setAttribute('aria-hidden', 'false');
                showModalMessage(`Sign Up Failed: ${error.message}`, true);
            }
        });
    }
}

/**
 * Handles all client-side logic for the hiring.html page.
 */
function handleHiringPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const createJobPostingForm = document.getElementById("create-job-posting-form");
    const jobPostingListDiv = document.getElementById("job-posting-list");
    const applicantListDiv = document.getElementById("applicant-list");
    const jobPostingLocationSelect = document.getElementById("job-posting-location-select");
    const filterApplicantJobPostingSelect = document.getElementById("filter-applicant-job-posting-select");
    const filterApplicantStatusSelect = document.getElementById("filter-applicant-status");
    const filterApplicantLocationSelect = document.getElementById("filter-applicant-location-select");
    const applyApplicantFiltersBtn = document.getElementById("apply-applicant-filters-btn");
    const clearApplicantFiltersBtn = document.getElementById("clear-applicant-filters-btn");

    const shareLinkModalOverlay = document.getElementById("share-link-modal-overlay");
    const shareJobLinkInput = document.getElementById("share-job-link-input");
    const shareJobEmbedCodeInput = document.getElementById("share-job-embed-code-input");
    const copyLinkBtn = document.getElementById("copy-link-btn");
    const copyEmbedBtn = document.getElementById("copy-embed-btn");
    const shareLinkModalCloseButton = document.getElementById("share-link-modal-close-button");


    async function loadJobPostingLocations() {
        if (!jobPostingLocationSelect) return;
        jobPostingLocationSelect.innerHTML = '<option value="">Loading locations...</option>';
        try {
            const locations = await apiRequest("GET", "/locations");
            jobPostingLocationSelect.innerHTML = '<option value="">Company Wide (All Locations)</option>'; // Default option
            if (locations && locations.length > 0) {
                locations.forEach(loc => {
                    const option = document.createElement("option");
                    option.value = loc.location_id;
                    option.textContent = loc.location_name;
                    jobPostingLocationSelect.appendChild(option);
                });
            } else {
                jobPostingLocationSelect.innerHTML = '<option value="">No locations available</option>';
            }
            filterApplicantLocationSelect.innerHTML = jobPostingLocationSelect.innerHTML; // Copy options to filter dropdown
        } catch (error) {
            console.error("Error loading job posting locations:", error);
            jobPostingLocationSelect.innerHTML = '<option value="">Error loading locations</option>';
            filterApplicantLocationSelect.innerHTML = '<option value="">Error loading locations</option>';
            showModalMessage(`Failed to load locations for job postings: ${error.message}`, true);
        }
    }

    async function loadJobPostings() {
        if (!jobPostingListDiv) return;
        jobPostingListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading job postings...</p>';
        try {
            const queryParams = new URLSearchParams();
            if (filterApplicantJobPostingSelect.value) { // This filter is for applicants, not job postings directly
                // Not filtering loadJobPostings directly by ID from applicant filter
            }
            // For now, only show 'Open' jobs on the main list unless otherwise specified
            queryParams.append('status', 'Open'); // Fetch only open jobs by default for this list

            const jobPostings = await apiRequest("GET", `/job-postings?${queryParams.toString()}`);
            jobPostingListDiv.innerHTML = '';
            filterApplicantJobPostingSelect.innerHTML = '<option value="">All Job Postings</option>'; // Reset applicant filter

            if (jobPostings && jobPostings.length > 0) {
                jobPostings.forEach(job => {
                    const jobItem = document.createElement("div");
                    jobItem.className = "job-posting-item";
                    jobItem.innerHTML = `
                        <h4>${job.title}</h4>
                        <p>Location: ${job.location_id ? job.location_name : 'Company Wide'}</p>
                        <p>Status: ${job.status}</p>
                        <p>Posted: ${new Date(job.created_date).toLocaleDateString()}</p>
                        <div class="actions">
                            <button class="btn btn-secondary btn-sm edit-job-btn" data-job-id="${job.job_posting_id}">Edit</button>
                            <button class="btn btn-secondary btn-sm share-btn" data-job-id="${job.job_posting_id}" data-job-title="${job.title}">Share</button>
                            <button class="btn-delete" data-type="job-posting" data-id="${job.job_posting_id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    jobPostingListDiv.appendChild(jobItem);

                    // Populate job posting filter dropdown for applicants
                    const option = document.createElement("option");
                    option.value = job.job_posting_id;
                    option.textContent = job.title;
                    filterApplicantJobPostingSelect.appendChild(option);
                });
            } else {
                jobPostingListDiv.innerHTML = '<p style="color: var(--text-medium);">No job postings found.</p>';
            }
        } catch (error) {
            console.error("Error loading job postings:", error);
            jobPostingListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading job postings: ${error.message}</p>`;
        }
    }

    async function loadApplicants(filters = {}) {
        if (!applicantListDiv) return;
        applicantListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading applicants...</p>';
        try {
            const queryParams = new URLSearchParams();
            if (filters.job_posting_id) queryParams.append('job_posting_id', filters.job_posting_id);
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.location_id) queryParams.append('location_id', filters.location_id);

            const applicants = await apiRequest("GET", `/applicants?${queryParams.toString()}`);
            applicantListDiv.innerHTML = '';
            if (applicants && applicants.length > 0) {
                applicants.forEach(applicant => {
                    const applicantItem = document.createElement("div");
                    applicantItem.className = "applicant-item";
                    applicantItem.innerHTML = `
                        <h4>${applicant.full_name}</h4>
                        <p>Job: ${applicant.job_title || 'N/A'}</p>
                        <p>Email: ${applicant.email}</p>
                        <p>Phone: ${applicant.phone_number || 'N/A'}</p>
                        <p>Status: ${applicant.status}</p>
                        <p>Applied: ${new Date(applicant.application_date).toLocaleDateString()}</p>
                        <div class="actions">
                            <button class="btn btn-secondary btn-sm edit-applicant-btn" data-applicant-id="${applicant.applicant_id}">Update Status</button>
                            <button class="btn-delete" data-type="applicant" data-id="${applicant.applicant_id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    applicantListDiv.appendChild(applicantItem);
                });
            } else {
                applicantListDiv.innerHTML = '<p style="color: var(--text-medium);">No applicants found with current filters.</p>';
            }
        } catch (error) {
            console.error("Error loading applicants:", error);
            applicantListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading applicants: ${error.message}</p>`;
        }
    }

    if (createJobPostingForm) {
        createJobPostingForm.addEventListener("submit", async e => {
            e.preventDefault();
            const title = document.getElementById("job-title-input").value.trim();
            const description = document.getElementById("job-description-input").value.trim();
            const requirements = document.getElementById("job-requirements-input").value.trim();
            const locationId = jobPostingLocationSelect.value ? parseInt(jobPostingLocationSelect.value, 10) : null;

            if (!title || !description) {
                showModalMessage("Job Title and Description are required.", true);
                return;
            }

            try {
                const response = await apiRequest("POST", "/job-postings", {
                    title: title,
                    description: description,
                    requirements: requirements,
                    location_id: locationId
                });
                showModalMessage(`Job "${title}" posted successfully!`, false);
                createJobPostingForm.reset();
                loadJobPostings();
            } catch (error) {
                showModalMessage(`Error posting job: ${error.message}`, true);
            }
        });
    }

    if (applyApplicantFiltersBtn) {
        applyApplicantFiltersBtn.addEventListener("click", () => {
            const filters = {
                job_posting_id: filterApplicantJobPostingSelect.value || null,
                status: filterApplicantStatusSelect.value || null,
                location_id: filterApplicantLocationSelect.value ? parseInt(filterApplicantLocationSelect.value, 10) : null
            };
            loadApplicants(filters);
        });
    }

    if (clearApplicantFiltersBtn) {
        clearApplicantFiltersBtn.addEventListener("click", () => {
            filterApplicantJobPostingSelect.value = "";
            filterApplicantStatusSelect.value = "";
            filterApplicantLocationSelect.value = "";
            loadApplicants({}); // Load all applicants
        });
    }

    // Share Job Posting Modal Logic
    if (shareLinkModalCloseButton) {
        shareLinkModalCloseButton.addEventListener("click", () => {
            shareLinkModalOverlay.style.display = 'none';
        });
        shareLinkModalOverlay.addEventListener("click", (event) => {
            if (event.target === shareLinkModalOverlay) {
                shareLinkModalOverlay.style.display = 'none';
            }
        });
    }

    document.body.addEventListener("click", async e => {
        const shareButton = e.target.closest(".share-btn");
        if (shareButton) {
            const jobId = shareButton.dataset.jobId;
            const jobTitle = shareButton.dataset.jobTitle; // Get job title for dynamic link text
            const directLink = `${API_BASE_URL}/apply/${jobId}`; // Example direct link
            const embedCode = `<iframe src="${API_BASE_URL}/embed/job/${jobId}" width="600" height="400" frameborder="0" title="${jobTitle} Application"></iframe>`; // Example embed code

            if (shareJobLinkInput) shareJobLinkInput.value = directLink;
            if (shareJobEmbedCodeInput) shareJobEmbedCodeInput.value = embedCode;
            if (shareLinkModalOverlay) shareLinkModalOverlay.style.display = 'flex';
        }

        const copyLink = e.target.closest("#copy-link-btn");
        if (copyLink && shareJobLinkInput) {
            document.execCommand('copy'); // Fallback for navigator.clipboard.writeText
            navigator.clipboard.writeText(shareJobLinkInput.value).then(() => {
                showModalMessage("Link copied to clipboard!", false);
            }).catch(err => {
                console.error('Failed to copy link: ', err);
                showModalMessage("Failed to copy link. Please copy manually.", true);
            });
        }

        const copyEmbed = e.target.closest("#copy-embed-btn");
        if (copyEmbed && shareJobEmbedCodeInput) {
            document.execCommand('copy'); // Fallback
            navigator.clipboard.writeText(shareJobEmbedCodeInput.value).then(() => {
                showModalMessage("Embed code copied to clipboard!", false);
            }).catch(err => {
                console.error('Failed to copy embed code: ', err);
                showModalMessage("Failed to copy embed code. Please copy manually.", true);
            });
        }

        const editApplicantButton = e.target.closest(".edit-applicant-btn");
        if (editApplicantButton) {
            const applicantId = editApplicantButton.dataset.applicantId;
            showModalMessage(`Editing Applicant ID: ${applicantId} (Functionality to be implemented)`, false);
            // Here you'd typically open a modal or navigate to an edit page for the applicant
        }
    });

    // Initial loads
    loadJobPostingLocations();
    loadJobPostings();
    loadApplicants({}); // Load all applicants initially
}

/**
 * Handles all client-side logic for the scheduling.html page.
 */
function handleSchedulingPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const filterEmployeeSelect = document.getElementById("filter-employee-select");
    const filterLocationSelect = document.getElementById("filter-location-select");
    const filterStartDateInput = document.getElementById("filter-start-date");
    const filterEndDateInput = document.getElementById("filter-end-date");
    const applyFiltersBtn = document.getElementById("apply-filters-btn");
    const clearFiltersBtn = document.getElementById("clear-filters-btn");

    const createShiftForm = document.getElementById("create-shift-form");
    const employeeSelect = document.getElementById("employee-select");
    const locationSelect = document.getElementById("location-select");
    const startTimeInput = document.getElementById("start-time-input");
    const endTimeInput = document.getElementById("end-time-input");
    const notesInput = document.getElementById("notes-input");

    const prevWeekBtn = document.getElementById("prev-week-btn");
    const nextWeekBtn = document.getElementById("next-week-btn");
    const currentWeekDisplay = document.getElementById("current-week-display");
    const calendarGrid = document.getElementById("calendar-grid");
    const timeColumn = document.getElementById("time-column");

    let currentWeekStart = moment().startOf('isoWeek'); // Use moment.js for week manipulation

    function renderTimeColumn() {
        timeColumn.innerHTML = '';
        // Add an empty cell for the top-left corner (above time, left of days)
        const topLeftCorner = document.createElement('div');
        topLeftCorner.className = 'calendar-day-header'; // Re-use header style
        topLeftCorner.style.gridColumn = '1';
        topLeftCorner.style.gridRow = '1';
        topLeftCorner.textContent = ''; // Empty for spacing
        calendarGrid.prepend(topLeftCorner); // Add before any other content

        for (let i = 0; i < 24; i++) {
            const time = moment().hour(i).minute(0);
            const timeSlot = document.createElement('div');
            timeSlot.className = 'calendar-time-slot';
            timeSlot.textContent = time.format('h A');
            timeColumn.appendChild(timeSlot);
        }
    }

    async function loadEmployeesForScheduling() {
        if (!employeeSelect) return;
        employeeSelect.innerHTML = '<option value="">Loading employees...</option>';
        filterEmployeeSelect.innerHTML = '<option value="">All Employees</option>'; // Always have "All Employees" option
        try {
            const employees = await apiRequest("GET", "/users?filterRole=employee"); // Assuming an API to get employees
            if (employees && employees.length > 0) {
                employeeSelect.innerHTML = '<option value="">Select Employee</option>';
                employees.forEach(emp => {
                    const option = document.createElement("option");
                    option.value = emp.user_id;
                    option.textContent = emp.full_name;
                    employeeSelect.appendChild(option);
                    // Add to filter dropdown as well
                    filterEmployeeSelect.appendChild(option.cloneNode(true));
                });
            } else {
                employeeSelect.innerHTML = '<option value="">No employees available</option>';
                filterEmployeeSelect.innerHTML = '<option value="">No employees available</option>';
            }
        } catch (error) {
            console.error("Error loading employees for scheduling:", error);
            employeeSelect.innerHTML = '<option value="">Error loading employees</option>';
            filterEmployeeSelect.innerHTML = '<option value="">Error loading employees</option>';
            showModalMessage(`Failed to load employees: ${error.message}`, true);
        }
    }

    async function loadLocationsForScheduling() {
        if (!locationSelect) return;
        locationSelect.innerHTML = '<option value="">Loading locations...</option>';
        filterLocationSelect.innerHTML = '<option value="">All Locations</option>'; // Always have "All Locations" option
        try {
            const locations = await apiRequest("GET", "/locations");
            if (locations && locations.length > 0) {
                locationSelect.innerHTML = '<option value="">Select Location</option>';
                locations.forEach(loc => {
                    const option = document.createElement("option");
                    option.value = loc.location_id;
                    option.textContent = loc.location_name;
                    locationSelect.appendChild(option);
                    // Add to filter dropdown as well
                    filterLocationSelect.appendChild(option.cloneNode(true));
                });
            } else {
                locationSelect.innerHTML = '<option value="">No locations available</option>';
                filterLocationSelect.innerHTML = '<option value="">No locations available</option>';
            }
        } catch (error) {
            console.error("Error loading locations for scheduling:", error);
            locationSelect.innerHTML = '<option value="">Error loading locations</option>';
            filterLocationSelect.innerHTML = '<option value="">Error loading locations</option>';
            showModalMessage(`Failed to load locations: ${error.message}`, true);
        }
    }

    async function renderCalendar() {
        if (!calendarGrid) return;

        // Clear existing day headers and cells (except the fixed time column)
        const existingDayElements = calendarGrid.querySelectorAll('.calendar-day-header:not([style*="grid-column: 1"]), .calendar-day-cell');
        existingDayElements.forEach(el => el.remove());

        currentWeekDisplay.textContent = `${currentWeekStart.format('MMM DD')} - ${moment(currentWeekStart).endOf('isoWeek').format('MMM DD,YYYY')}`;

        const dates = [];
        for (let i = 0; i < 7; i++) {
            dates.push(moment(currentWeekStart).add(i, 'days'));
        }

        // Add Day Headers
        dates.forEach((date, index) => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.style.gridColumn = `${index + 2}`; // +2 because column 1 is for time
            dayHeader.style.gridRow = '1';
            dayHeader.innerHTML = `${date.format('ddd')}<br>${date.format('MMM D')}`;
            calendarGrid.appendChild(dayHeader);
        });

        // Add Day Cells
        dates.forEach((date, index) => {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day-cell';
            dayCell.style.gridColumn = `${index + 2}`; // +2 because column 1 is for time
            dayCell.style.gridRow = `2 / span 24`; // Span 24 hours
            dayCell.dataset.date = date.format('YYYY-MM-DD'); // Store date for later use
            calendarGrid.appendChild(dayCell);
        });

        // Fetch and display shifts for the current week
        const startOfWeek = currentWeekStart.startOf('isoWeek').format('YYYY-MM-DDTHH:mm:ssZ');
        const endOfWeek = moment(currentWeekStart).endOf('isoWeek').format('YYYY-MM-DDTHH:mm:ssZ');

        const filters = {
            start_date: startOfWeek,
            end_date: endOfWeek,
            employee_id: filterEmployeeSelect.value || null,
            location_id: filterLocationSelect.value || null
        };

        try {
            const shifts = await apiRequest("GET", `/schedules?${new URLSearchParams(filters).toString()}`);
            shifts.forEach(shift => {
                const shiftStart = moment(shift.start_time);
                const shiftEnd = moment(shift.end_time);
                const shiftDate = shiftStart.format('YYYY-MM-DD');

                const targetCell = calendarGrid.querySelector(`.calendar-day-cell[data-date="${shiftDate}"]`);
                if (targetCell) {
                    const shiftDiv = document.createElement('div');
                    shiftDiv.className = `calendar-shift ${moment().isAfter(shiftEnd) ? 'overdue' : ''}`; // Add 'overdue' class if shift has passed

                    // Calculate top and height for positioning
                    const startHour = shiftStart.hour();
                    const startMinute = shiftStart.minute();
                    const endHour = shiftEnd.hour();
                    const endMinute = shiftEnd.minute();

                    const topPosition = (startHour * 30) + (startMinute / 60 * 30); // 30px per hour
                    const durationHours = shiftEnd.diff(shiftStart, 'minutes') / 60;
                    const height = durationHours * 30; // 30px per hour

                    shiftDiv.style.top = `${topPosition}px`;
                    shiftDiv.style.height = `${height}px`;
                    shiftDiv.textContent = `${shift.employee_name} @ ${shift.location_name} (${shiftStart.format('h:mm A')} - ${shiftEnd.format('h:mm A')})`;

                    shiftDiv.addEventListener('click', async () => {
                        const confirmDelete = await showConfirmModal(`
                            <h4>Shift Details:</h4>
                            <p><strong>Employee:</strong> ${shift.employee_name}</p>
                            <p><strong>Location:</strong> ${shift.location_name}</p>
                            <p><strong>Time:</strong> ${shiftStart.format('MMM DD, h:mm A')} - ${shiftEnd.format('MMM DD, h:mm A')}</p>
                            <p><strong>Notes:</strong> ${shift.notes || 'None'}</p>
                            <p style="margin-top: 15px;">Are you sure you want to delete this shift?</p>
                        `, "Delete Shift");

                        if (confirmed) {
                            try {
                                await apiRequest("DELETE", `/schedules/${shift.schedule_id}`);
                                showModalMessage("Shift deleted successfully!", false);
                                renderCalendar(); // Re-render calendar
                            } catch (error) {
                                showModalMessage(`Failed to delete shift: ${error.message}`, true);
                            }
                        }
                    });

                    targetCell.appendChild(shiftDiv);
                }
            });
        } catch (error) {
            console.error("Error loading schedules:", error);
            calendarGrid.querySelector('p').textContent = `Error loading schedules: ${error.message}`;
        }
    }

    if (prevWeekBtn) {
        prevWeekBtn.addEventListener("click", () => {
            currentWeekStart.subtract(1, 'isoWeek');
            renderCalendar();
        });
    }

    if (nextWeekBtn) {
        nextWeekStart.add(1, 'isoWeek');
        renderCalendar();
    }

    if (createShiftForm) {
        createShiftForm.addEventListener("submit", async e => {
            e.preventDefault();
            const employeeId = employeeSelect.value ? parseInt(employeeSelect.value, 10) : null;
            const locationId = locationSelect.value ? parseInt(locationSelect.value, 10) : null;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;
            const notes = notesInput.value.trim();

            if (!employeeId || !locationId || !startTime || !endTime) {
                showModalMessage("Please select an employee, location, and valid start/end times.", true);
                return;
            }
            if (new Date(startTime) >= new Date(endTime)) {
                showModalMessage("Start time must be before end time.", true);
                return;
            }

            try {
                await apiRequest("POST", "/schedules", {
                    employee_id: employeeId,
                    location_id: locationId,
                    start_time: startTime,
                    end_time: endTime,
                    notes: notes || null
                });
                showModalMessage("Shift created successfully!", false);
                createShiftForm.reset();
                renderCalendar();
            } catch (error) {
                showModalMessage(`Error creating shift: ${error.message}`, true);
            }
        });
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener("click", () => {
            renderCalendar(); // Re-render calendar with new filters
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener("click", () => {
            filterEmployeeSelect.value = "";
            filterLocationSelect.value = "";
            filterStartDateInput.value = "";
            filterEndDateInput.value = "";
            renderCalendar(); // Re-render calendar with cleared filters
        });
    }

    // Initial load
    renderTimeColumn();
    loadEmployeesForScheduling();
    loadLocationsForScheduling();
    renderCalendar();
}

/**
 * Handles all client-side logic for the documents.html page.
 */
function handleDocumentsPage() {
    // In a real app, remove this mock and ensure user is logged in before calling this handler
    // The mock authentication below should be REMOVED for your live site.
    if (!localStorage.getItem("authToken")) {
        localStorage.setItem("authToken", "mock-auth-token"); // REMOVE FOR LIVE SITE
        localStorage.setItem("userRole", "super_admin"); // REMOVE FOR LIVE SITE
        // console.warn("Mock authentication applied for demo purposes. REMOVE FOR LIVE SITE.");
    }

    const uploadDocumentForm = document.getElementById("upload-document-form");
    const documentTitleInput = document.getElementById("document-title");
    const documentFileInput = document.getElementById("document-file");
    const documentDescriptionInput = document.getElementById("document-description");
    const documentListDiv = document.getElementById("document-list");

    const uploadProgressContainer = document.getElementById("upload-progress-container");
    const uploadProgressFill = document.getElementById("upload-progress-fill");
    const uploadProgressText = document.getElementById("upload-progress-text");

    /**
     * Shows the upload progress bar and updates its display.
     * @param {number} percentage - The upload progress percentage (0-100).
     * @param {string} text - Optional text to display, e.g., "Uploading..."
     */
    function showUploadProgress(percentage, text = `${percentage}%`) {
        if (uploadProgressContainer && uploadProgressFill && uploadProgressText) {
            uploadProgressContainer.style.display = 'block';
            uploadProgressText.style.display = 'block';
            uploadProgressFill.style.width = `${percentage}%`;
            uploadProgressText.textContent = text;
        }
    }

    /**
     * Hides the upload progress bar.
     */
    function hideUploadProgress() {
        if (uploadProgressContainer && uploadProgressText) {
            uploadProgressContainer.style.display = 'none';
            uploadProgressText.style.display = 'none';
            uploadProgressFill.style.width = '0%';
        }
    }

    /**
     * Fetches and displays the list of uploaded documents from the backend.
     */
    async function loadDocuments() {
        if (!documentListDiv) return;
        documentListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading documents...</p>';

        try {
            const documents = await apiRequest("GET", "/documents");

            documentListDiv.innerHTML = '';

            if (documents.length === 0) {
                documentListDiv.innerHTML = '<p style="color: var(--text-medium);">No documents uploaded yet.</p>';
            } else {
                documents.forEach(doc => {
                    const docItem = document.createElement("div");
                    docItem.className = "document-item";
                    const uploadDate = new Date(doc.upload_date).toLocaleDateString();
                    docItem.innerHTML = `
                        <h4>${doc.title}</h4>
                        <p>File: ${doc.file_name}</p>
                        <p>Description: ${doc.description || 'N/A'}</p>
                        <p>Uploaded: ${uploadDate}</p>
                        <div class="actions">
                            <a href="${API_BASE_URL}/documents/download/${doc.document_id}" class="btn btn-secondary btn-sm" target="_blank" download>Download</a>
                            <button class="btn-delete" data-type="document" data-id="${doc.document_id}">
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

            const title = documentTitleInput.value.trim();
            const file = documentFileInput.files[0];
            const description = documentDescriptionInput.value.trim();

            if (!title || !file) {
                showModalMessage("Please provide a document title and select a file.", true);
                return;
            }

            const formData = new FormData();
            formData.append('title', title);
            formData.append('document_file', file);
            formData.append('description', description);

            try {
                showUploadProgress(0, 'Starting upload...');
                const result = await apiRequest(
                    "POST",
                    "/documents/upload",
                    formData,
                    true, // isFormData: true
                    event => {
                        if (event.lengthComputable) {
                            const percentComplete = Math.round((event.loaded * 100) / event.total);
                            showUploadProgress(percentComplete, `Uploading: ${percentComplete}%`);
                        }
                    }
                );

                showModalMessage("Document uploaded successfully!", false);
                uploadDocumentForm.reset();
                hideUploadProgress();
                loadDocuments(); // Reload the list of documents from the backend
            } catch (error) {
                console.error("Document upload error:", error);
                showModalMessage(`Failed to upload document: ${error.message}`, true);
                hideUploadProgress();
            }
        });
    }

    // Event listener for delete buttons on documents page (using delegation)
    if (documentListDiv) {
        documentListDiv.addEventListener("click", async e => {
            const targetButton = e.target.closest(".btn-delete");
            if (targetButton && targetButton.dataset.type === "document") {
                const idToDelete = parseInt(targetButton.dataset.id, 10);
                const confirmed = await showConfirmModal(`Are you sure you want to delete this document? This action cannot be undone.`, "Delete");

                if (confirmed) {
                    try {
                        await apiRequest("DELETE", `/documents/${idToDelete}`);
                        showModalMessage("Document deleted successfully!", false);
                        loadDocuments(); // Reload the list of documents to reflect the change
                    } catch (error) {
                        showModalMessage(`Error deleting document: ${error.message}`, true);
                    }
                }
            }
        });
    }


    // Initial load of documents when the page loads
    loadDocuments();
}

// Global DOMContentLoaded listener to call page-specific handlers
document.addEventListener("DOMContentLoaded", () => {
    // Call setupSettingsDropdown on all pages that use it
    setupSettingsDropdown();

    // Route calls to specific page handlers based on body ID or filename
    // Using window.location.pathname to determine the current page
    const path = window.location.pathname;

    if (path.includes("login.html")) {
        handleLoginPage();
    } else if (path.includes("register.html")) {
        handleRegisterPage();
    } else if (path.includes("suite-hub.html")) {
        handleSuiteHubPage();
    } else if (path.includes("account.html")) {
        handleAccountPage();
    } else if (path.includes("admin.html")) {
        handleAdminPage();
    } else if (path.includes("dashboard.html")) { // Onboarding Dashboard
        handleDashboardPage();
    } else if (path.includes("checklists.html")) {
        handleChecklistsPage(); // Call the checklists page handler directly
    } else if (path.includes("new-hire-view.html")) { // Employee's Onboarding View
        handleNewHireViewPage();
    } else if (path.includes("pricing.html")) {
        handlePricingPage();
    } else if (path.includes("documents.html")) {
        handleDocumentsPage();
    } else if (path.includes("hiring.html")) {
        handleHiringPage();
    } else if (path.includes("scheduling.html")) {
        // You'll need to load moment.js in scheduling.html for this to work
        // <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"></script>
        // Make sure it's loaded before app.min.js
        if (typeof moment === 'undefined') {
            console.error("Moment.js is not loaded. Scheduling page functionality will be limited.");
            showModalMessage("Scheduling requires Moment.js library. Please ensure it's loaded in scheduling.html.", true);
        } else {
            handleSchedulingPage();
        }
    }
    // Add more else if conditions for other pages as needed
});
