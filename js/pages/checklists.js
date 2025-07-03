import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleChecklistsPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const addTaskBtn = document.getElementById('add-task-btn');
    const tasksInputArea = document.getElementById('tasks-input-area');
    const newChecklistForm = document.getElementById('new-checklist-form');
    const checklistListDiv = document.getElementById('checklist-list');

    // NEW: Modal elements for attaching documents
    const attachDocumentModalOverlay = document.getElementById('attach-document-modal-overlay');
    const attachDocumentListDiv = document.getElementById('attach-document-list');
    const attachDocumentCancelBtn = document.getElementById('attach-document-cancel-btn');

    let taskCounter = 0;
    let currentTaskElement = null; // To keep track of which task's attach button was clicked

    /**
     * Adds a new task input field to the form.
     */
    const addNewTaskField = () => {
        if (!tasksInputArea) return;

        const taskGroup = document.createElement('div');
        taskGroup.className = 'form-group task-input-group';
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

        // Add event listener for remove button
        taskGroup.querySelector('.remove-task-btn').addEventListener('click', () => {
            if (tasksInputArea.children.length > 1) {
                taskGroup.remove();
            } else {
                showModalMessage("A task list must have at least one task.", true);
            }
        });
    };
    
    /**
     * Loads existing checklists from the API and renders them.
     */
    const loadChecklists = async () => {
        if (!checklistListDiv) return;
        checklistListDiv.innerHTML = `<p style="color: var(--text-medium);">Loading...</p>`;
        try {
            const checklists = await apiRequest('GET', '/api/checklists');
            checklistListDiv.innerHTML = '';
            if (checklists && checklists.length > 0) {
                checklists.forEach(checklist => {
                    const item = document.createElement('div');
                    item.className = 'list-item';
                    item.innerHTML = `<span><strong>${checklist.title}</strong> (For: ${checklist.position})</span>`;
                    checklistListDiv.appendChild(item);
                });
            } else {
                checklistListDiv.innerHTML = `<p style="color: var(--text-medium);">No task lists created yet.</p>`;
            }
        } catch (e) {
            checklistListDiv.innerHTML = `<p style="color:red;">Could not load task lists: ${e.message}</p>`;
            console.error('Error loading checklists:', e);
        }
    };

    /**
     * Fetches documents from the API and populates the attach document modal.
     */
    const loadDocumentsForAttachModal = async () => {
        if (!attachDocumentListDiv) return;
        attachDocumentListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading documents...</p>';
        try {
            const documents = await apiRequest('GET', '/api/documents');
            attachDocumentListDiv.innerHTML = '';

            if (documents && documents.length > 0) {
                documents.forEach(doc => {
                    const docItem = document.createElement('div');
                    docItem.className = 'document-list-item';
                    docItem.dataset.documentId = doc.document_id;
                    docItem.dataset.documentName = doc.file_name; // Use file_name for actual attachment
                    docItem.innerHTML = `
                        <span>${doc.title} (<small>${doc.file_name}</small>)</span>
                        <button class="btn btn-primary btn-sm select-document-btn">Select</button>
                    `;
                    attachDocumentListDiv.appendChild(docItem);
                });

                // Add event listeners to select buttons
                attachDocumentListDiv.querySelectorAll('.select-document-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const selectedDocItem = e.target.closest('.document-list-item');
                        const documentId = selectedDocItem.dataset.documentId;
                        const documentName = selectedDocItem.dataset.documentName;
                        attachDocumentToTask(documentId, documentName);
                        attachDocumentModalOverlay.style.display = 'none'; // Hide modal after selection
                    });
                });
            } else {
                attachDocumentListDiv.innerHTML = '<p style="color: var(--text-medium);">No documents available to attach. Upload some in the Documents section.</p>';
            }
        } catch (error) {
            attachDocumentListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading documents: ${error.message}</p>`;
            console.error('Error loading documents for modal:', error);
        }
    };

    /**
     * Attaches a selected document to the current task being edited.
     * @param {string} documentId - The ID of the document.
     * @param {string} documentName - The name of the document file.
     */
    const attachDocumentToTask = (documentId, documentName) => {
        if (currentTaskElement) {
            // Store document info directly on the taskGroup element for later retrieval on form submit
            currentTaskElement.dataset.attachedDocumentId = documentId;
            currentTaskElement.dataset.attachedDocumentName = documentName;

            // Update the display for the user
            const infoDiv = currentTaskElement.querySelector('.attached-document-info');
            if (infoDiv) {
                infoDiv.innerHTML = `Attached: <a href="/uploads/${encodeURIComponent(documentName)}" target="_blank" style="color: var(--primary-accent);">${documentName}</a>`;
            }
        }
    };

    // --- Event Listeners ---

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', addNewTaskField);
    }

    // NEW: Event delegation for dynamically added 'Attach' buttons
    if (tasksInputArea) {
        tasksInputArea.addEventListener('click', (e) => {
            const attachButton = e.target.closest('.attach-file-btn');
            if (attachButton) {
                currentTaskElement = attachButton.closest('.task-input-group'); // Store reference to the parent task group
                if (attachDocumentModalOverlay) {
                    attachDocumentModalOverlay.style.display = 'flex'; // Show the modal
                    loadDocumentsForAttachModal(); // Load documents every time modal is opened
                }
            }
        });
    }

    // NEW: Close attach document modal
    if (attachDocumentCancelBtn) {
        attachDocumentCancelBtn.addEventListener('click', () => {
            if (attachDocumentModalOverlay) {
                attachDocumentModalOverlay.style.display = 'none';
            }
        });
    }

    if (newChecklistForm) {
        newChecklistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tasks = [];
            document.querySelectorAll('.task-input-group').forEach(taskGroup => {
                const descriptionInput = taskGroup.querySelector('.task-description-input');
                if (descriptionInput && descriptionInput.value.trim()) {
                    const task = { description: descriptionInput.value.trim() };
                    // Check if a document was attached to this specific task input group
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
                title: document.getElementById('new-checklist-title').value.trim(),
                position: document.getElementById('new-checklist-position').value.trim(),
                tasks,
                // Add structure_type and time_group_count to payload if needed by backend
                // structure_type: document.getElementById('structure-type-select').value,
                // time_group_count: document.getElementById('time-group-count').value,
            };

            try {
                await apiRequest('POST', '/api/checklists', payload);
                showModalMessage('Task list created successfully!', false);
                newChecklistForm.reset();
                tasksInputArea.innerHTML = ''; // Clear all task input fields
                addNewTaskField(); // Add one fresh task input field
                loadChecklists(); // Reload the list of checklists
            } catch (error) {
                showModalMessage(`Error: ${error.message}`, true);
                console.error('Error creating task list:', error);
            }
        });
    }

    // Initial page load
    if (tasksInputArea && tasksInputArea.childElementCount === 0) {
        addNewTaskField();
    }
    loadChecklists();
}
