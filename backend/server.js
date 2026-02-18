const express = require('express');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Auth middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// CRUD operations
app.post('/users', async (req, res) => {
  try {
    console.log('Received registration request:', { name: req.body.name, email: req.body.email });
    const { name, email, password } = req.body;
    
    // Validate input
    if (!name || !email || !password) {
      console.log('Missing fields:', { name: !!name, email: !!email, password: !!password });
      return res.status(400).send({ message: 'Missing required fields' });
    }
    
    // Trim whitespace
    const trimmedName = name.toString().trim();
    const trimmedEmail = email.toString().trim().toLowerCase();
    const trimmedPassword = password.toString();
    
    // Validate input length
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).send({ message: 'Name must be between 2 and 100 characters' });
    }
    
    if (trimmedPassword.length < 6) {
      return res.status(400).send({ message: 'Password must be at least 6 characters' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).send({ message: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });
    if (existingUser) {
      return res.status(400).send({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        password: hashedPassword,
      },
    });
    
    console.log('User created successfully:', { id: user.id, email: user.email });
    res.status(201).send({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    console.error('Registration error:', error.message);
    console.error('Full error:', error);
    res.status(500).send({ message: 'Error creating user', error: error.message });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).send({ message: 'Email and password required' });
    }

    const trimmedEmail = email.toString().trim().toLowerCase();
    const trimmedPassword = password.toString();

    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      return res.status(401).send({ message: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(trimmedPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).send({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.send({ message: 'Login successful', token, userId: user.id, name: user.name, role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error logging in', error: error.message });
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.send(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error fetching users', error: error.message });
  }
});

app.put('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error updating user', error: error.message });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.send({ message: 'User deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error deleting user', error: error.message });
  }
});

// Clock In endpoint
app.post('/clock-in', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find or create clock record for today
    let clockRecord = await prisma.clock.findFirst({
      where: {
        userId: userId,
        date: {
          gte: today,
        },
      },
    });
    
    if (!clockRecord) {
      clockRecord = await prisma.clock.create({
        data: {
          email,
          userId: userId,
          clockInTime: new Date(),
        },
      });
    } else if (clockRecord.clockInTime) {
      return res.status(400).send({ message: 'Already clocked in today' });
    } else {
      clockRecord = await prisma.clock.update({
        where: { id: clockRecord.id },
        data: { clockInTime: new Date() },
      });
    }
    
    res.send({ message: 'Clocked in successfully', clockRecord });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error clocking in', error: error.message });
  }
});

// Clock Out endpoint
app.post('/clock-out', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find clock record for today
    const clockRecord = await prisma.clock.findFirst({
      where: {
        userId: userId,
        date: {
          gte: today,
        },
      },
    });
    
    if (!clockRecord) {
      return res.status(400).send({ message: 'No clock in record found for today' });
    }
    
    if (clockRecord.clockOutTime) {
      return res.status(400).send({ message: 'Already clocked out' });
    }
    
    const updatedRecord = await prisma.clock.update({
      where: { id: clockRecord.id },
      data: { clockOutTime: new Date() },
    });
    
    res.send({ message: 'Clocked out successfully', clockRecord: updatedRecord });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error clocking out', error: error.message });
  }
});


// Get current user profile
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    res.send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error fetching profile', error: error.message });
  }
});

// Get user's clock records with hours calculation
app.get('/my-records', authenticateToken, async (req, res) => {
  try {
    const records = await prisma.clock.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
    });

    const recordsWithHours = records.map(record => {
      let hoursWorked = 0;
      if (record.clockInTime && record.clockOutTime) {
        hoursWorked = (record.clockOutTime - record.clockInTime) / (1000 * 60 * 60);
      }
      return { ...record, hoursWorked: hoursWorked.toFixed(2) };
    });

    res.send(recordsWithHours);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error fetching records', error: error.message });
  }
});

// Get all users (admin)
app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, createdAt: true },
    });
    res.send(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error fetching users', error: error.message });
  }
});

