// js/pages/dashboard.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the dashboard page.
 */
export function handleDashboardPage() {
    // Redirect to login page if no authentication token is found in local storage
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Elements ---
    const onboardUserModal = document.getElementById('onboard-user-modal');
    const showOnboardModalBtn = document.getElementById('show-onboard-modal');
    const modalCancelOnboardBtn = document.getElementById('modal-cancel-onboard');
    const onboardUserForm = document.getElementById('onboard-user-form');
    // FIX: Corrected ID to match dashboard.html's <select id="new-hire-position">
    const newHirePositionSelect = document.getElementById('new-hire-position'); 
    const onboardModalStatusMessage = document.getElementById('onboard-modal-status-message'); // For messages within the modal

    const pendingOnboardsCount = document.getElementById('pending-onboards-count');
    const inProgressCount = document.getElementById('in-progress-count');
    const completedCount = document.getElementById('completed-count');
    const activityList = document.getElementById('activity-list');
    const activityFeedPlaceholder = document.getElementById('activity-feed-placeholder');
    const viewJobPostingsBtn = document.getElementById('view-job-postings-btn');
    const viewApplicantsBtn = document.getElementById('view-applicants-btn');

    // --- Helper function for local status messages (within modal) ---
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

    // --- Data Loading Functions ---

    /**
     * Loads job postings and populates the position dropdown in the onboard modal.
     */
    async function loadJobPostingsForOnboard() {
        if (!newHirePositionSelect) {
            console.error('Error: new-hire-position select element not found.');
            return;
        }
        // Clear all existing options first, and add a loading message
        newHirePositionSelect.innerHTML = '<option value="">Loading positions...</option>'; 
        try {
            const jobPostings = await apiRequest('GET', '/job-postings');
            // After loading, clear 'Loading positions...' and add 'Select Position'
            newHirePositionSelect.innerHTML = '<option value="">Select Position</option>'; 

            if (jobPostings && jobPostings.length > 0) {
                jobPostings.forEach(post => {
                    const option = new Option(post.title, post.id); // Use post.id as value
                    newHirePositionSelect.add(option);
                });
            } else {
                newHirePositionSelect.innerHTML = '<option value="">No positions available</option>';
            }
        } catch (error) {
            console.error('Error loading job postings for onboard modal:', error);
            newHirePositionSelect.innerHTML = '<option value="">Error loading positions</option>';
            displayStatusMessage(onboardModalStatusMessage, `Error loading positions: ${error.message}`, true);
        }
    }

    /**
     * Loads and displays dashboard metrics and recent activity.
     */
    async function loadDashboardData() {
        // Placeholder for fetching actual dashboard stats
        // try {
        //     const stats = await apiRequest('GET', '/dashboard/stats');
        //     pendingOnboardsCount.textContent = stats.pending;
        //     inProgressCount.textContent = stats.inProgress;
        //     completedCount.textContent = stats.completed;
        //
        //     const activity = await apiRequest('GET', '/dashboard/activity');
        //     if (activity && activity.length > 0) {
        //         activityList.innerHTML = ''; // Clear placeholder
        //         activity.forEach(item => {
        //             const li = document.createElement('li');
        //             li.textContent = `${item.timestamp}: ${item.description}`;
        //             activityList.appendChild(li);
        //         });
        //     } else {
        //         activityFeedPlaceholder.style.display = 'block';
        //     }
        // } catch (error) {
        //     console.error('Error loading dashboard data:', error);
        //     showModalMessage('Failed to load dashboard data. Please try again.', true); // Use global modal for dashboard
        // }
    }


    // --- Event Listeners ---

    // Show onboard employee modal
    if (showOnboardModalBtn) {
        showOnboardModalBtn.addEventListener('click', () => {
            if (onboardUserModal) {
                onboardUserModal.style.display = 'flex';
                loadJobPostingsForOnboard(); // Load positions when modal is shown
            }
        });
    }

    // Cancel onboard employee modal
    if (modalCancelOnboardBtn) {
        modalCancelOnboardBtn.addEventListener('click', () => {
            if (onboardUserModal) {
                onboardUserModal.style.display = 'none';
                onboardUserForm.reset(); // Clear form on cancel
                displayStatusMessage(onboardModalStatusMessage, '', false); // Clear any messages
            }
        });
    }

    // Submit onboard employee form
    if (onboardUserForm) {
        onboardUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newEmployeeData = {
                full_name: document.getElementById('new-hire-name').value.trim(),
                email: document.getElementById('new-hire-email').value.trim(),
                // job_posting_id is the value from the selected position
                job_posting_id: newHirePositionSelect.value, 
                // Assuming new-hire-id is the employee_id as per the HTML
                employee_id: document.getElementById('new-hire-id').value.trim(), 
                // Add other potential fields from the form if applicable (e.g., phone, address, etc.)
                // phone: document.getElementById('new-hire-phone').value.trim(),
            };

            if (!newEmployeeData.full_name || !newEmployeeData.email || !newEmployeeData.job_posting_id) {
                displayStatusMessage(onboardModalStatusMessage, 'Please fill all required fields: Full Name, Email, and Position.', true);
                return;
            }

            try {
                // This route should point to your backend's applicant submission endpoint
                // Assuming applicants POST route does not require authentication (public form)
                await apiRequest('POST', '/applicants', newEmployeeData); // Use /applicants route

                displayStatusMessage(onboardModalStatusMessage, 'Application submitted successfully! Your application will be reviewed shortly.', false);
                onboardUserForm.reset(); // Clear the form
                if (onboardUserModal) {
                    // You might want to automatically close the modal after success or leave it open
                    // onboardUserModal.style.display = 'none';
                }
                loadDashboardData(); // Reload dashboard data to reflect new applicant if applicable

            } catch (error) {
                displayStatusMessage(onboardModalStatusMessage, `Error submitting application: ${error.message}`, true);
                console.error('Error submitting application:', error);
            }
        });
    }

    // Navigation for Job Postings/Applicants - assuming these links navigate to separate pages
    if (viewJobPostingsBtn) {
        viewJobPostingsBtn.addEventListener('click', () => {
            window.location.href = 'hiring.html'; // Assuming hiring.html shows job postings
        });
    }

    if (viewApplicantsBtn) {
        viewApplicantsBtn.addEventListener('click', () => {
            // Assuming apply.html (or another page) shows applicants.
            // Or you might have a dedicated admin page for viewing applicants.
            // For now, redirect to a placeholder.
            showModalMessage('Viewing applicants functionality is not yet fully implemented.', false);
        });
    }


    // --- Initial Page Load ---
    loadDashboardData(); // Load dashboard data when the page loads
    // loadJobPostingsForOnboard(); // This is now called when the modal is shown
}
