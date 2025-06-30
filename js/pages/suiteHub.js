// js/pages/suiteHub.js
import { apiRequest } from '../utils.js';

export async function handleSuiteHubPage() {
    const greetingContainer = document.getElementById('greeting-container');
    if (!greetingContainer) {
        console.error("Greeting container not found on page.");
        return;
    }

    // Function to get the time of day greeting
    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) {
            return "Good morning";
        } else if (hour < 18) {
            return "Good afternoon";
        } else {
            return "Good evening";
        }
    }

    try {
        // Fetch the current user's data to get their name
        const user = await apiRequest('GET', '/api/users/me');
        // Use only the first name for a more personal greeting
        const userName = user && user.full_name ? user.full_name.split(' ')[0] : 'there';
        
        const greeting = getGreeting();
        
        // UPDATED: Added the new sentence to the greeting.
        greetingContainer.textContent = `${greeting}, ${userName}. We are going to do great things today.`;

    } catch (error) {
        // This catch block will run if the apiRequest fails for any reason.
        console.error("Failed to fetch user for greeting:", error);
        // Display a generic greeting as a fallback, also with the new sentence.
        greetingContainer.textContent = `${getGreeting()}! Welcome back. We are going to do great things today.`;
    }
}
