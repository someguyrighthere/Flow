// js/pages/hiring.js
import { apiRequest, showModalMessage } from '../utils.js';

export function handleHiringPage() {
    // Security check: Redirect if not logged in
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // --- DOM Elements ---
    const onboardEmployeeForm = document.getElementById('onboard-employee-form');
    const positionSelect = document.getElementById('employee-position-select'); // Assuming this is the ID of your position select
    const onboardStatusMessage = document.getElementById('onboard-status-message'); // Assuming you have a status message element on this page

    // --- Helper function for local status messages (similar to admin.js) ---
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
     * Loads job postings and populates the position dropdown.
     */
    async function loadJobPostings() {
        if (!positionSelect) return;
        positionSelect.innerHTML = '<option value="">Loading positions...</option>';
        try {
            const jobPostings = await apiRequest('GET', '/job-postings');
            positionSelect.innerHTML = '<option value="">Select Position</option>'; // Default option

            if (jobPostings && jobPostings.length > 0) {
                jobPostings.forEach(post => {
                    const option = new Option(post.title, post.id); // Use post.id as value
                    positionSelect.add(option);
                });
            } else {
                positionSelect.innerHTML = '<option value="">No positions available</option>';
            }
        } catch (error) {
            console.error('Error loading job postings:', error);
            positionSelect.innerHTML = '<option value="">Error loading positions</option>';
            displayStatusMessage(onboardStatusMessage, `Error loading positions: ${error.message}`, true);
        }
    }

    // --- Event Listeners ---

    if (onboardEmployeeForm) {
        onboardEmployeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Assuming this form submits new employee data for onboarding
            const employeeData = {
                full_name: document.getElementById('onboard-full-name').value.trim(),
                email: document.getElementById('onboard-email').value.trim(),
                // Assuming positionSelect.value is the job_posting_id
                position_id: positionSelect.value, 
                employee_id: document.getElementById('onboard-employee-id').value.trim(),
                // Add other fields as per your form structure (phone, address, etc.)
            };

            // Basic validation
            if (!employeeData.full_name || !employeeData.email || !employeeData.position_id) {
                displayStatusMessage(onboardStatusMessage, 'Please fill all required fields.', true);
                return;
            }

            try {
                // This would be the route to onboard a new employee, potentially a different one than 'invite-employee'
                // For now, let's assume it attempts to add an employee to a position
                // You might need a new backend route for this.
                // For demonstration, let's use a placeholder.
                displayStatusMessage(onboardStatusMessage, 'Employee onboarding functionality temporarily disabled. Please contact support.', true);

                // Example of what a real API call might look like:
                // await apiRequest('POST', '/employees/onboard', employeeData);
                // displayStatusMessage(onboardStatusMessage, 'Employee onboarded successfully!', false);
                // onboardEmployeeForm.reset();
            } catch (error) {
                displayStatusMessage(onboardStatusMessage, `Error onboarding employee: ${error.message}`, true);
                console.error('Error onboarding employee:', error);
            }
        });
    }

    // --- Initial Page Load ---
    loadJobPostings(); // Load positions when the page loads
}
