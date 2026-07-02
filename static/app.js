// Global variables to store fetched data
let employees = [];
let leaves = [];
let meetings = [];
let tickets = [];

// Base API URL
const API_BASE = '/api';

// On page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    setupAuthListeners();
});

let appInitialized = false;

function checkAuthState() {
    const token = localStorage.getItem('atliq_token');
    const userJson = localStorage.getItem('atliq_user');
    
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    
    if (token && userJson) {
        const user = JSON.parse(userJson);
        // Show app, hide login
        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        
        // Update user display details in sidebar
        document.getElementById('user-display-name').textContent = user.name || 'Sarah Johnson';
        document.getElementById('user-display-role').textContent = user.role || 'HR Director';
        if (user.avatar) {
            document.getElementById('user-display-avatar').src = user.avatar;
        }
        
        initApp();
    } else {
        // Show login, hide app
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
}

function setupAuthListeners() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorDiv = document.getElementById('login-error');
    
    const username = usernameInput.value;
    const password = passwordInput.value;
    
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Invalid username or password.');
        }
        
        const data = await response.json();
        
        // Save auth data
        localStorage.setItem('atliq_token', data.token);
        localStorage.setItem('atliq_user', JSON.stringify(data.user));
        
        // Clear fields
        usernameInput.value = '';
        passwordInput.value = '';
        
        // Refresh auth state
        checkAuthState();
        
        // Show initial welcome alert
        showAlert(`Welcome back, ${data.user.name}!`, 'success');
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    }
}

function handleLogout() {
    localStorage.removeItem('atliq_token');
    localStorage.removeItem('atliq_user');
    
    // Clear page content and reset tab to dashboard
    switchTab('dashboard');
    
    // Refresh auth state
    checkAuthState();
}

function initApp() {
    if (appInitialized) {
        fetchData();
        return;
    }
    
    // Setup Navigation Tabs
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    appInitialized = true;
    
    // Load initial data
    fetchData();
}

// Tab switcher
function switchTab(tabId) {
    // Update active class in menu
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Hide all sections, show target section
    const sections = document.querySelectorAll('.tab-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(`tab-${tabId}`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update Headers
    const titleMap = {
        'dashboard': 'Dashboard Overview',
        'onboarding': 'Onboarding Suite',
        'employees': 'Employee Directory',
        'leaves': 'Leave Planner',
        'meetings': 'Sync Calendar',
        'tickets': 'IT Ticketing Desk'
    };
    
    const subtitleMap = {
        'dashboard': 'Welcome back, Sarah. Here is what is happening today.',
        'onboarding': 'Provision employees and automate checklists in one click.',
        'employees': 'View and manage all registered employees across the workspace.',
        'leaves': 'Track employee leave balances and schedule time-off requests.',
        'meetings': 'Coordinate intro meetings, check-ins, and recurring touchpoints.',
        'tickets': 'Manage procurement, hardware issues, and software license approvals.'
    };

    document.getElementById('page-title').textContent = titleMap[tabId] || 'HR Portal';
    document.getElementById('page-subtitle').textContent = subtitleMap[tabId] || '';

    // Load data for specific tab if needed
    if (tabId === 'dashboard') {
        fetchDashboardData();
    } else if (tabId === 'employees') {
        fetchEmployees();
    } else if (tabId === 'leaves') {
        fetchLeavesData();
    } else if (tabId === 'meetings') {
        fetchMeetings();
    } else if (tabId === 'tickets') {
        fetchTickets();
    }
}

// Redirect helpers
function showOnboardTab() {
    switchTab('onboarding');
}

// Notification alerts system
function showAlert(message, type = 'info') {
    const container = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'danger') iconClass = 'fa-circle-xmark';
    
    alert.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(alert);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        alert.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => alert.remove(), 300);
    }, 4000);
}

// Fetch all initial data
function fetchData() {
    fetchDashboardData();
    fetchEmployees();
    fetchLeavesData();
    fetchMeetings();
    fetchTickets();
}

// API Call wrappers

