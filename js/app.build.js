"use strict";

var _login = require("./pages/login.js");
var _dashboard = require("./pages/dashboard.js");
var _checklists = require("./pages/checklists.js");
// js/app.js (Main Router)

// Import other page handlers as you create them...
// import { handleAdminPage } from './pages/admin.js';

function setupSettingsDropdown() {
  var settingsButton = document.getElementById("settings-button");
  var settingsDropdown = document.getElementById("settings-dropdown");
  var logoutButton = document.getElementById("logout-button");
  if (settingsButton && settingsDropdown) {
    settingsButton.addEventListener("click", function (event) {
      event.stopPropagation();
      settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", function (event) {
      if (settingsButton && !settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
        settingsDropdown.style.display = "none";
      }
    });
  }
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userRole");
      window.location.href = "login.html";
    });
  }
}
document.addEventListener("DOMContentLoaded", function () {
  setupSettingsDropdown();
  var path = window.location.pathname;
  if (path.includes("login.html")) (0, _login.handleLoginPage)();else if (path.includes("dashboard.html")) (0, _dashboard.handleDashboardPage)();else if (path.includes("checklists.html")) (0, _checklists.handleChecklistsPage)();
  // Add other routes here...
  // else if (path.includes("admin.html")) handleAdminPage();
});
