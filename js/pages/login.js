import { apiRequest, showModalMessage } from '../utils.js';

export function handleLoginPage() {
    const loginForm = document.getElementById("login-form");
    if (!loginForm) return;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('sessionExpired')) {
        showModalMessage("Your session has expired. Please log in again.", true);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const errorMessage = document.getElementById("error-message");
        errorMessage.textContent = "";
        errorMessage.classList.remove("visible");

        if (!email || !password) {
            errorMessage.textContent = "Email and password are required.";
            errorMessage.classList.add("visible");
            return;
        }

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
