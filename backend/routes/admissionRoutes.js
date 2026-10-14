import express from 'express';
import {
  admitStudent,
  admitBulkExcel,
  createInquiry,
  getInquiries,
  convertInquiryToAdmission,
  deleteInquiry,
  getStudentsForPrint,
  getStudentPrintFormById,
} from '../controllers/admissionController.js';
import { uploadSingleImage, uploadExcel } from '../middlewares/upload.js';

const router = express.Router();

// ==========================================
// 1. SUB-MODULE: ADMIT STUDENT (Single)
// ==========================================
// Form submission with student photo upload to Cloudinary
router.post('/student', uploadSingleImage('photo'), admitStudent);

// ==========================================
// 2. SUB-MODULE: ADMIT BULK (Excel / CSV)
// ==========================================
// Upload .xlsx/.csv to admit entire class at once
router.post('/bulk', uploadExcel, admitBulkExcel);

// ==========================================
// 3. SUB-MODULE: ADMISSION INQUIRIES
// ==========================================
// Create inquiry for walk-in parent/visitor
router.post('/inquiry', createInquiry);

// List all inquiries with search & status filters
router.get('/inquiries', getInquiries);

// 1-Click Admit: convert an inquiry into an officially admitted student
router.post('/inquiries/:id/admit', convertInquiryToAdmission);

// Delete an unwanted inquiry record
router.delete('/inquiries/:id', deleteInquiry);

// ==========================================
// 4. SUB-MODULE: PRINT ADMISSION FORM
// ==========================================
// Filter students by class, section, or name to find print candidates
router.get('/print-forms', getStudentsForPrint);

// Get single student's complete admission slip data for printing
router.get('/student/:id/print', getStudentPrintFormById);

export default router;
