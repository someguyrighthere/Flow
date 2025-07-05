// js/pages/hiring.js - MASTER SOLUTION VERSION
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

    /**
     * Displays a status message on a specified DOM element.
     * @param {HTMLElement} element - The DOM element to display the message in.
     * @param {string} message - The message text.
     * @param {boolean} [isError=false] - True if the message is an error, false for success.
     */
    function displayStatusMessage(element, message, isError = false) {
        if (!element) return;
        element.innerHTML = message;
        element.classList.remove('success', 'error');
        element.classList.add(isError ? 'error' : 'success');
        setTimeout(() => {
            element.textContent = '';
            element.classList.remove('success', 'error');
        }, 5000);
    }

    /**
     * Loads locations from the API and populates the job posting form's location dropdown.
     */
    async function loadLocationsForJobPostingForm() {
        if (!jobLocationSelect) return;
        jobLocationSelect.innerHTML = '<option value="">Loading locations...</option>';
        try {
            const locations = await apiRequest('GET', '/api/locations'); 
            jobLocationSelect.innerHTML = '<option value="">Select Location</option>';

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
        jobPostingsListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading job postings...</p>';
        try {
            const jobPostings = await apiRequest('GET', '/api/job-postings'); 
            jobPostingsListDiv.innerHTML = '';

            if (jobPostings && jobPostings.length > 0) {
                jobPostings.forEach(post => {
                    const postItem = document.createElement('div');
                    postItem.className = 'job-posting-item';
                    postItem.innerHTML = `
                        <div>
                            <h4>${post.title}</h4>
                            <p style="font-size: 0.8em; color: var(--text-medium);">
                                Location: ${post.location_name || 'Company Wide'}<br>
                                Posted: ${new Date(post.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div class="job-posting-actions">
                            <a href="apply.html?jobId=${post.id}" class="btn btn-secondary btn-sm" target="_blank" title="View Public Ad">View</a>
                            <button class="btn btn-secondary btn-sm btn-copy-link" data-id="${post.id}" title="Copy Apply Link">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/>
                                    <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/>
                                </svg>
                            </button>
                            <button class="btn btn-secondary btn-sm btn-delete-job-posting" data-id="${post.id}" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    jobPostingsListDiv.appendChild(postItem);
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
        applicantsListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading applicants...</p>';
        try {
            const applicants = await apiRequest('GET', '/api/applicants'); 
            applicantsListDiv.innerHTML = '';

            if (applicants && applicants.length > 0) {
                applicants.forEach(applicant => {
                    const applicantItem = document.createElement('div');
                    applicantItem.className = 'applicant-item'; 
                    applicantItem.innerHTML = `
                        <div>
                            <h4>${applicant.name} <span style="font-size:0.8em; color:var(--text-medium);">(${applicant.job_title || 'N/A'})</span></h4>
                            <p style="font-size: 0.8em; color: var(--text-medium); margin-bottom: 5px;">Email: ${applicant.email}</p>
                            ${applicant.phone ? `<p style="font-size: 0.8em; color: var(--text-medium); margin-bottom: 5px;">Phone: ${applicant.phone}</p>` : ''}
                            <p style="font-size: 0.8em; color: var(--text-medium);">Applied: ${new Date(applicant.applied_at).toLocaleDateString()}</p>
                        </div>
                        <div class="job-posting-actions"> 
                            <button class="btn btn-secondary btn-sm btn-delete-applicant" data-id="${applicant.id}" title="Archive Applicant">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    applicantsListDiv.appendChild(applicantItem);
                });
            } else {
                applicantsListDiv.innerHTML = '<p style="color: var(--text-medium);">No recent applicants.</p>';
            }
        } catch (error) {
            console.error('Error loading applicants:', error);
            applicantsListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading applicants: ${error.message}</p>`;
        }
    }

    /**
     * Handles the submission of the new job posting form.
     */
    async function createJobPosting(e) {
        e.preventDefault(); 
        const jobData = {
            title: jobTitleInput.value.trim(),
            description: jobDescriptionTextarea.value.trim(),
            requirements: jobRequirementsTextarea.value.trim(),
            location_id: jobLocationSelect.value || null 
        };
        if (!jobData.title || !jobData.description || !jobData.location_id) {
            displayStatusMessage(jobPostingStatusMessage, 'Job title, description, and location are required.', true);
            return;
        }
        try {
            await apiRequest('POST', '/api/job-postings', jobData); 
            displayStatusMessage(jobPostingStatusMessage, 'Job posting created successfully!', false);
            newJobPostingForm.reset(); 
            loadCurrentJobPostings(); 
        } catch (error) {
            displayStatusMessage(jobPostingStatusMessage, `Error creating job posting: ${error.message}`, true);
        }
    }

    /**
     * Handles the deletion of a job posting.
     */
    async function deleteJobPosting(id) {
        const confirmed = await showConfirmModal('Are you sure you want to delete this job posting?', 'Delete');
        if (confirmed) {
            try {
                await apiRequest('DELETE', `/api/job-postings/${id}`); 
                showModalMessage('Job posting deleted successfully!', false);
                loadCurrentJobPostings(); 
            } catch (error) {
                showModalMessage(`Error deleting job posting: ${error.message}`, true);
            }
        }
    }

    /**
     * Handles archiving/deletion of an applicant.
     */
    async function deleteApplicant(id) {
        const confirmed = await showConfirmModal('Are you sure you want to archive this applicant?', 'Archive');
        if (confirmed) {
            try {
                await apiRequest('DELETE', `/api/applicants/${id}`);
                showModalMessage('Applicant archived successfully!', false);
                loadRecentApplicants(); 
            } catch (error) {
                showModalMessage(`Error archiving applicant: ${error.message}`, true);
            }
        }
    }

    // --- Attach Event Listeners ---
    if (newJobPostingForm) {
        newJobPostingForm.addEventListener('submit', createJobPosting);
    }
    
    // Use event delegation for dynamically created buttons
    if(jobPostingsListDiv) {
        jobPostingsListDiv.addEventListener('click', (e) => {
            const deleteButton = e.target.closest('.btn-delete-job-posting');
            const copyButton = e.target.closest('.btn-copy-link');

            if (deleteButton) {
                deleteJobPosting(deleteButton.dataset.id);
            } else if (copyButton) {
                const jobId = copyButton.dataset.id;
                const applyUrl = `${window.location.origin}/apply.html?jobId=${jobId}`;
                
                const textArea = document.createElement("textarea");
                textArea.value = applyUrl;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    showModalMessage('Link copied to clipboard!', false);
                } catch (err) {
                    showModalMessage('Failed to copy link.', true);
                    console.error('Failed to copy link: ', err);
                }
                document.body.removeChild(textArea);
            }
        });
    }

    if(applicantsListDiv) {
        applicantsListDiv.addEventListener('click', (e) => {
            const deleteButton = e.target.closest('.btn-delete-applicant');
            if(deleteButton) {
                deleteApplicant(deleteButton.dataset.id);
            }
        });
    }
    
    // --- Initial Page Load Actions ---
    loadLocationsForJobPostingForm(); 
    loadCurrentJobPostings(); 
    loadRecentApplicants(); 
}
