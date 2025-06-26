// js/utils.js

// This should be the full URL of your deployed backend.
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

/**
 * Displays a custom modal message to the user.
 * @param {string} message The message to display.
 * @param {boolean} [isError=false] Whether the message is an error.
 */
export function showModalMessage(message, isError = false) {
    // Corrected IDs to match scheduling.html structure
    const modalOverlay = document.getElementById("modal-message"); // The main modal container
    const modalMessageText = document.getElementById("modal-text");     // The paragraph for the message
    const modalOkButton = document.getElementById("modal-ok-button"); // The new OK button

    if (modalOverlay && modalMessageText && modalOkButton) {
        modalMessageText.textContent = message;
        modalMessageText.style.color = isError ? "#ff8a80" : "var(--text-light)";
        
        // Define hide functions first, before attaching/removing listeners
        const hideModal = () => { modalOverlay.style.display = "none"; };
        const hideModalOutside = (event) => { 
            if (event.target === modalOverlay) hideModal(); 
        };

        // Remove any previous listeners to prevent multiple firings
        // These must be called after the functions are defined
        modalOkButton.removeEventListener("click", hideModal);
        modalOverlay.removeEventListener("click", hideModalOutside);

        modalOverlay.style.display = "flex"; // Show the modal

        // Add new listeners
        modalOkButton.addEventListener("click", hideModal);
        modalOverlay.addEventListener("click", hideModalOutside);
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
        // Corrected IDs to match scheduling.html structure
        const confirmModalOverlay = document.getElementById("confirm-modal");       // Corrected ID
        const confirmModalMessage = document.getElementById("confirm-modal-text"); // Corrected ID
        const modalConfirmButton = document.getElementById("confirm-modal-confirm"); // Corrected ID
        const modalCancelButton = document.getElementById("confirm-modal-cancel");   // Corrected ID

        if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
            console.error("Confirmation modal elements not found. Falling back to browser's confirm.");
            // Fallback to the browser's confirm dialog if the custom modal isn't found
            resolve(window.confirm(message));
            return;
        }

        confirmModalMessage.innerHTML = message;
        modalConfirmButton.textContent = confirmButtonText;
        confirmModalOverlay.style.display = "flex";

        // Define the response handler, which also cleans up event listeners
        const handleResponse = (value) => {
            // Remove event listeners to prevent multiple firings on subsequent modal uses
            modalConfirmButton.removeEventListener("click", onConfirmClick);
            modalCancelButton.removeEventListener("click", onCancelClick);
            confirmModalOverlay.removeEventListener("click", onClickOutside);
            confirmModalOverlay.style.display = "none"; // Hide the modal
            resolve(value); // Resolve the promise with true or false
        };
        
        // Define click handler functions (named functions for easier removal)
        const onConfirmClick = () => handleResponse(true);
        const onCancelClick = () => handleResponse(false);
        const onClickOutside = (event) => {
            if (event.target === confirmModalOverlay) {
                handleResponse(false); // Treat clicking outside as cancellation
            }
        };

        // Attach event listeners to the buttons and overlay
        // Use { once: true } to automatically remove listener after first invocation if desired,
        // but explicit removal is also fine if modal is frequently reused.
        // For robustness, explicit removal is kept.
        modalConfirmButton.addEventListener("click", onConfirmClick);
        modalCancelButton.addEventListener("click", onCancelClick);
        confirmModalOverlay.addEventListener("click", onClickOutside);
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

    // Debugging logs - removed for production code, but helpful during development
    // console.log(`[apiRequest] Attempting ${method} request to: ${endpoint}`); 
    // console.log(`[apiRequest] Token present: ${!!token}`); 

    const handleAuthError = (errorMessage) => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        showModalMessage(errorMessage, true);
        setTimeout(() => { window.location.href = 'login.html?sessionExpired=true'; }, 1500); 
    };

    if (isFormData) {
        // console.log("[apiRequest] Handling FormData request."); // Debugging log
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            if (onProgress && xhr.upload) xhr.upload.addEventListener('progress', onProgress);
            
            xhr.onload = function () {
                // console.log(`[apiRequest] XHR Load: Status ${xhr.status}`); // Debugging log
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
            xhr.onerror = () => {
                // console.error("[apiRequest] XHR Error: Network issue."); // Debugging log
                reject(new Error('Network error. Check connection or CORS policy.'));
            };
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
    // console.log("[apiRequest] Fetch options:", options); // Debugging log

    try {
        const response = await fetch(endpoint, options);
        // console.log(`[apiRequest] Fetch Response Status: ${response.status}`); // Debugging log
        
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
            // console.error(`[apiRequest] Fetch not OK: ${errorMsg}`); // Debugging log
            throw new Error(errorMsg);
        }

        if (expectBlobResponse) {
            // console.log("[apiRequest] Expecting Blob response."); // Debugging log
            return response.blob();
        }

        const contentLength = response.headers.get("content-length");
        if (response.status === 204 || contentLength === "0") {
            // console.log("[apiRequest] Returning null for 204 or empty content."); // Debugging log
            return null;
        }

        // console.log("[apiRequest] Parsing JSON response."); // Debugging log
        return response.json();

    } catch (error) {
        // console.error('[apiRequest] Caught error:', error); // Debugging log
        showModalMessage(error.message, true);
        throw error;
    }
}
