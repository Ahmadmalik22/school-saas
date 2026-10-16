import express from 'express';
import {
  generateClassFee,
  getClassFeeSheet,
  getMonthlyGenerationStatus,
  updateFeeVoucher,
  collectCashPayment,
  bulkFeeRevision,
  getFamilyVoucher,
  collectFamilyCashPayment,
} from '../controllers/feeController.js';

const router = express.Router();

// Student Fee Routes
router.post('/generate', generateClassFee);
router.get('/sheet', getClassFeeSheet);
router.get('/month-status', getMonthlyGenerationStatus);
router.put('/voucher/:id', updateFeeVoucher);
router.post('/voucher/:id/collect-cash', collectCashPayment);
router.post('/bulk-revision', bulkFeeRevision);

// Family Sibling Consolidated Voucher Routes
router.get('/family-voucher', getFamilyVoucher);
router.post('/family-voucher/collect-cash', collectFamilyCashPayment);

export default router;
