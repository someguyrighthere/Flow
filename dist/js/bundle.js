(() => {
  // js/utils.js
  var API_BASE_URL = "https://flow-gz1r.onrender.com";
  function showModalMessage(message, isError = false) {
    const modalOverlay = document.getElementById("modal-message");
    const modalMessageText = document.getElementById("modal-text");
    const modalOkButton = document.getElementById("modal-ok-button");
    if (!modalOverlay || !modalMessageText || !modalOkButton) {
      console.error("A modal element not found for showModalMessage:", message);
      alert(message);
      return;
    }
    const hideModal = () => {
      modalOverlay.style.display = "none";
    };
    const hideModalOutside = (event) => {
      if (event.target === modalOverlay) hideModal();
    };
    modalOkButton.removeEventListener("click", hideModal);
    modalOverlay.removeEventListener("click", hideModalOutside);
    modalMessageText.textContent = message;
    modalMessageText.style.color = isError ? "#ff8a80" : "var(--text-light)";
    modalOverlay.style.display = "flex";
    modalOkButton.addEventListener("click", hideModal);
    modalOverlay.addEventListener("click", hideModalOutside);
  }
  function showConfirmModal(message, confirmButtonText = "Confirm") {
    return new Promise((resolve) => {
      const confirmModalOverlay = document.getElementById("confirm-modal");
      const confirmModalMessage = document.getElementById("confirm-modal-text");
      const modalConfirmButton = document.getElementById("confirm-modal-confirm");
      const modalCancelButton = document.getElementById("confirm-modal-cancel");
      if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
        console.error("Confirmation modal elements not found. Falling back to browser's confirm.");
        resolve(window.confirm(message));
        return;
      }
      confirmModalMessage.innerHTML = message;
      modalConfirmButton.textContent = confirmButtonText;
      confirmModalOverlay.style.display = "flex";
      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };
      const handleCancel = () => {
        cleanup();
        resolve(false);
      };
      const handleClickOutside = (event) => {
        if (event.target === confirmModalOverlay) {
          cleanup();
          resolve(false);
        }
      };
      const cleanup = () => {
        modalConfirmButton.removeEventListener("click", handleConfirm);
        modalCancelButton.removeEventListener("click", handleCancel);
        confirmModalOverlay.removeEventListener("click", handleClickOutside);
        confirmModalOverlay.style.display = "none";
      };
      modalConfirmButton.addEventListener("click", handleConfirm);
      modalCancelButton.addEventListener("click", handleCancel);
      confirmModalOverlay.addEventListener("click", handleClickOutside);
    });
  }
  async function apiRequest(method, path, body = null, isFormData = false, onProgress = null) {
    const token = localStorage.getItem("authToken");
    const endpoint = `${API_BASE_URL}${path}`;
    const logoutUser = (message) => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userId");
      showModalMessage(message, true);
      setTimeout(() => {
        window.location.href = "login.html?sessionExpired=true";
      }, 1500);
    };
    const options = {
      method,
      headers: {},
      cache: "no-cache"
    };
    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }
    if (body) {
      if (isFormData) {
        options.body = body;
      } else {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
    }
    try {
      const response = await fetch(endpoint, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        if (response.status === 401 && (errorData.error === "Authentication failed." || errorData.error === "Invalid token.")) {
          logoutUser("Your session has expired. Please log in again.");
          throw new Error("Authentication failed.");
        } else {
          throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
      }
      if (response.status === 204) {
        return null;
      }
      return response.json();
    } catch (error) {
      console.error("API Request caught error:", error);
      throw error;
    }
  }

  // js/pages/login.js
  function handleLoginPage() {
    const loginForm = document.getElementById("login-form");
    const errorMessage = document.getElementById("error-message");
    if (!loginForm) return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("sessionExpired")) {
      showModalMessage("Your session has expired. Please log in again.", true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      errorMessage.textContent = "";
      errorMessage.classList.remove("visible");
      if (!email || !password) {
        errorMessage.textContent = "Email and password are required.";
        errorMessage.classList.add("visible");
        return;
      }
      try {
        const data = await apiRequest("POST", "/api/login", { email, password });
        if (data && data.token) {
          localStorage.setItem("authToken", data.token);
          localStorage.setItem("userRole", data.role);
          console.log("[login.js] Login successful. Stored authToken and userRole.");
          console.log("[login.js] Stored Role:", data.role);
          console.log("[login.js] Stored Token (first 20 chars):", data.token.substring(0, 20) + "...");
          const destination = data.role === "super_admin" || data.role === "location_admin" ? "suite-hub.html" : "new-hire-view.html";
          window.location.href = destination;
        } else {
          throw new Error("Login failed. Please check your credentials.");
        }
      } catch (error) {
        errorMessage.textContent = `Login Failed: ${error.message}`;
        errorMessage.classList.add("visible");
        console.error("Login error:", error);
      }
    });
  }

  // js/pages/register.js
  function handleRegisterPage() {
    const registerForm = document.getElementById("register-form");
    const errorMessage = document.getElementById("error-message");
    if (!registerForm) return;
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const companyName = document.getElementById("company-name").value.trim();
      const fullName = document.getElementById("full-name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
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
          setTimeout(() => {
            window.location.href = "login.html";
          }, 2e3);
        } else {
          throw new Error("Registration failed. Please try again.");
        }
      } catch (error) {
        errorMessage.textContent = `Registration Failed: ${error.message}`;
        errorMessage.classList.add("visible");
        console.error("Registration error:", error);
      }
    });
  }

  // js/pages/dashboard.js
  function handleDashboardPage() {
    if (!localStorage.getItem("authToken")) {
      window.location.href = "login.html";
      return;
    }
    const onboardUserModal = document.getElementById("onboard-user-modal");
    const onboardUserForm = document.getElementById("onboard-user-form");
    const showOnboardModalBtn = document.getElementById("show-onboard-modal");
    const modalCancelBtn = document.getElementById("modal-cancel-onboard");
    const existingEmployeeSelect = document.getElementById("existing-employee-select");
    const assignedTaskListInfo = document.getElementById("assigned-task-list-info");
    const onboardModalStatusMessage = document.getElementById("onboard-modal-status-message");
    const pendingCountEl = document.getElementById("pending-onboards-count");
    const inProgressCountEl = document.getElementById("in-progress-count");
    const completedCountEl = document.getElementById("completed-count");
    const activityListEl = document.getElementById("activity-list");
    let allUsers = [];
    let allChecklists = [];
    const displayStatusMessage = (element, message, isError = false) => {
      if (!element) return;
      element.textContent = message;
      element.className = isError ? "error" : "success";
      setTimeout(() => element.textContent = "", 5e3);
    };
    async function loadDashboardData() {
      try {
        const [users, checklists, tasks] = await Promise.all([
          apiRequest("GET", "/api/users"),
          apiRequest("GET", "/api/checklists"),
          apiRequest("GET", "/api/onboarding-tasks")
        ]);
        allUsers = users;
        allChecklists = checklists;
        updateStats(tasks);
        updateActivityFeed(tasks);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        showModalMessage("Could not load all dashboard data.", true);
      }
    }
    function updateStats(tasks) {
      const userTasks = {};
      tasks.forEach((task) => {
        if (!userTasks[task.user_id]) {
          userTasks[task.user_id] = { total: 0, completed: 0 };
        }
        userTasks[task.user_id].total++;
        if (task.completed) {
          userTasks[task.user_id].completed++;
        }
      });
      let pending = 0, inProgress = 0, completed = 0;
      Object.values(userTasks).forEach((status) => {
        if (status.completed === 0) pending++;
        else if (status.completed === status.total) completed++;
        else inProgress++;
      });
      if (pendingCountEl) pendingCountEl.textContent = pending;
      if (inProgressCountEl) inProgressCountEl.textContent = inProgress;
      if (completedCountEl) completedCountEl.textContent = completed;
    }
    function updateActivityFeed(tasks) {
      if (!activityListEl) return;
      activityListEl.innerHTML = "";
      const recentTasks = tasks.filter((t) => t.completed).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 5);
      if (recentTasks.length === 0) {
        const placeholder = document.getElementById("activity-feed-placeholder");
        if (placeholder) placeholder.style.display = "block";
      } else {
        recentTasks.forEach((task) => {
          const li = document.createElement("li");
          li.innerHTML = `<strong>${task.user_name}</strong> completed task: "${task.description}"`;
          activityListEl.appendChild(li);
        });
      }
    }
    async function populateEmployeeDropdown() {
      if (!existingEmployeeSelect) return;
      const unassignedUsers = allUsers.filter((user) => user.role === "employee");
      existingEmployeeSelect.innerHTML = '<option value="">Select an employee...</option>';
      unassignedUsers.forEach((user) => {
        const option = new Option(user.full_name, user.user_id);
        existingEmployeeSelect.add(option);
      });
    }
    if (showOnboardModalBtn) {
      showOnboardModalBtn.addEventListener("click", () => {
        populateEmployeeDropdown();
        if (onboardUserModal) onboardUserModal.style.display = "flex";
      });
    }
    if (modalCancelBtn) {
      modalCancelBtn.addEventListener("click", () => {
        if (onboardUserModal) onboardUserModal.style.display = "none";
      });
    }
    if (existingEmployeeSelect) {
      existingEmployeeSelect.addEventListener("change", () => {
        if (!assignedTaskListInfo) return;
        const selectedUserId = existingEmployeeSelect.value;
        const selectedEmployee = allUsers.find((user) => String(user.user_id) === String(selectedUserId));
        const position = selectedEmployee ? selectedEmployee.position : null;
        if (position) {
          const matchingChecklist = allChecklists.find((c) => c.position && c.position.toLowerCase() === position.toLowerCase());
          assignedTaskListInfo.textContent = matchingChecklist ? `Will be assigned: "${matchingChecklist.title}"` : `No task list found for position: "${position}"`;
        } else {
          assignedTaskListInfo.textContent = "Selected employee has no position set.";
        }
      });
    }
    if (onboardUserForm) {
      onboardUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const selectedUserId = existingEmployeeSelect.value;
        if (!selectedUserId) {
          displayStatusMessage(onboardModalStatusMessage, "Please select an employee.", true);
          return;
        }
        const selectedEmployee = allUsers.find((user) => String(user.user_id) === String(selectedUserId));
        if (!selectedEmployee) {
          displayStatusMessage(onboardModalStatusMessage, "Selected employee not found. Please try again.", true);
          return;
        }
        const employeePosition = selectedEmployee.position;
        if (!employeePosition) {
          displayStatusMessage(onboardModalStatusMessage, `This employee does not have a position set and cannot be assigned a task list.`, true);
          return;
        }
        const matchingChecklist = allChecklists.find(
          (checklist) => checklist.position && checklist.position.toLowerCase() === employeePosition.toLowerCase()
        );
        if (!matchingChecklist) {
          displayStatusMessage(onboardModalStatusMessage, `No task list found for position: "${employeePosition}". Please create one in Admin Settings > Task Lists.`, true);
          return;
        }
        try {
          await apiRequest("POST", "/api/onboarding-tasks", {
            user_id: selectedUserId,
            checklist_id: matchingChecklist.id
          });
          displayStatusMessage(onboardModalStatusMessage, `Task list "${matchingChecklist.title}" assigned to ${selectedEmployee.full_name} successfully!`, false);
          onboardUserForm.reset();
          assignedTaskListInfo.textContent = "";
          setTimeout(() => {
            if (onboardUserModal) onboardUserModal.style.display = "none";
          }, 1500);
          loadDashboardData();
        } catch (error) {
          displayStatusMessage(onboardModalStatusMessage, `Error assigning task list: ${error.message}`, true);
          console.error("Error assigning task list:", error);
        }
      });
    }
    loadDashboardData();
  }

  // js/pages/checklists.js
  function handleChecklistsPage() {
    if (!localStorage.getItem("authToken")) {
      window.location.href = "login.html";
      return;
    }
    const addTaskBtn = document.getElementById("add-task-btn");
    const tasksInputArea = document.getElementById("tasks-input-area");
    const newChecklistForm = document.getElementById("new-checklist-form");
    const checklistListDiv = document.getElementById("checklist-list");
    const attachDocumentModalOverlay = document.getElementById("attach-document-modal-overlay");
    const attachDocumentListDiv = document.getElementById("attach-document-list");
    const attachDocumentCancelBtn = document.getElementById("attach-document-cancel-btn");
    let taskCounter = 0;
    let currentTaskElement = null;
    const addNewTaskField = () => {
      if (!tasksInputArea) return;
      const taskGroup = document.createElement("div");
      taskGroup.className = "form-group task-input-group";
      const inputId = `task-input-${taskCounter++}`;
      taskGroup.innerHTML = `
            <div style="display: flex; align-items: flex-end; gap: 10px;">
                <div style="flex-grow: 1;">
                    <label for="${inputId}">Task Description</label>
                    <input type="text" id="${inputId}" class="task-description-input" required placeholder="Enter a task">
                </div>
                <div class="task-actions" style="display: flex; align-items: flex-end; gap: 5px; margin-bottom: 0;">
                    <button type="button" class="btn btn-secondary btn-sm attach-file-btn">Attach</button>
                    <button type="button" class="btn btn-secondary btn-sm remove-task-btn">Remove</button>
                </div>
            </div>
            <div class="attached-document-info" style="font-size: 0.8rem; color: var(--text-medium); margin-top: 5px; height: 1.2em;"></div>
        `;
      tasksInputArea.appendChild(taskGroup);
      taskGroup.querySelector(".remove-task-btn").addEventListener("click", () => {
        if (tasksInputArea.children.length > 1) {
          taskGroup.remove();
        } else {
          showModalMessage("A task list must have at least one task.", true);
        }
      });
    };
    const loadChecklists = async () => {
      if (!checklistListDiv) return;
      checklistListDiv.innerHTML = `<p style="color: var(--text-medium);">Loading...</p>`;
      try {
        const checklists = await apiRequest("GET", "/api/checklists");
        checklistListDiv.innerHTML = "";
        if (checklists && checklists.length > 0) {
          checklists.forEach((checklist) => {
            const item = document.createElement("div");
            item.className = "list-item";
            item.innerHTML = `<span><strong>${checklist.title}</strong> (For: ${checklist.position})</span>`;
            checklistListDiv.appendChild(item);
          });
        } else {
          checklistListDiv.innerHTML = `<p style="color: var(--text-medium);">No task lists created yet.</p>`;
        }
      } catch (e) {
        checklistListDiv.innerHTML = `<p style="color:red;">Could not load task lists: ${e.message}</p>`;
        console.error("Error loading checklists:", e);
      }
    };
    const loadDocumentsForAttachModal = async () => {
      if (!attachDocumentListDiv) return;
      attachDocumentListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading documents...</p>';
      try {
        const documents = await apiRequest("GET", "/api/documents");
        attachDocumentListDiv.innerHTML = "";
        if (documents && documents.length > 0) {
          documents.forEach((doc) => {
            const docItem = document.createElement("div");
            docItem.className = "document-list-item";
            docItem.dataset.documentId = doc.document_id;
            docItem.dataset.documentName = doc.file_name;
            docItem.innerHTML = `
                        <span>${doc.title} (<small>${doc.file_name}</small>)</span>
                        <button class="btn btn-primary btn-sm select-document-btn">Select</button>
                    `;
            attachDocumentListDiv.appendChild(docItem);
          });
          attachDocumentListDiv.querySelectorAll(".select-document-btn").forEach((button) => {
            button.addEventListener("click", (e) => {
              const selectedDocItem = e.target.closest(".document-list-item");
              const documentId = selectedDocItem.dataset.documentId;
              const documentName = selectedDocItem.dataset.documentName;
              attachDocumentToTask(documentId, documentName);
              attachDocumentModalOverlay.style.display = "none";
            });
          });
        } else {
          attachDocumentListDiv.innerHTML = '<p style="color: var(--text-medium);">No documents available to attach. Upload some in the Documents section.</p>';
        }
      } catch (error) {
        attachDocumentListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading documents: ${error.message}</p>`;
        console.error("Error loading documents for modal:", error);
      }
    };
    const attachDocumentToTask = (documentId, documentName) => {
      if (currentTaskElement) {
        currentTaskElement.dataset.attachedDocumentId = documentId;
        currentTaskElement.dataset.attachedDocumentName = documentName;
        const infoDiv = currentTaskElement.querySelector(".attached-document-info");
        if (infoDiv) {
          infoDiv.innerHTML = `Attached: <a href="/uploads/${encodeURIComponent(documentName)}" target="_blank" style="color: var(--primary-accent);">${documentName}</a>`;
        }
      }
    };
    if (addTaskBtn) {
      addTaskBtn.addEventListener("click", addNewTaskField);
    }
    if (tasksInputArea) {
      tasksInputArea.addEventListener("click", (e) => {
        const attachButton = e.target.closest(".attach-file-btn");
        if (attachButton) {
          currentTaskElement = attachButton.closest(".task-input-group");
          if (attachDocumentModalOverlay) {
            attachDocumentModalOverlay.style.display = "flex";
            loadDocumentsForAttachModal();
          }
        }
      });
    }
    if (attachDocumentCancelBtn) {
      attachDocumentCancelBtn.addEventListener("click", () => {
        if (attachDocumentModalOverlay) {
          attachDocumentModalOverlay.style.display = "none";
        }
      });
    }
    if (newChecklistForm) {
      newChecklistForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const tasks = [];
        document.querySelectorAll(".task-input-group").forEach((taskGroup) => {
          const descriptionInput = taskGroup.querySelector(".task-description-input");
          if (descriptionInput && descriptionInput.value.trim()) {
            const task = { description: descriptionInput.value.trim() };
            if (taskGroup.dataset.attachedDocumentId) {
              task.documentId = taskGroup.dataset.attachedDocumentId;
              task.documentName = taskGroup.dataset.attachedDocumentName;
            }
            tasks.push(task);
          }
        });
        if (tasks.length === 0) {
          showModalMessage("Please add at least one task description.", true);
          return;
        }
        const payload = {
          title: document.getElementById("new-checklist-title").value.trim(),
          position: document.getElementById("new-checklist-position").value.trim(),
          tasks
          // Add structure_type and time_group_count to payload if needed by backend
          // structure_type: document.getElementById('structure-type-select').value,
          // time_group_count: document.getElementById('time-group-count').value,
        };
        try {
          await apiRequest("POST", "/api/checklists", payload);
          showModalMessage("Task list created successfully!", false);
          newChecklistForm.reset();
          tasksInputArea.innerHTML = "";
          addNewTaskField();
          loadChecklists();
        } catch (error) {
          showModalMessage(`Error: ${error.message}`, true);
          console.error("Error creating task list:", error);
        }
      });
    }
    if (tasksInputArea && tasksInputArea.childElementCount === 0) {
      addNewTaskField();
    }
    loadChecklists();
  }

  // js/pages/admin.js
  var DELETE_SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`;
  function handleAdminPage() {
    const authToken = localStorage.getItem("authToken");
    const userRole = localStorage.getItem("userRole");
    if (!authToken || userRole !== "super_admin" && userRole !== "location_admin") {
      window.location.href = "login.html";
      return;
    }
    if (userRole === "location_admin") {
      const inviteAdminCard = document.getElementById("invite-admin-card");
      if (inviteAdminCard) {
        inviteAdminCard.style.display = "none";
      }
      const manageLocationsCard = document.getElementById("manage-locations-card");
      if (manageLocationsCard) {
        manageLocationsCard.style.display = "none";
      }
    }
    const locationListDiv = document.getElementById("location-list");
    const newLocationForm = document.getElementById("new-location-form");
    const newLocationNameInput = document.getElementById("new-location-name");
    const newLocationAddressInput = document.getElementById("new-location-address");
    const newLocationStatusMessage = document.getElementById("new-location-status-message");
    const userListDiv = document.getElementById("user-list");
    const inviteAdminForm = document.getElementById("invite-admin-form");
    const adminLocationSelect = document.getElementById("admin-location-select");
    const inviteAdminStatusMessage = document.getElementById("invite-admin-status-message");
    const inviteEmployeeForm = document.getElementById("invite-employee-form");
    const employeeLocationSelect = document.getElementById("employee-location-select");
    const employeeAvailabilityGrid = document.getElementById("employee-availability-grid");
    const inviteEmployeeStatusMessage = document.getElementById("invite-employee-status-message");
    const businessSettingsForm = document.getElementById("business-settings-form");
    const operatingHoursStartInput = document.getElementById("operating-hours-start");
    const operatingHoursEndInput = document.getElementById("operating-hours-end");
    const currentOperatingHoursDisplay = document.getElementById("current-operating-hours-display");
    const businessSettingsStatusMessage = document.getElementById("business-settings-status-message");
    let businessOperatingStartHour = 0;
    let businessOperatingEndHour = 24;
    function displayStatusMessage(element, message, isError = false) {
      if (!element) return;
      element.innerHTML = message;
      element.classList.remove("success", "error");
      element.classList.add(isError ? "error" : "success");
      setTimeout(() => {
        element.textContent = "";
        element.classList.remove("success", "error");
      }, 5e3);
    }
    function convertTo12Hour(time24) {
      if (!time24) return "N/A";
      const [hour, minute] = time24.split(":");
      const h = parseInt(hour, 10);
      const ampm = h >= 12 ? "PM" : "AM";
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      return `${displayHour}:${minute} ${ampm}`;
    }
    async function loadLocations() {
      if (!locationListDiv) return;
      locationListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading locations...</p>';
      try {
        const locations = await apiRequest("GET", "/api/locations");
        locationListDiv.innerHTML = "";
        if (locations && locations.length > 0) {
          locations.forEach((loc) => {
            const listItem = document.createElement("div");
            listItem.className = "list-item";
            listItem.innerHTML = `
                        <span><strong>${loc.location_name}</strong> (${loc.location_address})</span>
                        <button class="btn-delete" data-id="${loc.location_id}" data-type="location" title="Delete Location">
                            ${DELETE_SVG_ICON}
                        </button>
                    `;
            locationListDiv.appendChild(listItem);
          });
        } else {
          locationListDiv.innerHTML = '<p style="color: var(--text-medium);">No locations added yet.</p>';
        }
      } catch (error) {
        showModalMessage(`Error loading locations: ${error.message}`, true);
        console.error("Error loading locations:", error);
      }
    }
    async function populateLocationDropdowns() {
      if (!adminLocationSelect || !employeeLocationSelect) return;
      try {
        const locations = await apiRequest("GET", "/api/locations");
        adminLocationSelect.innerHTML = '<option value="">Select Location</option>';
        employeeLocationSelect.innerHTML = '<option value="">Select Location</option>';
        if (locations && locations.length > 0) {
          locations.forEach((loc) => {
            const adminOption = new Option(loc.location_name, loc.location_id);
            const employeeOption = new Option(loc.location_name, loc.location_id);
            adminLocationSelect.add(adminOption);
            employeeLocationSelect.add(employeeOption);
          });
        } else {
          adminLocationSelect.innerHTML = '<option value="">No locations available</option>';
          employeeLocationSelect.innerHTML = '<option value="">No locations available</option>';
        }
      } catch (error) {
        console.error("Failed to populate location dropdowns:", error);
        showModalMessage("Failed to load locations for dropdowns. Please try again.", true);
      }
    }
    async function loadUsers() {
      if (!userListDiv) return;
      userListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading users...</p>';
      try {
        const users = await apiRequest("GET", "/api/users");
        userListDiv.innerHTML = "";
        if (users && users.length > 0) {
          const userGroups = {
            super_admin: [],
            location_admin: [],
            employee: []
          };
          users.forEach((user) => {
            if (userGroups[user.role]) {
              userGroups[user.role].push(user);
            }
          });
          const groupOrder = ["super_admin", "location_admin", "employee"];
          const groupTitles = {
            super_admin: "Super Admins",
            location_admin: "Location Admins",
            employee: "Employees"
          };
          groupOrder.forEach((role) => {
            const group = userGroups[role];
            if (group.length > 0) {
              const groupHeader = document.createElement("h4");
              groupHeader.textContent = groupTitles[role];
              userListDiv.appendChild(groupHeader);
              group.forEach((user) => {
                let userDisplayTitle;
                if (user.role === "super_admin") {
                  userDisplayTitle = "Super Admin";
                } else if (user.role === "location_admin") {
                  userDisplayTitle = "Location Admin";
                } else {
                  userDisplayTitle = user.position && user.position.trim() !== "" ? user.position : "N/A";
                }
                const userLocationDisplay = user.location_name && user.location_name.trim() !== "" ? `<br><small style="color:var(--text-medium);">Location: ${user.location_name}</small>` : "";
                const listItem = document.createElement("div");
                listItem.className = "list-item";
                listItem.innerHTML = `
                                <span>
                                    <strong>${user.full_name}</strong> (${userDisplayTitle}) 
                                    ${userLocationDisplay}
                                </span>
                                <button class="btn-delete" data-id="${user.user_id}" data-type="user" title="Delete User">
                                    ${DELETE_SVG_ICON}
                                </button>
                            `;
                userListDiv.appendChild(listItem);
              });
            }
          });
        } else {
          userListDiv.innerHTML = '<p style="color: var(--text-medium);">No users found.</p>';
        }
      } catch (error) {
        showModalMessage(`Error loading users: ${error.message}`, true);
        console.error("Error loading users:", error);
      }
    }
    async function fetchBusinessHours() {
      if (!currentOperatingHoursDisplay || !operatingHoursStartInput || !operatingHoursEndInput) return;
      currentOperatingHoursDisplay.textContent = "Loading current hours...";
      try {
        const settings = await apiRequest("GET", "/api/settings/business");
        if (settings) {
          businessOperatingStartHour = parseInt((settings.operating_hours_start || "00:00").split(":")[0], 10);
          businessOperatingEndHour = parseInt((settings.operating_hours_end || "24:00").split(":")[0], 10);
          operatingHoursStartInput.value = settings.operating_hours_start || "";
          operatingHoursEndInput.value = settings.operating_hours_end || "";
          const displayStart = convertTo12Hour(settings.operating_hours_start);
          const displayEnd = convertTo12Hour(settings.operating_hours_end);
          currentOperatingHoursDisplay.textContent = `Current: ${displayStart} - ${displayEnd}`;
          currentOperatingHoursDisplay.style.color = "var(--text-light)";
          generateAvailabilityInputs();
        } else {
          currentOperatingHoursDisplay.textContent = "Current hours: Not set";
          currentOperatingHoursDisplay.style.color = "var(--text-medium)";
          generateAvailabilityInputs();
        }
      } catch (error) {
        console.error("Failed to fetch business hours, using defaults:", error);
        currentOperatingHoursDisplay.textContent = `Error loading current hours: ${error.message}`;
        currentOperatingHoursDisplay.style.color = "#ff8a80";
        generateAvailabilityInputs();
      }
    }
    function generateAvailabilityInputs() {
      if (!employeeAvailabilityGrid) return;
      employeeAvailabilityGrid.innerHTML = "";
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      days.forEach((day) => {
        const dayId = day.toLowerCase();
        const availabilityHtml = `
                <label for="avail-${dayId}-start">${day}</label>
                <div class="time-range">
                    <select id="avail-${dayId}-start" data-day="${dayId}" data-type="start">
                        ${generateTimeOptions(businessOperatingStartHour, businessOperatingEndHour)}
                    </select>
                    <span>-</span>
                    <select id="avail-${dayId}-end" data-day="${dayId}" data-type="end">
                        ${generateTimeOptions(businessOperatingStartHour, businessOperatingEndHour)}
                    </select>
                </div>
            `;
        const div = document.createElement("div");
        div.className = "availability-day";
        div.innerHTML = availabilityHtml;
        employeeAvailabilityGrid.appendChild(div);
      });
    }
    function generateTimeOptions(startHour = 0, endHour = 24) {
      let options = '<option value="">Not Available</option>';
      for (let i = startHour; i <= endHour; i++) {
        const hour24 = i;
        const displayHour = hour24 % 12 === 0 ? 12 : hour24 % 12;
        const ampm = hour24 < 12 ? "AM" : "PM";
        const timeValue = `${String(hour24).padStart(2, "0")}:00`;
        const displayText = `${displayHour}:00 ${ampm}`;
        options += `<option value="${timeValue}">${displayText}</option>`;
      }
      return options;
    }
    if (newLocationForm) {
      newLocationForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const locationData = {
          location_name: newLocationNameInput.value.trim(),
          location_address: newLocationAddressInput.value.trim()
        };
        if (!locationData.location_name || !locationData.location_address) {
          return displayStatusMessage(newLocationStatusMessage, "Location name and address are required.", true);
        }
        try {
          await apiRequest("POST", "/api/locations", locationData);
          displayStatusMessage(newLocationStatusMessage, "Location created successfully!", false);
          newLocationForm.reset();
          loadLocations();
          populateLocationDropdowns();
        } catch (error) {
          displayStatusMessage(newLocationStatusMessage, `Error creating location: ${error.message}`, true);
          console.error("Error creating location:", error);
        }
      });
    }
    const handleDelete = async (e) => {
      const deleteBtn = e.target.closest(".btn-delete");
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        const type = deleteBtn.dataset.type;
        let confirmMessage = `Are you sure you want to delete this ${type}? This action cannot be undone.`;
        if (type === "location") {
          confirmMessage = `Are you sure you want to delete this location? All users associated with this location must be reassigned or deleted first. This cannot be undone.`;
        } else if (type === "user") {
          confirmMessage = `Are you sure you want to delete this user? This will also remove any onboarding tasks assigned to them. This cannot be undone.`;
        }
        const confirmed = await showConfirmModal(confirmMessage);
        if (confirmed) {
          try {
            await apiRequest("DELETE", `/api/${type}s/${id}`);
            showModalMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully.`, false);
            if (type === "location") {
              loadLocations();
              populateLocationDropdowns();
            } else if (type === "user") {
              loadUsers();
            }
          } catch (error) {
            showModalMessage(`Error deleting ${type}: ${error.message}`, true);
            console.error(`Error deleting ${type}:`, error);
          }
        }
      }
    };
    if (locationListDiv) locationListDiv.addEventListener("click", handleDelete);
    if (userListDiv) userListDiv.addEventListener("click", handleDelete);
    if (inviteAdminForm) {
      inviteAdminForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const adminData = {
          full_name: document.getElementById("admin-name").value.trim(),
          email: document.getElementById("admin-email").value.trim(),
          password: document.getElementById("admin-password").value,
          location_id: adminLocationSelect.value || null
        };
        if (!adminData.full_name || !adminData.email || !adminData.password || !adminData.location_id) {
          return displayStatusMessage(inviteAdminStatusMessage, "Full name, email, password, and location are required.", true);
        }
        try {
          await apiRequest("POST", "/api/invite-admin", adminData);
          displayStatusMessage(inviteAdminStatusMessage, "Admin invited successfully!", false);
          inviteAdminForm.reset();
          loadUsers();
        } catch (error) {
          displayStatusMessage(inviteAdminStatusMessage, `Error: ${error.message}`, true);
          console.error("Error inviting admin:", error);
        }
      });
    }
    if (inviteEmployeeForm) {
      inviteEmployeeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const availability = {};
        if (employeeAvailabilityGrid) {
          document.querySelectorAll("#employee-availability-grid select").forEach((select) => {
            const day = select.dataset.day;
            const type = select.dataset.type;
            if (select.value) {
              if (!availability[day]) availability[day] = {};
              availability[day][type] = select.value;
            }
          });
        }
        const employeeData = {
          full_name: document.getElementById("employee-name").value.trim(),
          email: document.getElementById("employee-email").value.trim(),
          password: document.getElementById("employee-password").value,
          position: document.getElementById("employee-position").value.trim(),
          employee_id: document.getElementById("employee-id").value.trim(),
          // Ensure this element exists in HTML
          employment_type: document.getElementById("employee-type").value,
          // Ensure this element exists in HTML
          location_id: employeeLocationSelect.value || null,
          availability: Object.keys(availability).length > 0 ? availability : null
          // Send as JSON object or null
        };
        if (!employeeData.full_name || !employeeData.email || !employeeData.password || !employeeData.location_id) {
          return displayStatusMessage(inviteEmployeeStatusMessage, "Name, email, password, and location are required.", true);
        }
        try {
          await apiRequest("POST", "/api/invite-employee", employeeData);
          displayStatusMessage(inviteEmployeeStatusMessage, "Employee invited successfully!", false);
          inviteEmployeeForm.reset();
          if (employeeAvailabilityGrid) {
            generateAvailabilityInputs();
          }
          loadUsers();
        } catch (error) {
          displayStatusMessage(inviteEmployeeStatusMessage, `Error: ${error.message}`, true);
          console.error("Error inviting employee:", error);
        }
      });
    }
    if (businessSettingsForm) {
      businessSettingsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const start_time = operatingHoursStartInput.value;
        const end_time = operatingHoursEndInput.value;
        if (!start_time || !end_time) {
          displayStatusMessage(businessSettingsStatusMessage, "Both start and end times are required.", true);
          return;
        }
        try {
          await apiRequest("PUT", "/api/settings/business", {
            operating_hours_start: start_time,
            operating_hours_end: end_time
          });
          displayStatusMessage(businessSettingsStatusMessage, "Operating hours updated successfully!", false);
          fetchBusinessHours();
        } catch (error) {
          displayStatusMessage(businessSettingsStatusMessage, `Error updating hours: ${error.message}`, true);
          console.error("Error updating business settings:", error);
        }
      });
    }
    fetchBusinessHours().then(() => {
      loadLocations();
      populateLocationDropdowns();
      loadUsers();
    });
  }

  // js/pages/account.js
  function handleAccountPage() {
    if (!localStorage.getItem("authToken")) {
      window.location.href = "login.html";
      return;
    }
    const displaySubscriptionPlan = document.getElementById("display-subscription-plan");
    const updateProfileForm = document.getElementById("update-profile-form");
    const profileNameInput = document.getElementById("profile-name");
    const profileEmailInput = document.getElementById("profile-email");
    const currentPasswordInput = document.getElementById("current-password");
    const newPasswordInput = document.getElementById("new-password");
    async function loadProfile() {
      if (profileNameInput) profileNameInput.value = "Loading...";
      if (profileEmailInput) profileEmailInput.value = "Loading...";
      try {
        const user = await apiRequest("GET", "/api/users/me");
        if (user) {
          if (profileNameInput) profileNameInput.value = user.full_name;
          if (profileEmailInput) profileEmailInput.value = user.email;
        }
      } catch (error) {
        showModalMessage(`Error loading profile: ${error.message}`, true);
        console.error("Error loading profile:", error);
        if (profileNameInput) profileNameInput.value = "Error loading data";
        if (profileEmailInput) profileEmailInput.value = "Error loading data";
      }
    }
    async function loadSubscriptionPlan() {
      if (!displaySubscriptionPlan) return;
      displaySubscriptionPlan.textContent = "Loading...";
      try {
        const response = await apiRequest("GET", "/api/subscription-status");
        if (response && response.plan) {
          displaySubscriptionPlan.textContent = response.plan.toUpperCase();
        } else {
          displaySubscriptionPlan.textContent = "N/A";
        }
      } catch (error) {
        console.error("Error loading subscription plan:", error);
        displaySubscriptionPlan.textContent = "Error";
        showModalMessage(`Error loading subscription plan: ${error.message}`, true);
      }
    }
    if (updateProfileForm) {
      updateProfileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fullName = profileNameInput.value.trim();
        const email = profileEmailInput.value.trim();
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const updateData = {
          full_name: fullName,
          email
        };
        if (newPassword) {
          if (!currentPassword) {
            showModalMessage("To change your password, you must provide your current password.", true);
            return;
          }
          updateData.current_password = currentPassword;
          updateData.new_password = newPassword;
        }
        try {
          await apiRequest("PUT", "/api/users/me", updateData);
          showModalMessage("Profile updated successfully!", false);
          if (currentPasswordInput) currentPasswordInput.value = "";
          if (newPasswordInput) newPasswordInput.value = "";
          loadProfile();
        } catch (error) {
          showModalMessage(`Error updating profile: ${error.message}`, true);
          console.error("Error updating profile:", error);
        }
      });
    }
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("payment")) {
      const paymentStatus = urlParams.get("payment");
      if (paymentStatus === "success") {
        showModalMessage("Payment successful! Your plan has been updated.", false);
      } else if (paymentStatus === "cancelled") {
        showModalMessage("Payment cancelled. You can try again at any time.", true);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    loadProfile();
    loadSubscriptionPlan();
  }

  // js/pages/documents.js
  function handleDocumentsPage() {
    if (!localStorage.getItem("authToken")) {
      window.location.href = "login.html";
      return;
    }
    const uploadForm = document.getElementById("upload-document-form");
    const documentListDiv = document.getElementById("document-list");
    const progressContainer = document.getElementById("upload-progress-container");
    const progressFill = document.getElementById("upload-progress-fill");
    const progressText = document.getElementById("upload-progress-text");
    async function loadDocuments() {
      if (!documentListDiv) return;
      documentListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading documents...</p>';
      try {
        const documents = await apiRequest("GET", "/api/documents");
        documentListDiv.innerHTML = "";
        if (documents && documents.length > 0) {
          documents.forEach((doc) => {
            const docItem = document.createElement("div");
            docItem.className = "document-item";
            docItem.innerHTML = `
                        <h4>${doc.title}</h4>
                        <p><strong>File:</strong> ${doc.file_name}</p>
                        <p><strong>Description:</strong> ${doc.description || "N/A"}</p>
                        <p style="font-size: 0.8em; color: var(--text-medium);">Uploaded by: ${doc.uploaded_by_name || "Unknown"}</p>
                        <p style="font-size: 0.8em; color: var(--text-medium);">Uploaded: ${new Date(doc.uploaded_at).toLocaleDateString()}</p>
                        <div class="actions">
                            <a href="/uploads/${encodeURIComponent(doc.file_name)}" target="_blank" class="btn btn-secondary btn-sm" title="Download Document">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                                </svg>
                            </a>
                            <button class="btn-delete" data-doc-id="${doc.document_id}" title="Delete Document">
                               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 1 0 0 1-2 2H5a2 1 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
            documentListDiv.appendChild(docItem);
          });
        } else {
          documentListDiv.innerHTML = '<p style="color: var(--text-medium);">No documents uploaded yet.</p>';
        }
      } catch (error) {
        documentListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading documents: ${error.message}</p>`;
        console.error("Error loading documents:", error);
      }
    }
    async function deleteDocument(documentId) {
      const confirmed = await showConfirmModal("Are you sure you want to delete this document? This cannot be undone and will permanently remove the file.", "Delete");
      if (confirmed) {
        try {
          await apiRequest("DELETE", `/api/documents/${documentId}`);
          showModalMessage("Document deleted successfully!", false);
          loadDocuments();
        } catch (error) {
          showModalMessage(`Error deleting document: ${error.message}`, true);
          console.error("Error deleting document:", error);
        }
      }
    }
    if (documentListDiv) {
      documentListDiv.addEventListener("click", (event) => {
        const deleteButton = event.target.closest(".btn-delete");
        if (deleteButton) {
          const documentId = deleteButton.dataset.docId;
          deleteDocument(documentId);
        }
      });
    }
    if (uploadForm) {
      uploadForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("document-title").value;
        const description = document.getElementById("document-description").value;
        const fileInput = document.getElementById("document-file");
        const file = fileInput.files[0];
        if (!file || !title) {
          showModalMessage("Please provide a title and select a file.", true);
          return;
        }
        const formData = new FormData();
        formData.append("title", title);
        formData.append("description", description);
        formData.append("document", file);
        if (progressContainer) progressContainer.style.display = "block";
        if (progressText) progressText.style.display = "block";
        if (progressFill) progressFill.style.width = "0%";
        if (progressText) progressText.textContent = "0%";
        try {
          await apiRequest("POST", "/api/documents", formData, true, (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round(event.loaded / event.total * 100);
              if (progressFill) progressFill.style.width = `${percentComplete}%`;
              if (progressText) progressText.textContent = `${percentComplete}%`;
            }
          });
          showModalMessage("Document uploaded successfully!", false);
          uploadForm.reset();
          loadDocuments();
        } catch (error) {
          showModalMessage(`Upload failed: ${error.message}`, true);
          console.error("Error uploading document:", error);
        } finally {
          if (progressContainer) progressContainer.style.display = "none";
          if (progressText) progressText.style.display = "none";
        }
      });
    }
    loadDocuments();
  }

  // js/pages/hiring.js
  function handleHiringPage() {
    if (!localStorage.getItem("authToken")) {
      window.location.href = "login.html";
      return;
    }
    const newJobPostingForm = document.getElementById("new-job-posting-form");
    const jobTitleInput = document.getElementById("job-title");
    const jobDescriptionTextarea = document.getElementById("job-description");
    const jobRequirementsTextarea = document.getElementById("job-requirements");
    const jobLocationSelect = document.getElementById("job-location-select");
    const jobPostingStatusMessage = document.getElementById("job-posting-status-message");
    const jobPostingsListDiv = document.getElementById("job-postings-list");
    const applicantsListDiv = document.getElementById("applicants-list");
    function displayStatusMessage(element, message, isError = false) {
      if (!element) return;
      element.innerHTML = message;
      element.classList.remove("success", "error");
      element.classList.add(isError ? "error" : "success");
      setTimeout(() => {
        element.textContent = "";
        element.classList.remove("success", "error");
      }, 5e3);
    }
    async function loadLocationsForJobPostingForm() {
      if (!jobLocationSelect) return;
      jobLocationSelect.innerHTML = '<option value="">Loading locations...</option>';
      try {
        const locations = await apiRequest("GET", "/api/locations");
        jobLocationSelect.innerHTML = '<option value="">Select Location</option>';
        if (locations && locations.length > 0) {
          locations.forEach((loc) => {
            const option = new Option(loc.location_name, loc.location_id);
            jobLocationSelect.add(option);
          });
        } else {
          jobLocationSelect.innerHTML = '<option value="">No locations available</option>';
        }
      } catch (error) {
        console.error("Error loading locations for job posting form:", error);
        jobLocationSelect.innerHTML = '<option value="">Error loading locations</option>';
        displayStatusMessage(jobPostingStatusMessage, `Error loading locations: ${error.message}`, true);
      }
    }
    async function loadCurrentJobPostings() {
      if (!jobPostingsListDiv) return;
      jobPostingsListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading job postings...</p>';
      try {
        const jobPostings = await apiRequest("GET", "/api/job-postings");
        jobPostingsListDiv.innerHTML = "";
        if (jobPostings && jobPostings.length > 0) {
          jobPostings.forEach((post) => {
            const postItem = document.createElement("div");
            postItem.className = "job-posting-item";
            postItem.innerHTML = `
                        <div>
                            <h4>${post.title}</h4>
                            <p style="font-size: 0.8em; color: var(--text-medium);">
                                Location: ${post.location_name || "Company Wide"}<br>
                                Posted: ${new Date(post.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div class="job-posting-actions">
                            <a href="apply.html?jobId=${post.id}" class="btn btn-secondary btn-sm" target="_blank" title="View Public Ad">View</a>
                            <button class="btn btn-secondary btn-sm btn-share" data-id="${post.id}" title="Share Job Posting">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/>
                                    <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/>
                                </svg>
                            </button>
                            <button class="btn btn-secondary btn-sm btn-delete-job-posting" data-id="${post.id}" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
            jobPostingsListDiv.appendChild(postItem);
          });
        } else {
          jobPostingsListDiv.innerHTML = '<p style="color: var(--text-medium);">No job postings found.</p>';
        }
      } catch (error) {
        console.error("Error loading job postings:", error);
        jobPostingsListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading job postings: ${error.message}</p>`;
      }
    }
    async function loadRecentApplicants() {
      if (!applicantsListDiv) return;
      applicantsListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading applicants...</p>';
      try {
        const applicants = await apiRequest("GET", "/api/applicants");
        applicantsListDiv.innerHTML = "";
        if (applicants && applicants.length > 0) {
          applicants.forEach((applicant) => {
            const applicantItem = document.createElement("div");
            applicantItem.className = "applicant-item";
            applicantItem.innerHTML = `
                        <div>
                            <h4>${applicant.name} <span style="font-size:0.8em; color:var(--text-medium);">(${applicant.job_title || "N/A"})</span></h4>
                            <p style="font-size: 0.8em; color: var(--text-medium); margin-bottom: 5px;">Email: ${applicant.email}</p>
                            ${applicant.phone ? `<p style="font-size: 0.8em; color: var(--text-medium); margin-bottom: 5px;">Phone: ${applicant.phone}</p>` : ""}
                            <p style="font-size: 0.8em; color: var(--text-medium);">Applied: ${new Date(applicant.applied_at).toLocaleDateString()}</p>
                        </div>
                        <div class="job-posting-actions"> 
                            <button class="btn btn-secondary btn-sm btn-delete-applicant" data-id="${applicant.id}" title="Archive Applicant">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
            applicantsListDiv.appendChild(applicantItem);
          });
        } else {
          applicantsListDiv.innerHTML = '<p style="color: var(--text-medium);">No recent applicants.</p>';
        }
      } catch (error) {
        console.error("Error loading applicants:", error);
        applicantsListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading applicants: ${error.message}</p>`;
      }
    }
    async function createJobPosting(e) {
      e.preventDefault();
      const jobData = {
        title: jobTitleInput.value.trim(),
        description: jobDescriptionTextarea.value.trim(),
        requirements: jobRequirementsTextarea.value.trim(),
        location_id: jobLocationSelect.value || null
      };
      if (!jobData.title || !jobData.description || !jobData.location_id) {
        displayStatusMessage(jobPostingStatusMessage, "Job title, description, and location are required.", true);
        return;
      }
      try {
        await apiRequest("POST", "/api/job-postings", jobData);
        displayStatusMessage(jobPostingStatusMessage, "Job posting created successfully!", false);
        newJobPostingForm.reset();
        loadCurrentJobPostings();
      } catch (error) {
        displayStatusMessage(jobPostingStatusMessage, `Error creating job posting: ${error.message}`, true);
      }
    }
    async function deleteJobPosting(id) {
      const confirmed = await showConfirmModal("Are you sure you want to delete this job posting?", "Delete");
      if (confirmed) {
        try {
          await apiRequest("DELETE", `/api/job-postings/${id}`);
          showModalMessage("Job posting deleted successfully!", false);
          loadCurrentJobPostings();
        } catch (error) {
          showModalMessage(`Error deleting job posting: ${error.message}`, true);
        }
      }
    }
    async function deleteApplicant(id) {
      const confirmed = await showConfirmModal("Are you sure you want to archive this applicant?", "Archive");
      if (confirmed) {
        try {
          await apiRequest("DELETE", `/api/applicants/${id}`);
          showModalMessage("Applicant archived successfully!", false);
          loadRecentApplicants();
        } catch (error) {
          showModalMessage(`Error archiving applicant: ${error.message}`, true);
        }
      }
    }
    function openShareModal(jobId) {
      const applyUrl = `${window.location.origin}/apply.html?jobId=${jobId}`;
      const embedCode = `<iframe src="${applyUrl}" width="100%" height="600" frameborder="0"></iframe>`;
      const existingModal = document.getElementById("share-job-modal");
      if (existingModal) {
        existingModal.remove();
      }
      const modalHtml = `
            <div id="share-job-modal" class="modal-overlay" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-content" style="text-align: left; max-width: 600px;">
                    <h3>Share Job Posting</h3>
                    
                    <div class="form-group">
                        <label for="share-link">Direct Link</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="share-link" value="${applyUrl}" readonly style="background-color: rgba(0,0,0,0.3);">
                            <button id="copy-share-link" class="btn btn-secondary">Copy</button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="embed-code">Embed Code</label>
                        <div style="display: flex; gap: 10px;">
                            <textarea id="embed-code" readonly style="height: 100px; background-color: rgba(0,0,0,0.3);">${embedCode}</textarea>
                            <button id="copy-embed-code" class="btn btn-secondary">Copy</button>
                        </div>
                    </div>

                    <div class="modal-actions" style="justify-content: flex-end; margin-top: 20px;">
                        <button id="close-share-modal" class="btn btn-primary">Close</button>
                    </div>
                </div>
            </div>
        `;
      document.body.insertAdjacentHTML("beforeend", modalHtml);
      const copyToClipboard = (textToCopy, message) => {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          showModalMessage(message, false);
        } catch (err) {
          showModalMessage("Failed to copy.", true);
        }
        document.body.removeChild(textArea);
      };
      document.getElementById("copy-share-link").addEventListener("click", () => {
        copyToClipboard(applyUrl, "Direct link copied!");
      });
      document.getElementById("copy-embed-code").addEventListener("click", () => {
        copyToClipboard(embedCode, "Embed code copied!");
      });
      const closeModal = () => {
        const modal = document.getElementById("share-job-modal");
        if (modal) {
          modal.remove();
        }
      };
      document.getElementById("close-share-modal").addEventListener("click", closeModal);
      document.getElementById("share-job-modal").addEventListener("click", (e) => {
        if (e.target.id === "share-job-modal") {
          closeModal();
        }
      });
    }
    if (newJobPostingForm) {
      newJobPostingForm.addEventListener("submit", createJobPosting);
    }
    if (jobPostingsListDiv) {
      jobPostingsListDiv.addEventListener("click", (e) => {
        const deleteButton = e.target.closest(".btn-delete-job-posting");
        const shareButton = e.target.closest(".btn-share");
        if (deleteButton) {
          deleteJobPosting(deleteButton.dataset.id);
        } else if (shareButton) {
          openShareModal(shareButton.dataset.id);
        }
      });
    }
    if (applicantsListDiv) {
      applicantsListDiv.addEventListener("click", (e) => {
        const deleteButton = e.target.closest(".btn-delete-applicant");
        if (deleteButton) {
          deleteApplicant(deleteButton.dataset.id);
        }
      });
    }
    loadLocationsForJobPostingForm();
    loadCurrentJobPostings();
    loadRecentApplicants();
  }

  // js/pages/scheduling.js
  function handleSchedulingPage() {
    const authToken = localStorage.getItem("authToken");
    const userRole = localStorage.getItem("userRole");
    if (!authToken) {
      window.location.href = "login.html";
      return;
    }
    const currentWeekDisplay = document.getElementById("current-week-display");
    const prevWeekBtn = document.getElementById("prev-week-btn");
    const nextWeekBtn = document.getElementById("next-week-btn");
    const printScheduleBtn = document.getElementById("print-schedule-btn");
    const calendarGridWrapper = document.getElementById("calendar-grid-wrapper");
    const employeeSelect = document.getElementById("employee-select");
    const locationSelect = document.getElementById("location-select");
    const createShiftForm = document.getElementById("create-shift-form");
    const locationSelectorContainer = document.getElementById("location-selector-container");
    const locationSelector = document.getElementById("location-selector");
    const deleteShiftsForm = document.getElementById("delete-shifts-form");
    const startDateInput = document.getElementById("start-date-input");
    const startTimeSelect = document.getElementById("start-time-select");
    const endDateInput = document.getElementById("end-date-input");
    const endTimeSelect = document.getElementById("end-time-select");
    let currentStartDate = /* @__PURE__ */ new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0);
    let currentLocationId = null;
    let allLocations = [];
    const PIXELS_PER_HOUR = 60;
    const START_HOUR = 0;
    const END_HOUR = 24;
    const SUPER_ADMIN_PREF_LOCATION_KEY = "superAdminPrefLocationId";
    const parseAsLocalDate = (dateTimeString) => {
      const [datePart, timePart] = dateTimeString.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hour, minute);
    };
    const loadAndRenderWeeklySchedule = async (locationId) => {
      if (!locationId) {
        currentWeekDisplay.textContent = "Select a location";
        calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please select a location to view the schedule.</p>';
        return;
      }
      currentLocationId = locationId;
      currentWeekDisplay.textContent = "Loading...";
      calendarGridWrapper.innerHTML = "";
      try {
        const [users, shifts, fetchedLocations] = await Promise.all([
          apiRequest("GET", `/api/users?location_id=${currentLocationId}`),
          apiRequest("GET", `/api/shifts?startDate=${getApiDate(currentStartDate)}&endDate=${getApiDate(getEndDate(currentStartDate))}&location_id=${currentLocationId}`),
          apiRequest("GET", "/api/locations")
        ]);
        allLocations = fetchedLocations;
        populateSidebarDropdowns(users, allLocations);
        renderCalendarGrid();
        renderShifts(shifts);
      } catch (error) {
        showModalMessage(`Error loading schedule: ${error.message}`, true);
        console.error("Error loading schedule data:", error);
        currentWeekDisplay.textContent = "Error";
      }
    };
    const populateSidebarDropdowns = (users, locations) => {
      employeeSelect.innerHTML = '<option value="">Select Employee</option>';
      if (users) {
        users.filter((u) => u.role === "employee" || u.role === "location_admin").forEach((user) => {
          employeeSelect.add(new Option(user.full_name, user.user_id));
        });
      }
      if (locationSelectorContainer && locationSelectorContainer.style.display !== "none" && locationSelector) {
        locationSelector.innerHTML = '<option value="">Select a Location</option>';
        if (locations) {
          locations.forEach((loc) => {
            locationSelector.add(new Option(loc.location_name, loc.location_id));
          });
        }
        if (currentLocationId) {
          locationSelector.value = currentLocationId;
        }
      }
      locationSelect.innerHTML = '<option value="">Select Location</option>';
      if (locations) {
        locations.forEach((loc) => {
          locationSelect.add(new Option(loc.location_name, loc.location_id));
        });
      }
      if (currentLocationId) {
        locationSelect.value = currentLocationId;
      }
    };
    const populateTimeSelects = () => {
      let optionsHtml = '<option value="">Select Time</option>';
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const timeValue = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
          const displayHour = hour % 12 === 0 ? 12 : hour % 12;
          const ampm = hour < 12 ? "AM" : "PM";
          const displayText = `${displayHour}:${String(minute).padStart(2, "0")} ${ampm}`;
          optionsHtml += `<option value="${timeValue}">${displayText}</option>`;
        }
      }
      startTimeSelect.innerHTML = optionsHtml;
      endTimeSelect.innerHTML = optionsHtml;
    };
    const renderCalendarGrid = () => {
      const weekDates = getWeekDates(currentStartDate);
      const dateRangeString = `${weekDates[0].toLocaleDateString(void 0, { month: "short", day: "numeric" })} - ${weekDates[6].toLocaleDateString(void 0, { month: "short", day: "numeric" })}`;
      currentWeekDisplay.textContent = dateRangeString;
      const grid = document.createElement("div");
      grid.className = "calendar-grid";
      grid.innerHTML += `<div class="grid-header time-slot-header"></div>`;
      weekDates.forEach((date) => {
        grid.innerHTML += `<div class="grid-header">${date.toLocaleDateString(void 0, { weekday: "short", day: "numeric" })}</div>`;
      });
      for (let hour = START_HOUR; hour < END_HOUR; hour++) {
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const ampm = hour < 12 ? "AM" : "PM";
        grid.innerHTML += `<div class="time-slot">${displayHour} ${ampm}</div>`;
      }
      for (let i = 0; i < 7; i++) {
        const dayCol = document.createElement("div");
        dayCol.className = "day-column";
        dayCol.style.gridColumn = `${i + 2}`;
        dayCol.style.gridRow = `2 / span ${END_HOUR - START_HOUR}`;
        dayCol.dataset.dayIndex = i;
        grid.appendChild(dayCol);
      }
      calendarGridWrapper.innerHTML = "";
      calendarGridWrapper.appendChild(grid);
    };
    const renderShifts = (shifts) => {
      if (!shifts || shifts.length === 0) return;
      shifts.forEach((shift) => {
        const shiftStart = parseAsLocalDate(shift.start_time);
        const shiftEnd = parseAsLocalDate(shift.end_time);
        if (isNaN(shiftStart.getTime()) || isNaN(shiftEnd.getTime())) return;
        const startDayIndex = shiftStart.getDay();
        const endDayIndex = shiftEnd.getDay();
        if (startDayIndex === endDayIndex) {
          createShiftBlock(shift, shiftStart, shiftEnd, startDayIndex);
        } else {
          const midnight = new Date(shiftStart);
          midnight.setHours(24, 0, 0, 0);
          createShiftBlock(shift, shiftStart, midnight, startDayIndex);
          if (endDayIndex > startDayIndex || startDayIndex === 6 && endDayIndex === 0) {
            createShiftBlock(shift, midnight, shiftEnd, endDayIndex);
          }
        }
      });
    };
    const createShiftBlock = (shift, startTime, endTime, dayIndex) => {
      const targetColumn = document.querySelector(`.day-column[data-day-index="${dayIndex}"]`);
      if (!targetColumn) return;
      const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
      const endMinutes = endTime.getHours() * 60 + endTime.getMinutes() || 24 * 60;
      const top = startMinutes / 60 * PIXELS_PER_HOUR;
      const height = (endMinutes - startMinutes) / 60 * PIXELS_PER_HOUR;
      if (height <= 0) return;
      const formattedStartTime = startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const formattedEndTime = endTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const shiftBlock = document.createElement("div");
      shiftBlock.className = "shift-block";
      shiftBlock.style.top = `${top}px`;
      shiftBlock.style.height = `${height}px`;
      shiftBlock.innerHTML = `
            <strong>${shift.employee_name}</strong>
            <small class="shift-time">${formattedStartTime} - ${formattedEndTime}</small>
            <button class="delete-shift-btn" data-shift-id="${shift.id}">&times;</button>
        `;
      shiftBlock.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || "None"}`;
      targetColumn.appendChild(shiftBlock);
    };
    const getWeekDates = (startDate) => Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      return date;
    });
    const getEndDate = (startDate) => {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
      return endDate;
    };
    const getApiDate = (d) => d.toISOString().split("T")[0];
    const handleWeekChange = (days) => {
      currentStartDate.setDate(currentStartDate.getDate() + days);
      if (currentLocationId) {
        loadAndRenderWeeklySchedule(currentLocationId);
      } else {
        showModalMessage("Please select a location first.", true);
      }
    };
    prevWeekBtn.addEventListener("click", () => handleWeekChange(-7));
    nextWeekBtn.addEventListener("click", () => handleWeekChange(7));
    if (printScheduleBtn) {
      printScheduleBtn.addEventListener("click", () => {
        if (!currentLocationId) {
          showModalMessage("Please select a location to print a schedule.", true);
          return;
        }
        const locationName = allLocations.find((loc) => String(loc.location_id) === String(currentLocationId))?.location_name || "Selected Location";
        const url = `printable-schedule.html?startDate=${getApiDate(currentStartDate)}&endDate=${getApiDate(getEndDate(currentStartDate))}&locationId=${currentLocationId}&locationName=${encodeURIComponent(locationName)}`;
        window.open(url, "_blank");
      });
    }
    createShiftForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const startDate = startDateInput.value;
      const startTime = startTimeSelect.value;
      const endDate = endDateInput.value;
      const endTime = endTimeSelect.value;
      if (!startDate || !startTime || !endDate || !endTime) {
        return showModalMessage("Please provide all date and time fields for the shift.", true);
      }
      const shiftStartDateTimeString = `${startDate}T${startTime}:00`;
      const shiftEndDateTimeString = `${endDate}T${endTime}:00`;
      if (new Date(shiftStartDateTimeString).getTime() >= new Date(shiftEndDateTimeString).getTime()) {
        showModalMessage("Shift end time must be after start time.", true);
        return;
      }
      const shiftData = {
        employee_id: employeeSelect.value,
        location_id: locationSelect.value,
        start_time: shiftStartDateTimeString,
        end_time: shiftEndDateTimeString,
        notes: document.getElementById("notes-input").value
      };
      if (!shiftData.employee_id || !shiftData.location_id) {
        return showModalMessage("Please select an employee and location for the shift.", true);
      }
      try {
        await apiRequest("POST", "/api/shifts", shiftData);
        showModalMessage("Shift created successfully!", false);
        createShiftForm.reset();
        loadAndRenderWeeklySchedule(currentLocationId);
      } catch (error) {
        showModalMessage(`Error creating shift: ${error.message}`, true);
      }
    });
    if (locationSelector) {
      locationSelector.addEventListener("change", () => {
        const newLocationId = locationSelector.value;
        if (newLocationId) {
          localStorage.setItem(SUPER_ADMIN_PREF_LOCATION_KEY, newLocationId);
          currentLocationId = newLocationId;
          loadAndRenderWeeklySchedule(newLocationId);
        } else {
          localStorage.removeItem(SUPER_ADMIN_PREF_LOCATION_KEY);
          currentLocationId = null;
          currentWeekDisplay.textContent = "Select a location";
          calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please select a location to view the schedule.</p>';
        }
      });
    }
    calendarGridWrapper.addEventListener("click", async (e) => {
      if (e.target.classList.contains("delete-shift-btn")) {
        const shiftId = e.target.dataset.shiftId;
        const confirmed = await showConfirmModal("Are you sure you want to delete this shift?");
        if (confirmed) {
          try {
            await apiRequest("DELETE", `/api/shifts/${shiftId}`);
            showModalMessage("Shift deleted successfully!", false);
            loadAndRenderWeeklySchedule(currentLocationId);
          } catch (error) {
            showModalMessage(`Error deleting shift: ${error.message}`, true);
          }
        }
      }
    });
    if (deleteShiftsForm) {
      deleteShiftsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const beforeDate = document.getElementById("delete-before-date").value;
        if (!beforeDate) {
          showModalMessage("Please select a date.", true);
          return;
        }
        const confirmed = await showConfirmModal(`Are you sure you want to delete all shifts before ${beforeDate}? This action cannot be undone.`);
        if (confirmed) {
          try {
            const result = await apiRequest("DELETE", `/api/shifts?beforeDate=${beforeDate}`);
            showModalMessage(result.message || "Old shifts deleted.", false);
            loadAndRenderWeeklySchedule(currentLocationId);
          } catch (error) {
            showModalMessage(`Error deleting old shifts: ${error.message}`, true);
          }
        }
      });
    }
    const initializePage = async () => {
      populateTimeSelects();
      try {
        const locations = await apiRequest("GET", "/api/locations");
        allLocations = locations;
        if (userRole === "super_admin") {
          if (locationSelectorContainer) locationSelectorContainer.style.display = "block";
          if (locationSelector) {
            locationSelector.innerHTML = '<option value="">Select a Location</option>';
            if (locations && locations.length > 0) {
              locations.forEach((loc) => {
                locationSelector.add(new Option(loc.location_name, loc.location_id));
              });
              const savedLocationId = localStorage.getItem(SUPER_ADMIN_PREF_LOCATION_KEY);
              let initialLocationId = null;
              if (savedLocationId && locations.some((loc) => String(loc.location_id) === savedLocationId)) {
                initialLocationId = savedLocationId;
              } else {
                initialLocationId = locations[0].location_id;
              }
              locationSelector.value = initialLocationId;
              currentLocationId = initialLocationId;
              loadAndRenderWeeklySchedule(initialLocationId);
            } else {
              currentWeekDisplay.textContent = "No Locations";
              calendarGridWrapper.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-medium);">Please create a location in Admin Settings.</p>';
            }
          }
        } else {
          if (locationSelectorContainer) locationSelectorContainer.style.display = "none";
          const user = await apiRequest("GET", "/api/users/me");
          if (user && user.location_id) {
            currentLocationId = user.location_id;
            loadAndRenderWeeklySchedule(user.location_id);
          } else {
            showModalMessage("Your account is not assigned to a location. Please contact your administrator.", true);
            currentWeekDisplay.textContent = "No Location Assigned";
          }
        }
      } catch (error) {
        showModalMessage(`Failed to initialize scheduling page: ${error.message}`, true);
        console.error("Failed to initialize scheduling page:", error);
      }
    };
    initializePage();
  }

  // js/pages/apply.js
  function handleApplyPage() {
    const jobDetailsContainer = document.getElementById("job-details-container");
    const applyForm = document.getElementById("apply-form");
    const applyCard = document.getElementById("apply-card");
    console.log("[apply.js] Elements found:", { jobDetailsContainer, applyForm, applyCard });
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get("jobId");
    if (!jobId) {
      if (jobDetailsContainer) {
        jobDetailsContainer.innerHTML = "<h2>Job Not Found</h2><p>No job ID was provided in the URL.</p>";
      } else if (applyCard) {
        applyCard.innerHTML = "<h2>Job Not Found</h2><p>No job ID was provided in the URL.</p>";
      }
      console.error("[apply.js] No jobId found in URL.");
      return;
    }
    async function loadJobDetails() {
      if (!jobDetailsContainer) {
        console.error("[apply.js] jobDetailsContainer not found. Cannot load job details.");
        if (applyCard) {
          applyCard.innerHTML = "<h2>Error</h2><p>Page structure missing. Please contact support.</p>";
        } else {
          showModalMessage("Page structure missing. Please contact support.", true);
        }
        return;
      }
      jobDetailsContainer.innerHTML = '<p style="color: var(--text-medium);">Loading job details...</p>';
      try {
        const job = await apiRequest("GET", `/job-postings/${jobId}`);
        if (job) {
          document.title = `Apply for ${job.title} - Flow Business Suite`;
          const detailsHtml = `
                    <h2>${job.title}</h2>
                    <p><strong>Location:</strong> ${job.location_name || "Company Wide"}</p>
                    <p><strong>Description:</strong><br>${job.description ? job.description.replace(/\n/g, "<br>") : "N/A"}</p>
                    ${job.requirements ? `<p><strong>Requirements:</strong><br>${job.requirements.replace(/\n/g, "<br>")}</p>` : ""}
                `;
          jobDetailsContainer.innerHTML = detailsHtml;
          if (applyForm) {
            applyForm.style.display = "block";
            console.log("[apply.js] Application form set to display: block.");
          } else {
            console.warn("[apply.js] applyForm element not found, cannot make it visible.");
          }
        } else {
          jobDetailsContainer.innerHTML = "<h2>Job Not Found</h2><p>The job you are looking for does not exist.</p>";
          console.warn("[apply.js] Job not found for ID:", jobId);
          if (applyForm) {
            applyForm.style.display = "none";
          }
        }
      } catch (error) {
        jobDetailsContainer.innerHTML = `<h2>Error</h2><p>Could not load job details. ${error.message}</p>`;
        console.error("Error loading job details:", error);
        if (applyForm) {
          applyForm.style.display = "none";
        }
      }
    }
    if (applyForm) {
      applyForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const applicationData = {
          name: document.getElementById("applicant-name").value.trim(),
          email: document.getElementById("applicant-email").value.trim(),
          address: document.getElementById("applicant-address").value.trim(),
          phone: document.getElementById("applicant-phone").value.trim(),
          date_of_birth: document.getElementById("applicant-dob").value,
          availability: document.getElementById("applicant-availability").value,
          is_authorized: document.getElementById("applicant-authorized").value === "Yes"
          // Convert to boolean
        };
        if (!applicationData.name || !applicationData.email || !applicationData.availability) {
          showModalMessage("Please fill in your Full Name, Email Address, and Availability.", true);
          return;
        }
        try {
          await apiRequest("POST", `/apply/${jobId}`, applicationData);
          if (applyCard) {
            applyCard.innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <h2 style="color: var(--primary-accent);">Application Submitted!</h2>
                            <p style="color: var(--text-light);">Thank you for your interest. We have received your application and will be in touch if you are selected for an interview.</p>
                            <p style="margin-top: 20px; font-weight: 600; color: var(--text-medium);">You may now safely close this browser tab.</p>
                        </div>
                    `;
          }
        } catch (error) {
          showModalMessage(`Error submitting application: ${error.message}`, true);
          console.error("Error submitting application:", error);
        }
      });
    } else {
      console.error("[apply.js] Application form element (id='apply-form') not found. Submission listener not attached.");
    }
    loadJobDetails();
  }

  // js/pages/onboardingView.js
  function handleOnboardingViewPage() {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
      window.location.href = "login.html";
      return;
    }
    const welcomeMessage = document.getElementById("welcome-message");
    const messagesContainer = document.getElementById("messages-container");
    const onboardingInfoContainer = document.getElementById("onboarding-info-container");
    const onboardingTaskListDiv = document.getElementById("onboarding-task-list");
    const taskListOverviewDiv = document.getElementById("task-list-overview");
    const employeeScheduleListDiv = document.getElementById("employee-schedule-list");
    const printScheduleBtn = document.getElementById("print-employee-schedule-btn");
    let currentUserId = null;
    function getUserIdFromToken(token) {
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(atob(base64).split("").map(function(c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(""));
        const payload = JSON.parse(jsonPayload);
        return payload.id;
      } catch (e) {
        console.error("Error decoding token:", e);
        return null;
      }
    }
    async function loadWelcomeMessage() {
      if (!welcomeMessage) return;
      try {
        const user = await apiRequest("GET", "/api/users/me");
        const userName = user && user.full_name ? user.full_name.split(" ")[0] : "Employee";
        welcomeMessage.textContent = `Welcome, ${userName}!`;
      } catch (error) {
        console.error("Failed to fetch user for welcome message:", error);
        welcomeMessage.textContent = "Welcome!";
      }
    }
    async function loadMessages() {
      if (!messagesContainer) return;
      try {
        const messages = await apiRequest("GET", "/api/messages");
        messagesContainer.innerHTML = "";
        if (messages && messages.length > 0) {
          const messagesHeader = document.createElement("h3");
          messagesHeader.textContent = "Messages for You";
          messagesContainer.appendChild(messagesHeader);
          messages.forEach((msg) => {
            const msgItem = document.createElement("div");
            msgItem.className = "message-item";
            msgItem.innerHTML = `
                        <p>${msg.content}</p> 
                        <div class="message-actions">
                            ${!msg.is_read ? '<span class="new-message-indicator">New</span>' : ""}
                            <button class="btn btn-danger btn-sm delete-message-btn" data-message-id="${msg.message_id}">Delete</button>
                        </div>
                    `;
            messagesContainer.appendChild(msgItem);
          });
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    }
    messagesContainer.addEventListener("click", async (e) => {
      if (e.target.classList.contains("delete-message-btn")) {
        const messageId = e.target.dataset.messageId;
        const confirmed = await showConfirmModal("Are you sure you want to permanently delete this message?");
        if (confirmed) {
          try {
            await apiRequest("DELETE", `/api/messages/${messageId}`);
            e.target.closest(".message-item").remove();
          } catch (error) {
            showModalMessage(`Could not delete message: ${error.message}`, true);
          }
        }
      }
    });
    async function loadOnboardingTasks() {
      if (!onboardingTaskListDiv) return;
      onboardingTaskListDiv.innerHTML = "<p>Loading your onboarding tasks...</p>";
      try {
        const tasks = await apiRequest("GET", `/api/onboarding-tasks?user_id=${currentUserId}`);
        renderOnboardingTasks(tasks);
      } catch (error) {
        onboardingTaskListDiv.innerHTML = '<p style="color: #e74c3c;">Error loading tasks.</p>';
      }
    }
    function renderOnboardingTasks(tasks) {
      if (!onboardingTaskListDiv) return;
      onboardingTaskListDiv.innerHTML = "";
      if (tasks && tasks.length > 0) {
        onboardingInfoContainer.style.display = "block";
        tasks.forEach((task) => {
          const taskItem = document.createElement("div");
          taskItem.className = `checklist-item ${task.completed ? "completed" : ""}`;
          taskItem.dataset.taskId = task.id;
          taskItem.innerHTML = `
                    <div class="checklist-item-title">
                        <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""}>
                        <span>${task.description}</span>
                        ${task.document_name ? `<br><small>Attached: <a href="/uploads/${encodeURIComponent(task.document_name)}" target="_blank">${task.document_name}</a></small>` : ""}
                    </div>
                `;
          onboardingTaskListDiv.appendChild(taskItem);
        });
      } else {
        if (onboardingInfoContainer) onboardingInfoContainer.style.display = "none";
      }
    }
    async function loadEmployeeSchedule() {
      if (!employeeScheduleListDiv) return;
      employeeScheduleListDiv.innerHTML = "<p>Loading your schedule...</p>";
      const today = /* @__PURE__ */ new Date();
      const startDate = new Date(today.setDate(today.getDate() - today.getDay())).toISOString().split("T")[0];
      const endDate = new Date(today.setDate(today.getDate() + 7)).toISOString().split("T")[0];
      try {
        const shifts = await apiRequest("GET", `/api/shifts?user_id=${currentUserId}&startDate=${startDate}&endDate=${endDate}`);
        employeeScheduleListDiv.innerHTML = "";
        if (shifts && shifts.length > 0) {
          shifts.forEach((shift) => {
            const shiftItem = document.createElement("div");
            shiftItem.className = "schedule-list-item";
            const shiftDate = new Date(shift.start_time);
            const startTime = shiftDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
            const endTime = new Date(shift.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
            shiftItem.innerHTML = `
                        <strong>${shiftDate.toLocaleDateString(void 0, { weekday: "long", month: "short", day: "numeric" })}</strong>
                        <p>${startTime} - ${endTime} at ${shift.location_name}</p>
                    `;
            employeeScheduleListDiv.appendChild(shiftItem);
          });
        } else {
          employeeScheduleListDiv.innerHTML = "<p>You have no shifts scheduled for this week.</p>";
        }
      } catch (error) {
        employeeScheduleListDiv.innerHTML = '<p style="color: #e74c3c;">Could not load schedule.</p>';
      }
    }
    currentUserId = getUserIdFromToken(authToken);
    if (!currentUserId) {
      showModalMessage("Could not verify user. Please log in again.", true);
      window.location.href = "login.html";
      return;
    }
    loadWelcomeMessage();
    loadMessages();
    loadOnboardingTasks();
    loadEmployeeSchedule();
  }

  // js/pages/suiteHub.js
  async function handleSuiteHubPage() {
    const greetingContainer = document.getElementById("greeting-container");
    const sendMessageForm = document.getElementById("send-message-form");
    const messageEmployeeSelect = document.getElementById("message-employee-select");
    const messageContent = document.getElementById("message-content");
    const sendMessageStatus = document.getElementById("send-message-status");
    const fetchUserInfo = async () => {
      try {
        const user = await apiRequest("GET", "/api/users/me");
        if (greetingContainer) {
          greetingContainer.innerHTML = `<h2 style="color: var(--primary-accent);">Welcome, ${user.full_name}!</h2>`;
        }
        if (user.role === "super_admin" || user.role === "location_admin") {
          await populateEmployeeSelect(user.location_id);
        } else {
          if (sendMessageForm) {
            sendMessageForm.style.display = "none";
            const messageContainer = sendMessageForm.parentElement;
            messageContainer.innerHTML = '<h3>Messaging</h3><p style="color: var(--text-medium);">Messaging is available for admin users.</p>';
          }
        }
      } catch (error) {
        console.error("Error fetching user info for Suite Hub:", error);
        showModalMessage("Failed to load user information.", true);
      }
    };
    const populateEmployeeSelect = async (adminLocationId) => {
      try {
        const users = await apiRequest("GET", "/api/users");
        messageEmployeeSelect.innerHTML = '<option value="">Select an employee</option>';
        const filteredUsers = users.filter(
          (user) => user.role === "employee" || user.role === "location_admin" && String(user.user_id) !== String(localStorage.getItem("userId"))
        ).filter((user) => {
          if (localStorage.getItem("userRole") === "location_admin") {
            return String(user.location_id) === String(adminLocationId);
          }
          return true;
        });
        filteredUsers.forEach((user) => {
          const option = document.createElement("option");
          option.value = user.user_id;
          option.textContent = `${user.full_name} (${user.role === "employee" ? user.position || "Employee" : "Admin"})`;
          messageEmployeeSelect.appendChild(option);
        });
      } catch (error) {
        console.error("Error populating employee select:", error);
        showModalMessage("Failed to load employee list.", true);
      }
    };
    if (sendMessageForm) {
      sendMessageForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        sendMessageStatus.textContent = "Sending message...";
        sendMessageStatus.style.color = "var(--text-medium)";
        const recipientId = messageEmployeeSelect.value;
        const content = messageContent.value.trim();
        if (!recipientId) {
          sendMessageStatus.textContent = "Please select a recipient.";
          sendMessageStatus.style.color = "#ff8a80";
          return;
        }
        if (!content) {
          sendMessageStatus.textContent = "Message content cannot be empty.";
          sendMessageStatus.style.color = "#ff8a80";
          return;
        }
        try {
          await apiRequest("POST", "/api/messages", { recipient_id: recipientId, content });
          sendMessageStatus.textContent = "Message sent successfully!";
          sendMessageStatus.style.color = "var(--primary-accent)";
          messageContent.value = "";
          messageEmployeeSelect.value = "";
        } catch (error) {
          console.error("Error sending message:", error);
          sendMessageStatus.textContent = `Error sending message: ${error.message}`;
          sendMessageStatus.style.color = "#ff8a80";
        }
      });
    }
    fetchUserInfo();
  }

  // js/pages/pricing.js
  function handlePricingPage() {
    const stripePublicKey = "pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td";
    const stripe = Stripe(stripePublicKey);
    const modal = document.getElementById("register-checkout-modal-overlay");
    const form = document.getElementById("register-checkout-form");
    let selectedPlan = null;
    const proPlanButton = document.querySelector('.choose-plan-btn[data-plan="pro"]');
    const enterprisePlanButton = document.querySelector('.choose-plan-btn[data-plan="enterprise"]');
    const handlePaidPlanClick = async (event) => {
      if (!event.currentTarget || event.currentTarget.tagName !== "BUTTON" || !event.currentTarget.dataset.plan) {
        console.error("Invalid element clicked for paid plan handler.");
        return;
      }
      selectedPlan = event.currentTarget.dataset.plan;
      console.log("Clicked paid plan:", selectedPlan);
      if (localStorage.getItem("authToken")) {
        await createCheckoutSession(selectedPlan);
      } else {
        if (modal) modal.style.display = "flex";
      }
    };
    if (proPlanButton) {
      proPlanButton.addEventListener("click", handlePaidPlanClick);
    }
    if (enterprisePlanButton) {
      enterprisePlanButton.addEventListener("click", handlePaidPlanClick);
    }
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById("register-checkout-error-message");
        errorEl.textContent = "";
        errorEl.style.display = "none";
        const companyName = document.getElementById("reg-co-name").value;
        const fullName = document.getElementById("reg-full-name").value;
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg-password").value;
        try {
          await apiRequest("POST", "/api/register", { companyName, fullName, email, password });
          const loginData = await apiRequest("POST", "/api/login", { email, password });
          if (!loginData.token) throw new Error("Login failed after registration.");
          localStorage.setItem("authToken", loginData.token);
          localStorage.setItem("userRole", loginData.role);
          localStorage.setItem("userId", loginData.userId);
          await createCheckoutSession(selectedPlan);
        } catch (error) {
          errorEl.textContent = error.message;
          errorEl.style.display = "block";
          console.error("Registration/Checkout error:", error);
        }
      });
    }
    const cancelBtn = document.getElementById("reg-checkout-cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        if (modal) modal.style.display = "none";
      });
    }
    async function createCheckoutSession(plan) {
      try {
        const session = await apiRequest("POST", "/api/create-checkout-session", { plan });
        if (session && session.id) {
          await stripe.redirectToCheckout({ sessionId: session.id });
        } else {
          showModalMessage("Could not initiate checkout session. Please try again.", true);
        }
      } catch (error) {
        console.error("Error creating checkout session:", error);
        showModalMessage("Could not initiate checkout. Please try again.", true);
      }
    }
  }

  // js/pages/printable-schedule.js
  function handlePrintableSchedulePage() {
    const scheduleContainer = document.getElementById("schedule-container");
    const urlParams = new URLSearchParams(window.location.search);
    const startDate = urlParams.get("startDate");
    const endDate = urlParams.get("endDate");
    const locationId = urlParams.get("locationId");
    const locationName = urlParams.get("locationName");
    if (!startDate || !endDate || !locationId) {
      scheduleContainer.innerHTML = "<p>Error: Missing schedule information.</p>";
      return;
    }
    async function loadAndRenderPrintableSchedule() {
      try {
        const shifts = await apiRequest("GET", `/api/shifts?startDate=${startDate}&endDate=${endDate}&location_id=${locationId}`);
        const weekEndingDate = new Date(endDate);
        weekEndingDate.setDate(weekEndingDate.getDate() - 1);
        let tableHtml = `
                <div class="schedule-header">
                    <h1>Work Schedule</h1>
                </div>
                <div class="schedule-info">
                    <span><strong>Location:</strong> ${locationName}</span>
                    <span><strong>Week Ending:</strong> ${weekEndingDate.toLocaleDateString()}</span>
                </div>
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Sun</th>
                            <th>Mon</th>
                            <th>Tue</th>
                            <th>Wed</th>
                            <th>Thu</th>
                            <th>Fri</th>
                            <th>Sat</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
        const employees = {};
        shifts.forEach((shift) => {
          if (!employees[shift.employee_name]) {
            employees[shift.employee_name] = Array(7).fill("");
          }
          const shiftDate = new Date(shift.start_time);
          const dayIndex = shiftDate.getDay();
          const startTime = shiftDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          const endTime = new Date(shift.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          employees[shift.employee_name][dayIndex] += `<div>${startTime} - ${endTime}</div>`;
        });
        for (const [name, schedule] of Object.entries(employees)) {
          tableHtml += `<tr><td>${name}</td>`;
          schedule.forEach((dayHtml) => {
            tableHtml += `<td>${dayHtml}</td>`;
          });
          tableHtml += `</tr>`;
        }
        tableHtml += `
                    </tbody>
                </table>
            `;
        scheduleContainer.innerHTML = tableHtml;
      } catch (error) {
        scheduleContainer.innerHTML = `<p>Error loading schedule: ${error.message}</p>`;
      }
    }
    loadAndRenderPrintableSchedule();
  }

  // js/app.js
  function setupSettingsDropdown() {
    const settingsButton = document.getElementById("settings-button");
    const settingsDropdown = document.getElementById("settings-dropdown");
    const logoutButton = document.getElementById("logout-button");
    if (settingsButton && settingsDropdown) {
      settingsButton.addEventListener("click", (event) => {
        event.stopPropagation();
        settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";
      });
      document.addEventListener("click", (event) => {
        if (settingsButton && !settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
          settingsDropdown.style.display = "none";
        }
      });
    }
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userRole");
        localStorage.removeItem("userId");
        console.log("User logged out. Local storage cleared.");
        window.location.href = "login.html";
      });
    }
  }
  function main() {
    const path = window.location.pathname;
    const pagesWithSettings = [
      "suite-hub.html",
      "dashboard.html",
      "checklists.html",
      "admin.html",
      "account.html",
      "documents.html",
      "hiring.html",
      "scheduling.html",
      "new-hire-view.html",
      "help.html",
      "pricing.html"
      // ADDED pricing.html HERE
    ];
    if (pagesWithSettings.some((p) => path.includes(p))) {
      setupSettingsDropdown();
    }
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
    else if (path.includes("printable-schedule.html")) handlePrintableSchedulePage();
  }
  document.addEventListener("DOMContentLoaded", main);
})();
//# sourceMappingURL=bundle.js.map
