// js/pages/checklists.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js'; // Keep imports, but use local displayStatusMessage

/**
 * Handles all logic for the checklists/task lists page.
 */
export function handleChecklistsPage() {
    // Security check
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
    let taskCounter = 0;
    let currentTaskElementForAttachment = null; // To store which task input group the document is being attached to

    // --- Helper function to display local status messages ---
    function displayStatusMessage(element, message, isError = false) {
        if (!element) return;
        element.textContent = message;
        element.classList.remove('success', 'error'); // Clear previous states
        element.classList.add(isError ? 'error' : 'success');
        setTimeout(() => {
            element.textContent = '';
            element.classList.remove('success', 'error');
        }, 5000); 
    }

    // --- Data Loading and Rendering ---

    /**
     * Fetches and displays existing task lists.
     * Updated to display static message if API routes are not yet available.
     */
    async function loadChecklists() {
        if (!checklistListDiv) return;
        checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading task lists...</p>'; // Indicate loading
        // For now, still display disabled message as backend is not fully implemented for checklists
        displayStatusMessage(checklistStatusMessage, 'Task list functionality temporarily disabled. Please contact support.', true);
        // Original API call (commented out as backend routes might be missing or under development)
        // try {
        //     const checklists = await apiRequest('GET', '/checklists');
        //     checklistListDiv.innerHTML = ''; 
        //     if (checklists && checklists.length > 0) {
        //         checklists.forEach(checklist => { /* render each checklist */ });
        //     } else {
        //         checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">No task lists found. Create one above!</p>';
        //     }
        // } catch (error) {
        //     displayStatusMessage(checklistStatusMessage, `Error loading task lists: ${error.message}`, true);
        // }
    }


    /**
     * Adds a new task input field to the form.
     * @param {HTMLElement} container - The container to append the new task input to.
     * @param {object} [task={}] - An existing task object to pre-fill the input.
     */
    function addSingleTaskInput(container, task = {}) {
        const div = document.createElement('div');
        div.className = 'form-group task-input-group';
        // Set data attributes for document ID and name if an existing task is provided
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
                    <button type="button" class="btn btn-secondary btn-sm attach-file-btn">Attach</button> <!-- Button is now visible by default -->
                    <button type="button" class="btn btn-secondary btn-sm remove-task-btn">Remove</button>
                </div>
            </div>
            <div class="attached-document-info" style="font-size: 0.8rem; color: var(--text-medium); margin-top: 5px; height: 1.2em;">
                ${task.documentName ? `<span class="attachment-chip">${task.documentName} <button type="button" class="remove-attachment-btn" data-task-id="${uniqueInputId}">&times;</button></span>` : ''}
            </div>
        `;
        container.appendChild(div);

        // Add event listeners to the new buttons
        div.querySelector('.remove-task-btn').addEventListener('click', () => {
            if (document.querySelectorAll('.task-input-group').length > 1) { // Ensure at least one task remains
                div.remove();
            } else {
                displayStatusMessage(checklistStatusMessage, "Task list must have at least one task.", true);
            }
        });

        // Event listener for the "Attach" button
        div.querySelector('.attach-file-btn').addEventListener('click', (e) => {
            currentTaskElementForAttachment = e.target.closest('.task-input-group');
            openDocumentSelectorModal();
        });

        // Event listener for removing an attached document (if any)
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
     * Opens the document selector modal and loads available documents.
     */
    async function openDocumentSelectorModal() {
        if (!attachDocumentModalOverlay || !attachDocumentListDiv) return;

        attachDocumentListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading documents...</p>';
        attachDocumentModalOverlay.style.display = 'flex'; // Show the modal

        try {
            const documents = await apiRequest('GET', '/documents');
            attachDocumentListDiv.innerHTML = ''; // Clear loading message

            if (documents && documents.length > 0) {
                documents.forEach(doc => {
                    const docItem = document.createElement('div');
                    docItem.className = 'document-list-item';
                    docItem.dataset.documentId = doc.document_id;
                    docItem.dataset.documentName = doc.title;
                    docItem.innerHTML = `
                        <span>${doc.title}</span>
                        <span style="font-size: 0.8em; color: var(--text-medium);">${(doc.size / 1024).toFixed(1)} KB</span>
                    `;
                    docItem.addEventListener('click', () => {
                        // Attach document to the current task
                        if (currentTaskElementForAttachment) {
                            currentTaskElementForAttachment.dataset.documentId = doc.document_id;
                            currentTaskElementForAttachment.dataset.documentName = doc.title;
                            currentTaskElementForAttachment.querySelector('.attached-document-info').innerHTML = 
                                `<span class="attachment-chip">${doc.title} <button type="button" class="remove-attachment-btn" data-task-id="${currentTaskElementForAttachment.id}">&times;</button></span>`;
                            
                            // Re-add event listener for the newly created remove button
                            currentTaskElementForAttachment.querySelector('.remove-attachment-btn').addEventListener('click', (e) => {
                                e.target.closest('.attached-document-info').innerHTML = '';
                                e.target.closest('.task-input-group').dataset.documentId = '';
                                e.target.closest('.task-input-group').dataset.documentName = '';
                            });

                            displayStatusMessage(checklistStatusMessage, `Document "${doc.title}" attached.`, false);
                        }
                        attachDocumentModalOverlay.style.display = 'none'; // Close modal
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
                attachDocumentModalOverlay.style.display = 'none';
            }
        });
    }

    if (structureTypeSelect) {
        structureTypeSelect.addEventListener('change', () => {
            const selectedValue = structureTypeSelect.value;
            if (selectedValue === 'daily' || selectedValue === 'weekly') {
                timeGroupCountLabel.textContent = selectedValue === 'daily' ? 'Number of Days' : 'Number of Weeks';
                timeGroupCountContainer.style.display = 'block';
            } else {
                timeGroupCountContainer.style.display = 'none';
            }
        });
    }

    // Event listener for "Add Another Task" button
    const addTaskBtn = document.getElementById('add-task-btn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            addSingleTaskInput(tasksInputArea);
        });
    }

    if (newChecklistForm) {
        newChecklistForm.addEventListener("submit", async e => {
            e.preventDefault();
            
            // Collect all tasks from the form
            const tasks = [];
            document.querySelectorAll('#tasks-input-area .task-input-group').forEach(groupEl => {
                const descriptionInput = groupEl.querySelector('.task-description-input');
                const documentId = groupEl.dataset.documentId;
                const documentName = groupEl.dataset.documentName;

                if (descriptionInput && descriptionInput.value.trim()) {
                    tasks.push({
                        description: descriptionInput.value.trim(),
                        completed: false, // Default to false for new tasks
                        documentId: documentId || null,
                        documentName: documentName || null
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

            // This form submission is currently a placeholder as backend route is still under development for full functionality.
            displayStatusMessage(checklistStatusMessage, "Task List creation functionality temporarily disabled. Please contact support.", true);
            
            // try {
            //     await apiRequest("POST", "/checklists", payload); // Backend route for checklists needs to be implemented/enabled
            //     displayStatusMessage(checklistStatusMessage, `Task List created successfully!`, false);
            //     newChecklistForm.reset();
            //     timeGroupCountContainer.style.display = 'none';
            //     tasksInputArea.innerHTML = '';
            //     taskCounter = 0;
            //     addSingleTaskInput(tasksInputArea); // Add back a single empty task input
            //     loadChecklists(); // Reload checklists (will show static message for now)
            // } catch (error) {
            //     displayStatusMessage(checklistStatusMessage, `Error creating task list: ${error.message}`, true);
            //     console.error('Error creating task list:', error);
            // }
        });
    }

    // --- Initial page setup ---
    loadChecklists(); // Load existing lists on page load
    if(tasksInputArea) {
        // Ensure at least one task input is present on load
        if (tasksInputArea.children.length === 0) {
            addSingleTaskInput(tasksInputArea);
        }
        // Attach listeners to existing (if any) and future remove/attach buttons
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
    }
}
