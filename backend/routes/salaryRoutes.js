import express from 'express';
import {
  generateStaffPayroll,
  getStaffPayrollSheet,
  updateStaffSalaryRecord,
} from '../controllers/salaryController.js';

const router = express.Router();

router.post('/generate', generateStaffPayroll);
router.get('/sheet', getStaffPayrollSheet);
router.put('/record/:id', updateStaffSalaryRecord);

export default router;
