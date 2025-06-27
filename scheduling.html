<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scheduling - Flow Business Suite</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/Theme.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Fredoka+One&display=swap" rel="stylesheet">
    <style>
        .container { z-index: 2; padding: 20px 5%; box-sizing: border-box; }
        .main-nav { display: flex; gap: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 30px; }
        .main-nav a { padding: 10px 15px; text-decoration: none; color: var(--text-medium); font-weight: 600; border-bottom: 3px solid transparent; }
        .main-nav a.active { color: var(--text-light); border-bottom-color: var(--primary-accent); }
        .settings-menu { position: relative; }
        .settings-dropdown {
            display: none; position: absolute; top: 55px; right: 0;
            background-color: rgba(26, 26, 26, 0.9); backdrop-filter: blur(10px);
            border: 1px solid var(--border-color); border-radius: 8px;
            min-width: 180px; box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
            z-index: 10; padding: 10px 0;
        }
        .settings-dropdown a, .settings-dropdown button {
            color: var(--text-light); padding: 12px 16px; text-decoration: none;
            display: block; width: 100%; text-align: left; background: none;
            border: none; font-family: 'Poppins', sans-serif; font-size: 1rem; cursor: pointer;
        }
        .settings-dropdown a:hover, .settings-dropdown button:hover { background-color: rgba(255,255,255,0.1); }
        
        .scheduling-layout {
            display: grid;
            grid-template-columns: 320px 1fr;
            gap: 30px;
            margin-top: 30px;
        }
        @media (max-width: 1200px) {
            .scheduling-layout {
                grid-template-columns: 1fr;
            }
        }

        .sidebar {
            background-color: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.15); padding: 25px; border-radius: 8px;
        }
        .sidebar h3 {
            margin-top: 0;
            color: var(--text-light);
            font-size: 1.3rem;
            margin-bottom: 20px;
        }
        .sidebar .form-group {
            margin-bottom: 15px;
        }

        .calendar-main {
            background-color: rgba(255, 255, 255, 0.15);
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column; /* Changed to column to stack header and body */
            overflow: hidden; /* Important for internal scrolling */
        }
        .calendar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            color: var(--text-light);
            flex-shrink: 0;
        }
        
        /* --- UPDATED CALENDAR LAYOUT CSS --- */
        .calendar-grid-container {
            flex-grow: 1; /* Allows the container to fill available space */
            overflow: hidden; /* Contains internal scrolling */
            display: flex; /* Use flex to manage inner grid content */
            flex-direction: column; /* Stack the header and body */
        }

        .calendar-grid {
            /* Removed grid properties from here, now a flex container for header and body */
            display: flex;
            flex-direction: column;
            width: 100%; /* Ensure it takes full width */
            min-width: 1500px; /* Keep min-width for calendar content */
            height: 100%; /* Ensure it fills parent height */
        }

        .calendar-grid-header { /* This class is now used by JS for the header row */
            display: grid;
            grid-template-columns: 80px repeat(7, minmax(200px, 1fr)); /* Define 8 columns */
            position: sticky;
            top: 0;
            z-index: 6;
            background-color: #1a1a1a;
            border-bottom: 1px solid var(--border-color); /* Add border for separation */
        }

        .calendar-body { /* New wrapper for time column and day columns */
            display: grid;
            grid-template-columns: 80px repeat(7, minmax(200px, 1fr)); /* Define 8 columns */
            flex-grow: 1; /* Allows the body to take remaining vertical space */
            overflow: auto; /* Enables scrolling for the main calendar content */
            position: relative; /* For absolute positioning of shifts/availability */
        }

        .calendar-day-header {
            padding: 10px 0;
            text-align: center;
            font-weight: 600;
            color: var(--text-light);
            border-right: 1px solid rgba(255, 255, 255, 0.1);
        }
        /* No border-bottom here, as it's on .calendar-grid-header now */
        .calendar-day-header:last-child {
            border-right: none; /* Remove right border for the last header */
        }
        
        .time-column {
            position: sticky;
            left: 0;
            z-index: 5;
            background-color: #2a2a2e;
            /* Ensure it spans the full height of the body content */
            grid-column: 1; /* Explicitly place in the first column */
            height: 100%; /* Span full height of its grid cell */
            display: flex;
            flex-direction: column;
        }
        .time-slot {
            height: 60px; /* Fixed height for each hour slot */
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            color: var(--text-medium);
            flex-shrink: 0; /* Prevent shrinking */
        }
        .time-slot:last-child {
            border-bottom: none; /* Remove border from the last time slot */
        }

        .day-column {
            position: relative;
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            /* Day columns will automatically be placed in grid-column 2 to 8 */
            height: 1440px; /* 24 hours * 60 minutes/hour * 1px/minute = 1440px. This makes the column tall enough for absolute positioning */
            min-height: 100%; /* Ensure it expands to at least the grid height */
        }
        .day-column:last-child {
            border-right: none; /* Remove right border for the last day column */
        }

        .calendar-shift {
            background-color: var(--primary-accent);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 4px;
            padding: 5px 8px;
            font-size: 0.85rem;
            position: absolute;
            width: calc(100% - 4px); /* Full width minus padding/border */
            left: 2px;
            opacity: 0.9;
            z-index: 3;
            cursor: pointer;
            overflow: hidden;
            box-sizing: border-box;
        }
        .delete-shift-btn {
            position: absolute; top: 2px; right: 2px;
            background: rgba(0,0,0,0.3); border: none;
            color: white; cursor: pointer; opacity: 0;
            transition: opacity 0.2s; padding: 2px; border-radius: 50%;
            width: 18px; height: 18px; display: flex;
            align-items: center; justify-content: center;
        }
        .calendar-shift:hover .delete-shift-btn { opacity: 1; }
        .delete-shift-btn:hover { background: #e74c3c; }

        .availability-block {
            background-color: rgba(76, 175, 80, 0.2);
            position: absolute;
            width: 100%;
            z-index: 1;
            pointer-events: none; /* Allows clicks to pass through to elements below */
            box-sizing: border-box;
        }
        .availability-block.hidden { display: none; }

        /* --- Business Hours Background Block (Glass Effect) --- */
        .business-hours-block {
            background-color: rgba(100, 100, 100, 0.5); /* Changed opacity to 0.5 (50%) */
            backdrop-filter: blur(3px); /* Add blur for glass effect */
            -webkit-backdrop-filter: blur(3px); /* Safari support */
            border: 1px solid rgba(255, 255, 255, 0.1); /* Subtle white border */
            position: absolute;
            width: 100%;
            z-index: 0; /* Place behind availability and shifts */
            pointer-events: none; /* Ensure clicks pass through */
            box-sizing: border-box;
            border-radius: 4px; /* Match other blocks */
        }


        /* --- CORRECTED Modal Styles to ensure pop-up behavior --- */
        .modal {
            /* Keep hidden by default; JS will set display to 'flex' */
            display: none; 
            position: fixed; /* Fixes it relative to the viewport */
            z-index: 1000; /* High z-index to appear on top of other content */
            left: 0;
            top: 0;
            width: 100%; /* Full width of viewport */
            height: 100%; /* Full height of viewport */
            overflow: auto; /* Enable scroll if modal content exceeds viewport */
            background-color: rgba(0,0,0,0.6); /* Semi-transparent black background overlay */
            /* Flexbox properties to center the modal-content */
            align-items: center; /* Vertically center */
            justify-content: center; /* Horizontally center */
        }

        .modal-content {
            background-color: var(--card-bg); /* Use your theme's background color */
            padding: 20px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            width: 80%; /* Responsive width */
            max-width: 500px; /* Maximum width for larger screens */
            box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2), 0 6px 20px 0 rgba(0,0,0,0.19);
            position: relative; /* Needed for close button positioning */
            color: var(--text-light); /* Text color */
            animation: fadeIn 0.3s ease-out; /* Simple fade-in animation */
        }

        .modal-content p {
            margin-bottom: 20px;
            text-align: center;
            font-size: 1.1rem;
        }

        .modal-actions {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
        }

        .close-button {
            color: var(--text-medium);
            font-size: 28px;
            font-weight: bold;
            position: absolute;
            top: 10px;
            right: 15px;
            cursor: pointer;
        }

        .close-button:hover,
        .close-button:focus {
            color: var(--text-light);
            text-decoration: none;
            cursor: pointer;
        }

        /* Keyframe animation for modal fade-in */
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
    </style>
