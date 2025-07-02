// js/app.js (Main Router - Designed for Bundling)

// Import all page handlers
import { handleLoginPage } from './pages/login.js';
import { handleRegisterPage } from './pages/register.js';
import { handleDashboardPage } from './pages/dashboard.js';
import { handleChecklistsPage } from './pages/checklists.js';
import { handleAdminPage } from './pages/admin.js';
import { handleAccountPage } from './pages/account.js';
import { handleDocumentsPage } from './pages/documents.js';
import { handleHiringPage } from './pages/hiring.js';
import { handleSchedulingPage } from './pages/scheduling.js';
import { handleApplyPage } from './pages/apply.js';
import { handleOnboardingViewPage } from './pages/onboardingView.js';
import { handleSuiteHubPage } from './pages/suiteHub.js'; // Missing semicolon was likely here

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
            localStorage.removeItem('userId');
            console.log('User logged out. Local storage cleared.');
            window.location.href = "login.html";
        });
    }
}

// This function will be called globally by the HTML pages
// It acts as the central router for client-side logic
window.initializePage = () => { // Expose initializePage globally
    setupSettingsDropdown();
    const path = window.location.pathname;

    if (path.includes("login.html")) {
        handleLoginPage();
    } else if (path.includes("register.html")) {
        handleRegisterPage();
    } else if (path.includes("suite-hub.html")) {
        handleSuiteHubPage();
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
    } else if (path.includes("apply.html")) {
        handleApplyPage();
    } else if (path.includes("new-hire-view.html")) {
        handleOnboardingViewPage();
    }
};

// Call initializePage when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    window.initializePage();
});