// Get all users with their clock records and total hours (admin/payroll)
app.get('/admin/payroll', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { clocks: true },
    });

    const payrollData = users.map(user => {
      let totalHours = 0;
      const records = user.clocks.map(record => {
        let hoursWorked = 0;
        if (record.clockInTime && record.clockOutTime) {
          hoursWorked = (record.clockOutTime - record.clockInTime) / (1000 * 60 * 60);
          totalHours += hoursWorked;
        }
        return { ...record, hoursWorked: hoursWorked.toFixed(2) };
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        totalHours: totalHours.toFixed(2),
        records,
      };
    });

    res.send(payrollData);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error fetching payroll data', error: error.message });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// BREAK TRACKING
// Start break
app.post('/break-start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's clock record
    const clockRecord = await prisma.clock.findFirst({
      where: {
        userId: userId,
        date: { gte: today },
      },
    });

    if (!clockRecord) {
      return res.status(400).send({ message: 'No active clock record. Please clock in first.' });
    }

    if (clockRecord.clockOutTime) {
      return res.status(400).send({ message: 'Cannot start break after clocking out' });
    }

    // Check if there's an active break
    const activeBreak = await prisma.break.findFirst({
      where: {
        clockId: clockRecord.id,
        breakEnd: null,
      },
    });

    if (activeBreak) {
      return res.status(400).send({ message: 'Break already started' });
    }

    const breakRecord = await prisma.break.create({
      data: {
        userId: userId,
        clockId: clockRecord.id,
        breakStart: new Date(),
      },
    });

    res.send({ message: 'Break started', break: breakRecord });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error starting break', error: error.message });
  }
});

// End break
app.post('/break-end', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find active break
    const activeBreak = await prisma.break.findFirst({
      where: {
        userId: userId,
        breakEnd: null,
      },
    });

    if (!activeBreak) {
      return res.status(400).send({ message: 'No active break to end' });
    }

    const updatedBreak = await prisma.break.update({
      where: { id: activeBreak.id },
      data: { breakEnd: new Date() },
    });

    res.send({ message: 'Break ended', break: updatedBreak });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error ending break', error: error.message });
  }
});

// Get breaks for today
app.get('/breaks-today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const breaks = await prisma.break.findMany({
      where: {
        userId: userId,
        createdAt: { gte: today },
      },
      orderBy: { breakStart: 'asc' },
    });

    res.send(breaks);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error fetching breaks', error: error.message });
  }
});

// Calculate overtime for a user
app.get('/overtime-report', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const records = await prisma.clock.findMany({
      where: {
        userId: userId,
        date: { gte: thirtyDaysAgo },
      },
      include: { breaks: true },
      orderBy: { date: 'desc' },
    });

    // Calculate daily and weekly overtime
    let totalDailyOvertime = 0;
    const recordsWithOvertime = records.map(record => {
      let hoursWorked = 0;
      if (record.clockInTime && record.clockOutTime) {
        hoursWorked = (record.clockOutTime - record.clockInTime) / (1000 * 60 * 60);
        
        // Subtract break time
        const breakTime = record.breaks.reduce((total, breakRecord) => {
          if (breakRecord.breakEnd) {
            return total + (breakRecord.breakEnd - breakRecord.breakStart) / (1000 * 60 * 60);
          }
          return total;
        }, 0);
        
        hoursWorked -= breakTime;
      }

      const dailyOvertime = Math.max(0, hoursWorked - 8); // Overtime is anything over 8 hours/day
      totalDailyOvertime += dailyOvertime;

      return {
        ...record,
        hoursWorked: hoursWorked.toFixed(2),
        dailyOvertime: dailyOvertime.toFixed(2),
      };
    });

    res.send({
      totalDailyOvertime: totalDailyOvertime.toFixed(2),
      records: recordsWithOvertime,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error calculating overtime', error: error.message });
  }
});

// ==================== HR FEATURES ====================

// DEPARTMENT CRUD
app.post('/departments', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    const { name, description } = req.body;
    const department = await prisma.department.create({
      data: { name, description, managerId: null },
    });
    res.status(201).send(department);
  } catch (error) {
    res.status(500).send({ message: 'Error creating department', error: error.message });
  }
});

app.get('/departments', authenticateToken, async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: { manager: { select: { id: true, name: true, email: true } }, employees: { select: { id: true, name: true, email: true, role: true } } }
    });
    res.send(departments);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching departments', error: error.message });
  }
});

