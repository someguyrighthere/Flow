// js/pages/register.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles all logic for the registration page.
 */
export function handleRegisterPage() {
    const registerForm = document.getElementById("register-form");
    const errorMessage = document.getElementById("error-message"); // Get error message element

    // If register form is not found, exit the function
    if (!registerForm) return;

    // Add event listener for the registration form submission
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevent default form submission

        const companyName = document.getElementById("company-name").value.trim();
        const fullName = document.getElementById("full-name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        
        // Clear previous error messages
        errorMessage.textContent = "";
        errorMessage.classList.remove("visible"); // Hide the error message element

        // Basic client-side validation
        if (!companyName || !fullName || !email || !password) {
            errorMessage.textContent = "All fields are required.";
            errorMessage.classList.add("visible"); // Show the error message element
            return;
        }

        try {
            // Send registration data to the backend API
            const data = await apiRequest("POST", "/api/register", { companyName, fullName, email, password });
            
            // If registration is successful
            if (data && data.message) {
                showModalMessage(data.message, false); // Show success message
                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 2000); // 2-second delay before redirecting
            } else {
                // If no data or message, throw a generic registration failed error
                throw new Error("Registration failed. Please try again.");
            }
        } catch (error) {
            // Display API error message or a generic one if no specific message
            errorMessage.textContent = `Registration Failed: ${error.message}`;
            errorMessage.classList.add("visible"); // Show the error message element
            console.error('Registration error:', error);
        }
    });
}
