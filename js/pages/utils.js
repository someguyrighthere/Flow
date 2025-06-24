// js/utils.js

// This should be the full URL of your deployed backend.
const API_BASE_URL = 'https://flow-gz1r.onrender.com';

/**
 * Displays a custom modal message to the user.
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
 */
export function showConfirmModal(message, confirmButtonText = "Confirm") {
    return new Promise(resolve => {
        const confirmModalOverlay = document.getElementById("confirm-modal-overlay");
        const confirmModalMessage = document.getElementById("confirm-modal-message");
        const modalConfirmButton = document.getElementById("modal-confirm");
        const modalCancelButton = document.getElementById("modal-cancel");

        if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
            console.error("Confirmation modal elements not found.");
            resolve(window.confirm(message));
            return;
        }

        confirmModalMessage.innerHTML = message;
        modalConfirmButton.textContent = confirmButtonText;
        confirmModalOverlay.style.display = "flex";

        const handleResponse = (value) => {
            confirmModalOverlay.style.display = "none";
            modalConfirmButton.removeEventListener("click", onConfirm);
            modalCancelButton.removeEventListener("click", onCancel);
            resolve(value);
        };
        const onConfirm = () => handleResponse(true);
        const onCancel = () => handleResponse(false);

        modalConfirmButton.addEventListener("click", onConfirm);
        modalCancelButton.addEventListener("click", onCancel);
        confirmModalOverlay.onclick = event => { if (event.target === confirmModalOverlay) onCancel(); };
    });
}

/**
 * Handles API requests to the backend.
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
                    try { reject(new Error(JSON.parse(xhr.responseText).error || 'An unknown error occurred.')); }
                    catch (e) { reject(new Error(`HTTP error ${xhr.status} - ${xhr.statusText}`)); }
                }
            };
            xhr.onerror = () => reject(new Error('Network error.'));
            xhr.send(body);
        });
    }

    const options = { method, headers: {} };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body && !isFormData) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const response = await fetch(endpoint, options);
    if (response.status === 401 || response.status === 403) {
        handleAuthError('Your session has expired. Please log in again.');
        throw new Error('Authentication failed.');
    }
    if (!response.ok) {
        let errorMsg = `HTTP error! Status: ${response.status}`;
        try { errorMsg = (await response.json()).error || errorMsg; } catch (e) { /* ignore */ }
        throw new Error(errorMsg);
    }
    if (expectBlobResponse) return response.blob();
    if (response.status === 204 || response.headers.get("content-length") === "0") return null;
    return response.json();
}
