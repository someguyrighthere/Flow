// app.js - Client-Side JavaScript for Flow Business Suite
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

let stripe;
if (typeof Stripe !== 'undefined') {
    stripe = Stripe('pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td');
} else {
    console.warn("Stripe.js not loaded. Stripe functionalities will not work on this page.");
}

function showModalMessage(message, isError = false) {
    const modalOverlay = document.getElementById("message-modal-overlay");
    const modalMessage = document.getElementById("modal-message-text");
    const modalCloseButton = document.getElementById("modal-close-button");
    if (modalOverlay && modalMessage && modalCloseButton) {
        modalMessage.textContent = message;
        modalMessage.style.color = isError ? "#ff8a80" : "var(--text-light)";
        modalOverlay.style.display = "flex";
        modalCloseButton.onclick = () => { modalOverlay.style.display = "none"; };
        modalOverlay.onclick = event => { if (event.target === modalOverlay) modalOverlay.style.display = "none"; };
    } else {
        console.error("Modal elements not found for showModalMessage:", message);
        isError ? console.error(`ERROR: ${message}`) : console.log(`MESSAGE: ${message}`);
    }
}

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

        confirmModalMessage.innerHTML = message;
        modalConfirmButton.textContent = confirmButtonText;
        confirmModalOverlay.style.display = "flex";

        const handleResponse = (value) => {
            confirmModalOverlay.style.display = "none";
            modalConfirmButton.removeEventListener("click", onConfirm);
            modalCancelButton.removeEventListener("click", onCancel);
            resolve(value);
        };
        const onConfirm = () => handleResponse(true);
        const onCancel = () => handleResponse(false);

        modalConfirmButton.addEventListener("click", onConfirm);
        modalCancelButton.addEventListener("click", onCancel);
        confirmModalOverlay.onclick = event => { if (event.target === confirmModalOverlay) onCancel(); };
    });
}

function setupSettingsDropdown() {
    const settingsButton = document.getElementById("settings-button");
    const settingsDropdown = document.getElementById("settings-dropdown");
    const logoutButton = document.getElementById("logout-button");

    if (settingsButton && settingsDropdown) {
        settingsButton.addEventListener("click", event => {
            event.stopPropagation();
            settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";
        });
        document.addEventListener("click", event => {
            if (settingsButton && !settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
                settingsDropdown.style.display = "none";
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            localStorage.removeItem("authToken");
            localStorage.removeItem("userRole");
            window.location.href = "login.html";
        });
    }
}

async function apiRequest(method, path, body = null, isFormData = false, onProgress = null, expectBlobResponse = false) {
    const token = localStorage.getItem('authToken');
    const endpoint = `${API_BASE_URL}${path}`;

    // --- UPDATED: Centralized redirect logic for expired tokens ---
    const handleAuthError = (errorMessage) => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        showModalMessage(errorMessage, true);
        // Redirect to login page with a message
        setTimeout(() => {
            window.location.href = 'login.html?sessionExpired=true';
        }, 1500); 
    };

    if (isFormData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            if (onProgress && xhr.upload) xhr.upload.addEventListener('progress', onProgress);
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText || '{}')); } catch (e) { resolve({}); }
                } else if (xhr.status === 401 || xhr.status === 403) {
                    handleAuthError('Your session has expired. Please log in again.');
                    reject(new Error('Authentication failed.'));
                } else {
                    try { reject(new Error(JSON.parse(xhr.responseText).error || 'An unknown error occurred.')); }
                    catch (e) { reject(new Error(`HTTP error ${xhr.status} - ${xhr.statusText}`)); }
                }
            };
            xhr.onerror = () => reject(new Error('Network error.'));
            xhr.send(body);
        });
    }

    const options = { method, headers: {} };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body && !isFormData) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const response = await fetch(endpoint, options);
    if (response.status === 401 || response.status === 403) {
        handleAuthError('Your session has expired. Please log in again.');
        throw new Error('Authentication failed.');
    }
    if (!response.ok) {
        let errorMsg = `HTTP error! Status: ${response.status}`;
        try { errorMsg = (await response.json()).error || errorMsg; } catch (e) { /* ignore */ }
        throw new Error(errorMsg);
    }
    if (expectBlobResponse) return response.blob();
    if (response.status === 204 || response.headers.get("content-length") === "0") return null;
    return response.json();
}

function handleLoginPage() {
    const loginForm = document.getElementById("login-form");
    if (!loginForm) return;

    // --- NEW: Check for session expired message on page load ---
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('sessionExpired')) {
        showModalMessage("Your session has expired. Please log in again.", true);
        // Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const errorMessage = document.getElementById("error-message");
        errorMessage.textContent = "";
        errorMessage.classList.remove("visible");
        try {
            const data = await apiRequest("POST", "/login", { email, password });
            localStorage.setItem("authToken", data.token);
            localStorage.setItem("userRole", data.role);
            window.location.href = (data.role === "super_admin" || data.role === "location_admin") ? "suite-hub.html" : "new-hire-view.html";
        } catch (error) {
            errorMessage.textContent = `Login Failed: ${error.message}`;
            errorMessage.classList.add("visible");
        }
    });
}
function handleRegisterPage() { /* ... function content from your app.js ... */ }
function handleSuiteHubPage() { /* ... function content from your app.js ... */ }
function handleAccountPage() { /* ... function content from your app.js ... */ }
function handleAdminPage() { /* ... function content from your app.js ... */ }
function handleDashboardPage() { /* ... function content from your app.js ... */ }
function handlePricingPage() { /* ... function content from your app.js ... */ }
function handleHiringPage() { /* ... function content from your app.js ... */ }
function handleSchedulingPage() { /* ... function content from your app.js ... */ }
function handleDocumentsPage() { /* ... function content from your app.js ... */ }
function handleChecklistsPage() { /* ... function content from your app.js ... */ }
function handleNewHireViewPage() { /* ... function content from your app.js ... */ }

// Global DOMContentLoaded listener
document.addEventListener("DOMContentLoaded", () => {
    setupSettingsDropdown();
    const path = window.location.pathname;
    if (path.includes("login.html")) handleLoginPage();
    else if (path.includes("register.html")) handleRegisterPage();
    else if (path.includes("suite-hub.html")) handleSuiteHubPage();
    else if (path.includes("account.html")) handleAccountPage();
    else if (path.includes("admin.html")) handleAdminPage();
    else if (path.includes("dashboard.html")) handleDashboardPage();
    else if (path.includes("checklists.html")) handleChecklistsPage();
    else if (path.includes("new-hire-view.html")) handleNewHireViewPage();
    else if (path.includes("pricing.html")) handlePricingPage();
    else if (path.includes("documents.html")) handleDocumentsPage();
    else if (path.includes("hiring.html")) handleHiringPage();
    else if (path.includes("scheduling.html")) {
        if (typeof moment !== 'undefined') handleSchedulingPage();
        else console.error("Moment.js is not loaded.");
    }
});
