import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  Megaphone,
  Users,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Upload,
  X,
  FileText,
  Check,
  Calendar,
} from 'lucide-react';
import { io as socketIOClient } from 'socket.io-client';

// Pre-set School Notice Templates
const NOTICE_TEMPLATES = [
  {
    id: 'holidays',
    name: '🏖️ Vacation / Holidays Notice',
    text: `📢 *OFFICIAL NOTICE: SCHOOL VACATIONS*
Dear Parents & Guardians,

Please be informed that the school will remain closed for vacations starting from *[Start Date]* to *[End Date]*.

Classes will resume regularly Insha'Allah on *[Reopening Date]* with normal school timings.

All students are instructed to complete their holiday assignments.

Regards,
*Administration*`,
  },
  {
    id: 'eid',
    name: '🌙 Eid Holidays Notice',
    text: `🌙 *EID MUBARAK & HOLIDAY ANNOUNCEMENT*
Dear Parents & Students,

Heartiest Eid Mubarak to all our students and their families! 

The school will observe Eid holidays from *[Start Date]* to *[End Date]*. Regular academic classes will resume on *[Opening Date]*.

Wishing you and your loved ones joyous Eid celebrations!

Warm Regards,
*School Management*`,
  },
  {
    id: 'exams',
    name: '📝 Examination Schedule & Datesheet',
    text: `📝 *IMPORTANT: EXAMINATION SCHEDULE NOTICE*
Dear Parents,

This is to notify that the upcoming *[Mid-Term / Final Examination]* will commence from *[Exam Start Date]*.

• Examination Timings: *[e.g. 08:30 AM to 11:30 AM]*
• Detailed datesheets have been distributed to all students.
• Punctuality and complete uniform with student ID cards are mandatory.

We wish our students the very best of preparation and success!

Regards,
*Examination Department*`,
  },
  {
    id: 'fee_reminder',
    name: '💰 Monthly Fee Payment Reminder',
    text: `💰 *MONTHLY TUITION FEE REMINDER*
Dear Respected Parents,

This is a gentle reminder that the tuition fee for the month of *[Month Name]* is due. 

• *Due Date:* [e.g. 10th of this month]
• Please ensure timely submission to avoid any late surcharge.

If fee has already been deposited, kindly disregard this notice. Thank you for your continued cooperation!

Regards,
*Accounts Department*`,
  },
  {
    id: 'rain_emergency',
    name: '🌧️ Weather / Emergency Closure Alert',
    text: `🌧️ *WEATHER ALERT: SCHOOL CLOSED TODAY*
Dear Parents,

Due to inclement weather conditions and heavy rainfall, the school will remain closed today, *[Date]*, for the safety of our students.

Tomorrow's schedule will be communicated according to weather updates.

Stay safe and take care.

Regards,
*Principal Office*`,
  },
  {
    id: 'sports_ptm',
    name: '📋 Parent-Teacher Meeting (PTM) Notice',
    text: `📋 *PARENT-TEACHER MEETING (PTM) INVITATION*
Dear Respected Parents,

You are cordially invited to attend the Parent-Teacher Meeting scheduled on *[Date]* from *[Time e.g. 09:00 AM to 12:30 PM]*.

This meeting is crucial to discuss your child's academic progress, attendance, and classroom performance.

Your presence and valuable feedback are highly appreciated.

Regards,
*School Administration*`,
  },
  {
    id: 'timings_change',
    name: '⏰ School Timings Change Notice',
    text: `⏰ *NOTICE: REVISED SCHOOL TIMINGS*
Dear Parents & Guardians,

Please note that effective from *[Effective Date]*, the revised school timings will be as follows:

• *Monday to Thursday:* 08:00 AM to 01:30 PM
• *Friday:* 08:00 AM to 12:00 PM

Kindly ensure timely drop-off and pick-up of your children.

Regards,
*School Administration*`,
  },
];

