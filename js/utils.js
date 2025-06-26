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
    const modalOverlay = document.getElementById("modal-message"); // Corrected ID
    const modalMessage = document.getElementById("modal-text");     // Corrected ID
    const modalCloseButton = modalOverlay ? modalOverlay.querySelector(".close-button") : null; // Select by class within the modal

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

        // Define the response handler
        const handleResponse = (value) => {
            // Remove the event listeners to prevent them from firing again
            modalConfirmButton.removeEventListener("click", onConfirm);
            modalCancelButton.removeEventListener("click", onCancel);
            confirmModalOverlay.removeEventListener("click", onClickOutside); // Remove click outside listener
            confirmModalOverlay.style.display = "none";
            resolve(value);
        };
        
        // Define click handlers
        const onConfirm = () => handleResponse(true);
        const onCancel = () => handleResponse(false);
        const onClickOutside = (event) => {
            if (event.target === confirmModalOverlay) onCancel();
        };

        // Attach event listeners.
        modalConfirmButton.addEventListener("click", onConfirm);
        modalCancelButton.addEventListener("click", onCancel);
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

    console.log(`[apiRequest] Attempting ${method} request to: ${endpoint}`); // DEBUG
    console.log(`[apiRequest] Token present: ${!!token}`); // DEBUG

    const handleAuthError = (errorMessage) => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        showModalMessage(errorMessage, true);
        setTimeout(() => { window.location.href = 'login.html?sessionExpired=true'; }, 1500); 
    };

    if (isFormData) {
        console.log("[apiRequest] Handling FormData request."); // DEBUG
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            if (onProgress && xhr.upload) xhr.upload.addEventListener('progress', onProgress);
            
            xhr.onload = function () {
                console.log(`[apiRequest] XHR Load: Status ${xhr.status}`); // DEBUG
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
                console.error("[apiRequest] XHR Error: Network issue."); // DEBUG
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
    console.log("[apiRequest] Fetch options:", options); // DEBUG

    try {
        const response = await fetch(endpoint, options);
        console.log(`[apiRequest] Fetch Response Status: ${response.status}`); // DEBUG
        
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
            console.error(`[apiRequest] Fetch not OK: ${errorMsg}`); // DEBUG
            throw new Error(errorMsg);
        }

        if (expectBlobResponse) {
            console.log("[apiRequest] Expecting Blob response."); // DEBUG
            return response.blob();
        }

        const contentLength = response.headers.get("content-length");
        if (response.status === 204 || contentLength === "0") {
            console.log("[apiRequest] Returning null for 204 or empty content."); // DEBUG
            return null;
        }

        console.log("[apiRequest] Parsing JSON response."); // DEBUG
        return response.json();

    } catch (error) {
        console.error('[apiRequest] Caught error:', error); // DEBUG
        showModalMessage(error.message, true);
        throw error;
    }
}
