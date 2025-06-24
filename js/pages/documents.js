// js/pages/documents.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the documents page.
 */
export function handleDocumentsPage() {
    // Security check
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // Get elements from the DOM
    const uploadForm = document.getElementById('upload-document-form');
    const documentListDiv = document.getElementById('document-list');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressFill = document.getElementById('upload-progress-fill');
    const progressText = document.getElementById('upload-progress-text');

    /**
     * Fetches all documents from the API and renders them in the list.
     */
    async function loadDocuments() {
        if (!documentListDiv) return;
        documentListDiv.innerHTML = '<p>Loading documents...</p>';

        try {
            const documents = await apiRequest('GET', '/documents');
            documentListDiv.innerHTML = ''; // Clear loading message

            if (documents && documents.length > 0) {
                documents.forEach(doc => {
                    const docItem = document.createElement('div');
                    docItem.className = 'document-item';
                    docItem.innerHTML = `
                        <h4>${doc.title}</h4>
                        <p><strong>File:</strong> ${doc.file_name}</p>
                        <p><strong>Description:</strong> ${doc.description || 'N/A'}</p>
                        <p style="font-size: 0.8em; color: var(--text-medium);">Uploaded: ${new Date(doc.uploaded_at).toLocaleDateString()}</p>
                        <div class="actions">
                            <button class="btn-delete" data-doc-id="${doc.document_id}">
                               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 1 0 0 1-2 2H5a2 1 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    documentListDiv.appendChild(docItem);
                });
            } else {
                documentListDiv.innerHTML = '<p style="color: var(--text-medium);">No documents uploaded yet.</p>';
            }
        } catch (error) {
            documentListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading documents: ${error.message}</p>`;
        }
    }

    /**
     * Handles the deletion of a document.
     * @param {string} documentId - The ID of the document to delete.
     */
    async function deleteDocument(documentId) {
        const confirmed = await showConfirmModal('Are you sure you want to delete this document? This cannot be undone.', 'Delete');
        if (confirmed) {
            try {
                await apiRequest('DELETE', `/documents/${documentId}`);
                showModalMessage('Document deleted successfully!', false);
                loadDocuments(); // Refresh the document list
            } catch (error) {
                showModalMessage(`Error deleting document: ${error.message}`, true);
            }
        }
    }

    // Event listener for the document list (uses event delegation for delete buttons)
    if (documentListDiv) {
        documentListDiv.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('.btn-delete');
            if (deleteButton) {
                const documentId = deleteButton.dataset.docId;
                deleteDocument(documentId);
            }
        });
    }

    // Event listener for the upload form submission
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('document-title').value;
            const description = document.getElementById('document-description').value;
            const fileInput = document.getElementById('document-file');
            const file = fileInput.files[0];

            if (!file || !title) {
                showModalMessage('Please provide a title and select a file.', true);
                return;
            }

            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('document', file);

            // Show and reset the progress bar
            if (progressContainer) progressContainer.style.display = 'block';
            if (progressText) progressText.style.display = 'block';
            if (progressFill) progressFill.style.width = '0%';
            if (progressText) progressText.textContent = '0%';

            try {
                await apiRequest('POST', '/documents', formData, true, (event) => {
                    // This is the onProgress callback for apiRequest
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        if (progressFill) progressFill.style.width = `${percentComplete}%`;
                        if (progressText) progressText.textContent = `${percentComplete}%`;
                    }
                });
                showModalMessage('Document uploaded successfully!', false);
                uploadForm.reset();
                loadDocuments(); // Refresh the list
            } catch (error) {
                showModalMessage(`Upload failed: ${error.message}`, true);
            } finally {
                // Hide the progress bar after completion or failure
                if (progressContainer) progressContainer.style.display = 'none';
                if (progressText) progressText.style.display = 'none';
            }
        });
    }

    // Initial call to load documents when the page loads
    loadDocuments();
}
