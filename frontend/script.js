let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

// Check if user is logged in
function checkAuth() {
    if (authToken) {
        showDashboard();
    } else {
        showLoginPage();
    }
}

// Toggle between login and registration
// Helper function for quick demo login
function quickDemoLogin(email, password) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
    // Trigger form submission
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
}

function toggleAuthPage() {
    const loginPage = document.getElementById('login-page');
    const registerPage = document.getElementById('register-page');
    if (loginPage.style.display === 'none') {
        loginPage.style.display = 'block';
        registerPage.style.display = 'none';
    } else {
        loginPage.style.display = 'none';
        registerPage.style.display = 'block';
    }
}

// Show login page
function showLoginPage() {
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('register-page').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('admin-section').style.display = 'none';
    document.getElementById('user-info').style.display = 'none';
}

// Show dashboard
function showDashboard() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('register-page').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('user-info').style.display = 'flex';
    document.getElementById('user-name').textContent = currentUser.name || 'User';
    
    // Show role-based buttons
    // Payroll tab visible to all users
    document.getElementById('payroll-tab').style.display = 'block';
    
    // Reports tab visible to managers/admins
    if (currentUser.role === 'MANAGER' || currentUser.role === 'SUPERVISOR' || currentUser.role === 'ADMIN') {
        document.getElementById('reports-tab').style.display = 'block';
    }
    
    // Management tab visible to managers/supervisors/admins
    if (currentUser.role === 'MANAGER' || currentUser.role === 'SUPERVISOR' || currentUser.role === 'ADMIN') {
        document.getElementById('manager-btn').style.display = 'block';
    }
    
    if (currentUser.role === 'ADMIN') {
        document.getElementById('admin-btn').style.display = 'block';
    }
    
    loadUserRecords();
    loadOvertimeReport();
}

// Display overtime report
function displayOvertimeReport(data) {
    const overtimeDiv = document.getElementById('overtime-data');
    overtimeDiv.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = 'overtime-summary';
    summary.innerHTML = `
        <h3>Total Overtime (Last 30 Days): <span class="overtime-value">${data.totalDailyOvertime} hrs</span></h3>
    `;
    overtimeDiv.appendChild(summary);

    if (data.records.length === 0) {
        overtimeDiv.innerHTML += '<p style="text-align: center; color: #a0522d;">No records in the last 30 days</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'overtime-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Date</th>
                <th>Hours Worked</th>
                <th>Daily Overtime</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    data.records.forEach(record => {
        const tbody = table.querySelector('tbody');
        const row = document.createElement('tr');
        const date = new Date(record.date).toLocaleDateString();
        const hoursWorked = parseFloat(record.hoursWorked) || 0;
        const dailyOT = parseFloat(record.dailyOvertime) || 0;

        const rowClass = dailyOT > 0 ? 'overtime-row' : '';
        row.className = rowClass;
        row.innerHTML = `
            <td>${date}</td>
            <td>${record.hoursWorked} hrs</td>
            <td style="font-weight: bold; color: ${dailyOT > 0 ? '#e74c3c' : '#27ae60'};">${record.dailyOvertime} hrs</td>
        `;
        tbody.appendChild(row);
    });

    overtimeDiv.appendChild(table);
}

// Update time displays
function updateTime() {
    const now = new Date();
    
    // Header time
    const timeString = now.toLocaleTimeString();
    document.getElementById('time-display').textContent = timeString;
    
    // Clock display time (if visible)
    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) {
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        currentTimeEl.textContent = `${hours}:${minutes}`;
    }
    
    // Clock display date (if visible)
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateString = now.toLocaleDateString('en-US', options);
        currentDateEl.textContent = dateString;
    }
}

// Update time every second
setInterval(updateTime, 1000);
updateTime();