// SHIFT CRUD
app.post('/shifts', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).send({ message: 'Manager or Admin only' });
    const { name, startTime, endTime, departmentId } = req.body;
    const shift = await prisma.shift.create({
      data: { name, startTime, endTime, departmentId },
    });
    res.status(201).send(shift);
  } catch (error) {
    res.status(500).send({ message: 'Error creating shift', error: error.message });
  }
});

app.get('/shifts', authenticateToken, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({ include: { department: { select: { name: true } } } });
    res.send(shifts);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching shifts', error: error.message });
  }
});

// SHIFT ASSIGNMENT
app.post('/shift-assignments', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).send({ message: 'Manager or Admin only' });
    const { userId, shiftId, date } = req.body;
    const assignment = await prisma.shiftAssignment.create({
      data: { userId, shiftId, date: new Date(date) },
    });
    res.status(201).send(assignment);
  } catch (error) {
    res.status(500).send({ message: 'Error assigning shift', error: error.message });
  }
});

app.get('/my-shift-assignments', authenticateToken, async (req, res) => {
  try {
    const assignments = await prisma.shiftAssignment.findMany({
      where: { userId: req.user.id },
      include: { shift: true },
      orderBy: { date: 'desc' }
    });
    res.send(assignments);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching assignments', error: error.message });
  }
});

// LEAVE REQUEST MANAGEMENT
app.post('/leave-requests', authenticateToken, async (req, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    const calcDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    const request = await prisma.leaveRequest.create({
      data: {
        userId: req.user.id,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        status: 'PENDING'
      },
    });
    res.status(201).send(request);
  } catch (error) {
    res.status(500).send({ message: 'Error creating leave request', error: error.message });
  }
});

app.get('/leave-requests', authenticateToken, async (req, res) => {
  try {
    let whereClause = {};
    if (req.user.role === 'EMPLOYEE') {
      whereClause = { userId: req.user.id };
    }
    const requests = await prisma.leaveRequest.findMany({ where: whereClause, orderBy: { createdAt: 'desc' } });
    res.send(requests);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching leave requests', error: error.message });
  }
});

app.put('/leave-requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).send({ message: 'Manager or Admin only' });
    const { id } = req.params;
    const request = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'APPROVED' },
    });
    res.send(request);
  } catch (error) {
    res.status(500).send({ message: 'Error approving leave', error: error.message });
  }
});

app.put('/leave-requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).send({ message: 'Manager or Admin only' });
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const request = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'REJECTED', rejectionReason },
    });
    res.send(request);
  } catch (error) {
    res.status(500).send({ message: 'Error rejecting leave', error: error.message });
  }
});

// SHIFT SWAP REQUESTS
app.post('/shift-swap-requests', authenticateToken, async (req, res) => {
  try {
    const { requestedEmployeeId, originalShiftDate, requestedShiftDate, reason } = req.body;
    const swapRequest = await prisma.shiftSwapRequest.create({
      data: {
        initiatedById: req.user.id,
        requestedEmployeeId,
        originalShiftDate: new Date(originalShiftDate),
        requestedShiftDate: new Date(requestedShiftDate),
        reason,
        status: 'PENDING'
      },
    });
    res.status(201).send(swapRequest);
  } catch (error) {
    res.status(500).send({ message: 'Error creating shift swap request', error: error.message });
  }
});

app.get('/shift-swap-requests', authenticateToken, async (req, res) => {
  try {
    const requests = await prisma.shiftSwapRequest.findMany({
      where: {
        OR: [
          { initiatedById: req.user.id },
          { requestedEmployeeId: req.user.id }
        ]
      },
      include: { initiatedBy: true, requestedEmployee: true },
      orderBy: { createdAt: 'desc' }
    });
    res.send(requests);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching shift swap requests', error: error.message });
  }
});

app.put('/shift-swap-requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.shiftSwapRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'APPROVED' },
    });
    res.send(request);
  } catch (error) {
    res.status(500).send({ message: 'Error approving swap', error: error.message });
  }
});

app.put('/shift-swap-requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.shiftSwapRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'REJECTED' },
    });
    res.send(request);
  } catch (error) {
    res.status(500).send({ message: 'Error rejecting swap', error: error.message });
  }
});

