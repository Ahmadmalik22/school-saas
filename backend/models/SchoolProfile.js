import mongoose from 'mongoose';

const SchoolProfileSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    schoolName: {
      type: String,
      required: true,
      trim: true,
      default: 'School Campus Portal',
    },
    tagline: {
      type: String,
      trim: true,
      default: 'Excellence in Education & Character Building',
    },
    address: {
      type: String,
      trim: true,
      default: 'PAKISTAN TOWN, ISLAMABAD',
    },
    phone: {
      type: String,
      trim: true,
      default: '+92 51 9283741',
    },
    email: {
      type: String,
      trim: true,
      default: 'admin@school.edu.pk',
    },
    affiliation: {
      type: String,
      trim: true,
      default: 'Affiliated with Federal Board of Intermediate and Secondary Education (FBISE)',
    },
    principalTitle: {
      type: String,
      trim: true,
      default: 'Principal',
    },
    vicePrincipalTitle: {
      type: String,
      trim: true,
      default: 'Vice Principal',
    },
    logoUrl: {
      type: String,
      default: null,
    },
    principalSignatureUrl: {
      type: String,
      default: null,
    },
    activeSession: {
      type: String,
      default: '2025-2026',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

export const SchoolProfile = mongoose.model('SchoolProfile', SchoolProfileSchema);
export default SchoolProfile;
