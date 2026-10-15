import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import confetti from 'canvas-confetti';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import {
  GraduationCap, ArrowRight, CheckSquare, Square,
  CheckCircle, AlertCircle, RefreshCw, Users, ShieldAlert
} from 'lucide-react';

export default function StudentPromotion({ schoolCode }) {
  const { classNames, getSectionsForClass } = useAcademicClasses(schoolCode);

  // Current Class & Section selection
  const [currentClass, setCurrentClass] = useState('Class 1');
  const [currentSection, setCurrentSection] = useState('A');

  // Target Promotion Parameters
  const [targetClass, setTargetClass] = useState('Class 2');
  const [targetSection, setTargetSection] = useState('A');
  const [targetSession, setTargetSession] = useState('2026-2027');

  // Auto-sync initial classes from dynamic classes
  useEffect(() => {
    if (classNames && classNames.length > 0) {
      if (!currentClass || !classNames.includes(currentClass)) {
        const first = classNames[0];
        setCurrentClass(first);
        const secs = getSectionsForClass(first);
        setCurrentSection(secs[0] || 'A');
      }
      if (!targetClass || (!classNames.includes(targetClass) && targetClass !== 'Graduated')) {
        const nextIdx = classNames.indexOf(currentClass) + 1;
        const nextClass = (nextIdx >= 0 && nextIdx < classNames.length) ? classNames[nextIdx] : (classNames[1] || 'Graduated');
        setTargetClass(nextClass);
        const nextSecs = getSectionsForClass(nextClass);
        setTargetSection(nextSecs[0] || 'A');
      }
    }
  }, [classNames]);

  // Students list in Current Class
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [toast, setToast] = useState(null);

  // Fetch Current Class Students
  const fetchCurrentClassStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/students', {
        params: {
          schoolCode,
          className: currentClass,
          section: currentSection,
          status: 'ACTIVE',
          limit: 100, // Fetch up to 100 students in section
        },
      });

      if (res.data.success) {
        const list = res.data.data;
        setStudents(list);
        // Default: Select all students for promotion
        setSelectedIds(new Set(list.map((s) => s._id)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentClassStudents();
  }, [schoolCode, currentClass, currentSection]);

  // Toggle single student selection
  const toggleStudent = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle Select All
  const toggleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s._id)));
    }
  };

  // Execute Promotion
  const handlePromote = async () => {
    if (selectedIds.size === 0) {
      setToast({ type: 'error', message: 'Please select at least one student to promote.' });
      return;
    }

    if (!window.confirm(`Are you sure you want to promote ${selectedIds.size} students from ${currentClass} to ${targetClass} (${targetSection}) for Session ${targetSession}?`)) {
      return;
    }

    setPromoting(true);
    setToast(null);

    try {
      const res = await api.post('/students/promote', {
        schoolCode,
        studentIds: Array.from(selectedIds),
        targetClass,
        targetSection,
        targetSession,
      });

      if (res.data.success) {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        setToast({ type: 'success', message: res.data.message });
        // Refresh current class (promoted students will now be in next class)
        fetchCurrentClassStudents();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Promotion failed.' });
    } finally {
      setPromoting(false);
    }
  };

  const classList = [
    'Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4',
    'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Graduated'
  ];

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-amber-500" />
            <span>Annual Student Promotions (Exam Result Transition)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bulk promote an entire batch or section to the next class and new session in 1 click for <span className="font-bold text-slate-800">{schoolCode}</span>.
          </p>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* PROMOTION CONFIGURATION CARD (From Class -> To Class) */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-600 border-b border-slate-100 pb-2">
          Promotion Route & Target Parameters
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center text-xs">
          {/* FROM CLASS */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <span className="font-bold text-slate-500 uppercase text-[10px] block">1. Promote From:</span>
            <div>
              <label className="block text-slate-600 text-[11px] mb-1">Class</label>
              <select
                value={currentClass}
                onChange={(e) => {
                  const newCls = e.target.value;
                  setCurrentClass(newCls);
                  const sections = getSectionsForClass(newCls);
                  setCurrentSection(sections[0] || 'A');
                }}
                className="w-full bg-white border border-slate-300 rounded p-1.5 font-bold"
              >
                {classNames.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 text-[11px] mb-1">Section</label>
              <select
                value={currentSection}
                onChange={(e) => setCurrentSection(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-1.5 font-bold"
              >
                {getSectionsForClass(currentClass).map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ARROW INDICATOR */}
          <div className="hidden sm:flex justify-center text-amber-500">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-200">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* TO CLASS */}
          <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200 space-y-2">
            <span className="font-bold text-emerald-800 uppercase text-[10px] block">2. Promote To:</span>
            <div>
              <label className="block text-emerald-700 text-[11px] mb-1">Next Class</label>
              <select
                value={targetClass}
                onChange={(e) => {
                  const newCls = e.target.value;
                  setTargetClass(newCls);
                  const sections = getSectionsForClass(newCls);
                  setTargetSection(sections[0] || 'A');
                }}
                className="w-full bg-white border border-emerald-300 rounded p-1.5 font-bold text-emerald-950"
              >
                {classNames.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Graduated">Graduated / Passed Out</option>
              </select>
            </div>
            <div>
              <label className="block text-emerald-700 text-[11px] mb-1">Target Section</label>
              <select
                value={targetSection}
                onChange={(e) => setTargetSection(e.target.value)}
                className="w-full bg-white border border-emerald-300 rounded p-1.5 font-bold text-emerald-950"
              >
                {getSectionsForClass(targetClass).map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TARGET ACADEMIC SESSION */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <span className="font-bold text-slate-500 uppercase text-[10px] block">3. New Academic Session:</span>
            <div>
              <label className="block text-slate-600 text-[11px] mb-1">Session Year</label>
              <select
                value={targetSession}
                onChange={(e) => setTargetSession(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-1.5 font-bold"
              >
                <option value="2026-2027">2026-2027</option>
                <option value="2027-2028">2027-2028</option>
                <option value="2025-2026">2025-2026</option>
              </select>
            </div>
          </div>

          {/* PROMOTED SUMMARY & ACTION */}
          <div className="p-3 text-center sm:text-right">
            <div className="text-[11px] font-semibold text-slate-500">Selected for Promotion:</div>
            <div className="text-2xl font-black text-slate-900 mb-2">
              {selectedIds.size} / {students.length}
            </div>
            <button
              type="button"
              onClick={handlePromote}
              disabled={promoting || selectedIds.size === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-3 rounded-lg shadow-md transition disabled:opacity-40 cursor-pointer text-xs"
            >
              {promoting ? 'Promoting...' : `Promote (${selectedIds.size}) Students`}
            </button>
          </div>
        </div>
      </div>

      {/* CANDIDATES STUDENTS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              {selectedIds.size === students.length && students.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{selectedIds.size === students.length ? 'Deselect All' : 'Select All Candidates'}</span>
            </button>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">
              Uncheck any student who failed exam or will repeat the class.
            </span>
          </div>

          <span className="font-bold text-slate-700">
            Current: {currentClass} ({currentSection})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center">Select</th>
                <th className="p-3">Photo</th>
                <th className="p-3">Roll No</th>
                <th className="p-3">Admission No</th>
                <th className="p-3">Student Name</th>
                <th className="p-3">Father Name</th>
                <th className="p-3">Contact</th>
                <th className="p-3 text-center">Current Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    {loading ? 'Fetching students...' : `No active students found in ${currentClass} (${currentSection}).`}
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const isChecked = selectedIds.has(student._id);
                  return (
                    <tr
                      key={student._id}
                      onClick={() => toggleStudent(student._id)}
                      className={`cursor-pointer transition ${
                        isChecked ? 'bg-emerald-50/30 hover:bg-emerald-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by row click
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        {student.photo?.url ? (
                          <img
                            src={student.photo.url}
                            alt={student.fullName}
                            className="w-8 h-8 rounded-full object-cover border border-amber-400"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                            {student.fullName.charAt(0)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{student.rollNumber}</td>
                      <td className="p-3 font-mono text-slate-600">{student.admissionNumber}</td>
                      <td className="p-3 font-bold text-slate-900">{student.fullName}</td>
                      <td className="p-3 text-slate-700">{student.fatherName}</td>
                      <td className="p-3 font-mono text-slate-800">{student.fatherPhone}</td>
                      <td className="p-3 text-center">
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase">
                          {student.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