// ATTENDANCE TRACKING
app.post('/attendance-records', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).send({ message: 'Manager or Admin only' });
    const { userId, date, status, clockInTime, clockOutTime, minutesLate, notes } = req.body;
    const record = await prisma.attendanceRecord.create({
      data: {
        userId,
        date: new Date(date),
        status,
        clockInTime: clockInTime ? new Date(clockInTime) : null,
        clockOutTime: clockOutTime ? new Date(clockOutTime) : null,
        minutesLate: minutesLate || 0,
        notes
      },
    });
    res.status(201).send(record);
  } catch (error) {
    res.status(500).send({ message: 'Error creating attendance record', error: error.message });
  }
});

app.get('/attendance-records', authenticateToken, async (req, res) => {
  try {
    let whereClause = {};
    if (req.user.role === 'EMPLOYEE') {
      whereClause = { userId: req.user.id };
    }
    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { date: 'desc' }
    });
    res.send(records);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching attendance records', error: error.message });
  }
});

// APPROVAL WORKFLOWS
app.post('/approval-requests', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).send({ message: 'Manager or Admin only' });
    const { type, requestedById, details } = req.body;
    const request = await prisma.approvalRequest.create({
      data: {
        type,
        requestedById,
        details: JSON.stringify(details),
        status: 'PENDING'
      },
    });
    res.status(201).send(request);
  } catch (error) {
    res.status(500).send({ message: 'Error creating approval request', error: error.message });
  }
});

app.get('/approval-requests', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).send({ message: 'Manager or Admin only' });
    const requests = await prisma.approvalRequest.findMany({
      include: { requestedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.send(requests);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching approval requests', error: error.message });
  }
});

app.put('/approval-requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).send({ message: 'Manager or Admin only' });
    const { id } = req.params;
    const { approverNotes } = req.body;
    const request = await prisma.approvalRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'APPROVED', approverNotes },
    });
    res.send(request);
  } catch (error) {
    res.status(500).send({ message: 'Error approving request', error: error.message });
  }
});

app.put('/approval-requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).send({ message: 'Manager or Admin only' });
    const { id } = req.params;
    const { approverNotes } = req.body;
    const request = await prisma.approvalRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'REJECTED', approverNotes },
    });
    res.send(request);
  } catch (error) {
    res.status(500).send({ message: 'Error rejecting request', error: error.message });
  }
});

// PERFORMANCE METRICS
app.post('/performance-metrics', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') return res.status(403).send({ message: 'Manager or Admin only' });
    const { userId, period, rating, quality, attendance, productivity, teamwork, comments } = req.body;
    const metric = await prisma.performanceMetric.create({
      data: {
        userId,
        period,
        rating,
        quality: quality || 0,
        attendance: attendance || 0,
        productivity: productivity || 0,
        teamwork: teamwork || 0,
        comments,
        reviewedBy: req.user.name
      },
    });
    res.status(201).send(metric);
  } catch (error) {
    res.status(500).send({ message: 'Error creating performance metric', error: error.message });
  }
});

app.get('/performance-metrics/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.role === 'EMPLOYEE' && req.user.id !== parseInt(userId)) {
      return res.status(403).send({ message: 'Cannot view other employee metrics' });
    }
    const metrics = await prisma.performanceMetric.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { createdAt: 'desc' }
    });
    res.send(metrics);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching performance metrics', error: error.message });
  }
});

// RBAC - Update user role
app.put('/users/:id/update-role', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    const { id } = req.params;
    const { role, departmentId, managerId } = req.body;
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role, departmentId, managerId },
    });
    res.send({ message: 'User role updated', user });
  } catch (error) {
    res.status(500).send({ message: 'Error updating user role', error: error.message });
  }
});

// Get current user with all details
app.get('/profile-full', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        department: true,
        manager: { select: { id: true, name: true } },
        subordinates: { select: { id: true, name: true, email: true, role: true } },
        performanceMetrics: { orderBy: { createdAt: 'desc' }, take: 3 }
      }
    });
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching profile', error: error.message });
  }
});

// ==================== PAYROLL & FINANCE ====================

// Employee Wage Management
app.post('/employee-wages', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    const { userId, hourlyRate, monthlySalary, annualSalary } = req.body;
    const wage = await prisma.employeeWage.create({
      data: { userId, hourlyRate: hourlyRate || null, monthlySalary: monthlySalary || null, annualSalary: annualSalary || null, startDate: new Date() }
    });
    res.status(201).send(wage);
  } catch (error) {
    res.status(500).send({ message: 'Error creating wage', error: error.message });
  }
});

