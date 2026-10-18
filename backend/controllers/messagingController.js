import StudentAttendance from '../models/StudentAttendance.js';
import Student from '../models/Student.js';
import SchoolProfile from '../models/SchoolProfile.js';
import SchoolWhatsAppSession from '../models/SchoolWhatsAppSession.js';
import { AcademicClass } from '../models/AcademicClass.js';
import ClassWhatsAppGroup from '../models/ClassWhatsAppGroup.js';
import {
  initWhatsAppSession,
  getSessionStatus,
  disconnectSession,
  sendSingleMessage,
  dispatchBulkAbsentAlerts,
  cancelBulkQueue,
  formatForWaLink,
  fetchParticipatingGroups,
  createWhatsAppClassGroup,
  syncWhatsAppGroupParticipants,
  sendWhatsAppGroupDiary,
  resolveGroupFromInviteLink,
  broadcastToWhatsAppGroups,
} from '../services/whatsappGateway.js';

/**
 * Resolve schoolCode safely for all users (including SUPER_ADMIN / Developer)
 */
function resolveSchoolCode(req) {
  const code =
    req.schoolCode ||
    req.query?.schoolCode ||
    req.body?.schoolCode ||
    req.user?.schoolCode ||
    'SCH-101';
  return String(code).toUpperCase().trim();
}

/**
 * Format message template with student & school particulars
 */
function fillTemplate(template, data) {
  return template
    .replace(/{studentName}/g, data.studentName || '')
    .replace(/{fatherName}/g, data.fatherName || '')
    .replace(/{rollNumber}/g, data.rollNumber || '')
    .replace(/{className}/g, data.className || '')
    .replace(/{section}/g, data.section || '')
    .replace(/{date}/g, data.date || '')
    .replace(/{schoolName}/g, data.schoolName || '');
}

/**
 * GET /api/messaging/whatsapp-status
 */
