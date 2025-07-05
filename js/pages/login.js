// js/pages/login.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles all logic for the login page.
 */
export function handleLoginPage() {
    const loginForm = document.getElementById("login-form");
    const errorMessage = document.getElementById("error-message"); // Get error message element

    // If login form is not found, exit the function
    if (!loginForm) return;

    // Check for session expired message in URL and display modal if present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('sessionExpired')) {
        showModalMessage("Your session has expired. Please log in again.", true);
        // Clean the URL to remove the query parameter after displaying the message
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Add event listener for the login form submission
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevent default form submission

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        
        // Clear previous error messages
        errorMessage.textContent = "";
        errorMessage.classList.remove("visible"); // Hide the error message element

        // Basic client-side validation
        if (!email || !password) {
            errorMessage.textContent = "Email and password are required.";
            errorMessage.classList.add("visible"); // Show the error message element
            return;
        }

        try {
            // Send login credentials to the backend API
            const data = await apiRequest("POST", "/api/login", { email, password });
            
            // If login is successful and a token is received
            if (data && data.token) {
                localStorage.setItem("authToken", data.token); // Store authentication token
                localStorage.setItem("userRole", data.role);   // Store user role
                // Debugging: Log what's being stored
                console.log('[login.js] Login successful. Stored authToken and userRole.');
                console.log('[login.js] Stored Role:', data.role);
                console.log('[login.js] Stored Token (first 20 chars):', data.token.substring(0, 20) + '...');


                // Redirect based on user role
                const destination = (data.role === "super_admin" || data.role === "location_admin") 
                                    ? "suite-hub.html" // Admins go to the app hub
                                    : "new-hire-view.html"; // Regular employees go to their onboarding view
                window.location.href = destination;
            } else {
                 // If no data or token, throw a generic login failed error
                 throw new Error("Login failed. Please check your credentials.");
            }
        } catch (error) {
            // Display API error message or a generic one if no specific message
            errorMessage.textContent = `Login Failed: ${error.message}`;
            errorMessage.classList.add("visible"); // Show the error message element
            console.error('Login error:', error);
        }
    });
}