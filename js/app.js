        // js/app.js - Minimal test for Documents Page functionality

        // Basic modal message for testing feedback
        function showModalMessage(message, isError = false) {
            const modalOverlay = document.getElementById("message-modal-overlay");
            const modalMessage = document.getElementById("modal-message-text");
            const modalCloseButton = document.getElementById("modal-close-button");
            if (modalOverlay && modalMessage && modalCloseButton) {
                modalMessage.textContent = message;
                modalMessage.style.color = isError ? "#ff8a80" : "var(--text-light)";
                modalOverlay.style.display = "flex";
                modalOverlay.style.zIndex = "1000";
                modalCloseButton.onclick = () => {
                    modalOverlay.style.display = "none";
                };
                modalOverlay.onclick = event => {
                    if (event.target === modalOverlay) {
                        modalOverlay.style.display = "none";
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

        // Minimal handleDocumentsPage to just log a message
        function handleDocumentsPage() {
            console.log("handleDocumentsPage function is now running! (MINIMAL TEST)");
            const documentListDiv = document.getElementById("document-list");
            if (documentListDiv) {
                documentListDiv.innerHTML = '<p style="color: var(--text-light);">Documents page loaded. Minimal JS is working!</p>';
                showModalMessage("Minimal Documents JS Loaded!", false);
            }
        }

        // Calls handleDocumentsPage if on documents.html
        document.addEventListener("DOMContentLoaded", () => {
            console.log("DOMContentLoaded fired! (MINIMAL TEST)");
            const path = window.location.pathname;
            if (path.includes("documents.html")) {
                if (typeof handleDocumentsPage === 'function') {
                    handleDocumentsPage();
                } else {
                    console.error("Error: handleDocumentsPage function is NOT defined! (MINIMAL TEST FAILED)");
                    showModalMessage("Minimal Documents JS FAILED to load. Contact support.", true);
                }
            }
        });
        