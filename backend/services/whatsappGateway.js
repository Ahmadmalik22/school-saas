import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import SchoolWhatsAppSession from '../models/SchoolWhatsAppSession.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_BASE_DIR = path.resolve(__dirname, '../whatsapp_sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_BASE_DIR)) {
  fs.mkdirSync(SESSIONS_BASE_DIR, { recursive: true });
}

// In-Memory Multi-Tenant Stores
const activeSockets = new Map(); // schoolCode -> WASocket instance
const activeQRCodes = new Map(); // schoolCode -> base64 DataURL
const activeQueues = new Map();  // schoolCode -> { isRunning, isCancelled }

// Silent logger for clean console
const logger = pino({ level: 'silent' });

/**
 * Sanitize Pakistani / International mobile numbers for WhatsApp JID
 * Converts 03001234567, +923001234567, 0300-1234567 to 923001234567@s.whatsapp.net
 */
export function sanitizeWhatsAppNumber(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/[^0-9]/g, '');

  if (cleaned.startsWith('0092')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('03') && cleaned.length === 11) {
    cleaned = '92' + cleaned.slice(1);
  }
  if (cleaned.startsWith('3') && cleaned.length === 10) {
    cleaned = '92' + cleaned;
  }
  if (cleaned.length < 11 || cleaned.length > 15) {
    return null;
  }

  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Format pure phone for wa.me web link (e.g. 923001234567)
 */
