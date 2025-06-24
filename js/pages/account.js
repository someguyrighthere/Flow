// js/pages/account.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles all logic for the account page.
 */
export function handleAccountPage() {
    // Security check: Redirect if not logged in
    if (!localStorage.getItem("authToken")) {
        window.location.href = "login.html";
        return;
    }

    // Get elements from the DOM
    const updateProfileForm = document.getElementById('update-profile-form');
    const displayName = document.getElementById('display-profile-name');
    const displayEmail = document.getElementById('display-profile-email');
    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');

    /**
     * Fetches the current user's profile data and populates the form and display elements.
     */
    async function loadProfile() {
        // Set loading text while fetching
        if (displayName) displayName.textContent = 'Loading...';
        if (displayEmail) displayEmail.textContent = 'Loading...';

        try {
            // Assumes an API endpoint like '/users/me' to get the current user's data
            const user = await apiRequest('GET', '/users/me'); 
            if (user) {
                if (displayName) displayName.textContent = user.full_name;
                if (displayEmail) displayEmail.textContent = user.email;
                if (profileNameInput) profileNameInput.value = user.full_name;
                if (profileEmailInput) profileEmailInput.value = user.email;
            }
        } catch (error) {
            showModalMessage(`Error loading profile: ${error.message}`, true);
            if (displayName) displayName.textContent = 'Error';
            if (displayEmail) displayEmail.textContent = 'Error';
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
                // Assumes a PUT request to update the user's profile
                await apiRequest('PUT', '/users/me', updateData); 
                showModalMessage('Profile updated successfully!', false);
                
                // Clear password fields after successful submission
                if(currentPasswordInput) currentPasswordInput.value = '';
                if(newPasswordInput) newPasswordInput.value = '';

                // Reload profile to reflect updated info
                loadProfile(); 
            } catch (error) {
                showModalMessage(`Error updating profile: ${error.message}`, true);
            }
        });
    }

    // Initial call to load the profile data when the page loads
    loadProfile();
}
