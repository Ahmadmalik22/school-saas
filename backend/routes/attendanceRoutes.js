import express from 'express';
import {
  getClassAttendanceSheet,
  saveClassAttendanceSheet,
  getMonthlyStudentRegister,
  getStaffAttendanceSheet,
  saveStaffAttendanceSheet,
  getMonthlyStaffRegister,
  markQrAttendance,
  getTodayQrAttendance,
} from '../controllers/attendanceController.js';

const router = express.Router();

// =========================================================================
// 🅰️ Student Attendance Routes
// =========================================================================
router.get('/student/sheet', getClassAttendanceSheet);
router.post('/student/sheet', saveClassAttendanceSheet);
router.get('/student/monthly-register', getMonthlyStudentRegister);

// =========================================================================
// 🅱️ Staff Attendance Routes
// =========================================================================
router.get('/staff/sheet', getStaffAttendanceSheet);
router.post('/staff/sheet', saveStaffAttendanceSheet);
router.get('/staff/monthly-register', getMonthlyStaffRegister);

// =========================================================================
// 🅲 Digital QR Attendance Gate Scanner Routes
// =========================================================================
router.post('/qr-scan', markQrAttendance);
router.get('/qr-today', getTodayQrAttendance);

export default router;