app.get('/employee-wages/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'EMPLOYEE' && req.user.id !== parseInt(req.params.userId)) {
      return res.status(403).send({ message: 'Cannot view other wage data' });
    }
    const wage = await prisma.employeeWage.findUnique({
      where: { userId: parseInt(req.params.userId) },
      include: { deductions: true, bonuses: true }
    });
    res.send(wage);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching wage', error: error.message });
  }
});

// Deductions Tracking
app.post('/deductions', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    const { wageId, type, amount, percentage } = req.body;
    const deduction = await prisma.deduction.create({
      data: { wageId, type, amount, percentage: percentage || null, effectiveFrom: new Date() }
    });
    res.status(201).send(deduction);
  } catch (error) {
    res.status(500).send({ message: 'Error creating deduction', error: error.message });
  }
});

// Bonuses Tracking
app.post('/bonuses', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).send({ message: 'Manager or Admin only' });
    }
    const { wageId, type, amount, reason } = req.body;
    const bonus = await prisma.bonus.create({
      data: { wageId, type, amount, reason, appliedIn: new Date() }
    });
    res.status(201).send(bonus);
  } catch (error) {
    res.status(500).send({ message: 'Error creating bonus', error: error.message });
  }
});

// Payroll Generation
app.post('/payroll-generate', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    const { userId, period } = req.body;
    
    const wage = await prisma.employeeWage.findUnique({
      where: { userId },
      include: { deductions: true, bonuses: true }
    });
    
    if (!wage) return res.status(404).send({ message: 'Wage record not found' });
    
    // Calculate payroll
    const basePayCondition = wage.hourlyRate ? 'hourly' : 'salary';
    let grossPay = 0;
    let hoursWorked = 160; // Default 160 hours/month
    
    if (basePayCondition === 'hourly') {
      const clocks = await prisma.clock.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 30
      });
      hoursWorked = clocks.reduce((sum, c) => {
        if (c.clockInTime && c.clockOutTime) {
          return sum + ((c.clockOutTime - c.clockInTime) / (1000 * 60 * 60));
        }
        return sum;
      }, 0);
      grossPay = hoursWorked * wage.hourlyRate;
    } else {
      grossPay = wage.monthlySalary || wage.annualSalary / 12;
    }
    
    let totalDeductions = 0;
    wage.deductions.forEach(d => {
      if (d.percentage) {
        totalDeductions += grossPay * (d.percentage / 100);
      } else {
        totalDeductions += d.amount;
      }
    });
    
    const totalBonuses = wage.bonuses.reduce((sum, b) => sum + b.amount, 0);
    const netPay = grossPay - totalDeductions + totalBonuses;
    
    const payroll = await prisma.payrollRecord.create({
      data: {
        wageId: wage.id,
        period,
        grossPay,
        totalDeductions,
        totalBonuses,
        netPay,
        hoursWorked,
        overtimeHours: Math.max(0, hoursWorked - 160)
      }
    });
    
    res.status(201).send(payroll);
  } catch (error) {
    res.status(500).send({ message: 'Error generating payroll', error: error.message });
  }
});

app.get('/payroll-records/:userId', authenticateToken, async (req, res) => {
  try {
    const records = await prisma.payrollRecord.findMany({
      where: { wage: { userId: parseInt(req.params.userId) } },
      orderBy: { createdAt: 'desc' }
    });
    res.send(records);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching payroll records', error: error.message });
  }
});

// ==================== SECURITY & COMPLIANCE ====================

// Audit Logging Middleware
function logAudit(action, resource, userId, resourceId = null, changes = null) {
  return async () => {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId: resourceId ? resourceId.toString() : null,
          changes: changes ? JSON.stringify(changes) : null
        }
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }
  };
}

app.get('/audit-logs', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.send(logs);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching audit logs', error: error.message });
  }
});

