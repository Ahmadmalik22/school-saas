import express from 'express';
import {
  getCategories,
  createCategory,
  recordExpense,
  getExpenseLedger,
  updateExpense,
  deleteExpense,
} from '../controllers/expenseController.js';

const router = express.Router();

// Categories
router.get('/categories', getCategories);
router.post('/categories', createCategory);

// Expenses
router.get('/ledger', getExpenseLedger);
router.post('/record', recordExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
