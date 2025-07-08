import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleChecklistsPage() {
// ... (rest of the file) ...

/**
 * Attaches a selected document to the current task being edited.
 * @param {string} documentId - The ID of the document.
 * @param {string} documentName - The name of the document file (which will be the GCS URL).
 */
const attachDocumentToTask = (documentId, documentName) => {
    if (currentTaskElement) {
        // Store document info directly on the taskGroup element for later retrieval on form submit
        currentTaskElement.dataset.attachedDocumentId = documentId;
        currentTaskElement.dataset.attachedDocumentName = documentName; // This will now be the GCS URL

        // Update the display for the user, showing only the filename
        const infoDiv = currentTaskElement.querySelector('.attached-document-info');
        if (infoDiv) {
            infoDiv.innerHTML = `Attached: <a href="${documentName}" target="_blank" style="color: var(--primary-accent);">${documentName.split('/').pop()}</a>`;
        }
    }
};
// ... (rest of checklists.js remains the same) ...