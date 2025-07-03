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

    let taskCounter = 0;

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
                <button type="button" class="btn btn-secondary remove-task-btn">Remove</button>
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
    };
    
    const loadChecklists = async () => {
        if (!checklistListDiv) return;
        checklistListDiv.innerHTML = `<p>Loading...</p>`;
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
                checklistListDiv.innerHTML = `<p>No task lists created yet.</p>`;
            }
        } catch (e) {
            checklistListDiv.innerHTML = `<p style="color:red;">Could not load task lists.</p>`;
        }
    };

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', addNewTaskField);
    }

    if (newChecklistForm) {
        newChecklistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tasks = [];
            document.querySelectorAll('.task-description-input').forEach(input => {
                if (input.value.trim()) {
                    tasks.push({ description: input.value.trim() });
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
                tasksInputArea.innerHTML = '';
                addNewTaskField();
                loadChecklists();
            } catch (error) {
                showModalMessage(`Error: ${error.message}`, true);
            }
        });
    }

    // Initial page load
    if (tasksInputArea && tasksInputArea.childElementCount === 0) {
        addNewTaskField();
    }
    loadChecklists();
}