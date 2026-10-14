import mongoose from 'mongoose';

/**
 * StaffAttendance Schema (Unified School Daily Roster Pattern)
 * Optimized for MongoDB Atlas Free Tier: Stores 1 sheet per school per day for all staff.
 * Indexes monthYear for automatic monthly payroll deductions and punctuality tracking.
 */
const StaffAttendanceSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    date: {
      type: Date,
      required: true,
    },

    // Fast string key (e.g. "2026-10-11")
    dateString: {
      type: String,
      required: true,
      index: true,
    },

    // Fast key for monthly payroll salary deductions (e.g. "2026-10")
    monthYear: {
      type: String,
      required: true,
      index: true,
    },

    records: [
      {
        staffId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Staff',
          required: true,
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
        },
        department: {
          type: String,
          default: 'General',
        },
        status: {
          type: String,
          enum: ['PRESENT', 'ABSENT', 'LEAVE', 'LATE', 'HALF_DAY', 'HOLIDAY', 'SUNDAY'],
          default: 'PRESENT',
        },
        timeIn: {
          type: String,
          default: '',
        },
        timeOut: {
          type: String,
          default: '',
        },
        remarks: {
          type: String,
          default: '',
          trim: true,
        },
      },
    ],

    summary: {
      totalStaff: { type: Number, default: 0 },
      presentCount: { type: Number, default: 0 },
      absentCount: { type: Number, default: 0 },
      lateCount: { type: Number, default: 0 },
      leaveCount: { type: Number, default: 0 },
      holidayCount: { type: Number, default: 0 },
      halfDayCount: { type: Number, default: 0 },
    },

    markedBy: {
      type: String,
      default: 'Admin / HR Principal',
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: One sheet per day per school
StaffAttendanceSchema.index({ schoolCode: 1, dateString: 1 }, { unique: true });

// Index for Month-End Payroll queries
StaffAttendanceSchema.index({ schoolCode: 1, monthYear: 1 });

export const StaffAttendance = mongoose.model('StaffAttendance', StaffAttendanceSchema);
export default StaffAttendance;