export async function getWhatsAppStatus(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const status = await getSessionStatus(schoolCode);
    return res.status(200).json({ success: true, data: status });
  } catch (err) {
    console.error('getWhatsAppStatus error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/messaging/connect-whatsapp
 */
export async function connectWhatsApp(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const io = req.io;

    await initWhatsAppSession(schoolCode, io);

    // Wait 2.5 seconds for Baileys to produce the first QR code
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const status = await getSessionStatus(schoolCode);
    return res.status(200).json({
      success: true,
      message: 'WhatsApp gateway initialized. Please scan QR Code.',
      data: status,
    });
  } catch (err) {
    console.error('connectWhatsApp error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/messaging/disconnect-whatsapp
 */
export async function disconnectWhatsApp(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const io = req.io;
    await disconnectSession(schoolCode, io);
    return res.status(200).json({ success: true, message: 'WhatsApp session disconnected successfully.' });
  } catch (err) {
    console.error('disconnectWhatsApp error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/messaging/absent-students
 * Query: dateString (YYYY-MM-DD), className, section
 */
export async function getAbsentStudents(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const today = new Date().toISOString().split('T')[0];
    const dateString = req.query.dateString || today;
    const { className, section } = req.query;

    // 1. Fetch School Profile for name & contact
    let profile = await SchoolProfile.findOne({ schoolCode });
    const schoolName = profile?.schoolName || 'The School Administration';

    // 2. Fetch School WhatsApp Session for custom templates & today's sent logs
    let session = await SchoolWhatsAppSession.findOne({ schoolCode });
    if (!session) {
      session = await SchoolWhatsAppSession.create({ schoolCode });
    }

    const defaultUrduTpl =
      session.customTemplates?.absentUrdu ||
      'محترم والدین!\nطالب علم: {studentName} (Roll # {rollNumber})\nکلاس: {className}-{section}\nآج مورخہ {date} کو {schoolName} سے غیر حاضر (Absent) ہیں۔\nبرائے مہربانی غیر حاضری کی وجہ سے مطلع فرمائیں۔\nشکریہ،\n{schoolName}';

    const defaultEngTpl =
      session.customTemplates?.absentEnglish ||
      'Respected Parent,\nYour child {studentName} (Roll # {rollNumber}, Class {className}-{section}) is marked ABSENT today ({date}) at {schoolName}.\nPlease contact the school administration if leave was requested.\nRegards,\n{schoolName}';

    // 3. Query Daily Attendance Sheets for date
    const attendanceFilter = { schoolCode, dateString };
    if (className && className !== 'ALL') attendanceFilter.className = className;
    if (section && section !== 'ALL') attendanceFilter.section = section;

    const attendanceSheets = await StudentAttendance.find(attendanceFilter);

    // Extract all absent student items from sheets
    const absentItems = [];
    const studentIdList = [];

    attendanceSheets.forEach((sheet) => {
      (sheet.records || []).forEach((rec) => {
        if (rec.status === 'ABSENT') {
          absentItems.push({
            studentId: rec.studentId,
            admissionNumber: rec.admissionNumber,
            rollNumber: rec.rollNumber,
            studentName: rec.studentName,
            fatherName: rec.fatherName,
            className: sheet.className,
            section: sheet.section,
          });
          studentIdList.push(rec.studentId);
        }
      });
    });

    // 4. Fetch phone numbers from Student Collection
    const studentsData = await Student.find(
      { _id: { $in: studentIdList } },
      'fatherPhone emergencyContact fatherName fullName'
    ).lean();

    const studentPhoneMap = new Map();
    studentsData.forEach((s) => {
      const phone = s.fatherPhone || s.emergencyContact || '';
      studentPhoneMap.set(String(s._id), phone);
    });

    // 5. Check sent status & no WhatsApp status from today's dailySentLogs
    const todaySentSet = new Set();
    const noWhatsAppSet = new Set();
    const todayLogsMap = new Map();
    (session.dailySentLogs || []).forEach((log) => {
      if (log.dateString === dateString) {
        if (log.status === 'SENT') {
          todaySentSet.add(String(log.studentId));
          todayLogsMap.set(String(log.studentId), log.sentAt);
        } else if (log.status === 'NO_WHATSAPP') {
          noWhatsAppSet.add(String(log.studentId));
        }
      }
    });

    // 6. Format finalized list with templates & wa.me fallback link
    const finalizedList = absentItems.map((item) => {
      const phone = studentPhoneMap.get(String(item.studentId)) || '';
      const alreadySent = todaySentSet.has(String(item.studentId));
      const noWhatsApp = noWhatsAppSet.has(String(item.studentId));
      const sentAt = todayLogsMap.get(String(item.studentId)) || null;

      const templateData = {
        studentName: item.studentName,
        fatherName: item.fatherName,
        rollNumber: item.rollNumber,
        className: item.className,
        section: item.section,
        date: dateString,
        schoolName,
      };

      const urduMessage = fillTemplate(defaultUrduTpl, templateData);
      const englishMessage = fillTemplate(defaultEngTpl, templateData);

      // Clean wa.me link for direct browser fallback
      const cleanDigits = formatForWaLink(phone);
      const waLink = cleanDigits
        ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(urduMessage)}`
        : '';

      return {
        ...item,
        phone,
        alreadySent,
        noWhatsApp,
        sentAt,
        urduMessage,
        englishMessage,
        waLink,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        dateString,
        totalAbsent: finalizedList.length,
        alreadySentCount: finalizedList.filter((x) => x.alreadySent).length,
        pendingCount: finalizedList.filter((x) => !x.alreadySent).length,
        schoolName,
        customTemplates: {
          absentUrdu: defaultUrduTpl,
          absentEnglish: defaultEngTpl,
        },
        students: finalizedList,
      },
    });
  } catch (err) {
    console.error('getAbsentStudents error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/messaging/send-single-alert
 * Body: { phone, messageText, studentId, studentName, rollNumber, className, section, dateString }
 */
export async function sendSingleAlert(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const { phone, messageText, studentId, studentName, rollNumber, className, section, dateString } = req.body;

    if (!phone || !messageText) {
      return res.status(400).json({ success: false, message: 'Phone and messageText are required.' });
    }

    const sendRes = await sendSingleMessage(schoolCode, phone, messageText);

    // Record in database
    await SchoolWhatsAppSession.findOneAndUpdate(
      { schoolCode },
      {
        $push: {
          dailySentLogs: {
            dateString: dateString || new Date().toISOString().split('T')[0],
            studentId,
            studentName,
            rollNumber,
            className,
            section,
            phone,
            status: 'SENT',
            sentAt: new Date(),
          },
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: `Message sent successfully to ${phone}`,
      data: sendRes,
    });
  } catch (err) {
    console.error('sendSingleAlert error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/messaging/send-bulk-absent-alerts
 * Body: { alerts: Array of { studentId, studentName, rollNumber, className, section, phone, messageText }, dateString }
 */
export async function sendBulkAbsentAlerts(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const io = req.io;
    const { alerts, dateString } = req.body;

    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
      return res.status(400).json({ success: false, message: 'No absent students provided in payload.' });
    }

    const today = new Date().toISOString().split('T')[0];
    const resolvedDate = dateString || today;

    // Start background throttled dispatch
    // Note: We run this asynchronously and return immediate confirmation, while progress updates stream over Socket.io
    dispatchBulkAbsentAlerts({
      schoolCode,
      alerts,
      dateString: resolvedDate,
      io,
    }).catch((err) => {
      console.error(`[WhatsApp Gateway] Bulk dispatch error for ${schoolCode}:`, err);
    });

    return res.status(200).json({
      success: true,
      message: `Bulk queue started for ${alerts.length} students with anti-ban delay (5-8 seconds per student).`,
      total: alerts.length,
    });
  } catch (err) {
    console.error('sendBulkAbsentAlerts error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/messaging/cancel-bulk-queue
 */
export async function cancelBulkAlertQueue(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const cancelled = cancelBulkQueue(schoolCode);
    return res.status(200).json({
      success: true,
      message: cancelled ? 'Sending queue cancelled successfully.' : 'No active queue was running.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/messaging/custom-templates
 * Body: { absentUrdu, absentEnglish }
 */
export async function updateCustomTemplates(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const { absentUrdu, absentEnglish } = req.body;

    const session = await SchoolWhatsAppSession.findOneAndUpdate(
      { schoolCode },
      {
        $set: {
          'customTemplates.absentUrdu': absentUrdu,
          'customTemplates.absentEnglish': absentEnglish,
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Custom message templates saved successfully.',
      data: session.customTemplates,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =========================================================================
// SUB-MODULE 2: DAILY CLASS DIARY & WHATSAPP GROUPS
// Zero Database Bloat: Media and diary text are NEVER stored in MongoDB!
// =========================================================================

/**
 * GET /api/messaging/class-groups
 * Lists all classes & sections with their linked WhatsApp group status
 */
export async function getClassGroups(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);

    // 1. Fetch classes & linked groups in parallel
    const [classes, linkedGroups, studentCounts] = await Promise.all([
      AcademicClass.find({ schoolCode }).sort({ numericOrder: 1, name: 1 }).lean(),
      ClassWhatsAppGroup.find({ schoolCode }).lean(),
      Student.aggregate([
        { $match: { schoolCode, status: 'ACTIVE' } },
        {
          $group: {
            _id: { className: '$className', section: '$section' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Map linked groups by "className:section"
    const groupMap = new Map();
    linkedGroups.forEach((g) => {
      const key = `${g.className}:${g.section}`.toUpperCase();
      groupMap.set(key, g);
    });

    // Map student counts
    const countMap = new Map();
    studentCounts.forEach((sc) => {
      const key = `${sc._id.className}:${sc._id.section}`.toUpperCase();
      countMap.set(key, sc.count);
    });

    // Assemble unified list
    const resultList = [];
    classes.forEach((cls) => {
      const cName = cls.className || cls.name;
      const sections = cls.sections || [];

      if (sections.length === 0) {
        // Fallback for class without section
        const key = `${cName}:A`.toUpperCase();
        const grp = groupMap.get(key);
        resultList.push({
          className: cName,
          section: 'A',
          isLinked: Boolean(grp?.groupJid),
          groupJid: grp?.groupJid || null,
          groupName: grp?.groupName || '',
          inviteLink: grp?.inviteLink || '',
          totalParticipants: grp?.totalParticipants || 0,
          lastDiarySentAt: grp?.lastDiarySentAt || null,
          studentCount: countMap.get(key) || 0,
        });
      } else {
        sections.forEach((sec) => {
          const sName = (typeof sec === 'object' ? sec?.name : sec) || 'A';
          const key = `${cName}:${sName}`.toUpperCase();
          const grp = groupMap.get(key);
          resultList.push({
            className: cName,
            section: sName,
            isLinked: Boolean(grp?.groupJid),
            groupJid: grp?.groupJid || null,
            groupName: grp?.groupName || '',
            inviteLink: grp?.inviteLink || '',
            totalParticipants: grp?.totalParticipants || 0,
            lastDiarySentAt: grp?.lastDiarySentAt || null,
            studentCount: countMap.get(key) || 0,
          });
        });
      }
    });

    return res.status(200).json({ success: true, data: resultList });
  } catch (err) {
    console.error('getClassGroups error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/messaging/whatsapp-groups-list
 * Fetches existing groups from the connected school WhatsApp phone
 */
export async function getWhatsAppGroupsList(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const groups = await fetchParticipatingGroups(schoolCode);
    return res.status(200).json({ success: true, data: groups });
  } catch (err) {
    console.error('getWhatsAppGroupsList error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/messaging/create-class-group
 * Auto-creates a new WhatsApp group for a class and adds parents
 */
export async function createClassGroup(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const { className, section, groupTitle } = req.body;

    if (!className || !section) {
      return res.status(400).json({ success: false, message: 'Class name and section are required.' });
    }

    // 1. Fetch School Profile for default title
    const profile = await SchoolProfile.findOne({ schoolCode });
    const sName = profile?.schoolName ? profile.schoolName.substring(0, 15) : 'School';
    const finalTitle = groupTitle || `${className}-${section} | ${sName}`;

    // 2. Fetch Active Student Phones for this Class
    const students = await Student.find(
      { schoolCode, className, section, status: 'ACTIVE' },
      'fatherPhone emergencyContact'
    ).lean();

    const phones = students.map((s) => s.fatherPhone || s.emergencyContact).filter(Boolean);

    // 3. Create Group via WhatsApp Gateway
    const groupResult = await createWhatsAppClassGroup(schoolCode, finalTitle, phones);

    // 4. Save/Update Mapping in Database (< 0.1 KB record)
    const savedMapping = await ClassWhatsAppGroup.findOneAndUpdate(
      { schoolCode, className, section },
      {
        schoolCode,
        className,
        section,
        groupJid: groupResult.groupJid,
        groupName: groupResult.groupName,
        inviteLink: groupResult.inviteLink,
        totalParticipants: groupResult.totalParticipants,
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `WhatsApp Group "${finalTitle}" created successfully with ${groupResult.totalParticipants} participants!`,
      data: savedMapping,
    });
  } catch (err) {
    console.error('createClassGroup error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/messaging/link-class-group
 * Links an existing WhatsApp group from school's phone to a class
 */
export async function linkExistingClassGroup(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const { className, section, groupJid, groupName, inviteLink } = req.body;

    if (!className || !section) {
      return res.status(400).json({ success: false, message: 'Class and section are required.' });
    }

    let finalJid = groupJid;
    let finalName = groupName;
    let finalInvite = inviteLink || '';
    let participantsCount = 0;

    // If no groupJid provided but invite link is given, resolve it via Baileys
    if (!finalJid && inviteLink) {
      const resolved = await resolveGroupFromInviteLink(schoolCode, inviteLink);
      finalJid = resolved.groupJid;
      finalName = resolved.groupName;
      finalInvite = resolved.inviteLink;
      participantsCount = resolved.totalParticipants;
    }

    if (!finalJid || !finalName) {
      return res.status(400).json({
        success: false,
        message: 'Please select an existing group from the list, or provide a valid WhatsApp group invite link.',
      });
    }

    const updateDoc = {
      schoolCode,
      className,
      section,
      groupJid: finalJid,
      groupName: finalName,
      inviteLink: finalInvite,
    };
    if (participantsCount > 0) {
      updateDoc.totalParticipants = participantsCount;
    }

    const savedMapping = await ClassWhatsAppGroup.findOneAndUpdate(
      { schoolCode, className, section },
      updateDoc,
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `Class ${className}-${section} linked to "${finalName}" successfully!`,
      data: savedMapping,
    });
  } catch (err) {
    console.error('linkExistingClassGroup error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/messaging/sync-class-group-participants
 * Checks for newly admitted students and adds them to the WhatsApp group
 */
export async function syncClassGroup(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const { className, section } = req.body;

    const groupRecord = await ClassWhatsAppGroup.findOne({ schoolCode, className, section });
    if (!groupRecord || !groupRecord.groupJid) {
      return res.status(404).json({ success: false, message: 'No WhatsApp group is linked to this class yet.' });
    }

    // Fetch active students' phones
    const students = await Student.find(
      { schoolCode, className, section, status: 'ACTIVE' },
      'fatherPhone emergencyContact'
    ).lean();

    const phones = students.map((s) => s.fatherPhone || s.emergencyContact).filter(Boolean);

    const syncRes = await syncWhatsAppGroupParticipants(schoolCode, groupRecord.groupJid, phones);

    // Update participant count
    groupRecord.totalParticipants = syncRes.totalParticipants;
    await groupRecord.save();

    return res.status(200).json({
      success: true,
      message: `Sync complete! ${syncRes.addedCount} new parent(s) added. Total participants: ${syncRes.totalParticipants}`,
      data: syncRes,
    });
  } catch (err) {
    console.error('syncClassGroup error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/messaging/send-class-diary
 * Sends written homework or photo diary to the class WhatsApp group
 * Zero Database Bloat: Media and text are NOT saved in MongoDB!
 */
export async function sendClassDiary(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const { className, section, diaryText } = req.body;

    if (!className || !section) {
      return res.status(400).json({ success: false, message: 'Class name and section are required.' });
    }

    if (!diaryText && !req.file) {
      return res.status(400).json({ success: false, message: 'Please provide either written homework or upload an image.' });
    }

    // Find linked group
    const groupRecord = await ClassWhatsAppGroup.findOne({ schoolCode, className, section });
    if (!groupRecord || !groupRecord.groupJid) {
      return res.status(400).json({
        success: false,
        message: `No WhatsApp group is linked to Class ${className}-${section}. Please setup or link a group first.`,
      });
    }

    // Send to WhatsApp group
    const sendResult = await sendWhatsAppGroupDiary(schoolCode, groupRecord.groupJid, {
      text: diaryText,
      imageBuffer: req.file?.buffer || null,
      imageMime: req.file?.mimetype || 'image/jpeg',
    });

    // Update lastDiarySentAt timestamp on group (lightweight update)
    groupRecord.lastDiarySentAt = new Date();
    await groupRecord.save();

    // Immediately clear file buffer from memory for garbage collection
    if (req.file) {
      req.file.buffer = null;
    }

    return res.status(200).json({
      success: true,
      message: `Daily diary delivered successfully to WhatsApp group "${groupRecord.groupName}"!`,
      data: sendResult,
    });
  } catch (err) {
    console.error('sendClassDiary error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/messaging/broadcast-announcement
 * Broadcasts an official announcement / circular notice to multiple or all linked class WhatsApp groups
 */
export async function broadcastAnnouncement(req, res) {
  try {
    const schoolCode = resolveSchoolCode(req);
    const { noticeText, targetGroupJids } = req.body;

    if (!noticeText && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either announcement text or upload a circular image.',
      });
    }

    // Determine target groups
    let targetJidList = [];
    if (targetGroupJids) {
      if (Array.isArray(targetGroupJids)) {
        targetJidList = targetGroupJids;
      } else {
        try {
          targetJidList = JSON.parse(targetGroupJids);
        } catch {
          targetJidList = [targetGroupJids];
        }
      }
    }

    // Query ClassWhatsAppGroup
    const query = { schoolCode, groupJid: { $exists: true, $ne: '' } };
    if (targetJidList.length > 0) {
      query.groupJid = { $in: targetJidList };
    }

    const linkedGroups = await ClassWhatsAppGroup.find(query).lean();

    if (linkedGroups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No linked WhatsApp class groups found to deliver this announcement. Please setup or link class groups first.',
      });
    }

    const io = req.app.get('io');

    const result = await broadcastToWhatsAppGroups({
      schoolCode,
      targetGroups: linkedGroups.map((g) => ({
        groupJid: g.groupJid,
        groupName: g.groupName || `${g.className}-${g.section}`,
        className: g.className,
        section: g.section,
      })),
      text: noticeText,
      imageBuffer: req.file?.buffer || null,
      imageMime: req.file?.mimetype || 'image/jpeg',
      io,
    });

    // Zero Database Bloat: Notice content is NEVER saved in MongoDB Atlas M0!
    // Memory cleanup: null req.file.buffer immediately
    if (req.file) {
      req.file.buffer = null;
    }

    return res.status(200).json({
      success: true,
      message: `Announcement broadcast successfully to ${result.successful} of ${result.total} class groups!`,
      data: result,
    });
  } catch (err) {
    console.error('broadcastAnnouncement error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

