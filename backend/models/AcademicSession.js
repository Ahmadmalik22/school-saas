import mongoose from 'mongoose';

const AcademicSessionSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    sessionName: {
      type: String,
      required: true,
      trim: true, // e.g. "2025-2026", "2026-2027"
    },
    startMonth: {
      type: String,
      required: true,
      default: 'April',
      trim: true,
    },
    startYear: {
      type: Number,
      required: true,
      default: 2025,
    },
    endMonth: {
      type: String,
      required: true,
      default: 'March',
      trim: true,
    },
    endYear: {
      type: Number,
      required: true,
      default: 2026,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Unique session name per school
AcademicSessionSchema.index({ schoolCode: 1, sessionName: 1 }, { unique: true });

export const AcademicSession = mongoose.model('AcademicSession', AcademicSessionSchema);
export default AcademicSession;
