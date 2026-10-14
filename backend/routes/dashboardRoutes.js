import express from 'express';
import { getDailyDashboardSummary } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/daily-summary', getDailyDashboardSummary);

export default router;
