// js/app.js (Main Router)
import { handleLoginPage } from './pages/login.js';
import { handleDashboardPage } from './pages/dashboard.js';
import { handleChecklistsPage } from './pages/checklists.js';
// Import other page handlers as you create them...
// import { handleAdminPage } from './pages/admin.js';

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


document.addEventListener("DOMContentLoaded", () => {
    setupSettingsDropdown();
    const path = window.location.pathname;

    if (path.includes("login.html")) handleLoginPage();
    else if (path.includes("dashboard.html")) handleDashboardPage();
    else if (path.includes("checklists.html")) handleChecklistsPage();
    // Add other routes here...
    // else if (path.includes("admin.html")) handleAdminPage();
});