// 2FA Setup
app.post('/2fa-setup', authenticateToken, async (req, res) => {
  try {
    const secret = Math.random().toString(36).substring(2, 15);
    const twoFa = await prisma.twoFactorAuth.upsert({
      where: { userId: req.user.id },
      update: { secret, backupCodes: JSON.stringify([Math.random().toString(36).slice(2), Math.random().toString(36).slice(2)]) },
      create: { userId: req.user.id, secret, backupCodes: JSON.stringify([Math.random().toString(36).slice(2)]), enabled: false }
    });
    res.send({ secret, message: '2FA setup initiated. Scan QR code or use secret key.' });
  } catch (error) {
    res.status(500).send({ message: 'Error setting up 2FA', error: error.message });
  }
});

app.post('/2fa-enable', authenticateToken, async (req, res) => {
  try {
    const twoFa = await prisma.twoFactorAuth.update({
      where: { userId: req.user.id },
      data: { enabled: true }
    });
    res.send({ message: '2FA enabled successfully' });
  } catch (error) {
    res.status(500).send({ message: 'Error enabling 2FA', error: error.message });
  }
});

// Location Logging (for clock in/out)
app.post('/location-log', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, accuracy, action } = req.body;
    const log = await prisma.locationLog.create({
      data: {
        userId: req.user.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : null,
        action,
        timestamp: new Date()
      }
    });
    res.status(201).send(log);
  } catch (error) {
    res.status(500).send({ message: 'Error logging location', error: error.message });
  }
});

// IP Logging Middleware (logs automatically on auth)
app.post('/login', async (req, res, next) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  
  req.ipAddress = ipAddress;
  req.userAgent = userAgent;
  next();
});

// Rate Limiting Helper (simple in-memory rate limiter)
const rateLimitStore = {};
function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = [];
  }
  
  rateLimitStore[ip] = rateLimitStore[ip].filter(timestamp => now - timestamp < 60000);
  
  if (rateLimitStore[ip].length >= 100) {
    return res.status(429).send({ message: 'Too many requests. Please try again later.' });
  }
  
  rateLimitStore[ip].push(now);
  next();
}

app.use(rateLimit);

// ==================== USER EXPERIENCE ====================

// Notification Settings
app.post('/notification-settings', authenticateToken, async (req, res) => {
  try {
    const { emailNotifications, pushNotifications, darkModeEnabled, clockInReminders, shiftAlerts } = req.body;
    const settings = await prisma.notificationSetting.upsert({
      where: { userId: req.user.id },
      update: { emailNotifications, pushNotifications, darkModeEnabled, clockInReminders, shiftAlerts },
      create: { userId: req.user.id, emailNotifications, pushNotifications, darkModeEnabled, clockInReminders, shiftAlerts }
    });
    res.send(settings);
  } catch (error) {
    res.status(500).send({ message: 'Error updating settings', error: error.message });
  }
});

app.get('/notification-settings', authenticateToken, async (req, res) => {
  try {
    const settings = await prisma.notificationSetting.findUnique({
      where: { userId: req.user.id }
    });
    res.send(settings || {});
  } catch (error) {
    res.status(500).send({ message: 'Error fetching settings', error: error.message });
  }
});

// Get Notifications
app.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.send(notifications);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching notifications', error: error.message });
  }
});

app.put('/notifications/:id/mark-read', authenticateToken, async (req, res) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: parseInt(req.params.id) },
      data: { read: true, readAt: new Date() }
    });
    res.send(notification);
  } catch (error) {
    res.status(500).send({ message: 'Error marking notification', error: error.message });
  }
});

// ==================== DATA MANAGEMENT ====================

// Archive Employee
app.post('/archive-employee/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    
    const { archiveReason } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.userId) }
    });
    
    if (!user) return res.status(404).send({ message: 'User not found' });
    
    const archived = await prisma.archivedEmployee.create({
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastActiveDate: new Date(),
        archiveReason,
        archivedBy: req.user.id,
        data: JSON.stringify(user)
      }
    });
    
    res.send(archived);
  } catch (error) {
    res.status(500).send({ message: 'Error archiving employee', error: error.message });
  }
});