// LOGIN HANDLER
const loginFormEl = document.getElementById('login-form');
if (loginFormEl) {
    loginFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const statusEl = document.getElementById('login-status');

        // Validation
        if (!email || !password) {
            showStatus(statusEl, '⚠ Please fill in all fields', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showStatus(statusEl, '⚠ Please enter a valid email address', 'error');
            return;
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (response.ok) {
                const data = await response.json();
                authToken = data.token;
                currentUser = { id: data.userId, name: data.name, email: email, role: data.role || 'EMPLOYEE' };
                
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                showStatus(statusEl, '✓ Login successful!', 'success');
                setTimeout(() => showDashboard(), 500);
            } else {
                const error = await response.json();
                showStatus(statusEl, error.message || 'Invalid credentials', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showStatus(statusEl, 'Connection error. Please try again.', 'error');
        }
    });
}

// REGISTRATION HANDLER
const registerFormEl = document.getElementById('register-form');
if (registerFormEl) {
    registerFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name')?.value?.trim() || '';
        const email = document.getElementById('register-email')?.value?.trim() || '';
        const password = document.getElementById('register-password')?.value || '';
        const statusEl = document.getElementById('register-status');

        console.log('Registration form submitted:', { name, email, passwordLength: password.length });

        // Validation
        if (!name || !email || !password) {
            showStatus(statusEl, '⚠ Please fill in all fields', 'error');
            return;
        }

        if (name.length < 2) {
            showStatus(statusEl, '⚠ Name must be at least 2 characters', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showStatus(statusEl, '⚠ Please enter a valid email address', 'error');
            return;
        }

        if (password.length < 6) {
            showStatus(statusEl, '⚠ Password must be at least 6 characters', 'error');
            return;
        }

        try {
            console.log('Sending registration request to /users');
            const response = await fetch('/users', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ name, email, password }),
            });
            
            console.log('Registration response status:', response.status);
            const responseData = await response.json();
            console.log('Registration response data:', responseData);

            if (response.ok) {
                showStatus(statusEl, '✓ Registration successful! Please login with your credentials.', 'success');
                setTimeout(() => {
                    document.getElementById('register-form').reset();
                    toggleAuthPage();
                    // Prefill email on login form
                    document.getElementById('login-email').value = email;
                }, 500);
            } else {
                const errorMsg = responseData.message || responseData.error || 'Registration failed';
                console.error('Registration error:', errorMsg);
                showStatus(statusEl, `❌ ${errorMsg}`, 'error');
            }
        } catch (error) {
            console.error('Registration error - Full details:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            showStatus(statusEl, `Connection error: ${error.message}`, 'error');
        }
    });
} else {
    console.warn('Register form element not found');
}

// Email validation helper
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Export records as CSV
const exportRecordsBtn = document.getElementById('export-records-btn');
if (exportRecordsBtn) {
    exportRecordsBtn.addEventListener('click', function() {
        const recordsTable = document.querySelector('#records-list table');
        if (!recordsTable) {
            alert('No records to export');
            return;
        }

        let csv = 'Date,Clock In,Clock Out,Hours Worked\n';
        
        const rows = recordsTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const date = cells[0].textContent;
            const clockIn = cells[1].textContent;
            const clockOut = cells[2].textContent;
            const hours = cells[3].textContent;
            
            csv += `"${date}","${clockIn}","${clockOut}","${hours}"\n`;
        });

        downloadCSV(csv, `work-records-${new Date().toISOString().split('T')[0]}.csv`);
    });
}

// Export payroll as CSV
const exportPayrollBtn = document.getElementById('export-payroll-btn');
if (exportPayrollBtn) {
    exportPayrollBtn.addEventListener('click', function() {
        const payrollTable = document.querySelector('#payroll-table-data');
        if (!payrollTable) {
            alert('No payroll data to export');
            return;
        }

        let csv = 'Employee Name,Email,Total Hours,Records\n';
        
        const rows = payrollTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            if (row.style.display !== 'none') { // Only export visible rows
                const cells = row.querySelectorAll('td');
                const name = cells[0].textContent;
                const email = cells[1].textContent;
                const hours = cells[2].textContent;
                const records = cells[3].textContent;
                
                csv += `"${name}","${email}","${hours}","${records}"\n`;
            }
        });

        downloadCSV(csv, `payroll-report-${new Date().toISOString().split('T')[0]}.csv`);
    });
}

// Helper function to download CSV
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// CLOCK IN HANDLER
const clockInBtn = document.getElementById('clock-in-btn');
if (clockInBtn) {
    clockInBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/clock-in', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ timestamp: new Date() }),
            });
            
            if (response.ok) {
                showStatus(document.getElementById('clock-status'), `✓ Clocked in successfully at ${new Date().toLocaleTimeString()}`, 'success');
                loadUserRecords();
            } else {
                const error = await response.json();
                showStatus(document.getElementById('clock-status'), error.message || 'Error clocking in', 'error');
            }
        } catch (error) {
            console.error('Clock in error:', error);
            showStatus(document.getElementById('clock-status'), 'Connection error', 'error');
        }
    });
}

