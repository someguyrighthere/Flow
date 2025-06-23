// app.js - Client-Side JavaScript for Flow Business Suite
// This file handles all client-side logic, form submissions, and API requests.
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

let stripe;
if (typeof Stripe !== 'undefined') {
    stripe = Stripe('pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td');
} else {
    console.warn("Stripe.js not loaded. Stripe functionalities will not work on this page.");
}

/**
 * Displays a custom modal message to the user.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message, false otherwise.
 */
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

/**
 * Displays a confirmation modal to the user.
 * @param {string} message - The confirmation message to display.
 * @param {string} confirmButtonText - Text for the confirm button.
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled.
 */
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

/**
 * Sets up the functionality for the settings dropdown menu.
 */
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
 * Handles API requests to the backend.
 */
async function apiRequest(method, path, body = null, isFormData = false, onProgress = null, expectBlobResponse = false) {
    const token = localStorage.getItem('authToken');
    const endpoint = `${API_BASE_URL}${path}`;

    if (isFormData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            if (onProgress && xhr.upload) xhr.upload.addEventListener('progress', onProgress);
            
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    if (xhr.status === 204 || (xhr.status === 200 && xhr.responseText.length === 0)) {
                        resolve({});
                    } else {
                        try { resolve(JSON.parse(xhr.responseText)); } catch (e) {
                            console.warn("API response was not JSON:", xhr.responseText);
                            resolve({ message: "Operation successful", rawResponse: xhr.responseText });
                        }
                    }
                } else if (xhr.status === 401 || xhr.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
                    reject(new Error('Authentication failed.'));
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error || `HTTP error! Status: ${xhr.status}`));
                    } catch (e) {
                        reject(new Error(`HTTP error! Status: ${xhr.status} - ${xhr.statusText || 'Unknown Error'}`));
                    }
                }
            };
            xhr.onerror = () => reject(new Error('Network error. Please check your connection.'));
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
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
        throw new Error('Authentication failed.');
    }

    if (!response.ok) {
        let errorMsg = `HTTP error! Status: ${response.status}`;
        try {
            const errorText = await response.text();
            if (errorText) errorMsg = JSON.parse(errorText).error || errorText;
        } catch (e) { /* Ignore parsing error, use status code */ }
        throw new Error(errorMsg);
    }

    if (expectBlobResponse) return response.blob();
    if (response.status === 204 || response.headers.get("content-length") === "0") return null;
    return response.json();
}

// Page-specific handlers
function handleLoginPage() { /* ... function content from your app.js ... */ }
function handleRegisterPage() { /* ... function content from your app.js ... */ }
function handleSuiteHubPage() { /* ... function content from your app.js ... */ }
function handleAccountPage() { /* ... function content from your app.js ... */ }
function handleAdminPage() { /* ... function content from your app.js ... */ }
function handleDashboardPage() { /* ... function content from your app.js ... */ }
function handlePricingPage() { /* ... function content from your app.js ... */ }
function handleHiringPage() { /* ... function content from your app.js ... */ }
function handleSchedulingPage() { /* ... function content from your app.js ... */ }
function handleDocumentsPage() { /* ... function content from your app.js ... */ }

/**
 * =================================================================
 * handleChecklistsPage
 * =================================================================
 */
function handleChecklistsPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const checklistSection = document.getElementById('checklists-section');
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
                        currentTaskElementForAttachment.dataset.documentId = docButton.dataset.documentId;
                        const infoDiv = currentTaskElementForAttachment.querySelector('.attached-document-info');
                        if (infoDiv) infoDiv.textContent = `Attached: ${docButton.dataset.documentName}`;
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

    function renderNewChecklistTaskInputs() { /* ... logic as before ... */ }
    if (structureTypeSelect) structureTypeSelect.addEventListener('change', () => { /* ... logic as before ... */ });
    if (timeGroupCountInput) timeGroupCountInput.addEventListener('input', renderNewChecklistTaskInputs);
    renderNewChecklistTaskInputs();

    async function loadChecklists() { /* ... logic as before ... */ }
    
    if (checklistSection) {
        checklistSection.addEventListener('click', async (event) => { /* ... logic as before ... */ });
    }

    if (newChecklistForm) {
        newChecklistForm.addEventListener("submit", async e => { /* ... logic as before ... */ });
    }
    loadChecklists();
}

/**
 * =================================================================
 * UPDATED: handleNewHireViewPage
 * =================================================================
 */
function handleNewHireViewPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const welcomeHeading = document.getElementById("welcome-heading");
    const taskListSection = document.getElementById("task-list-section");
    const completionCelebration = document.getElementById("completion-celebration");

    function triggerFireworks() { /* (logic from previous turns) */ }
    
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
            window.URL.revokeObjectURL(a.href);
            a.remove();
            
            // --- FIX: Replaced optional chaining with a standard if check ---
            const modalOverlay = document.getElementById("message-modal-overlay");
            if (modalOverlay) {
                modalOverlay.style.display = 'none';
            }
        } catch (error) {
            showModalMessage(`Failed to download file: ${error.message}`, true);
        }
    }

    async function loadOnboardingTasks() {
        if (!taskListSection) return;
        taskListSection.innerHTML = '<p>Loading tasks...</p>';
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const userIdForViewing = urlParams.get('userId');
            const profile = await apiRequest("GET", "/profile");
            const targetUserId = userIdForViewing || profile.user_id;

            welcomeHeading.textContent = `Welcome, ${profile.full_name}!`;
            if (userIdForViewing) welcomeHeading.textContent = `Viewing Onboarding for User ID: ${userIdForViewing}`;

            const tasksData = await apiRequest("GET", `/onboarding-tasks/${targetUserId}`);
            taskListSection.innerHTML = '';
            
            if (tasksData && tasksData.tasks) {
                let allTasksCompleted = true;
                const renderTask = (task) => {
                    if (!task.completed) allTasksCompleted = false;
                    const attachmentHtml = task.documentId && task.documentName ?
                        `<button class="btn btn-secondary btn-sm download-attachment-btn" data-doc-id="${task.documentId}" data-doc-name="${task.documentName}">Download: ${task.documentName}</button>` : '';
                    return `<div class="task-item ${task.completed ? 'completed' : ''}">
                                <input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''} data-task-id="${task.id}">
                                <label for="task-${task.id}">${task.description}</label>
                                ${attachmentHtml}
                            </div>`;
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
                    tasksData.tasks.forEach(task => taskListSection.innerHTML += renderTask(task));
                }
                
                taskListSection.querySelectorAll('.download-attachment-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        downloadFile(e.target.dataset.docId, e.target.dataset.docName);
                    });
                });
            } else {
                taskListSection.innerHTML = '<p>No onboarding tasks assigned.</p>';
            }
        } catch (error) {
            taskListSection.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        }
    }
    loadOnboardingTasks();
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
        if (typeof moment !== 'undefined') {
            handleSchedulingPage();
        } else {
            console.error("Moment.js is not loaded.");
        }
    }
});
