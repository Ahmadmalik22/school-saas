import express from 'express';
import { getSchoolProfile, updateSchoolProfile } from '../controllers/schoolProfileController.js';

const router = express.Router();

router.get('/', getSchoolProfile);
router.post('/', updateSchoolProfile);

export default router;
