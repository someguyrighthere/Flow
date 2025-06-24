// js/utils.js

// This should be the full URL of your deployed backend.
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

/**
 * Displays a custom modal message to the user.
 * @param {string} message The message to display.
 * @param {boolean} [isError=false] Whether the message is an error.
 */
export function showModalMessage(message, isError = false) {
    const modalOverlay = document.getElementById("message-modal-overlay");
    const modalMessage = document.getElementById("modal-message-text");
    const modalCloseButton = document.getElementById("modal-close-button");
    if (modalOverlay && modalMessage && modalCloseButton) {
        modalMessage.textContent = message;
        modalMessage.style.color = isError ? "#ff8a80" : "var(--text-light)";
        modalOverlay.style.display = "flex";
        modalCloseButton.onclick = () => { modalOverlay.style.display = "none"; };
        modalOverlay.onclick = event => { if (event.target === modalOverlay) modalOverlay.style.display = "none"; };
    } else {
        console.error("Modal elements not found for showModalMessage:", message);
        isError ? console.error(`ERROR: ${message}`) : console.log(`MESSAGE: ${message}`);
    }
}

/**
 * Displays a confirmation modal to the user.
 * @param {string} message The confirmation message.
 * @param {string} [confirmButtonText="Confirm"] The text for the confirm button.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false otherwise.
 */
export function showConfirmModal(message, confirmButtonText = "Confirm") {
    return new Promise(resolve => {
        const confirmModalOverlay = document.getElementById("confirm-modal-overlay");
        const confirmModalMessage = document.getElementById("confirm-modal-message");
        const modalConfirmButton = document.getElementById("modal-confirm");
        const modalCancelButton = document.getElementById("modal-cancel");

        if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
            console.error("Confirmation modal elements not found.");
            // Fallback to the browser's confirm dialog if the custom modal isn't found
            resolve(window.confirm(message));
            return;
        }

        confirmModalMessage.innerHTML = message;
        modalConfirmButton.textContent = confirmButtonText;
        confirmModalOverlay.style.display = "flex";

        const handleResponse = (value) => {
            confirmModalOverlay.style.display = "none";
            // Important: Clone and replace nodes to remove all old event listeners
            const newConfirm = modalConfirmButton.cloneNode(true);
            const newCancel = modalCancelButton.cloneNode(true);
            modalConfirmButton.parentNode.replaceChild(newConfirm, modalConfirmButton);
            modalCancelButton.parentNode.replaceChild(newCancel, modalCancelButton);
            resolve(value);
        };
        
        const onConfirm = () => handleResponse(true);
        const onCancel = () => handleResponse(false);

        modalConfirmButton.addEventListener("click", onConfirm, { once: true });
        modalCancelButton.addEventListener("click", onCancel, { once: true });
        confirmModalOverlay.onclick = event => { 
            if (event.target === confirmModalOverlay) onCancel(); 
        };
    });
}

/**
 * Handles API requests to the backend.
 * @param {string} method The HTTP method (e.g., "GET", "POST").
 * @param {string} path The API endpoint path (e.g., "/login").
 * @param {object} [body=null] The request body for POST/PUT requests.
 * @param {boolean} [isFormData=false] Whether the body is FormData.
 * @param {function} [onProgress=null] A progress event handler for uploads.
 * @param {boolean} [expectBlobResponse=false] Whether to expect a Blob in response.
 * @returns {Promise<any>} The JSON response from the API.
 */
export async function apiRequest(method, path, body = null, isFormData = false, onProgress = null, expectBlobResponse = false) {
    const token = localStorage.getItem('authToken');
    const endpoint = `${API_BASE_URL}${path}`;

    const handleAuthError = (errorMessage) => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        showModalMessage(errorMessage, true);
        setTimeout(() => { window.location.href = 'login.html?sessionExpired=true'; }, 1500); 
    };

    if (isFormData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            if (onProgress && xhr.upload) xhr.upload.addEventListener('progress', onProgress);
            
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText || '{}')); } catch (e) { resolve({}); }
                } else if (xhr.status === 401 || xhr.status === 403) {
                    handleAuthError('Your session has expired. Please log in again.');
                    reject(new Error('Authentication failed.'));
                } else {
                    try { 
                        reject(new Error(JSON.parse(xhr.responseText).error || 'An unknown error occurred.')); 
                    } catch (e) { 
                        reject(new Error(`HTTP error ${xhr.status} - ${xhr.statusText}`)); 
                    }
                }
            };
            xhr.onerror = () => reject(new Error('Network error. Check connection or CORS policy.'));
            xhr.send(body);
        });
    }

    const options = { method, headers: {} };
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (body && !isFormData) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(endpoint, options);
        
        if (response.status === 401 || response.status === 403) {
            handleAuthError('Your session has expired. Please log in again.');
            throw new Error('Authentication failed.');
        }

        if (!response.ok) {
            let errorMsg = `HTTP error! Status: ${response.status}`;
            try {
                // Try to parse the error message from the response body
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                // If parsing fails, use the status text
                errorMsg = response.statusText;
            }
            throw new Error(errorMsg);
        }

        if (expectBlobResponse) {
            return response.blob();
        }

        // Handle cases where the response might be empty (e.g., 204 No Content)
        const contentLength = response.headers.get("content-length");
        if (response.status === 204 || contentLength === "0") {
            return null;
        }

        // Otherwise, parse the JSON body
        return response.json();

    } catch (error) {
        // This catches network errors (e.g., DNS, CORS) and thrown errors from above
        console.error('API Request Failed:', error);
        showModalMessage(error.message, true);
        throw error; // Re-throw the error so the calling function can handle it
    }
}
