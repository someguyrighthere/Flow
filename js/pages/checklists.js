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

    // Attach Document Modal Elements
    const attachDocumentModalOverlay = document.getElementById('attach-document-modal-overlay');
    const attachDocumentListDiv = document.getElementById('attach-document-list');
    const attachDocumentCancelBtn = document.getElementById('attach-document-cancel-btn');

    // NEW: Edit Checklist Modal Elements
    const editChecklistModalOverlay = document.getElementById('edit-checklist-modal-overlay');
    const editChecklistForm = document.getElementById('edit-checklist-form');
    const editChecklistIdInput = document.getElementById('edit-checklist-id');
    const editChecklistPositionInput = document.getElementById('edit-checklist-position');
    const editChecklistTitleInput = document.getElementById('edit-checklist-title');
    const editTasksInputArea = document.getElementById('edit-tasks-input-area');
    const addEditTaskBtn = document.getElementById('add-edit-task-btn');
    const editChecklistCancelBtn = document.getElementById('edit-checklist-cancel-btn');

    let taskCounter = 0; // Used for unique IDs for tasks in new checklist form
    let editTaskCounter = 0; // Used for unique IDs for tasks in edit checklist form
    let currentTaskElement = null; // To keep track of which task's attach button was clicked

    /**
     * Adds a new task input field to a specified form.
     * @param {HTMLElement} targetArea - The container to add the task input to (e.g., tasksInputArea or editTasksInputArea).
     * @param {string} description - Pre-fill task description (for editing).
     * @param {string} documentId - Pre-fill attached document ID (for editing).
     * @param {string} documentName - Pre-fill attached document name (for editing).
     * @param {string} prefix - Prefix for input IDs (e.g., 'task' or 'edit-task').
     * @param {number} currentCount - Current counter for unique IDs.
     * @returns {HTMLElement} The created task group element.
     */
    const addNewTaskField = (targetArea, description = '', documentId = '', documentName = '', prefix = 'task', currentCount = null) => {
        if (!targetArea) return;

        const counter = currentCount !== null ? currentCount : (prefix === 'task' ? taskCounter++ : editTaskCounter++);
        const taskGroup = document.createElement('div');
        taskGroup.className = 'form-group task-input-group';
        const inputId = `${prefix}-input-${counter}`;

        taskGroup.innerHTML = `
            <div style="display: flex; align-items: flex-end; gap: 10px;">
                <div style="flex-grow: 1;">
                    <label for="${inputId}">Task Description</label>
                    <input type="text" id="${inputId}" class="task-description-input" value="${description}" required placeholder="Enter a task">
                </div>
                <div class="task-actions" style="display: flex; align-items: flex-end; gap: 5px; margin-bottom: 0;">
                    <button type="button" class="btn btn-secondary btn-sm attach-file-btn">Attach</button>
                    <button type="button" class="btn btn-secondary btn-sm remove-task-btn">Remove</button>
                </div>
            </div>
            <div class="attached-document-info" style="font-size: 0.8rem; color: var(--text-medium); margin-top: 5px; height: 1.2em;"></div>
        `;

        targetArea.appendChild(taskGroup);

        // Store attached document info if provided
        if (documentId && documentName) {
            taskGroup.dataset.attachedDocumentId = documentId;
            taskGroup.dataset.attachedDocumentName = documentName;
            const infoDiv = taskGroup.querySelector('.attached-document-info');
            if (infoDiv) {
                infoDiv.innerHTML = `Attached: <a href="${documentName}" target="_blank" style="color: var(--primary-accent);">${documentName.split('/').pop()}</a>`;
            }
        }

        // Add event listener for remove button
        taskGroup.querySelector('.remove-task-btn').addEventListener('click', () => {
            // Ensure at least one task remains
            if (targetArea.children.length > 1) {
                taskGroup.remove();
            } else {
                showModalMessage("A task list must have at least one task.", true);
            }
        });

        return taskGroup; // Return the created element for attaching event listeners
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
                    item.innerHTML = `
                        <span><strong>${checklist.title}</strong> (For: ${checklist.position})</span>
                        <div class="checklist-item-actions">
                            <button class="btn btn-secondary btn-sm btn-edit" data-id="${checklist.id}" title="Edit Task List">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                                    <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/>
                                </svg>
                            </button>
                            <button class="btn btn-danger btn-sm btn-delete" data-id="${checklist.id}" title="Delete Task List">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
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
            // FIX: Add a timestamp to bypass browser cache for /api/documents
            const documents = await apiRequest('GET', `/api/documents?_t=${Date.now()}`);
            attachDocumentListDiv.innerHTML = '';

            if (documents && documents.length > 0) {
                documents.forEach(doc => {
                    const docItem = document.createElement('div');
                    docItem.className = 'document-list-item';
                    docItem.dataset.documentId = doc.document_id;
                    docItem.dataset.documentName = doc.file_name; // Use file_name for actual attachment (GCS URL)
                    docItem.innerHTML = `
                        <span>${doc.title} (<small>${doc.file_name.split('/').pop()}</small>)</span>
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
                        // Hide modal after selection
                        if (attachDocumentModalOverlay) {
                             attachDocumentModalOverlay.style.display = 'none';
                        }
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
     * @param {string} documentName - The name of the document file (which will be the GCS URL).
     */
    const attachDocumentToTask = (documentId, documentName) => {
        if (currentTaskElement) {
            // Store document info directly on the taskGroup element for later retrieval on form submit
            currentTaskElement.dataset.attachedDocumentId = documentId;
            currentTaskElement.dataset.attachedDocumentName = documentName;

            // Update the display for the user, showing only the filename from the URL
            const infoDiv = currentTaskElement.querySelector('.attached-document-info');
            if (infoDiv) {
                infoDiv.innerHTML = `Attached: <a href="${documentName}" target="_blank" style="color: var(--primary-accent);">${documentName.split('/').pop()}</a>`;
            }
        }
    };

    /**
     * Deletes a task list.
     * @param {string} checklistId - The ID of the checklist to delete.
     */
    const deleteChecklist = async (checklistId) => {
        const confirmed = await showConfirmModal('Are you sure you want to delete this task list? This cannot be undone and will unassign it from any employees.', 'Delete');
        if (confirmed) {
            try {
                await apiRequest('DELETE', `/api/checklists/${checklistId}`);
                showModalMessage('Task list deleted successfully!', false);
                loadChecklists(); // Reload the list
            } catch (error) {
                showModalMessage(`Error deleting task list: ${error.message}`, true);
                console.error('Error deleting task list:', error);
            }
        }
    };

    /**
     * Opens the edit checklist modal and populates it with data.
     * @param {string} checklistId - The ID of the checklist to edit.
     */
    const openEditChecklistModal = async (checklistId) => {
        if (!editChecklistModalOverlay || !editTasksInputArea) return;

        try {
            // Fetch the specific checklist data
            const checklist = await apiRequest('GET', `/api/checklists/${checklistId}`);
            if (!checklist) {
                showModalMessage('Task list not found.', true);
                return;
            }

            // Populate form fields
            editChecklistIdInput.value = checklist.id;
            editChecklistPositionInput.value = checklist.position;
            editChecklistTitleInput.value = checklist.title;

            // Clear existing tasks and populate with current tasks
            editTasksInputArea.innerHTML = '';
            editTaskCounter = 0; // Reset counter for edit form tasks
            if (checklist.tasks && checklist.tasks.length > 0) {
                checklist.tasks.forEach(task => {
                    // Re-use addNewTaskField for edit form tasks
                    addNewTaskField(editTasksInputArea, task.description, task.documentId, task.documentName, 'edit-task', editTaskCounter++);
                });
            } else {
                // If no tasks, add one empty task field
                addNewTaskField(editTasksInputArea, '', '', '', 'edit-task', editTaskCounter++);
            }

            editChecklistModalOverlay.style.display = 'flex'; // Show the modal
        } catch (error) {
            showModalMessage(`Error loading task list for editing: ${error.message}`, true);
            console.error('Error loading checklist for edit:', error);
        }
    };


    // --- Event Listeners ---

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => addNewTaskField(tasksInputArea, '', '', '', 'task'));
    }

    if (addEditTaskBtn) {
        addEditTaskBtn.addEventListener('click', () => addNewTaskField(editTasksInputArea, '', '', '', 'edit-task'));
    }

    // Event delegation for dynamically added 'Attach' buttons (for both new and edit forms)
    // Listen on the document body or a common parent of both task input areas
    document.body.addEventListener('click', (e) => {
        const attachButton = e.target.closest('.attach-file-btn');
        if (attachButton) {
            currentTaskElement = attachButton.closest('.task-input-group'); // Store reference to the parent task group
            if (attachDocumentModalOverlay) {
                attachDocumentModalOverlay.style.display = 'flex'; // Show the modal
                loadDocumentsForAttachModal(); // Load documents every time modal is opened
            }
        }
    });

    // Close attach document modal
    if (attachDocumentCancelBtn) {
        attachDocumentCancelBtn.addEventListener('click', () => {
            if (attachDocumentModalOverlay) {
                attachDocumentModalOverlay.style.display = 'none';
            }
        });
    }

    // Close edit checklist modal
    if (editChecklistCancelBtn) {
        editChecklistCancelBtn.addEventListener('click', () => {
            if (editChecklistModalOverlay) {
                editChecklistModalOverlay.style.display = 'none';
            }
        });
    }

    // Event delegation for Edit and Delete buttons on checklist items
    if (checklistListDiv) {
        checklistListDiv.addEventListener('click', (e) => {
            const editButton = e.target.closest('.btn-edit');
            const deleteButton = e.target.closest('.btn-delete');

            if (editButton) {
                const checklistId = editButton.dataset.id;
                openEditChecklistModal(checklistId);
            } else if (deleteButton) {
                const checklistId = deleteButton.dataset.id;
                deleteChecklist(checklistId);
            }
        });
    }

    if (newChecklistForm) {
        newChecklistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tasks = [];
            document.querySelectorAll('#tasks-input-area .task-input-group').forEach(taskGroup => {
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
            };

            try {
                await apiRequest('POST', '/api/checklists', payload);
                showModalMessage('Task list created successfully!', false);
                newChecklistForm.reset();
                tasksInputArea.innerHTML = ''; // Clear all task input fields
                addNewTaskField(tasksInputArea, '', '', '', 'task'); // Add one fresh task input field
                loadChecklists(); // Reload the list of checklists
            } catch (error) {
                showModalMessage(`Error: ${error.message}`, true);
                console.error('Error creating task list:', error);
            }
        });
    }

    // NEW: Handle Edit Checklist Form Submission
    if (editChecklistForm) {
        editChecklistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const checklistId = editChecklistIdInput.value;
            const tasks = [];
            document.querySelectorAll('#edit-tasks-input-area .task-input-group').forEach(taskGroup => {
                const descriptionInput = taskGroup.querySelector('.task-description-input');
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
                title: editChecklistTitleInput.value.trim(),
                position: editChecklistPositionInput.value.trim(),
                tasks,
            };

            try {
                await apiRequest('PUT', `/api/checklists/${checklistId}`, payload);
                showModalMessage('Task list updated successfully!', false);
                editChecklistModalOverlay.style.display = 'none'; // Hide modal
                loadChecklists(); // Reload the list
            } catch (error) {
                showModalMessage(`Error updating task list: ${error.message}`, true);
                console.error('Error updating task list:', error);
            }
        });
    }

    // Initial page load
    if (tasksInputArea && tasksInputArea.childElementCount === 0) {
        addNewTaskField(tasksInputArea, '', '', '', 'task');
    }
    loadChecklists();
}
