import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
  CalendarDays,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Check,
} from 'lucide-react';

import { useAcademicSession } from '../../context/AcademicSessionContext';

export default function ExamTermsManager({ schoolCode }) {
  const { currentSession: academicSession, sessions, switchSession } = useAcademicSession();
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Form state for adding an exam
  const [newTermName, setNewTermName] = useState('');
  const [newOrder, setNewOrder] = useState(1);

  // Fetch defined exams
  const fetchTerms = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.get('/exams/terms', {
        params: { schoolCode, academicSession },
      });
      if (res.data?.success) {
        setTerms(res.data.data || []);
        setNewOrder((res.data.data?.length || 0) + 1);
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to fetch exams.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Network error fetching exams.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, [schoolCode, academicSession]);

  // Handle Add Exam
  const handleSaveTerm = async (e) => {
    e.preventDefault();
    if (!newTermName.trim()) {
      setMessage({ type: 'error', text: 'Please enter an exam name.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await api.post('/exams/terms', {
        schoolCode,
        academicSession,
        name: newTermName.trim(),
        order: Number(newOrder) || terms.length + 1,
      });

      if (res.data?.success) {
        setMessage({
          type: 'success',
          text: `Exam "${newTermName}" added successfully!`,
        });
        setNewTermName('');
        fetchTerms();
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to add exam.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Error saving exam.' });
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete Exam
  const handleDeleteTerm = async (id, name) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to remove "${name}"? Existing marks in this exam will remain preserved in database.`
    );
    if (!confirmDelete) return;

    setMessage(null);
    try {
      const res = await api.delete(`/exams/terms/${id}`, {
        params: { schoolCode },
      });
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Exam "${name}" deleted.` });
        fetchTerms();
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to delete exam.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Error deleting exam.' });
    }
  };

  // Quick preset pills
  const handleQuickAdd = (name) => {
    setNewTermName(name);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-amber-500" />
            Exam Terms Setup
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure examination terms for the academic session.
          </p>
        </div>

        {/* Academic Session Switcher */}
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-600">Academic Session:</span>
          <select
            value={academicSession}
            onChange={(e) => switchSession(e.target.value)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          >
            {sessions.map((s) => (
              <option key={s._id} value={s.sessionName}>
                {s.sessionName} {s.isActive ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium ${
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
          <button
            onClick={() => setMessage(null)}
            className="text-xs underline hover:opacity-75 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Defined Exams Table on Left + Clean Add Form on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Defined Exams List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-800">
                Exams for Session <span className="text-[#ffa000]">{academicSession}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                {terms.length} Exams Defined
              </span>
            </div>

            <button
              onClick={fetchTerms}
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
                  <th className="py-3 px-4 w-16 text-center"># Order</th>
                  <th className="py-3 px-4">Exam Name</th>
                  <th className="py-3 px-4 w-32 text-center">Status</th>
                  <th className="py-3 px-4 w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                      <span>Loading exams...</span>
                    </td>
                  </tr>
                ) : terms.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-slate-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-medium text-slate-600">No exams defined for {academicSession} yet.</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Use the form on the right to add your school's exams (e.g. 1st Term, Mid Term, Final Term).
                      </p>
                    </td>
                  </tr>
                ) : (
                  terms.map((term, idx) => (
                    <tr key={term._id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 text-center font-bold text-slate-500">
                        {term.order || idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                        {term.name}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleDeleteTerm(term._id, term.name)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Remove Exam"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Simple Add Exam Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Plus className="w-4 h-4 text-amber-500" />
              Add New Exam
            </h3>

            {/* Quick Helper Suggestions */}
            <div className="mb-4">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">Quick Suggestions:</span>
              <div className="flex flex-wrap gap-1.5">
                {['1st Term', 'Mid Term', '2nd Term', 'Final Term', 'Monthly Test'].map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleQuickAdd(name)}
                    className="text-[11px] bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 font-medium px-2.5 py-1 rounded-md transition cursor-pointer border border-slate-200"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveTerm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Exam Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1st Term, Mid Term, Final Term"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sequence / Order
                </label>
                <input
                  type="number"
                  min="1"
                  value={newOrder}
                  onChange={(e) => setNewOrder(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Determines the order of columns in report cards.
                </span>
              </div>

              <button
                type="submit"
                disabled={saving || !newTermName.trim()}
                className="w-full bg-[#041633] hover:bg-[#06204d] text-[#ffa000] font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow mt-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Adding Exam...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add Exam</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500">
            <strong className="text-slate-700 block mb-1">Note:</strong>
            Whatever exams you define here will automatically appear as terms in the Marks Entry Sheet and as columns on the Consolidated Report Cards.
          </div>
        </div>
      </div>
    </div>
  );
}
