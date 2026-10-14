import mongoose from 'mongoose';

const ClassSubjectSchema = new mongoose.Schema(
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
      index: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    subjectCode: {
      type: String,
      trim: true,
      default: '',
    },
    totalMarks: {
      type: Number,
      required: true,
      default: 100,
      min: 1,
    },
    passingMarks: {
      type: Number,
      required: true,
      default: 40,
      min: 1,
    },
    order: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

ClassSubjectSchema.index({ schoolCode: 1, className: 1, subjectName: 1 }, { unique: true });

export const ClassSubject = mongoose.model('ClassSubject', ClassSubjectSchema);
export default ClassSubject;
