import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {}

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { connectDB } from './config/db.js';
import admissionRoutes from './routes/admissionRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import classRoutes from './routes/classRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import feeRoutes from './routes/feeRoutes.js';
import salaryRoutes from './routes/salaryRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import examRoutes from './routes/examRoutes.js';
import schoolProfileRoutes from './routes/schoolProfileRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { ensureDeveloperAndDefaultAccounts } from './controllers/authController.js';
import { protect, enforceTenantIsolation } from './middlewares/authMiddleware.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const httpServer = createServer(app);

// Dynamic CORS config supporting localhost, Vercel deployments, and production custom domain
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const clientUrl = process.env.CLIENT_URL || '';
    const allowed = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      ...clientUrl.split(',').map((u) => u.trim()),
    ].filter(Boolean);

    if (allowed.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

// Initialize Socket.io (for real-time SaaS notifications)
const io = new Server(httpServer, {
  cors: corsOptions,
});

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Attach Socket.io to request object so controllers can emit real-time events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// General API rate limiter (protects server from floods/scrapers)
app.use('/api/', apiRateLimiter);

// Public / Semi-Public Routes
app.use('/api/auth', authRoutes);
app.use('/api/school-profile', schoolProfileRoutes);

// Strictly Protected Multi-Tenant Business API Routes (Enforces Login & School Data Isolation)
app.use('/api/admissions', protect, enforceTenantIsolation, admissionRoutes);
app.use('/api/students', protect, enforceTenantIsolation, studentRoutes);
app.use('/api/staff', protect, enforceTenantIsolation, staffRoutes);
app.use('/api/classes', protect, enforceTenantIsolation, classRoutes);
app.use('/api/attendance', protect, enforceTenantIsolation, attendanceRoutes);
app.use('/api/fees', protect, enforceTenantIsolation, feeRoutes);
app.use('/api/salary', protect, enforceTenantIsolation, salaryRoutes);
app.use('/api/expenses', protect, enforceTenantIsolation, expenseRoutes);
app.use('/api/exams', protect, enforceTenantIsolation, examRoutes);
app.use('/api/sessions', protect, enforceTenantIsolation, sessionRoutes);
app.use('/api/reports', protect, enforceTenantIsolation, reportRoutes);
app.use('/api/dashboard', protect, enforceTenantIsolation, dashboardRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'School Management SaaS Server is healthy & running.',
    timestamp: new Date().toISOString(),
  });
});

// 404 Route Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: [${req.method}] ${req.originalUrl}`,
  });
});

// Centralized Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Socket.io Connection Logic (Multi-Tenant School Rooms & User Direct Channel)
io.on('connection', (socket) => {
  console.log(`⚡ New Client Connected: ${socket.id}`);

  // Client joins their school's private room (e.g. "school:SCH-101")
  socket.on('join_school', (schoolCode) => {
    if (schoolCode) {
      const room = `school:${schoolCode.toUpperCase()}`;
      socket.join(room);
      console.log(`🏫 Socket ${socket.id} joined room: ${room}`);
    }
  });

  // Client joins their personal user room (for real-time permission sync)
  socket.on('join_user', (userId) => {
    if (userId) {
      const room = `user:${userId}`;
      socket.join(room);
      console.log(`👤 Socket ${socket.id} joined user room: ${room}`);
    }
  });

  // Developer joins global Super Admin channel
  socket.on('join_developer', () => {
    socket.join('role:SUPER_ADMIN');
    console.log(`🛡️ Socket ${socket.id} joined Super Admin channel`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client Disconnected: ${socket.id}`);
  });
});

// Connect to Database & Start Server
const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  await ensureDeveloperAndDefaultAccounts();

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n======================================================`);
      console.warn(`⚠️  NOTICE: Server is ALREADY running on port ${PORT}!`);
      console.warn(`👉 Another terminal window is already actively hosting the backend.`);
      console.warn(`👉 API Health URL: http://localhost:${PORT}/api/health`);
      console.warn(`👉 Aap ko dobara 'npm run dev' chalane ki zaroorat nahi hai.`);
      console.warn(`======================================================\n`);
      process.exit(0);
    } else {
      console.error('🔥 Server HTTP Error:', err);
      process.exit(1);
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} [URL: http://localhost:${PORT}]`);
  });
});

// Guard against unhandled promise rejections and uncaught exceptions to ensure 24/7 uptime on free tier
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception thrown:', err);
});
