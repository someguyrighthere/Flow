// js/pages/apply.js
import { apiRequest, showModalMessage } from '../utils.js';

export function handleApplyPage() {
    const jobDetailsContainer = document.getElementById('job-details-container');
    const applyForm = document.getElementById('apply-form');
    const applyCard = document.getElementById('apply-card');
    
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('jobId');

    if (!jobId) {
        jobDetailsContainer.innerHTML = '<h2>Job Not Found</h2><p>No job ID was provided in the URL.</p>';
        return;
    }

    async function loadJobDetails() {
        try {
            const job = await apiRequest('GET', `/job-postings/${jobId}`);
            if (job) {
                document.title = `Apply for ${job.title} - Flow Business Suite`;
                const detailsEl = document.createElement('div');
                detailsEl.className = 'job-details';
                detailsEl.innerHTML = `
                    <h2>${job.title}</h2>
                    <p><strong>Location:</strong> ${job.location_name || 'Company Wide'}</p>
                    <p><strong>Description:</strong><br>${job.description.replace(/\n/g, '<br>')}</p>
                    ${job.requirements ? `<p><strong>Requirements:</strong><br>${job.requirements.replace(/\n/g, '<br>')}</p>` : ''}
                `;
                jobDetailsContainer.innerHTML = '';
                jobDetailsContainer.appendChild(detailsEl);
            } else {
                 jobDetailsContainer.innerHTML = '<h2>Job Not Found</h2><p>The job you are looking for does not exist.</p>';
            }
        } catch (error) {
            jobDetailsContainer.innerHTML = `<h2>Error</h2><p>Could not load job details. ${error.message}</p>`;
        }
    }

    if (applyForm) {
        applyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Collect data from the simplified form
            const applicationData = {
                name: document.getElementById('applicant-name').value,
                email: document.getElementById('applicant-email').value,
                address: document.getElementById('applicant-address').value,
                phone: document.getElementById('applicant-phone').value,
                date_of_birth: document.getElementById('applicant-dob').value,
                availability: document.getElementById('applicant-availability').value,
                is_authorized: document.getElementById('applicant-authorized').value === 'Yes',
            };

            try {
                await apiRequest('POST', `/apply/${jobId}`, applicationData);
                if(applyCard) {
                    applyCard.innerHTML = `
                        <div style="text-align: center;">
                            <h2>Application Submitted!</h2>
                            <p>Thank you for your interest. We have received your application and will be in touch if you are selected for an interview.</p>
                            <a href="index.html" class="btn btn-secondary">Return to Home</a>
                        </div>
                    `;
                }
            } catch (error) {
                showModalMessage(`Error submitting application: ${error.message}`, true);
            }
        });
    }

    loadJobDetails();
}
