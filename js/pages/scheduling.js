// js/pages/scheduling.js
import { apiRequest, showModalMessage, showConfirmModal } from '../utils.js';

/**
 * Handles all logic for the scheduling page.
 */
export function handleSchedulingPage() {
    // Security check: Redirect to login page if no authentication token is found in local storage
    const authToken = localStorage.getItem("authToken");
    const userRole = localStorage.getItem('userRole'); // Get user role from local storage

    if (!authToken) {
        window.location.href = "login.html";
        return;
    }

    // Get references to key DOM elements for the scheduling page
    const schedulingLayout = document.querySelector('.scheduling-layout'); // Desktop layout container
    const mobileCalendarView = document.querySelector('.mobile-calendar-view'); // Mobile layout container

    const calendarGrid = document.getElementById('calendar-grid'); // Desktop calendar grid
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const createShiftForm = document.getElementById('create-shift-form');
    
    const employeeSelect = document.getElementById('employee-select');
    const locationSelect = document.getElementById('location-select');

    const availabilityToggle = document.getElementById('toggle-availability');

    // Mobile specific elements
    const mobilePrevDayBtn = document.getElementById('mobile-prev-day-btn');
    const mobileNextDayBtn = document.getElementById('mobile-next-day-btn');
    const mobileCurrentDayDisplay = document.getElementById('mobile-current-day-display');
    const mobileDayColumn = document.getElementById('mobile-day-column');

    // Super Admin specific elements
    const superAdminLocationSelectorDiv = document.getElementById('super-admin-location-selector');
    const superAdminLocationSelect = document.getElementById('super-admin-location-select');

    // Initialize currentStartDate to the beginning of the current week (Sunday)
    let currentStartDate = new Date();
    currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());
    currentStartDate.setHours(0, 0, 0, 0); // Set to midnight for consistent date comparison

    // Initialize currentMobileDay to today's date
    let currentMobileDay = new Date();
    currentMobileDay.setHours(0, 0, 0, 0);

    // Define a breakpoint for mobile view
    const MOBILE_BREAKPOINT = 768; // px

    // State variable to hold the currently selected location ID for data fetching
    let currentLocationId = null; 
    let allLocations = []; // Store all locations for super admin selector

    /**
     * Checks if the current screen width is considered mobile.
     * @returns {boolean} True if mobile, false otherwise.
     */
    function isMobileView() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    /**
     * Main render function that decides which calendar view to render.
     * It also ensures data is fetched for the correct location based on user role.
     */
    async function renderCalendar() {
        // Only proceed if a location is selected/determined (for super_admin) or if it's a location_admin/employee
        if (userRole === 'super_admin' && !currentLocationId) {
            // If super admin and no location selected, don't render calendar yet
            // The dropdown needs to be populated and a selection made first.
            // We'll show a message or just keep it blank until a selection.
            if (calendarGrid) calendarGrid.innerHTML = '<p style="color: var(--text-medium); text-align: center; padding-top: 50px;">Please select a location to view its schedule.</p>';
            if (mobileDayColumn) mobileDayColumn.innerHTML = '<p style="color: var(--text-medium); text-align: center; padding-top: 50px;">Please select a location to view its schedule.</p>';
            return;
        }

        if (isMobileView()) {
            // Hide desktop view, show mobile view
            if (schedulingLayout) schedulingLayout.style.display = 'none';
            if (mobileCalendarView) mobileCalendarView.style.display = 'flex';
            await renderMobileDayCalendar(currentMobileDay);
        } else {
            // Hide mobile view, show desktop view
            if (schedulingLayout) schedulingLayout.style.display = 'grid'; // Use 'grid' as defined in CSS
            if (mobileCalendarView) mobileCalendarView.style.display = 'none';
            await renderWeeklyCalendar(currentStartDate);
        }
    }

    /**
     * Renders the full weekly calendar grid for desktop.
     * @param {Date} startDate - The Date object representing the first day (Sunday) of the week to render.
     */
    async function renderWeeklyCalendar(startDate) {
        if (!calendarGrid || !currentWeekDisplay) return;
        
        // Calculate end date for the week display
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        const options = { month: 'short', day: 'numeric' };
        currentWeekDisplay.textContent = `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
        
        calendarGrid.innerHTML = ''; // Clear existing calendar content

        // Create calendar header (Time column + 7 days)
        const headerContainer = document.createElement('div');
        headerContainer.className = 'calendar-grid-header';
        calendarGrid.appendChild(headerContainer);

        const timeHeader = document.createElement('div');
        timeHeader.className = 'calendar-day-header';
        timeHeader.innerHTML = `&nbsp;`; // Empty cell for time column header
        headerContainer.appendChild(timeHeader);

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + i);
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = dayDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            headerContainer.appendChild(dayHeader);
        }

        // Create calendar body (Time column + 7 day columns with hour lines)
        const calendarBody = document.createElement('div');
        calendarBody.className = 'calendar-body';
        calendarGrid.appendChild(calendarBody);

        const timeColumn = document.createElement('div');
        timeColumn.className = 'time-column';
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour < 12 ? 'AM' : 'PM';
            timeSlot.textContent = `${displayHour} ${ampm}`;
            timeColumn.appendChild(timeSlot);
        }
        calendarBody.appendChild(timeColumn);

        for (let i = 0; i < 7; i++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            dayColumn.id = `day-column-${i}`; // Assign ID for easy access
            for (let j = 0; j < 24; j++) {
                const hourLine = document.createElement('div');
                hourLine.className = 'hour-line';
                dayColumn.appendChild(hourLine);
            }
            calendarBody.appendChild(dayColumn);
        }

        // Load and display data (shifts, availability, business hours) concurrently
        await Promise.all([
            loadAndDisplayShifts(startDate, endDate, false, currentLocationId), // Pass currentLocationId
            loadAndRenderAvailability(false, currentLocationId), // Pass currentLocationId
            loadAndRenderBusinessHours(false, currentLocationId) // Pass currentLocationId
        ]);
    }

    /**
     * Renders a single day calendar view for mobile.
     * @param {Date} dayDate - The Date object representing the day to render.
     */
    async function renderMobileDayCalendar(dayDate) {
        if (!mobileDayColumn || !mobileCurrentDayDisplay) return;

        mobileCurrentDayDisplay.textContent = dayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        mobileDayColumn.innerHTML = ''; // Clear existing content

        // Create time slots for the mobile day column
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'mobile-time-slot';
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour < 12 ? 'AM' : 'PM';
            timeSlot.textContent = `${displayHour} ${ampm}`;
            mobileDayColumn.appendChild(timeSlot);
        }

        // Load and display data for the single day
        await Promise.all([
            loadAndDisplayShifts(dayDate, dayDate, true, currentLocationId), // Pass currentLocationId
            loadAndRenderAvailability(true, currentLocationId), // Pass currentLocationId
            loadAndRenderBusinessHours(true, currentLocationId) // Pass currentLocationId
        ]);
    }


    /**
     * Helper function to detect overlaps and calculate positions for shifts.
     * @param {Array<Object>} shifts - An array of shift objects for a single day.
     * @returns {Array<Object>} Shifts with added 'column' and 'totalColumns' properties.
     */
    function calculateShiftPositions(shifts) {
        // Sort shifts by start time, then by end time (for consistent overlap detection)
        shifts.sort((a, b) => {
            const startA = new Date(a.start_time).getTime();
            const startB = new Date(b.start_time).getTime();
            if (startA !== startB) return startA - startB;
            const endA = new Date(b.end_time).getTime();
            const endB = new Date(b.end_time).getTime();
            return endA - endB;
        });

        // This array will hold "columns" of non-overlapping shifts
        const columns = [];

        shifts.forEach(shift => {
            const shiftStart = new Date(shift.start_time).getTime();
            const shiftEnd = new Date(shift.end_time).getTime();
            
            let placed = false;
            // Try to place the shift in an existing column
            for (let i = 0; i < columns.length; i++) {
                const column = columns[i];
                // Check if this shift overlaps with any shift already in this column
                const overlapsInColumn = column.some(existingShift => {
                    const existingStart = new Date(existingShift.start_time).getTime();
                    const existingEnd = new Date(existingShift.end_time).getTime();
                    // Overlap if (startA < endB && endA > startB)
                    return (shiftStart < existingEnd && shiftEnd > existingStart);
                });

                if (!overlapsInColumn) {
                    column.push(shift);
                    shift.column = i; // Assign column index
                    placed = true;
                    break;
                }
            }

            // If it couldn't be placed in an existing column, create a new one
            if (!placed) {
                columns.push([shift]);
                shift.column = columns.length - 1; // Assign new column index
            }
        });

        // Now, iterate through all shifts again to set totalColumns for proper width calculation
        shifts.forEach(shift => {
            // Find all shifts that overlap with the current shift
            const overlappingShifts = shifts.filter(otherShift => {
                if (shift === otherShift) return false; // Don't compare with itself
                const startA = new Date(shift.start_time).getTime();
                const endA = new Date(shift.end_time).getTime();
                const startB = new Date(otherShift.start_time).getTime();
                const endB = new Date(otherShift.end_time).getTime();
                return (startA < endB && endA > startB);
            });

            // The total number of columns needed for this specific set of overlapping shifts
            // is the maximum column index among them (including itself) + 1
            const maxColumnIndex = Math.max(shift.column, ...overlappingShifts.map(s => s.column));
            shift.totalColumns = maxColumnIndex + 1;
        });

        return shifts;
    }

    /**
     * Fetches shift data from the backend API for the current week/day and renders each shift as a visual block.
     * @param {Date} start - The start date for fetching shifts.
     * @param {Date} end - The end date for fetching shifts.
     * @param {boolean} isMobile - True if rendering for mobile single day view.
     * @param {string|null} locationId - The ID of the location to filter shifts by.
     */
    async function loadAndDisplayShifts(start, end, isMobile, locationId) {
        // Remove existing shifts before rendering new ones
        document.querySelectorAll('.calendar-shift').forEach(el => el.remove());
        
        // Format dates for API request (YYYY-MM-DD)
        const formatDate = (d) => d.toISOString().split('T')[0];
        
        // Adjust end date to include the full last day for the API query
        let endOfDay = new Date(end);
        endOfDay.setDate(endOfDay.getDate() + 1); // Go to the start of the next day

        // Construct query parameters
        let queryParams = `startDate=${formatDate(start)}&endDate=${formatDate(endOfDay)}`;
        if (locationId) {
            queryParams += `&location_id=${locationId}`;
        }

        try {
            const shifts = await apiRequest('GET', `/api/shifts?${queryParams}`); // Include location_id
            
            if (shifts && shifts.length > 0) {
                // Group shifts by day
                const shiftsByDay = {};
                shifts.forEach(shift => {
                    const shiftDate = new Date(shift.start_time);
                    const dayKey = shiftDate.toISOString().split('T')[0]; // ISO-formatted date string
                    if (!shiftsByDay[dayKey]) {
                        shiftsByDay[dayKey] = [];
                    }
                    shiftsByDay[dayKey].push(shift);
                });

                // Process each day's shifts for overlaps and render
                Object.keys(shiftsByDay).forEach(dayKey => {
                    const dailyShifts = shiftsByDay[dayKey];
                    const processedShifts = calculateShiftPositions(dailyShifts);

                    processedShifts.forEach(shift => {
                        const shiftStart = new Date(shift.start_time);
                        const shiftEnd = new Date(shift.end_time);
                        
                        let targetColumnElement;
                        if (isMobile) {
                            // For mobile, all shifts go into the single mobile-day-column
                            targetColumnElement = mobileDayColumn;
                        } else {
                            // For desktop, shifts go into their respective day columns
                            const dayIndex = shiftStart.getDay(); // 0 for Sunday, 1 for Monday, etc.
                            targetColumnElement = document.getElementById(`day-column-${dayIndex}`);
                        }

                        if (targetColumnElement) {
                            // Calculate top and height for the shift block in pixels (1 minute = 1 pixel)
                            const startMinutes = (shiftStart.getHours() * 60) + shiftStart.getMinutes();
                            const endMinutes = (shiftEnd.getHours() * 60) + shiftEnd.getMinutes();
                            const heightMinutes = endMinutes - startMinutes;
                            
                            const shiftElement = document.createElement('div');
                            shiftElement.className = 'calendar-shift';
                            shiftElement.style.top = `${startMinutes}px`;
                            shiftElement.style.height = `${heightMinutes}px`;

                            if (!isMobile) { // Apply multi-column positioning only for desktop view
                                const columnWidth = 100 / shift.totalColumns;
                                shiftElement.style.width = `calc(${columnWidth}% - 4px)`; // Adjust width for columns
                                shiftElement.style.left = `calc(2px + ${shift.column * columnWidth}%)`; // Position in its column
                            } else { // For mobile, full width with padding
                                shiftElement.style.width = `calc(100% - 100px)`; // Account for mobile-day-column padding and sticky time column
                                shiftElement.style.left = `90px`; // Position after time column + padding
                            }
                            
                            const timeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
                            const startTimeString = shiftStart.toLocaleTimeString('en-US', timeFormatOptions);
                            const endTimeString = shiftEnd.toLocaleTimeString('en-US', timeFormatOptions);

                            shiftElement.innerHTML = `
                                <strong>${shift.employee_name}</strong><br>
                                <span style="font-size: 0.9em;">${startTimeString} - ${endTimeString}</span><br>
                                <span style="color: #ddd;">${shift.location_name || ''}</span>
                                <button class="delete-shift-btn" data-shift-id="${shift.id}" title="Delete Shift">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                                </button>
                            `;
                            shiftElement.title = `Shift for ${shift.employee_name} at ${shift.location_name}. Notes: ${shift.notes || 'None'}`;
                            
                            targetColumnElement.appendChild(shiftElement);
                        }
                    });
                });
            }
        }
        catch (error) {
            showModalMessage(`Error loading shifts: ${error.message}`, true);
            console.error('Error loading shifts:', error);
        }
    }
    
    /**
     * Fetches employee availability data and renders it as semi-transparent overlay blocks.
     * These blocks visually indicate when an employee is available.
     * @param {boolean} isMobile - True if rendering for mobile single day view.
     * @param {string|null} locationId - The ID of the location to filter availability by.
     */
    async function loadAndRenderAvailability(isMobile, locationId) {
        // Remove existing availability blocks before rendering new ones
        document.querySelectorAll('.availability-block').forEach(el => el.remove());
        
        let queryParams = '';
        if (locationId) {
            queryParams = `?location_id=${locationId}`;
        }

        try {
            const employees = await apiRequest('GET', `/api/users/availability${queryParams}`); // Include location_id
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

            employees.forEach(employee => {
                if (!employee.availability) return; // Skip if no availability data

                daysOfWeek.forEach((day, index) => {
                    // Only render for the specific mobile day if in mobile view
                    if (isMobile && index !== currentMobileDay.getDay()) {
                        return;
                    }

                    const dayAvailability = employee.availability[day];
                    if (dayAvailability && dayAvailability.start && dayAvailability.end) {
                        let targetColumnElement;
                        if (isMobile) {
                            targetColumnElement = mobileDayColumn;
                        } else {
                            targetColumnElement = document.getElementById(`day-column-${index}`);
                        }

                        if(targetColumnElement) {
                            // Convert time strings to minutes from midnight for positioning
                            const startMinutes = parseInt(dayAvailability.start.split(':')[0], 10) * 60 + parseInt(dayAvailability.start.split(':')[1], 10);
                            const endMinutes = parseInt(dayAvailability.end.split(':')[0], 10) * 60 + parseInt(dayAvailability.end.split(':')[1], 10);
                            const heightMinutes = endMinutes - startMinutes;
                            
                            if (heightMinutes > 0) {
                                const availabilityBlock = document.createElement('div');
                                availabilityBlock.className = 'availability-block';
                                // Hide if the toggle is off
                                if (availabilityToggle && !availabilityToggle.checked) {
                                    availabilityBlock.classList.add('hidden');
                                }
                                availabilityBlock.style.top = `${startMinutes}px`; // Position in pixels
                                availabilityBlock.style.height = `${heightMinutes}px`; // Height in pixels
                                
                                if (isMobile) {
                                    availabilityBlock.style.width = `calc(100% - 100px)`; // Account for mobile-day-column padding and sticky time column
                                    availabilityBlock.style.left = `90px`; // Position after time column + padding
                                }
                                targetColumnElement.appendChild(availabilityBlock);
                            }
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Failed to load availability:", error);
            // No modal message here as it's a background visual enhancement
        }
    }

    /**
     * Fetches and renders the business operating hours as a subtle background block.
     * This visually indicates the standard business hours for the location.
     * @param {boolean} isMobile - True if rendering for mobile single day view.
     * @param {string|null} locationId - The ID of the location to filter business hours by.
     */
    async function loadAndRenderBusinessHours(isMobile, locationId) {
        // Remove existing business hours blocks before rendering new ones
        document.querySelectorAll('.business-hours-block').forEach(el => el.remove());

        let queryParams = '';
        if (locationId) {
            queryParams = `?location_id=${locationId}`;
        }

        try {
            const settings = await apiRequest('GET', `/api/settings/business${queryParams}`); // Include location_id
            const businessStartHour = parseInt((settings.operating_hours_start || '00:00').split(':')[0], 10);
            const businessEndHour = parseInt((settings.operating_hours_end || '00:00').split(':')[0], 10);
            const durationHours = businessEndHour - businessStartHour;

            if (durationHours > 0) {
                // Determine which columns to apply the business hours block to
                let columnsToRender = [];
                if (isMobile) {
                    columnsToRender.push(mobileDayColumn); // Only the single mobile day column
                } else {
                    for (let i = 0; i < 7; i++) {
                        columnsToRender.push(document.getElementById(`day-column-${i}`));
                    }
                }

                columnsToRender.forEach(dayColumn => {
                    if (dayColumn) {
                        const businessHoursBlock = document.createElement('div');
                        businessHoursBlock.className = 'business-hours-block';
                        businessHoursBlock.style.top = `${businessStartHour * 60}px`; // Convert hours to pixels
                        businessHoursBlock.style.height = `${durationHours * 60}px`; // Convert hours to pixels
                        
                        if (isMobile) {
                            businessHoursBlock.style.width = `calc(100% - 100px)`; // Account for mobile-day-column padding and sticky time column
                            businessHoursBlock.style.left = `90px`; // Position after time column + padding
                        }
                        dayColumn.appendChild(businessHoursBlock);
                    }
                });
            }
        } catch (error) {
            console.error("Failed to load or render business operating hours:", error);
            // No modal message here as it's a background visual
        }
    }

    /**
     * Populates the employee and location dropdowns in the shift creation form.
     * @param {string|null} filterLocationId - The ID of the location to filter users/locations by.
     */
    async function populateDropdowns(filterLocationId) {
        try {
            let userQueryParams = '';
            let locationQueryParams = '';
            if (filterLocationId) {
                userQueryParams = `?location_id=${filterLocationId}`;
                locationQueryParams = `?location_id=${filterLocationId}`;
            }

            // Fetch users and locations concurrently, filtered by locationId if provided
            const [users, locations] = await Promise.all([
                apiRequest('GET', `/api/users${userQueryParams}`), // Get all users (backend filters by role/location)
                apiRequest('GET', `/api/locations${locationQueryParams}`) // Get all locations (backend filters by role)
            ]);
            
            // Populate Employee Select
            if (employeeSelect) {
                employeeSelect.innerHTML = '<option value="">Select Employee</option>'; // Default empty option
                // Filter for employees and location_admins (who might also be scheduled)
                const employees = users.filter(u => u.role === 'employee' || u.role === 'location_admin');
                employees.forEach(user => {
                    const option = new Option(user.full_name, user.user_id);
                    employeeSelect.add(option);
                });
            }

            // Populate Location Select (for Create New Shift form)
            if (locationSelect) {
                locationSelect.innerHTML = '<option value="">Select Location</option>'; // Default empty option
                locations.forEach(loc => {
                    const option = new Option(loc.location_name, loc.location_id);
                    locationSelect.add(option);
                });
                // If a location is pre-selected (e.g., by super admin selector), set it
                if (filterLocationId) {
                    locationSelect.value = filterLocationId;
                }
            }

            // Populate Super Admin Location Select (if visible)
            if (userRole === 'super_admin' && superAdminLocationSelect) {
                superAdminLocationSelect.innerHTML = '<option value="">Select a Location</option>';
                locations.forEach(loc => {
                    const option = new Option(loc.location_name, loc.location_id);
                    superAdminLocationSelect.add(option);
                });
                // Set the selected value if currentLocationId is already set
                if (currentLocationId) {
                    superAdminLocationSelect.value = currentLocationId;
                }
            }

        } catch (error) {
            showModalMessage('Failed to load data for form dropdowns. Please try again.', true);
            console.error('Error populating dropdowns:', error);
        }
    }

    // --- Event Handlers ---

    // Event listener for deleting shifts using event delegation on the calendar grid
    if (calendarGrid) {
        calendarGrid.addEventListener('click', async (e) => {
            const deleteButton = e.target.closest('.delete-shift-btn');

            if (deleteButton) {
                e.stopPropagation(); // Prevent click from bubbling to parent elements
                const shiftIdToDelete = String(deleteButton.dataset.shiftId); // Get shift ID from data attribute

                if (!shiftIdToDelete || shiftIdToDelete === "undefined" || shiftIdToDelete === "null") {
                    showModalMessage('Shift ID not found. Cannot delete.', true);
                    return;
                }
                
                const isConfirmed = await showConfirmModal('Are you sure you want to delete this shift? This action cannot be undone.');
                
                if (isConfirmed) {
                    try {
                        await apiRequest('DELETE', `/api/shifts/${shiftIdToDelete}`); // Call backend delete endpoint
                        showModalMessage('Shift deleted successfully!', false); 
                        renderCalendar(); // Re-render calendar to show updated shifts
                    } catch (error) {
                        showModalMessage(`Error deleting shift: ${error.message}`, true);
                        console.error('Error deleting shift:', error);
                    }
                }
            }
        });
    }

    // Event listener for the availability toggle switch
    if (availabilityToggle) {
        availabilityToggle.addEventListener('change', () => {
            const blocks = document.querySelectorAll('.availability-block');
            blocks.forEach(block => {
                block.classList.toggle('hidden', !availabilityToggle.checked); // Toggle 'hidden' class
            });
        });
    }
    
    // Event listener for "Previous Week" button (Desktop)
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentStartDate.setDate(currentStartDate.getDate() - 7); // Subtract 7 days
            renderCalendar(); // Re-render calendar for the new week
        });
    }

    // Event listener for "Next Week" button (Desktop)
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => { 
            currentStartDate.setDate(currentStartDate.getDate() + 7); // Add 7 days
            renderCalendar(); // Re-render calendar for the new week
        });
    } 

    // Event listener for "Previous Day" button (Mobile)
    if (mobilePrevDayBtn) {
        mobilePrevDayBtn.addEventListener('click', () => {
            currentMobileDay.setDate(currentMobileDay.getDate() - 1); // Subtract 1 day
            renderCalendar(); // Re-render calendar for the new day
        });
    }

    // Event listener for "Next Day" button (Mobile)
    if (mobileNextDayBtn) {
        mobileNextDayBtn.addEventListener('click', () => { 
            currentMobileDay.setDate(currentMobileDay.getDate() + 1); // Add 1 day
            renderCalendar(); // Re-render calendar for the new day
        });
    }
    
    // Event listener for the "Create New Shift" form submission
    if (createShiftForm) {
        createShiftForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission
            const shiftData = {
                employee_id: employeeSelect.value,
                location_id: locationSelect.value,
                start_time: document.getElementById('start-time-input').value,
                end_time: document.getElementById('end-time-input').value,
                notes: document.getElementById('notes-input').value
            };

            // Basic validation
            if (!shiftData.employee_id || !shiftData.location_id || !shiftData.start_time || !shiftData.end_time) {
                showModalMessage('Please fill all required fields (Employee, Location, Start Time, End Time).', true);
                return;
            }

            // Validate that end time is after start time
            if (new Date(shiftData.start_time) >= new Date(shiftData.end_time)) {
                showModalMessage('End time must be after start time.', true);
                return;
            }

            try {
                await apiRequest('POST', '/api/shifts', shiftData); // Send shift data to backend
                showModalMessage('Shift created successfully!', false); 
                createShiftForm.reset(); // Clear the form
                renderCalendar(); // Re-render calendar to show the new shift
            } catch (error) {
                showModalMessage(`Error creating shift: ${error.message}`, true);
                console.error('Error creating shift:', error);
            }
        });
    }

    // NEW: Event listener for Super Admin Location Selector
    if (superAdminLocationSelect) {
        superAdminLocationSelect.addEventListener('change', () => {
            currentLocationId = superAdminLocationSelect.value; // Update selected location ID
            renderCalendar(); // Re-render calendar with new location filter
            populateDropdowns(currentLocationId); // Update create shift form dropdowns
        });
    }

    // Event listener for window resize to switch between desktop and mobile views
    window.addEventListener('resize', () => {
        renderCalendar(); // Re-render calendar on resize
    });
    
    // --- Initial Page Load Actions ---
    // Determine initial currentLocationId based on user role
    const initializePageData = async () => {
        if (userRole === 'super_admin') {
            // Fetch all locations for super admin selector
            try {
                const locations = await apiRequest('GET', '/api/locations');
                allLocations = locations; // Store all locations
                if (allLocations && allLocations.length > 0) {
                    // Default to the first location if super admin has no specific preference
                    currentLocationId = allLocations[0].location_id; 
                }
                // Show the super admin selector and populate it
                if (superAdminLocationSelectorDiv) superAdminLocationSelectorDiv.style.display = 'block';
                populateDropdowns(currentLocationId); // Populate all dropdowns, including super admin selector
                renderCalendar(); // Render calendar with initial location
            } catch (error) {
                console.error("Error initializing super admin locations:", error);
                showModalMessage("Failed to load locations for super admin. Please try again.", true);
                // Still attempt to render calendar, but it might be empty
                populateDropdowns(currentLocationId);
                renderCalendar();
            }
        } else {
            // For location_admin or employee, get their assigned location_id from /users/me
            try {
                const userMe = await apiRequest('GET', '/api/users/me');
                if (userMe && userMe.location_id) {
                    currentLocationId = userMe.location_id;
                } else {
                    showModalMessage("Your account is not associated with a location. Please contact your administrator.", true);
                    // Prevent further rendering if no location is found for non-super-admin
                    return; 
                }
                populateDropdowns(currentLocationId); // Populate dropdowns for their location
                renderCalendar(); // Render calendar for their location
            } catch (error) {
                console.error("Error fetching user location for initialization:", error);
                showModalMessage("Failed to determine your assigned location. Please log in again or contact support.", true);
            }
        }
    };

    initializePageData(); // Call the async initialization function
}
