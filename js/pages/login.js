// js/pages/login.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles all logic for the login page.
 */
export function handleLoginPage() {
    const loginForm = document.getElementById("login-form");
    if (!loginForm) return;

    // Check for session expiration from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('sessionExpired')) {
        showModalMessage("Your session has expired. Please log in again.", true);
        // Clean the URL to remove the parameter after showing the message
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const errorMessage = document.getElementById("error-message");
        
        // Hide previous error messages
        errorMessage.textContent = "";
        errorMessage.classList.remove("visible");

        if (!email || !password) {
            errorMessage.textContent = "Email and password are required.";
            errorMessage.classList.add("visible");
            return;
        }

        try {
            const data = await apiRequest("POST", "/login", { email, password });
            if (data && data.token) {
                localStorage.setItem("authToken", data.token);
                localStorage.setItem("userRole", data.role);
                // Redirect based on role
                const destination = (data.role === "super_admin" || data.role === "location_admin") 
                                    ? "suite-hub.html" 
                                    : "new-hire-view.html";
                window.location.href = destination;
            } else {
                 throw new Error("Login failed. Please check your credentials.");
            }
        } catch (error) {
            errorMessage.textContent = `Login Failed: ${error.message}`;
            errorMessage.classList.add("visible");
        }
    });
}
