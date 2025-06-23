// app.js - Client-Side JavaScript for Flow Business Suite
// This file handles all client-side logic, form submissions, and API requests.
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

let stripe;
if (typeof Stripe !== 'undefined') {
    stripe = Stripe('pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td');
} else {
    console.warn("Stripe.js not loaded. Stripe functionalities will not work on this page.");
}

// (showModalMessage, showConfirmModal, setupSettingsDropdown, apiRequest functions remain the same...)
// ... Paste your existing showModalMessage, showConfirmModal, setupSettingsDropdown, and apiRequest functions here ...
function showModalMessage(message, isError = false) {
    const modalOverlay = document.getElementById("message-modal-overlay");
    const modalMessage = document.getElementById("modal-message-text");
    const modalCloseButton = document.getElementById("modal-close-button");
    if (modalOverlay && modalMessage && modalCloseButton) {
        modalMessage.textContent = message;
        modalMessage.style.color = isError ? "#ff8a80" : "var(--text-light)";
        modalOverlay.style.display = "flex";
        modalOverlay.style.zIndex = "1000";
        modalCloseButton.onclick = () => {
            modalOverlay.style.display = "none";
        };
        modalOverlay.onclick = event => {
            if (event.target === modalOverlay) {
                modalOverlay.style.display = "none";
            }
        };
    } else {
        console.error("Modal elements not found for showModalMessage. Message:", message);
        if (isError) {
            console.error(`ERROR: ${message}`);
        } else {
            console.log(`MESSAGE: ${message}`);
        }
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

        const handleConfirm = () => {
            confirmModalOverlay.style.display = "none";
            modalConfirmButton.removeEventListener("click", handleConfirm);
            modalCancelButton.removeEventListener("click", handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            confirmModalOverlay.style.display = "none";
            modalConfirmButton.removeEventListener("click", handleConfirm);
            modalCancelButton.removeEventListener("click", handleCancel);
            resolve(false);
        };

        modalConfirmButton.addEventListener("click", handleConfirm);
        modalCancelButton.addEventListener("click", handleCancel);
        confirmModalOverlay.onclick = event => {
            if (event.target === confirmModalOverlay) {
                handleCancel();
            }
        };
    });
}
function setupSettingsDropdown() {
    const settingsButton = document.getElementById("settings-button");
    const settingsDropdown = document.getElementById("settings-dropdown");
    const logoutButton = document.getElementById("logout-button");
    const upgradePlanLink = document.getElementById("upgrade-plan-link");

    if (settingsButton && settingsDropdown) {
        settingsButton.addEventListener("click", async event => {
            event.stopPropagation();
            settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";

            if (settingsDropdown.style.display === "block" && upgradePlanLink) {
                if (localStorage.getItem("authToken")) {
                    try {
                        const profile = await apiRequest("GET", "/profile");
                        if (profile && profile.plan_id === 'free') {
                            upgradePlanLink.style.display = 'block';
                        } else {
                            upgradePlanLink.style.display = 'none';
                        }
                    } catch (error) {
                        console.error("Error fetching profile for upgrade link:", error);
                        upgradePlanLink.style.display = 'none';
                    }
                } else {
                    upgradePlanLink.style.display = 'none';
                }
            }
        });
        document.addEventListener("click", event => {
            if (!settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
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

    if (isFormData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            if (onProgress && xhr.upload) {
                xhr.upload.addEventListener('progress', onProgress);
            }
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    if (xhr.status === 204 || (xhr.status === 200 && xhr.responseText.length === 0)) {
                        resolve({});
                    } else {
                        try {
                            const responseData = JSON.parse(xhr.responseText);
                            resolve(responseData);
                        } catch (e) {
                            console.warn("API response was not JSON, resolving with success status:", xhr.responseText);
                            resolve({ message: "Operation successful", rawResponse: xhr.responseText });
                        }
                    }
                } else if (xhr.status === 401 || xhr.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
                    reject(new Error('Authentication token missing or invalid.'));
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error || `HTTP error! Status: ${xhr.status}`));
                    } catch (e) {
                        reject(new Error(`HTTP error! Status: ${xhr.status} - ${xhr.statusText || 'Unknown Error'}`));
                    }
                }
            };
            xhr.onerror = function () {
                reject(new Error('Network error or request failed. Please check your internet connection.'));
            };
            xhr.send(body);
        });
    } else {
        const options = {
            method: method,
            headers: {}
        };
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        if (body && (method === 'POST' || method === 'PUT')) {
             options.headers['Content-Type'] = 'application/json';
             options.body = JSON.stringify(body);
        }
        const response = await fetch(endpoint, options);
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
            throw new Error('Authentication token missing or invalid.');
        }
        if (!response.ok) {
            let errorMsg = `HTTP error! Status: ${response.status}`;
            try {
                const errorText = await response.text();
                if (errorText) {
                    try {
                        const errorData = JSON.parse(errorText);
                        errorMsg = errorData.error || errorText;
                    } catch (parseError) {
                        errorMsg = errorText;
                    }
                }
            } catch (bodyError) {
                console.error("Could not read error response body", bodyError);
            }
            throw new Error(errorMsg);
        }
        if (expectBlobResponse) {
            return response.blob();
        }
        if (response.status === 204 || (response.status === 200 && response.headers.get("content-length") === "0")) {
            return null;
        }
        return response.json();
    }
}
function handleLoginPage() { /* ... same as before ... */ }
function handleRegisterPage() { /* ... same as before ... */ }
function handleSuiteHubPage() { /* ... same as before ... */ }
function handleAccountPage() { /* ... same as before ... */ }
function handleAdminPage() { /* ... same as before ... */ }
function handleDashboardPage() { /* ... same as before ... */ }


