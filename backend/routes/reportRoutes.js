import express from 'express';
import {
  getFeeCollectionReport,
  getFinancialSummaryReport,
  getStudentEnrollmentReport,
  getAttendanceSummaryReport,
  getExamPerformanceReport,
  getPendingDuesReport,
  getExpenseReport,
  getStaffAttendanceReport,
  getStaffSalaryReport,
} from '../controllers/reportController.js';

const router = express.Router();

router.get('/fee-collection', getFeeCollectionReport);
router.get('/financial-summary', getFinancialSummaryReport);
router.get('/student-enrollment', getStudentEnrollmentReport);
router.get('/attendance-summary', getAttendanceSummaryReport);
router.get('/exam-performance', getExamPerformanceReport);
router.get('/pending-dues', getPendingDuesReport);
router.get('/expenses', getExpenseReport);
router.get('/staff-attendance', getStaffAttendanceReport);
router.get('/staff-salaries', getStaffSalaryReport);

export default router;
