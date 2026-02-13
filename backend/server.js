const express = require('express');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// CRUD operations
app.post('/users', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password,
      },
    });
    res.send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error creating user', error: error.message });
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
app.post('/clock-in', async (req, res) => {
  try {
    const { email } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if employee exists
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      return res.status(404).send({ message: 'Employee not found' });
    }
    
    // Find or create clock record for today
    let clockRecord = await prisma.clock.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: today,
        },
      },
    });
    
    if (!clockRecord) {
      clockRecord = await prisma.clock.create({
        data: {
          email,
          userId: user.id,
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
app.post('/clock-out', async (req, res) => {
  try {
    const { email } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if employee exists
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      return res.status(404).send({ message: 'Employee not found' });
    }
    
    // Find clock record for today
    const clockRecord = await prisma.clock.findFirst({
      where: {
        userId: user.id,
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

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});