/**
 * =================================================================
 * UPDATED: handleChecklistsPage
 * =================================================================
 * Handles logic for checklists.html page, including the new
 * "attach document" feature.
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

    // --- NEW: Elements for the Attach Document Modal ---
    const attachDocumentModalOverlay = document.getElementById("attach-document-modal-overlay");
    const attachDocumentListDiv = document.getElementById("attach-document-list");
    const attachDocumentCancelBtn = document.getElementById("attach-document-cancel-btn");
    let currentTaskElementForAttachment = null; // Variable to store which task we're attaching to

    let taskCounter = 0;

    /**
     * --- MODIFIED: This function now includes an "Attach File" button and a display area. ---
     * Adds a single task input field.
     * @param {HTMLElement} container - The container to add the input to.
     * @param {object} task - Optional object with task data { description, documentId, documentName }.
     */
    function addSingleTaskInput(container, task = {}) {
        const div = document.createElement('div');
        div.className = 'form-group task-input-group';
        div.dataset.documentId = task.documentId || ''; // Store document ID here
        
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
            <div class="attached-document-info" style="font-size: 0.8rem; color: var(--text-medium); margin-top: 5px; height: 1.2em;">
                ${task.documentName ? `Attached: ${task.documentName}` : ''}
            </div>
        `;
        container.appendChild(div);

        div.querySelector('.remove-task-btn').addEventListener('click', () => {
            div.remove();
        });

        // --- NEW: Event listener for the "Attach" button ---
        div.querySelector('.attach-file-btn').addEventListener('click', (e) => {
            currentTaskElementForAttachment = e.target.closest('.task-input-group');
            openDocumentSelectorModal();
        });
    }

    // --- NEW: Function to open and populate the document selection modal ---
    async function openDocumentSelectorModal() {
        if (!attachDocumentModalOverlay || !attachDocumentListDiv) return;

        attachDocumentListDiv.innerHTML = '<p>Loading documents...</p>';
        attachDocumentModalOverlay.style.display = 'flex';

        try {
            const documents = await apiRequest('GET', '/documents');
            attachDocumentListDiv.innerHTML = ''; // Clear loading message

            // --- NEW: Button to remove an existing attachment ---
            const removeAttachmentBtn = document.createElement('button');
            removeAttachmentBtn.className = 'list-item';
            removeAttachmentBtn.style.cssText = 'width: 100%; cursor: pointer; color: #ff8a80; justify-content: center; margin-bottom: 10px;';
            removeAttachmentBtn.textContent = 'Remove Attachment From Task';
            removeAttachmentBtn.onclick = () => {
                if (currentTaskElementForAttachment) {
                    currentTaskElementForAttachment.dataset.documentId = '';
                    currentTaskElementForAttachment.querySelector('.attached-document-info').textContent = '';
                }
                attachDocumentModalOverlay.style.display = 'none';
            };
            attachDocumentListDiv.appendChild(removeAttachmentBtn);

            if (documents.length === 0) {
                attachDocumentListDiv.insertAdjacentHTML('beforeend', '<p>No documents found. Please upload files in the "Documents" app first.</p>');
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
                        currentTaskElementForAttachment.dataset.documentId = docButton.dataset.documentId;
                        const infoDiv = currentTaskElementForAttachment.querySelector('.attached-document-info');
                        if (infoDiv) {
                            infoDiv.textContent = `Attached: ${docButton.dataset.documentName}`;
                        }
                    }
                    attachDocumentModalOverlay.style.display = 'none';
                };
                attachDocumentListDiv.appendChild(docButton);
            });
        } catch (error) {
            attachDocumentListDiv.innerHTML = `<p style="color: #e74c3c;">Error: ${error.message}</p>`;
        }
    }
    
    // --- NEW: Event listeners for the new modal ---
    if (attachDocumentCancelBtn) {
        attachDocumentCancelBtn.addEventListener('click', () => {
            attachDocumentModalOverlay.style.display = 'none';
        });
    }
    if (attachDocumentModalOverlay) {
        attachDocumentModalOverlay.addEventListener('click', (e) => {
            if (e.target === attachDocumentModalOverlay) {
                attachDocumentModalOverlay.style.display = 'none';
            }
        });
    }

    // Function to render task inputs (logic is the same, calls the modified addSingleTaskInput)
    function renderNewChecklistTaskInputs() {
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
    
    // Event listeners for form structure (unchanged)
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

    // Load existing checklists (logic unchanged)
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
                        </div>
                    `;
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
    
    // Event delegation for delete (unchanged)
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

    // Form submission logic
    if (newChecklistForm) {
        newChecklistForm.addEventListener("submit", async e => {
            e.preventDefault();
            const position = document.getElementById("new-checklist-position").value.trim();
            const title = document.getElementById("new-checklist-title").value.trim();
            const structure_type = structureTypeSelect.value;
            const group_count = (structure_type === 'daily' || structure_type === 'weekly') ? parseInt(timeGroupCountInput.value, 10) : 0;

            let tasks = [];
            // --- MODIFIED: This logic now collects the documentId and documentName ---
            if (structure_type === 'single_list') {
                document.querySelectorAll('#tasks-input-area .task-input-group').forEach(groupEl => {
                    const descriptionInput = groupEl.querySelector('.task-description-input');
                    if (descriptionInput && descriptionInput.value.trim()) {
                        tasks.push({
                            description: descriptionInput.value.trim(),
                            completed: false,
                            documentId: groupEl.dataset.documentId || null,
                            documentName: groupEl.querySelector('.attached-document-info').textContent.replace('Attached: ', '') || null
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
                                documentName: groupEl.querySelector('.attached-document-info').textContent.replace('Attached: ', '') || null
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


/**
 * =================================================================
 * UPDATED: handleNewHireViewPage
 * =================================================================
 * Handles logic for new-hire-view.html, now including logic to
 * display and handle download links for attached documents.
 */
function handleNewHireViewPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const welcomeHeading = document.getElementById("welcome-heading");
    const taskListSection = document.getElementById("task-list-section");
    const logoutButton = document.getElementById("logout-button");
    const completionCelebration = document.getElementById("completion-celebration");

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            localStorage.removeItem("authToken");
            localStorage.removeItem("userRole");
            window.location.href = "login.html";
        });
    }

    function triggerFireworks() {
        if (completionCelebration) {
            completionCelebration.style.display = 'flex';
            setTimeout(() => {
                completionCelebration.style.display = 'none';
            }, 5000);
        }
    }
    
    // --- NEW: Helper to safely download a file with authentication ---
    async function downloadFile(documentId, fileName) {
        try {
            showModalMessage("Preparing your download...", false);
            const blob = await apiRequest("GET", `/documents/download/${documentId}`, null, false, null, true);
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
            const modalOverlay = document.getElementById("message-modal-overlay");
            if(modalOverlay) modalOverlay.style.display = 'none';
            
        } catch (error) {
            showModalMessage(`Failed to download file: ${error.message}`, true);
        }
    }

    async function loadOnboardingTasks() {
        if (!taskListSection) return;
        taskListSection.innerHTML = '<p style="color: var(--text-medium);">Loading your tasks...</p>';
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const userIdForViewing = urlParams.get('userId');
            const profile = await apiRequest("GET", "/profile");
            const targetUserId = userIdForViewing || profile.user_id;

            welcomeHeading.textContent = `Welcome, ${profile.full_name}!`;
            if (userIdForViewing && userIdForViewing !== profile.user_id) {
                welcomeHeading.textContent = `Viewing Onboarding for User ID: ${userIdForViewing}`;
            }

            const tasksData = await apiRequest("GET", `/onboarding-tasks/${targetUserId}`);
            taskListSection.innerHTML = '';
            
            if (tasksData && tasksData.tasks) {
                let allTasksCompleted = true;

                // --- MODIFIED: This function now renders a download button if there's an attachment ---
                const renderTask = (task) => {
                    if (!task.completed) allTasksCompleted = false;
                    
                    const attachmentHtml = task.documentId && task.documentName ?
                        `<button class="btn btn-secondary btn-sm download-attachment-btn" 
                                 data-doc-id="${task.documentId}" 
                                 data-doc-name="${task.documentName}" 
                                 style="margin-left: 15px;">
                            Download: ${task.documentName}
                         </button>` : '';

                    return `
                        <div class="task-item ${task.completed ? 'completed' : ''}">
                            <input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''} data-task-id="${task.id}">
                            <label for="task-${task.id}">${task.description}</label>
                            ${attachmentHtml}
                        </div>
                    `;
                };

                if (tasksData.tasks[0]?.groupTitle) {
                    tasksData.tasks.forEach(group => {
                        const groupDiv = document.createElement('div');
                        groupDiv.className = 'task-group';
                        groupDiv.innerHTML = `<details open><summary>${group.groupTitle}</summary></details>`;
                        const details = groupDiv.querySelector('details');
                        group.tasks.forEach(task => details.innerHTML += renderTask(task));
                        taskListSection.appendChild(groupDiv);
                    });
                } else {
                    tasksData.tasks.forEach(task => {
                        taskListSection.innerHTML += renderTask(task);
                    });
                }
                
                taskListSection.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    checkbox.addEventListener('change', async (event) => {
                        const taskId = event.target.dataset.taskId;
                        const isCompleted = event.target.checked;
                        try {
                            await apiRequest("PUT", `/onboarding-tasks/${taskId}`, { completed: isCompleted });
                            event.target.closest('.task-item').classList.toggle('completed', isCompleted);
                            
                            const allDone = Array.from(taskListSection.querySelectorAll('input[type="checkbox"]')).every(cb => cb.checked);
                            if (allDone) triggerFireworks();

                        } catch (error) {
                            showModalMessage(`Failed to update task: ${error.message}`, true);
                            event.target.checked = !isCompleted;
                        }
                    });
                });
                
                // --- NEW: Event listener for the new download buttons ---
                taskListSection.querySelectorAll('.download-attachment-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        const docId = e.target.dataset.docId;
                        const docName = e.target.dataset.docName;
                        downloadFile(docId, docName);
                    });
                });

                if (allTasksCompleted && tasksData.tasks.length > 0) {
                    triggerFireworks();
                }

            } else {
                taskListSection.innerHTML = '<p style="color: var(--text-medium);">No onboarding tasks assigned or found.</p>';
            }
        } catch (error) {
            console.error("Error loading onboarding tasks:", error);
            taskListSection.innerHTML = `<p style="color: #e74c3c;">Error loading tasks: ${error.message}</p>`;
        }
    }

    loadOnboardingTasks();
}