// Bulk Import (CSV)
app.post('/bulk-import-users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    
    const { csvData, fileName } = req.body; // CSV as string
    const lines = csvData.split('\\n').filter(l => l.trim());
    
    const importLog = await prisma.bulkImportLog.create({
      data: {
        fileName,
        totalRecords: lines.length - 1,
        successCount: 0,
        failureCount: 0,
        importedBy: req.user.id,
        status: 'PROCESSING'
      }
    });
    
    let successCount = 0;
    let failureCount = 0;
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const [name, email, role, departmentId] = lines[i].split(',').map(s => s.trim());
        
        const hashedPassword = await bcrypt.hash('TempPassword123', 10);
        await prisma.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            role: role || 'EMPLOYEE',
            departmentId: departmentId ? parseInt(departmentId) : null
          }
        });
        successCount++;
      } catch (err) {
        failureCount++;
        errors.push(`Row ${i}: ${err.message}`);
      }
    }
    
    const updatedLog = await prisma.bulkImportLog.update({
      where: { id: importLog.id },
      data: {
        successCount,
        failureCount,
        status: 'COMPLETED',
        details: JSON.stringify(errors)
      }
    });
    
    res.send(updatedLog);
  } catch (error) {
    res.status(500).send({ message: 'Error bulk importing users', error: error.message });
  }
});

app.get('/bulk-import-logs', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    const logs = await prisma.bulkImportLog.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.send(logs);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching import logs', error: error.message });
  }
});

// ==================== REPORTING & ANALYTICS ====================

// Generate Reports
app.post('/generate-report', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    
    const { type, period } = req.body;
    
    let reportData = {};
    
    if (type === 'MONTHLY_PAYROLL') {
      const payrolls = await prisma.payrollRecord.findMany({
        where: { period },
        include: { wage: { include: { user: { select: { name: true, email: true } } } } }
      });
      reportData = {
        totalEmployees: payrolls.length,
        totalGrossPay: payrolls.reduce((s, p) => s + p.grossPay, 0),
        totalNetPay: payrolls.reduce((s, p) => s + p.netPay, 0),
        records: payrolls
      };
    } else if (type === 'ATTENDANCE_REPORT') {
      const records = await prisma.attendanceRecord.findMany({
        include: { user: { select: { name: true } } },
        where: { date: { gte: new Date(period + '-01'), lte: new Date(period + '-31') } }
      });
      reportData = {
        totalRecords: records.length,
        onTime: records.filter(r => r.status === 'ON_TIME').length,
        late: records.filter(r => r.status === 'LATE').length,
        absent: records.filter(r => r.status === 'ABSENT').length
      };
    }
    
    const report = await prisma.report.create({
      data: {
        type,
        title: `${type} - ${period}`,
        period,
        generatedBy: req.user.id,
        data: JSON.stringify(reportData),
        status: 'READY'
      }
    });
    
    res.status(201).send(report);
  } catch (error) {
    res.status(500).send({ message: 'Error generating report', error: error.message });
  }
});

app.get('/reports', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).send({ message: 'Admin only' });
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.send(reports);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching reports', error: error.message });
  }
});

// Analytics Tracking
app.post('/analytics-event', async (req, res) => {
  try {
    const { userId, eventType, eventName, metadata } = req.body;
    await prisma.analyticsEvent.create({
      data: {
        userId: userId || null,
        eventType,
        eventName,
        metadata: metadata ? JSON.stringify(metadata) : null,
        timestamp: new Date()
      }
    });
    res.status(201).send({ message: 'Event tracked' });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).send({ message: 'Error tracking event' });
  }
});

// Start server
const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Create demo accounts on server startup
async function createDemoAccounts() {
  const demoAccounts = [
    { email: 'employee@demo.com', name: 'Demo Employee', password: 'demo123', role: 'EMPLOYEE' },
    { email: 'manager@demo.com', name: 'Demo Manager', password: 'demo123', role: 'MANAGER' },
    { email: 'admin@demo.com', name: 'Demo Admin', password: 'demo123', role: 'ADMIN' },
  ];

  for (const account of demoAccounts) {
    try {
      const existing = await prisma.user.findUnique({
        where: { email: account.email },
      });

      if (!existing) {
        const hashedPassword = await bcrypt.hash(account.password, 10);
        await prisma.user.create({
          data: {
            email: account.email,
            name: account.name,
            password: hashedPassword,
            role: account.role,
          },
        });
        console.log(`✓ Created demo account: ${account.email}`);
      }
    } catch (error) {
      console.log(`Demo account ${account.email} already exists`);
    }
  }
}

// Initialize demo accounts
createDemoAccounts().catch(err => console.error('Error creating demo accounts:', err));

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});