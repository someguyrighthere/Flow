// js/pages/suiteHub.js
import { apiRequest } from '../utils.js';

/**
 * Handles all logic for the Suite Hub page.
 */
export async function handleSuiteHubPage() {
    const greetingContainer = document.getElementById('greeting-container');

    // If greeting container is not found, log an error and exit
    if (!greetingContainer) {
        console.error("Greeting container not found on page.");
        return;
    }

    // Function to get the time of day greeting (Good morning, Good afternoon, Good evening)
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
        // Fetch the current user's data to get their name from the backend API
        const user = await apiRequest('GET', '/api/users/me');
        
        // Use only the first name for a more personal greeting, default to 'there' if not found
        const userName = user && user.full_name ? user.full_name.split(' ')[0] : 'there';
        
        const greeting = getGreeting(); // Get the time-based greeting
        
        // Update the greeting container with the personalized message
        greetingContainer.textContent = `${greeting}, ${userName}. We are going to do great things today.`;

    } catch (error) {
        // This catch block will run if the apiRequest fails for any reason (e.g., network error, token expired).
        console.error("Failed to fetch user for greeting:", error);
        // Display a generic greeting as a fallback if user data cannot be fetched
        greetingContainer.textContent = `${getGreeting()}! Welcome back. We are going to do great things today.`;
    }
}
