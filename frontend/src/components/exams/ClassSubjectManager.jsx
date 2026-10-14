import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../context/AcademicClassesContext';
import {
  BookOpen,
  Plus,
  Trash2,
  Copy,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Layers,
} from 'lucide-react';

export default function ClassSubjectManager({ schoolCode }) {
  const { classes } = useAcademicClasses();
  const classList = classes && classes.length > 0
    ? classes.map((c) => c.name || c)
    : ['Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

  const [selectedClass, setSelectedClass] = useState(classList[0] || 'Class 1');
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copySourceClass, setCopySourceClass] = useState('');
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState(null);

  // New subject inline state
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newTotalMarks, setNewTotalMarks] = useState(100);
  const [newPassingMarks, setNewPassingMarks] = useState(40);

  // Fetch subjects for selected class
  const fetchSubjects = async (className) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.get('/exams/subjects', {
        params: { schoolCode, className }
      });
      if (res.data?.success) {
        setSubjects(res.data.data || []);
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to fetch subjects.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Network error while fetching subjects.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass) {
      fetchSubjects(selectedClass);
    }
  }, [selectedClass, schoolCode]);

  // Handle local change in subject list
  const handleSubjectChange = (index, field, value) => {
    const updated = [...subjects];
    updated[index] = { ...updated[index], [field]: value };
    setSubjects(updated);
  };

  // Remove a subject
  const handleRemoveSubject = (index) => {
    const updated = subjects.filter((_, i) => i !== index);
    setSubjects(updated);
  };

  // Add new subject to list
  const handleAddSubject = (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    const exists = subjects.some(
      (s) => s.subjectName.trim().toLowerCase() === newSubjectName.trim().toLowerCase()
    );
    if (exists) {
      setMessage({ type: 'error', text: `Subject "${newSubjectName}" already exists for ${selectedClass}.` });
      return;
    }

    const newSub = {
      subjectName: newSubjectName.trim(),
      totalMarks: Number(newTotalMarks) || 100,
      passingMarks: Number(newPassingMarks) || 40,
      order: subjects.length + 1,
    };

    setSubjects([...subjects, newSub]);
    setNewSubjectName('');
    setNewTotalMarks(100);
    setNewPassingMarks(40);
    setMessage({ type: 'success', text: `Added "${newSub.subjectName}". Click "Save Subjects" to persist.` });
  };

  // Save all subjects to database
  const handleSaveSubjects = async () => {
    if (subjects.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one subject before saving.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await api.post('/exams/subjects', {
        schoolCode,
        className: selectedClass,
        subjects,
      });
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Curriculum for ${selectedClass} saved successfully!` });
        fetchSubjects(selectedClass);
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to save subjects.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Network error while saving subjects.' });
    } finally {
      setSaving(false);
    }
  };

  // 1-Click Copy Subjects from another class
  const handleCopySubjects = async () => {
    if (!copySourceClass) {
      setMessage({ type: 'error', text: 'Please select a source class to copy from.' });
      return;
    }
    if (copySourceClass === selectedClass) {
      setMessage({ type: 'error', text: 'Source class cannot be the same as current class.' });
      return;
    }

    const confirmCopy = window.confirm(
      `Are you sure you want to copy all subjects from ${copySourceClass} to ${selectedClass}? Any existing subjects in ${selectedClass} will be replaced.`
    );
    if (!confirmCopy) return;

    setCopying(true);
    setMessage(null);
    try {
      const res = await api.post('/exams/subjects/copy', {
        schoolCode,
        sourceClass: copySourceClass,
        targetClass: selectedClass,
      });
      if (res.data?.success) {
        setMessage({
          type: 'success',
          text: `Successfully duplicated all subjects from ${copySourceClass} to ${selectedClass}!`,
        });
        fetchSubjects(selectedClass);
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to copy subjects.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Network error during copy operation.' });
    } finally {
      setCopying(false);
    }
  };

  const totalMaxMarksSum = subjects.reduce((sum, s) => sum + (Number(s.totalMarks) || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-500" />
            Class Subjects & Curriculum Setup
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Define subjects, total marks, and passing criteria per class. Use 1-Click Copy to instantly replicate curriculum across classes without re-typing.
          </p>
        </div>

        {/* Class Selection Dropdown */}
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-600">Select Class:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          >
            {classList.map((c) => (
              <option key={c} value={c}>
                {c}
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

      {/* 1-Click Curriculum Duplication Card */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#ffa000] text-slate-950 flex items-center justify-center font-bold shadow-sm">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                1-Click Duplicate Subjects From Another Class
              </h3>
              <p className="text-xs text-slate-600">
                Already configured subjects for Class 6 or 7? Clone them directly into <strong className="text-slate-900">{selectedClass}</strong> in 1 click!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={copySourceClass}
              onChange={(e) => setCopySourceClass(e.target.value)}
              className="bg-white border border-amber-300 text-slate-800 text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
            >
              <option value="">-- Select Source Class --</option>
              {classList
                .filter((c) => c !== selectedClass)
                .map((c) => (
                  <option key={c} value={c}>
                    Copy from {c}
                  </option>
                ))}
            </select>

            <button
              onClick={handleCopySubjects}
              disabled={!copySourceClass || copying}
              className="bg-[#041633] hover:bg-[#06204d] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shadow"
            >
              {copying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Copying...</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Copy to {selectedClass}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Subjects Table & Add Row */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800">
              Curriculum for <span className="text-[#ffa000]">{selectedClass}</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
              {subjects.length} Subjects
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              Total Marks: {totalMaxMarksSum}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchSubjects(selectedClass)}
              disabled={loading}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleSaveSubjects}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-lg flex items-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Subjects</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Subject Name</th>
                <th className="py-3 px-4 w-36 text-center">Total Marks</th>
                <th className="py-3 px-4 w-36 text-center">Passing Marks</th>
                <th className="py-3 px-4 w-28 text-center">Pass Ratio</th>
                <th className="py-3 px-4 w-20 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading curriculum for {selectedClass}...</span>
                  </td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-slate-600">No subjects configured for {selectedClass} yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Add subjects below or copy them from another class.
                    </p>
                  </td>
                </tr>
              ) : (
                subjects.map((sub, idx) => {
                  const passPct = sub.totalMarks > 0 ? Math.round((sub.passingMarks / sub.totalMarks) * 100) : 40;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={sub.subjectName}
                          onChange={(e) => handleSubjectChange(idx, 'subjectName', e.target.value)}
                          className="w-full bg-white border border-slate-300 font-bold text-slate-800 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          value={sub.totalMarks}
                          onChange={(e) => handleSubjectChange(idx, 'totalMarks', Number(e.target.value))}
                          min="1"
                          className="w-24 bg-white border border-slate-300 font-bold text-slate-800 text-xs rounded-md px-2 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          value={sub.passingMarks}
                          onChange={(e) => handleSubjectChange(idx, 'passingMarks', Number(e.target.value))}
                          min="1"
                          className="w-24 bg-white border border-slate-300 font-bold text-slate-800 text-xs rounded-md px-2 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-1 bg-slate-100 rounded text-slate-600 font-semibold">
                          {passPct}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveSubject(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Remove subject"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Quick Add Subject Form at bottom of table */}
        <div className="bg-slate-50 border-t border-slate-200 p-4">
          <form onSubmit={handleAddSubject} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <input
                type="text"
                placeholder="Enter new subject name (e.g. Physics, Pak Studies, Drawing)..."
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="w-full sm:w-32">
              <input
                type="number"
                placeholder="Total Marks"
                value={newTotalMarks}
                onChange={(e) => setNewTotalMarks(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs rounded-lg px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                title="Total Marks"
              />
            </div>

            <div className="w-full sm:w-32">
              <input
                type="number"
                placeholder="Pass Marks"
                value={newPassingMarks}
                onChange={(e) => setNewPassingMarks(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs rounded-lg px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                title="Passing Marks"
              />
            </div>

            <button
              type="submit"
              disabled={!newSubjectName.trim()}
              className="w-full sm:w-auto bg-[#041633] hover:bg-[#06204d] text-[#ffa000] font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subject</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