export function formatForWaLink(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('03') && cleaned.length === 11) {
    cleaned = '92' + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Initialize / Resume WhatsApp Multi-Device Session for a specific school
 */
export async function initWhatsAppSession(schoolCode, io) {
  const code = String(schoolCode).toUpperCase().trim();
  const sessionDir = path.join(SESSIONS_BASE_DIR, code);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // If already active and connected, return existing socket
  if (activeSockets.has(code)) {
    const existingSock = activeSockets.get(code);
    if (existingSock?.user) {
      return { status: 'CONNECTED', user: existingSock.user };
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: ['School Management System', 'Chrome', '122.0.0.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    emitOwnEvents: false,
    syncFullHistory: false, // Critical for free server: disables heavy chat history downloads
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    getMessage: async () => undefined,
    shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') || jid?.endsWith('@g.us'), // Ignore group & status spam
  });

  activeSockets.set(code, sock);

  // Handle Credentials update
  sock.ev.on('creds.update', saveCreds);

  // Handle Connection Updates (QR code & open/close lifecycle)
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
        activeQRCodes.set(code, qrDataUrl);

        if (io) {
          io.to(`school:${code}`).emit('whatsapp_qr', {
            schoolCode: code,
            qr: qrDataUrl,
          });
        }
      } catch (err) {
        console.error(`[WhatsApp Gateway] QR generation error for ${code}:`, err);
      }
    }

    if (connection === 'open') {
      activeQRCodes.delete(code);
      const userPhone = sock.user?.id ? sock.user.id.split(':')[0] : '';
      const userName = sock.user?.name || 'School Official';

      console.log(`✅ [WhatsApp Gateway] School ${code} CONNECTED successfully via +${userPhone}`);

      await SchoolWhatsAppSession.findOneAndUpdate(
        { schoolCode: code },
        {
          schoolCode: code,
          isConnected: true,
          phoneNumber: userPhone,
          pushName: userName,
          lastConnectedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      if (io) {
        io.to(`school:${code}`).emit('whatsapp_connected', {
          schoolCode: code,
          phoneNumber: userPhone,
          pushName: userName,
        });
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.warn(
        `⚠️ [WhatsApp Gateway] School ${code} connection closed (code: ${statusCode}, reconnect: ${shouldReconnect})`
      );

      if (shouldReconnect) {
        // Reconnect after 3 seconds
        setTimeout(() => {
          initWhatsAppSession(code, io);
        }, 3000);
      } else {
        // Logged out: Clean up session files and DB record
        activeSockets.delete(code);
        activeQRCodes.delete(code);
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch {}

        await SchoolWhatsAppSession.findOneAndUpdate(
          { schoolCode: code },
          { isConnected: false, phoneNumber: '' }
        );

        if (io) {
          io.to(`school:${code}`).emit('whatsapp_disconnected', { schoolCode: code });
        }
      }
    }
  });

  return { status: 'INITIALIZING' };
}

/**
 * Get current session status & QR code for a school
 */
export async function getSessionStatus(schoolCode) {
  const code = String(schoolCode).toUpperCase().trim();
  const sock = activeSockets.get(code);
  const qr = activeQRCodes.get(code) || null;

  let sessionRecord = await SchoolWhatsAppSession.findOne({ schoolCode: code });
  if (!sessionRecord) {
    sessionRecord = await SchoolWhatsAppSession.create({ schoolCode: code });
  }

  const isActuallyConnected = Boolean(sock?.user && sessionRecord.isConnected);

  return {
    isConnected: isActuallyConnected,
    phoneNumber: sessionRecord.phoneNumber || (sock?.user?.id ? sock.user.id.split(':')[0] : ''),
    pushName: sessionRecord.pushName || sock?.user?.name || '',
    lastConnectedAt: sessionRecord.lastConnectedAt,
    qrCode: qr,
    customTemplates: sessionRecord.customTemplates,
  };
}

/**
 * Disconnect and remove WhatsApp session for a school
 */
export async function disconnectSession(schoolCode, io) {
  const code = String(schoolCode).toUpperCase().trim();
  const sock = activeSockets.get(code);

  if (sock) {
    try {
      await sock.logout();
    } catch {}
    activeSockets.delete(code);
  }
  activeQRCodes.delete(code);

  const sessionDir = path.join(SESSIONS_BASE_DIR, code);
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch {}

  await SchoolWhatsAppSession.findOneAndUpdate(
    { schoolCode: code },
    { isConnected: false, phoneNumber: '' }
  );

  if (io) {
    io.to(`school:${code}`).emit('whatsapp_disconnected', { schoolCode: code });
  }

  return { success: true };
}

/**
 * Cancel currently running bulk sending queue for a school
 */
export function cancelBulkQueue(schoolCode) {
  const code = String(schoolCode).toUpperCase().trim();
  if (activeQueues.has(code)) {
    const queue = activeQueues.get(code);
    queue.isCancelled = true;
    return true;
  }
  return false;
}

/**
 * Send a single personalized text message with typing simulation
 */
export async function sendSingleMessage(schoolCode, rawPhone, messageText) {
  const code = String(schoolCode).toUpperCase().trim();
  const sock = activeSockets.get(code);

  if (!sock || !sock.user) {
    throw new Error('WhatsApp is not connected for this school. Please scan the QR code first.');
  }

  const jid = sanitizeWhatsAppNumber(rawPhone);
  if (!jid) {
    throw new Error(`Invalid mobile phone number: "${rawPhone}". Must be a valid Pakistani or international format.`);
  }

  // Verify if phone number is registered on WhatsApp
  try {
    const results = await sock.onWhatsApp(jid);
    if (!results || results.length === 0 || !results[0].exists) {
      throw new Error(`Mobile number "${rawPhone}" is NOT registered on WhatsApp.`);
    }
  } catch (err) {
    if (err.message.includes('NOT registered on WhatsApp')) throw err;
  }

  // Anti-Ban Typing Simulation: Send composing state for 1.2s before delivery
  try {
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise((r) => setTimeout(r, 1200));
    await sock.sendPresenceUpdate('paused', jid);
  } catch {}

  // Send message
  const result = await sock.sendMessage(jid, { text: messageText });
  return { success: true, messageId: result?.key?.id, jid };
}

/**
 * Safe, Throttled, Anti-Ban Bulk Absent Alert Dispatcher
 * Implements 5-8 second randomized jitter delay between every message
 */
export async function dispatchBulkAbsentAlerts({
  schoolCode,
  alerts, // array of { studentId, studentName, rollNumber, className, section, phone, messageText }
  dateString,
  io,
}) {
  const code = String(schoolCode).toUpperCase().trim();
  const sock = activeSockets.get(code);

  if (!sock || !sock.user) {
    throw new Error('WhatsApp is not connected for this school. Please scan the QR code first.');
  }

  // Prevent multiple overlapping queues for the same school
  if (activeQueues.has(code) && activeQueues.get(code).isRunning) {
    throw new Error('Another message batch is already running. Please wait for it to complete or click Cancel.');
  }

  const queueControl = { isRunning: true, isCancelled: false };
  activeQueues.set(code, queueControl);

  const results = {
    total: alerts.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    cancelled: false,
    details: [],
  };

  try {
    for (let i = 0; i < alerts.length; i++) {
      // Check if operator requested cancellation
      if (queueControl.isCancelled) {
        results.cancelled = true;
        break;
      }

      const item = alerts[i];
      const jid = sanitizeWhatsAppNumber(item.phone);

      if (!jid) {
        results.skippedCount++;
        results.details.push({
          studentId: item.studentId,
          studentName: item.studentName,
          status: 'SKIPPED',
          reason: 'Invalid or missing phone number',
        });
        continue;
      }

      // Verify if recipient is registered on WhatsApp before attempting delivery
      let isRegisteredOnWa = true;
      try {
        const waCheck = await sock.onWhatsApp(jid);
        if (!waCheck || waCheck.length === 0 || !waCheck[0].exists) {
          isRegisteredOnWa = false;
        }
      } catch {}

      if (!isRegisteredOnWa) {
        results.skippedCount++;
        results.details.push({
          studentId: item.studentId,
          studentName: item.studentName,
          rollNumber: item.rollNumber,
          className: item.className,
          section: item.section,
          phone: item.phone,
          status: 'NO_WHATSAPP',
          reason: 'Number is NOT registered on WhatsApp',
        });

        // Record in DB as NO_WHATSAPP so school operator can see it
        await SchoolWhatsAppSession.findOneAndUpdate(
          { schoolCode: code },
          {
            $push: {
              dailySentLogs: {
                dateString,
                studentId: item.studentId,
                studentName: item.studentName,
                rollNumber: item.rollNumber,
                className: item.className,
                section: item.section,
                phone: item.phone,
                status: 'NO_WHATSAPP',
                error: 'Not registered on WhatsApp',
                sentAt: new Date(),
              },
            },
          }
        );

        if (io) {
          io.to(`school:${code}`).emit('whatsapp_dispatch_progress', {
            schoolCode: code,
            current: i + 1,
            total: alerts.length,
            percent: Math.round(((i + 1) / alerts.length) * 100),
            studentName: item.studentName,
            status: 'NO_WHATSAPP',
          });
        }
        continue;
      }

      try {
        // Send presence typing simulation
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise((r) => setTimeout(r, 1200));
        await sock.sendPresenceUpdate('paused', jid);

        // Send message
        await sock.sendMessage(jid, { text: item.messageText });

        results.sentCount++;
        results.details.push({
          studentId: item.studentId,
          studentName: item.studentName,
          rollNumber: item.rollNumber,
          className: item.className,
          section: item.section,
          phone: item.phone,
          status: 'SENT',
        });

        // Record in database daily logs
        await SchoolWhatsAppSession.findOneAndUpdate(
          { schoolCode: code },
          {
            $push: {
              dailySentLogs: {
                dateString,
                studentId: item.studentId,
                studentName: item.studentName,
                rollNumber: item.rollNumber,
                className: item.className,
                section: item.section,
                phone: item.phone,
                status: 'SENT',
                sentAt: new Date(),
              },
            },
          }
        );

        // Real-Time Socket Progress Broadcast
        if (io) {
          io.to(`school:${code}`).emit('whatsapp_dispatch_progress', {
            schoolCode: code,
            current: i + 1,
            total: alerts.length,
            percent: Math.round(((i + 1) / alerts.length) * 100),
            studentName: item.studentName,
            status: 'SENT',
          });
        }
      } catch (err) {
        results.failedCount++;
        results.details.push({
          studentId: item.studentId,
          studentName: item.studentName,
          status: 'FAILED',
          reason: err.message,
        });

        if (io) {
          io.to(`school:${code}`).emit('whatsapp_dispatch_progress', {
            schoolCode: code,
            current: i + 1,
            total: alerts.length,
            percent: Math.round(((i + 1) / alerts.length) * 100),
            studentName: item.studentName,
            status: 'FAILED',
          });
        }
      }

      // CRITICAL ANTI-BAN SHIELD:
      // 1. Cool-down break: Every 20 messages, pause for 25 seconds to mimic human rest
      if ((i + 1) % 20 === 0 && i < alerts.length - 1 && !queueControl.isCancelled) {
        if (io) {
          io.to(`school:${code}`).emit('whatsapp_dispatch_progress', {
            schoolCode: code,
            current: i + 1,
            total: alerts.length,
            percent: Math.round(((i + 1) / alerts.length) * 100),
            studentName: 'Safe Cooling Pause...',
            status: 'COOLDOWN',
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 25000));
      } else if (i < alerts.length - 1 && !queueControl.isCancelled) {
        // 2. Randomized Human Jitter Delay: 6,000ms to 9,500ms between each message
        const jitterDelay = Math.floor(6000 + Math.random() * 3500);
        await new Promise((resolve) => setTimeout(resolve, jitterDelay));
      }
    }
  } finally {
    activeQueues.delete(code);
  }

  return results;
}

/**
 * Fetch all WhatsApp groups the connected school phone is participating in
 */
export async function fetchParticipatingGroups(schoolCode) {
  const code = String(schoolCode).toUpperCase().trim();
  const sock = activeSockets.get(code);

  if (!sock || !sock.user) {
    throw new Error('WhatsApp is not connected for this school. Please scan the QR code first.');
  }

  const groups = await sock.groupFetchAllParticipating();
  const list = Object.values(groups).map((g) => ({
    jid: g.id,
    subject: g.subject || 'Unnamed Group',
    size: g.participants?.length || 0,
    creation: g.creation,
    owner: g.owner,
  }));

  // Sort alphabetically by group subject
  return list.sort((a, b) => a.subject.localeCompare(b.subject));
}

/**
 * Auto-create a Class WhatsApp Group and add students' parents
 */
export async function createWhatsAppClassGroup(schoolCode, groupTitle, participantPhones = []) {
  const code = String(schoolCode).toUpperCase().trim();
  const sock = activeSockets.get(code);

  if (!sock || !sock.user) {
    throw new Error('WhatsApp is not connected for this school. Please scan the QR code first.');
  }

  // Sanitize and filter participant JIDs
  const validJids = [];
  for (const rawPhone of participantPhones) {
    const jid = sanitizeWhatsAppNumber(rawPhone);
    if (jid) validJids.push(jid);
  }

  // Deduplicate JIDs
  const uniqueJids = Array.from(new Set(validJids));

  // WhatsApp groupCreate
  const group = await sock.groupCreate(groupTitle, uniqueJids);

  // Set group to announcement mode (Only Admins can send messages)
  try {
    await sock.groupSettingUpdate(group.id, 'announcement');
  } catch (err) {
    console.warn(`Could not set group ${group.id} to announcement mode:`, err.message);
  }

  // Generate Group Invite Link
  let inviteLink = '';
  try {
    const codeStr = await sock.groupInviteCode(group.id);
    if (codeStr) {
      inviteLink = `https://chat.whatsapp.com/${codeStr}`;
    }
  } catch (err) {
    console.warn(`Could not get invite code for group ${group.id}:`, err.message);
  }

  return {
    groupJid: group.id,
    groupName: groupTitle,
    inviteLink,
    totalParticipants: uniqueJids.length + 1, // includes school admin
  };
}

/**
 * Sync / Add missing students' parents to an existing WhatsApp Group
 */
export async function syncWhatsAppGroupParticipants(schoolCode, groupJid, participantPhones = []) {
  const code = String(schoolCode).toUpperCase().trim();
  const sock = activeSockets.get(code);

  if (!sock || !sock.user) {
    throw new Error('WhatsApp is not connected for this school. Please scan the QR code first.');
  }

  // Get current participants
  const meta = await sock.groupMetadata(groupJid);
  const currentParticipants = new Set(
    (meta.participants || []).map((p) => p.id.split('@')[0].split(':')[0])
  );

  const missingJids = [];
  for (const rawPhone of participantPhones) {
    const jid = sanitizeWhatsAppNumber(rawPhone);
    if (jid) {
      const pureDigits = jid.split('@')[0];
      if (!currentParticipants.has(pureDigits)) {
        missingJids.push(jid);
      }
    }
  }

  const uniqueMissing = Array.from(new Set(missingJids));

  if (uniqueMissing.length > 0) {
    // Add missing participants in small batches of 10 to prevent rate-limits
    for (let i = 0; i < uniqueMissing.length; i += 10) {
      const batch = uniqueMissing.slice(i, i + 10);
      try {
        await sock.groupParticipantsUpdate(groupJid, batch, 'add');
      } catch (err) {
        console.warn('Batch add warning:', err.message);
      }
      if (i + 10 < uniqueMissing.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  // Refresh metadata
  let updatedMeta = meta;
  try {
    updatedMeta = await sock.groupMetadata(groupJid);
  } catch {}

  return {
    addedCount: uniqueMissing.length,
    totalParticipants: updatedMeta.participants?.length || 0,
  };
}

/**
 * Resolve Group Details from WhatsApp Invite Link
 */
export async function resolveGroupFromInviteLink(schoolCode, inviteLinkOrCode) {
  const code = String(schoolCode).toUpperCase().trim();
  const sock = activeSockets.get(code);

  if (!sock || !sock.user) {
    throw new Error('WhatsApp is not connected for this school. Please scan the QR code first.');
  }

  // Extract invite code
  const match = inviteLinkOrCode.match(/(?:chat\.whatsapp\.com\/)?([a-zA-Z0-9_-]+)/);
  const inviteCode = match ? match[1] : inviteLinkOrCode.trim();

  if (!inviteCode) {
    throw new Error('Invalid WhatsApp invite link format.');
  }

  try {
    const info = await sock.groupGetInviteInfo(inviteCode);

    // If socket is not yet in the group, attempt to accept invite / join
    try {
      await sock.groupAcceptInvite(inviteCode);
    } catch (joinErr) {
      console.log('Group join notice (or already member):', joinErr.message);
    }

    return {
      groupJid: info.id,
      groupName: info.subject || 'WhatsApp Group',
      totalParticipants: info.size || 0,
      inviteLink: `https://chat.whatsapp.com/${inviteCode}`,
    };
  } catch (err) {
    throw new Error(`Could not find group from invite link: ${err.message}`);
  }
}

/**
 * Send Daily Diary to a WhatsApp Group (Text or Image)
 */
export async function sendWhatsAppGroupDiary(schoolCode, groupJid, { text, imageBuffer, imageMime }) {
  const code = String(schoolCode).toUpperCase().trim();
  const sock = activeSockets.get(code);

  if (!sock || !sock.user) {
    throw new Error('WhatsApp is not connected for this school. Please scan the QR code first.');
  }

  if (imageBuffer) {
    // Send Image with Caption
    const result = await sock.sendMessage(groupJid, {
      image: imageBuffer,
      mimetype: imageMime || 'image/jpeg',
      caption: text || '',
    });
    return { success: true, messageId: result?.key?.id };
  } else {
    // Send Formatted Text Diary
    const result = await sock.sendMessage(groupJid, { text });
    return { success: true, messageId: result?.key?.id };
  }
}

/**
 * Safe, Throttled Multi-Group Broadcast Dispatcher (Anti-Ban Protected)
 * Sends announcement (Text or Image) to multiple groups with 2.5-4.2s jitter delay.
 */
export async function broadcastToWhatsAppGroups({
  schoolCode,
  targetGroups, // Array of { groupJid, groupName, className, section }
  text,
  imageBuffer,
  imageMime,
  io,
}) {
  const code = String(schoolCode).toUpperCase().trim();
  const sock = activeSockets.get(code);

  if (!sock || !sock.user) {
    throw new Error('WhatsApp is not connected for this school. Please scan the QR code first.');
  }

  if (!targetGroups || targetGroups.length === 0) {
    throw new Error('No target WhatsApp groups specified.');
  }

  // Prevent duplicate overlapping queues
  if (activeQueues.has(code) && activeQueues.get(code).isRunning) {
    throw new Error('Another message batch is already in progress. Please wait for it to finish.');
  }

  const queueControl = { isRunning: true, isCancelled: false };
  activeQueues.set(code, queueControl);

  const results = {
    total: targetGroups.length,
    successful: 0,
    failed: 0,
    details: [],
  };

  try {
    for (let i = 0; i < targetGroups.length; i++) {
      if (queueControl.isCancelled) {
        break;
      }

      const grp = targetGroups[i];

      // Anti-Ban Presence simulation in group
      try {
        await sock.sendPresenceUpdate('composing', grp.groupJid);
        await new Promise((r) => setTimeout(r, 1200));
        await sock.sendPresenceUpdate('paused', grp.groupJid);
      } catch {}

      try {
        let sendRes;
        if (imageBuffer) {
          sendRes = await sock.sendMessage(grp.groupJid, {
            image: imageBuffer,
            mimetype: imageMime || 'image/jpeg',
            caption: text || '',
          });
        } else {
          sendRes = await sock.sendMessage(grp.groupJid, { text });
        }

        results.successful++;
        results.details.push({
          groupJid: grp.groupJid,
          groupName: grp.groupName,
          status: 'DELIVERED',
          messageId: sendRes?.key?.id,
        });

        if (io) {
          io.to(`school:${code}`).emit('whatsapp_broadcast_progress', {
            schoolCode: code,
            current: i + 1,
            total: targetGroups.length,
            percent: Math.round(((i + 1) / targetGroups.length) * 100),
            groupName: grp.groupName,
            status: 'DELIVERED',
          });
        }
      } catch (err) {
        results.failed++;
        results.details.push({
          groupJid: grp.groupJid,
          groupName: grp.groupName,
          status: 'FAILED',
          reason: err.message,
        });

        if (io) {
          io.to(`school:${code}`).emit('whatsapp_broadcast_progress', {
            schoolCode: code,
            current: i + 1,
            total: targetGroups.length,
            percent: Math.round(((i + 1) / targetGroups.length) * 100),
            groupName: grp.groupName,
            status: 'FAILED',
          });
        }
      }

      // Safe Anti-Ban Jitter Delay: 2,500ms to 4,200ms between each group broadcast
      if (i < targetGroups.length - 1 && !queueControl.isCancelled) {
        const jitter = Math.floor(2500 + Math.random() * 1700);
        await new Promise((r) => setTimeout(r, jitter));
      }
    }
  } finally {
    activeQueues.delete(code);
  }

  return results;
}


