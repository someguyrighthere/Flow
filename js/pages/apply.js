// js/pages/apply.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles all logic for the job application page.
 */
export function handleApplyPage() {
    const jobDetailsContainer = document.getElementById('job-details-container');
    const applyForm = document.getElementById('apply-form');
    const applyCard = document.getElementById('apply-card');

    // Debugging logs to confirm elements are found
    console.log("[apply.js] Elements found:", { jobDetailsContainer, applyForm, applyCard });
    
    // Get the jobId from the URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('jobId');

    // If no jobId is provided in the URL, display an error and exit
    if (!jobId) {
        if (jobDetailsContainer) {
            jobDetailsContainer.innerHTML = '<h2>Job Not Found</h2><p>No job ID was provided in the URL.</p>';
        } else if (applyCard) { // Fallback if jobDetailsContainer is not found
            applyCard.innerHTML = '<h2>Job Not Found</h2><p>No job ID was provided in the URL.</p>';
        }
        console.error("[apply.js] No jobId found in URL.");
        return;
    }

    /**
     * Loads job details from the API based on the jobId and displays them.
     */
    async function loadJobDetails() {
        if (!jobDetailsContainer) {
            console.error("[apply.js] jobDetailsContainer not found. Cannot load job details.");
            // If jobDetailsContainer is missing, display error in applyCard or as modal
            if (applyCard) {
                applyCard.innerHTML = '<h2>Error</h2><p>Page structure missing. Please contact support.</p>';
            } else {
                showModalMessage('Page structure missing. Please contact support.', true);
            }
            return;
        }

        jobDetailsContainer.innerHTML = '<p style="color: var(--text-medium);">Loading job details...</p>'; // Show loading state
        try {
            // Fetch job posting details from the public endpoint
            // FIX: Change the API path to match the public route in server.js
            const job = await apiRequest('GET', `/apply/${jobId}`); // <--- CORRECTED LINE
            
            if (job) {
                document.title = `Apply for ${job.title} - Flow Business Suite`; // Update page title
                
                // Construct job details HTML
                const detailsHtml = `
                    <h2>${job.title}</h2>
                    <p><strong>Location:</strong> ${job.location_name || 'Company Wide'}</p>
                    <p><strong>Description:</strong><br>${job.description ? job.description.replace(/\n/g, '<br>') : 'N/A'}</p>
                    ${job.requirements ? `<p><strong>Requirements:</strong><br>${job.requirements.replace(/\n/g, '<br>')}</p>` : ''}
                `;
                jobDetailsContainer.innerHTML = detailsHtml; // Display job details

                // After successfully loading job details, show the application form
                if (applyForm) {
                    applyForm.style.display = 'block'; // Make the form visible
                    console.log("[apply.js] Application form set to display: block.");
                } else {
                    console.warn("[apply.js] applyForm element not found, cannot make it visible.");
                }
            } else {
                 jobDetailsContainer.innerHTML = '<h2>Job Not Found</h2><p>The job you are looking for does not exist.</p>';
                 console.warn("[apply.js] Job not found for ID:", jobId);
                 // If job not found, ensure form remains hidden
                 if (applyForm) {
                     applyForm.style.display = 'none';
                 }
            }
        } catch (error) {
            jobDetailsContainer.innerHTML = `<h2>Error</h2><p>Could not load job details. ${error.message}</p>`;
            console.error('Error loading job details:', error);
            // On error, ensure form remains hidden
            if (applyForm) {
                applyForm.style.display = 'none';
            }
        }
    }

    // Event listener for the application form submission
    // This listener is now attached only if applyForm is found at script initialization
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
    } else {
        console.error("[apply.js] Application form element (id='apply-form') not found. Submission listener not attached.");
    }

    // --- Initial Page Load Actions ---
    loadJobDetails(); // Load job details when the page loads
}
