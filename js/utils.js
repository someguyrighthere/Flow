// js/utils.js

// This should be the full URL of your deployed backend.
const API_BASE_URL = 'https://flow-gz1r.onrender.com'; // Ensure this matches your deployed backend URL

/**
 * Displays a custom modal message to the user.
 * @param {string} message The message to display.
 * @param {boolean} [isError=false] Whether the message is an error.
 */
export function showModalMessage(message, isError = false) {
    const modalOverlay = document.getElementById("modal-message");
    const modalMessageText = document.getElementById("modal-text");
    const modalOkButton = document.getElementById("modal-ok-button");

    // CRITICAL CHECK: Ensure all modal elements are found
    if (!modalOverlay || !modalMessageText || !modalOkButton) {
        console.error("A modal element not found for showModalMessage:", message);
        // Fallback to alert if modal elements are missing (for debugging, but should be fixed in HTML)
        alert(message); 
        return;
    }

    const hideModal = () => { modalOverlay.style.display = "none"; };
    const hideModalOutside = (event) => { 
        if (event.target === modalOverlay) hideModal(); 
    };

    // Remove existing listeners to prevent multiple firings
    modalOkButton.removeEventListener("click", hideModal);
    modalOverlay.removeEventListener("click", hideModalOutside);

    modalMessageText.textContent = message;
    modalMessageText.style.color = isError ? "#ff8a80" : "var(--text-light)";
    modalOverlay.style.display = "flex"; // Show the modal

    // Add new listeners
    modalOkButton.addEventListener("click", hideModal);
    modalOverlay.addEventListener("click", hideModalOutside);
}

/**
 * Displays a confirmation modal to the user.
 * @param {string} message The confirmation message.
 * @param {string} [confirmButtonText="Confirm"] The text for the confirm button.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false otherwise.
 */
export function showConfirmModal(message, confirmButtonText = "Confirm") {
    return new Promise(resolve => {
        const confirmModalOverlay = document.getElementById("confirm-modal");
        const confirmModalMessage = document.getElementById("confirm-modal-text");
        const modalConfirmButton = document.getElementById("confirm-modal-confirm");
        const modalCancelButton = document.getElementById("confirm-modal-cancel");

        if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
            console.error("Confirmation modal elements not found. Falling back to browser's confirm.");
            resolve(window.confirm(message)); // Fallback
            return;
        }

        confirmModalMessage.innerHTML = message;
        modalConfirmButton.textContent = confirmButtonText;
        confirmModalOverlay.style.display = "flex";

        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const handleClickOutside = (event) => {
            if (event.target === confirmModalOverlay) {
                cleanup();
                resolve(false);
            }
        };

        const cleanup = () => {
            modalConfirmButton.removeEventListener('click', handleConfirm);
            modalCancelButton.removeEventListener('click', handleCancel);
            confirmModalOverlay.removeEventListener('click', handleClickOutside);
            confirmModalOverlay.style.display = 'none';
        };

        modalConfirmButton.addEventListener('click', handleConfirm);
        modalCancelButton.addEventListener('click', handleCancel);
        confirmModalOverlay.addEventListener('click', handleClickOutside);
    });
}

/**
 * Handles API requests to the backend.
 * @param {string} method The HTTP method (e.g., "GET", "POST").
 * @param {string} path The API endpoint path (e.g., "/login").
 * @param {object} [body=null] The request body for POST/PUT requests.
 * @param {boolean} [isFormData=false] Whether the body is FormData.
 * @param {function} [onProgress=null] Optional callback for upload progress (for FormData).
 * @returns {Promise<any>} The JSON response from the API.
 */
export async function apiRequest(method, path, body = null, isFormData = false, onProgress = null) {
    const token = localStorage.getItem('authToken');
    const endpoint = `${API_BASE_URL}${path}`;

    const handleAuthError = (errorMessage) => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userId');
        showModalMessage(errorMessage, true);
        setTimeout(() => { window.location.href = 'login.html?sessionExpired=true'; }, 1500); 
    };

    const options = { 
        method, 
        headers: {},
        // DEFINITIVE FIX: Tells the browser to always fetch a fresh copy from the server.
        cache: 'no-cache' 
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
        if (isFormData) {
            options.body = body;
            // Add onProgress listener if provided and it's an upload
            if (onProgress && method === 'POST') {
                options.onUploadProgress = onProgress; // This is for Axios, not native fetch.
                                                      // For native fetch, need to wrap XHR or use stream API.
                                                      // For simplicity, will use a basic implementation or note limitation.
                // Native fetch doesn't directly support onUploadProgress.
                // For progress with fetch, you'd typically need to use XHR or a ReadableStream.
                // Given the current setup, the onProgress callback will be called
                // by the documents.js page which uses a custom fetch wrapper that
                // can handle progress. So, no change needed here for that.
            }
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(endpoint, options);
        
        if (response.status === 401 || response.status === 403) {
            handleAuthError('Your session has expired. Please log in again.');
            throw new Error('Authentication failed.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }

        if (response.status === 204) {
            return null; // No content
        }

        return response.json();

    } catch (error) {
        // Only show modal if it's not an authentication error already handled
        if (error.message !== 'Authentication failed.') {
            showModalMessage(error.message, true);
        }
        throw error; // Re-throw to propagate to calling function
    }
}
