// js/pages/onboardingView.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

// ... (rest of the file) ...

function renderOnboardingTasks(tasks) {
    if (!onboardingTaskListDiv) return;
    onboardingTaskListDiv.innerHTML = '';

    if (tasks && tasks.length > 0) {
        onboardingInfoContainer.style.display = 'block';
        tasks.forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.className = `checklist-item ${task.completed ? 'completed' : ''}`;
            taskItem.dataset.taskId = task.id;

            taskItem.innerHTML = `
                <div class="checklist-item-title">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                    <span>${task.description}</span>
                    ${task.document_name ? `<br><small>Attached: <a href="${task.document_name}" target="_blank">${task.document_name.split('/').pop()}</a></small>` : ''}
                </div>
            `;
            onboardingTaskListDiv.appendChild(taskItem);
        });
    } else {
        if (onboardingInfoContainer) onboardingInfoContainer.style.display = 'none';
    }
}
// ... (rest of onboardingView.js remains the same) ...