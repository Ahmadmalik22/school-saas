import express from 'express';
import {
  login,
  getMe,
  getModuleCatalog,
  registerSchool,
  getAllSchools,
  getSchoolUsers,
  createSchoolUser,
  updateSchoolUser,
  deleteSchoolUser,
  toggleSchoolStatus,
} from '../controllers/authController.js';
import { protect, requireSuperAdmin } from '../middlewares/authMiddleware.js';
import { loginRateLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Public Auth Endpoints (Protected with strict brute-force rate limiter)
router.post('/login', loginRateLimiter, login);
router.get('/catalog', getModuleCatalog);

// Protected User Profile
router.get('/me', protect, getMe);

// Developer / Super Admin: School Provisioning & Management
router.post('/developer/register-school', protect, requireSuperAdmin, registerSchool);
router.get('/developer/schools', protect, requireSuperAdmin, getAllSchools);
router.patch('/developer/schools/:schoolCode/status', protect, requireSuperAdmin, toggleSchoolStatus);

// Granular Sub-Module Rights User Management (Developer or School Admin)
router.get('/developer/schools/:schoolCode/users', protect, getSchoolUsers);
router.post('/developer/schools/:schoolCode/users', protect, createSchoolUser);
router.put('/developer/users/:userId', protect, updateSchoolUser);
router.delete('/developer/users/:userId', protect, deleteSchoolUser);

export default router;
