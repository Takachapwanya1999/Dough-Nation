// Update time displays
function updateTime() {
    const now = new Date();
    
    // Header time
    const timeString = now.toLocaleTimeString();
    document.getElementById('time-display').textContent = timeString;
    
    // Clock display time
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('current-time').textContent = `${hours}:${minutes}`;
    
    // Clock display date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString('en-US', options);
    document.getElementById('current-date').textContent = dateString;
}

// Update time every second
setInterval(updateTime, 1000);
updateTime();

// Clock In/Out functionality
document.getElementById('clock-in-btn').addEventListener('click', async () => {
    const email = document.getElementById('employee-email').value;
    if (!email) {
        showStatus('Please enter your email', 'error');
        return;
    }
    
    try {
        const response = await fetch('/clock-in', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, timestamp: new Date() }),
        });
        
        if (response.ok) {
            showStatus(`✓ Clocked in successfully at ${new Date().toLocaleTimeString()}`, 'success');
            document.getElementById('employee-email').value = '';
        } else {
            showStatus('Error clocking in. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Clock in error:', error);
        showStatus('Connection error. Please try again.', 'error');
    }
});

document.getElementById('clock-out-btn').addEventListener('click', async () => {
    const email = document.getElementById('employee-email').value;
    if (!email) {
        showStatus('Please enter your email', 'error');
        return;
    }
    
    try {
        const response = await fetch('/clock-out', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, timestamp: new Date() }),
        });
        
        if (response.ok) {
            showStatus(`✓ Clocked out successfully at ${new Date().toLocaleTimeString()}`, 'success');
            document.getElementById('employee-email').value = '';
        } else {
            showStatus('Error clocking out. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Clock out error:', error);
        showStatus('Connection error. Please try again.', 'error');
    }
});

// User registration
document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password }),
        });

        if (response.ok) {
            const user = await response.json();
            document.getElementById('name').value = '';
            document.getElementById('email').value = '';
            document.getElementById('password').value = '';
            loadUsers();
        } else {
            showStatus('Error registering user', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
    }
});

// Load and display users
async function loadUsers() {
    try {
        const response = await fetch('/users');
        if (response.ok) {
            const users = await response.json();
            displayUsers(users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function displayUsers(users) {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    
    if (users.length === 0) {
        userList.innerHTML = '<p style="text-align: center; color: #a0522d;">No employees registered yet</p>';
        return;
    }
    
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div class="user-info">
                <h4>${user.name}</h4>
                <p>${user.email}</p>
            </div>
            <button class="delete-btn" onclick="deleteUser('${user._id}')">Delete</button>
        `;
        userList.appendChild(userItem);
    });
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    
    try {
        const response = await fetch(`/users/${userId}`, {
            method: 'DELETE',
        });
        
        if (response.ok) {
            loadUsers();
        }
    } catch (error) {
        console.error('Error deleting user:', error);
    }
}

// Show status message
function showStatus(message, type) {
    const statusElement = document.getElementById('clock-status');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status-message';
    }, 4000);
}

// Load users on page load
loadUsers();