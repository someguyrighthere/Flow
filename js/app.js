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
const stripe = Stripe('pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td');


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
            resolve(window.confirm(message));
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


function setupSettingsDropdown() {
    const settingsButton = document.getElementById("settings-button");
    const settingsDropdown = document.getElementById("settings-dropdown");
    if (settingsButton && settingsDropdown) {
        settingsButton.addEventListener("click", event => {
            event.stopPropagation();
            settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";
        });
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
            localStorage.removeItem("userRole");
            window.location.href = "login.html";
        });
    }
}

function handleLoginPage() {
    const loginForm = document.getElementById("login-form");
    if (!loginForm) {
        return;
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
        }
        if (!email || !password) {
            if (errorMessage) {
                errorMessage.textContent = "Email and password are required.";
            }
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (errorMessage) {
                errorMessage.textContent = "Please enter a valid email address.";
            }
            return;
        }
        if (password.length < 6) {
            if (errorMessage) {
                errorMessage.textContent = "Password must be at least 6 characters long.";
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
            }
            showModalMessage(`Login Failed: ${error.message}`, true);
        }
    });
}

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
            }
            showModalMessage(`Registration Failed: ${error.message}`, true);
        }
    });
}

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
            } catch (error) {
                console.error("Error updating profile:", error);
                showModalMessage(`Failed to update profile: ${error.message}`, true);
            }
        });
    }
    loadProfileInfo();
}

