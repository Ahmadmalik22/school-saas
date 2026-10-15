import express from 'express';
import { getSchoolProfile, updateSchoolProfile } from '../controllers/schoolProfileController.js';
import { protect, enforceTenantIsolation } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public: allows login screen to display school name & logo
router.get('/', getSchoolProfile);

// Strictly Protected: only authorized admin can update their school branding
router.post('/', protect, enforceTenantIsolation, updateSchoolProfile);

export default router;
