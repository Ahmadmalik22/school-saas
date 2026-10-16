import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import { broadcastDataChange } from '../../utils/realtimeEvents';
import confetti from 'canvas-confetti';
import {
  Calendar, Check, X, Search, QrCode,
  Users, CheckCircle2, AlertCircle, RefreshCw,
  Printer, Sun, Umbrella, Clock, Volume2,
  Sparkles, ShieldCheck
} from 'lucide-react';

export default function StudentAttendance({ schoolCode, setActiveSubModule }) {
  const { classNames, getSectionsForClass } = useAcademicClasses(schoolCode);

  // Filter State (Matching User's Screenshot)
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const [attendanceType, setAttendanceType] = useState('MANUAL'); // 'MANUAL' or 'QR_SCANNER'
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Attendance Sheet Data
  const [sheetData, setSheetData] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Scanner Simulator State (For Smart QR Code future integration)
  const [scannerInput, setScannerInput] = useState('');
  const [scannedRecent, setScannedRecent] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Auto-sync initial class from dynamic classNames
  useEffect(() => {
    if (classNames && classNames.length > 0 && !selectedClass) {
      const firstClass = classNames[0];
      setSelectedClass(firstClass);
      const secs = getSectionsForClass(firstClass);
      setSelectedSection(secs[0] || 'A');
    }
  }, [classNames, selectedClass, getSectionsForClass]);

  // Audio confirmation chime using Web Audio API (Zero dependencies, works in every browser)
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch pleasant chime
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio not permitted without user gesture
    }
  };

  // Fetch Attendance Sheet from Backend
  const handleFetchAttendance = async () => {
    if (!selectedClass || !selectedSection || !selectedDate) {
      setToast({ type: 'error', message: 'Please select class, section, and date.' });
      return;
    }

    if (selectedDate > todayStr) {
      setToast({ type: 'error', message: 'Attendance cannot be marked or viewed for future dates.' });
      setSelectedDate(todayStr);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/attendance/student/sheet', {
        params: {
          schoolCode,
          className: selectedClass,
          section: selectedSection,
          date: selectedDate,
        },
      });

      if (res.data.success) {
        setSheetData(res.data.data);
        setRecords(res.data.data.records || []);
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to fetch attendance sheet.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-load attendance on first mount once selectedClass is ready
  useEffect(() => {
    if (selectedClass && selectedSection) {
      handleFetchAttendance();
    }
  }, [selectedClass, selectedSection, selectedDate]);

  // Helper: Get real current time (e.g. 12:45 PM)
  const getCurrentFormattedTime = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // ⚡ 4 BULK ACTION SHORTCUTS (From user's screenshot)
  const handleBulkSetStatus = (newStatus) => {
    if (records.length === 0) return;
    const nowTime = getCurrentFormattedTime();
    setRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status: newStatus,
        timeIn: newStatus === 'PRESENT' ? (r.timeIn || nowTime) : '',
      }))
    );
    setToast({
      type: 'success',
      message: `All students marked as "${newStatus}"! Click "Save Attendance" to apply.`,
    });
  };

  // Individual Student Status Change
  const handleStatusChange = (index, status) => {
    const nowTime = getCurrentFormattedTime();
    setRecords((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        status,
        timeIn: status === 'PRESENT' ? (updated[index].timeIn || nowTime) : '',
      };
      return updated;
    });
  };

  // Individual Student Remarks Change
  const handleRemarksChange = (index, remarks) => {
    setRecords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], remarks };
      return updated;
    });
  };

  // Save Attendance to Backend
  const handleSaveAttendance = async () => {
    if (records.length === 0) {
      setToast({ type: 'error', message: 'No students to mark attendance for.' });
      return;
    }

    setSaving(true);
    try {
      const nowTime = getCurrentFormattedTime();
      const recordsToSave = records.map((r) => ({
        ...r,
        timeIn: r.status === 'PRESENT' ? (r.timeIn || nowTime) : '',
      }));

      const res = await api.post('/attendance/student/sheet', {
        schoolCode,
        className: selectedClass,
        section: selectedSection,
        dateString: selectedDate,
        attendanceType,
        records: recordsToSave,
      });

      if (res.data.success) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
        setToast({ type: 'success', message: res.data.message });
        setSheetData(res.data.data);
        broadcastDataChange('attendance');
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save attendance.',
      });
    } finally {
      setSaving(false);
    }
  };

  // QR / Barcode Scanner Input Simulator
  const handleScannerSubmit = (e) => {
    e.preventDefault();
    const query = scannerInput.trim().toUpperCase();
    if (!query) return;

    const targetIdx = records.findIndex(
      (r) =>
        r.admissionNumber.toUpperCase() === query ||
        r.rollNumber.toUpperCase() === query
    );

    if (targetIdx !== -1) {
      const student = records[targetIdx];
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      handleStatusChange(targetIdx, 'PRESENT');
      setRecords((prev) => {
        const up = [...prev];
        up[targetIdx].timeIn = nowTime;
        return up;
      });

      playBeep();
      setScannedRecent((prev) => [
        { name: student.studentName, roll: student.rollNumber, time: nowTime },
        ...prev.slice(0, 4),
      ]);
      setToast({
        type: 'success',
        message: `✓ Scanned: ${student.studentName} marked Present!`,
      });
    } else {
      setToast({
        type: 'error',
        message: `Student with ID "${query}" not found in ${selectedClass} (${selectedSection}).`,
      });
    }
    setScannerInput('');
  };

  // Live KPI Calculations
  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const absentCount = records.filter((r) => r.status === 'ABSENT').length;
  const leaveCount = records.filter((r) => r.status === 'LEAVE').length;
  const holidayCount = records.filter((r) => r.status === 'HOLIDAY').length;
  const sundayCount = records.filter((r) => r.status === 'SUNDAY').length;
  const halfDayCount = records.filter((r) => r.status === 'HALF_DAY').length;
  const totalCount = records.length;
  const activeAttended = presentCount + halfDayCount * 0.5;
  const activeTarget = totalCount - holidayCount - sundayCount;
  const percentage =
    activeTarget > 0 ? Math.round((activeAttended / activeTarget) * 100) : 100;

  // Format Date for Center Details Badge (e.g. "16 December - 2026")
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${day} ${month} - ${year}`;
  };

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-5">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold text-white transition-all ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP HEADER: Manage Student Attendance */}
      <div className="bg-[#041633] text-white rounded-2xl p-4 shadow-md flex items-center justify-between border border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-[#ffa000] flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center gap-2">
              <span>Manage Student Attendance</span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Daily Class Attendance Roster • Atlas Optimized Storage • Fee Fine Ready
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {setActiveSubModule && (
            <button
              type="button"
              onClick={() => setActiveSubModule('student_attendance_register')}
              className="px-3.5 py-1.5 bg-[#ffa000] hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <span>Monthly Student Register</span>
            </button>
          )}

          {sheetData?.isExisting ? (
            <span className="text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Marked & Saved</span>
            </span>
          ) : (
            <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Draft (Unsaved)</span>
            </span>
          )}
        </div>
      </div>

      {/* 1. TOP FILTER BAR (EXACT WORKFLOW FROM USER'S SCREENSHOT) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs">
          {/* Type Dropdown */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Type</label>
            <select
              value={attendanceType}
              onChange={(e) => setAttendanceType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="MANUAL">Digital Attendance</option>
              <option value="QR_SCANNER">⚡ Smart Card / QR Scanner</option>
            </select>
          </div>

          {/* Class Dropdown */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                const nextCls = e.target.value;
                setSelectedClass(nextCls);
                const secs = getSectionsForClass(nextCls);
                setSelectedSection(secs[0] || 'A');
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {classNames.length === 0 ? (
                <option value="">Loading...</option>
              ) : (
                classNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Section Dropdown */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {getSectionsForClass(selectedClass).map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              max={todayStr}
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value;
                if (val > todayStr) {
                  setSelectedDate(todayStr);
                  setToast({ type: 'error', message: 'Future dates cannot be selected. Clamped to today.' });
                } else {
                  setSelectedDate(val);
                }
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            />
          </div>

          {/* Green "Manage Attendance" Search Button */}
          <div>
            <button
              onClick={handleFetchAttendance}
              disabled={loading}
              className="w-full bg-[#10b981] hover:bg-emerald-600 text-white font-bold p-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Manage Attendance</span>
            </button>
          </div>
        </div>
      </div>

      {/* IF QR SCANNER TYPE IS ACTIVE (ARCHITECTURE & SCANNER VIEW) */}
      {attendanceType === 'QR_SCANNER' && (
        <div className="bg-gradient-to-r from-[#041633] to-[#0b285a] rounded-2xl p-6 text-white border border-slate-700 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-[#ffa000] flex items-center justify-center border border-amber-500/30">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Smart Card & QR Code Scanner Mode</h3>
                <p className="text-xs text-slate-300">
                  Ready for USB Barcode Scanners and Camera Input. Instant audio confirmation enabled.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                  soundEnabled
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{soundEnabled ? 'Chime Sound ON' : 'Muted'}</span>
              </button>
            </div>
          </div>

          {/* Scanner Input Box */}
          <form onSubmit={handleScannerSubmit} className="flex gap-2 max-w-xl mx-auto pt-2">
            <div className="relative flex-1">
              <QrCode className="w-5 h-5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="Scan Card or Enter Admission No / Roll No..."
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border-2 border-amber-400/50 rounded-xl text-white placeholder-slate-400 font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
            <button
              type="submit"
              className="bg-[#ffa000] hover:bg-amber-400 text-slate-950 font-black px-5 rounded-xl transition cursor-pointer text-xs"
            >
              Scan & Mark
            </button>
          </form>

          {/* Recent Scans Strip */}
          {scannedRecent.length > 0 && (
            <div className="pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block mb-2">
                Recently Scanned Students:
              </span>
              <div className="flex flex-wrap gap-2">
                {scannedRecent.map((s, idx) => (
                  <div
                    key={idx}
                    className="bg-white/10 border border-emerald-400/40 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2 animate-in fade-in"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-bold text-white">{s.name}</span>
                    <span className="font-mono text-slate-300">({s.roll})</span>
                    <span className="text-[10px] text-amber-300 font-mono">{s.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. CENTER DETAILS CARD (EXACTLY AS IN USER'S SCREENSHOT) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center space-y-1 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-blue-600 to-emerald-500"></div>
        <h2 className="text-lg font-black text-slate-900 tracking-tight">
          Attendance For Class: <span className="text-blue-600">{selectedClass || '—'}</span>
        </h2>
        <div className="text-xs font-semibold text-slate-600">
          Section: <span className="font-bold text-slate-900">{selectedSection}</span>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Main Campus • School Code: <span className="font-bold text-slate-800">{schoolCode}</span>
        </div>
        <div className="text-xs font-black text-amber-600 pt-0.5">
          {formatDateDisplay(selectedDate)}
        </div>
      </div>

      {/* 3. 4 BULK ACTION BUTTONS (EXACTLY AS IN USER'S SCREENSHOT) */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => handleBulkSetStatus('PRESENT')}
          className="bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>✓ Mark All Present</span>
        </button>

        <button
          type="button"
          onClick={() => handleBulkSetStatus('ABSENT')}
          className="bg-[#ef4444] hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <X className="w-4 h-4 stroke-[3]" />
          <span>✗ Mark All Absent</span>
        </button>

        <button
          type="button"
          onClick={() => handleBulkSetStatus('HOLIDAY')}
          className="bg-[#0d9488] hover:bg-teal-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <Umbrella className="w-4 h-4" />
          <span>🏖️ Mark All Holiday</span>
        </button>

        <button
          type="button"
          onClick={() => handleBulkSetStatus('SUNDAY')}
          className="bg-[#ea580c] hover:bg-orange-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <Sun className="w-4 h-4" />
          <span>📅 Mark All Sunday</span>
        </button>
      </div>

      {/* 4. LIVE SUMMARY BADGE STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-semibold block uppercase">Total Enrolled</span>
          <span className="text-base font-black text-slate-900">{totalCount}</span>
        </div>
        <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-[10px] text-emerald-700 font-semibold block uppercase">Present</span>
          <span className="text-base font-black text-emerald-800">{presentCount}</span>
        </div>
        <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-[10px] text-rose-700 font-semibold block uppercase">Absent (Fineable)</span>
          <span className="text-base font-black text-rose-800">{absentCount}</span>
        </div>
        <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200 shadow-2xs">
          <span className="text-[10px] text-blue-700 font-semibold block uppercase">On Leave</span>
          <span className="text-base font-black text-blue-800">{leaveCount}</span>
        </div>
        <div className="bg-teal-50 p-2.5 rounded-xl border border-teal-200 shadow-2xs">
          <span className="text-[10px] text-teal-700 font-semibold block uppercase">Holiday / Sunday</span>
          <span className="text-base font-black text-teal-800">{holidayCount + sundayCount}</span>
        </div>
        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 shadow-2xs">
          <span className="text-[10px] text-amber-700 font-semibold block uppercase">Attendance Rate</span>
          <span className="text-base font-black text-amber-800">{percentage}%</span>
        </div>
      </div>

      {/* 5. ATTENDANCE TABLE (MATCHING USER'S SCREENSHOT COLUMNS) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#041633] text-white uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3 w-32">Roll ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Parent</th>
                <th className="py-3 px-3">Class</th>
                <th className="py-3 px-4 text-center w-64">Attendance Status</th>
                <th className="py-3 px-4 w-44">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading class attendance roster...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600">No active students found in this Class & Section.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Admit students to {selectedClass} ({selectedSection}) via Student Admissions.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((student, idx) => (
                  <tr
                    key={student.studentId}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      student.status === 'ABSENT'
                        ? 'bg-rose-50/40'
                        : student.status === 'LEAVE'
                        ? 'bg-blue-50/30'
                        : student.status === 'HOLIDAY'
                        ? 'bg-teal-50/30'
                        : ''
                    }`}
                  >
                    {/* Index */}
                    <td className="py-3 px-3 text-center text-slate-400 font-bold">
                      {idx + 1}
                    </td>

                    {/* Roll ID (Roll Number + Admission No badge) */}
                    <td className="py-3 px-3 font-mono">
                      <div className="font-bold text-slate-900 text-xs">
                        {student.rollNumber ? `Roll #${student.rollNumber}` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-400 tracking-tight">
                        {student.admissionNumber}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-xs">
                        {student.studentName}
                      </div>
                      {student.timeIn && (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Time In: {student.timeIn}</span>
                        </span>
                      )}
                    </td>

                    {/* Parent */}
                    <td className="py-3 px-4 text-slate-600 text-xs font-semibold">
                      {student.fatherName || '—'}
                    </td>

                    {/* Class */}
                    <td className="py-3 px-3 font-semibold text-slate-700 text-xs">
                      {selectedClass} ({selectedSection})
                    </td>

                    {/* Attendance Status (Fast interactive buttons & dropdown) */}
                    <td className="py-2.5 px-4 text-center">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 gap-1">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(idx, 'PRESENT')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                            student.status === 'PRESENT'
                              ? 'bg-[#10b981] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Present"
                        >
                          P
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(idx, 'ABSENT')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                            student.status === 'ABSENT'
                              ? 'bg-[#ef4444] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Absent (Fine Applicable)"
                        >
                          A
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(idx, 'LEAVE')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                            student.status === 'LEAVE'
                              ? 'bg-[#3b82f6] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Approved Leave (No Fine)"
                        >
                          L
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(idx, 'HALF_DAY')}
                          className={`px-2 py-1 text-xs font-bold rounded-md transition ${
                            student.status === 'HALF_DAY'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Half Day"
                        >
                          H
                        </button>
                      </div>

                      {/* Fallback Dropdown for Special Statuses (Holiday, Sunday) */}
                      <select
                        value={student.status}
                        onChange={(e) => handleStatusChange(idx, e.target.value)}
                        className="ml-2 text-[11px] bg-white border border-slate-300 rounded px-1.5 py-1 font-semibold text-slate-700"
                      >
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LEAVE">Leave</option>
                        <option value="HALF_DAY">Half Day</option>
                        <option value="HOLIDAY">Holiday</option>
                        <option value="SUNDAY">Sunday</option>
                      </select>
                    </td>

                    {/* Remarks Input */}
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        placeholder="Optional remarks..."
                        value={student.remarks || ''}
                        onChange={(e) => handleRemarksChange(idx, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM SAVE BAR */}
        <div className="bg-[#041633] text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Absents will automatically link to <strong className="text-white">Fee Challan</strong> fines. Storage optimized.
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={saving || records.length === 0}
              className="bg-[#ffa000] hover:bg-amber-400 text-slate-950 font-black text-xs px-6 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Attendance...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Attendance</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
