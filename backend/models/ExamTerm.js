import mongoose from 'mongoose';

const ExamTermSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    academicSession: {
      type: String,
      required: true,
      default: '2025-2026',
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    weightage: {
      type: Number,
      default: 0,
    },
    order: {
      type: Number,
      default: 1,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

ExamTermSchema.index({ schoolCode: 1, academicSession: 1, name: 1 }, { unique: true });

export const ExamTerm = mongoose.model('ExamTerm', ExamTermSchema);
export default ExamTerm;
