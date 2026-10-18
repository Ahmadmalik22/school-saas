import mongoose from 'mongoose';

const SchoolWhatsAppSessionSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    isConnected: {
      type: Boolean,
      default: false,
    },
    phoneNumber: {
      type: String,
      default: '',
      trim: true,
    },
    pushName: {
      type: String,
      default: '',
      trim: true,
    },
    lastConnectedAt: {
      type: Date,
    },
    customTemplates: {
      absentUrdu: {
        type: String,
        default:
          'محترم والدین!\nطالب علم: {studentName} (Roll # {rollNumber})\nکلاس: {className}-{section}\nآج مورخہ {date} کو {schoolName} سے غیر حاضر (Absent) ہیں۔\nبرائے مہربانی غیر حاضری کی وجہ سے مطلع فرمائیں۔\nشکریہ،\n{schoolName}',
      },
      absentEnglish: {
        type: String,
        default:
          'Respected Parent,\nYour child {studentName} (Roll # {rollNumber}, Class {className}-{section}) is marked ABSENT today ({date}) at {schoolName}.\nPlease contact the school administration if leave was requested.\nRegards,\n{schoolName}',
      },
    },
    dailySentLogs: [
      {
        dateString: { type: String, required: true },
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        studentName: { type: String, default: '' },
        rollNumber: { type: String, default: '' },
        className: { type: String, default: '' },
        section: { type: String, default: '' },
        phone: { type: String, default: '' },
        status: { type: String, enum: ['SENT', 'FAILED', 'SKIPPED', 'NO_WHATSAPP'], default: 'SENT' },
        sentAt: { type: Date, default: Date.now },
        error: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('SchoolWhatsAppSession', SchoolWhatsAppSessionSchema);
