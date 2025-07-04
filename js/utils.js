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
        const hideModal = () => { modalOverlay.style.display = "none"; };
        const hideModalOutside = (event) => { 
            if (event.target === modalOverlay) hideModal(); 
        };

        modalOkButton.removeEventListener("click", hideModal);
        modalOverlay.removeEventListener("click", hideModalOutside);

        modalMessageText.textContent = message;
        modalMessageText.style.color = isError ? "#ff8a80" : "var(--text-light)";
        modalOverlay.style.display = "flex";

        modalOkButton.addEventListener("click", hideModal);
        modalOverlay.addEventListener("click", hideModalOutside);

    } else {
        console.error("Modal elements not found for showModalMessage:", message);
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
        const confirmModalOverlay = document.getElementById("confirm-modal");
        const confirmModalMessage = document.getElementById("confirm-modal-text");
        const modalConfirmButton = document.getElementById("confirm-modal-confirm");
        const modalCancelButton = document.getElementById("confirm-modal-cancel");

        if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
            console.error("Confirmation modal elements not found. Falling back to browser's confirm.");
            resolve(window.confirm(message));
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
 * @returns {Promise<any>} The JSON response from the API.
 */
export async function apiRequest(method, path, body = null, isFormData = false) {
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
        showModalMessage(error.message, true);
        throw error;
    }
}
