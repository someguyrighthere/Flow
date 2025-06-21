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
    console.warn("Stripe.js not loaded. Stripe functionalities will not work on this page.");
}


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
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (body) {
        options.body = JSON.stringify(body);
    }
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Something went wrong");
    }
    if (response.status === 204 || (response.status === 200 && response.headers.get("content-length") === "0")) {
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

        confirmModalMessage.textContent = message;
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
    if (settingsButton && settingsDropdown) {
        settingsButton.addEventListener("click", event => {
            event.stopPropagation(); // Prevent the document click from immediately closing it
            settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";
        });
        // Close dropdown if user clicks outside
        document.addEventListener("click", event => {
            if (!settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
                settingsDropdown.style.display = "none";
            }
        });
    }

    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            localStorage.removeItem("authToken");
            localStorage.removeItem("userRole"); // Clear user role too
            window.location.href = "login.html"; // Redirect to login page
        });
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
        }

        // Basic client-side validation
        if (!email || !password) {
            if (errorMessage) {
                errorMessage.textContent = "Email and password are required.";
                errorMessage.classList.add("visible");
            }
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (errorMessage) {
                errorMessage.textContent = "Please enter a valid email address.";
                errorMessage.classList.add("visible");
            }
            return;
        }

        if (password.length < 6) {
            if (errorMessage) {
                errorMessage.textContent = "Password must be at least 6 characters long.";
                errorMessage.classList.add("visible");
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
                    userListDiv.appendChild(userDiv);
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

            // Client-side validation for admin invite
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
            const employeeLocationId = employeeLocationSelectElement ? employeeLocationSelectElement.value : ""; // Can be empty for 'unassigned'

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
     */
    async function initiateStripeCheckout(planId) {
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
            return; // Stop execution, user needs to interact with modal
        }

        // If user is already logged in, proceed directly to Stripe checkout
        console.log("handlePricingPage: Auth token found, proceeding directly with checkout.");
        await initiateStripeCheckout(planId);
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
                        await initiateStripeCheckout(selectedPlanForRegistration);
                    } else {
                        throw new Error("Failed to log in after registration. Please try logging in manually.");
                    }
                } else {
                    // This case is unlikely with the current apiRequest implementation which throws on !response.ok
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
 * Handles all client-side logic for the scheduling.html page.
 */
function handleSchedulingPage() {
    // Redirect to login if not authenticated
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }
    // Placeholder for actual scheduling page logic
    console.log("Scheduling page logic goes here. (Implementation pending)");
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
    // Placeholder for actual documents page logic
    console.log("Documents page logic goes here. (Implementation pending)");
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