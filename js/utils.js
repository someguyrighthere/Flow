// js/utils.js

// This should be the full URL of your deployed backend.
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

/**
 * Displays a custom modal message to the user.
 * @param {string} message The message to display.
 * @param {boolean} [isError=false] Whether the message is an error.
 */
export function showModalMessage(message, isError = false) {
    const modalOverlay = document.getElementById("modal-message");
    const modalMessageText = document.getElementById("modal-text");
    const modalOkButton = document.getElementById("modal-ok-button");

    if (modalOverlay && modalMessageText && modalOkButton) {
        modalMessageText.textContent = message;
        modalMessageText.style.color = isError ? "#ff8a80" : "var(--text-light)";
        
        // Define hide function
        const hideModal = () => { modalOverlay.style.display = "none"; };
        // Define click outside function
        const hideModalOutside = (event) => { 
            if (event.target === modalOverlay) hideModal(); 
        };

        // Ensure listeners are removed before re-adding to prevent duplicates
        modalOkButton.removeEventListener("click", hideModal);
        modalOverlay.removeEventListener("click", hideModalOutside);

        modalOverlay.style.display = "flex"; // Show the modal

        // Add event listeners
        modalOkButton.addEventListener("click", hideModal);
        modalOverlay.addEventListener("click", hideModalOutside);

    } else {
        console.error("Modal elements not found for showModalMessage:", message);
        // Fallback to browser alert if modal elements are missing
        if (isError) {
            console.error(`ERROR: ${message}`);
            // alert(`ERROR: ${message}`); // Removed alert as per instruction, relying on console.error
        } else {
            console.log(`MESSAGE: ${message}`);
            // alert(`MESSAGE: ${message}`); // Removed alert as per instruction, relying on console.log
        }
    }
}

/**
 * Displays a confirmation modal to the user.
 * @param {string} message The confirmation message.
 * @param {string} [confirmButtonText="Confirm"] The text for the confirm button.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false otherwise.
 */
export function showConfirmModal(message, confirmButtonText = "Confirm") {
    console.log("showConfirmModal called."); // DEBUG: Confirm function entry
    return new Promise(resolve => {
        const confirmModalOverlay = document.getElementById("confirm-modal");
        const confirmModalMessage = document.getElementById("confirm-modal-text");
        const modalConfirmButton = document.getElementById("confirm-modal-confirm");
        const modalCancelButton = document.getElementById("confirm-modal-cancel");

        if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
            console.error("Confirmation modal elements not found in showConfirmModal."); // DEBUG: More specific error log
            // Fallback to the browser's confirm dialog if the custom modal isn't found
            resolve(window.confirm(message));
            return;
        }

        confirmModalMessage.innerHTML = message;
        modalConfirmButton.textContent = confirmButtonText;
        confirmModalOverlay.style.display = "flex"; // Show the modal

        // Define the handlers as new functions for each promise invocation
        // This ensures removeEventListener works correctly with the same function reference.
        const onConfirmClick = () => {
            console.log("Confirm button clicked - resolving true."); // DEBUG: Confirm handler fired
            cleanupListeners();
            resolve(true);
        };
        const onCancelClick = () => {
            console.log("Cancel button clicked - resolving false."); // DEBUG: Confirm handler fired
            cleanupListeners();
            resolve(false);
        };
        const onClickOutside = (event) => {
            if (event.target === confirmModalOverlay) {
                console.log("Clicked outside modal - resolving false."); // DEBUG: Confirm handler fired
                cleanupListeners();
                resolve(false); // Treat clicking outside as cancellation
            }
        };

        // Function to remove all attached listeners
        const cleanupListeners = () => {
            console.log("Cleaning up confirm modal listeners."); // DEBUG: Confirm cleanup
            modalConfirmButton.removeEventListener("click", onConfirmClick);
            modalCancelButton.removeEventListener("click", onCancelClick);
            confirmModalOverlay.removeEventListener("click", onClickOutside);
            confirmModalOverlay.style.display = "none"; // Hide the modal
        };

        // Attach event listeners
        modalConfirmButton.addEventListener("click", onConfirmClick);
        modalCancelButton.addEventListener("click", onCancelClick);
        confirmModalOverlay.addEventListener("click", onClickOutside);
        console.log("Confirm modal listeners attached."); // DEBUG: Confirm listeners attached
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
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                errorMsg = response.statusText;
            }
            throw new Error(errorMsg);
        }

        if (expectBlobResponse) {
            return response.blob();
        }

        const contentLength = response.headers.get("content-length");
        if (response.status === 204 || contentLength === "0") {
            return null;
        }

        return response.json();

    } catch (error) {
        showModalMessage(error.message, true);
        throw error;
    }
}
