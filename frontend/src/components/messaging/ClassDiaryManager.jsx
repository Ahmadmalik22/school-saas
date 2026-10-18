import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import {
  BookOpen,
  Users,
  Image as ImageIcon,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Link as LinkIcon,
  Copy,
  Check,
  Calendar,
  Layers,
  Sparkles,
  Upload,
  X,
  ExternalLink,
  Search,
  ArrowRight,
} from 'lucide-react';

export default function ClassDiaryManager({ schoolCode }) {
  const { user } = useAuth();
  const { classes } = useAcademicClasses(schoolCode);
  const activeCode = schoolCode || user?.schoolCode || 'SCH-101';

  // Navigation Tabs: 'diary' (Send Diary) | 'groups' (Manage Class Groups)
  const [activeTab, setActiveTab] = useState('diary');

  // Selected Class & Section for Diary
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  // Class Groups Data
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [classGroups, setClassGroups] = useState([]);

  // Diary Mode: 'text' (Written Homework) | 'image' (Photo of Board/Diary)
  const [diaryMode, setDiaryMode] = useState('text');

  // Written Homework State (Subject-wise rows)
  const [subjectRows, setSubjectRows] = useState([
    { subject: 'English', homework: '' },
    { subject: 'Mathematics', homework: '' },
    { subject: 'Urdu', homework: '' },
    { subject: 'Science', homework: '' },
    { subject: 'Islamiat', homework: '' },
  ]);
  const [generalNote, setGeneralNote] = useState('');

  // Image Upload State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageCaption, setImageCaption] = useState('');

  // Sending Diary State
  const [sendingDiary, setSendingDiary] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Group Management Modals
  const [createModalClass, setCreateModalClass] = useState(null);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [linkModalClass, setLinkModalClass] = useState(null);
  const [phoneGroups, setPhoneGroups] = useState([]);
  const [selectedExistingGroupJid, setSelectedExistingGroupJid] = useState('');
  const [linkingGroup, setLinkingGroup] = useState(false);
  const [loadingPhoneGroups, setLoadingPhoneGroups] = useState(false);
  const [phoneGroupsError, setPhoneGroupsError] = useState('');
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [manualInviteLink, setManualInviteLink] = useState('');
  const [linkTab, setLinkTab] = useState('phone'); // 'phone' | 'invite'

  const [syncingClassKey, setSyncingClassKey] = useState(null);
  const [copiedLink, setCopiedLink] = useState('');

  // Available sections for current selected class
  const availableSections = useMemo(() => {
    if (!selectedClass) return [];
    const cls = classes.find((c) => (c.className || c.name) === selectedClass);
    if (!cls || !cls.sections) return [];
    return cls.sections
      .map((sec) => (typeof sec === 'object' ? sec?.name : sec))
      .filter(Boolean);
  }, [classes, selectedClass]);

  // Set initial selected class & section
  useEffect(() => {
    if (classes.length > 0 && !selectedClass) {
      const firstClass = classes[0];
      const cName = firstClass.className || firstClass.name;
      setSelectedClass(cName);

      const firstSec =
        firstClass.sections?.[0] && typeof firstClass.sections[0] === 'object'
          ? firstClass.sections[0].name
          : firstClass.sections?.[0] || 'A';
      setSelectedSection(firstSec);
    }
  }, [classes, selectedClass]);

  // Fetch Class Groups & Link Status
  const fetchClassGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await api.get('/messaging/class-groups', {
        params: { schoolCode: activeCode },
      });
      if (res.data?.success) {
        setClassGroups(res.data.data || []);
      }
    } catch (err) {
      console.warn('Failed to load class groups:', err.message);
    } finally {
      setLoadingGroups(false);
    }
  }, [activeCode]);

  // WhatsApp Gateway Status
  const [waStatus, setWaStatus] = useState({ isConnected: false, phone: '', loading: true });

  const fetchWaStatus = useCallback(async () => {
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

  useEffect(() => {
    fetchClassGroups();
    fetchWaStatus();
  }, [fetchClassGroups, fetchWaStatus]);

  // Find linked group for current selected class & section
  const currentLinkedGroup = useMemo(() => {
    if (!selectedClass || !selectedSection) return null;
    return classGroups.find(
      (g) =>
        g.className.toLowerCase() === selectedClass.toLowerCase() &&
        g.section.toLowerCase() === selectedSection.toLowerCase()
    );
  }, [classGroups, selectedClass, selectedSection]);

  // Format Written Homework into WhatsApp text
  const formattedWhatsAppText = useMemo(() => {
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    let msg = `📅 *DAILY HOMEWORK DIARY*\n`;
    msg += `📚 *Class:* ${selectedClass}-${selectedSection} | *Date:* ${today}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

    const activeRows = subjectRows.filter((r) => r.subject.trim() && r.homework.trim());
    if (activeRows.length === 0) {
      msg += `*(Homework will be updated shortly)*\n`;
    } else {
      activeRows.forEach((row) => {
        msg += `📖 *${row.subject}:* ${row.homework.trim()}\n`;
      });
    }

    if (generalNote.trim()) {
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📌 *Note:* ${generalNote.trim()}\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🏫 *School Administration*`;
    return msg;
  }, [selectedClass, selectedSection, subjectRows, generalNote]);

  // Handle Photo File Selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      alert('Image size exceeds 4MB. Please choose a smaller photo.');
      return;
    }

    setImageFile(file);
    setImageCaption(`Class ${selectedClass}-${selectedSection} Diary - ${new Date().toISOString().split('T')[0]}`);

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Remove Photo
  const handleRemovePhoto = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageCaption('');
  };

  // Send Diary to WhatsApp Group
  const handleSendDiary = async () => {
    if (!currentLinkedGroup?.isLinked) {
      alert(`No WhatsApp group is linked for Class ${selectedClass}-${selectedSection}. Please setup or link a group first.`);
      return;
    }

    if (diaryMode === 'text') {
      const activeRows = subjectRows.filter((r) => r.homework.trim());
      if (activeRows.length === 0 && !generalNote.trim()) {
        alert('Please enter homework for at least one subject before sending.');
        return;
      }
    } else {
      if (!imageFile) {
        alert('Please select or upload a diary picture.');
        return;
      }
    }

    const confirmMsg = `Ready to deliver Daily Diary to WhatsApp Group:\n"${currentLinkedGroup.groupName}"?`;
    if (!window.confirm(confirmMsg)) return;

    setSendingDiary(true);
    setSentSuccess(false);

    try {
      const formData = new FormData();
      formData.append('schoolCode', activeCode);
      formData.append('className', selectedClass);
      formData.append('section', selectedSection);

      if (diaryMode === 'text') {
        formData.append('diaryText', formattedWhatsAppText);
      } else {
        formData.append('diaryImage', imageFile);
        formData.append('diaryText', imageCaption);
      }

      const res = await api.post('/messaging/send-class-diary', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setSentSuccess(true);
        // Refresh last sent date
        fetchClassGroups();
        // Clear inputs
        if (diaryMode === 'image') {
          handleRemovePhoto();
        }
        setTimeout(() => setSentSuccess(false), 5000);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSendingDiary(false);
    }
  };

  // Create Class Group
  const handleCreateGroup = async () => {
    if (!createModalClass) return;
    setCreatingGroup(true);
    try {
      const res = await api.post('/messaging/create-class-group', {
        schoolCode: activeCode,
        className: createModalClass.className,
        section: createModalClass.section,
      });
      if (res.data?.success) {
        alert(res.data.message);
        setCreateModalClass(null);
        fetchClassGroups();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setCreatingGroup(false);
    }
  };

  // Open Link Existing Group Modal
  const openLinkModal = async (cls) => {
    setLinkModalClass(cls);
    setSelectedExistingGroupJid('');
    setGroupSearchTerm('');
    setManualInviteLink('');
    setPhoneGroupsError('');
    setLinkTab('phone');
    setLoadingPhoneGroups(true);
    try {
      const res = await api.get('/messaging/whatsapp-groups-list', {
        params: { schoolCode: activeCode },
      });
      if (res.data?.success) {
        setPhoneGroups(res.data.data || []);
      } else {
        setPhoneGroupsError(res.data?.message || 'Could not fetch groups from WhatsApp phone.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      setPhoneGroupsError(errMsg);
      console.warn('Could not fetch phone groups:', errMsg);
    } finally {
      setLoadingPhoneGroups(false);
    }
  };

  // Filter groups from phone based on user search term
  const filteredPhoneGroups = useMemo(() => {
    if (!groupSearchTerm.trim()) return phoneGroups;
    const term = groupSearchTerm.toLowerCase();
    return phoneGroups.filter((g) => (g.subject || '').toLowerCase().includes(term));
  }, [phoneGroups, groupSearchTerm]);

  // Link Existing Group (from dropdown or manual invite link)
  const handleLinkExistingGroup = async () => {
    if (!linkModalClass) return;

    // Mode 1: Paste WhatsApp Invite Link
    if (linkTab === 'invite') {
      if (!manualInviteLink.trim()) {
        alert('Please paste a WhatsApp group invite link (e.g. https://chat.whatsapp.com/...)');
        return;
      }
      setLinkingGroup(true);
      try {
        const res = await api.post('/messaging/link-class-group', {
          schoolCode: activeCode,
          className: linkModalClass.className,
          section: linkModalClass.section,
          inviteLink: manualInviteLink.trim(),
        });
        if (res.data?.success) {
          alert(res.data.message);
          setLinkModalClass(null);
          fetchClassGroups();
        }
      } catch (err) {
        alert(err.response?.data?.message || err.message);
      } finally {
        setLinkingGroup(false);
      }
      return;
    }

    // Mode 2: Select from phone groups list
    if (!selectedExistingGroupJid) {
      alert('Please select a group from the list.');
      return;
    }

    const grp = phoneGroups.find((g) => g.jid === selectedExistingGroupJid);
    if (!grp) return;

    setLinkingGroup(true);
    try {
      const res = await api.post('/messaging/link-class-group', {
        schoolCode: activeCode,
        className: linkModalClass.className,
        section: linkModalClass.section,
        groupJid: grp.jid,
        groupName: grp.subject,
      });
      if (res.data?.success) {
        alert(res.data.message);
        setLinkModalClass(null);
        fetchClassGroups();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLinkingGroup(false);
    }
  };

  // Sync Group Participants (Add newly admitted students)
  const handleSyncGroup = async (cls) => {
    const key = `${cls.className}:${cls.section}`;
    setSyncingClassKey(key);
    try {
      const res = await api.post('/messaging/sync-class-group-participants', {
        schoolCode: activeCode,
        className: cls.className,
        section: cls.section,
      });
      if (res.data?.success) {
        alert(res.data.message);
        fetchClassGroups();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSyncingClassKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-6 lg:p-8 space-y-6">
      {/* 1. Top Header & Tabs Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center border border-indigo-500/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Daily Class Diary
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 rounded-md">
                Group Dispatcher
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Deliver written homework or photos directly to Class WhatsApp Groups in 1-Click
            </p>
          </div>
        </div>

        {/* WhatsApp Gateway Status & Tabs */}
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

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('diary')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'diary'
                  ? 'bg-white text-indigo-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Send Daily Diary
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'groups'
                  ? 'bg-white text-indigo-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              Class WhatsApp Groups ({classGroups.filter((g) => g.isLinked).length}/{classGroups.length})
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Disconnected Warning Banner */}
      {!waStatus.isConnected && !waStatus.loading && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4 text-amber-900 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">WhatsApp is Disconnected:</span> Please connect your school phone in the{' '}
              <span className="font-black underline">"WhatsApp Connect"</span> tab before sending daily diary.
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

      {/* 2. TAB 1: SEND DAILY DIARY */}
      {activeTab === 'diary' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form & Inputs (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Class & Section Selection Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                1. Select Target Class
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Class */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Class:</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      const cls = classes.find((c) => (c.className || c.name) === e.target.value);
                      const s = cls?.sections?.[0];
                      setSelectedSection(typeof s === 'object' ? s?.name : s || 'A');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {classes.map((cls, idx) => {
                      const cName = typeof cls === 'string' ? cls : cls.className || cls.name || `Class ${idx + 1}`;
                      return (
                        <option key={cls._id || cName || idx} value={cName}>
                          {cName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Section */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Section:</label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {availableSections.length === 0 ? (
                      <option value="A">Section A</option>
                    ) : (
                      availableSections.map((secName, idx) => (
                        <option key={secName || idx} value={secName}>
                          Section {secName}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Linked WhatsApp Group Status Card */}
              {currentLinkedGroup?.isLinked ? (
                <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-950">
                        Linked: {currentLinkedGroup.groupName}
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        {currentLinkedGroup.totalParticipants || currentLinkedGroup.studentCount} Parents in Group
                        {currentLinkedGroup.lastDiarySentAt && (
                          <span> • Last sent: {new Date(currentLinkedGroup.lastDiarySentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {currentLinkedGroup.inviteLink && (
                    <a
                      href={currentLinkedGroup.inviteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs hover:bg-emerald-100"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Group
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-950">
                        No WhatsApp Group Linked for Class {selectedClass}-{selectedSection}
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Create or link a group first to send diary
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('groups')}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-sm"
                  >
                    Setup Group
                  </button>
                </div>
              )}
            </div>

            {/* Diary Content Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  2. Diary Format
                </h3>

                {/* Mode Selector */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <button
                    onClick={() => setDiaryMode('text')}
                    className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      diaryMode === 'text'
                        ? 'bg-white text-indigo-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>✍️</span> Written Homework
                  </button>
                  <button
                    onClick={() => setDiaryMode('image')}
                    className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      diaryMode === 'image'
                        ? 'bg-white text-indigo-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Photo / Picture
                  </button>
                </div>
              </div>

              {/* Mode A: Written Homework */}
              {diaryMode === 'text' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">
                    Enter homework for each subject. Blank subjects will be omitted automatically.
                  </p>

                  <div className="space-y-2.5">
                    {subjectRows.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Subject"
                          value={row.subject}
                          onChange={(e) => {
                            const next = [...subjectRows];
                            next[idx].subject = e.target.value;
                            setSubjectRows(next);
                          }}
                          className="w-32 sm:w-36 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder={`Enter homework for ${row.subject || 'this subject'}...`}
                          value={row.homework}
                          onChange={(e) => {
                            const next = [...subjectRows];
                            next[idx].homework = e.target.value;
                            setSubjectRows(next);
                          }}
                          className="flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => {
                            setSubjectRows(subjectRows.filter((_, i) => i !== idx));
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Remove Row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Subject Row */}
                  <button
                    onClick={() => setSubjectRows([...subjectRows, { subject: '', homework: '' }])}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Another Subject
                  </button>

                  {/* General Note Input */}
                  <div className="pt-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      General Note / Notice (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bring color pencils tomorrow / PT meeting on Saturday"
                      value={generalNote}
                      onChange={(e) => setGeneralNote(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Mode B: Picture / Board Photo */}
              {diaryMode === 'image' && (
                <div className="space-y-4">
                  <p className="text-[11px] text-slate-500">
                    Upload a clear photo of the classroom blackboard, whiteboard, or student diary notebook.
                  </p>

                  {imagePreview ? (
                    <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 max-h-80 flex items-center justify-center">
                      <img
                        src={imagePreview}
                        alt="Diary Preview"
                        className="max-h-80 w-auto object-contain"
                      />
                      <button
                        onClick={handleRemovePhoto}
                        className="absolute top-3 right-3 p-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl shadow-lg cursor-pointer transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/50 hover:bg-indigo-50/30">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">Click to upload diary photo</p>
                      <p className="text-[11px] text-slate-400">PNG, JPG, JPEG up to 4MB</p>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  )}

                  {/* Image Caption */}
                  {imageFile && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Photo Caption (Optional):
                      </label>
                      <input
                        type="text"
                        value={imageCaption}
                        onChange={(e) => setImageCaption(e.target.value)}
                        placeholder="Caption to accompany image..."
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Success Notification */}
              {sentSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Daily diary delivered successfully to Class {selectedClass}-{selectedSection} WhatsApp group!
                </div>
              )}

              {/* Send Button */}
              <button
                onClick={handleSendDiary}
                disabled={sendingDiary || !currentLinkedGroup?.isLinked}
                className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm ${
                  sendingDiary || !currentLinkedGroup?.isLinked
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/20'
                }`}
              >
                {sendingDiary ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Delivering to WhatsApp Group...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Diary to Class {selectedClass}-{selectedSection} Group
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Live WhatsApp Bubble Preview (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm sticky top-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Live WhatsApp Message Preview
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {currentLinkedGroup?.groupName || `Class ${selectedClass}-${selectedSection}`}
                </span>
              </div>

              {/* WhatsApp Simulated Phone Screen */}
              <div className="bg-[#efeae2] p-4 rounded-2xl shadow-inner border border-slate-300 min-h-[380px] flex flex-col justify-end">
                <div className="bg-[#d9fdd3] text-slate-800 p-3.5 rounded-xl rounded-tr-none text-xs font-medium shadow-sm space-y-2">
                  {/* Photo Preview inside Chat bubble */}
                  {diaryMode === 'image' && imagePreview && (
                    <div className="rounded-lg overflow-hidden border border-slate-300/50 mb-2">
                      <img src={imagePreview} alt="Diary" className="w-full h-auto object-cover" />
                    </div>
                  )}

                  {/* Text preview */}
                  <div className="whitespace-pre-wrap leading-relaxed font-sans">
                    {diaryMode === 'text' ? formattedWhatsAppText : imageCaption || 'Daily Class Diary'}
                  </div>

                  <div className="text-[10px] text-slate-500 text-right flex items-center justify-end gap-1 pt-1">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                💡 <b>Zero Storage:</b> Images are delivered to WhatsApp instantly and flushed from server memory. No database space is used!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB 2: CLASS WHATSAPP GROUPS MANAGEMENT */}
      {activeTab === 'groups' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Class WhatsApp Groups Setup</h2>
              <p className="text-xs text-slate-500">
                Create new groups or link existing groups for each class & section
              </p>
            </div>
            <button
              onClick={fetchClassGroups}
              disabled={loadingGroups}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 self-start cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingGroups ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Groups Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4">Enrolled Students</th>
                  <th className="py-3 px-4">Linked WhatsApp Group</th>
                  <th className="py-3 px-4">Participants</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingGroups ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading class groups...
                    </td>
                  </tr>
                ) : classGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No classes configured yet. Please add classes in Classes Setup.
                    </td>
                  </tr>
                ) : (
                  classGroups.map((cls) => {
                    const syncKey = `${cls.className}:${cls.section}`;
                    const isSyncing = syncingClassKey === syncKey;
                    return (
                      <tr key={syncKey} className="hover:bg-slate-50/70 transition-colors">
                        {/* Class & Section */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {cls.className} - {cls.section}
                        </td>

                        {/* Student Count */}
                        <td className="py-3.5 px-4 font-medium text-slate-600">
                          {cls.studentCount} Students
                        </td>

                        {/* Linked Group Name */}
                        <td className="py-3.5 px-4">
                          {cls.isLinked ? (
                            <div>
                              <p className="font-bold text-emerald-900">{cls.groupName}</p>
                              {cls.inviteLink && (
                                <a
                                  href={cls.inviteLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  {cls.inviteLink}
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No group linked</span>
                          )}
                        </td>

                        {/* Participants */}
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                          {cls.isLinked ? `${cls.totalParticipants || cls.studentCount} in group` : '—'}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          {cls.isLinked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Linked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                              <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                              Not Linked
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {cls.isLinked ? (
                              <>
                                {/* Sync Students */}
                                <button
                                  onClick={() => handleSyncGroup(cls)}
                                  disabled={isSyncing}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Add new students to group"
                                >
                                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                  {isSyncing ? 'Syncing...' : 'Sync Students'}
                                </button>

                                {/* Copy Invite Link */}
                                {cls.inviteLink && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(cls.inviteLink);
                                      setCopiedLink(cls.inviteLink);
                                      setTimeout(() => setCopiedLink(''), 2000);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                    title="Copy Group Invite Link"
                                  >
                                    {copiedLink === cls.inviteLink ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}

                                {/* Change Link */}
                                <button
                                  onClick={() => openLinkModal(cls)}
                                  className="px-2 py-1 text-slate-500 hover:text-indigo-600 text-[11px] font-bold hover:underline cursor-pointer"
                                >
                                  Change
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Create Group Button */}
                                <button
                                  onClick={() => setCreateModalClass(cls)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                                >
                                  <Plus className="w-3 h-3" />
                                  Create Group
                                </button>

                                {/* Link Existing Group */}
                                <button
                                  onClick={() => openLinkModal(cls)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <LinkIcon className="w-3 h-3" />
                                  Link Existing
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. MODAL: CREATE CLASS GROUP */}
      {createModalClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-scale-up space-y-5">
            <button
              onClick={() => setCreateModalClass(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Create Class WhatsApp Group</h3>
              <p className="text-xs text-slate-500">
                For {createModalClass.className} - {createModalClass.section} ({createModalClass.studentCount} Students)
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-2">
              <p className="font-bold text-slate-800">What will happen automatically:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                <li>A new WhatsApp group will be created from your school phone.</li>
                <li>All {createModalClass.studentCount} student parents will be added to the group.</li>
                <li>Group settings will be locked to <b>"Admins Only Can Send Messages"</b> so parents cannot send spam.</li>
                <li>An official invite link will be generated automatically.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setCreateModalClass(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creatingGroup}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center gap-2"
              >
                {creatingGroup ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Creating on WhatsApp...
                  </>
                ) : (
                  'Create Group Now'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: LINK EXISTING GROUP */}
      {linkModalClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-scale-up space-y-4">
            <button
              onClick={() => setLinkModalClass(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {linkModalClass.className} - {linkModalClass.section}
                </span>
                <span className="text-xs text-slate-400 font-medium">• WhatsApp Group Setup</span>
              </div>
              <h3 className="text-base font-black text-slate-900">Link WhatsApp Group</h3>
              <p className="text-xs text-slate-500">
                Class ki diary direct deliver karne ke liye WhatsApp group select ya link karein.
              </p>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setLinkTab('phone')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  linkTab === 'phone'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>School Phone Groups</span>
              </button>
              <button
                type="button"
                onClick={() => setLinkTab('invite')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  linkTab === 'invite'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Paste Invite Link</span>
              </button>
            </div>

            {/* TAB 1: Select from School Phone Groups */}
            {linkTab === 'phone' && (
              <div className="space-y-3 pt-1">
                {/* 1. Loading State */}
                {loadingPhoneGroups && (
                  <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                    <p className="text-xs font-bold text-slate-700">Connecting to School WhatsApp...</p>
                    <p className="text-[11px] text-slate-500">
                      Aapke connected phone se active WhatsApp groups load ho rahe hain.
                    </p>
                  </div>
                )}

                {/* 2. Error / Disconnected State */}
                {!loadingPhoneGroups && phoneGroupsError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2.5">
                    <div className="flex items-start gap-2.5 text-rose-700">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-bold">Groups Load Nahi Ho Saky</p>
                        <p className="text-[11px] text-rose-600 mt-0.5 leading-relaxed">
                          {phoneGroupsError.toLowerCase().includes('not connected')
                            ? 'Aapka WhatsApp abhi connect nahi hai. Pehly "WhatsApp Connect" menu me ja kar QR code scan karein.'
                            : phoneGroupsError}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-rose-200/60">
                      <button
                        type="button"
                        onClick={() => openLinkModal(linkModalClass)}
                        className="text-xs font-bold text-rose-700 hover:text-rose-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Dobaara Check Karein
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = linkModalClass;
                          setLinkModalClass(null);
                          setCreateModalClass(target);
                        }}
                        className="text-xs font-black text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Auto-Create Naya Group
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Empty State: No Groups Found on Connected Phone */}
                {!loadingPhoneGroups && !phoneGroupsError && phoneGroups.length === 0 && (
                  <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xs font-black text-amber-900">Koi Existing Group Nahi Mila</h4>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                          Aapke connected WhatsApp par is class ka koi group nahi mila. Aap abhi 1-click me naya group bana saktay hain!
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-200/60 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          const target = linkModalClass;
                          setLinkModalClass(null);
                          setCreateModalClass(target);
                        }}
                        className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-95"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-200" />
                        <span>🚀 Auto-Create WhatsApp Group Now</span>
                      </button>
                      <p className="text-[10px] text-center text-slate-500">
                        Software khud class ke tamam bacho ke parents ko add kar ke group bana de ga.
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. Groups Found: Search & Dropdown Selection */}
                {!loadingPhoneGroups && !phoneGroupsError && phoneGroups.length > 0 && (
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Select Group from Connected WhatsApp ({phoneGroups.length} available):
                    </label>

                    {/* Search filter input */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={groupSearchTerm}
                        onChange={(e) => setGroupSearchTerm(e.target.value)}
                        placeholder="Search group by name..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>

                    {filteredPhoneGroups.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                        <p className="text-xs text-slate-500">
                          "{groupSearchTerm}" naam ka koi group nahi mila.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const target = linkModalClass;
                            setLinkModalClass(null);
                            setCreateModalClass(target);
                          }}
                          className="text-xs font-black text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Naya Group Auto-Create Karein
                        </button>
                      </div>
                    ) : (
                      <select
                        value={selectedExistingGroupJid}
                        onChange={(e) => setSelectedExistingGroupJid(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Choose a group ({filteredPhoneGroups.length}) --</option>
                        {filteredPhoneGroups.map((g) => (
                          <option key={g.jid} value={g.jid}>
                            {g.subject} ({g.size} members)
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Helpful footer switch if not found */}
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-600">
                        Class ka group nahi mila?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const target = linkModalClass;
                          setLinkModalClass(null);
                          setCreateModalClass(target);
                        }}
                        className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" /> Auto-Create Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Paste WhatsApp Invite Link */}
            {linkTab === 'invite' && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    WhatsApp Group Invite Link:
                  </label>
                  <input
                    type="url"
                    value={manualInviteLink}
                    onChange={(e) => setManualInviteLink(e.target.value)}
                    placeholder="https://chat.whatsapp.com/Abc123XyZ..."
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Agar group kisi doosray phone se bana hua hai ya list me show nahi ho raha, to group ka invite link paste karein. Software group automatically link kar le ga.
                  </p>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLinkModalClass(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkExistingGroup}
                disabled={
                  linkingGroup ||
                  (linkTab === 'phone' && !selectedExistingGroupJid) ||
                  (linkTab === 'invite' && !manualInviteLink.trim())
                }
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {linkingGroup ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Linking...
                  </>
                ) : (
                  'Link Group'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
