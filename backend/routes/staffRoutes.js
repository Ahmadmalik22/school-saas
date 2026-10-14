import express from 'express';
import {
  addStaff,
  getStaffList,
  getStaffById,
  updateStaff,
  updateStaffStatus,
  deleteStaff,
} from '../controllers/staffController.js';
import { uploadSingleImage } from '../middlewares/upload.js';

const router = express.Router();

// Register new staff member (with Cloudinary passport photo)
router.post('/', uploadSingleImage('photo'), addStaff);

// Get staff directory (filters + pagination)
router.get('/', getStaffList);

// View single staff details
router.get('/:id', getStaffById);

// Update/Edit staff details
router.put('/:id', uploadSingleImage('photo'), updateStaff);

// Toggle staff status (ACTIVE, ON_LEAVE, RESIGNED)
router.patch('/:id/status', updateStaffStatus);

// Delete staff (auto deletes photo from Cloudinary)
router.delete('/:id', deleteStaff);

export default router;
