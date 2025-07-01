// js/pages/apply.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles all logic for the job application page.
 */
export function handleApplyPage() {
    const jobDetailsContainer = document.getElementById('job-details-container');
    const applyForm = document.getElementById('apply-form');
    const applyCard = document.getElementById('apply-card');
    
    // Get the jobId from the URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('jobId');

    // If no jobId is provided in the URL, display an error and exit
    if (!jobId) {
        if (jobDetailsContainer) {
            jobDetailsContainer.innerHTML = '<h2>Job Not Found</h2><p>No job ID was provided in the URL.</p>';
        }
        return;
    }

    /**
     * Loads job details from the API based on the jobId and displays them.
     */
    async function loadJobDetails() {
        if (!jobDetailsContainer) return;

        jobDetailsContainer.innerHTML = '<p style="color: var(--text-medium);">Loading job details...</p>'; // Show loading state
        try {
            // Fetch job posting details from the public endpoint
            const job = await apiRequest('GET', `/job-postings/${jobId}`);
            if (job) {
                document.title = `Apply for ${job.title} - Flow Business Suite`; // Update page title
                const detailsEl = document.createElement('div');
                detailsEl.className = 'job-details';
                detailsEl.innerHTML = `
                    <h2>${job.title}</h2>
                    <p><strong>Location:</strong> ${job.location_name || 'Company Wide'}</p>
                    <p><strong>Description:</strong><br>${job.description.replace(/\n/g, '<br>')}</p>
                    ${job.requirements ? `<p><strong>Requirements:</strong><br>${job.requirements.replace(/\n/g, '<br>')}</p>` : ''}
                `;
                jobDetailsContainer.innerHTML = ''; // Clear loading message
                jobDetailsContainer.appendChild(detailsEl);
            } else {
                 jobDetailsContainer.innerHTML = '<h2>Job Not Found</h2><p>The job you are looking for does not exist.</p>';
            }
        } catch (error) {
            jobDetailsContainer.innerHTML = `<h2>Error</h2><p>Could not load job details. ${error.message}</p>`;
            console.error('Error loading job details:', error);
        }
    }

    // Event listener for the application form submission
    if (applyForm) {
        applyForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission
            
            // Collect all application data from the form fields
            const applicationData = {
                name: document.getElementById('applicant-name').value.trim(),
                email: document.getElementById('applicant-email').value.trim(),
                address: document.getElementById('applicant-address').value.trim(),
                phone: document.getElementById('applicant-phone').value.trim(),
                date_of_birth: document.getElementById('applicant-dob').value,
                availability: document.getElementById('applicant-availability').value,
                is_authorized: document.getElementById('applicant-authorized').value === 'Yes', // Convert to boolean
            };

            // Basic validation
            if (!applicationData.name || !applicationData.email || !applicationData.availability) {
                showModalMessage('Please fill in your Full Name, Email Address, and Availability.', true);
                return;
            }

            try {
                // Send application data to the public API endpoint
                await apiRequest('POST', `/apply/${jobId}`, applicationData);
                
                // On successful submission, replace the form with a success message
                if(applyCard) {
                    applyCard.innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <h2 style="color: var(--primary-accent);">Application Submitted!</h2>
                            <p style="color: var(--text-light);">Thank you for your interest. We have received your application and will be in touch if you are selected for an interview.</p>
                            <p style="margin-top: 20px; font-weight: 600; color: var(--text-medium);">You may now safely close this browser tab.</p>
                        </div>
                    `;
                }
            } catch (error) {
                showModalMessage(`Error submitting application: ${error.message}`, true);
                console.error('Error submitting application:', error);
            }
        });
    }

    // --- Initial Page Load Actions ---
    loadJobDetails(); // Load job details when the page loads
}
