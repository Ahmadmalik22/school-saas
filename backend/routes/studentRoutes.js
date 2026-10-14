import express from 'express';
import {
  getStudents,
  getStudentById,
  updateStudent,
  updateStudentStatus,
  deleteStudent,
  promoteStudents,
} from '../controllers/studentController.js';
import { uploadSingleImage } from '../middlewares/upload.js';

const router = express.Router();

// ==========================================
// SUB-MODULE 1: STUDENT INFORMATION
// ==========================================
// Get students list with filters (class, section, status, search) & server-side pagination
router.get('/', getStudents);

// Get single student full profile
router.get('/:id', getStudentById);

// Update/Edit student information (optional photo update)
router.put('/:id', uploadSingleImage('photo'), updateStudent);

// Toggle student status (ACTIVE, INACTIVE, STRUCK_OFF)
router.patch('/:id/status', updateStudentStatus);

// Delete student (auto deletes photo from Cloudinary)
router.delete('/:id', deleteStudent);

// ==========================================
// SUB-MODULE 2: STUDENT PROMOTIONS
// ==========================================
// Promote class/selected students to next class & session
router.post('/promote', promoteStudents);

export default router;
