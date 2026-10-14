import mongoose from 'mongoose';

const ExpenseCategorySchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness per school
ExpenseCategorySchema.index({ schoolCode: 1, name: 1 }, { unique: true });

export const ExpenseCategory = mongoose.model('ExpenseCategory', ExpenseCategorySchema);
export default ExpenseCategory;