export default function BroadcastAnnouncements({ schoolCode }) {
  const { user } = useAuth();
  const activeCode = schoolCode || user?.schoolCode || 'SCH-101';

  // Target Groups State
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [classGroups, setClassGroups] = useState([]);
  const [targetMode, setTargetMode] = useState('all'); // 'all' | 'custom'
  const [selectedGroupJids, setSelectedGroupJids] = useState([]);

  // Announcement Mode: 'text' (Written Notice) | 'image' (Circular Photo/Banner)
  const [noticeMode, setNoticeMode] = useState('text');

  // Written Notice Content
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [noticeText, setNoticeText] = useState('');

  // Circular Image Content
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageCaption, setImageCaption] = useState('');

  // WhatsApp Connection Status
  const [waStatus, setWaStatus] = useState({ isConnected: false, phone: '', loading: true });

  // Broadcasting State & Progress
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(null); // { current, total, percent, groupName, status }
  const [broadcastResult, setBroadcastResult] = useState(null);

  // Fetch WhatsApp Session Status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/messaging/whatsapp-status', {
        params: { schoolCode: activeCode },
      });
      if (res.data?.success) {
        const d = res.data.data || {};
        setWaStatus({
          isConnected: Boolean(d.isConnected),
          phone: d.phoneNumber || '',
          loading: false,
        });
      }
    } catch {
      setWaStatus((prev) => ({ ...prev, loading: false }));
    }
  }, [activeCode]);

  // Fetch Linked Class WhatsApp Groups
  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await api.get('/messaging/class-groups', {
        params: { schoolCode: activeCode },
      });
      if (res.data?.success) {
        const groups = res.data.data || [];
        setClassGroups(groups);

        // Auto-select all linked groups by default
        const linkedJids = groups.filter((g) => g.isLinked && g.groupJid).map((g) => g.groupJid);
        setSelectedGroupJids(linkedJids);
      }
    } catch (err) {
      console.warn('Failed to fetch class groups:', err.message);
    } finally {
      setLoadingGroups(false);
    }
  }, [activeCode]);

  useEffect(() => {
    fetchStatus();
    fetchGroups();
  }, [fetchStatus, fetchGroups]);

  // Socket.io Real-Time Progress Listener
  useEffect(() => {
    const socket = socketIOClient(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_school', activeCode);
    });

    socket.on('whatsapp_broadcast_progress', (data) => {
      if (data.schoolCode === activeCode) {
        setBroadcastProgress(data);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeCode]);

  // Filter linked groups only
  const linkedGroups = useMemo(() => {
    return classGroups.filter((g) => g.isLinked && g.groupJid);
  }, [classGroups]);

  // Calculate Active Target Groups
  const effectiveTargetGroups = useMemo(() => {
    if (targetMode === 'all') {
      return linkedGroups;
    }
    return linkedGroups.filter((g) => selectedGroupJids.includes(g.groupJid));
  }, [targetMode, linkedGroups, selectedGroupJids]);

  // Estimate total parents reached
  const estimatedParents = useMemo(() => {
    return effectiveTargetGroups.reduce((sum, g) => sum + (g.totalParticipants || 0), 0);
  }, [effectiveTargetGroups]);

  // Handle Template Select
  const handleTemplateChange = (tmplId) => {
    setSelectedTemplateId(tmplId);
    const tmpl = NOTICE_TEMPLATES.find((t) => t.id === tmplId);
    if (tmpl) {
      setNoticeText(tmpl.text);
    }
  };

  // Image Upload Handlers
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert('Image size exceeds 4MB. Please select a smaller photo to ensure smooth delivery.');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Toggle individual class group selection
  const toggleGroupSelection = (jid) => {
    setSelectedGroupJids((prev) =>
      prev.includes(jid) ? prev.filter((id) => id !== jid) : [...prev, jid]
    );
  };

  const handleSelectAll = () => {
    setSelectedGroupJids(linkedGroups.map((g) => g.groupJid));
  };

  const handleClearAll = () => {
    setSelectedGroupJids([]);
  };

  // Cancel Bulk Queue
  const handleCancelBroadcast = async () => {
    if (!window.confirm('Are you sure you want to pause/cancel remaining group deliveries?')) return;
    try {
      await api.post('/messaging/cancel-bulk-queue', { schoolCode: activeCode });
      setBroadcasting(false);
      setBroadcastProgress(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Dispatch Broadcast Announcement
  const handleBroadcastAnnouncement = async () => {
    if (!waStatus.isConnected) {
      alert('School WhatsApp is not connected. Please connect your phone first.');
      return;
    }

    if (effectiveTargetGroups.length === 0) {
      alert('No WhatsApp groups selected. Please select at least one class group.');
      return;
    }

    if (noticeMode === 'text') {
      if (!noticeText.trim()) {
        alert('Please enter announcement text or select a template.');
        return;
      }
    } else {
      if (!imageFile) {
        alert('Please select or upload a circular image/photo.');
        return;
      }
    }

    const confirmMsg = `Ready to broadcast this announcement to ${effectiveTargetGroups.length} class WhatsApp groups (estimated reach: ${estimatedParents} parents)?`;
    if (!window.confirm(confirmMsg)) return;

    setBroadcasting(true);
    setBroadcastProgress({
      current: 0,
      total: effectiveTargetGroups.length,
      percent: 0,
      groupName: 'Initiating safe delivery...',
      status: 'QUEUED',
    });
    setBroadcastResult(null);

    try {
      const formData = new FormData();
      formData.append('schoolCode', activeCode);
      formData.append(
        'targetGroupJids',
        JSON.stringify(effectiveTargetGroups.map((g) => g.groupJid))
      );

      if (noticeMode === 'text') {
        formData.append('noticeText', noticeText);
      } else {
        formData.append('noticeImage', imageFile);
        formData.append('noticeText', imageCaption);
      }

      const res = await api.post('/messaging/broadcast-announcement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setBroadcastResult(res.data.data);
        if (noticeMode === 'image') {
          handleRemoveImage();
          setImageCaption('');
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-6 lg:p-8 space-y-6 select-none">
      {/* 1. Header Card (Matching Daily Class Diary & Absent Alerts theme) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center border border-indigo-500/20">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Broadcast Announcements
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 rounded-md">
                Group Dispatcher
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Deliver official notices, datesheets, fee circulars, or weather alerts directly to Class WhatsApp Groups
            </p>
          </div>
        </div>

        {/* WhatsApp Gateway Status & Quick Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          {waStatus.isConnected ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/70 px-3.5 py-1.5 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-left">
                <p className="text-[11px] font-bold text-emerald-900 leading-none">
                  WhatsApp Linked
                </p>
                <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                  +{waStatus.phone || 'Connected'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/70 px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-bold text-amber-800">WhatsApp Offline</span>
            </div>
          )}

          <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-1">
              Linked Groups
            </span>
            <span className="text-xs font-black text-slate-800">{linkedGroups.length}</span>
          </div>

          <div className="px-3.5 py-1.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-indigo-500 block leading-none mb-1">
              Est. Parents
            </span>
            <span className="text-xs font-black text-indigo-700">≈ {estimatedParents}</span>
          </div>
        </div>
      </div>

      {/* 2. WhatsApp Disconnected Warning Banner */}
      {!waStatus.isConnected && !waStatus.loading && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4 text-amber-900 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">WhatsApp is Disconnected:</span> Please connect your school phone in the{' '}
              <span className="font-black underline">"WhatsApp Connect"</span> tab before broadcasting announcements.
            </div>
          </div>
          <button
            onClick={() => window.location.assign('/messaging/absent-alerts')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition cursor-pointer shrink-0 text-xs"
          >
            Go to WhatsApp Connect
          </button>
        </div>
      )}

      {/* 3. Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Target Selector & Content Composer (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Target Audience Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center border border-indigo-500/20">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    1. Select Target Class Groups
                  </h3>
                  <p className="text-xs text-slate-700 font-bold">Choose which class groups will receive this notice</p>
                </div>
              </div>

              {/* Target Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setTargetMode('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    targetMode === 'all'
                      ? 'bg-white text-indigo-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Classes ({linkedGroups.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('custom')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    targetMode === 'custom'
                      ? 'bg-white text-indigo-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Custom Selection
                </button>
              </div>
            </div>

            {/* Custom Mode Class Checkboxes */}
            {targetMode === 'custom' && (
              <div className="pt-2 border-t border-slate-100 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    {selectedGroupJids.length} of {linkedGroups.length} groups selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {linkedGroups.map((g) => {
                    const isSelected = selectedGroupJids.includes(g.groupJid);
                    return (
                      <div
                        key={g.groupJid}
                        onClick={() => toggleGroupSelection(g.groupJid)}
                        className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="truncate pr-1">
                          {g.className} - {g.section}
                        </div>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Announcement Content Composer */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center border border-indigo-500/20">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    2. Compose School Announcement
                  </h3>
                  <p className="text-xs text-slate-700 font-bold">Written notice or circular image dispatch</p>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setNoticeMode('text')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    noticeMode === 'text'
                      ? 'bg-white text-indigo-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Written Notice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNoticeMode('image')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    noticeMode === 'image'
                      ? 'bg-white text-indigo-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Circular Photo</span>
                </button>
              </div>
            </div>

            {/* MODE 1: Written Notice */}
            {noticeMode === 'text' && (
              <div className="space-y-4 animate-fade-in pt-1">
                {/* Notice Template Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    ⚡ Fast Fill from Pre-Set Notice Templates:
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Choose a pre-set template or write custom --</option>
                    {NOTICE_TEMPLATES.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Text Area */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Announcement Text Body:</label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {noticeText.length} characters
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={noticeText}
                    onChange={(e) => setNoticeText(e.target.value)}
                    placeholder="Type official school announcement here... Use *bold* for emphasis."
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 leading-relaxed font-mono"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>💡 Tip: Wrap words in *asterisks* to make them *bold* on WhatsApp.</span>
                    {noticeText && (
                      <button
                        type="button"
                        onClick={() => setNoticeText('')}
                        className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                      >
                        Clear Text
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MODE 2: Circular Image Upload */}
            {noticeMode === 'image' && (
              <div className="space-y-4 animate-fade-in pt-1">
                {!imagePreview ? (
                  <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition bg-slate-50/50 hover:bg-indigo-50/20">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        Upload Stamped Circular Photo or Event Poster
                      </p>
                      <p className="text-[11px] text-slate-400">
                        PNG, JPG, or WebP up to 4MB (Processed in-memory, Zero DB bloat)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center max-h-72">
                      <img
                        src={imagePreview}
                        alt="Circular Preview"
                        className="object-contain max-h-72 w-full"
                      />
                      <button
                        onClick={handleRemoveImage}
                        className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-rose-600 text-white rounded-xl backdrop-blur-sm transition cursor-pointer shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Optional Image Caption:
                      </label>
                      <input
                        type="text"
                        value={imageCaption}
                        onChange={(e) => setImageCaption(e.target.value)}
                        placeholder="e.g. Please find attached the official circular regarding..."
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live WhatsApp Bubble Preview & Broadcast Dispatch (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Preview Bubble */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                3. Live WhatsApp Chat Preview
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Exact look on parents' smartphones when delivered to class groups.
            </p>

            {/* WhatsApp Chat Simulation Container */}
            <div className="bg-[#EFEAE2] p-4 rounded-xl border border-slate-200/80 relative shadow-inner min-h-[280px] flex flex-col justify-end">
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-emerald-100 max-w-[95%] space-y-2">
                {/* Image if uploaded */}
                {noticeMode === 'image' && imagePreview && (
                  <div className="rounded-xl overflow-hidden max-h-48 bg-slate-100 border border-slate-200">
                    <img
                      src={imagePreview}
                      alt="WhatsApp Notice"
                      className="w-full h-auto object-cover"
                    />
                  </div>
                )}

                {/* Text Body */}
                <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                  {noticeMode === 'text'
                    ? noticeText || 'Type your message or choose a template to preview live here...'
                    : imageCaption || 'Circular image announcement'}
                </div>

                {/* Timestamp & Double Checkmarks */}
                <div className="flex items-center justify-end gap-1 pt-1 text-[10px] text-slate-400">
                  <span>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-emerald-500 font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Dispatch Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                4. Safe Multi-Group Broadcast
              </h4>
              <p className="text-xs text-slate-600 font-bold mt-0.5">
                Delivers with safe 2.5-4s human jitter delay between groups to prevent WhatsApp spam bans.
              </p>
            </div>

            {/* Broadcast Button */}
            <button
              onClick={handleBroadcastAnnouncement}
              disabled={
                broadcasting ||
                !waStatus.isConnected ||
                effectiveTargetGroups.length === 0 ||
                (noticeMode === 'text' && !noticeText.trim()) ||
                (noticeMode === 'image' && !imageFile)
              }
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {broadcasting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Broadcasting to Groups...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-white" />
                  <span>🚀 Broadcast to {effectiveTargetGroups.length} Class Groups</span>
                </>
              )}
            </button>

            {/* Active Delivery Progress Bar */}
            {broadcasting && broadcastProgress && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 animate-scale-up">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>
                    Delivering: {broadcastProgress.current} of {broadcastProgress.total} Groups
                  </span>
                  <span className="text-indigo-600">{broadcastProgress.percent}%</span>
                </div>

                {/* Progress Track */}
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${broadcastProgress.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span className="truncate max-w-[200px]">
                    Current: <strong>{broadcastProgress.groupName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelBroadcast}
                    className="text-rose-600 font-bold hover:underline cursor-pointer"
                  >
                    Cancel Remaining
                  </button>
                </div>
              </div>
            )}

            {/* Completed Result Card */}
            {broadcastResult && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 animate-scale-up">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Broadcast Delivered Successfully!</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Delivered to <strong>{broadcastResult.successful}</strong> of{' '}
                  <strong>{broadcastResult.total}</strong> class WhatsApp groups safely.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
