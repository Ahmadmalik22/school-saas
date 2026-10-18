import express from 'express';
import multer from 'multer';
import {
  getWhatsAppStatus,
  connectWhatsApp,
  disconnectWhatsApp,
  getAbsentStudents,
  sendSingleAlert,
  sendBulkAbsentAlerts,
  cancelBulkAlertQueue,
  updateCustomTemplates,
  getClassGroups,
  getWhatsAppGroupsList,
  createClassGroup,
  linkExistingClassGroup,
  syncClassGroup,
  sendClassDiary,
  broadcastAnnouncement,
} from '../controllers/messagingController.js';

const router = express.Router();

// Memory-only upload storage strictly limited to 4MB (Protects Render 512MB RAM & Zero disk storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

// ==========================================
// 1. WhatsApp Gateway Session Management
// ==========================================
router.get('/whatsapp-status', getWhatsAppStatus);
router.post('/connect-whatsapp', connectWhatsApp);
router.post('/disconnect-whatsapp', disconnectWhatsApp);

// ==========================================
// 2. Sub-module 1: Absent Student Alerts
// ==========================================
router.get('/absent-students', getAbsentStudents);
router.post('/send-single-alert', sendSingleAlert);
router.post('/send-bulk-absent-alerts', sendBulkAbsentAlerts);
router.post('/cancel-bulk-queue', cancelBulkAlertQueue);
router.put('/custom-templates', updateCustomTemplates);

// ==========================================
// 3. Sub-module 2: Daily Class Diary & Groups
// Zero DB Bloat: Diary pictures & texts are NOT stored in MongoDB!
// ==========================================
router.get('/class-groups', getClassGroups);
router.get('/whatsapp-groups-list', getWhatsAppGroupsList);
router.post('/create-class-group', createClassGroup);
router.post('/link-class-group', linkExistingClassGroup);
router.post('/sync-class-group-participants', syncClassGroup);
router.post('/send-class-diary', upload.single('diaryImage'), sendClassDiary);

// ==========================================
// 4. Sub-module 3: Broadcast Announcements
// Zero DB Bloat: Circular pictures & texts are NOT stored in MongoDB!
// ==========================================
router.post('/broadcast-announcement', upload.single('noticeImage'), broadcastAnnouncement);

export default router;
