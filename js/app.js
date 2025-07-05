// js/app.js (Main Router - Self-Starting) - DEFINITIVE VERSION

// Import all page handlers using ESM import syntax for browser compatibility
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
import { handleSuiteHubPage } from './pages/suiteHub.js';
import { handlePricingPage } from './pages/pricing.js';

/**
 * Sets up the settings dropdown menu on pages that have it.
 */
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

/**
 * This is the main function for the application. It acts as a router,
 * determining which page is currently active and calling the appropriate
 * logic for it.
 */
function main() {
    const path = window.location.pathname;

    // A list of pages that have the main header with the settings dropdown
    const pagesWithSettings = [
        "suite-hub.html", "dashboard.html", "checklists.html", "admin.html",
        "account.html", "documents.html", "hiring.html", "scheduling.html"
    ];

    // Setup the dropdown if the current page needs it
    if (pagesWithSettings.some(p => path.includes(p))) {
        setupSettingsDropdown();
    }

    // Route to the correct page handler based on the URL
    if (path.includes("login.html")) handleLoginPage();
    else if (path.includes("register.html")) handleRegisterPage();
    else if (path.includes("suite-hub.html")) handleSuiteHubPage();
    else if (path.includes("dashboard.html")) handleDashboardPage();
    else if (path.includes("checklists.html")) handleChecklistsPage();
    else if (path.includes("admin.html")) handleAdminPage();
    else if (path.includes("account.html")) handleAccountPage();
    else if (path.includes("documents.html")) handleDocumentsPage();
    else if (path.includes("hiring.html")) handleHiringPage();
    else if (path.includes("scheduling.html")) handleSchedulingPage();
    else if (path.includes("apply.html")) handleApplyPage();
    else if (path.includes("new-hire-view.html")) handleOnboardingViewPage();
    else if (path.includes("pricing.html")) handlePricingPage();
}

// --- AUTOMATIC STARTUP ---
// This event listener waits for the HTML document to be fully loaded and ready,
// and then it automatically calls our main function.
document.addEventListener('DOMContentLoaded', main);