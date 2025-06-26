// js/pages/admin.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

export function handleAdminPage() {
    const businessSettingsForm = document.getElementById('business-settings-form');
    // ... (other element selections)

    async function loadBusinessSettings() {
        if (!businessSettingsForm) return;
        try {
            const settings = await apiRequest('GET', '/settings/business');
            document.getElementById('operating-hours-start').value = settings.operating_hours_start || '09:00';
            document.getElementById('operating-hours-end').value = settings.operating_hours_end || '17:00';
        } catch (error) {
            showModalMessage('Could not load business settings.', true);
        }
    }

    // ... (other functions)

    if (businessSettingsForm) {
        businessSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const settingsData = {
                operating_hours_start: document.getElementById('operating-hours-start').value,
                operating_hours_end: document.getElementById('operating-hours-end').value,
            };
            try {
                await apiRequest('POST', '/settings/business', settingsData);
                showModalMessage('Business settings saved!', false);
            } catch (error) {
                showModalMessage(`Error saving settings: ${error.message}`, true);
            }
        });
    }
    
    // ... (other event listeners)

    // Initial page load
    loadBusinessSettings();
    generateAvailabilityInputs();
    loadLocations();
    loadUsers();
}