function handleAdminPage() {
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
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
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
            console.log("handleAdminPage: Delete button clicked.");
            const id = targetButton.dataset.id;
            const type = targetButton.dataset.type;
            const confirmationMessage = `Are you sure you want to delete this ${type}?`;
            const confirmed = await showConfirmModal(confirmationMessage, "Delete");
            if (confirmed) {
                try {
                    console.log(`handleAdminPage: Deleting ${type} with ID: ${id}.`);
                    if (type === "location") {
                        await apiRequest("DELETE", `/locations/${id}`);
                        showModalMessage("Location deleted successfully!", false);
                        loadLocations();
                        loadUsers();
                    } else if (type === "user") {
                        await apiRequest("DELETE", `/users/${id}`);
                        showModalMessage("User deleted successfully!", false);
                        loadUsers();
                    }
                    console.log(`handleAdminPage: ${type} deleted successfully.`);
                } catch (error) {
                    showModalMessage(`Error deleting ${type}: ${error.message}`, true);
                }
            }
        }
    });

    if (newLocationForm) {
        console.log("handleAdminPage: New location form found, attaching listener.");
        newLocationForm.addEventListener("submit", async e => {
            e.preventDefault();
            console.log("handleAdminPage: New location form submitted.");
            const nameInput = document.getElementById("new-location-name");
            const addressInput = document.getElementById("new-location-address");
            const location_name = nameInput.value;
            const location_address = addressInput.value;
            try {
                console.log("handleAdminPage: Creating location via API.");
                await apiRequest("POST", "/locations", {
                    location_name: location_name,
                    location_address: location_address
                });
                nameInput.value = "";
                addressInput.value = "";
                showModalMessage("Location created successfully!", false);
                console.log("handleAdminPage: Location created, reloading lists.");
                loadLocations();
            } catch (error) {
                console.error("Error creating location:", error);
                showModalMessage(`Error creating location: ${error.message}`, true);
            }
        });
    }

    if (inviteAdminForm) {
        console.log("handleAdminPage: Invite admin form found, attaching listener.");
        inviteAdminForm.addEventListener("submit", async e => {
            e.preventDefault();
            console.log("handleAdminPage: Invite admin form submitted.");
            const adminName = document.getElementById("admin-name") ? document.getElementById("admin-name").value : "";
            const adminEmail = document.getElementById("admin-email") ? document.getElementById("admin-email").value : "";
            const adminPassword = document.getElementById("admin-password") ? document.getElementById("admin-password").value : "";
            const adminLocationSelectElement = document.getElementById("admin-location-select");
            const adminLocationId = adminLocationSelectElement ? adminLocationSelectElement.value : "";

            if (!adminLocationId) {
                console.log("handleAdminPage: Admin invite validation failed: No location selected.");
                showModalMessage("Please select a location to assign the admin.", true);
                return;
            }
            if (!adminPassword) {
                console.log("handleAdminPage: Admin invite validation failed: No temporary password.");
                showModalMessage("Please enter a temporary password for the new admin.", true);
                return;
            }
            try {
                console.log("handleAdminPage: Inviting admin via API.");
                await apiRequest("POST", "/invite-admin", {
                    full_name: adminName,
                    email: adminEmail,
                    location_id: parseInt(adminLocationId),
                    password: adminPassword
                });
                if (document.getElementById("admin-name"))
                    document.getElementById("admin-name").value = "";
                if (document.getElementById("admin-email"))
                    document.getElementById("admin-email").value = "";
                if (document.getElementById("admin-password"))
                    document.getElementById("admin-password").value = "";
                if (adminLocationSelectElement)
                    adminLocationSelectElement.value = "";
                showModalMessage(`Admin invite sent to ${adminEmail} for selected location with the provided temporary password.`, false);
                console.log("handleAdminPage: Admin invited, reloading users.");
                loadUsers();
            } catch (error) {
                console.error("Error inviting admin:", error);
                showModalMessage(`Failed to invite admin: ${error.message}`, true);
            }
        });
    }

    // New: Handle Employee Invitation
    if (inviteEmployeeForm) {
        console.log("handleAdminPage: Invite employee form found, attaching listener.");
        inviteEmployeeForm.addEventListener("submit", async e => {
            e.preventDefault();
            console.log("handleAdminPage: Invite employee form submitted.");
            const employeeName = document.getElementById("employee-name") ? document.getElementById("employee-name").value : "";
            const employeeEmail = document.getElementById("employee-email") ? document.getElementById("employee-email").value : "";
            const employeePassword = document.getElementById("employee-password") ? document.getElementById("employee-password").value : "";
            const employeePosition = document.getElementById("employee-position") ? document.getElementById("employee-position").value : "";
            const employeeId = document.getElementById("employee-id") ? document.getElementById("employee-id").value : null; // Can be null
            const employeeLocationSelectElement = document.getElementById("employee-location-select");
            const employeeLocationId = employeeLocationSelectElement ? employeeLocationSelectElement.value : ""; // Can be empty for 'unassigned'

            // Basic validation
            if (!employeeName || !employeeEmail || !employeePassword) {
                showModalMessage("Full name, email, and temporary password are required for employee invitation.", true);
                return;
            }
            if (employeePassword.length < 6) {
                showModalMessage("Temporary password must be at least 6 characters long.", true);
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail)) {
                showModalMessage("Please enter a valid email address for the employee.", true);
                return;
            }

            // Convert location ID to number or null
            const locationIdToSend = employeeLocationId ? parseInt(employeeLocationId) : null;
            // Convert employee_id to number or string or null
            const employeeIdToSend = employeeId ? (isNaN(parseInt(employeeId)) ? employeeId : parseInt(employeeId)) : null;

            try {
                console.log("handleAdminPage: Inviting employee via API.");
                await apiRequest("POST", "/invite-employee", {
                    full_name: employeeName,
                    email: employeeEmail,
                    password: employeePassword,
                    position: employeePosition || null, // Send null if empty
                    employee_id: employeeIdToSend, // Send null if empty
                    location_id: locationIdToSend // Send null if "Select a location" or empty
                });
                // Clear form fields
                if (document.getElementById("employee-name")) document.getElementById("employee-name").value = "";
                if (document.getElementById("employee-email")) document.getElementById("employee-email").value = "";
                if (document.getElementById("employee-password")) document.getElementById("employee-password").value = "";
                if (document.getElementById("employee-position")) document.getElementById("employee-position").value = "";
                if (document.getElementById("employee-id")) document.getElementById("employee-id").value = "";
                if (employeeLocationSelectElement) employeeLocationSelectElement.value = ""; // Reset dropdown

                showModalMessage(`Employee invite sent to ${employeeEmail} for selected location with the provided temporary password.`, false);
                console.log("handleAdminPage: Employee invited, reloading users.");
                loadUsers();
            } catch (error) {
                console.error("Error inviting employee:", error);
                showModalMessage(`Failed to invite employee: ${error.message}`, true);
            }
        });
    }

    loadLocations();
    loadUsers();
}

