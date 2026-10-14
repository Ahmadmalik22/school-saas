import mongoose from 'mongoose';

/**
 * StaffSalary Schema
 * Computes and stores monthly staff payroll based on attendance records,
 * late policy (3 lates = 1 absent), half-day and absent deductions, and custom allowances.
 */
const StaffSalarySchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    salaryId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true,
    },

    employeeId: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      default: 'Teacher',
      trim: true,
    },

    department: {
      type: String,
      default: 'General',
      trim: true,
    },

    monthYear: {
      type: String, // e.g. "2026-10"
      required: true,
      trim: true,
      index: true,
    },

    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    totalDays: {
      type: Number,
      default: 30,
    },

    presentDays: {
      type: Number,
      default: 0,
    },

    absentDays: {
      type: Number,
      default: 0,
    },

    halfDays: {
      type: Number,
      default: 0,
    },

    lateCount: {
      type: Number,
      default: 0,
    },

    leaveDays: {
      type: Number,
      default: 0,
    },

    // Deductions & Allowances (PKR)
    absentDeduction: {
      type: Number,
      default: 0,
      min: 0,
    },

    lateDeduction: {
      type: Number,
      default: 0,
      min: 0,
    },

    halfDayDeduction: {
      type: Number,
      default: 0,
      min: 0,
    },

    bonusesOrAllowance: {
      type: Number,
      default: 0,
      min: 0,
    },

    netSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ['DRAFT', 'GENERATED', 'PAID'],
      default: 'GENERATED',
      index: true,
    },

    paidDate: {
      type: Date,
    },

    paymentMethod: {
      type: String,
      default: 'CASH',
      trim: true,
    },

    remarks: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

StaffSalarySchema.index(
  { staffId: 1, monthYear: 1 },
  { unique: true, name: 'staff_monthly_salary_idx' }
);
StaffSalarySchema.index(
  { schoolCode: 1, monthYear: 1 },
  { name: 'school_monthly_salary_idx' }
);

const StaffSalary = mongoose.model('StaffSalary', StaffSalarySchema);
export default StaffSalary;
