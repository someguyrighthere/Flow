// app.js - Client-Side JavaScript for Flow Business Suite
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

let stripe;
if (typeof Stripe !== 'undefined') {
    stripe = Stripe('pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td');
} else {
    console.warn("Stripe.js not loaded. Stripe functionalities will not work on this page.");
}

function showModalMessage(message, isError = false) {
    const modalOverlay = document.getElementById("message-modal-overlay");
    const modalMessage = document.getElementById("modal-message-text");
    const modalCloseButton = document.getElementById("modal-close-button");
    if (modalOverlay && modalMessage && modalCloseButton) {
        modalMessage.textContent = message;
        modalMessage.style.color = isError ? "#ff8a80" : "var(--text-light)";
        modalOverlay.style.display = "flex";
        modalCloseButton.onclick = () => { modalOverlay.style.display = "none"; };
        modalOverlay.onclick = event => { if (event.target === modalOverlay) modalOverlay.style.display = "none"; };
    } else {
        console.error("Modal elements not found for showModalMessage:", message);
        isError ? console.error(`ERROR: ${message}`) : console.log(`MESSAGE: ${message}`);
    }
}

function showConfirmModal(message, confirmButtonText = "Confirm") {
    return new Promise(resolve => {
        const confirmModalOverlay = document.getElementById("confirm-modal-overlay");
        const confirmModalMessage = document.getElementById("confirm-modal-message");
        const modalConfirmButton = document.getElementById("modal-confirm");
        const modalCancelButton = document.getElementById("modal-cancel");

        if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
            console.error("Confirmation modal elements not found. Falling back to native confirm.");
            resolve(window.confirm(message));
            return;
        }

        confirmModalMessage.innerHTML = message;
        modalConfirmButton.textContent = confirmButtonText;
        confirmModalOverlay.style.display = "flex";

        const handleResponse = (value) => {
            confirmModalOverlay.style.display = "none";
            modalConfirmButton.removeEventListener("click", onConfirm);
            modalCancelButton.removeEventListener("click", onCancel);
            resolve(value);
        };
        const onConfirm = () => handleResponse(true);
        const onCancel = () => handleResponse(false);

        modalConfirmButton.addEventListener("click", onConfirm);
        modalCancelButton.addEventListener("click", onCancel);
        confirmModalOverlay.onclick = event => { if (event.target === confirmModalOverlay) onCancel(); };
    });
}

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

async function apiRequest(method, path, body = null, isFormData = false, onProgress = null, expectBlobResponse = false) {
    const token = localStorage.getItem('authToken');
    const endpoint = `${API_BASE_URL}${path}`;

    const handleAuthError = (errorMessage) => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        showModalMessage(errorMessage, true);
        setTimeout(() => {
            window.location.href = 'login.html?sessionExpired=true';
        }, 1500); 
    };

    if (isFormData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            if (onProgress && xhr.upload) xhr.upload.addEventListener('progress', onProgress);
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText || '{}')); } catch (e) { resolve({}); }
                } else if (xhr.status === 401 || xhr.status === 403) {
                    handleAuthError('Your session has expired. Please log in again.');
                    reject(new Error('Authentication failed.'));
                } else {
                    try { reject(new Error(JSON.parse(xhr.responseText).error || 'An unknown error occurred.')); }
                    catch (e) { reject(new Error(`HTTP error ${xhr.status} - ${xhr.statusText}`)); }
                }
            };
            xhr.onerror = () => reject(new Error('Network error.'));
            xhr.send(body);
        });
    }

    const options = { method, headers: {} };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body && !isFormData) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const response = await fetch(endpoint, options);
    if (response.status === 401 || response.status === 403) {
        handleAuthError('Your session has expired. Please log in again.');
        throw new Error('Authentication failed.');
    }
    if (!response.ok) {
        let errorMsg = `HTTP error! Status: ${response.status}`;
        try { errorMsg = (await response.json()).error || errorMsg; } catch (e) { /* ignore */ }
        throw new Error(errorMsg);
    }
    if (expectBlobResponse) return response.blob();
    if (response.status === 204 || response.headers.get("content-length") === "0") return null;
    return response.json();
}

