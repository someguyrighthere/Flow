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
    if (!localStorage.getItem("authToken")) { window.location.href = "login.html"; return; }
    // Add logic for dashboard page here
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

/**
 * =================================================================
 * COMPLETE & FIXED: handleChecklistsPage
 * =================================================================
 */
function handleChecklistsPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const checklistSection = document.getElementById('checklists-section');
    const checklistListDiv = document.getElementById("checklist-list");
    const newChecklistForm = document.getElementById("new-checklist-form");
    const structureTypeSelect = document.getElementById("structure-type-select");
    const timeGroupCountContainer = document.getElementById("time-group-count-container");
    const timeGroupCountInput = document.getElementById("time-group-count");
    const timeGroupCountLabel = document.getElementById("time-group-count-label");
    const tasksInputArea = document.getElementById("tasks-input-area");
    const attachDocumentModalOverlay = document.getElementById("attach-document-modal-overlay");
    const attachDocumentListDiv = document.getElementById("attach-document-list");
    const attachDocumentCancelBtn = document.getElementById("attach-document-cancel-btn");
    let currentTaskElementForAttachment = null;
    let taskCounter = 0;

    function addSingleTaskInput(container, task = {}) {
        const div = document.createElement('div');
        div.className = 'form-group task-input-group';
        div.dataset.documentId = task.documentId || '';
        div.dataset.documentName = task.documentName || '';
        const uniqueInputId = `task-input-${taskCounter++}`;
        div.innerHTML = `
            <div class="task-input-container">
                <div class="form-group" style="flex-grow: 1; margin-bottom: 0;">
                    <label for="${uniqueInputId}">Task Description</label>
                    <input type="text" id="${uniqueInputId}" class="task-description-input" value="${task.description || ''}" placeholder="e.g., Complete HR paperwork" required>
                </div>
                <div class="task-actions" style="display: flex; align-items: flex-end; gap: 5px; margin-bottom: 0;">
                    <button type="button" class="btn btn-secondary btn-sm attach-file-btn">Attach</button>
                    <button type="button" class="btn btn-secondary btn-sm remove-task-btn">Remove</button>
                </div>
            </div>
            <div class="attached-document-info" style="margin-top: 5px; height: auto; min-height: 1.2em;">
                ${task.documentName ? `<span class="attachment-chip">${task.documentName}</span>` : ''}
            </div>
        `;
        container.appendChild(div);
        div.querySelector('.remove-task-btn').addEventListener('click', () => div.remove());
        div.querySelector('.attach-file-btn').addEventListener('click', (e) => {
            currentTaskElementForAttachment = e.target.closest('.task-input-group');
            openDocumentSelectorModal();
        });
    }

    async function openDocumentSelectorModal() {
        if (!attachDocumentModalOverlay || !attachDocumentListDiv) return;
        attachDocumentListDiv.innerHTML = '<p>Loading documents...</p>';
        attachDocumentModalOverlay.style.display = 'flex';
        try {
            const documents = await apiRequest('GET', '/documents');
            attachDocumentListDiv.innerHTML = '';
            
            if (documents.length === 0) {
                attachDocumentListDiv.insertAdjacentHTML('beforeend', '<p>No documents found. Upload in "Documents" app first.</p>');
                return;
            }

            documents.forEach(doc => {
                const docButton = document.createElement('button');
                docButton.className = 'list-item';
                docButton.style.width = '100%';
                docButton.style.cursor = 'pointer';
                docButton.textContent = `${doc.title} (${doc.file_name})`;
                docButton.dataset.documentId = doc.document_id;
                docButton.dataset.documentName = doc.file_name;
                
                docButton.onclick = () => {
                    if (currentTaskElementForAttachment) {
                        const docId = docButton.dataset.documentId;
                        const docName = docButton.dataset.documentName;
                        
                        currentTaskElementForAttachment.dataset.documentId = docId;
                        currentTaskElementForAttachment.dataset.documentName = docName;
                        
                        const infoDiv = currentTaskElementForAttachment.querySelector('.attached-document-info');
                        if (infoDiv) infoDiv.innerHTML = `<span class="attachment-chip">${docName}</span>`;
                    }
                    attachDocumentModalOverlay.style.display = 'none';
                };
                attachDocumentListDiv.appendChild(docButton);
            });
        } catch (error) {
            attachDocumentListDiv.innerHTML = `<p style="color: #e74c3c;">Error: ${error.message}</p>`;
        }
    }
    
    if (attachDocumentCancelBtn) attachDocumentCancelBtn.addEventListener('click', () => attachDocumentModalOverlay.style.display = 'none');
    if (attachDocumentModalOverlay) attachDocumentModalOverlay.addEventListener('click', (e) => {
        if (e.target === attachDocumentModalOverlay) attachDocumentModalOverlay.style.display = 'none';
    });

    function renderNewChecklistTaskInputs() {
        if (!tasksInputArea || !structureTypeSelect || !timeGroupCountInput) return;
        tasksInputArea.innerHTML = '';
        const structureType = structureTypeSelect.value;
        const groupCount = parseInt(timeGroupCountInput.value, 10) || 1;

        if (structureType === 'single_list') {
            addSingleTaskInput(tasksInputArea);
            const addTaskBtn = document.createElement('button');
            addTaskBtn.type = 'button';
            addTaskBtn.className = 'btn btn-secondary';
            addTaskBtn.textContent = 'Add Another Task +';
            addTaskBtn.style.marginTop = '10px';
            addTaskBtn.addEventListener('click', () => addSingleTaskInput(tasksInputArea));
            tasksInputArea.appendChild(addTaskBtn);
        } else {
            for (let i = 0; i < groupCount; i++) {
                const groupTitle = structureType === 'daily' ? `Day ${i + 1}` : `Week ${i + 1}`;
                const groupContainer = document.createElement('div');
                groupContainer.className = 'card time-group-container';
                groupContainer.innerHTML = `
                    <h4 style="color: var(--text-light); margin-top: 0;">${groupTitle}</h4>
                    <div class="tasks-in-group" data-group-index="${i}"></div>
                    <button type="button" class="btn btn-secondary add-task-to-group-btn" style="margin-top: 10px;" data-group-index="${i}">Add Task to ${groupTitle} +</button>
                `;
                tasksInputArea.appendChild(groupContainer);
                const tasksInGroupDiv = groupContainer.querySelector('.tasks-in-group');
                addSingleTaskInput(tasksInGroupDiv);
                groupContainer.querySelector('.add-task-to-group-btn').addEventListener('click', (event) => {
                    const targetGroupDiv = tasksInputArea.querySelector(`.tasks-in-group[data-group-index="${event.target.dataset.groupIndex}"]`);
                    if (targetGroupDiv) addSingleTaskInput(targetGroupDiv);
                });
            }
        }
    }
    
    if (structureTypeSelect) {
        structureTypeSelect.addEventListener('change', () => {
            const type = structureTypeSelect.value;
            timeGroupCountContainer.style.display = (type === 'daily' || type === 'weekly') ? 'block' : 'none';
            timeGroupCountLabel.textContent = `Number of ${type === 'daily' ? 'Days' : 'Weeks'}`;
            renderNewChecklistTaskInputs();
        });
    }
    if (timeGroupCountInput) {
        timeGroupCountInput.addEventListener('input', renderNewChecklistTaskInputs);
    }
    renderNewChecklistTaskInputs();

    async function loadChecklists() {
        if (!checklistListDiv) return;
        checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading task lists...</p>';
        try {
            const checklists = await apiRequest("GET", "/checklists");
            checklistListDiv.innerHTML = '';
            if (checklists && checklists.length > 0) {
                checklists.forEach(checklist => {
                    const checklistItem = document.createElement("div");
                    checklistItem.className = "checklist-item";
                    checklistItem.innerHTML = `
                        <div class="checklist-item-title">
                            <span style="color: var(--primary-accent);">${checklist.position}</span>
                            <span>- ${checklist.title}</span>
                            <span style="font-size: 0.8em; color: var(--text-medium);">(${checklist.structure_type})</span>
                        </div>
                        <div class="checklist-item-actions">
                            <button class="btn btn-secondary btn-sm view-checklist-btn" data-checklist-id="${checklist.checklist_id}">View/Edit</button>
                            <button class="btn-delete" data-type="checklist" data-id="${checklist.checklist_id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>`;
                    checklistListDiv.appendChild(checklistItem);
                });
            } else {
                checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">No task lists created yet.</p>';
            }
        } catch (error) {
            console.error("Error loading checklists:", error);
            checklistListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading task lists: ${error.message}</p>`;
        }
    }
    
    if (checklistSection) {
        checklistSection.addEventListener('click', async (event) => {
             const deleteButton = event.target.closest('.btn-delete[data-type="checklist"]');
            if (deleteButton) {
                const checklistId = deleteButton.dataset.id;
                const confirmed = await showConfirmModal(`Are you sure you want to delete this task list? This action cannot be undone.`, "Delete");
                if (confirmed) {
                    try {
                        await apiRequest("DELETE", `/checklists/${checklistId}`);
                        showModalMessage("Task list deleted successfully!", false);
                        loadChecklists();
                    } catch (error) {
                        showModalMessage(`Failed to delete task list: ${error.message}`, true);
                    }
                }
            }
        });
    }

    if (newChecklistForm) {
        newChecklistForm.addEventListener("submit", async e => {
            e.preventDefault();
            const position = document.getElementById("new-checklist-position").value.trim();
            const title = document.getElementById("new-checklist-title").value.trim();
            const structure_type = structureTypeSelect.value;
            const group_count = (structure_type !== 'single_list') ? parseInt(timeGroupCountInput.value, 10) : 0;
            let tasks = [];

            if (structure_type === 'single_list') {
                document.querySelectorAll('#tasks-input-area .task-input-group').forEach(groupEl => {
                    const descriptionInput = groupEl.querySelector('.task-description-input');
                    if (descriptionInput && descriptionInput.value.trim()) {
                        tasks.push({
                            description: descriptionInput.value.trim(),
                            completed: false,
                            documentId: groupEl.dataset.documentId || null,
                            documentName: groupEl.dataset.documentName || null
                        });
                    }
                });
            } else {
                 document.querySelectorAll('#tasks-input-area .time-group-container').forEach((groupContainer, index) => {
                    const groupTasks = [];
                    groupContainer.querySelectorAll('.task-input-group').forEach(groupEl => {
                        const descriptionInput = groupEl.querySelector('.task-description-input');
                        if (descriptionInput && descriptionInput.value.trim()) {
                            groupTasks.push({
                                description: descriptionInput.value.trim(),
                                completed: false,
                                documentId: groupEl.dataset.documentId || null,
                                documentName: groupEl.dataset.documentName || null
                            });
                        }
                    });
                    tasks.push({
                        groupTitle: structure_type === 'daily' ? `Day ${index + 1}` : `Week ${index + 1}`,
                        tasks: groupTasks
                    });
                 });
            }

            if (!position || !title || tasks.length === 0 || (structure_type !== 'single_list' && tasks.every(group => group.tasks.length === 0))) {
                showModalMessage("Please provide a position, title, and at least one task.", true);
                return;
            }
            try {
                await apiRequest("POST", "/checklists", { position, title, structure_type, group_count, tasks });
                showModalMessage(`Task List "${title}" created successfully!`, false);
                newChecklistForm.reset();
                renderNewChecklistTaskInputs();
                loadChecklists();
            } catch (error) {
                showModalMessage(error.message, true);
            }
        });
    }
    loadChecklists();
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
