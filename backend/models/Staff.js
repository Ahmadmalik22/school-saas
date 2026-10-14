import mongoose from 'mongoose';

const StaffSchema = new mongoose.Schema(
  {
    // Multi-tenant SaaS identifier
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // 1. Employment Details
    employeeId: {
      type: String,
      required: true,
      trim: true,
      // e.g. "EMP-2026-001" or "TCH-101"
    },

    joiningDate: {
      type: Date,
      default: Date.now,
    },

    role: {
      type: String,
      enum: [
        'Teacher',
        'Head Teacher / Vice Principal',
        'Principal / Director',
        'Accountant',
        'Admin / Clerk',
        'Librarian',
        'Lab Assistant',
        'Support Staff / Peon / Guard',
      ],
      default: 'Teacher',
      index: true,
    },

    department: {
      type: String,
      enum: [
        'Science',
        'Mathematics',
        'English & Languages',
        'Urdu & Islamiyat',
        'Social Studies / Arts',
        'Computer & IT',
        'Accounts & Finance',
        'Administration',
        'General / Support',
      ],
      default: 'Science',
    },

    // 2. Personal Information
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

    cnic: {
      type: String,
      required: true,
      trim: true, // National Identity Card number
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
    },

    emergencyContact: {
      type: String,
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

    // 3. Professional & Educational Profile
    qualification: {
      type: String,
      required: true,
      trim: true, // e.g. "M.Sc Physics, B.Ed"
    },

    experienceYears: {
      type: Number,
      default: 0,
    },

    // 4. Financial & Payroll Particulars
    basicSalary: {
      type: Number,
      required: true,
      min: 0,
      default: 25000, // Monthly salary in PKR
    },

    bankAccountNumber: {
      type: String,
      trim: true,
    },

    // 5. Staff Photograph (Cloudinary WebP)
    photo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    // 6. Status & System Access
    status: {
      type: String,
      enum: ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'],
      default: 'ACTIVE',
      index: true,
    },

    hasPortalAccess: {
      type: Boolean,
      default: false, // Whether this staff member can log in as a teacher/staff
    },
  },
  { timestamps: true }
);

// Compound Unique Index: Employee ID unique per school
StaffSchema.index({ schoolCode: 1, employeeId: 1 }, { unique: true });
StaffSchema.index({ schoolCode: 1, cnic: 1 }, { unique: true });
StaffSchema.index({ schoolCode: 1, role: 1, status: 1 });

export const Staff = mongoose.model('Staff', StaffSchema);
export default Staff;