function handleLoginPage() {
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

function handleRegisterPage() {
    const registerForm = document.getElementById("register-form");
    if (!registerForm) return;
    registerForm.addEventListener("submit", async e => {
        e.preventDefault();
        const company_name = document.getElementById("company-name").value.trim();
        const full_name = document.getElementById("full-name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const errorMessage = document.getElementById("error-message");
        errorMessage.textContent = "";
        errorMessage.classList.remove("visible");

        if (!company_name || !full_name || !email || !password || password.length < 6) {
            errorMessage.textContent = "Please fill all fields correctly.";
            errorMessage.classList.add("visible");
            return;
        }

        try {
            await apiRequest("POST", "/register", { company_name, full_name, email, password });
            showModalMessage("Account created successfully! Please log in.", false);
            setTimeout(() => { window.location.href = "login.html"; }, 2000);
        } catch (error) {
            errorMessage.textContent = `Registration Failed: ${error.message}`;
            errorMessage.classList.add("visible");
        }
    });
}

function handleSuiteHubPage() {
    if (!localStorage.getItem("authToken")) { window.location.href = "login.html"; return; }
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("payment") === "success") {
        showModalMessage("Payment successful! Your subscription has been updated.", false);
        history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get("payment") === "cancelled") {
        showModalMessage("Payment cancelled. You can try again or choose another plan.", true);
        history.replaceState({}, document.title, window.location.pathname);
    }
}

function handleAccountPage() {
    if (!localStorage.getItem("authToken")) { window.location.href = "login.html"; return; }
    // Add logic for account page here
}

function handleAdminPage() {
    if (!localStorage.getItem("authToken")) { window.location.href = "login.html"; return; }
    // Add logic for admin page here
}

function handleDashboardPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const onboardUserModal = document.getElementById("onboard-user-modal");
    const showOnboardModalBtn = document.getElementById("show-onboard-modal-btn");
    const modalCancelOnboardBtn = document.getElementById("modal-cancel-onboard");
    const onboardUserForm = document.getElementById("onboard-user-form");
    const newHirePositionSelect = document.getElementById("new-hire-position");
    const sessionListDiv = document.getElementById("session-list");

    if (showOnboardModalBtn) {
        showOnboardModalBtn.addEventListener("click", () => {
            if (onboardUserModal) {
                onboardUserModal.style.display = "flex";
            }
        });
    }

    if (modalCancelOnboardBtn) {
        modalCancelOnboardBtn.addEventListener("click", () => {
            if (onboardUserModal) {
                onboardUserModal.style.display = "none";
            }
        });
    }

    if (onboardUserModal) {
        onboardUserModal.addEventListener("click", event => {
            if (event.target === onboardUserModal) {
                onboardUserModal.style.display = "none";
            }
        });
    }

    async function loadPositions() {
        if (!newHirePositionSelect) return;
        newHirePositionSelect.innerHTML = '<option value="">Loading positions...</option>';
        try {
            const response = await apiRequest("GET", "/positions");
            newHirePositionSelect.innerHTML = '<option value="">Select Position</option>';
            if (response && response.positions && response.positions.length > 0) {
                response.positions.forEach(pos => {
                    const option = document.createElement("option");
                    option.value = pos.id;
                    option.textContent = pos.name;
                    newHirePositionSelect.appendChild(option);
                });
            } else {
                newHirePositionSelect.innerHTML = '<option value="">No positions available</option>';
            }
        } catch (error) {
            console.error("Error loading positions:", error);
            newHirePositionSelect.innerHTML = '<option value="">Error loading positions</option>';
            showModalMessage(`Failed to load positions: ${error.message}`, true);
        }
    }

    async function loadOnboardingSessions() {
        if (!sessionListDiv) return;
        sessionListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading active onboardings...</p>';
        try {
            const sessions = await apiRequest("GET", "/onboarding-sessions");
            sessionListDiv.innerHTML = '';
            if (sessions && sessions.length > 0) {
                sessions.forEach(session => {
                    const sessionItem = document.createElement("div");
                    sessionItem.className = "onboarding-item";
                    let completionStatus = session.completedTasks === session.totalTasks ? 'Completed' : `${session.completedTasks}/${session.totalTasks} Tasks Completed`;
                    let statusColor = session.completedTasks === session.totalTasks ? 'var(--primary-accent)' : 'var(--text-medium)';

                    sessionItem.innerHTML = `
                        <div class="onboarding-item-info">
                            <p style="color: var(--text-light); font-weight: 600;">${session.full_name} (${session.position || 'N/A'})</p>
                            <p style="color: var(--text-medium);">Email: ${session.email}</p>
                            <p style="color: ${statusColor};">Status: ${completionStatus}</p>
                        </div>
                        <div class="onboarding-item-actions">
                            <button class="btn btn-secondary btn-sm view-details-btn" data-user-id="${session.user_id}">View Progress</button>
                            ${session.completedTasks === session.totalTasks ?
                                `<button class="btn btn-primary btn-sm archive-onboarding-btn" data-session-id="${session.session_id}">Archive</button>` : ''}
                        </div>
                    `;
                    sessionListDiv.appendChild(sessionItem);
                });

                sessionListDiv.querySelectorAll('.view-details-btn').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const userId = event.target.dataset.userId;
                        window.location.href = `new-hire-view.html?userId=${userId}`;
                    });
                });

                sessionListDiv.querySelectorAll('.archive-onboarding-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const sessionId = event.target.dataset.sessionId;
                        const confirmed = await showConfirmModal('Are you sure you want to archive this onboarding session?');
                        if (confirmed) {
                            try {
                                await apiRequest("PUT", `/onboarding-sessions/${sessionId}/archive`);
                                showModalMessage('Onboarding session archived successfully!', false);
                                loadOnboardingSessions();
                            } catch (error) {
                                showModalMessage(`Failed to archive session: ${error.message}`, true);
                            }
                        }
                    });
                });
            } else {
                sessionListDiv.innerHTML = '<p style="color: var(--text-medium);">No active onboardings.</p>';
            }
        } catch (error) {
            console.error("Error loading onboarding sessions:", error);
            sessionListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading onboarding sessions: ${error.message}</p>`;
        }
    }

    if (onboardUserForm) {
        onboardUserForm.addEventListener("submit", async e => {
            e.preventDefault();
            const newHireName = document.getElementById("new-hire-name").value.trim();
            const newHireEmail = document.getElementById("new-hire-email").value.trim();
            const newHirePosition = newHirePositionSelect ? newHirePositionSelect.value : "";
            const newHireId = document.getElementById("new-hire-id").value.trim();

            if (!newHireName || !newHireEmail || !newHirePosition) {
                showModalMessage("Please fill all required fields: Full Name, Email, and Position.", true);
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newHireEmail)) {
                showModalMessage("Please enter a valid email address.", true);
                return;
            }

            try {
                await apiRequest("POST", "/onboard-employee", {
                    full_name: newHireName,
                    email: newHireEmail,
                    position_id: newHirePosition,
                    employee_id: newHireId || null
                });

                showModalMessage(`Onboarding invite sent to ${newHireEmail} for position ${newHirePosition}.`, false);
                onboardUserForm.reset();
                if (onboardUserModal) onboardUserModal.style.display = "none";
                loadOnboardingSessions();
            } catch (error) {
                showModalMessage(error.message, true);
            }
        });
    }

    loadPositions();
    loadOnboardingSessions();
}

function handlePricingPage() {
    // Add logic for pricing page here
}

function handleHiringPage() {
    if (!localStorage.getItem("authToken")) { window.location.href = "login.html"; return; }
    // Add logic for hiring page here
}

function handleSchedulingPage() {
    if (!localStorage.getItem("authToken")) { window.location.href = "login.html"; return; }
    // Add logic for scheduling page here
}

function handleDocumentsPage() {
    if (!localStorage.getItem("authToken")) { window.location.href = "login.html"; return; }
    const uploadDocumentForm = document.getElementById("upload-document-form");
    const documentTitleInput = document.getElementById("document-title");
    const documentFileInput = document.getElementById("document-file");
    const documentDescriptionInput = document.getElementById("document-description");
    const documentListDiv = document.getElementById("document-list");
    const uploadProgressContainer = document.getElementById("upload-progress-container");
    const uploadProgressFill = document.getElementById("upload-progress-fill");
    const uploadProgressText = document.getElementById("upload-progress-text");

    function showUploadProgress(percentage, text = `${percentage}%`) {
        if (uploadProgressContainer && uploadProgressFill && uploadProgressText) {
            uploadProgressContainer.style.display = 'block';
            uploadProgressText.style.display = 'block';
            uploadProgressFill.style.width = `${percentage}%`;
            uploadProgressText.textContent = text;
        }
    }

    function hideUploadProgress() {
        if (uploadProgressContainer && uploadProgressText) {
            uploadProgressContainer.style.display = 'none';
            uploadProgressText.style.display = 'none';
            uploadProgressFill.style.width = '0%';
        }
    }

    async function loadDocuments() {
        if (!documentListDiv) return;
        documentListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading documents...</p>';
        try {
            const documents = await apiRequest("GET", "/documents");
            documentListDiv.innerHTML = '';
            if (documents.length === 0) {
                documentListDiv.innerHTML = '<p style="color: var(--text-medium);">No documents uploaded yet.</p>';
            } else {
                documents.forEach(doc => {
                    const docItem = document.createElement("div");
                    docItem.className = "document-item";
                    docItem.innerHTML = `
                        <h4>${doc.title}</h4>
                        <p>File: ${doc.file_name}</p>
                        <p>Description: ${doc.description || 'N/A'}</p>
                        <p>Uploaded: ${new Date(doc.upload_date).toLocaleDateString()}</p>
                        <div class="actions">
                            <a href="${API_BASE_URL}/documents/download/${doc.document_id}" class="btn btn-secondary btn-sm" download>Download</a>
                            <button class="btn-delete" data-type="document" data-id="${doc.document_id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>`;
                    documentListDiv.appendChild(docItem);
                });
            }
        } catch (error) {
            documentListDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        }
    }
    
    if (uploadDocumentForm) {
        uploadDocumentForm.addEventListener("submit", async e => {
            e.preventDefault();
            const title = documentTitleInput.value.trim();
            const file = documentFileInput.files[0];
            const description = documentDescriptionInput.value.trim();
            if (!title || !file) {
                showModalMessage("Please provide a document title and select a file.", true);
                return;
            }
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('document_file', file);
            try {
                showUploadProgress(0, 'Starting upload...');
                await apiRequest("POST", "/documents/upload", formData, true, event => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded * 100) / event.total);
                        showUploadProgress(percentComplete, `Uploading: ${percentComplete}%`);
                    }
                });
                showModalMessage("Document uploaded successfully!", false);
                uploadDocumentForm.reset();
                hideUploadProgress();
                loadDocuments();
            } catch (error) {
                showModalMessage(`Upload failed: ${error.message}`, true);
                hideUploadProgress();
            }
        });
    }

    if (documentListDiv) {
        documentListDiv.addEventListener("click", async e => {
            const targetButton = e.target.closest(".btn-delete");
            if (targetButton && targetButton.dataset.type === "document") {
                const idToDelete = parseInt(targetButton.dataset.id, 10);
                const confirmed = await showConfirmModal("Are you sure you want to delete this document?", "Delete");
                if (confirmed) {
                    try {
                        await apiRequest("DELETE", `/documents/${idToDelete}`);
                        showModalMessage("Document deleted successfully.", false);
                        loadDocuments();
                    } catch (error) {
                        showModalMessage(`Error deleting document: ${error.message}`, true);
                    }
                }
            }
        });
    }
    loadDocuments();
}

