// js/app.js (Main Router)
import { handleLoginPage } from './pages/login.js';
import { handleDashboardPage } from './pages/dashboard.js';
import { handleChecklistsPage } from './pages/checklists.js';
import { handleAdminPage } from './pages/admin.js';
import { handleAccountPage } from './pages/account.js';
import { handleDocumentsPage } from './pages/documents.js';
import { handleHiringPage } from './pages/hiring.js';
import { handleSchedulingPage } from './pages/scheduling.js';
// Note: We will add a handler for new-hire-view.html later if needed.

/**
 * Sets up the functionality for the global settings dropdown menu.
 */
function setupSettingsDropdown() {
    const settingsButton = document.getElementById("settings-button");
    const settingsDropdown = document.getElementById("settings-dropdown");
    const logoutButton = document.getElementById("logout-button");

    if (settingsButton && settingsDropdown) {
        settingsButton.addEventListener("click", event => {
            // Stop the click from closing the dropdown immediately
            event.stopPropagation();
            settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";
        });

        // Add a click listener to the whole document to close the dropdown
        // if the user clicks anywhere else on the page.
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


/**
 * Main application entry point. This function runs when the DOM is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
    // Set up global components that appear on multiple pages
    setupSettingsDropdown();

    // Get the current page's path to determine which logic to run
    const path = window.location.pathname;

    // --- Simple Page Router ---
    if (path.includes("login.html")) {
        handleLoginPage();
    } else if (path.includes("dashboard.html")) {
        handleDashboardPage();
    } else if (path.includes("checklists.html")) {
        handleChecklistsPage();
    } else if (path.includes("admin.html")) {
        handleAdminPage();
    } else if (path.includes("account.html")) {
        handleAccountPage();
    } else if (path.includes("documents.html")) {
        handleDocumentsPage();
    } else if (path.includes("hiring.html")) {
        handleHiringPage();
    } else if (path.includes("scheduling.html")) {
        handleSchedulingPage();
    }
    // Add any other page handlers here.
});