function handlePricingPage() {
    console.log("handlePricingPage: Initializing pricing page logic.");
    const freePlanBtn = document.getElementById("free-plan-btn");
    const proPlanBtn = document.getElementById("pro-plan-btn");
    const enterprisePlanBtn = document.getElementById("enterprise-plan-btn");

    if (!freePlanBtn || !proPlanBtn || !enterprisePlanBtn) {
        console.error("handlePricingPage: One or more pricing plan buttons not found. Check IDs in HTML.");
        return;
    }
    console.log("handlePricingPage: All pricing plan buttons found.");

    if (freePlanBtn) {
        freePlanBtn.addEventListener("click", () => {
            console.log("handlePricingPage: Free plan button clicked.");
            showModalMessage("You are currently on the Free plan. No action needed.", false);
        });
    }

    const handlePlanButtonClick = async event => {
        console.log("handlePricingPage: Plan button clicked. Target:", event.target);
        const planId = event.target.dataset.planId;
        if (!planId) {
            console.error("handlePricingPage: Plan ID not found on button. Check data-plan-id attribute.");
            showModalMessage("Plan ID not found. Cannot proceed with checkout.", true);
            return;
        }
        console.log("handlePricingPage: Selected planId:", planId);
        const authToken = localStorage.getItem("authToken");
        if (!authToken) {
            console.log("handlePricingPage: No auth token found, prompting login.");
            showModalMessage("Please log in to choose a plan.", true);
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);
            return;
        }
        console.log("handlePricingPage: Auth token found, proceeding with checkout session creation.");
        try {
            console.log("handlePricingPage: Making API request to /create-checkout-session.");
            const response = await apiRequest("POST", "/create-checkout-session", {
                planId: planId
            });
            const sessionId = response.sessionId;
            console.log("handlePricingPage: Received session ID from backend:", sessionId);
            if (sessionId) {
                console.log("handlePricingPage: Redirecting to Stripe Checkout.");
                const result = await stripe.redirectToCheckout({
                    sessionId: sessionId
                });
                if (result.error) {
                    console.error("Stripe Checkout Error:", result.error.message);
                    showModalMessage(`Stripe Checkout Error: ${result.error.message}`, true);
                }
            } else {
                console.error("handlePricingPage: Session ID not received from backend.");
                showModalMessage("Failed to create Stripe Checkout session. Please try again.", true);
            }
        } catch (error) {
            console.error("Error initiating checkout:", error);
            showModalMessage(`Error initiating checkout: ${error.message}`, true);
        }
    };

    if (proPlanBtn) {
        proPlanBtn.addEventListener("click", handlePlanButtonClick);
        console.log("handlePricingPage: Attached click listener to Pro button.");
    }
    if (enterprisePlanBtn) {
        enterprisePlanBtn.addEventListener("click", handlePlanButtonClick);
        console.log("handlePricingPage: Attached click listener to Enterprise button.");
    }
}

function handleSchedulingPage() {
    console.log("handleSchedulingPage: Initializing.");
    if (!localStorage.getItem("authToken")) {
        console.log("handleSchedulingPage: No auth token found, redirecting to login.");
        window.location.href = "login.html";
        return;
    }
    console.log("Scheduling page logic goes here.");
}

function handleHiringPage() {
    console.log("handleHiringPage: Initializing.");
    if (!localStorage.getItem("authToken")) {
        console.log("handleHiringPage: No auth token found, redirecting to login.");
        window.location.href = "login.html";
        return;
    }
    console.log("Hiring page logic goes here.");
}

function handleSalesAnalyticsPage() {
    console.log("handleSalesAnalyticsPage: Initializing.");
    if (!localStorage.getItem("authToken")) {
        console.log("handleSalesAnalyticsPage: No auth token found, redirecting to login.");
        window.location.href = "login.html";
        return;
    }
    console.log("Sales Analytics page logic goes here.");
}

function handleDashboardPage() {
    console.log("handleDashboardPage: Initializing.");
    if (!localStorage.getItem("authToken")) {
        console.log("handleDashboardPage: No auth token found, redirecting to login.");
        window.location.href = "login.html";
        return;
    }
    // Your dashboard-specific logic would go here
    console.log("Dashboard page logic goes here.");
}

function handleDocumentsPage() {
    console.log("handleDocumentsPage: Initializing.");
    if (!localStorage.getItem("authToken")) {
        console.log("handleDocumentsPage: No auth token found, redirecting to login.");
        window.location.href = "login.html";
        return;
    }
    // Your documents-specific logic would go here
    console.log("Documents page logic goes here.");
}

function handleChecklistsPage() {
    console.log("handleChecklistsPage: Initializing.");
    if (!localStorage.getItem("authToken")) {
        console.log("handleChecklistsPage: No auth token found, redirecting to login.");
        window.location.href = "login.html";
        return;
    }
    // Your checklists-specific logic would go here
    console.log("Checklists page logic goes here.");
}

function handleNewHireViewPage() {
    console.log("handleNewHireViewPage: Initializing.");
    if (!localStorage.getItem("authToken")) {
        console.log("handleNewHireViewPage: No auth token found, redirecting to login.");
        window.location.href = "login.html";
        return;
    }
    // Your new hire view-specific logic would go here
    console.log("New Hire View page logic goes here.");
}


// This ensures the correct handler function runs when the page loads.
document.addEventListener('DOMContentLoaded', () => {
    // Setup general UI elements like the settings dropdown
    setupSettingsDropdown();

    // Route to specific page handlers based on the current URL
    const path = window.location.pathname;
    console.log("DOMContentLoaded: Current path is", path); // Debugging

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
    // For the root path ('/'), you might want to redirect to index.html or handle it specifically
    else if (path === '/' || path === '/index.html') {
        // No specific handler needed for the landing page beyond setupSettingsDropdown
        console.log("Index page loaded.");
    }
});