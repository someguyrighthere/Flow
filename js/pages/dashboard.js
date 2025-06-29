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
        newHirePositionSelect.innerHTML = '<option value="">Loading positions...</option>'; 
        try {
            const jobPostings = await apiRequest('GET', '/job-postings');
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

    // --- Utility to generate a random temporary password ---
    function generateTemporaryPassword(length = 8) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
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

            const selectedJobPostingId = newHirePositionSelect.value;
            const selectedJobPostingTitle = newHirePositionSelect.options[newHirePositionSelect.selectedIndex].text;

            const newEmployeeData = {
                full_name: document.getElementById('new-hire-name').value.trim(),
                email: document.getElementById('new-hire-email').value.trim(),
                // Generate a temporary password since hiring is outside the app
                password: generateTemporaryPassword(), 
                // Position is the title of the selected job posting
                position: selectedJobPostingTitle, 
                employee_id: document.getElementById('new-hire-id').value.trim(), 
                // location_id is required by invite-employee. For now, assume a default or select first available.
                // In a real app, you'd have a dropdown for location on this form.
                // For this implementation, we'll try to find a location_id from job postings or default to null.
                location_id: null, // Default to null, as it's not on dashboard form. Server might require it.
            };

            // Get location_id from the selected job posting if available
            // This is a workaround if location_id is not a direct input on the form.
            const selectedJobPosting = await apiRequest('GET', `/job-postings`);
            const matchedJobPosting = selectedJobPosting.find(job => job.id == selectedJobPostingId);
            if (matchedJobPosting) {
                newEmployeeData.location_id = matchedJobPosting.location_id;
            }


            // Basic validation
            if (!newEmployeeData.full_name || !newEmployeeData.email || !newEmployeeData.position || !newEmployeeData.location_id) {
                displayStatusMessage(onboardModalStatusMessage, 'Please fill all required fields: Full Name, Email, Position, and ensure a valid Location is associated with the selected position.', true);
                return;
            }
            if (!newEmployeeData.location_id) {
                 displayStatusMessage(onboardModalStatusMessage, 'Selected position does not have an associated location. Please select a position with a valid location or contact admin.', true);
                 return;
            }


            try {
                // Submit to the /invite-employee route, as hiring is done outside the app
                const response = await apiRequest('POST', '/invite-employee', newEmployeeData); 

                displayStatusMessage(onboardModalStatusMessage, `Employee onboarded successfully! Temporary Password: <span style="color: var(--primary-accent); font-weight: bold;">${response.tempPassword}</span>. Please provide this to the new employee.`, false);
                onboardUserForm.reset(); 
                // Keep modal open to show password, user can close manually.
                loadDashboardData(); 

            } catch (error) {
                displayStatusMessage(onboardModalStatusMessage, `Error onboarding employee: ${error.message}`, true);
                console.error('Error onboarding employee:', error);
            }
        });
    }

    // Navigation for Job Postings/Applicants - assuming these links navigate to separate pages
    if (viewJobPostingsBtn) {
        viewJobPostingsBtn.addEventListener('click', () => {
            window.location.href = 'hiring.html'; 
        });
    }

    if (viewApplicantsBtn) {
        viewApplicantsBtn.addEventListener('click', () => {
            // Placeholder: functionality for viewing applicants is not yet implemented.
            showModalMessage('Viewing applicants functionality is not yet fully implemented.', false);
        });
    }


    // --- Initial Page Load ---
    loadDashboardData(); // Load dashboard data when the page loads
    // loadJobPostingsForOnboard() is called when the modal is shown
}
