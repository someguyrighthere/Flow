import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the checklists page.
 */
export function handleChecklistsPage() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    const newChecklistForm = document.getElementById("new-checklist-form");
    const tasksInputArea = document.getElementById("tasks-input-area");
    const checklistListDiv = document.getElementById('checklist-list');
    const checklistStatusMessage = document.getElementById('checklist-status-message');
    const addTaskBtn = document.getElementById('add-task-btn');
    
    let taskCounter = 0;

    /**
     * Adds a new task input field to the form.
     */
    function addSingleTaskInput() {
        if (!tasksInputArea) return;

        const taskGroup = document.createElement('div');
        taskGroup.className = 'form-group task-input-group';
        const uniqueInputId = `task-input-${taskCounter++}`;
        
        taskGroup.innerHTML = `
            <div class="task-input-container">
                <div class="form-group" style="flex-grow: 1; margin-bottom: 0;">
                    <label for="${uniqueInputId}">Task Description</label>
                    <input type="text" id="${uniqueInputId}" class="task-description-input" placeholder="e.g., Complete HR paperwork" required>
                </div>
                <div class="task-actions">
                    <button type="button" class="btn btn-secondary btn-sm remove-task-btn">Remove</button>
                </div>
            </div>
        `;
        
        tasksInputArea.appendChild(taskGroup);

        taskGroup.querySelector('.remove-task-btn').addEventListener('click', () => {
            if (tasksInputArea.children.length > 1) {
                taskGroup.remove();
            } else {
                showModalMessage("A task list must have at least one task.", true);
            }
        });
    }

    /**
     * Fetches and displays existing task lists.
     */
    async function loadChecklists() {
        if (!checklistListDiv) return;
        checklistListDiv.innerHTML = '<p>Loading task lists...</p>';
        try {
            const checklists = await apiRequest('GET', '/api/checklists');
            checklistListDiv.innerHTML = '';
            if (checklists && checklists.length > 0) {
                checklists.forEach(checklist => {
                    const item = document.createElement('div');
                    item.className = 'list-item'; // Use a generic class for styling
                    item.innerHTML = `
                        <span><strong>${checklist.title}</strong> (For: ${checklist.position})</span>
                        <button class="btn-delete" data-id="${checklist.id}">Delete</button>
                    `;
                    item.querySelector('.btn-delete').addEventListener('click', async () => {
                        const confirmed = await showConfirmModal('Are you sure you want to delete this task list?');
                        if (confirmed) {
                            await apiRequest('DELETE', `/api/checklists/${checklist.id}`);
                            loadChecklists();
                        }
                    });
                    checklistListDiv.appendChild(item);
                });
            } else {
                checklistListDiv.innerHTML = '<p>No task lists found. Create one above!</p>';
            }
        } catch (error) {
            checklistListDiv.innerHTML = `<p style="color:red;">Error loading task lists.</p>`;
        }
    }
    
    // --- Event Listeners ---
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', addSingleTaskInput);
    }

    if (newChecklistForm) {
        newChecklistForm.addEventListener("submit", async e => {
            e.preventDefault();
            const tasks = [];
            document.querySelectorAll('#tasks-input-area .task-description-input').forEach(input => {
                if (input.value.trim()) {
                    tasks.push({ description: input.value.trim(), completed: false });
                }
            });

            if (tasks.length === 0) {
                showModalMessage("Please add at least one task.", true);
                return;
            }

            const payload = {
                title: document.getElementById("new-checklist-title").value.trim(),
                position: document.getElementById("new-checklist-position").value.trim(),
                tasks: tasks
            };
            
            try {
                await apiRequest("POST", "/api/checklists", payload);
                showModalMessage('Task List created successfully!', false);
                newChecklistForm.reset();
                tasksInputArea.innerHTML = '';
                addSingleTaskInput();
                loadChecklists();
            } catch (error) {
                showModalMessage(`Error: ${error.message}`, true);
            }
        });
    }

    // --- Initial Page Load ---
    loadChecklists();
    // Add the first task input field when the page loads
    if (tasksInputArea && tasksInputArea.children.length === 0) {
        addSingleTaskInput();
    }
}