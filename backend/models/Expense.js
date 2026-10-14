import mongoose from 'mongoose';

const ExpenseSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    voucherNo: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: true,
    },
    categoryName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    expenseDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    dateString: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      index: true,
    },
    monthYear: {
      type: String, // 'YYYY-MM'
      required: true,
      index: true,
    },
    remarks: {
      type: String,
      required: true,
      trim: true,
    },
    recordedBy: {
      type: String,
      default: 'School Accountant',
      trim: true,
    },
  },
  { timestamps: true }
);

// Indexes for fast ledger lookups and monthly summaries
ExpenseSchema.index({ schoolCode: 1, monthYear: 1, expenseDate: -1 });
ExpenseSchema.index({ schoolCode: 1, dateString: 1 });
ExpenseSchema.index({ schoolCode: 1, categoryName: 1 });

export const Expense = mongoose.model('Expense', ExpenseSchema);
export default Expense;
