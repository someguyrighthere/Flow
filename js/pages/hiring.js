// js/pages/hiring.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the hiring and applicant tracking page.
 */
export function handleHiringPage() {
    // Security check
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Element Selection ---
    const createJobForm = document.getElementById('create-job-posting-form');
    const jobPostingListDiv = document.getElementById('job-posting-list');
    const applicantListDiv = document.getElementById('applicant-list');
    
    // Filters and Dropdowns
    const jobPostingLocationSelect = document.getElementById('job-posting-location-select');
    const filterJobSelect = document.getElementById('filter-applicant-job-posting-select');
    const filterStatusSelect = document.getElementById('filter-applicant-status');
    const filterLocationSelect = document.getElementById('filter-applicant-location-select');
    const applyFiltersBtn = document.getElementById('apply-applicant-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-applicant-filters-btn');

    // Share Modal
    const shareModal = document.getElementById('share-link-modal-overlay');
    const shareLinkInput = document.getElementById('share-job-link-input');
    const shareEmbedInput = document.getElementById('share-job-embed-code-input');
    const closeModalBtn = document.getElementById('share-link-modal-close-button');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const copyEmbedBtn = document.getElementById('copy-embed-btn');


    // --- Data Loading and Rendering ---

    /**
     * NEW: Fetches locations and populates the various location dropdown menus.
     */
    async function loadLocationsIntoSelects() {
        const selectsToPopulate = [jobPostingLocationSelect, filterLocationSelect];
        try {
            const locations = await apiRequest("GET", "/locations");
            
            selectsToPopulate.forEach(select => {
                if (select) {
                    // Clear existing options except for the default
                    while (select.options.length > 1) {
                        select.remove(1);
                    }
                    locations.forEach(loc => {
                        const option = new Option(loc.location_name, loc.location_id);
                        select.add(option);
                    });
                }
            });
        } catch (error) {
            console.error("Failed to load locations for dropdowns:", error);
            showModalMessage("Could not load locations for filtering.", true);
        }
    }


    /**
     * Loads all active job postings and renders them.
     */
    async function loadJobPostings() {
        if (!jobPostingListDiv) return;
        jobPostingListDiv.innerHTML = '<p>Loading job postings...</p>';
        try {
            const postings = await apiRequest('GET', '/job-postings');
            jobPostingListDiv.innerHTML = '';
            
            // Also populate the filter dropdown
            if (filterJobSelect) {
                filterJobSelect.innerHTML = '<option value="">All Job Postings</option>'; // Reset
                postings.forEach(job => {
                    const option = new Option(job.title, job.id);
                    filterJobSelect.add(option);
                });
            }

            if (postings && postings.length > 0) {
                postings.forEach(job => {
                    const jobItem = document.createElement('div');
                    jobItem.className = 'job-posting-item';
                    jobItem.innerHTML = `
                        <h4>${job.title}</h4>
                        <p><strong>Location:</strong> ${job.location_name || 'Company Wide'}</p>
                        <p><strong>Applicants:</strong> ${job.applicant_count || 0}</p>
                        <div class="actions">
                            <button class="share-btn" data-job-id="${job.id}" data-job-title="${job.title}">Share</button>
                            <button class="delete-btn" data-job-id="${job.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 1 0 0 1-2 2H5a2 1 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    `;
                    jobPostingListDiv.appendChild(jobItem);
                });
            } else {
                jobPostingListDiv.innerHTML = '<p>No active job postings.</p>';
            }
        } catch (error) {
            jobPostingListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading jobs: ${error.message}</p>`;
        }
    }
    
    /**
     * Loads applicants based on current filter settings.
     */
    async function loadApplicants() {
        if (!applicantListDiv) return;
        applicantListDiv.innerHTML = '<p>Loading applicants...</p>';
        
        const params = new URLSearchParams();
        if (filterJobSelect.value) params.append('jobId', filterJobSelect.value);
        if (filterStatusSelect.value) params.append('status', filterStatusSelect.value);
        if (filterLocationSelect.value) params.append('locationId', filterLocationSelect.value);
        const queryString = params.toString();

        try {
            const applicants = await apiRequest('GET', `/applicants?${queryString}`);
            applicantListDiv.innerHTML = '';
            if (applicants && applicants.length > 0) {
                 applicants.forEach(applicant => {
                    const applicantItem = document.createElement('div');
                    applicantItem.className = 'applicant-item';
                    applicantItem.innerHTML = `
                        <h4>${applicant.name}</h4>
                        <p><strong>Applying for:</strong> ${applicant.job_title || 'N/A'}</p>
                        <p><strong>Status:</strong> ${applicant.status || 'Applied'}</p>
                        <p><strong>Contact:</strong> ${applicant.email || 'N/A'}</p>
                        <div class="actions">
                             <button class="btn btn-secondary btn-sm" onclick="window.location.href='mailto:${applicant.email}'">Contact</button>
                             <button class="delete-btn" data-applicant-id="${applicant.id}">Delete</button>
                        </div>
                    `;
                    applicantListDiv.appendChild(applicantItem);
                });
            } else {
                applicantListDiv.innerHTML = '<p>No applicants match the current filters.</p>';
            }
        } catch (error) {
             applicantListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading applicants: ${error.message}</p>`;
        }
    }


    // --- Event Handlers ---

    if (createJobForm) {
        createJobForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const jobData = {
                title: document.getElementById('job-title-input').value,
                description: document.getElementById('job-description-input').value,
                requirements: document.getElementById('job-requirements-input').value,
                location_id: document.getElementById('job-posting-location-select').value || null
            };
            try {
                await apiRequest('POST', '/job-postings', jobData);
                showModalMessage('Job posted successfully!', false);
                createJobForm.reset();
                loadJobPostings();
                loadApplicants();
            } catch (error) {
                showModalMessage(`Error posting job: ${error.message}`, true);
            }
        });
    }

    if (jobPostingListDiv) {
        jobPostingListDiv.addEventListener('click', async (e) => {
            const shareBtn = e.target.closest('.share-btn');
            const deleteBtn = e.target.closest('.delete-btn');

            if (shareBtn) {
                const jobId = shareBtn.dataset.jobId;
                const jobTitle = shareBtn.dataset.jobTitle;
                const publicLink = `${window.location.origin}/apply.html?jobId=${jobId}`;
                const embedCode = `<a href="${publicLink}" target="_blank" style="padding: 10px 20px; background-color: #C86DD7; color: white; border-radius: 5px; text-decoration: none;">Apply for ${jobTitle}</a>`;
                
                shareLinkInput.value = publicLink;
                shareEmbedInput.value = embedCode;
                shareModal.style.display = 'flex';
            }

            if (deleteBtn) {
                const jobId = deleteBtn.dataset.jobId;
                const confirmed = await showConfirmModal('Are you sure you want to delete this job posting?');
                if (confirmed) {
                    try {
                        await apiRequest('DELETE', `/job-postings/${jobId}`);
                        showModalMessage('Job posting deleted.', false);
                        loadJobPostings();
                        loadApplicants();
                    } catch (error) {
                         showModalMessage(`Error: ${error.message}`, true);
                    }
                }
            }
        });
    }

    if(applyFiltersBtn) applyFiltersBtn.addEventListener('click', loadApplicants);
    if(clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (filterJobSelect) filterJobSelect.value = '';
            if (filterStatusSelect) filterStatusSelect.value = '';
            if (filterLocationSelect) filterLocationSelect.value = '';
            loadApplicants();
        });
    }

    if(closeModalBtn) closeModalBtn.addEventListener('click', () => shareModal.style.display = 'none');
    if(shareModal) shareModal.addEventListener('click', (e) => { if (e.target === shareModal) shareModal.style.display = 'none'; });
    if(copyLinkBtn) copyLinkBtn.addEventListener('click', () => {
        shareLinkInput.select();
        document.execCommand('copy');
        showModalMessage('Link copied to clipboard!', false);
    });
    if(copyEmbedBtn) copyEmbedBtn.addEventListener('click', () => {
        shareEmbedInput.select();
        document.execCommand('copy');
        showModalMessage('Embed code copied to clipboard!', false);
    });

    // --- Initial Page Load ---
    loadJobPostings();
    loadApplicants();
    loadLocationsIntoSelects(); // Load locations into all dropdowns
}
