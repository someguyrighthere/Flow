// js/pages/checklists.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

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
    // Reverted: Removed references to edit/attach document modals as they are removed from HTML and backend
    // const attachDocumentModalOverlay = document.getElementById("attach-document-modal-overlay");
    // const attachDocumentListDiv = document.getElementById("attach-document-list");
    // const attachDocumentCancelBtn = document.getElementById("attach-document-cancel-btn");
    
    // Elements for task structure
    const structureTypeSelect = document.getElementById('structure-type-select');
    const timeGroupCountContainer = document.getElementById('time-group-count-container');
    const timeGroupCountLabel = document.getElementById('time-group-count-label');
    const timeGroupCountInput = document.getElementById('time-group-count');

    // *** Reverted: Element for displaying the list of existing checklists is now static text ***
    const checklistListDiv = document.getElementById('checklist-list');
    
    // State variables (Reverted: removed currentTaskElementForAttachment)
    let taskCounter = 0;

    // --- Data Loading and Rendering (Reverted: simplified as backend routes are removed) ---

    /**
     * *** Reverted: Fetches and displays existing task lists is now static message ***
     */
    async function loadChecklists() {
        if (!checklistListDiv) return;
        checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">Task list functionality temporarily disabled.</p>';
        // Removed API call for /checklists as it's no longer in server.js
    }


    /**
     * Adds a new task input field to the form.
     * @param {HTMLElement} container - The container to append the new task input to.
     * @param {object} [task={}] - An existing task object to pre-fill the input.
     */
    function addSingleTaskInput(container, task = {}) {
        const div = document.createElement('div');
        div.className = 'form-group task-input-group';
        // Reverted: Removed data-document-id and data-document-name as document attachment is disabled
        // div.dataset.documentId = task.documentId || '';
        // div.dataset.documentName = task.documentName || '';
        
        const uniqueInputId = `task-input-${taskCounter++}`;
        div.innerHTML = `
            <div class="task-input-container">
                <div class="form-group" style="flex-grow: 1; margin-bottom: 0;">
                    <label for="${uniqueInputId}">Task Description</label>
                    <input type="text" id="${uniqueInputId}" class="task-description-input" value="${task.description || ''}" placeholder="e.g., Complete HR paperwork" required>
                </div>
                <div class="task-actions" style="display: flex; align-items: flex-end; gap: 5px; margin-bottom: 0;">
                    <button type="button" class="btn btn-secondary btn-sm attach-file-btn" style="display:none;">Attach</button> <!-- Temporarily hide attach button -->
                    <button type="button" class="btn btn-secondary btn-sm remove-task-btn">Remove</button>
                </div>
            </div>
            <div class="attached-document-info" style="font-size: 0.8rem; color: var(--text-medium); margin-top: 5px; height: 1.2em;">
                ${task.documentName ? `<span class="attachment-chip">${task.documentName}</span>` : ''}
            </div>
        `;
        container.appendChild(div);

        // Add event listeners to the new buttons
        div.querySelector('.remove-task-btn').addEventListener('click', () => div.remove());
        // Reverted: Removed attach file button listener as functionality is disabled
        // div.querySelector('.attach-file-btn').addEventListener('click', (e) => {
        //     currentTaskElementForAttachment = e.target.closest('.task-input-group');
        //     openDocumentSelectorModal();
        // });
    }

    /**
     * Reverted: openDocumentSelectorModal is removed as document attachment is disabled
     */
    // async function openDocumentSelectorModal() { /* ... content removed ... */ }

    // --- Event Listeners ---
    
    // Reverted: Removed attach document modal listeners
    // if (attachDocumentCancelBtn) { /* ... content removed ... */ }
    // if (attachDocumentModalOverlay) { /* ... content removed ... */ }
    
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

    // *** Reverted: Event listener for deleting a checklist removed ***
    // if (checklistListDiv) { /* ... content removed ... */ }

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
            
            // Reverted: This form submission is now a placeholder as backend route is removed
            showModalMessage("Task List creation functionality temporarily disabled. Please contact support.", true);
            newChecklistForm.reset();
            timeGroupCountContainer.style.display = 'none';
            document.getElementById('tasks-input-area').innerHTML = '';
            addSingleTaskInput(tasksInputArea);
            loadChecklists(); // Still call loadChecklists to update the static message.

            // Original API call (now removed)
            // const position = document.getElementById("new-checklist-position").value.trim();
            // const title = document.getElementById("new-checklist-title").value.trim();
            // const structure_type = structureTypeSelect.value;
            // const time_group_count = timeGroupCountInput.value;
            // const tasks = [];
            // document.querySelectorAll('#tasks-input-area .task-input-group').forEach(groupEl => {
            //     const descriptionInput = groupEl.querySelector('.task-description-input');
            //     if (descriptionInput && descriptionInput.value.trim()) {
            //         tasks.push({
            //             description: descriptionInput.value.trim(),
            //             completed: false,
            //             documentId: groupEl.dataset.documentId || null,
            //             documentName: groupEl.dataset.documentName || null
            //         });
            //     }
            // });
            // if (!position || !title || tasks.length === 0) {
            //     showModalMessage("Please provide a position, title, and at least one task.", true);
            //     return;
            // }
            // const payload = {
            //     position,
            //     title,
            //     tasks,
            //     structure_type,
            //     time_group_count: (structure_type === 'daily' || structure_type === 'weekly') ? parseInt(time_group_count, 10) : null
            // };
            // try {
            //     await apiRequest("POST", "/checklists", payload);
            //     showModalMessage(`Task List created successfully!`, false);
            //     newChecklistForm.reset();
            //     timeGroupCountContainer.style.display = 'none';
            //     document.getElementById('tasks-input-area').innerHTML = '';
            //     addSingleTaskInput(tasksInputArea);
            //     loadChecklists();
            // } catch (error) {
            //     showModalMessage(error.message, true);
            // }
        });
    }

    // --- Initial page setup ---
    loadChecklists(); // *** NEW: Load existing lists on page load ***
    if(tasksInputArea) {
        addSingleTaskInput(tasksInputArea);
    }
}
