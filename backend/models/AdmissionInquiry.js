import mongoose from 'mongoose';

const AdmissionInquirySchema = new mongoose.Schema(
  {
    // Multi-tenant SaaS identifier (School isolation)
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    inquiryNumber: {
      type: String,
      required: true,
      trim: true, // e.g., "INQ-2026-001"
    },

    inquiryDate: {
      type: Date,
      default: Date.now,
    },

    // Prospective Student Info
    studentName: {
      type: String,
      required: true,
      trim: true,
    },

    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      default: 'MALE',
    },

    dob: {
      type: Date,
    },

    targetClass: {
      type: String,
      required: true,
      trim: true, // e.g. "Class 5"
    },

    targetSection: {
      type: String,
      default: 'A',
      trim: true,
    },

    previousSchool: {
      type: String,
      trim: true,
    },

    // Parent / Guardian Info
    parentName: {
      type: String,
      required: true,
      trim: true,
    },

    parentPhone: {
      type: String,
      required: true,
      trim: true,
    },

    parentEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    // Follow-up Tracking
    followUpDate: {
      type: Date,
    },

    inquirySource: {
      type: String,
      enum: ['Walk-in', 'Banner/Flex', 'Social Media', 'Word of Mouth / Reference', 'Website', 'Other'],
      default: 'Walk-in',
    },

    remarks: {
      type: String,
      trim: true,
    },

    // Status & 1-Click Admit Conversion
    status: {
      type: String,
      enum: ['OPEN', 'ADMITTED', 'DECLINED', 'FOLLOW_UP'],
      default: 'OPEN',
      index: true,
    },

    // Populated once 1-click Admit is clicked
    convertedStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },

    convertedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
AdmissionInquirySchema.index({ schoolCode: 1, inquiryNumber: 1 }, { unique: true });
AdmissionInquirySchema.index({ schoolCode: 1, status: 1, inquiryDate: -1 });
AdmissionInquirySchema.index({ schoolCode: 1, parentPhone: 1 });

export const AdmissionInquiry = mongoose.model('AdmissionInquiry', AdmissionInquirySchema);
export default AdmissionInquiry;
