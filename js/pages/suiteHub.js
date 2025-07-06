// js/pages/suiteHub.js
import { apiRequest, showModalMessage } from '../utils.js';

/**
 * Handles all logic for the Suite Hub page.
 */
export async function handleSuiteHubPage() {
    const greetingContainer = document.getElementById('greeting-container');
    const sendMessageForm = document.getElementById('send-message-form');
    const messageEmployeeSelect = document.getElementById('message-employee-select');
    const messageContent = document.getElementById('message-content');
    const sendMessageStatus = document.getElementById('send-message-status');

    // Fetch user info for greeting and role check
    const fetchUserInfo = async () => {
        try {
            const user = await apiRequest('GET', '/api/users/me');
            if (greetingContainer) {
                greetingContainer.innerHTML = `<h2 style="color: var(--primary-accent);">Welcome, ${user.full_name}!</h2>`;
            }

            // Only populate employee list for admins
            if (user.role === 'super_admin' || user.role === 'location_admin') {
                await populateEmployeeSelect(user.location_id);
            } else {
                // Hide the message form for regular employees, or show a message
                if (sendMessageForm) {
                    sendMessageForm.style.display = 'none';
                    const messageContainer = sendMessageForm.parentElement;
                    messageContainer.innerHTML = '<h3>Messaging</h3><p style="color: var(--text-medium);">Messaging is available for admin users.</p>';
                }
            }
        } catch (error) {
            console.error('Error fetching user info for Suite Hub:', error);
            showModalMessage('Failed to load user information.', true);
        }
    };

    // Populate employee dropdown
    const populateEmployeeSelect = async (adminLocationId) => {
        try {
            const users = await apiRequest('GET', '/api/users');
            messageEmployeeSelect.innerHTML = '<option value="">Select an employee</option>'; // Clear existing options

            // Filter users based on admin's location if location_admin
            const filteredUsers = users.filter(user => 
                user.role === 'employee' || 
                (user.role === 'location_admin' && String(user.user_id) !== String(localStorage.getItem('userId')))
            ).filter(user => {
                if (localStorage.getItem('userRole') === 'location_admin') {
                    return String(user.location_id) === String(adminLocationId);
                }
                return true; // Super admin sees all
            });


            filteredUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.user_id;
                option.textContent = `${user.full_name} (${user.role === 'employee' ? user.position || 'Employee' : 'Admin'})`;
                messageEmployeeSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating employee select:', error);
            showModalMessage('Failed to load employee list.', true);
        }
    };

    // Handle message form submission
    if (sendMessageForm) {
        sendMessageForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            sendMessageStatus.textContent = 'Sending message...';
            sendMessageStatus.style.color = 'var(--text-medium)';

            const recipientId = messageEmployeeSelect.value;
            const content = messageContent.value.trim();

            if (!recipientId) {
                sendMessageStatus.textContent = 'Please select a recipient.';
                sendMessageStatus.style.color = '#ff8a80';
                return;
            }
            if (!content) {
                sendMessageStatus.textContent = 'Message content cannot be empty.';
                sendMessageStatus.style.color = '#ff8a80';
                return;
            }

            try {
                await apiRequest('POST', '/api/messages', { recipient_id: recipientId, content });
                sendMessageStatus.textContent = 'Message sent successfully!';
                sendMessageStatus.style.color = 'var(--primary-accent)';
                messageContent.value = ''; // Clear message input
                messageEmployeeSelect.value = ''; // Reset select

            } catch (error) {
                console.error('Error sending message:', error);
                sendMessageStatus.textContent = `Error sending message: ${error.message}`;
                sendMessageStatus.style.color = '#ff8a80';
            }
        });
    }

    // Initial data fetch
    fetchUserInfo();
}
