import mongoose from 'mongoose';

/**
 * StudentAttendance Schema (Class Daily Sheet Pattern)
 * Optimized for MongoDB Atlas Free Tier: Stores 1 sheet per class-section per day.
 * Pre-calculates daily summary and indexes monthYear for lightning-fast monthly fee fines calculation.
 */
const StudentAttendanceSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    className: {
      type: String,
      required: true,
      trim: true,
    },

    section: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // Normalized ISO Date
    date: {
      type: Date,
      required: true,
    },

    // Fast string key for direct lookups without timezone distortion (e.g. "2026-10-11")
    dateString: {
      type: String,
      required: true,
      index: true,
    },

    // Fast key for monthly fee rollups (e.g. "2026-10")
    monthYear: {
      type: String,
      required: true,
      index: true,
    },

    academicSession: {
      type: String,
      default: '2025-2026',
    },

    // Ready for future Card / QR scanner mode
    attendanceType: {
      type: String,
      enum: ['MANUAL', 'QR_SCANNER'],
      default: 'MANUAL',
    },

    // Array of individual student attendance records for this class & date
    records: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Student',
          required: true,
        },
        admissionNumber: {
          type: String,
          required: true,
          trim: true,
        },
        rollNumber: {
          type: String,
          default: '',
          trim: true,
        },
        studentName: {
          type: String,
          required: true,
          trim: true,
        },
        fatherName: {
          type: String,
          default: '',
          trim: true,
        },
        status: {
          type: String,
          enum: ['PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY', 'SUNDAY', 'HALF_DAY'],
          default: 'PRESENT',
        },
        timeIn: {
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

    // Pre-calculated summary counts
    summary: {
      totalStudents: { type: Number, default: 0 },
      presentCount: { type: Number, default: 0 },
      absentCount: { type: Number, default: 0 },
      leaveCount: { type: Number, default: 0 },
      holidayCount: { type: Number, default: 0 },
      sundayCount: { type: Number, default: 0 },
      halfDayCount: { type: Number, default: 0 },
      percentage: { type: Number, default: 100 },
    },

    markedBy: {
      type: String,
      default: 'Admin / Class Teacher',
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: One sheet per class-section per day per school
StudentAttendanceSchema.index(
  { schoolCode: 1, className: 1, section: 1, dateString: 1 },
  { unique: true }
);

// Index for Month-End Fee Challan fine calculations
StudentAttendanceSchema.index({ schoolCode: 1, monthYear: 1, className: 1, section: 1 });

export const StudentAttendance = mongoose.model('StudentAttendance', StudentAttendanceSchema);
export default StudentAttendance;
