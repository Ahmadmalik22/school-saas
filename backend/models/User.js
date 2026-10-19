import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ALL_SUBMODULE_KEYS } from '../config/moduleCatalog.js';

const UserSchema = new mongoose.Schema(
  {
    // Multi-tenant SaaS identifier (e.g. "SCH-101", "APS-01", "LGS-05", "SYSTEM")
    schoolCode: {
      type: String,
      required: true,
      default: 'SYSTEM',
      uppercase: true,
      trim: true,
      index: true,
    },

    schoolName: {
      type: String,
      required: true,
      default: 'EduNexus Developer Platform',
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'TEACHER', 'CLERK', 'CUSTOM'],
      default: 'ADMIN',
      index: true,
    },

    // Granular Module & Sub-Module Rights & Permissions (Developer-assigned)
    // Supports 33 granular submodules (e.g. 'student_fee_management', 'admit_student', 'exam_marks_entry')
    permissions: {
      type: [String],
      default: ALL_SUBMODULE_KEYS,
    },

    // For teachers: assigned classes & subjects
    assignedClasses: [
      {
        className: String,
        section: String,
        subject: String,
      },
    ],

    profilePicture: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index: Unique email per school
UserSchema.index({ schoolCode: 1, email: 1 }, { unique: true });

// Pre-save password hashing
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model('User', UserSchema);
export default User;
