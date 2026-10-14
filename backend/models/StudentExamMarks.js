import mongoose from 'mongoose';

const StudentExamMarksSchema = new mongoose.Schema(
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
    termName: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
      trim: true,
      default: '',
    },
    rollNumber: {
      type: String,
      required: true,
      trim: true,
    },
    admissionNumber: {
      type: String,
      trim: true,
      default: '',
    },
    studentPhoto: {
      type: String,
      default: null,
    },
    subjectMarks: [
      {
        subjectName: { type: String, required: true },
        totalMarks: { type: Number, required: true, default: 100 },
        obtainedMarks: { type: Number, required: true, default: 0 },
        passingMarks: { type: Number, required: true, default: 40 },
        isAbsent: { type: Boolean, default: false },
        remarks: { type: String, default: 'Pass' },
      },
    ],
    totalMaxMarks: {
      type: Number,
      required: true,
      default: 0,
    },
    totalObtainedMarks: {
      type: Number,
      required: true,
      default: 0,
    },
    percentage: {
      type: Number,
      required: true,
      default: 0,
    },
    grade: {
      type: String,
      default: 'F',
    },
    classRank: {
      type: Number,
      default: 1,
    },
    isPassed: {
      type: Boolean,
      default: true,
    },
    teacherRemarks: {
      type: String,
      default: 'Promoted',
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound index for uniqueness per student per exam term
StudentExamMarksSchema.index(
  { schoolCode: 1, academicSession: 1, termName: 1, className: 1, section: 1, studentId: 1 },
  { unique: true }
);

// High-speed index for consolidated marks across all terms for a class
StudentExamMarksSchema.index({ schoolCode: 1, academicSession: 1, className: 1, section: 1 });

export const StudentExamMarks = mongoose.model('StudentExamMarks', StudentExamMarksSchema);
export default StudentExamMarks;
