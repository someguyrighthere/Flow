// js/pages/register.js
import { apiRequest, showModalMessage } from '../utils.js';

export function handleRegisterPage() {
    const registerForm = document.getElementById("register-form");
    if (!registerForm) return;

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const companyName = document.getElementById("company-name").value.trim();
        const fullName = document.getElementById("full-name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const errorMessage = document.getElementById("error-message");

        errorMessage.textContent = "";
        errorMessage.classList.remove("visible");

        if (!companyName || !fullName || !email || !password) {
            errorMessage.textContent = "All fields are required.";
            errorMessage.classList.add("visible");
            return;
        }

        try {
            const data = await apiRequest("POST", "/api/register", { companyName, fullName, email, password });
            if (data && data.message) {
                showModalMessage(data.message, false);
                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 2000);
            } else {
                throw new Error("Registration failed. Please try again.");
            }
        } catch (error) {
            errorMessage.textContent = `Registration Failed: ${error.message}`;
            errorMessage.classList.add("visible");
        }
    });
}
