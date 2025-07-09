// js/pages/documents.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the documents page.
 */
export function handleDocumentsPage() { // Ensure this is exported
    // Security check: Redirect to login page if no authentication token is found in local storage
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
        documentListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading documents...</p>'; // Show loading state

        try {
            // FIX: Add a timestamp to bypass browser cache for /api/documents
            const documents = await apiRequest('GET', `/api/documents?_t=${Date.now()}`); 
            documentListDiv.innerHTML = ''; // Clear loading message

            if (documents && documents.length > 0) {
                documents.forEach(doc => {
                    const docItem = document.createElement('div');
                    docItem.className = 'document-item';
                    docItem.innerHTML = `
                        <h4>${doc.title}</h4>
                        <p><strong>File:</strong> ${doc.file_name.split('/').pop()}</p> <!-- Display only filename from URL -->
                        <p><strong>Description:</strong> ${doc.description || 'N/A'}</p>
                        <p style="font-size: 0.8em; color: var(--text-medium);">Uploaded by: ${doc.uploaded_by_name || 'Unknown'}</p>
                        <p style="font-size: 0.8em; color: var(--text-medium);">Uploaded: ${new Date(doc.uploaded_at).toLocaleDateString()}</p>
                        <div class="actions">
                            <a href="${doc.file_name}" target="_blank" class="btn btn-secondary btn-sm" title="Download Document">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                                </svg>
                            </a>
                            <button class="btn-delete" data-doc-id="${doc.document_id}" title="Delete Document">
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
            console.error('Error loading documents:', error);
        }
    }

    /**
     * Handles the deletion of a document.
     * @param {string} documentId - The ID of the document to delete.
     */
    async function deleteDocument(documentId) {
        const confirmed = await showConfirmModal('Are you sure you want to delete this document? This cannot be undone and will permanently remove the file.', 'Delete');
        if (confirmed) {
            try {
                await apiRequest('DELETE', `/api/documents/${documentId}`); // Call backend delete endpoint
                showModalMessage('Document deleted successfully!', false);
                loadDocuments(); // Refresh the document list
            } catch (error) {
                showModalMessage(`Error deleting document: ${error.message}`, true);
                console.error('Error deleting document:', error);
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
            formData.append('document', file); // 'document' must match the field name in multer upload.single()

            // Show and reset the progress bar
            if (progressContainer) progressContainer.style.display = 'block';
            if (progressText) progressText.style.display = 'block';
            if (progressFill) progressFill.style.width = '0%';
            if (progressText) progressText.textContent = '0%';

            try {
                // Use apiRequest with isFormData=true and onProgress callback
                await apiRequest('POST', '/api/documents', formData, true, (event) => {
                    // This is the onProgress callback for apiRequest
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        if (progressFill) progressFill.style.width = `${percentComplete}%`;
                        if (progressText) progressText.textContent = `${percentComplete}%`;
                    }
                });
                showModalMessage('Document uploaded successfully!', false);
                uploadForm.reset(); // Clear the form fields
                loadDocuments(); // Refresh the list to show the newly uploaded document
            } catch (error) {
                showModalMessage(`Upload failed: ${error.message}`, true);
                console.error('Error uploading document:', error);
            } finally {
                // Hide the progress bar after completion or failure
                if (progressContainer) progressContainer.style.display = 'none';
                if (progressText) progressText.style.display = 'none';
            }
        });
    }

    // --- Initial Page Load ---
    loadDocuments(); // Load documents when the page loads
}