</head>
<body>
    <div class="background-animation"></div>
    <div class="container">
        <header class="dashboard-header">
            <a href="suite-hub.html" style="text-decoration: none;"><h1 class="app-title">Flow Business Suite</h1></a>
            <div class="settings-menu">
                <button id="settings-button" class="btn btn-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311a1.464 1.464 0 0 1-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283-.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c-1.4-.413-1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.858 2.929 2.929 0 0 1 0 5.858z"/></svg>
                </button>
                <div id="settings-dropdown" class="settings-dropdown">
                    <a href="account.html">My Account</a>
                    <a href="admin.html">Admin Settings</a>
                    <a href="pricing.html">Upgrade Plan</a>
                    <button id="logout-button">Logout</button>
                </div>
            </div>
        </header>
        <nav class="main-nav">
            <a href="suite-hub.html">App Hub</a>
            <a href="scheduling.html" class="active">Scheduling</a>
     </nav>
        <section>
            <h2 style="color: var(--text-light);">Employee Scheduling</h2>
            <div class="scheduling-layout">
                <div class="sidebar">
                    <h3>Create New Shift</h3>
                    <form id="create-shift-form">
                        <div class="form-group">
                            <label for="employee-select">Employee</label>
                            <select id="employee-select" required></select>
                        </div>
                        <div class="form-group">
                            <label for="location-select">Location</label>
                            <select id="location-select" required></select>
                        </div>
                        <div class="form-group">
                            <label for="start-time-input">Start Time</label>
                            <input type="datetime-local" id="start-time-input" required>
                        </div>
                        <div class="form-group">
                            <label for="end-time-input">End Time</label>
                            <input type="datetime-local" id="end-time-input" required>
                        </div>
                        <div class="form-group">
                            <label for="notes-input">Notes (Optional)</label>
                            <textarea id="notes-input" rows="3"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary">Add Shift</button>
                    </form>

                    <h3 style="margin-top: 30px;">Auto-Scheduling Settings</h3>
                    <div class="form-group">
                        <label>Target Daily Hours:</label>
                        <div id="daily-hours-inputs">
                            </div>
                    </div>
                    <div class="form-group">
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-availability" checked>
                            <span class="slider round"></span>
                            Show Availability
                        </label>
                    </div>
                    <button id="auto-generate-schedule-btn" class="btn btn-secondary">Auto-Generate Schedule</button>
                </div>

                <div class="calendar-main">
                    <div class="calendar-header">
                        <button id="prev-week-btn" class="btn btn-secondary">◀ Previous</button>
                        <h3 id="current-week-display">Loading...</h3>
                        <button id="next-week-btn" class="btn btn-secondary">Next ▶</button>
                    </div>
                    <div class="calendar-grid-container">
                        <div id="calendar-grid">
                            </div>
                    </div>
                </div>
            </div>
        </section>
    </div>
    
    <div id="modal-message" class="modal">
        <div class="modal-content">
            <p id="modal-text"></p>
            <div class="modal-actions">
                <button id="modal-ok-button" class="btn btn-primary">OK</button>
            </div>
        </div>
    </div>
    <div id="confirm-modal" class="modal">
        <div class="modal-content">
            <p id="confirm-modal-text"></p>
            <div class="modal-actions">
                <button id="confirm-modal-cancel" class="btn btn-secondary">Cancel</button>
                <button id="confirm-modal-confirm" class="btn btn-primary">Confirm</button>
            </div>
        </div>
    </div>
    
    <script type="module" src="js/app.js"></script>
</body>
</html>