// CLOCK OUT HANDLER
const clockOutBtn = document.getElementById('clock-out-btn');
if (clockOutBtn) {
    clockOutBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/clock-out', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ timestamp: new Date() }),
            });
            
            if (response.ok) {
                showStatus(document.getElementById('clock-status'), `✓ Clocked out successfully at ${new Date().toLocaleTimeString()}`, 'success');
                loadUserRecords();
            } else {
                const error = await response.json();
                showStatus(document.getElementById('clock-status'), error.message || 'Error clocking out', 'error');
            }
        } catch (error) {
            console.error('Clock out error:', error);
            showStatus(document.getElementById('clock-status'), 'Connection error', 'error');
        }
    });
}

// BREAK START HANDLER
const breakStartBtn = document.getElementById('break-start-btn');
if (breakStartBtn) {
    breakStartBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/break-start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
            });

            if (response.ok) {
                showStatus(document.getElementById('break-status'), '✓ Break started', 'success');
                document.getElementById('active-break').style.display = 'block';
                updateBreakTimer();
                setInterval(updateBreakTimer, 1000);
            } else {
                const error = await response.json();
                showStatus(document.getElementById('break-status'), error.message || 'Error starting break', 'error');
            }
        } catch (error) {
            console.error('Break start error:', error);
            showStatus(document.getElementById('break-status'), 'Connection error', 'error');
        }
    });
}

// BREAK END HANDLER
const breakEndBtn = document.getElementById('break-end-btn');
if (breakEndBtn) {
    breakEndBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/break-end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
            });

            if (response.ok) {
                showStatus(document.getElementById('break-status'), '✓ Break ended', 'success');
                document.getElementById('active-break').style.display = 'none';
                loadUserRecords();
            } else {
                const error = await response.json();
                showStatus(document.getElementById('break-status'), error.message || 'Error ending break', 'error');
            }
        } catch (error) {
            console.error('Break end error:', error);
            showStatus(document.getElementById('break-status'), 'Connection error', 'error');
        }
    });
}

// Update break timer
let breakStartTime = null;

function updateBreakTimer() {
    if (!breakStartTime) {
        breakStartTime = new Date();
    }
    
    const elapsed = new Date() - breakStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    document.getElementById('break-time').textContent = 
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// LOGOUT HANDLER
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        authToken = null;
        currentUser = {};
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        showLoginPage();
    });
}

