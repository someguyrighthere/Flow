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
    const checklistStatusMessage = document.getElementById('checklist-status-message'); // NEW: Reference to status message element
    
    // State variables
    let taskCounter = 0;

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
        // Reverted to static message if API is not fully enabled for checklists
        checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">Task list functionality temporarily disabled.</p>';
        displayStatusMessage(checklistStatusMessage, 'Task list functionality temporarily disabled. Please contact support.', true);
        // Original API call (commented out as backend routes might be missing or under development)
        // try {
        //     const checklists = await apiRequest('GET', '/checklists');
        //     checklistListDiv.innerHTML = ''; // Clear static message
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
            <div class="attached-document-info" style="font-size: 0.8rem; color: var(--text-medium); margin-top: 5px; height: 1.2em;"></div>
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
    }

    // --- Event Listeners ---
    
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
            
            // Reverted: This form submission is now a placeholder as backend route is removed
            // NEW: Use the local displayStatusMessage instead of showModalMessage
            displayStatusMessage(checklistStatusMessage, "Task List creation functionality temporarily disabled. Please contact support.", true);
            
            newChecklistForm.reset();
            timeGroupCountContainer.style.display = 'none';
            // Clear all but the first task input
            tasksInputArea.innerHTML = '';
            taskCounter = 0; // Reset task counter
            addSingleTaskInput(tasksInputArea);
            loadChecklists(); // Still call loadChecklists to update the static message.

            // Original API call (now removed/commented out as backend routes might be missing or under development)
            /*
            const position = document.getElementById("new-checklist-position").value.trim();
            const title = document.getElementById("new-checklist-title").value.trim();
            const structure_type = structureTypeSelect.value;
            const time_group_count = timeGroupCountInput.value;
            const tasks = [];
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
            if (!position || !title || tasks.length === 0) {
                displayStatusMessage(checklistStatusMessage, "Please provide a position, title, and at least one task.", true);
                return;
            }
            const payload = {
                position,
                title,
                tasks,
                structure_type,
                time_group_count: (structure_type === 'daily' || structure_type === 'weekly') ? parseInt(time_group_count, 10) : null
            };
            try {
                await apiRequest("POST", "/checklists", payload);
                displayStatusMessage(checklistStatusMessage, `Task List created successfully!`, false);
                newChecklistForm.reset();
                timeGroupCountContainer.style.display = 'none';
                tasksInputArea.innerHTML = '';
                taskCounter = 0;
                addSingleTaskInput(tasksInputArea);
                loadChecklists();
            } catch (error) {
                displayStatusMessage(checklistStatusMessage, error.message, true);
            }
            */
        });
    }

    // --- Initial page setup ---
    loadChecklists(); // Load existing lists on page load
    if(tasksInputArea) {
        addSingleTaskInput(tasksInputArea);
    }
}
