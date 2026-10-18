import mongoose from 'mongoose';

/**
 * Ultra-Lightweight Class WhatsApp Group Mapping
 * Consumes < 0.1 KB per class. Does NOT store message or media history.
 */
const ClassWhatsAppGroupSchema = new mongoose.Schema(
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
    },
    section: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    groupJid: {
      type: String,
      required: true,
      trim: true,
    },
    groupName: {
      type: String,
      required: true,
      trim: true,
    },
    inviteLink: {
      type: String,
      default: '',
      trim: true,
    },
    totalParticipants: {
      type: Number,
      default: 0,
    },
    lastDiarySentAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound Unique Index: One WhatsApp group per class & section per school
ClassWhatsAppGroupSchema.index(
  { schoolCode: 1, className: 1, section: 1 },
  { unique: true }
);

export default mongoose.model('ClassWhatsAppGroup', ClassWhatsAppGroupSchema);
