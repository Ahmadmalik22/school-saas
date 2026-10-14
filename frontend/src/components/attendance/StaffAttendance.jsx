import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import confetti from 'canvas-confetti';
import {
  Clock, Users, Check, X, Search,
  Calendar, CheckCircle2, AlertCircle, RefreshCw,
  Printer, Download, ShieldCheck, Sun, Umbrella,
  Briefcase, FileSpreadsheet, Sparkles
} from 'lucide-react';

export default function StaffAttendance({ schoolCode, setActiveSubModule }) {
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [search, setSearch] = useState('');

  // Daily Roster State
  const [records, setRecords] = useState([]);
  const [sheetData, setSheetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch Daily Staff Sheet
  const fetchDailySheet = async () => {
    if (selectedDate > todayStr) {
      setToast({
        type: 'error',
        message: 'Future dates are not allowed for attendance.',
      });
      setSelectedDate(todayStr);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/attendance/staff/sheet', {
        params: { schoolCode, date: selectedDate },
      });

      if (res.data.success) {
        setSheetData(res.data.data);
        setRecords(res.data.data.records || []);
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to fetch staff attendance sheet.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailySheet();
  }, [schoolCode, selectedDate]);

  // Bulk Status Update for All Staff
  const handleBulkStatus = (status) => {
    setRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status,
        timeIn:
          status === 'PRESENT' || status === 'LATE'
            ? r.timeIn || '08:00 AM'
            : '',
      }))
    );
    setToast({
      type: 'success',
      message: `All staff marked as "${status}". Click "Save Staff Attendance" to commit changes.`,
    });
  };

  // Status Change by Staff ID
  const handleStatusChange = (staffId, status) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.staffId === staffId) {
          const needsTimeIn = status === 'PRESENT' || status === 'LATE';
          return {
            ...r,
            status,
            timeIn: needsTimeIn ? r.timeIn || '08:00 AM' : '',
          };
        }
        return r;
      })
    );
  };

  // Time-In Change by Staff ID
  const handleTimeInChange = (staffId, timeIn) => {
    setRecords((prev) =>
      prev.map((r) => (r.staffId === staffId ? { ...r, timeIn } : r))
    );
  };

  // Remarks Change by Staff ID
  const handleRemarksChange = (staffId, remarks) => {
    setRecords((prev) =>
      prev.map((r) => (r.staffId === staffId ? { ...r, remarks } : r))
    );
  };

  // Save Daily Staff Attendance Sheet
  const handleSaveSheet = async () => {
    if (records.length === 0) {
      setToast({ type: 'error', message: 'No staff members to mark attendance for.' });
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/attendance/staff/sheet', {
        schoolCode,
        dateString: selectedDate,
        records,
      });

      if (res.data.success) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
        setToast({ type: 'success', message: res.data.message });
        setSheetData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save staff attendance.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter daily records by department and search
  const filteredRecords = records.filter((r) => {
    const matchDept =
      selectedDepartment === 'ALL' || r.department === selectedDepartment;
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      (r.role && r.role.toLowerCase().includes(search.toLowerCase()));
    return matchDept && matchSearch;
  });

  // Unique departments for filter dropdown
  const departments = Array.from(
    new Set(records.map((r) => r.department).filter(Boolean))
  );

  // Live KPI Calculations
  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const lateCount = records.filter((r) => r.status === 'LATE').length;
  const absentCount = records.filter((r) => r.status === 'ABSENT').length;
  const leaveCount = records.filter((r) => r.status === 'LEAVE').length;
  const holidayCount = records.filter(
    (r) => r.status === 'HOLIDAY' || r.status === 'SUNDAY'
  ).length;
  const totalStaff = records.length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
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
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#041633] text-white rounded-2xl p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-[#ffa000] text-xs font-bold uppercase tracking-wider mb-1">
            <Briefcase className="w-4 h-4" />
            <span>Staff Punctuality & Daily Roster</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Teachers & Staff Daily Attendance</span>
            {sheetData?.isExisting ? (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                ✓ Saved in Database
              </span>
            ) : (
              <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                Draft (Unsaved)
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Daily Attendance • Time-In Punctuality • Automated Unpaid Absent Flow into Monthly Payroll
          </p>
        </div>

        {/* Shortcut to Monthly Register Submodule */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchDailySheet}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh</span>
          </button>

          {setActiveSubModule && (
            <button
              type="button"
              onClick={() => setActiveSubModule('staff_attendance_register')}
              className="px-4 py-2 bg-[#ffa000] hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Monthly Staff Register</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1">Attendance Date</label>
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              max={todayStr}
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value;
                if (val > todayStr) {
                  setSelectedDate(todayStr);
                  setToast({
                    type: 'error',
                    message: 'Future dates cannot be selected. Clamped to today.',
                  });
                } else {
                  setSelectedDate(val);
                }
              }}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Department</label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block font-bold text-slate-700 mb-1">Search Staff</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by staff name, employee ID, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* 4 Bulk Shortcut Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => handleBulkStatus('PRESENT')}
          className="bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Mark All Present</span>
        </button>

        <button
          type="button"
          onClick={() => handleBulkStatus('ABSENT')}
          className="bg-[#ef4444] hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <X className="w-4 h-4 stroke-[3]" />
          <span>Mark All Absent</span>
        </button>

        <button
          type="button"
          onClick={() => handleBulkStatus('HOLIDAY')}
          className="bg-[#0d9488] hover:bg-teal-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <Umbrella className="w-4 h-4" />
          <span>Mark All Holiday</span>
        </button>

        <button
          type="button"
          onClick={() => handleBulkStatus('SUNDAY')}
          className="bg-[#ea580c] hover:bg-orange-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <Sun className="w-4 h-4" />
          <span>Mark All Sunday</span>
        </button>
      </div>

      {/* Live KPI Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-semibold block uppercase">
            Total Staff
          </span>
          <span className="text-base font-black text-slate-900">{totalStaff}</span>
        </div>
        <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-[10px] text-emerald-700 font-semibold block uppercase">
            Present
          </span>
          <span className="text-base font-black text-emerald-800">{presentCount}</span>
        </div>
        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 shadow-2xs">
          <span className="text-[10px] text-amber-700 font-semibold block uppercase">
            Late Arrivals
          </span>
          <span className="text-base font-black text-amber-800">{lateCount}</span>
        </div>
        <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-[10px] text-rose-700 font-semibold block uppercase">
            Unpaid Absent
          </span>
          <span className="text-base font-black text-rose-800">{absentCount}</span>
        </div>
        <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200 shadow-2xs">
          <span className="text-[10px] text-blue-700 font-semibold block uppercase">
            Approved Leave
          </span>
          <span className="text-base font-black text-blue-800">{leaveCount}</span>
        </div>
      </div>

      {/* Staff Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#041633] text-white uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3 w-28">Emp ID</th>
                <th className="py-3 px-4">Staff Name</th>
                <th className="py-3 px-3">Role / Dept</th>
                <th className="py-3 px-3 w-32">Time In</th>
                <th className="py-3 px-4 text-center w-64">Attendance Status</th>
                <th className="py-3 px-4 w-52">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading staff roster...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600">No staff members found.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Register staff members via "Add Staff Member" in Teachers & Staff menu.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((staff, idx) => (
                  <tr
                    key={staff.staffId}
                    className={`hover:bg-slate-50 transition-colors ${
                      staff.status === 'ABSENT'
                        ? 'bg-rose-50/40'
                        : staff.status === 'LATE'
                        ? 'bg-amber-50/40'
                        : staff.status === 'LEAVE'
                        ? 'bg-blue-50/30'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center text-slate-400 font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {staff.employeeId}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {staff.name}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 block">{staff.role}</span>
                      <span className="text-[10px] text-slate-400">{staff.department}</span>
                    </td>

                    {/* Time In Field */}
                    <td className="py-2 px-3">
                      <div className="relative">
                        <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="08:00 AM"
                          value={staff.timeIn || ''}
                          onChange={(e) =>
                            handleTimeInChange(staff.staffId, e.target.value)
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded pl-7 pr-2 py-1 text-xs font-mono font-semibold"
                        />
                      </div>
                    </td>

                    {/* Status Toggle Buttons */}
                    <td className="py-2.5 px-4 text-center">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 gap-1">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(staff.staffId, 'PRESENT')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                            staff.status === 'PRESENT'
                              ? 'bg-[#10b981] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Present"
                        >
                          P
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(staff.staffId, 'LATE')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                            staff.status === 'LATE'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Late Arrival"
                        >
                          Late
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(staff.staffId, 'ABSENT')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                            staff.status === 'ABSENT'
                              ? 'bg-[#ef4444] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Absent (Unpaid Salary Deduction)"
                        >
                          A
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(staff.staffId, 'LEAVE')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                            staff.status === 'LEAVE'
                              ? 'bg-[#3b82f6] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Approved Leave"
                        >
                          Lv
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(staff.staffId, 'HOLIDAY')}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                            staff.status === 'HOLIDAY'
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Holiday"
                        >
                          H
                        </button>
                      </div>
                    </td>

                    {/* Remarks */}
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        placeholder="Remarks or reason..."
                        value={staff.remarks || ''}
                        onChange={(e) =>
                          handleRemarksChange(staff.staffId, e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-[11px]"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Bar */}
        <div className="bg-[#041633] text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Unpaid absents and lates automatically flow into upcoming Payroll Salary Slips.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Roster</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSheet}
              disabled={saving || records.length === 0}
              className="bg-[#ffa000] hover:bg-amber-400 text-slate-950 font-black text-xs px-6 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Staff Attendance...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Staff Attendance</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
