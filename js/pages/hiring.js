// js/pages/hiring.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleHiringPage() {
    // ... (rest of the variable declarations remain the same)
    const applicantListDiv = document.getElementById('applicant-list');

    // --- NEW: Modal element selectors ---
    const viewApplicantModal = document.getElementById('view-applicant-modal');
    const viewApplicantCloseBtn = document.getElementById('view-applicant-close-btn');

    // ... (loadJobPostings and loadLocationsIntoSelects functions remain the same)

    async function loadApplicants() {
        // ... (this function's logic remains the same)
        // Inside the forEach loop where applicantItem is created:
        // ...
        applicantItem.innerHTML = `
            <h4>${applicant.name}</h4>
            <p><strong>Applying for:</strong> ${applicant.job_title || 'N/A'}</p>
            <p><strong>Status:</strong> ${applicant.status || 'Applied'}</p>
            <p><strong>Contact:</strong> ${applicant.email || 'N/A'}</p>
            <div class="actions">
                 <button class="btn btn-secondary btn-sm view-applicant-btn" data-applicant-id="${applicant.id}">View</button>
                 <button class="delete-btn" data-applicant-id="${applicant.id}">Delete</button>
            </div>
        `;
        // ...
    }

    // --- NEW: Function to show applicant details ---
    async function showApplicantDetails(applicantId) {
        if (!viewApplicantModal) return;
        try {
            const applicant = await apiRequest('GET', `/applicants/${applicantId}`);
            document.getElementById('view-applicant-name').textContent = applicant.name || '-';
            document.getElementById('view-applicant-email').textContent = applicant.email || '-';
            document.getElementById('view-applicant-phone').textContent = applicant.phone || '-';
            document.getElementById('view-applicant-address').textContent = applicant.address || '-';
            document.getElementById('view-applicant-dob').textContent = applicant.date_of_birth ? new Date(applicant.date_of_birth).toLocaleDateString() : '-';
            document.getElementById('view-applicant-availability').textContent = applicant.availability || '-';
            document.getElementById('view-applicant-authorized').textContent = applicant.is_authorized ? 'Yes' : 'No';
            viewApplicantModal.style.display = 'flex';
        } catch (error) {
            showModalMessage(`Error fetching applicant details: ${error.message}`, true);
        }
    }
    
    // --- Event Listeners ---
    if (applicantListDiv) {
        applicantListDiv.addEventListener('click', async (e) => {
            const viewBtn = e.target.closest('.view-applicant-btn');
            const deleteBtn = e.target.closest('.delete-btn');

            if (viewBtn) {
                const applicantId = viewBtn.dataset.applicantId;
                showApplicantDetails(applicantId);
            }

            if (deleteBtn) {
                // ... (delete logic remains the same)
            }
        });
    }

    if (viewApplicantCloseBtn) {
        viewApplicantCloseBtn.addEventListener('click', () => {
            viewApplicantModal.style.display = 'none';
        });
    }

    // ... (rest of the event listeners and initial load calls remain the same)
    
    loadJobPostings();
    loadApplicants();
    loadLocationsIntoSelects();
}