function handleChecklistsPage() {
    if (!localStorage.getItem("authToken")) { window.location.href = "login.html"; return; }
    // Add logic for checklists page here
}

function handleNewHireViewPage() {
    if (!localStorage.getItem("authToken")) { window.location.href = "login.html"; return; }
    // Add logic for new hire view page here
}


// Global DOMContentLoaded listener
document.addEventListener("DOMContentLoaded", () => {
    setupSettingsDropdown();
    const path = window.location.pathname;
    if (path.includes("login.html")) handleLoginPage();
    else if (path.includes("register.html")) handleRegisterPage();
    else if (path.includes("suite-hub.html")) handleSuiteHubPage();
    else if (path.includes("account.html")) handleAccountPage();
    else if (path.includes("admin.html")) handleAdminPage();
    else if (path.includes("dashboard.html")) handleDashboardPage();
    else if (path.includes("checklists.html")) handleChecklistsPage();
    else if (path.includes("new-hire-view.html")) handleNewHireViewPage();
    else if (path.includes("pricing.html")) handlePricingPage();
    else if (path.includes("documents.html")) handleDocumentsPage();
    else if (path.includes("hiring.html")) handleHiringPage();
    else if (path.includes("scheduling.html")) {
        if (typeof moment !== 'undefined') handleSchedulingPage();
        else console.error("Moment.js is not loaded.");
    }
});
