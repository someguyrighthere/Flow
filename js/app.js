const API_BASE_URL = 'http://localhost:3000/api';

async function apiRequest(method, path, body = null) {
    const token = localStorage.getItem('authToken');
    const options = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Something went wrong');
    }
    if (response.status === 204 || (response.status === 200 && response.headers.get('content-length') === '0')) return null;
    return response.json();
}

document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname;
    if (page.includes('login.html')) {
        handleLoginPage();
    } else if (page.includes('suite-hub.html')) {
        handleSuiteHubPage();
    } else if (page.includes('account.html')) {
        handleAccountPage();
    } else if (page.includes('admin.html')) {
        handleAdminPage();
    }
    setupSettingsDropdown();
});

function handleLoginPage() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('error-message');
        try {
            const data = await apiRequest('POST', '/login', { email, password });
            localStorage.setItem('authToken', data.token);
            if (data.role === 'super_admin' || data.role === 'location_admin') {
                window.location.href = 'suite-hub.html';
            } else {
                window.location.href = 'new-hire-view.html';
            }
        } catch (error) {
            errorMessage.textContent = `Login Failed: ${error.message}`;
            errorMessage.style.display = 'block';
        }
    });
}

function handleSuiteHubPage() {
    if (!localStorage.getItem('authToken')) { window.location.href = 'login.html'; return; }
}

function handleAccountPage() {
    if (!localStorage.getItem('authToken')) { window.location.href = 'login.html'; return; }
}

function handleAdminPage() {
    if (!localStorage.getItem('authToken')) { window.location.href = 'login.html'; return; }
    
    const locationListDiv = document.getElementById('location-list');
    const newLocationForm = document.getElementById('new-location-form');

    async function loadLocations() {
        if (!locationListDiv) return;
        locationListDiv.innerHTML = '<p>Loading locations...</p>';
        try {
            const locations = await apiRequest('GET', '/locations');
            locationListDiv.innerHTML = '';
            if (locations.length === 0) {
                locationListDiv.innerHTML = '<p>No locations created yet.</p>';
            } else {
                locations.forEach(loc => {
                    const locDiv = document.createElement('div');
                    locDiv.className = 'location-item';
                    locDiv.textContent = loc.location_name;
                    locationListDiv.appendChild(locDiv);
                });
            }
        } catch (error) {
            locationListDiv.innerHTML = `<p style="color: #e74c3c;">Error loading locations.</p>`;
        }
    }

    if (newLocationForm) {
        newLocationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-location-name');
            const location_name = nameInput.value;
            try {
                await apiRequest('POST', '/locations', { location_name });
                nameInput.value = '';
                loadLocations();
            } catch (error) {
                alert(`Error creating location: ${error.message}`);
            }
        });
    }
    loadLocations();
}

function setupSettingsDropdown() {
    const settingsButton = document.getElementById('settings-button');
    const settingsDropdown = document.getElementById('settings-dropdown');
    const logoutButton = document.getElementById('logout-button');

    if (settingsButton) {
        settingsButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if(settingsDropdown) settingsDropdown.style.display = settingsDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        });
    }

    window.addEventListener('click', (event) => {
        if (settingsDropdown && settingsButton && !settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
            settingsDropdown.style.display = 'none';
        }
    });
}