// ... other handler functions (handlePricingPage, handleHiringPage, etc.) remain the same ...
// ... Paste your existing handlePricingPage, handleHiringPage, etc. functions here ...
function handlePricingPage() { /* ... same as before ... */ }
function handleHiringPage() { /* ... same as before ... */ }
function handleDocumentsPage() { /* ... same as before ... */ }
function handleSchedulingPage() { /* ... same as before ... */ }


// Global DOMContentLoaded listener to call page-specific handlers
document.addEventListener("DOMContentLoaded", () => {
    setupSettingsDropdown();
    const path = window.location.pathname;

    if (path.includes("login.html")) {
        handleLoginPage();
    } else if (path.includes("register.html")) {
        handleRegisterPage();
    } else if (path.includes("suite-hub.html")) {
        handleSuiteHubPage();
    } else if (path.includes("account.html")) {
        handleAccountPage();
    } else if (path.includes("admin.html")) {
        handleAdminPage();
    } else if (path.includes("dashboard.html")) {
        handleDashboardPage();
    } else if (path.includes("checklists.html")) {
        handleChecklistsPage();
    } else if (path.includes("new-hire-view.html")) {
        handleNewHireViewPage();
    } else if (path.includes("pricing.html")) {
        handlePricingPage();
    } else if (path.includes("documents.html")) {
        handleDocumentsPage();
    } else if (path.includes("hiring.html")) {
        handleHiringPage();
    } else if (path.includes("scheduling.html")) {
        if (typeof moment === 'undefined') {
            console.error("Moment.js is not loaded. Scheduling page functionality will be limited.");
            showModalMessage("Scheduling requires Moment.js library. Please ensure it's loaded in scheduling.html.", true);
        } else {
            handleSchedulingPage();
        }
    }
});
