import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema(
  {
    // Multi-tenant SaaS identifier (School isolation)
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // 1. Admission Details
    admissionNumber: {
      type: String,
      required: true,
      trim: true,
      // e.g., "ADM-2026-001" or General Register (GR) Number
    },

    admissionDate: {
      type: Date,
      default: Date.now,
    },

    academicSession: {
      type: String,
      required: true,
      default: '2025-2026', // e.g. "2025-2026"
    },

    // 2. Academic Placement
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicClass',
    },

    className: {
      type: String,
      required: true,
      trim: true, // "Class 1", "Class 5", "Class 10"
      index: true,
    },

    section: {
      type: String,
      required: true,
      uppercase: true,
      trim: true, // "A", "B", "Rose"
      index: true,
    },

    rollNumber: {
      type: String,
      required: true,
      trim: true,
    },

    // 3. Personal Information
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      required: true,
    },

    dob: {
      type: Date,
      required: true,
    },

    bFormOrCnic: {
      type: String,
      trim: true, // National ID or B-Form number
    },

    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
      default: 'Unknown',
    },

    religion: {
      type: String,
      default: 'Islam',
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      default: 'Lahore',
      trim: true,
    },

    // 4. Guardian / Parent Information
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

    fatherPhone: {
      type: String,
      required: true,
      trim: true, // Primary phone for SMS/WhatsApp notices & fee reminders
    },

    fatherOccupation: {
      type: String,
      trim: true,
    },

    motherName: {
      type: String,
      trim: true,
    },

    guardianEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },

    emergencyContact: {
      type: String,
      trim: true,
    },

    // 5. Student Photograph (Stored in Cloudinary)
    photo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    // 6. Previous School Details (if applicable)
    previousSchool: {
      type: String,
      trim: true,
    },

    previousClass: {
      type: String,
      trim: true,
    },

    leavingCertificateNumber: {
      type: String,
      trim: true,
    },

    // 7. Fee & Concession Profile (Decided at Admission)
    monthlyFee: {
      type: Number,
      required: true,
      default: 2500, // Standard Monthly Tuition Fee in PKR
      min: 0,
    },

    admissionFee: {
      type: Number,
      default: 0, // One-Time Admission Registration Fee in PKR
      min: 0,
    },

    annualCharges: {
      type: Number,
      default: 0, // Annual Charges / Exam / Security in PKR
      min: 0,
    },

    monthlyDiscount: {
      type: Number,
      default: 0, // In PKR / Currency (Sibling discount, Merit, etc.)
      min: 0,
    },

    discountReason: {
      type: String,
      trim: true,
    },

    netMonthlyFee: {
      type: Number,
      default: 2500, // Net payable monthly fee after discount
      min: 0,
    },

    // 8. Lifecycle & Status
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'STRUCK_OFF', 'PASSED_OUT'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true }
);

// Compound Indexes for fast queries and uniqueness
// 1. Unique admission number per school
StudentSchema.index({ schoolCode: 1, admissionNumber: 1 }, { unique: true });

// 2. Unique roll number per class and section in that school
StudentSchema.index({ schoolCode: 1, className: 1, section: 1, rollNumber: 1 }, { unique: true });

// 3. Fast search by name, father phone, or class
StudentSchema.index({ schoolCode: 1, fullName: 'text', fatherName: 'text' });
StudentSchema.index({ schoolCode: 1, className: 1, section: 1, status: 1 });
StudentSchema.index({ schoolCode: 1, fatherCnic: 1 });
StudentSchema.index({ schoolCode: 1, status: 1 });
StudentSchema.index({ schoolCode: 1, admissionDate: -1 });

export const Student = mongoose.model('Student', StudentSchema);
export default Student;
