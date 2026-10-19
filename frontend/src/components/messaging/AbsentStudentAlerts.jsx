import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import {
  MessageSquare,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  ExternalLink,
  RefreshCw,
  Sliders,
  Play,
  Square,
  Search,
  CheckSquare,
  Square as UncheckedSquare,
  X,
  Copy,
  Check,
  ShieldCheck,
  Info,
  Calendar,
  Layers,
  ChevronDown,
} from 'lucide-react';

export default function AbsentStudentAlerts({ schoolCode }) {
  const { user, socket } = useAuth();
  const { classes } = useAcademicClasses(schoolCode);

  // Filters
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Data States
  const [loading, setLoading] = useState(false);
  const [absentData, setAbsentData] = useState({
    totalAbsent: 0,
    alreadySentCount: 0,
    pendingCount: 0,
    schoolName: '',
    students: [],
  });

  // Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  // WhatsApp Gateway State
  const [gatewayStatus, setGatewayStatus] = useState({
    isConnected: false,
    phoneNumber: '',
    pushName: '',
    qrCode: null,
  });
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [connectingGateway, setConnectingGateway] = useState(false);
  const [disconnectingGateway, setDisconnectingGateway] = useState(false);

  // Dispatch Queue State
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState(null);

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState({
    absentUrdu: '',
    absentEnglish: '',
  });
  const [activeTemplateTab, setActiveTemplateTab] = useState('urdu');
  const [savingTemplates, setSavingTemplates] = useState(false);

  // Preview Message Modal
  const [previewStudent, setPreviewStudent] = useState(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  // Resolve active schoolCode
  const activeCode = schoolCode || user?.schoolCode || 'SCH-101';

  // Available sections for current selected class (safely maps to string names)
  const availableSections = useMemo(() => {
    if (selectedClass === 'ALL') return [];
    const cls = classes.find((c) => (c.className || c.name) === selectedClass);
    if (!cls || !cls.sections) return [];
    return cls.sections
      .map((sec) => (typeof sec === 'object' ? sec?.name : sec))
      .filter(Boolean);
  }, [classes, selectedClass]);

  // Fetch WhatsApp Gateway Status
  const fetchGatewayStatus = useCallback(async () => {
    try {
      const res = await api.get('/messaging/whatsapp-status', {
        params: { schoolCode: activeCode },
      });
      if (res.data?.success) {
        setGatewayStatus(res.data.data);
        if (res.data.data.customTemplates) {
          setTemplates(res.data.data.customTemplates);
        }
      }
    } catch (err) {
      console.warn('Could not fetch WhatsApp gateway status:', err.message);
    }
  }, [activeCode]);

  // Fetch Absent Students List
  const fetchAbsentStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { dateString: selectedDate, schoolCode: activeCode };
      if (selectedClass !== 'ALL') params.className = selectedClass;
      if (selectedSection !== 'ALL') params.section = selectedSection;

      const res = await api.get('/messaging/absent-students', { params });
      if (res.data?.success) {
        setAbsentData(res.data.data);
        if (res.data.data.customTemplates) {
          setTemplates(res.data.data.customTemplates);
        }
        // Auto-select pending students who have a valid phone number
        const autoSelected = new Set();
        (res.data.data.students || []).forEach((st) => {
          if (!st.alreadySent && st.phone && !st.noWhatsApp) {
            autoSelected.add(String(st.studentId));
          }
        });
        setSelectedStudentIds(autoSelected);
      }
    } catch (err) {
      console.error('Failed to load absent students:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedClass, selectedSection, activeCode]);

  // Initial Load
  useEffect(() => {
    fetchGatewayStatus();
    fetchAbsentStudents();
  }, [fetchGatewayStatus, fetchAbsentStudents]);

  // Real-time Socket.io Listener for WhatsApp QR, Status & Dispatch Progress
  useEffect(() => {
    if (!socket) return;

    const handleQr = (data) => {
      if (data?.qr) {
        setGatewayStatus((prev) => ({ ...prev, qrCode: data.qr }));
        setIsQrModalOpen(true);
      }
    };

    const handleConnected = (data) => {
      setGatewayStatus({
        isConnected: true,
        phoneNumber: data.phoneNumber || '',
        pushName: data.pushName || '',
        qrCode: null,
      });
      setIsQrModalOpen(false);
      setConnectingGateway(false);
    };

    const handleDisconnected = () => {
      setGatewayStatus({
        isConnected: false,
        phoneNumber: '',
        pushName: '',
        qrCode: null,
      });
      setIsQrModalOpen(false);
    };

    const handleProgress = (data) => {
      setIsDispatching(true);
      setDispatchProgress(data);

      if (data.current >= data.total) {
        setTimeout(() => {
          setIsDispatching(false);
          setDispatchProgress(null);
          fetchAbsentStudents();
        }, 3000);
      }
    };

    socket.on('whatsapp_qr', handleQr);
    socket.on('whatsapp_connected', handleConnected);
    socket.on('whatsapp_disconnected', handleDisconnected);
    socket.on('whatsapp_dispatch_progress', handleProgress);

    // Join active school room to ensure events are received
    if (activeCode) {
      socket.emit('join_school', activeCode);
    }

    return () => {
      socket.off('whatsapp_qr', handleQr);
      socket.off('whatsapp_connected', handleConnected);
      socket.off('whatsapp_disconnected', handleDisconnected);
      socket.off('whatsapp_dispatch_progress', handleProgress);
    };
  }, [socket, activeCode, fetchAbsentStudents]);

  // Auto-poll status every 2.5 seconds while QR Modal is open or connecting (Bulletproof fallback)
  useEffect(() => {
    if (!isQrModalOpen && !connectingGateway) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get('/messaging/whatsapp-status', {
          params: { schoolCode: activeCode },
        });
        if (res.data?.success && res.data.data?.isConnected) {
          setGatewayStatus({
            isConnected: true,
            phoneNumber: res.data.data.phoneNumber || '',
            pushName: res.data.data.pushName || '',
            qrCode: null,
          });
          setIsQrModalOpen(false);
          setConnectingGateway(false);
        }
      } catch {}
    }, 2500);

    return () => clearInterval(interval);
  }, [isQrModalOpen, connectingGateway, activeCode]);

  // Trigger WhatsApp Connect
  const handleConnectWhatsApp = async () => {
    setConnectingGateway(true);
    setIsQrModalOpen(true);
    try {
      const res = await api.post('/messaging/connect-whatsapp', { schoolCode: activeCode });
      if (res.data?.success && res.data.data) {
        setGatewayStatus(res.data.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
      setConnectingGateway(false);
    }
  };

  // Disconnect WhatsApp
  const handleDisconnectWhatsApp = async () => {
    if (!window.confirm('Are you sure you want to unlink the school WhatsApp session?')) return;
    setDisconnectingGateway(true);
    try {
      await api.post('/messaging/disconnect-whatsapp', { schoolCode: activeCode });
      setGatewayStatus({
        isConnected: false,
        phoneNumber: '',
        pushName: '',
        qrCode: null,
      });
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setDisconnectingGateway(false);
    }
  };

  // Send Single Alert via Gateway
  const handleSendSingleGateway = async (student) => {
    if (!gatewayStatus.isConnected) {
      alert('WhatsApp is offline. Please link your WhatsApp device or use the Direct WhatsApp Web button.');
      return;
    }
    if (!student.phone) {
      alert('Parent phone number is not available in student records.');
      return;
    }

    try {
      await api.post('/messaging/send-single-alert', {
        schoolCode: activeCode,
        phone: student.phone,
        messageText: student.urduMessage,
        studentId: student.studentId,
        studentName: student.studentName,
        rollNumber: student.rollNumber,
        className: student.className,
        section: student.section,
        dateString: selectedDate,
      });

      // Update local state to marked sent
      setAbsentData((prev) => ({
        ...prev,
        alreadySentCount: prev.alreadySentCount + 1,
        pendingCount: Math.max(0, prev.pendingCount - 1),
        students: prev.students.map((st) =>
          String(st.studentId) === String(student.studentId)
            ? { ...st, alreadySent: true, sentAt: new Date().toISOString() }
            : st
        ),
      }));
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Auto-Send Bulk Selected
  const handleStartBulkDispatch = async () => {
    if (!gatewayStatus.isConnected) {
      alert('WhatsApp is not connected. Please scan the QR code first.');
      return;
    }

    const selectedList = absentData.students.filter(
      (st) => selectedStudentIds.has(String(st.studentId)) && !st.alreadySent && st.phone && !st.noWhatsApp
    );

    if (selectedList.length === 0) {
      alert('Please select at least one pending absent student with a valid phone number.');
      return;
    }

    const confirmMsg = `Ready to auto-send ${selectedList.length} absent alerts?\n\n🛡️ Smart Pacing Engine will deliver them safely with 6-9s human intervals.`;
    if (!window.confirm(confirmMsg)) return;

    setIsDispatching(true);
    setDispatchProgress({
      current: 0,
      total: selectedList.length,
      percent: 0,
      studentName: 'Initializing Safe Queue...',
      status: 'STARTING',
    });

    try {
      const alertsPayload = selectedList.map((st) => ({
        studentId: st.studentId,
        studentName: st.studentName,
        rollNumber: st.rollNumber,
        className: st.className,
        section: st.section,
        phone: st.phone,
        messageText: st.urduMessage,
      }));

      await api.post('/messaging/send-bulk-absent-alerts', {
        schoolCode: activeCode,
        alerts: alertsPayload,
        dateString: selectedDate,
      });
    } catch (err) {
      setIsDispatching(false);
      setDispatchProgress(null);
      alert(err.response?.data?.message || err.message);
    }
  };

  // Cancel Bulk Dispatch
  const handleCancelBulkQueue = async () => {
    try {
      await api.post('/messaging/cancel-bulk-queue', { schoolCode: activeCode });
      setIsDispatching(false);
      setDispatchProgress(null);
      fetchAbsentStudents();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Save Custom Templates
  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      await api.put('/messaging/custom-templates', {
        ...templates,
        schoolCode: activeCode,
      });
      setIsTemplateModalOpen(false);
      fetchAbsentStudents();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSavingTemplates(false);
    }
  };

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return (absentData.students || []).filter((st) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        st.studentName?.toLowerCase().includes(q) ||
        st.fatherName?.toLowerCase().includes(q) ||
        st.rollNumber?.toLowerCase().includes(q) ||
        st.phone?.includes(q)
      );
    });
  }, [absentData.students, searchQuery]);

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedStudentIds.size >= filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      const allIds = new Set(filteredStudents.map((s) => String(s.studentId)));
      setSelectedStudentIds(allIds);
    }
  };

  const toggleSelectStudent = (id) => {
    const next = new Set(selectedStudentIds);
    const idStr = String(id);
    if (next.has(idStr)) {
      next.delete(idStr);
    } else {
      next.add(idStr);
    }
    setSelectedStudentIds(next);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-6 lg:p-8 space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Absent Student Alerts
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-md">
                WhatsApp Center
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Real-time attendance notification & multi-device WhatsApp gateway
            </p>
          </div>
        </div>

        {/* WhatsApp Gateway Quick Status */}
        <div className="flex items-center gap-3">
          {gatewayStatus.isConnected ? (
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200/70 px-3.5 py-2 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-left">
                <p className="text-[11px] font-bold text-emerald-900 leading-none">
                  WhatsApp Linked: +{gatewayStatus.phoneNumber}
                </p>
                <p className="text-[10px] text-emerald-700 font-medium">
                  {gatewayStatus.pushName || 'School Official'}
                </p>
              </div>
              <button
                onClick={handleDisconnectWhatsApp}
                disabled={disconnectingGateway}
                className="ml-2 text-[10px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
              >
                {disconnectingGateway ? 'Disconnecting...' : 'Unlink'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/70 px-3 py-2 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs font-bold text-amber-800">WhatsApp Offline</span>
              <button
                onClick={handleConnectWhatsApp}
                disabled={connectingGateway}
                className="ml-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                {connectingGateway ? 'Opening...' : 'Connect WhatsApp'}
              </button>
            </div>
          )}

          {/* Template Config Button */}
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
            title="Edit Message Templates"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Dispatch Progress Banner (Visible during Auto-Sending) */}
      {isDispatching && dispatchProgress && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white p-5 rounded-2xl shadow-xl border border-emerald-500/30 animate-fade-in space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black tracking-wide text-emerald-300 uppercase">
                    Safe Bulk Dispatch In Progress
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                    🛡️ Anti-Ban Shield Active
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {dispatchProgress.status === 'COOLDOWN'
                    ? '☕ Safe Cool-Down Rest (25s pause to prevent carrier spam detection)...'
                    : `Sending ${dispatchProgress.current} of ${dispatchProgress.total}: ${dispatchProgress.studentName || ''}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-lg font-black font-mono text-emerald-400">
                {dispatchProgress.percent}%
              </span>
              <button
                onClick={handleCancelBulkQueue}
                className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Square className="w-3.5 h-3.5" />
                Cancel Queue
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(4, dispatchProgress.percent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Pacing Interval: 6.0s - 9.5s randomized jitter delay</span>
            <span>Typing presence simulated before each message</span>
          </div>
        </div>
      )}

      {/* 3. Stats Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Absent</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{absentData.totalAbsent || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Alerts Sent</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{absentData.alreadySentCount || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending Alerts</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{absentData.pendingCount || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Selected</p>
            <p className="text-2xl font-black text-indigo-700 mt-1">{selectedStudentIds.size}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar & Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            />
          </div>

          {/* Class Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-slate-500 font-bold">Class:</span>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSection('ALL');
              }}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="ALL">All Classes</option>
              {classes.map((cls, idx) => {
                const cName = typeof cls === 'string' ? cls : cls?.className || cls?.name || `Class ${idx + 1}`;
                return (
                  <option key={cls?._id || cName || idx} value={cName}>
                    {cName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Section Selector */}
          {availableSections.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-xs text-slate-500 font-bold">Section:</span>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">All Sections</option>
                {availableSections.map((secName, idx) => (
                  <option key={secName || idx} value={secName}>
                    {secName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-1.5 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchAbsentStudents}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
            title="Refresh Absent List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Right: Primary Action (Auto Send All) */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleStartBulkDispatch}
            disabled={isDispatching || selectedStudentIds.size === 0 || !gatewayStatus.isConnected}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm ${
              isDispatching || selectedStudentIds.size === 0 || !gatewayStatus.isConnected
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/20'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            Auto-Send Selected ({selectedStudentIds.size})
          </button>
        </div>
      </div>

      {/* 5. Main Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4 w-12 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="cursor-pointer text-slate-500 hover:text-slate-800"
                  >
                    {selectedStudentIds.size > 0 && selectedStudentIds.size === filteredStudents.length ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <UncheckedSquare className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Roll #</th>
                <th className="py-3 px-4">Student & Father Name</th>
                <th className="py-3 px-4">Class - Sec</th>
                <th className="py-3 px-4">Parent Phone</th>
                <th className="py-3 px-4">Alert Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading absent roster...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-black text-slate-800">No Absent Students Found</p>
                      <p className="text-xs text-slate-500">
                        Either all students are marked present for this date or attendance has not been entered yet.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => {
                  const isSelected = selectedStudentIds.has(String(st.studentId));
                  return (
                    <tr
                      key={st.studentId}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => toggleSelectStudent(st.studentId)}
                          disabled={st.alreadySent}
                          className="cursor-pointer text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <UncheckedSquare className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Roll Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {st.rollNumber || '—'}
                      </td>

                      {/* Student & Father Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{st.studentName}</div>
                        <div className="text-[11px] text-slate-500">S/O {st.fatherName || '—'}</div>
                      </td>

                      {/* Class & Section */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-bold text-[11px]">
                          {st.className} {st.section ? `(${st.section})` : ''}
                        </span>
                      </td>

                      {/* Parent Phone */}
                      <td className="py-3.5 px-4 font-mono font-medium">
                        {st.phone ? (
                          <span className="text-slate-800 font-bold">{st.phone}</span>
                        ) : (
                          <span className="text-rose-500 font-bold text-[11px]">No Phone</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {st.alreadySent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Sent
                          </span>
                        ) : st.noWhatsApp ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <AlertCircle className="w-3.5 h-3.5" />
                            No WhatsApp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Preview Message */}
                          <button
                            onClick={() => setPreviewStudent(st)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Preview Message"
                          >
                            <Info className="w-4 h-4" />
                          </button>

                          {/* 100% Safe Direct WhatsApp Web Button (Fallback) */}
                          {st.waLink && (
                            <a
                              href={st.waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition shadow-2xs"
                              title="Open in WhatsApp Web (100% safe direct message)"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Direct Web
                            </a>
                          )}

                          {/* Gateway 1-Click Send Button */}
                          <button
                            onClick={() => handleSendSingleGateway(st)}
                            disabled={!gatewayStatus.isConnected || !st.phone || st.alreadySent}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                              !gatewayStatus.isConnected || !st.phone || st.alreadySent
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-[#041633] hover:bg-[#072454] text-white cursor-pointer shadow-sm'
                            }`}
                          >
                            <Send className="w-3 h-3" />
                            Send
                          </button>
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

      {/* 6. QR Code Scanner Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-scale-up space-y-5">
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Scan WhatsApp QR Code</h3>
              <p className="text-xs text-slate-500">
                Link your school official WhatsApp phone to enable automated absent alerts
              </p>
            </div>

            {/* QR Image Box */}
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[260px]">
              {gatewayStatus.qrCode ? (
                <img
                  src={gatewayStatus.qrCode}
                  alt="WhatsApp QR Code"
                  className="w-56 h-56 rounded-xl shadow-sm border border-slate-200"
                />
              ) : (
                <div className="text-center space-y-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">Generating WhatsApp Session QR...</p>
                  <p className="text-[11px] text-slate-400">Please wait 2-3 seconds</p>
                </div>
              )}
            </div>

            {/* 3 Step Instruction Guide */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-800">Follow these 3 quick steps on your phone:</p>
              <ol className="list-decimal list-inside space-y-1 pl-1 font-medium">
                <li>Open WhatsApp on your school phone</li>
                <li>Tap <b>Settings</b> or <b>3 Dots</b> &gt; <b>Linked Devices</b></li>
                <li>Tap <b>Link a Device</b> and point camera at this QR code</li>
              </ol>
            </div>

            <button
              onClick={() => setIsQrModalOpen(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Close Window
            </button>
          </div>
        </div>
      )}

      {/* 7. Template Customization Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative animate-scale-up space-y-5">
            <button
              onClick={() => setIsTemplateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                Customize Absent Alerts Template
              </h3>
              <p className="text-xs text-slate-500">
                Personalize the message wording sent to parents. Dynamic placeholders will be filled automatically.
              </p>
            </div>

            {/* Language Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTemplateTab('urdu')}
                className={`py-2 px-4 text-xs font-bold border-b-2 cursor-pointer transition ${
                  activeTemplateTab === 'urdu'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Urdu Message (اردو)
              </button>
              <button
                onClick={() => setActiveTemplateTab('english')}
                className={`py-2 px-4 text-xs font-bold border-b-2 cursor-pointer transition ${
                  activeTemplateTab === 'english'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                English Message
              </button>
            </div>

            {/* Template Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Message Text Body:</label>
              {activeTemplateTab === 'urdu' ? (
                <textarea
                  rows={6}
                  dir="rtl"
                  value={templates.absentUrdu}
                  onChange={(e) => setTemplates({ ...templates, absentUrdu: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-emerald-500 font-sans leading-relaxed"
                />
              ) : (
                <textarea
                  rows={6}
                  value={templates.absentEnglish}
                  onChange={(e) => setTemplates({ ...templates, absentEnglish: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-emerald-500 leading-relaxed"
                />
              )}
            </div>

            {/* Placeholder Chips */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <p className="font-bold text-slate-700 text-[11px]">Available Smart Placeholders:</p>
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                {['{studentName}', '{fatherName}', '{rollNumber}', '{className}', '{section}', '{date}', '{schoolName}'].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplates}
                disabled={savingTemplates}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
              >
                {savingTemplates ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Message Preview Modal */}
      {previewStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-scale-up space-y-4">
            <button
              onClick={() => setPreviewStudent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-black text-slate-900">Message Preview</h3>
              <p className="text-xs text-slate-500">
                To: {previewStudent.studentName} (Phone: {previewStudent.phone || 'N/A'})
              </p>
            </div>

            {/* WhatsApp Chat Simulation Bubble */}
            <div className="bg-[#efeae2] p-4 rounded-2xl shadow-inner border border-slate-300">
              <div className="bg-[#d9fdd3] text-slate-800 p-3.5 rounded-xl rounded-tr-none text-xs font-medium shadow-sm whitespace-pre-wrap leading-relaxed">
                {previewStudent.urduMessage}
                <div className="text-[10px] text-slate-500 text-right mt-1.5 flex items-center justify-end gap-1">
                  <span>10:15 AM</span>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(previewStudent.urduMessage);
                  setCopiedPreview(true);
                  setTimeout(() => setCopiedPreview(false), 2000);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                {copiedPreview ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPreview ? 'Copied' : 'Copy Text'}
              </button>

              {previewStudent.waLink && (
                <a
                  href={previewStudent.waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open WhatsApp Web
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
