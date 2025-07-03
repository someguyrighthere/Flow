// js/pages/hiring.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the hiring page.
 */
export function handleHiringPage() {
    // Security check: Redirect if not logged in
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Elements ---
    const newJobPostingForm = document.getElementById('new-job-posting-form');
    const jobTitleInput = document.getElementById('job-title');
    const jobDescriptionTextarea = document.getElementById('job-description');
    const jobRequirementsTextarea = document.getElementById('job-requirements');
    const jobLocationSelect = document.getElementById('job-location-select');
    const jobPostingStatusMessage = document.getElementById('job-posting-status-message');

    const jobPostingsListDiv = document.getElementById('job-postings-list');
    const applicantsListDiv = document.getElementById('applicants-list');

    // --- Helper function for local status messages ---
    /**
     * Displays a status message on a specified DOM element.
     * @param {HTMLElement} element - The DOM element to display the message in.
     * @param {string} message - The message text.
     * @param {boolean} [isError=false] - True if the message is an error, false for success.
     */
    function displayStatusMessage(element, message, isError = false) {
        if (!element) return;
        element.innerHTML = message;
        element.classList.remove('success', 'error'); // Clear previous states
        element.classList.add(isError ? 'error' : 'success');
        setTimeout(() => {
            element.textContent = '';
            element.classList.remove('success', 'error');
        }, 5000); // Clear message after 5 seconds
    }

    // --- Data Loading Functions ---

    /**
     * Loads locations from the API and populates the job posting form's location dropdown.
     */
    async function loadLocationsForJobPostingForm() {
        if (!jobLocationSelect) return;
        jobLocationSelect.innerHTML = '<option value="">Loading locations...</option>'; // Show loading state
        try {
            const locations = await apiRequest('GET', '/api/locations');
            jobLocationSelect.innerHTML = '<option value="">Select Location</option>'; // Default empty option

            if (locations && locations.length > 0) {
                locations.forEach(loc => {
                    const option = new Option(loc.location_name, loc.location_id);
                    jobLocationSelect.add(option);
                });
            } else {
                jobLocationSelect.innerHTML = '<option value="">No locations available</option>';
            }
        } catch (error) {
            console.error('Error loading locations for job posting form:', error);
            jobLocationSelect.innerHTML = '<option value="">Error loading locations</option>';
            displayStatusMessage(jobPostingStatusMessage, `Error loading locations: ${error.message}`, true);
        }
    }

    /**
     * Fetches current job postings from the API and renders them into the job postings list.
     */
    async function loadCurrentJobPostings() {
        if (!jobPostingsListDiv) return;
        jobPostingsListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading job postings...</p>'; // Show loading state
        try {
            const jobPostings = await apiRequest('GET', '/api/job-postings');
            jobPostingsListDiv.innerHTML = ''; // Clear loading message

            if (jobPostings && jobPostings.length > 0) {
                jobPostings.forEach(post => {
                    const postItem = document.createElement('div');
                    postItem.className = 'job-posting-item';
                    postItem.innerHTML = `
                        <h4>${post.title}</h4>
                        <!-- Removed: Job Description and Requirements -->
                        <p style="font-size: 0.8em; color: var(--text-medium);">Location: ${post.location_name || 'Company Wide'} | Posted: ${new Date(post.created_at).toLocaleDateString()}</p>
                        <div class="job-posting-actions">
                            <a href="apply.html?jobId=${post.id}" class="btn btn-secondary btn-sm" target="_blank">View Public Ad</a>
                            <button class="btn btn-secondary btn-sm btn-delete-job-posting" data-id="${post.id}">Delete</button>
                        </div>
                    `;
                    jobPostingsListDiv.appendChild(postItem);
                });
                // Attach event listeners for dynamically created delete buttons
                jobPostingsListDiv.querySelectorAll('.btn-delete-job-posting').forEach(button => {
                    button.addEventListener('click', (e) => deleteJobPosting(e.target.dataset.id));
                });
            } else {
                jobPostingsListDiv.innerHTML = '<p style="color: var(--text-medium);">No job postings found.</p>';
            }
        } catch (error) {
            console.error('Error loading job postings:', error);
            jobPostingsListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading job postings: ${error.message}</p>`;
        }
    }

    /**
     * Fetches recent applicants from the API and renders them into the applicants list.
     */
    async function loadRecentApplicants() {
        if (!applicantsListDiv) return;
        applicantsListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading applicants...</p>'; // Show loading state
        try {
            const applicants = await apiRequest('GET', '/api/applicants');
            applicantsListDiv.innerHTML = ''; // Clear loading message

            if (applicants && applicants.length > 0) {
                applicants.forEach(applicant => {
                    const applicantItem = document.createElement('div');
                    applicantItem.className = 'job-posting-item'; // Re-use styling for consistency
                    applicantItem.innerHTML = `
                        <h4>${applicant.name} <span style="font-size:0.8em; color:var(--text-medium);">(${applicant.job_title || 'N/A'})</span></h4>
                        <p>Email: ${applicant.email}</p>
                        <p>Phone: ${applicant.phone || 'N/A'}</p>
                        <p style="font-size: 0.8em; color: var(--text-medium);">Applied: ${new Date(applicant.applied_at).toLocaleDateString()}</p>
                        <div class="job-posting-actions">
                            <button class="btn btn-secondary btn-sm btn-delete-applicant" data-id="${applicant.id}">Archive</button>
                        </div>
                    `;
                    applicantsListDiv.appendChild(applicantItem);
                });
                // Attach event listeners for dynamically created archive (delete) buttons
                applicantsListDiv.querySelectorAll('.btn-delete-applicant').forEach(button => {
                    button.addEventListener('click', (e) => deleteApplicant(e.target.dataset.id));
                });
            } else {
                applicantsListDiv.innerHTML = '<p style="color: var(--text-medium);">No recent applicants.</p>';
            }
        } catch (error) {
            console.error('Error loading applicants:', error);
            applicantsListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading applicants: ${error.message}</p>`;
        }
    }

    // --- Event Handlers ---

    /**
     * Handles the submission of the new job posting form.
     * @param {Event} e - The submit event.
     */
    async function createJobPosting(e) {
        e.preventDefault(); // Prevent default form submission

        const jobData = {
            title: jobTitleInput.value.trim(),
            description: jobDescriptionTextarea.value.trim(),
            requirements: jobRequirementsTextarea.value.trim(),
            location_id: jobLocationSelect.value || null // Use null if no location selected
        };

        // Basic validation
        if (!jobData.title || !jobData.description || !jobData.location_id) {
            displayStatusMessage(jobPostingStatusMessage, 'Job title, description, and location are required.', true);
            return;
        }

        try {
            await apiRequest('POST', '/api/job-postings', jobData); // Send data to backend
            displayStatusMessage(jobPostingStatusMessage, 'Job posting created successfully!', false);
            newJobPostingForm.reset(); // Clear the form
            loadCurrentJobPostings(); // Reload the list of job postings to show the new one
        } catch (error) {
            displayStatusMessage(jobPostingStatusMessage, `Error creating job posting: ${error.message}`, true);
            console.error('Error creating job posting:', error);
        }
    }

    /**
     * Handles the deletion of a job posting.
     * @param {string} id - The ID of the job posting to delete.
     */
    async function deleteJobPosting(id) {
        const confirmed = await showConfirmModal('Are you sure you want to delete this job posting? This cannot be undone.', 'Delete');
        if (confirmed) {
            try {
                await apiRequest('DELETE', `/api/job-postings/${id}`); // Call backend delete endpoint
                showModalMessage('Job posting deleted successfully!', false);
                loadCurrentJobPostings(); // Reload the list after deletion
            } catch (error) {
                showModalMessage(`Error deleting job posting: ${error.message}`, true);
                console.error('Error deleting job posting:', error);
            }
        }
    }

    /**
     * Handles archiving/deletion of an applicant.
     * @param {string} id - The ID of the applicant to delete.
     */
    async function deleteApplicant(id) {
        const confirmed = await showConfirmModal('Are you sure you want to archive this applicant? This cannot be undone.', 'Archive');
        if (confirmed) {
            try {
                // Assuming a DELETE endpoint for applicants by ID
                await apiRequest('DELETE', `/api/applicants/${id}`);
                showModalMessage('Applicant archived successfully!', false);
                loadRecentApplicants(); // Reload the list after archiving
            } catch (error) {
                showModalMessage(`Error archiving applicant: ${error.message}`, true);
                console.error('Error archiving applicant:', error);
            }
        }
    }

    // --- Attach Event Listeners ---
    if (newJobPostingForm) {
        newJobPostingForm.addEventListener('submit', createJobPosting);
    }
    
    // --- Initial Page Load Actions ---
    // Call these functions to populate the page when it loads
    loadLocationsForJobPostingForm(); // Populate the location dropdown for new job postings
    loadCurrentJobPostings(); // Load and display existing job postings
    loadRecentApplicants(); // Load and display recent applicants
}
