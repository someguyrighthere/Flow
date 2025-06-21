// app.js - Client-Side JavaScript for Flow Business Suite
// This file handles all client-side logic, form submissions, and API requests.

// IMPORTANT: Set this to your deployed backend API URL.
// Your frontend is deployed at https://flow-gz1r.onrender.com/
// Assuming your backend API is accessible at the same root with '/api' suffix (as per server.js routes configuration).
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

// Initialize Stripe.js with your public key (replace with your actual publishable key)
// This key should be retrieved from your backend or securely stored in your client-side config.
// IMPORTANT: Replace 'pk_live_YOUR_STRIPE_PUBLISHABLE_KEY' with your actual Stripe Publishable Key
// from your Stripe dashboard (e.g., pk_live_************************).
// This key should NOT be stored as a backend environment variable.
const stripe = Stripe('pk_live_YOUR_STRIPE_PUBLISHABLE_KEY');


/**
 * Handles API requests to the backend.
 * Includes authentication token in headers if available.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {string} path - API endpoint path (e.g., '/login', '/profile').
 * @param {object} body - Request body data (for POST, PUT).
 * @returns {Promise<object|null>} - JSON response data or null if 204.
 * @throws {Error} - If the API response is not OK.
 */
async function apiRequest(method, path, body = null) {
    const token = localStorage.getItem('authToken');
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE_URL}${path}`, options);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Something went wrong');
    }
    if (response.status === 204 || (response.status === 200 && response.headers.get('content-length') === '0')) {
        return null;
    }
    return response.json();
}

/**
 * Displays a custom modal message to the user.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message, false otherwise.
 */
function showModalMessage(message, isError = false) {
    const modalOverlay = document.getElementById('message-modal-overlay');
    const modalMessage = document.getElementById('modal-message-text');
    const modalCloseButton = document.getElementById('modal-close-button');

    if (modalOverlay && modalMessage && modalCloseButton) {
        modalMessage.textContent = message;
        modalMessage.style.color = isError ? '#ff8a80' : 'var(--text-light)';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.zIndex = '1000';

        modalCloseButton.onclick = () => {
            modalOverlay.style.display = 'none';
        };

        modalOverlay.onclick = (event) => {
            if (event.target === modalOverlay) {
                modalOverlay.style.display = 'none';
            }
        };
    } else {
        console.error("Modal elements not found for showModalMessage. Message:", message);
        if (isError) {
            console.error(`ERROR: ${message}`);
        } else {
            console.log(`MESSAGE: ${message}`);
        }
    }
}

/**
 * Displays a custom confirmation modal.
 * @param {string} message - The confirmation message to display.
 * @param {string} confirmButtonText - Text for the confirm button (e.g., "Delete", "Proceed").
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled.
 */
function showConfirmModal(message, confirmButtonText = 'Confirm') {
    return new Promise((resolve) => {
        const confirmModalOverlay = document.getElementById('confirm-modal-overlay');
        const confirmModalMessage = document.getElementById('confirm-modal-message');
        const modalConfirmButton = document.getElementById('modal-confirm');
        const modalCancelButton = document.getElementById('modal-cancel');

        if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
            console.error("Confirmation modal elements not found. Falling back to native confirm.");
            resolve(window.confirm(message));
            return;
        }

        confirmModalMessage.textContent = message;
        modalConfirmButton.textContent = confirmButtonText;

        confirmModalOverlay.style.display = 'flex';

        const handleConfirm = () => {
            confirmModalOverlay.style.display = 'none';
            modalConfirmButton.removeEventListener('click', handleConfirm);
            modalCancelButton.removeEventListener('click', handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            confirmModalOverlay.style.display = 'none';
            modalConfirmButton.removeEventListener('click', handleConfirm);
            modalCancelButton.removeEventListener('click', handleCancel);
            resolve(false);
        };

        modalConfirmButton.addEventListener('click', handleConfirm);
        modalCancelButton.addEventListener('click', handleCancel);

        confirmModalOverlay.onclick = (event) => {
            if (event.target === confirmModalOverlay) {
                handleCancel();
            }
        };
    });
}

/**
 * Sets up the settings dropdown and logout functionality.
 */
function setupSettingsDropdown() {
    console.log('setupSettingsDropdown: Initializing.'); // DEBUG
    const settingsButton = document.getElementById('settin