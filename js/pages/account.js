// js/pages/account.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles all logic for the account page.
 */
export function handleAccountPage() {
    // Security check: Redirect to login page if no authentication token is found in local storage
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // Get elements from the DOM
    const displaySubscriptionPlan = document.getElementById('display-subscription-plan');
    const updateProfileForm = document.getElementById('update-profile-form');
    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');

    /**
     * Fetches the current user's profile data and populates the form and display elements.
     */
    async function loadProfile() {
        // Set loading text while fetching
        if (profileNameInput) profileNameInput.value = 'Loading...';
        if (profileEmailInput) profileEmailInput.value = 'Loading...';

        try {
            // Assumes an API endpoint like '/users/me' to get the current user's data
            const user = await apiRequest('GET', '/api/users/me'); 
            if (user) {
                if (profileNameInput) profileNameInput.value = user.full_name;
                if (profileEmailInput) profileEmailInput.value = user.email;
            }
        } catch (error) {
            showModalMessage(`Error loading profile: ${error.message}`, true);
            console.error('Error loading profile:', error);
            if (profileNameInput) profileNameInput.value = 'Error loading data';
            if (profileEmailInput) profileEmailInput.value = 'Error loading data';
        }
    }

    /**
     * Fetches and displays the user's subscription plan.
     */
    async function loadSubscriptionPlan() {
        if (!displaySubscriptionPlan) return;
        displaySubscriptionPlan.textContent = 'Loading...'; // Show loading state
        try {
            // Fetch subscription status from the backend
            const response = await apiRequest('GET', '/api/subscription-status');
            if (response && response.plan) {
                displaySubscriptionPlan.textContent = response.plan.toUpperCase(); // Display plan in uppercase
            } else {
                displaySubscriptionPlan.textContent = 'N/A';
            }
        } catch (error) {
            console.error('Error loading subscription plan:', error);
            displaySubscriptionPlan.textContent = 'Error';
            showModalMessage(`Error loading subscription plan: ${error.message}`, true);
        }
    }

    // Add event listener for the profile update form
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = profileNameInput.value.trim();
            const email = profileEmailInput.value.trim();
            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;

            const updateData = {
                full_name: fullName,
                email: email
            };

            // Only include password fields if the user has entered a new password.
            // The backend should require the current password for security.
            if (newPassword) {
                if (!currentPassword) {
                     showModalMessage('To change your password, you must provide your current password.', true);
                     return;
                }
                updateData.current_password = currentPassword;
                updateData.new_password = newPassword;
            }

            try {
                // Send PUT request to update the user's profile
                await apiRequest('PUT', '/api/users/me', updateData); 
                showModalMessage('Profile updated successfully!', false);
                
                // Clear password fields after successful submission
                if(currentPasswordInput) currentPasswordInput.value = '';
                if(newPasswordInput) newPasswordInput.value = '';

                // Reload profile to reflect updated info (e.g., if email changed)
                loadProfile(); 
            } catch (error) {
                showModalMessage(`Error updating profile: ${error.message}`, true);
                console.error('Error updating profile:', error);
            }
        });
    }

    // --- Handle Payment Redirect Status ---
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('payment')) {
        const paymentStatus = urlParams.get('payment');
        if (paymentStatus === 'success') {
            showModalMessage('Payment successful! Your plan has been updated.', false);
        } else if (paymentStatus === 'cancelled') {
            showModalMessage('Payment cancelled. You can try again at any time.', true);
        }
        // Clean the URL to remove the query parameters after displaying the message
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // --- Initial Page Load Actions ---
    loadProfile(); // Load user profile data when the page loads
    loadSubscriptionPlan(); // Load subscription plan when the page loads
}