// Load user's work records
async function loadUserRecords() {
    try {
        const response = await fetch('/my-records', {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (response.ok) {
            const records = await response.json();
            displayRecords(records);
        }
    } catch (error) {
        console.error('Error loading records:', error);
    }
}

// Load overtime report
async function loadOvertimeReport() {
    try {
        const response = await fetch('/overtime-report', {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (response.ok) {
            const data = await response.json();
            displayOvertimeReport(data);
        }
    } catch (error) {
        console.error('Error loading overtime:', error);
    }
}

// Display work records
function displayRecords(records) {
    const recordsList = document.getElementById('records-list');
    recordsList.innerHTML = '';

    if (records.length === 0) {
        recordsList.innerHTML = '<p style="text-align: center; color: #a0522d;">No records yet</p>';
        return;
    }

    let totalHours = 0;
    const table = document.createElement('table');
    table.className = 'records-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Net Hours</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    records.forEach(record => {
        const tbody = table.querySelector('tbody');
        const row = document.createElement('tr');
        const date = new Date(record.date).toLocaleDateString();
        const clockIn = record.clockInTime ? new Date(record.clockInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
        const clockOut = record.clockOutTime ? new Date(record.clockOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
        const hours = parseFloat(record.hoursWorked) || 0;
        totalHours += hours;

        row.innerHTML = `
            <td>${date}</td>
            <td>${clockIn}</td>
            <td>${clockOut}</td>
            <td style="font-weight: bold;">${record.hoursWorked} hrs</td>
        `;
        tbody.appendChild(row);
    });

    recordsList.appendChild(table);
    const totalEl = document.createElement('div');
    totalEl.className = 'total-hours';
    totalEl.innerHTML = `<strong>Total Hours Worked: ${totalHours.toFixed(2)} hrs</strong>`;
    recordsList.appendChild(totalEl);
}

// Load payroll data (admin)
async function loadPayrollData() {
    try {
        const response = await fetch('/admin/payroll');
        if (response.ok) {
            const data = await response.json();
            displayPayrollData(data);
        }
    } catch (error) {
        console.error('Error loading payroll data:', error);
    }
}

// Display payroll data
function displayPayrollData(payrollData) {
    const payrollDiv = document.getElementById('payroll-data');
    payrollDiv.innerHTML = '';

    if (payrollData.length === 0) {
        payrollDiv.innerHTML = '<p style="text-align: center; color: #a0522d;">No employee data</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'payroll-table';
    table.id = 'payroll-table-data';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Employee Name</th>
                <th>Email</th>
                <th>Total Hours</th>
                <th>Records</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    payrollData.forEach(employee => {
        const tbody = table.querySelector('tbody');
        const row = document.createElement('tr');
        const recordCount = employee.records.length;

        row.innerHTML = `
            <td class="employee-name">${employee.name}</td>
            <td class="employee-email">${employee.email}</td>
            <td style="font-weight: bold;">${employee.totalHours} hrs</td>
            <td>${recordCount}</td>
        `;
        tbody.appendChild(row);
    });

    payrollDiv.appendChild(table);
}

// Search employees
document.addEventListener('input', function(e) {
    if (e.target.id === 'search-employees') {
        const searchTerm = e.target.value.toLowerCase();
        const tableBody = document.querySelector('#payroll-table-data tbody');
        if (!tableBody) return;

        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const name = row.querySelector('.employee-name').textContent.toLowerCase();
            const email = row.querySelector('.employee-email').textContent.toLowerCase();
            
            if (name.includes(searchTerm) || email.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
});

// ==================== HR FEATURES ====================

// Tab switching function
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }
    
    // Mark button as active
    event.target.classList.add('active');
    
    // Load data for the tab
    if (tabName === 'leave-shift') {
        loadLeaveRequests();
        loadShiftAssignments();
        loadShiftSwaps();
    } else if (tabName === 'management') {
        loadTeamAttendance();
        loadApprovalRequests();
        loadTeamPerformance();
    } else if (tabName === 'admin') {
        loadDepartments();
        loadAllUsers();
    }
}

// LEAVE REQUEST MANAGEMENT
const leaveFormEl = document.getElementById('leave-request-form');
if (leaveFormEl) {
    leaveFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('leave-type').value;
        const startDate = document.getElementById('leave-start-date').value;
        const endDate = document.getElementById('leave-end-date').value;
        const reason = document.getElementById('leave-reason').value;
        const statusEl = document.getElementById('leave-status');
        
        if (!startDate || !endDate) {
            showStatus(statusEl, '⚠ Please select start and end dates', 'error');
            return;
        }
        
        try {
            const response = await fetch('/leave-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ type, startDate, endDate, reason })
            });
            
            if (response.ok) {
                showStatus(statusEl, '✓ Leave request submitted!', 'success');
                leaveFormEl.reset();
                loadLeaveRequests();
            } else {
                const error = await response.json();
                showStatus(statusEl, error.message || 'Failed to submit request', 'error');
            }
        } catch (error) {
            showStatus(statusEl, `Connection error: ${error.message}`, 'error');
        }
    });
}

async function loadLeaveRequests() {
    try {
        const response = await fetch('/leave-requests', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) return;
        const requests = await response.json();
        const container = document.getElementById('leave-requests-list');
        
        if (requests.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #a0522d;">No leave requests</p>';
            return;
        }
        
        const html = requests.map(req => `
            <div class="leave-request-card">
                <div class="leave-header">
                    <span class="leave-type">${req.type}</span>
                    <span class="status-badge ${req.status.toLowerCase()}">${req.status}</span>
                </div>
                <div>Dates: ${new Date(req.startDate).toLocaleDateString()} - ${new Date(req.endDate).toLocaleDateString()}</div>
                <div>Reason: ${req.reason || 'N/A'}</div>
                ${req.status === 'REJECTED' && req.rejectionReason ? `<div style="color: #e74c3c;">Rejection: ${req.rejectionReason}</div>` : ''}
            </div>
        `).join('');
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading leave requests:', error);
    }
}

// SHIFT ASSIGNMENTS
async function loadShiftAssignments() {
    try {
        const response = await fetch('/my-shift-assignments', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) return;
        const assignments = await response.json();
        const container = document.getElementById('shift-assignments-list');
        
        if (assignments.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #a0522d;">No shift assignments</p>';
            return;
        }
        
        const html = assignments.map(assign => `
            <div class="shift-assignment-card">
                <div class="shift-info">
                    <strong>${assign.shift.name}</strong> - ${assign.shift.startTime} to ${assign.shift.endTime}
                </div>
                <div>Date: ${new Date(assign.date).toLocaleDateString()}</div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading shift assignments:', error);
    }
}

// SHIFT SWAP REQUESTS
const swapFormEl = document.getElementById('shift-swap-form');
if (swapFormEl) {
    swapFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const requestedEmployeeId = parseInt(document.getElementById('swap-employee-id').value);
        const originalShiftDate = document.getElementById('swap-original-date').value;
        const requestedShiftDate = document.getElementById('swap-requested-date').value;
        const reason = document.getElementById('swap-reason').value;
        const statusEl = document.getElementById('shift-swap-status');
        
        if (!requestedEmployeeId || !originalShiftDate || !requestedShiftDate) {
            showStatus(statusEl, '⚠ Please fill all required fields', 'error');
            return;
        }
        
        try {
            const response = await fetch('/shift-swap-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ requestedEmployeeId, originalShiftDate, requestedShiftDate, reason })
            });
            
            if (response.ok) {
                showStatus(statusEl, '✓ Shift swap request sent!', 'success');
                swapFormEl.reset();
                loadShiftSwaps();
            } else {
                const error = await response.json();
                showStatus(statusEl, error.message || 'Failed to request swap', 'error');
            }
        } catch (error) {
            showStatus(statusEl, `Connection error: ${error.message}`, 'error');
        }
    });
}

async function loadShiftSwaps() {
    try {
        const response = await fetch('/shift-swap-requests', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) return;
        const swaps = await response.json();
        const container = document.getElementById('shift-swaps-list');
        
        if (swaps.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #a0522d;">No shift swap requests</p>';
            return;
        }
        
        const html = swaps.map(swap => `
            <div class="swap-request-card">
                <div class="swap-header">
                    <span>${swap.initiatedBy.name} ↔ ${swap.requestedEmployee.name}</span>
                    <span class="status-badge ${swap.status.toLowerCase()}">${swap.status}</span>
                </div>
                <div>Original: ${new Date(swap.originalShiftDate).toLocaleDateString()}</div>
                <div>Requested: ${new Date(swap.requestedShiftDate).toLocaleDateString()}</div>
                ${swap.reason ? `<div>Reason: ${swap.reason}</div>` : ''}
            </div>
        `).join('');
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading shift swaps:', error);
    }
}

// ATTENDANCE TRACKING (for managers)
async function loadTeamAttendance() {
    if (currentUser.role !== 'MANAGER' && currentUser.role !== 'SUPERVISOR' && currentUser.role !== 'ADMIN') return;
    
    try {
        const response = await fetch('/attendance-records', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) return;
        const records = await response.json();
        const container = document.getElementById('attendance-list');
        
        if (records.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #a0522d;">No attendance records</p>';
            return;
        }
        
        const html = records.map(rec => `
            <div class="attendance-card">
                <div class="attendance-header">
                    <strong>${rec.user.name}</strong>
                    <span class="status-badge ${rec.status.toLowerCase()}">${rec.status}</span>
                </div>
                <div>Date: ${new Date(rec.date).toLocaleDateString()}</div>
                <div>Clock In: ${rec.clockInTime ? new Date(rec.clockInTime).toLocaleTimeString() : 'N/A'}</div>
                <div>Clock Out: ${rec.clockOutTime ? new Date(rec.clockOutTime).toLocaleTimeString() : 'N/A'}</div>
                ${rec.minutesLate > 0 ? `<div style="color: #e74c3c;">Late: ${rec.minutesLate} minutes</div>` : ''}
                ${rec.notes ? `<div>Notes: ${rec.notes}</div>` : ''}
            </div>
        `).join('');
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

// APPROVAL REQUESTS (for managers)
async function loadApprovalRequests() {
    if (currentUser.role !== 'MANAGER' && currentUser.role !== 'SUPERVISOR' && currentUser.role !== 'ADMIN') return;
    
    try {
        const response = await fetch('/approval-requests', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) return;
        const requests = await response.json();
        const container = document.getElementById('approval-requests-list');
        
        const pending = requests.filter(r => r.status === 'PENDING');
        
        if (pending.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #a0522d;">No pending approvals</p>';
            return;
        }
        
        const html = pending.map(req => `
            <div class="approval-card">
                <div class="approval-header">
                    <strong>${req.type}</strong> - ${req.requestedBy.name}
                    <span class="status-badge pending">PENDING</span>
                </div>
                <div>Requested: ${new Date(req.createdAt).toLocaleDateString()}</div>
                <div class="approval-actions">
                    <button class="btn btn-small btn-approve" onclick="approveRequest(${req.id})">✓ Approve</button>
                    <button class="btn btn-small btn-reject" onclick="rejectRequest(${req.id})">✗ Reject</button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading approval requests:', error);
    }
}

async function approveRequest(id) {
    try {
        const response = await fetch(`/approval-requests/${id}/approve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ approverNotes: '' })
        });
        
        if (response.ok) {
            alert('Request approved!');
            loadApprovalRequests();
        }
    } catch (error) {
        console.error('Error approving request:', error);
    }
}

async function rejectRequest(id) {
    const notes = prompt('Rejection reason:');
    if (!notes) return;
    
    try {
        const response = await fetch(`/approval-requests/${id}/reject`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ approverNotes: notes })
        });
        
        if (response.ok) {
            alert('Request rejected!');
            loadApprovalRequests();
        }
    } catch (error) {
        console.error('Error rejecting request:', error);
    }
}

// PERFORMANCE METRICS (for managers)
async function loadTeamPerformance() {
    if (currentUser.role !== 'MANAGER' && currentUser.role !== 'SUPERVISOR' && currentUser.role !== 'ADMIN') return;
    
    try {
        const response = await fetch('/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) return;
        const users = await response.json();
        const container = document.getElementById('team-performance-list');
        
        if (users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #a0522d;">No team members</p>';
            return;
        }
        
        const html = users.map(user => `
            <div class="performance-card">
                <div class="perf-header">
                    <strong>${user.name}</strong>
                    <span>${user.email}</span>
                </div>
                <div class="perf-actions">
                    <button class="btn btn-small" onclick="viewUserMetrics(${user.id}, '${user.name}')">View Metrics</button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading performance:', error);
    }
}

async function viewUserMetrics(userId, userName) {
    try {
        const response = await fetch(`/performance-metrics/${userId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) return;
        const metrics = await response.json();
        
        let html = `<h3>${userName} - Performance Metrics</h3>`;
        if (metrics.length === 0) {
            html += '<p>No performance metrics recorded</p>';
        } else {
            html += metrics.map(m => `
                <div class="metric-row">
                    <div>Period: ${m.period}</div>
                    <div>Rating: ${m.rating}</div>
                    <div>Quality: ${m.quality}/100</div>
                    <div>Attendance: ${m.attendance}/100</div>
                    <div>Productivity: ${m.productivity}/100</div>
                    <div>Teamwork: ${m.teamwork}/100</div>
                </div>
            `).join('');
        }
        
        const container = document.getElementById('team-performance-list');
        container.innerHTML = html + '<button class="btn btn-small" onclick="loadTeamPerformance()">Back</button>';
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

// DEPARTMENT MANAGEMENT (admin only)
const deptFormEl = document.getElementById('create-department-form');
if (deptFormEl) {
    deptFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('dept-name').value;
        const description = document.getElementById('dept-description').value;
        const statusEl = document.getElementById('create-dept-status');
        
        try {
            const response = await fetch('/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ name, description })
            });
            
            if (response.ok) {
                showStatus(statusEl, '✓ Department created!', 'success');
                deptFormEl.reset();
                loadDepartments();
            } else {
                const error = await response.json();
                showStatus(statusEl, error.message || 'Failed to create department', 'error');
            }
        } catch (error) {
            showStatus(statusEl, `Connection error: ${error.message}`, 'error');
        }
    });
}

async function loadDepartments() {
    try {
        const response = await fetch('/departments', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) return;
        const departments = await response.json();
        const container = document.getElementById('departments-list');
        
        if (departments.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #a0522d;">No departments</p>';
            return;
        }
        
        const html = departments.map(dept => `
            <div class="department-card">
                <div class="dept-header">
                    <strong>${dept.name}</strong>
                    <span class="dept-count">${dept.employees.length} employees</span>
                </div>
                ${dept.description ? `<div>${dept.description}</div>` : ''}
                ${dept.manager ? `<div>Manager: ${dept.manager.name}</div>` : ''}
            </div>
        `).join('');
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

// USER ROLE MANAGEMENT (admin only)
async function loadAllUsers() {
    try {
        const response = await fetch('/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) return;
        const users = await response.json();
        const container = document.getElementById('users-list');
        
        if (users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #a0522d;">No users</p>';
            return;
        }
        
        const html = users.map(user => `
            <div class="user-role-card">
                <div class="user-header">
                    <strong>${user.name}</strong>
                    <span class="role-badge">${user.role}</span>
                </div>
                <div>${user.email}</div>
                <div class="role-actions">
                    <select onchange="updateUserRole(${user.id}, this.value)" style="padding: 5px;">
                        <option value="">Change Role...</option>
                        <option value="EMPLOYEE">Employee</option>
                        <option value="MANAGER">Manager</option>
                        <option value="SUPERVISOR">Supervisor</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function updateUserRole(userId, newRole) {
    if (!newRole) return;
    
    try {
        const response = await fetch(`/users/${userId}/update-role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ role: newRole })
        });
        
        if (response.ok) {
            alert('User role updated!');
            loadAllUsers();
        }
    } catch (error) {
        console.error('Error updating role:', error);
    }
}

// Show status message
function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-message ${type}`;
    
    setTimeout(() => {
        element.textContent = '';
        element.className = 'status-message';
    }, 4000);
}

// ===== TAB SWITCHING FUNCTIONS =====
function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.style.display = 'none');
    
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }
    
    // Load tab-specific data
    if (tabName === 'payroll') {
        loadPayrollData();
    } else if (tabName === 'reports') {
        loadReportsData();
    } else if (tabName === 'settings') {
        loadSettingsData();
    }
}

// Attach tab click handlers
document.addEventListener('DOMContentLoaded', function() {
    // Payroll tab
    const payrollTab = document.querySelector('[onclick*="payroll"]');
    if (payrollTab) {
        payrollTab.addEventListener('click', () => switchTab('payroll'));
    }
    
    // Reports tab
    const reportsTab = document.querySelector('[onclick*="reports"]');
    if (reportsTab) {
        reportsTab.addEventListener('click', () => switchTab('reports'));
    }
    
    // Settings tab
    const settingsTab = document.querySelector('[onclick*="settings"]');
    if (settingsTab) {
        settingsTab.addEventListener('click', () => switchTab('settings'));
    }
    
    // Dark mode toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Notification settings form
    const notifForm = document.getElementById('notification-settings-form');
    if (notifForm) {
        notifForm.addEventListener('submit', saveNotificationSettings);
    }
    
    // 2FA setup button
    const setup2FABtn = document.getElementById('setup-2fa-btn');
    if (setup2FABtn) {
        setup2FABtn.addEventListener('click', setup2FA);
    }
    
    // Report generation
    const generateReportBtn = document.getElementById('generate-report-btn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }
});

// ===== PAYROLL TAB FUNCTIONS =====
async function loadPayrollData() {
    try {
        // Load wage information
        const wageResponse = await fetch(`/employee-wages/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (wageResponse.ok) {
            const wage = await wageResponse.json();
            displayWageInfo(wage);
        }
        
        // Load payroll records
        const recordsResponse = await fetch(`/payroll-records/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (recordsResponse.ok) {
            const records = await recordsResponse.json();
            displayPayrollRecords(records);
        }
    } catch (error) {
        console.error('Error loading payroll data:', error);
    }
}

function displayWageInfo(wage) {
    const container = document.getElementById('my-wage-info');
    if (!wage) {
        container.innerHTML = '<p style="color: #a0522d;">No wage information configured.</p>';
        return;
    }
    
    let wageHTML = '<div class="wage-info">';
    
    if (wage.hourlyRate) {
        wageHTML += `
            <div class="wage-box">
                <label>Hourly Rate</label>
                <div class="value">$${wage.hourlyRate.toFixed(2)}</div>
            </div>
        `;
    }
    
    if (wage.monthlySalary) {
        wageHTML += `
            <div class="wage-box">
                <label>Monthly Salary</label>
                <div class="value">$${wage.monthlySalary.toFixed(2)}</div>
            </div>
        `;
    }
    
    if (wage.annualSalary) {
        wageHTML += `
            <div class="wage-box">
                <label>Annual Salary</label>
                <div class="value">$${wage.annualSalary.toFixed(2)}</div>
            </div>
        `;
    }
    
    wageHTML += '</div>';
    container.innerHTML = wageHTML;
}

function displayPayrollRecords(records) {
    const container = document.getElementById('my-payroll-records');
    
    if (!records || records.length === 0) {
        container.innerHTML = '<p style="color: #a0522d;">No payroll records available.</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'records-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Period</th>
                <th>Gross Pay</th>
                <th>Deductions</th>
                <th>Bonuses</th>
                <th>Net Pay</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${records.map(record => `
                <tr>
                    <td>${record.period}</td>
                    <td>$${record.grossPay.toFixed(2)}</td>
                    <td>$${record.totalDeductions.toFixed(2)}</td>
                    <td>$${record.totalBonuses.toFixed(2)}</td>
                    <td><strong>$${record.netPay.toFixed(2)}</strong></td>
                    <td>${record.status}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
}

// ===== REPORTS TAB FUNCTIONS =====
async function loadReportsData() {
    try {
        const response = await fetch('/reports', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const reports = await response.json();
            displayGeneratedReports(reports);
            updateAnalyticsDashboard();
        }
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

function displayGeneratedReports(reports) {
    const container = document.getElementById('generated-reports-list');
    
    if (!reports || reports.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #a0522d;">No reports generated yet.</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'records-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Type</th>
                <th>Period</th>
                <th>Generated</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${reports.map(report => `
                <tr>
                    <td>${report.type}</td>
                    <td>${report.period}</td>
                    <td>${new Date(report.createdAt).toLocaleDateString()}</td>
                    <td>${report.status}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
}

function updateAnalyticsDashboard() {
    // Update analytics stats (mock data for now)
    document.getElementById('total-hours').textContent = '160';
    document.getElementById('total-overtime').textContent = '8';
    document.getElementById('attendance-rate').textContent = '98%';
    document.getElementById('avg-daily-hours').textContent = '8.0';
}

async function generateReport() {
    const reportType = document.getElementById('report-type-select').value;
    const period = document.getElementById('report-period-input').value;
    
    if (!reportType || !period) {
        alert('Please select report type and period');
        return;
    }
    
    try {
        const response = await fetch('/generate-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: reportType,
                period: period
            })
        });
        
        if (response.ok) {
            alert('Report generated successfully!');
            loadReportsData();
        }
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Error generating report');
    }
}

// ===== SETTINGS TAB FUNCTIONS =====
async function loadSettingsData() {
    try {
        const response = await fetch('/notification-settings', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const settings = await response.json();
            displayNotificationSettings(settings);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function displayNotificationSettings(settings) {
    if (settings) {
        document.getElementById('email-notifications').checked = settings.emailNotifications;
        document.getElementById('push-notifications').checked = settings.pushNotifications;
        document.getElementById('clock-in-reminders').checked = settings.clockInReminders;
        document.getElementById('shift-alerts').checked = settings.shiftAlerts;
        document.getElementById('payroll-notifications').checked = settings.payrollNotifications;
        document.getElementById('dark-mode-setting').checked = settings.darkModeEnabled;
    }
}

async function saveNotificationSettings(e) {
    e.preventDefault();
    
    const settings = {
        emailNotifications: document.getElementById('email-notifications').checked,
        pushNotifications: document.getElementById('push-notifications').checked,
        clockInReminders: document.getElementById('clock-in-reminders').checked,
        shiftAlerts: document.getElementById('shift-alerts').checked,
        payrollNotifications: document.getElementById('payroll-notifications').checked,
        darkModeEnabled: document.getElementById('dark-mode-setting').checked
    };
    
    try {
        const response = await fetch('/notification-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            const statusEl = document.getElementById('settings-status');
            showStatus(statusEl, 'Settings saved successfully!', 'success');
            
            // Apply dark mode if enabled
            if (settings.darkModeEnabled) {
                applyDarkMode();
            } else {
                removeDarkMode();
            }
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        const statusEl = document.getElementById('settings-status');
        showStatus(statusEl, 'Error saving settings', 'error');
    }
}

// ===== DARK MODE FUNCTIONS =====
function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    
    // Save preference
    const isDarkMode = body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
}

function applyDarkMode() {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', true);
}

function removeDarkMode() {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', false);
}

// Load dark mode preference on startup
function loadDarkModePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        applyDarkMode();
        const darkModeCheckbox = document.getElementById('dark-mode-setting');
        if (darkModeCheckbox) {
            darkModeCheckbox.checked = true;
        }
    }
}

// ===== 2FA FUNCTIONS =====
async function setup2FA() {
    try {
        const response = await fetch('/2fa-setup', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(`2FA Secret: ${data.secret}\nBackup Codes: ${data.backupCodes.join(', ')}\nSave these in a secure location!`);
        }
    } catch (error) {
        console.error('Error setting up 2FA:', error);
        alert('Error setting up 2FA');
    }
}

// ===== ANALYTICS TRACKING =====
function trackAnalyticsEvent(eventName, metadata = {}) {
    fetch('/analytics-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            eventType: 'USER_ACTION',
            eventName: eventName,
            metadata: metadata
        })
    }).catch(err => console.error('Analytics error:', err));
}

// Track page views
document.addEventListener('DOMContentLoaded', () => {
    trackAnalyticsEvent('PAGE_VIEW', { page: 'dashboard' });
    loadDarkModePreference();
});

// Initialize
checkAuth();