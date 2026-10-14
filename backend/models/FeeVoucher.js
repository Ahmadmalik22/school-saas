import mongoose from 'mongoose';

/**
 * FeeVoucher Schema
 * Manages monthly student fee billing, automatic dues rollforward,
 * accountant cash collection, and professional dual-copy voucher printing.
 * Highly optimized for MongoDB Atlas Free Tier storage.
 */
const FeeVoucherSchema = new mongoose.Schema(
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
      unique: true,
      trim: true,
      index: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },

    studentName: {
      type: String,
      required: true,
      trim: true,
    },

    fatherName: {
      type: String,
      required: true,
      trim: true,
    },

    fatherCnic: {
      type: String,
      trim: true,
      index: true,
    },

    rollNumber: {
      type: String,
      required: true,
      trim: true,
    },

    className: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    section: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    monthYear: {
      type: String, // e.g. "2026-10"
      required: true,
      trim: true,
      index: true,
    },

    issueDate: {
      type: Date,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    // Fee Breakdown (PKR)
    baseMonthlyFee: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    netMonthlyFee: {
      type: Number,
      required: true,
      min: 0,
    },

    annualOrOtherCharges: {
      type: Number,
      default: 0,
      min: 0,
    },

    previousArrears: {
      type: Number,
      default: 0, // Carried over from last month if unpaid or partially paid
      min: 0,
    },

    fine: {
      type: Number,
      default: 0, // Custom extra fine or adjustments
      min: 0,
    },

    totalPayableWithinDueDate: {
      type: Number,
      required: true,
      min: 0,
    },

    lateFine: {
      type: Number,
      default: 200, // Standard late fee fine in PKR
      min: 0,
    },

    totalPayableAfterDueDate: {
      type: Number,
      required: true,
      min: 0,
    },

    // Payment Tracking
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
      default: 'UNPAID',
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ['CASH', 'BANK_TRANSFER', 'ONLINE', 'CHEQUE'],
      default: 'CASH',
    },

    receiptNo: {
      type: String,
      trim: true,
    },

    receiptDate: {
      type: Date,
    },

    receivedBy: {
      type: String,
      default: 'School Accountant',
      trim: true,
    },

    remarks: {
      type: String,
      default: '',
      trim: true,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    // Payment transactions history (tracks initial payment, partial installments, and dues clearance)
    paymentHistory: [
      {
        amount: { type: Number, required: true },
        paymentDate: { type: Date, default: Date.now },
        paymentMethod: { type: String, default: 'CASH' },
        receivedBy: { type: String, default: 'School Accountant' },
        receiptNo: { type: String },
        note: { type: String, default: '' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for ultra-fast class & student monthly lookups
FeeVoucherSchema.index(
  { schoolCode: 1, monthYear: 1, className: 1, section: 1 },
  { name: 'school_month_class_sec_idx' }
);
FeeVoucherSchema.index(
  { studentId: 1, monthYear: 1 },
  { unique: true, name: 'student_monthly_voucher_idx' }
);
FeeVoucherSchema.index({ schoolCode: 1, status: 1 }, { name: 'school_status_idx' });
FeeVoucherSchema.index({ schoolCode: 1, monthYear: 1 }, { name: 'school_month_idx' });
FeeVoucherSchema.index({ schoolCode: 1, fatherCnic: 1, monthYear: 1 }, { name: 'school_father_cnic_month_idx' });
FeeVoucherSchema.index({ studentId: 1, monthYear: -1 }, { name: 'student_history_idx' });

const FeeVoucher = mongoose.model('FeeVoucher', FeeVoucherSchema);
export default FeeVoucher;
