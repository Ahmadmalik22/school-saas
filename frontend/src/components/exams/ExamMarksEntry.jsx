import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../context/AcademicClassesContext';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import {
  FileSpreadsheet,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trophy,
  Users,
  Award,
  Search,
  Check,
  UserCheck,
} from 'lucide-react';

export default function ExamMarksEntry({ schoolCode }) {
  const { classes } = useAcademicClasses();
  const classList = classes && classes.length > 0
    ? classes.map((c) => c.name || c)
    : ['Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('Mid Term');
  const [selectedClass, setSelectedClass] = useState(classList[0] || 'Class 1');
  const [selectedSection, setSelectedSection] = useState('A');
  const { currentSession: academicSession } = useAcademicSession();

  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Matrix cell refs for keyboard navigation (grid: rowIndex_colIndex)
  const cellRefs = useRef({});

  // 1. Fetch Exam Terms
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await api.get('/exams/terms', {
          params: { schoolCode, academicSession }
        });
        if (res.data?.success && res.data.data?.length > 0) {
          setTerms(res.data.data);
          if (!selectedTerm || !res.data.data.some((t) => t.name === selectedTerm)) {
            setSelectedTerm(res.data.data[0].name);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchTerms();
  }, [schoolCode, academicSession]);

  // 2. Fetch Marks Sheet
  const fetchMarksSheet = async () => {
    if (!selectedClass || !selectedTerm || !selectedSection) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.get('/exams/marks-sheet', {
        params: {
          schoolCode,
          termName: selectedTerm,
          className: selectedClass,
          section: selectedSection,
          academicSession,
        }
      });
      if (res.data?.success) {
        setSubjects(res.data.subjects || []);
        // Process students with live grade/rank calculation
        const processed = recalculateTotalsAndRanks(res.data.data || []);
        setStudents(processed);
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to load marks sheet.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Error connecting to exam marks server.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarksSheet();
  }, [selectedClass, selectedTerm, selectedSection, schoolCode, academicSession]);

  // Helper: Recalculate totals, percentage, grade and ranks dynamically
  const recalculateTotalsAndRanks = (studList) => {
    const computeGrade = (pct) => {
      if (pct >= 80) return 'A+';
      if (pct >= 70) return 'A';
      if (pct >= 60) return 'B';
      if (pct >= 50) return 'C';
      if (pct >= 40) return 'D';
      return 'F';
    };

    const calculated = studList.map((st) => {
      let maxMarks = 0;
      let obtainedMarks = 0;
      let failedCount = 0;

      const updatedSubMarks = (st.subjectMarks || []).map((sm) => {
        const tot = Number(sm.totalMarks) || 100;
        const obt = sm.isAbsent ? 0 : Number(sm.obtainedMarks) || 0;
        const pass = Number(sm.passingMarks) || 40;
        const isFail = obt < pass && !sm.isAbsent;

        if (isFail) failedCount++;
        maxMarks += tot;
        obtainedMarks += obt;

        return {
          ...sm,
          obtainedMarks: obt,
          remarks: sm.isAbsent ? 'Absent' : isFail ? 'Fail' : 'Pass',
        };
      });

      const percentage = maxMarks > 0 ? Number(((obtainedMarks / maxMarks) * 100).toFixed(2)) : 0;
      const grade = computeGrade(percentage);
      const isPassed = failedCount === 0;

      return {
        ...st,
        subjectMarks: updatedSubMarks,
        totalMaxMarks: maxMarks,
        totalObtainedMarks: obtainedMarks,
        percentage,
        grade,
        isPassed,
      };
    });

    // Compute live class rank
    const sorted = [...calculated].sort((a, b) => b.percentage - a.percentage);
    const rankMap = new Map();
    let currentRank = 1;

    sorted.forEach((item, index) => {
      if (index > 0 && item.percentage < sorted[index - 1].percentage) {
        currentRank = index + 1;
      }
      rankMap.set(String(item.studentId), currentRank);
    });

    return calculated.map((st) => ({
      ...st,
      classRank: rankMap.get(String(st.studentId)) || 1,
    }));
  };

  // Handle cell input change
  const handleMarksChange = (studentIndex, subjectIndex, value) => {
    const updated = [...students];
    const sub = updated[studentIndex].subjectMarks[subjectIndex];

    if (value === 'a' || value === 'A') {
      sub.isAbsent = true;
      sub.obtainedMarks = 0;
    } else {
      sub.isAbsent = false;
      const numVal = value === '' ? '' : Math.max(0, Math.min(Number(value), sub.totalMarks));
      sub.obtainedMarks = numVal;
    }

    const recomputed = recalculateTotalsAndRanks(updated);
    setStudents(recomputed);
  };

  // Keyboard Navigation: Excel/Spreadsheet Arrow Keys & Enter Key
  const handleKeyDown = (e, rowIdx, colIdx) => {
    const totalRows = students.length;
    const totalCols = subjects.length;

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const nextRow = Math.min(rowIdx + 1, totalRows - 1);
      const key = `${nextRow}_${colIdx}`;
      if (cellRefs.current[key]) cellRefs.current[key].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRow = Math.max(rowIdx - 1, 0);
      const key = `${prevRow}_${colIdx}`;
      if (cellRefs.current[key]) cellRefs.current[key].focus();
    } else if (e.key === 'ArrowRight') {
      if (colIdx < totalCols - 1) {
        const nextCol = colIdx + 1;
        const key = `${rowIdx}_${nextCol}`;
        if (cellRefs.current[key]) cellRefs.current[key].focus();
      }
    } else if (e.key === 'ArrowLeft') {
      if (colIdx > 0) {
        const prevCol = colIdx - 1;
        const key = `${rowIdx}_${prevCol}`;
        if (cellRefs.current[key]) cellRefs.current[key].focus();
      }
    }
  };

  // Save all class marks
  const handleSaveMarks = async () => {
    if (students.length === 0) {
      setMessage({ type: 'error', text: 'No students enrolled to save.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await api.post('/exams/marks-sheet', {
        schoolCode,
        termName: selectedTerm,
        className: selectedClass,
        section: selectedSection,
        academicSession,
        records: students,
      });

      if (res.data?.success) {
        setMessage({
          type: 'success',
          text: `Marks for Class ${selectedClass}-${selectedSection} saved successfully!`,
        });
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to save marks.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Network error while saving marks.' });
    } finally {
      setSaving(false);
    }
  };

  // Computed class metrics
  const passedStudentsCount = students.filter((s) => s.isPassed).length;
  const averagePercentage = students.length > 0
    ? (students.reduce((acc, s) => acc + s.percentage, 0) / students.length).toFixed(1)
    : 0;
  const highestPercentage = students.length > 0
    ? Math.max(...students.map((s) => s.percentage)).toFixed(1)
    : 0;

  const filteredStudents = students.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      s.studentName?.toLowerCase().includes(q) ||
      s.rollNumber?.toLowerCase().includes(q) ||
      s.fatherName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Controls Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-amber-500" />
              Spreadsheet Marks Entry Sheet
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Rapid grid-style marks entry with keyboard shortcuts (Arrow / Enter / Tab keys). Instant auto-ranking and grade generation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchMarksSheet}
              disabled={loading}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleSaveMarks}
              disabled={saving || students.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2 rounded-lg flex items-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Marks...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Class Marks</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {/* Term Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Exam Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {terms.map((t) => (
                <option key={t._id || t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {classList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Section Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {['A', 'B', 'C', 'D'].map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>

          {/* Student Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Quick Search Student</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by name or roll..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
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

      {/* Live Class Performance KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold uppercase">Total Students</p>
            <p className="text-lg font-black text-slate-800">{students.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold uppercase">Passing Students</p>
            <p className="text-lg font-black text-emerald-600">
              {passedStudentsCount} / {students.length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold uppercase">Class Average</p>
            <p className="text-lg font-black text-amber-600">{averagePercentage}%</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold uppercase">Top Score</p>
            <p className="text-lg font-black text-purple-600">{highestPercentage}%</p>
          </div>
        </div>
      </div>

      {/* Keyboard navigation helper pill */}
      <div className="bg-slate-800 text-slate-200 px-4 py-2 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-slate-700 font-mono text-[10px] text-amber-400">
            Navigation Tip
          </span>
          Type marks and press <strong className="text-white">Enter</strong> or{' '}
          <strong className="text-white">Arrow Down</strong> to jump to next student. Type{' '}
          <strong className="text-amber-300">A</strong> for Absent.
        </span>
        <span className="text-[11px] text-slate-400">
          Showing {filteredStudents.length} students • {subjects.length} subjects
        </span>
      </div>

      {/* Spreadsheet Marks Matrix */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-3 w-12 text-center sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                  Roll
                </th>
                <th className="py-3 px-4 min-w-[160px] sticky left-12 bg-slate-100 z-10 border-r border-slate-200">
                  Student Name
                </th>

                {/* Subject Columns */}
                {subjects.map((sub, sIdx) => (
                  <th
                    key={sIdx}
                    className="py-3 px-3 text-center min-w-[110px] border-r border-slate-200"
                  >
                    <div className="font-bold text-slate-800">{sub.subjectName}</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Max: {sub.totalMarks} | Pass: {sub.passingMarks}
                    </div>
                  </th>
                ))}

                {/* Auto summary headers */}
                <th className="py-3 px-3 text-center w-28 bg-amber-50/50 border-r border-slate-200">
                  Total Marks
                </th>
                <th className="py-3 px-3 text-center w-20 bg-amber-50/50 border-r border-slate-200">
                  %
                </th>
                <th className="py-3 px-3 text-center w-20 bg-amber-50/50 border-r border-slate-200">
                  Grade
                </th>
                <th className="py-3 px-3 text-center w-20 bg-amber-50/50 border-r border-slate-200">
                  Rank
                </th>
                <th className="py-3 px-4 min-w-[140px] text-center bg-amber-50/50">
                  Teacher Remarks
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td
                    colSpan={subjects.length + 7}
                    className="py-16 text-center text-slate-400"
                  >
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading class students and marks sheet...</span>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={subjects.length + 7}
                    className="py-16 text-center text-slate-400"
                  >
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-slate-600">
                      No active students found in {selectedClass} Section {selectedSection}.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Check your admissions directory or select another class/section.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stud, rowIdx) => {
                  const studentActualIdx = students.findIndex((s) => s.studentId === stud.studentId);
                  const isFirstThree = stud.classRank <= 3;

                  return (
                    <tr
                      key={stud.studentId}
                      className={`hover:bg-amber-50/20 transition-colors ${
                        !stud.isPassed ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Roll No */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 sticky left-0 bg-white border-r border-slate-200">
                        {stud.rollNumber || rowIdx + 1}
                      </td>

                      {/* Student Name */}
                      <td className="py-2.5 px-4 sticky left-12 bg-white border-r border-slate-200">
                        <div className="font-bold text-slate-900 truncate">{stud.studentName}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          S/D of {stud.fatherName || 'Guardian'}
                        </div>
                      </td>

                      {/* Subject Mark Input Cells */}
                      {stud.subjectMarks.map((sm, colIdx) => {
                        const cellKey = `${rowIdx}_${colIdx}`;
                        const isFailing = !sm.isAbsent && sm.obtainedMarks < sm.passingMarks;

                        return (
                          <td
                            key={colIdx}
                            className={`py-2 px-2 text-center border-r border-slate-200 ${
                              sm.isAbsent
                                ? 'bg-amber-100/60'
                                : isFailing
                                ? 'bg-rose-100/50'
                                : ''
                            }`}
                          >
                            <input
                              ref={(el) => (cellRefs.current[cellKey] = el)}
                              type="text"
                              value={sm.isAbsent ? 'A' : sm.obtainedMarks}
                              onChange={(e) =>
                                handleMarksChange(studentActualIdx, colIdx, e.target.value)
                              }
                              onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                              className={`w-16 h-8 text-center font-bold text-xs rounded border transition focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                                sm.isAbsent
                                  ? 'border-amber-400 text-amber-900 bg-amber-50'
                                  : isFailing
                                  ? 'border-rose-400 text-rose-700 bg-rose-50'
                                  : 'border-slate-300 text-slate-800 bg-white'
                              }`}
                              title={
                                sm.isAbsent
                                  ? 'Marked as Absent'
                                  : isFailing
                                  ? `Below passing threshold (${sm.passingMarks})`
                                  : `${sm.subjectName} Marks`
                              }
                            />
                          </td>
                        );
                      })}

                      {/* Total Marks */}
                      <td className="py-2.5 px-3 text-center font-black text-slate-800 bg-amber-50/30 border-r border-slate-200">
                        {stud.totalObtainedMarks} / {stud.totalMaxMarks}
                      </td>

                      {/* Percentage */}
                      <td className="py-2.5 px-3 text-center font-black text-slate-800 bg-amber-50/30 border-r border-slate-200">
                        {stud.percentage}%
                      </td>

                      {/* Grade Badge */}
                      <td className="py-2.5 px-3 text-center bg-amber-50/30 border-r border-slate-200">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-black ${
                            stud.grade === 'A+'
                              ? 'bg-emerald-100 text-emerald-800'
                              : stud.grade === 'A'
                              ? 'bg-blue-100 text-blue-800'
                              : stud.grade === 'B'
                              ? 'bg-amber-100 text-amber-800'
                              : stud.grade === 'C'
                              ? 'bg-orange-100 text-orange-800'
                              : stud.grade === 'D'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {stud.grade}
                        </span>
                      </td>

                      {/* Rank Badge */}
                      <td className="py-2.5 px-3 text-center bg-amber-50/30 border-r border-slate-200">
                        {isFirstThree ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-xs bg-amber-400 text-slate-950 shadow-xs">
                            <Trophy className="w-3 h-3" />
                            {stud.classRank}
                          </span>
                        ) : (
                          <span className="font-bold text-slate-600">
                            {stud.classRank}th
                          </span>
                        )}
                      </td>

                      {/* Teacher Remarks */}
                      <td className="py-2 px-3 text-center bg-amber-50/30">
                        <input
                          type="text"
                          value={stud.teacherRemarks || (stud.isPassed ? 'Promoted' : 'Needs Improvement')}
                          onChange={(e) => {
                            const updated = [...students];
                            updated[studentActualIdx].teacherRemarks = e.target.value;
                            setStudents(updated);
                          }}
                          className="w-full bg-white border border-slate-300 text-slate-800 text-[11px] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
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
