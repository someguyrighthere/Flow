// js/pages/suiteHub.js
import { apiRequest } from '../utils.js';

/**
 * Handles all logic for the Suite Hub page.
 */
export async function handleSuiteHubPage() {
    const greetingContainer = document.getElementById('greeting-container');
    const sendMessageForm = document.getElementById('send-message-form');
    const employeeSelect = document.getElementById('message-employee-select');
    const messageContent = document.getElementById('message-content');
    const messageStatus = document.getElementById('send-message-status');

    if (!greetingContainer) {
        console.error("Greeting container not found on page.");
        return;
    }

    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }

    async function loadEmployeesForMessaging() {
        if (!employeeSelect) return;
        try {
            // This is the call that is failing with a 404
            const users = await apiRequest('GET', '/api/users');
            employeeSelect.innerHTML = '<option value="">Select an employee...</option>';
            users.filter(u => u.role === 'employee').forEach(user => {
                const option = new Option(user.full_name, user.user_id);
                employeeSelect.add(option);
            });
        } catch (error) {
            console.error("Failed to load employees for messaging:", error);
            // The error modal is shown by the apiRequest utility function
        }
    }

    if (sendMessageForm) {
        sendMessageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const recipientId = employeeSelect.value;
            const content = messageContent.value.trim();

            if (!recipientId || !content) {
                messageStatus.textContent = 'Please select an employee and write a message.';
                messageStatus.style.color = '#ff8a80';
                return;
            }

            try {
                await apiRequest('POST', '/api/messages', {
                    recipient_id: recipientId,
                    content: content
                });
                messageStatus.textContent = 'Message sent successfully!';
                messageStatus.style.color = 'var(--primary-accent)';
                sendMessageForm.reset();
            } catch (error) {
                messageStatus.textContent = `Error: ${error.message}`;
                messageStatus.style.color = '#ff8a80';
            }
        });
    }

    try {
        const user = await apiRequest('GET', '/api/users/me');
        const userName = user && user.full_name ? user.full_name.split(' ')[0] : 'there';
        greetingContainer.textContent = `${getGreeting()}, ${userName}. We are going to do great things today.`;
    } catch (error) {
        console.error("Failed to fetch user for greeting:", error);
        greetingContainer.textContent = `${getGreeting()}! Welcome back. We are going to do great things today.`;
    }

    loadEmployeesForMessaging();
}
