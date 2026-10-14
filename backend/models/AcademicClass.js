import mongoose from 'mongoose';

const AcademicClassSchema = new mongoose.Schema(
  {
    // Multi-tenant SaaS identifier
    schoolCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      // e.g., "Nursery", "Prep", "Class 1", "Class 2", ... "Class 10"
    },

    numericOrder: {
      type: Number,
      default: 1, // Useful for ordering classes sequentially (0, 1, 2, ... 10)
    },

    sections: [
      {
        name: { type: String, required: true, uppercase: true, trim: true }, // "A", "B", "Rose", etc.
        capacity: { type: Number, default: 40 },
        roomNumber: { type: String, trim: true, default: '' },
      },
    ],

    monthlyTuitionFee: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Unique class name per school
AcademicClassSchema.index({ schoolCode: 1, name: 1 }, { unique: true });

export const AcademicClass = mongoose.model('AcademicClass', AcademicClassSchema);