// 1. Dashboard Stats
async function fetchDashboardData() {
    try {
        const response = await fetch(`${API_BASE}/dashboard`);
        if (!response.ok) throw new Error('Failed to load dashboard statistics.');
        
        const data = await response.json();
        
        // Update stats
        document.getElementById('stat-employees').textContent = data.stats.total_employees;
        document.getElementById('stat-leaves').textContent = data.stats.avg_leave_balance;
        document.getElementById('stat-meetings').textContent = data.stats.total_meetings;
        document.getElementById('stat-tickets').textContent = data.stats.tickets_status.Open;
        
        const trendEl = document.getElementById('stat-tickets-trend');
        const openCount = data.stats.tickets_status.Open;
        if (openCount > 5) {
            trendEl.className = 'stat-trend trend-down';
            trendEl.innerHTML = `<i class="fa-solid fa-arrow-up"></i> Critical (${openCount})`;
        } else {
            trendEl.className = 'stat-trend trend-up';
            trendEl.innerHTML = `<i class="fa-solid fa-check"></i> Low Queue (${openCount})`;
        }

        // Render Recent Meetings
        const meetingsList = document.getElementById('recent-meetings-list');
        if (data.recent_meetings.length === 0) {
            meetingsList.innerHTML = '<div class="empty-state">No upcoming meetings scheduled.</div>';
        } else {
            meetingsList.innerHTML = data.recent_meetings.map(m => {
                const dateObj = new Date(m.date);
                const day = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
                return `
                    <div class="meeting-timeline-item">
                        <div class="meeting-time-box">
                            <span class="time-date">${day}</span>
                            <span class="time-hour">${m.time}</span>
                        </div>
                        <div class="meeting-info-box">
                            <h4>${m.title}</h4>
                            <p><i class="fa-solid fa-user-tie"></i> Employee: ${m.emp_name} (${m.emp_id})</p>
                            <p><i class="fa-solid fa-location-dot"></i> Location: ${m.location}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Render Recent Tickets
        const ticketsList = document.getElementById('recent-tickets-list');
        if (data.recent_tickets.length === 0) {
            ticketsList.innerHTML = '<div class="empty-state">No recent tickets raised.</div>';
        } else {
            ticketsList.innerHTML = data.recent_tickets.map(t => {
                let badgeClass = 'badge-warning';
                if (t.status === 'Closed') badgeClass = 'badge-success';
                if (t.status === 'In Progress') badgeClass = 'badge-info';
                
                return `
                    <div class="ticket-activity-item">
                        <div class="ticket-detail-group">
                            <span class="ticket-num">${t.ticket_id}</span>
                            <div class="ticket-desc">
                                <h4>${t.item}</h4>
                                <p>Employee: ${t.emp_id} | ${t.reason}</p>
                            </div>
                        </div>
                        <span class="badge ${badgeClass}">${t.status}</span>
                    </div>
                `;
            }).join('');
        }

    } catch (error) {
        console.error(error);
        showAlert(error.message, 'danger');
    }
}

// 2. Employees API
async function fetchEmployees() {
    try {
        const response = await fetch(`${API_BASE}/employees`);
        if (!response.ok) throw new Error('Failed to fetch employee list.');
        
        employees = await response.json();
        renderEmployeesTable(employees);
        populateDropdowns();
    } catch (error) {
        console.error(error);
        showAlert(error.message, 'danger');
    }
}

function renderEmployeesTable(list) {
    const tbody = document.getElementById('employees-list');
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No employees found.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(emp => `
        <tr>
            <td><strong>${emp.emp_id}</strong></td>
            <td>
                <div class="flex-header" style="justify-content: flex-start; gap: 0.5rem;">
                    <i class="fa-solid fa-circle-user text-muted" style="font-size: 1.25rem;"></i>
                    <span>${emp.name}</span>
                </div>
            </td>
            <td>${emp.email}</td>
            <td>${emp.manager_name !== 'None' ? `${emp.manager_id}: ${emp.manager_name}` : '<span class="text-muted">None</span>'}</td>
            <td>
                <div style="display: flex; gap: 0.3rem;">
                    <button class="btn btn-secondary btn-icon-only" onclick="viewEmployeeDetails('${emp.emp_id}')" title="View Profile Details">
                        <i class="fa-solid fa-eye" style="color: var(--primary);"></i>
                    </button>
                    <button class="btn btn-secondary btn-icon-only" onclick="scheduleForEmployee('${emp.emp_id}')" title="Schedule Meeting">
                        <i class="fa-solid fa-calendar-plus"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterEmployees() {
    const query = document.getElementById('emp-search').value.toLowerCase();
    const filtered = employees.filter(emp => 
        emp.name.toLowerCase().includes(query) || 
        emp.emp_id.toLowerCase().includes(query) || 
        emp.email.toLowerCase().includes(query)
    );
    renderEmployeesTable(filtered);
}

function scheduleForEmployee(empId) {
    switchTab('meetings');
    document.getElementById('meet-emp').value = empId;
}

// Populate dropdown selectors dynamically
function populateDropdowns() {
    const managerSelects = [
        document.getElementById('onboard-manager'),
        document.getElementById('add-emp-manager')
    ];
    const employeeSelects = [
        document.getElementById('leave-emp'),
        document.getElementById('meet-emp'),
        document.getElementById('ticket-emp')
    ];

    // Populate Managers select dropdown (all employees can potentially act as managers)
    const managerOptionsHTML = '<option value="" disabled selected>Select Reporting Manager</option>' + 
        employees.map(emp => `<option value="${emp.emp_id}">${emp.name} (${emp.emp_id})</option>`).join('');

    managerSelects.forEach(select => {
        if (select) {
            const selectedVal = select.value;
            select.innerHTML = select.id === 'add-emp-manager' 
                ? '<option value="">None (Leadership)</option>' + employees.map(emp => `<option value="${emp.emp_id}">${emp.name}</option>`).join('')
                : managerOptionsHTML;
            if (selectedVal) select.value = selectedVal;
        }
    });

    // Populate Employee selectors
    const employeeOptionsHTML = '<option value="" disabled selected>Select Employee</option>' +
        employees.map(emp => `<option value="${emp.emp_id}">${emp.name} (${emp.emp_id})</option>`).join('');

    employeeSelects.forEach(select => {
        if (select) {
            const selectedVal = select.value;
            select.innerHTML = employeeOptionsHTML;
            if (selectedVal) select.value = selectedVal;
        }
    });
}

// Create employee
async function addEmployee(event) {
    event.preventDefault();
    const name = document.getElementById('add-emp-name').value;
    const email = document.getElementById('add-emp-email').value;
    const manager_id = document.getElementById('add-emp-manager').value;

    try {
        const response = await fetch(`${API_BASE}/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, manager_id: manager_id || null })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Could not add employee.');
        }

        showAlert(`Successfully created employee profile for ${name}.`, 'success');
        closeAddEmployeeModal();
        document.getElementById('add-employee-form').reset();
        fetchEmployees();
        fetchDashboardData();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// Modals management
function openAddEmployeeModal() {
    document.getElementById('add-employee-modal').classList.add('active');
}

function closeAddEmployeeModal() {
    document.getElementById('add-employee-modal').classList.remove('active');
}

// 3. Leaves API
async function fetchLeavesData() {
    try {
        const response = await fetch(`${API_BASE}/leaves`);
        if (!response.ok) throw new Error('Failed to load leave records.');
        
        leaves = await response.json();
        
        const tbody = document.getElementById('leaves-list');
        if (leaves.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No leave balances found.</td></tr>';
            return;
        }

        tbody.innerHTML = leaves.map(l => {
            const historyString = l.history.length === 0 
                ? '<span class="text-muted">No historical leaves</span>' 
                : l.history.map(h => `<span class="badge badge-info" style="margin-right: 0.2rem; margin-bottom: 0.2rem;">${h.date}</span>`).join('');
                
            return `
                <tr>
                    <td><strong>${l.emp_id}</strong></td>
                    <td>${l.emp_name}</td>
                    <td><span class="badge ${l.balance > 5 ? 'badge-success' : 'badge-warning'}">${l.balance} Days Left</span></td>
                    <td><div style="display: flex; flex-wrap: wrap;">${historyString}</div></td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        showAlert(error.message, 'danger');
    }
}

// Apply Leave
async function applyLeave(event) {
    event.preventDefault();
    const emp_id = document.getElementById('leave-emp').value;
    const start_date = document.getElementById('leave-start-date').value;
    const end_date = document.getElementById('leave-end-date').value;

    try {
        const response = await fetch(`${API_BASE}/leaves/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emp_id, start_date, end_date })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Could not apply leave.');
        }

        const data = await response.json();
        showAlert(data.message, 'success');
        document.getElementById('leave-form').reset();
        fetchLeavesData();
        fetchDashboardData();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// 4. Meetings API
async function fetchMeetings() {
    try {
        const response = await fetch(`${API_BASE}/meetings`);
        if (!response.ok) throw new Error('Failed to load meeting syncs.');
        
        meetings = await response.json();
        
        const tbody = document.getElementById('meetings-list');
        if (meetings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No upcoming meetings.</td></tr>';
            return;
        }

        tbody.innerHTML = meetings.map(m => {
            const dateObj = new Date(m.date);
            const dtFormatted = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            
            // Format parameters for cancellation POST request
            const isoDatetime = `${m.date}T${m.time}:00`;
            const cancelArgs = `'${m.emp_id}', '${isoDatetime}', '${m.topic}'`;
            
            // Escape single quotes in name/title for JS arguments
            const safeEmpName = m.emp_name.replace(/'/g, "\\'");
            const safeTitle = m.title.replace(/'/g, "\\'");
            const rescheduleArgs = `'${m.emp_id}', '${safeEmpName}', '${isoDatetime}', '${safeTitle}'`;
            
            return `
                <tr>
                    <td><strong>${dtFormatted} @ ${m.time}</strong></td>
                    <td>${m.emp_name} (${m.emp_id})</td>
                    <td>${m.title}</td>
                    <td>
                        <div style="display: flex; gap: 0.3rem;">
                            <button class="btn btn-secondary btn-icon-only" onclick="openRescheduleModal(${rescheduleArgs})" title="Reschedule Meeting">
                                <i class="fa-solid fa-clock-rotate-left"></i>
                            </button>
                            <button class="btn btn-danger btn-icon-only" onclick="cancelMeeting(${cancelArgs})" title="Cancel Meeting">
                                <i class="fa-solid fa-calendar-xmark"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        showAlert(error.message, 'danger');
    }
}

// Schedule Meeting
async function scheduleMeeting(event) {
    event.preventDefault();
    const emp_id = document.getElementById('meet-emp').value;
    const datetimeLocal = document.getElementById('meet-datetime').value; // YYYY-MM-DDTHH:MM
    const topic = document.getElementById('meet-topic').value;

    try {
        const response = await fetch(`${API_BASE}/meetings/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emp_id, meeting_datetime: datetimeLocal, topic })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Could not schedule meeting.');
        }

        const data = await response.json();
        showAlert(data.message, 'success');
        document.getElementById('meeting-form').reset();
        fetchMeetings();
        fetchDashboardData();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// Cancel Meeting
async function cancelMeeting(empId, datetimeIso, topic) {
    if (!confirm(`Are you sure you want to cancel the meeting with ${empId} about '${topic}'?`)) return;

    try {
        const response = await fetch(`${API_BASE}/meetings/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emp_id: empId, meeting_datetime: datetimeIso, topic })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Could not cancel meeting.');
        }

        const data = await response.json();
        showAlert(data.message, 'success');
        fetchMeetings();
        fetchDashboardData();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// 5. IT Tickets API
async function fetchTickets() {
    try {
        const response = await fetch(`${API_BASE}/tickets`);
        if (!response.ok) throw new Error('Failed to load support tickets.');
        
        tickets = await response.json();
        
        const tbody = document.getElementById('tickets-list');
        if (tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No IT support tickets.</td></tr>';
            return;
        }

        tbody.innerHTML = tickets.map(t => {
            let statusBadge = 'badge-warning';
            if (t.status === 'Closed') statusBadge = 'badge-success';
            if (t.status === 'In Progress') statusBadge = 'badge-info';
            if (t.status === 'Rejected') statusBadge = 'badge-danger';
            
            // Build action buttons depending on current status
            let actions = '';
            if (t.status === 'Open') {
                actions = `
                    <button class="btn btn-secondary btn-success btn-icon-only" onclick="updateTicketStatus('${t.ticket_id}', 'In Progress')" title="Accept Ticket">
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <button class="btn btn-secondary btn-danger btn-icon-only" onclick="updateTicketStatus('${t.ticket_id}', 'Rejected')" title="Reject Ticket">
                        <i class="fa-solid fa-ban"></i>
                    </button>
                `;
            } else if (t.status === 'In Progress') {
                actions = `
                    <button class="btn btn-secondary btn-success btn-icon-only" style="background-color: rgba(16, 185, 129, 0.15); color: var(--success);" onclick="updateTicketStatus('${t.ticket_id}', 'Closed')" title="Resolve Ticket">
                        <i class="fa-solid fa-check"></i>
                    </button>
                `;
            } else {
                actions = '<span class="text-muted">No Actions</span>';
            }

            return `
                <tr>
                    <td><strong>${t.ticket_id}</strong></td>
                    <td>${t.emp_name} (${t.emp_id})</td>
                    <td>${t.item}</td>
                    <td><span class="badge ${statusBadge}">${t.status}</span></td>
                    <td><div style="display: flex; gap: 0.3rem;">${actions}</div></td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        showAlert(error.message, 'danger');
    }
}

// Raise ticket
async function createTicket(event) {
    event.preventDefault();
    const emp_id = document.getElementById('ticket-emp').value;
    const item = document.getElementById('ticket-item').value;
    const reason = document.getElementById('ticket-reason').value;

    try {
        const response = await fetch(`${API_BASE}/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emp_id, item, reason })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Could not raise ticket.');
        }

        const data = await response.json();
        showAlert(data.message, 'success');
        document.getElementById('ticket-form').reset();
        fetchTickets();
        fetchDashboardData();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// Update ticket status
async function updateTicketStatus(ticketId, newStatus) {
    try {
        const response = await fetch(`${API_BASE}/tickets/${ticketId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Could not update ticket status.');
        }

        const data = await response.json();
        showAlert(data.message, 'success');
        fetchTickets();
        fetchDashboardData();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// 6. Automated Onboarding Sequence
async function runOnboarding(event) {
    event.preventDefault();
    
    const employee_name = document.getElementById('onboard-name').value;
    const email = document.getElementById('onboard-email').value;
    const managerSelect = document.getElementById('onboard-manager');
    const manager_name = managerSelect.options[managerSelect.selectedIndex].text.split(' (')[0];
    
    // UI state updates: show logs card, disable buttons, reset items
    const logsCard = document.getElementById('onboard-logs-card');
    const logsList = document.getElementById('onboard-logs-list');
    const submitBtn = document.getElementById('onboard-submit-btn');
    const progressFill = document.getElementById('onboard-progress-fill');
    const progressPercent = document.getElementById('onboard-progress-percent');
    const sequenceBadge = document.getElementById('onboard-sequence-badge');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Triggering Backend Agent...';
    
    logsCard.style.display = 'block';
    sequenceBadge.className = 'badge badge-warning';
    sequenceBadge.textContent = 'Running';
    progressFill.style.width = '0%';
    progressPercent.textContent = '0% Completed';
    
    logsList.innerHTML = `
        <li class="log-step-item pending" id="log-step-1">
            <span class="step-number">1</span>
            <div class="step-details">
                <h4>Checking Reporting Manager...</h4>
                <p>Retrieving supervisor details from directory.</p>
            </div>
        </li>
    `;
    
    try {
        // Run API post call
        const response = await fetch(`${API_BASE}/onboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_name, manager_name, email })
        });
        
        if (!response.ok) {
            throw new Error('Onboarding trigger rejected by server.');
        }
        
        const data = await response.json();
        const logs = data.logs;
        const totalSteps = 9;
        
        // Simulating progressive animation rendering of logs for visual feedback
        for (let i = 0; i < totalSteps; i++) {
            const stepNum = i + 1;
            const logItem = logs[i] || { 
                step: stepNum, 
                title: `Workflow Step ${stepNum}`, 
                status: 'FAILED', 
                detail: 'No return log content received.' 
            };
            
            // Wait 600ms between displaying each step to give an amazing agentic workflow feel
            await new Promise(resolve => setTimeout(resolve, 600));
            
            // Build current list item HTML
            const stepStatus = logItem.status.toLowerCase(); // success, failed, skipped, error
            const isSuccess = stepStatus === 'success';
            const itemHTML = `
                <span class="step-number">${stepNum}</span>
                <div class="step-details">
                    <h4>${logItem.title} <span class="badge ${isSuccess ? 'badge-success' : 'badge-danger'}">${logItem.status}</span></h4>
                    <p>${logItem.detail}</p>
                </div>
            `;
            
            // Find existing or append new log item
            let stepEl = document.getElementById(`log-step-${stepNum}`);
            if (!stepEl) {
                stepEl = document.createElement('li');
                stepEl.id = `log-step-${stepNum}`;
                logsList.appendChild(stepEl);
            }
            
            stepEl.className = `log-step-item ${isSuccess ? 'success' : 'failed'}`;
            stepEl.innerHTML = itemHTML;
            
            // Update progress bar
            const percent = Math.round((stepNum / totalSteps) * 100);
            progressFill.style.width = `${percent}%`;
            progressPercent.textContent = `${percent}% Completed`;
            
            // Scroll logs container to bottom
            const logsWrapper = document.querySelector('.logs-wrapper');
            logsWrapper.scrollTop = logsWrapper.scrollHeight;
            
            // Add placeholder for NEXT step if running
            if (stepNum < totalSteps && data.status === 'success') {
                const nextStepNum = stepNum + 1;
                const nextPlaceholder = document.createElement('li');
                nextPlaceholder.id = `log-step-${nextStepNum}`;
                nextPlaceholder.className = 'log-step-item pending';
                nextPlaceholder.innerHTML = `
                    <span class="step-number">${nextStepNum}</span>
                    <div class="step-details">
                        <h4>Executing step ${nextStepNum}...</h4>
                        <p>Awaiting process status...</p>
                    </div>
                `;
                logsList.appendChild(nextPlaceholder);
            }
        }
        
        if (data.status === 'success') {
            showAlert(`Successfully completed automated onboarding for ${employee_name}.`, 'success');
            sequenceBadge.className = 'badge badge-success';
            sequenceBadge.textContent = 'Completed';
        } else {
            showAlert(`Onboarding workflow failed during execution. Please check step logs.`, 'danger');
            sequenceBadge.className = 'badge badge-danger';
            sequenceBadge.textContent = 'Failed';
        }
        
        // Refresh directory data
        fetchData();
        document.getElementById('onboard-form').reset();
        
    } catch (error) {
        console.error(error);
        showAlert(error.message, 'danger');
        sequenceBadge.className = 'badge badge-danger';
        sequenceBadge.textContent = 'Failed';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start 9-Step Onboarding Checklist';
    }
}

// 7. View Employee Profile Details
async function viewEmployeeDetails(empId) {
    try {
        const response = await fetch(`${API_BASE}/employees/${empId}/profile`);
        if (!response.ok) throw new Error('Failed to retrieve employee profile.');
        
        const profile = await response.json();
        
        // Update initials
        const nameParts = profile.name.split(' ');
        const initials = nameParts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('profile-initials').textContent = initials;
        
        // Update basic info
        document.getElementById('profile-name').textContent = profile.name;
        document.getElementById('profile-id-email').textContent = `${profile.emp_id} | ${profile.email}`;
        
        // Update Manager and Reports
        document.getElementById('profile-manager').textContent = profile.manager_id 
            ? `${profile.manager_name} (${profile.manager_id})` 
            : 'None (Leadership)';
            
        const reportsText = profile.direct_reports.length === 0
            ? 'None'
            : profile.direct_reports.map(r => `${r.name} (${r.emp_id})`).join(', ');
        document.getElementById('profile-reports').textContent = reportsText;
        
        // Update Leave balance and history
        document.getElementById('profile-leave-balance').textContent = `${profile.leave_balance} Days remaining`;
        
        const histEl = document.getElementById('profile-leave-history');
        if (profile.leave_history.length === 0) {
            histEl.innerHTML = '<span class="text-muted">No leave history</span>';
        } else {
            histEl.innerHTML = profile.leave_history.map(d => `<span class="badge badge-info">${d}</span>`).join('');
        }
        
        // Update Meetings timeline
        const meetingsEl = document.getElementById('profile-meetings');
        if (profile.meetings.length === 0) {
            meetingsEl.innerHTML = '<div class="empty-state" style="padding: 0.5rem; text-align: left;">No meetings scheduled.</div>';
        } else {
            meetingsEl.innerHTML = profile.meetings.map(m => `
                <div class="ticket-activity-item" style="padding: 0.5rem 0.75rem; background-color: rgba(255,255,255,0.01); justify-content: space-between;">
                    <div>
                        <strong style="font-size: 0.85rem; color: var(--text-primary);">${m.title}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);"><i class="fa-solid fa-location-dot"></i> ${m.location}</div>
                    </div>
                    <span class="badge badge-accent" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">${m.date} @ ${m.time}</span>
                </div>
            `).join('');
        }
        
        // Update IT Tickets
        const ticketsEl = document.getElementById('profile-tickets');
        if (profile.tickets.length === 0) {
            ticketsEl.innerHTML = '<div class="empty-state" style="padding: 0.5rem; text-align: left;">No support tickets raised.</div>';
        } else {
            ticketsEl.innerHTML = profile.tickets.map(t => {
                let badgeClass = 'badge-warning';
                if (t.status === 'Closed') badgeClass = 'badge-success';
                if (t.status === 'In Progress') badgeClass = 'badge-info';
                if (t.status === 'Rejected') badgeClass = 'badge-danger';
                
                return `
                    <div class="ticket-activity-item" style="padding: 0.5rem 0.75rem; background-color: rgba(255,255,255,0.01); justify-content: space-between;">
                        <div>
                            <strong style="font-size: 0.85rem; color: var(--text-primary);">${t.item}</strong>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${t.reason}</div>
                        </div>
                        <span class="badge ${badgeClass}" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">${t.ticket_id} | ${t.status}</span>
                    </div>
                `;
            }).join('');
        }
        
        // Show Modal
        document.getElementById('view-employee-modal').classList.add('active');
        
    } catch (error) {
        console.error(error);
        showAlert(error.message, 'danger');
    }
}

function closeViewEmployeeModal() {
    document.getElementById('view-employee-modal').classList.remove('active');
}

// 8. Reschedule Meeting Dialog handlers
function openRescheduleModal(empId, empName, currentDatetimeIso, currentTopic) {
    document.getElementById('reschedule-emp-id').value = empId;
    document.getElementById('reschedule-old-datetime').value = currentDatetimeIso;
    document.getElementById('reschedule-emp-name').value = `${empName} (${empId})`;
    
    // Format the current datetime for display
    const dt = new Date(currentDatetimeIso);
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('reschedule-current-time').value = dt.toLocaleDateString('en-US', options);
    
    // Set the inputs for edit
    // Convert current ISO time string (YYYY-MM-DDTHH:MM:SS) to match datetime-local format (YYYY-MM-DDTHH:MM)
    const formattedDatetimeLocal = currentDatetimeIso.substring(0, 16);
    document.getElementById('reschedule-new-datetime').value = formattedDatetimeLocal;
    document.getElementById('reschedule-topic').value = currentTopic;
    
    document.getElementById('reschedule-meeting-modal').classList.add('active');
}

function closeRescheduleModal() {
    document.getElementById('reschedule-meeting-modal').classList.remove('active');
}

async function rescheduleMeeting(event) {
    event.preventDefault();
    const emp_id = document.getElementById('reschedule-emp-id').value;
    const old_datetime = document.getElementById('reschedule-old-datetime').value;
    const new_datetime = document.getElementById('reschedule-new-datetime').value; // YYYY-MM-DDTHH:MM
    const topic = document.getElementById('reschedule-topic').value;

    try {
        const response = await fetch(`${API_BASE}/meetings/reschedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emp_id, old_datetime, new_datetime, topic })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Could not reschedule meeting.');
        }

        const data = await response.json();
        showAlert(data.message, 'success');
        closeRescheduleModal();
        fetchMeetings();
        fetchDashboardData();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}
