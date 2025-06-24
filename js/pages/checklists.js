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

    // Get all necessary elements from the DOM
    const newChecklistForm = document.getElementById("new-checklist-form");
    const tasksInputArea = document.getElementById("tasks-input-area");
    const attachDocumentModalOverlay = document.getElementById("attach-document-modal-overlay");
    const attachDocumentListDiv = document.getElementById("attach-document-list");
    const attachDocumentCancelBtn = document.getElementById("attach-document-cancel-btn");
    
    // State variables
    let currentTaskElementForAttachment = null;
    let taskCounter = 0;

    /**
     * Adds a new task input field to the form.
     * @param {HTMLElement} container - The container to append the new task input to.
     * @param {object} [task={}] - An existing task object to pre-fill the input.
     */
    function addSingleTaskInput(container, task = {}) {
        const div = document.createElement('div');
        div.className = 'form-group task-input-group';
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
                    <button type="button" class="btn btn-secondary btn-sm attach-file-btn">Attach</button>
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
        div.querySelector('.attach-file-btn').addEventListener('click', (e) => {
            currentTaskElementForAttachment = e.target.closest('.task-input-group');
            openDocumentSelectorModal();
        });
    }

    /**
     * Opens the modal to select a document to attach to a task.
     */
    async function openDocumentSelectorModal() {
        if (!attachDocumentModalOverlay || !attachDocumentListDiv) return;
        
        attachDocumentListDiv.innerHTML = '<p>Loading documents...</p>';
        attachDocumentModalOverlay.style.display = 'flex';
        
        try {
            const documents = await apiRequest('GET', '/documents');
            attachDocumentListDiv.innerHTML = '';
            
            if (documents.length === 0) {
                attachDocumentListDiv.insertAdjacentHTML('beforeend', '<p>No documents found. Upload documents in the "Documents" app first.</p>');
                return;
            }
            
            documents.forEach(doc => {
                const docButton = document.createElement('button');
                docButton.className = 'list-item'; // Re-using list-item style for buttons
                docButton.style.cssText = 'width: 100%; cursor: pointer; text-align: left;';
                docButton.textContent = `${doc.title} (${doc.file_name})`;
                docButton.dataset.documentId = doc.document_id;
                docButton.dataset.documentName = doc.file_name;
                
                docButton.onclick = () => {
                    if (currentTaskElementForAttachment) {
                        currentTaskElementForAttachment.dataset.documentId = docButton.dataset.documentId;
                        currentTaskElementForAttachment.dataset.documentName = docButton.dataset.documentName;
                        const infoDiv = currentTaskElementForAttachment.querySelector('.attached-document-info');
                        if (infoDiv) infoDiv.innerHTML = `<span class="attachment-chip">${docButton.dataset.documentName}</span>`;
                    }
                    attachDocumentModalOverlay.style.display = 'none';
                };
                attachDocumentListDiv.appendChild(docButton);
            });
        } catch (error) {
            attachDocumentListDiv.innerHTML = `<p style="color: #e74c3c;">Error: ${error.message}</p>`;
        }
    }
    
    // Event listeners for the document attachment modal
    if (attachDocumentCancelBtn) {
        attachDocumentCancelBtn.addEventListener('click', () => attachDocumentModalOverlay.style.display = 'none');
    }
    if (attachDocumentModalOverlay) {
        attachDocumentModalOverlay.addEventListener('click', (e) => {
            if (e.target === attachDocumentModalOverlay) {
                attachDocumentModalOverlay.style.display = 'none';
            }
        });
    }

    // Event listener for the new checklist form submission
    if (newChecklistForm) {
        newChecklistForm.addEventListener("submit", async e => {
            e.preventDefault();
            const position = document.getElementById("new-checklist-position").value.trim();
            const title = document.getElementById("new-checklist-title").value.trim();
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
                showModalMessage("Please provide a position, title, and at least one task.", true);
                return;
            }
            try {
                await apiRequest("POST", "/checklists", { position, title, tasks });
                showModalMessage(`Task List created successfully!`, false);
                newChecklistForm.reset();
                document.getElementById('tasks-input-area').innerHTML = '';
                addSingleTaskInput(tasksInputArea); // Add a fresh input field
            } catch (error) {
                showModalMessage(error.message, true);
            }
        });
    }

    // Initial page setup
    if(tasksInputArea) {
        addSingleTaskInput(tasksInputArea); // Add one initial task input when the page loads
    }
}
