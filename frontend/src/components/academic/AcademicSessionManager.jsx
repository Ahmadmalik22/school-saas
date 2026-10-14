import React, { useState } from 'react';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  Check,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function AcademicSessionManager() {
  const {
    currentSession,
    activeSession,
    sessions,
    loading,
    switchSession,
    setOfficialActiveSession,
    createNewSession,
    removeSession,
    refreshSessions,
  } = useAcademicSession();

  const currentYear = new Date().getFullYear();

  // Form State
  const [startMonth, setStartMonth] = useState('April');
  const [startYear, setStartYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState('March');
  const [endYear, setEndYear] = useState(currentYear + 1);
  const [customName, setCustomName] = useState('');
  const [makeActive, setMakeActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Suggested Session Name
  const suggestedSessionName = customName.trim() || `${startYear}-${endYear}`;

  const handleStartYearChange = (year) => {
    const y = Number(year);
    setStartYear(y);
    setEndYear(y + 1);
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await createNewSession({
      startMonth,
      startYear,
      endMonth,
      endYear,
      sessionName: suggestedSessionName,
      makeActive,
    });

    if (res.success) {
      setMessage({ type: 'success', text: res.message });
      setCustomName('');
    } else {
      setMessage({ type: 'error', text: res.message });
    }
    setSaving(false);
  };

  const handleSetActive = async (sessionName) => {
    setMessage(null);
    const res = await setOfficialActiveSession(sessionName);
    if (res.success) {
      setMessage({ type: 'success', text: `Session "${sessionName}" is now active system-wide!` });
    } else {
      setMessage({ type: 'error', text: res.message });
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete session "${name}"?`)) return;
    setMessage(null);
    const res = await removeSession(id);
    if (res.success) {
      setMessage({ type: 'success', text: res.message });
    } else {
      setMessage({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#ffa000]" />
            Academic Sessions & Calendar Setup
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Define school academic sessions with starting and ending months/years. The selected active session controls student admissions, exams, marks, fee vouchers, and report cards throughout the entire software.
          </p>
        </div>

        {/* Current Active Global Badge */}
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <div className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Current Global Session</div>
            <div className="text-base font-black text-[#041633]">{currentSession}</div>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs md:text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs underline hover:opacity-75 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Form on Left + Defined Sessions List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Create New Session Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <Plus className="w-4 h-4 text-[#ffa000]" />
            Define New Academic Session
          </h3>

          <form onSubmit={handleCreateSession} className="space-y-4">
            {/* Start Month & Year */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Starting Month *</label>
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-2 font-medium focus:ring-2 focus:ring-amber-500"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Starting Year *</label>
                <input
                  type="number"
                  min="2020"
                  max="2040"
                  value={startYear}
                  onChange={(e) => handleStartYearChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-2 font-bold focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
            </div>

            {/* End Month & Year */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Ending Month *</label>
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-2 font-medium focus:ring-2 focus:ring-amber-500"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Ending Year *</label>
                <input
                  type="number"
                  min="2020"
                  max="2040"
                  value={endYear}
                  onChange={(e) => setEndYear(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-2 font-bold focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
            </div>

            {/* Generated Session Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Session Title / Name (Auto-Generated)
              </label>
              <input
                type="text"
                placeholder={`${startYear}-${endYear}`}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg px-3 py-2 font-bold focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Will be registered as: <strong className="text-slate-700">{suggestedSessionName}</strong>
              </span>
            </div>

            {/* Set as Active Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={makeActive}
                onChange={(e) => setMakeActive(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500"
              />
              <span className="text-xs font-semibold text-slate-800">
                Set as active working session immediately
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#041633] hover:bg-[#06204d] text-[#ffa000] font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer shadow disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Creating Session...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create Academic Session</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <strong className="text-slate-800 block">How Sessions Work:</strong>
            <p>1. When a new school year starts, create it here (e.g. 2026-2027).</p>
            <p>2. Switching sessions immediately loads historical or upcoming data across all modules without overwriting previous sessions.</p>
          </div>
        </div>

        {/* Right Column: Sessions List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-800">Defined School Sessions</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                  {sessions.length} Sessions
                </span>
              </div>

              <button
                onClick={refreshSessions}
                disabled={loading}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Session Name</th>
                    <th className="py-3 px-4">Duration Range</th>
                    <th className="py-3 px-4 text-center">Global Status</th>
                    <th className="py-3 px-4 text-right">Switch / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                        <span>Loading sessions...</span>
                      </td>
                    </tr>
                  ) : sessions.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-slate-400">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="font-medium text-slate-600">No sessions defined yet.</p>
                      </td>
                    </tr>
                  ) : (
                    sessions.map((ses) => {
                      const isWorkingSession = currentSession === ses.sessionName;
                      const isOfficialActive = activeSession === ses.sessionName || ses.isActive;

                      return (
                        <tr
                          key={ses._id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isWorkingSession ? 'bg-amber-50/40 font-semibold' : ''
                          }`}
                        >
                          {/* Session Name */}
                          <td className="py-4 px-4 font-bold text-slate-900 text-sm">
                            <div className="flex items-center gap-2">
                              <span>{ses.sessionName}</span>
                              {isWorkingSession && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#ffa000] text-slate-950">
                                  Current View
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Duration */}
                          <td className="py-4 px-4 text-slate-600 font-medium">
                            {ses.startMonth} {ses.startYear} — {ses.endMonth} {ses.endYear}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 text-center">
                            {isOfficialActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <Check className="w-3 h-3" /> Officially Active
                              </span>
                            ) : ses.isArchived ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                                Archived
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSetActive(ses.sessionName)}
                                className="text-[11px] text-amber-700 hover:text-amber-900 underline font-semibold cursor-pointer"
                              >
                                Make Active
                              </button>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isWorkingSession ? (
                                <span className="text-[11px] text-emerald-700 font-bold px-2 py-1">
                                  Viewing
                                </span>
                              ) : (
                                <button
                                  onClick={() => switchSession(ses.sessionName)}
                                  className="text-xs bg-slate-100 hover:bg-[#041633] text-slate-700 hover:text-[#ffa000] font-bold px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1"
                                >
                                  <span>Switch</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}

                              {!isOfficialActive && (
                                <button
                                  onClick={() => handleDelete(ses._id, ses.sessionName)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                                  title="Delete Session"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Currently Active Working Session: <strong className="text-slate-900">{currentSession}</strong>
            </span>
            <span className="text-[11px] text-slate-400">
              Any changes made in other tabs will apply strictly to session {currentSession}.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
