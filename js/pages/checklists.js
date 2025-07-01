// js/pages/checklists.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js'; 

/**
 * Handles all logic for the checklists/task lists page.
 */
export function handleChecklistsPage() {
    // Security check: Redirect to login page if no authentication token is found in local storage
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // --- Get all necessary elements from the DOM ---
    const newChecklistForm = document.getElementById("new-checklist-form");
    const tasksInputArea = document.getElementById("tasks-input-area");
    
    // Elements for task structure
    const structureTypeSelect = document.getElementById('structure-type-select');
    const timeGroupCountContainer = document.getElementById('time-group-count-container');
    const timeGroupCountLabel = document.getElementById('time-group-count-label');
    const timeGroupCountInput = document.getElementById('time-group-count');

    const checklistListDiv = document.getElementById('checklist-list');
    const checklistStatusMessage = document.getElementById('checklist-status-message'); 

    // Document attachment modal elements
    const attachDocumentModalOverlay = document.getElementById("attach-document-modal-overlay");
    const attachDocumentListDiv = document.getElementById("attach-document-list");
    const attachDocumentCancelBtn = document.getElementById("attach-document-cancel-btn");
    
    // State variables
    let taskCounter = 0; // Counter for unique task input IDs
    let currentTaskElementForAttachment = null; // To store which task input group the document is being attached to

    // --- Helper function to display local status messages ---
    /**
     * Displays a status message on a specified DOM element.
     * @param {HTMLElement} element - The DOM element to display the message in.
     * @param {string} message - The message text.
     * @param {boolean} [isError=false] - True if the message is an error, false for success.
     */
    function displayStatusMessage(element, message, isError = false) {
        if (!element) return;
        element.textContent = message;
        element.classList.remove('success', 'error'); // Clear previous states
        element.classList.add(isError ? 'error' : 'success');
        setTimeout(() => {
            element.textContent = '';
            element.classList.remove('success', 'error');
        }, 5000); // Clear message after 5 seconds
    }

    // --- Data Loading and Rendering ---

    /**
     * Fetches and displays existing task lists from the backend.
     */
    async function loadChecklists() {
        if (!checklistListDiv) return;
        checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading task lists...</p>'; // Indicate loading
        
        try {
            // Fetch checklists from the backend API
            const checklists = await apiRequest('GET', '/checklists');
            checklistListDiv.innerHTML = ''; // Clear loading message

            if (checklists && checklists.length > 0) {
                // Render each checklist item
                checklists.forEach(checklist => {
                    const checklistItem = document.createElement('div');
                    checklistItem.className = 'checklist-item';
                    checklistItem.innerHTML = `
                        <div class="checklist-item-title">
                            ${checklist.title} <span style="font-size:0.8em; color:var(--text-medium);">(${checklist.position})</span>
                        </div>
                        <div class="checklist-item-actions">
                            <button class="btn-delete" data-id="${checklist.id}" title="Delete Task List">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 1 0 0 1-2 2H5a2 1 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    checklistListDiv.appendChild(checklistItem);

                    // Attach delete listener for dynamically added delete buttons
                    checklistItem.querySelector('.btn-delete').addEventListener('click', async (e) => {
                        const checklistId = e.currentTarget.dataset.id;
                        const confirmed = await showConfirmModal('Are you sure you want to delete this task list? This action will also remove any assigned onboarding tasks linked to it. This cannot be undone.', 'Delete');
                        if (confirmed) {
                            try {
                                await apiRequest('DELETE', `/checklists/${checklistId}`);
                                displayStatusMessage(checklistStatusMessage, 'Task List deleted successfully!', false);
                                loadChecklists(); // Reload the list to reflect deletion
                            } catch (error) {
                                displayStatusMessage(checklistStatusMessage, `Error deleting task list: ${error.message}`, true);
                                console.error('Error deleting task list:', error);
                            }
                        }
                    });
                });
            } else {
                checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">No task lists found. Create one above!</p>';
            }
        } catch (error) {
            displayStatusMessage(checklistStatusMessage, `Error loading task lists: ${error.message}`, true);
            console.error('Error loading task lists:', error);
            // Fallback message if API fails completely
            if (checklistListDiv.innerHTML === '<p style="color: var(--text-medium);">Loading task lists...</p>') {
                checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">Task list functionality temporarily unavailable. Please contact support.</p>';
            }
        }
    }


    /**
     * Adds a new task input field to the form for creating a new checklist.
     * @param {HTMLElement} container - The container to append the new task input to.
     * @param {object} [task={}] - An existing task object to pre-fill the input (used when editing, not for new).
     */
    function addSingleTaskInput(container, task = {}) {
        const div = document.createElement('div');
        div.className = 'form-group task-input-group';
        // Set data attributes for document ID and name if an existing task is provided
        div.dataset.documentId = task.documentId || '';
        div.dataset.documentName = task.documentName || '';
        
        const uniqueInputId = `task-input-${taskCounter++}`; // Generate unique ID for each task input group
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
                ${task.documentName ? `<span class="attachment-chip">${task.documentName} <button type="button" class="remove-attachment-btn" data-task-id="${uniqueInputId}">&times;</button></span>` : ''}
            </div>
        `;
        container.appendChild(div);

        // Add event listeners to the new buttons within this task input group
        div.querySelector('.remove-task-btn').addEventListener('click', () => {
            if (document.querySelectorAll('.task-input-group').length > 1) { // Ensure at least one task remains
                div.remove(); // Remove the entire task input group
            } else {
                displayStatusMessage(checklistStatusMessage, "Task list must have at least one task.", true);
            }
        });

        // Event listener for the "Attach" button for this specific task
        div.querySelector('.attach-file-btn').addEventListener('click', (e) => {
            currentTaskElementForAttachment = e.target.closest('.task-input-group'); // Store reference to the current task element
            openDocumentSelectorModal(); // Open the document selection modal
        });

        // Event listener for removing an attached document (if any exists on load or is newly attached)
        const removeAttachmentBtn = div.querySelector('.remove-attachment-btn');
        if (removeAttachmentBtn) {
            removeAttachmentBtn.addEventListener('click', () => {
                const parentInfoDiv = removeAttachmentBtn.closest('.attached-document-info');
                if (parentInfoDiv) {
                    parentInfoDiv.innerHTML = ''; // Clear the attachment display
                    // Also clear the data attributes on the parent task-input-group
                    parentInfoDiv.closest('.task-input-group').dataset.documentId = '';
                    parentInfoDiv.closest('.task-input-group').dataset.documentName = '';
                }
            });
        }
    }

    /**
     * Opens the document selector modal and loads available documents from the API.
     */
    async function openDocumentSelectorModal() {
        if (!attachDocumentModalOverlay || !attachDocumentListDiv) return;

        attachDocumentListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading documents...</p>'; // Show loading state
        attachDocumentModalOverlay.style.display = 'flex'; // Show the modal

        try {
            const documents = await apiRequest('GET', '/documents'); // Fetch all documents
            attachDocumentListDiv.innerHTML = ''; // Clear loading message

            if (documents && documents.length > 0) {
                documents.forEach(doc => {
                    const docItem = document.createElement('div');
                    docItem.className = 'document-list-item';
                    docItem.dataset.documentId = doc.document_id; // Store document ID
                    docItem.dataset.documentName = doc.title; // Store document name
                    docItem.innerHTML = `
                        <span>${doc.title}</span>
                        <span style="font-size: 0.8em; color: var(--text-medium);">${(doc.size / 1024).toFixed(1)} KB</span>
                    `;
                    // Add click listener to select a document
                    docItem.addEventListener('click', () => {
                        // Attach document info to the current task being edited
                        if (currentTaskElementForAttachment) {
                            currentTaskElementForAttachment.dataset.documentId = doc.document_id;
                            currentTaskElementForAttachment.dataset.documentName = doc.title;
                            // Update the UI to show the attached document
                            const attachedInfoDiv = currentTaskElementForAttachment.querySelector('.attached-document-info');
                            if (attachedInfoDiv) {
                                attachedInfoDiv.innerHTML = 
                                    `<span class="attachment-chip">${doc.title} <button type="button" class="remove-attachment-btn" data-task-id="${currentTaskElementForAttachment.id}">&times;</button></span>`;
                                
                                // Re-add event listener for the newly created remove button
                                attachedInfoDiv.querySelector('.remove-attachment-btn').addEventListener('click', (e) => {
                                    e.target.closest('.attached-document-info').innerHTML = ''; // Clear display
                                    // Clear data attributes from the parent task-input-group
                                    e.target.closest('.task-input-group').dataset.documentId = '';
                                    e.target.closest('.task-input-group').dataset.documentName = '';
                                });
                            }
                            displayStatusMessage(checklistStatusMessage, `Document "${doc.title}" attached.`, false);
                        }
                        attachDocumentModalOverlay.style.display = 'none'; // Close modal after selection
                    });
                    attachDocumentListDiv.appendChild(docItem);
                });
            } else {
                attachDocumentListDiv.innerHTML = '<p style="color: var(--text-medium);">No documents found. Upload some in the Documents section.</p>';
            }
        } catch (error) {
            displayStatusMessage(checklistStatusMessage, `Error loading documents: ${error.message}`, true);
            attachDocumentListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading documents.</p>`;
            console.error('Error loading documents for attachment:', error);
        }
    }


    // --- Event Listeners ---
    
    // Attach document modal cancel button
    if (attachDocumentCancelBtn) {
        attachDocumentCancelBtn.addEventListener('click', () => {
            if (attachDocumentModalOverlay) {
                attachDocumentModalOverlay.style.display = 'none'; // Hide the modal
            }
        });
    }

    // Event listener for changes in the task structure type (single list, daily, weekly)
    if (structureTypeSelect) {
        structureTypeSelect.addEventListener('change', () => {
            const selectedValue = structureTypeSelect.value;
            if (selectedValue === 'daily' || selectedValue === 'weekly') {
                timeGroupCountLabel.textContent = selectedValue === 'daily' ? 'Number of Days' : 'Number of Weeks';
                timeGroupCountContainer.style.display = 'block'; // Show the count input
            } else {
                timeGroupCountContainer.style.display = 'none'; // Hide the count input
            }
        });
    }

    // Event listener for "Add Another Task" button
    const addTaskBtn = document.getElementById('add-task-btn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            addSingleTaskInput(tasksInputArea); // Add a new empty task input field
        });
    }

    // Event listener for the new checklist form submission
    if (newChecklistForm) {
        newChecklistForm.addEventListener("submit", async e => {
            e.preventDefault(); // Prevent default form submission
            
            // Collect all tasks from the form
            const tasks = [];
            document.querySelectorAll('#tasks-input-area .task-input-group').forEach((groupEl, index) => {
                const descriptionInput = groupEl.querySelector('.task-description-input');
                const documentId = groupEl.dataset.documentId; // Get attached document ID
                const documentName = groupEl.dataset.documentName; // Get attached document name

                if (descriptionInput && descriptionInput.value.trim()) {
                    tasks.push({
                        description: descriptionInput.value.trim(),
                        completed: false, // New tasks are always incomplete
                        documentId: documentId || null, // Store document ID or null
                        documentName: documentName || null, // Store document name or null
                        task_order: index + 1 // Assign an order based on current position
                    });
                }
            });

            const position = document.getElementById("new-checklist-position").value.trim();
            const title = document.getElementById("new-checklist-title").value.trim();
            const structure_type = structureTypeSelect.value;
            const time_group_count_value = timeGroupCountInput.value;

            // Basic validation
            if (!position || !title || tasks.length === 0) {
                displayStatusMessage(checklistStatusMessage, "Please provide a position, title, and at least one task.", true);
                return;
            }

            const payload = {
                position,
                title,
                tasks,
                structure_type,
                time_group_count: (structure_type === 'daily' || structure_type === 'weekly') ? parseInt(time_group_count_value, 10) : null
            };

            try {
                // Send new checklist data to the backend API
                await apiRequest("POST", "/checklists", payload); 
                displayStatusMessage(checklistStatusMessage, `Task List created successfully!`, false);
                newChecklistForm.reset(); // Reset the form
                timeGroupCountContainer.style.display = 'none'; // Hide count input
                tasksInputArea.innerHTML = ''; // Clear all task inputs
                taskCounter = 0; // Reset task counter
                addSingleTaskInput(tasksInputArea); // Add back a single empty task input for convenience
                loadChecklists(); // Reload checklists to show the newly created one
            } catch (error) {
                displayStatusMessage(checklistStatusMessage, `Error creating task list: ${error.message}`, true);
                console.error('Error creating task list:', error);
            }
        });
    }

    // --- Initial page setup ---
    loadChecklists(); // Load existing task lists when the page loads

    // Ensure at least one task input is present on load and attach listeners
    if(tasksInputArea) {
        if (tasksInputArea.children.length === 0) {
            addSingleTaskInput(tasksInputArea);
        }
        // Re-attach listeners for existing (if any) and future remove/attach buttons
        // This part ensures that if tasks are pre-filled (e.g., from an edit scenario, though not implemented here)
        // or dynamically added, their buttons work.
        document.querySelectorAll('.remove-task-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (document.querySelectorAll('.task-input-group').length > 1) {
                    btn.closest('.task-input-group').remove();
                } else {
                    displayStatusMessage(checklistStatusMessage, "Task list must have at least one task.", true);
                }
            });
        });
        document.querySelectorAll('.attach-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentTaskElementForAttachment = e.target.closest('.task-input-group');
                openDocumentSelectorModal();
            });
        });
        // Re-attach listeners for existing remove-attachment-btn elements if any (e.g., on load for existing tasks)
        document.querySelectorAll('.remove-attachment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const parentInfoDiv = btn.closest('.attached-document-info');
                if (parentInfoDiv) {
                    parentInfoDiv.innerHTML = '';
                    parentInfoDiv.closest('.task-input-group').dataset.documentId = '';
                    parentInfoDiv.closest('.task-input-group').dataset.documentName = '';
                }
            });
        });
    }
}
