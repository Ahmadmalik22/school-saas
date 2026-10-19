import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../context/AcademicClassesContext';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import ExcelJS from 'exceljs';
import {
  FileText,
  Receipt,
  TrendingUp,
  Users,
  CalendarCheck,
  Award,
  Filter,
  Download,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  School,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export default function ReportingCenter({ schoolCode }) {
  const { classes } = useAcademicClasses();
  const { currentSession, sessions } = useAcademicSession();

  const classList = useMemo(() => {
    return classes && classes.length > 0
      ? classes.map((c) => c.name || c)
      : ['Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
  }, [classes]);

  // Active Report Tab: 'fee' | 'financial' | 'enrollment' | 'attendance' | 'exam'
  const [activeTab, setActiveTab] = useState('fee');

  // Filter Parameters
  const [selectedSession, setSelectedSession] = useState(currentSession || '2025-2026');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [monthYear, setMonthYear] = useState('ALL');

  // Sub-filters
  const [feeStatus, setFeeStatus] = useState('ALL'); // ALL, PAID, PARTIALLY_PAID, UNPAID
  const [examTerm, setExamTerm] = useState('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState('ALL'); // ALL, CHRONIC_ABSENT
  const [expenseCategory, setExpenseCategory] = useState('ALL');

  // Data & State
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [tableSearch, setTableSearch] = useState('');
  const [termsList, setTermsList] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [schoolProfile, setSchoolProfile] = useState({
    schoolName: '',
    address: '',
    affiliation: '',
  });

  // Keep session in sync with global context default
  useEffect(() => {
    if (currentSession) setSelectedSession(currentSession);
  }, [currentSession]);

  // Fetch School Profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/school-profile', { params: { schoolCode } });
        if (res.data?.success && res.data.data) {
          setSchoolProfile(res.data.data);
        }
      } catch (e) {
        console.warn(e);
      }
    };
    fetchProfile();
  }, [schoolCode]);

  // Fetch Exam Terms for filters
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await api.get('/exams/terms', {
          params: { schoolCode, academicSession: selectedSession },
        });
        if (res.data?.success) setTermsList(res.data.data || []);
      } catch (e) {
        console.warn(e);
      }
    };
    fetchTerms();
  }, [schoolCode, selectedSession]);

  // Fetch Expense Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/expenses/categories', { params: { schoolCode } });
        if (res.data?.success) setExpenseCategories(res.data.data || []);
      } catch (e) {
        console.warn(e);
      }
    };
    fetchCategories();
  }, [schoolCode]);

  // Fetch Report Data based on active tab and filters
  const fetchReport = async () => {
    setLoading(true);
    setReportData(null);

    try {
      let endpoint = '';
      const params = {
        schoolCode,
        academicSession: selectedSession,
        className: selectedClass,
        section: selectedSection,
      };

      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (monthYear !== 'ALL') params.monthYear = monthYear;

      if (activeTab === 'fee') {
        endpoint = '/reports/fee-collection';
        if (feeStatus !== 'ALL') params.status = feeStatus;
      } else if (activeTab === 'financial') {
        endpoint = '/reports/financial-summary';
        if (expenseCategory !== 'ALL') params.categoryId = expenseCategory;
      } else if (activeTab === 'enrollment') {
        endpoint = '/reports/student-enrollment';
      } else if (activeTab === 'attendance') {
        endpoint = '/reports/attendance-summary';
      } else if (activeTab === 'exam') {
        endpoint = '/reports/exam-performance';
        if (examTerm !== 'ALL') params.termName = examTerm;
      }

      const res = await api.get(endpoint, { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, selectedSession, selectedClass, selectedSection, feeStatus, examTerm, expenseCategory]);

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedClass('ALL');
    setSelectedSection('ALL');
    setFromDate('');
    setToDate('');
    setMonthYear('ALL');
    setFeeStatus('ALL');
    setExamTerm('ALL');
    setExpenseCategory('ALL');
    setAttendanceFilter('ALL');
    setTableSearch('');
  };

  // Export Report to Excel using exceljs
  const handleExportExcel = async () => {
    if (!reportData) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // School Header Row
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = `${schoolProfile.schoolName || 'EduNexus Model School'} - Official Report`;
    worksheet.getCell('A1').font = { size: 14, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Subheader
    worksheet.mergeCells('A2:G2');
    worksheet.getCell('A2').value = `Generated on ${new Date().toLocaleString()} | Session: ${selectedSession} | Filter: Class ${selectedClass}, Sec ${selectedSection}`;
    worksheet.getCell('A2').font = { size: 10, italic: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Blank row

    if (activeTab === 'fee') {
      worksheet.addRow(['Voucher #', 'Student Name', 'Father Name', 'Class-Sec', 'Roll No', 'Month', 'Due Date', 'Billed (PKR)', 'Paid (PKR)', 'Balance (PKR)', 'Status']);
      (reportData.data || []).forEach((v) => {
        worksheet.addRow([
          v.voucherNo,
          v.studentName,
          v.fatherName,
          `${v.className}-${v.section}`,
          v.rollNumber,
          v.monthYear,
          v.dueDate ? new Date(v.dueDate).toLocaleDateString() : '',
          v.totalPayableWithinDueDate,
          v.paidAmount,
          v.balance,
          v.status,
        ]);
      });
    } else if (activeTab === 'financial') {
      worksheet.addRow(['Voucher #', 'Date', 'Category', 'Expense Description / Remarks', 'Amount (PKR)', 'Recorded By']);
      (reportData.expenses || []).forEach((e) => {
        worksheet.addRow([
          e.voucherNo,
          e.dateString || (e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : ''),
          e.categoryName,
          e.remarks,
          e.amount,
          e.recordedBy,
        ]);
      });
    } else if (activeTab === 'enrollment') {
      worksheet.addRow(['Admission #', 'Roll No', 'Student Full Name', 'Father Name', 'Class', 'Sec', 'Gender', 'Admission Date', 'Contact Phone']);
      (reportData.data || []).forEach((s) => {
        worksheet.addRow([
          s.admissionNumber,
          s.rollNumber,
          s.fullName,
          s.fatherName,
          s.className,
          s.section,
          s.gender,
          s.admissionDate ? new Date(s.admissionDate).toLocaleDateString() : '',
          s.fatherPhone || s.emergencyContact || '',
        ]);
      });
    } else if (activeTab === 'attendance') {
      worksheet.addRow(['Admission #', 'Roll No', 'Student Name', 'Class-Sec', 'Total Working Days', 'Present Days', 'Absent Days', 'Leave Days', 'Attendance %', 'Status']);
      (reportData.data || []).forEach((a) => {
        worksheet.addRow([
          a.admissionNumber,
          a.rollNumber,
          a.studentName,
          `${a.className}-${a.section}`,
          a.totalDays,
          a.presentDays,
          a.absentDays,
          a.leaveDays,
          `${a.attendancePercent}%`,
          a.isChronicAbsent ? 'CHRONIC ABSENT' : 'REGULAR',
        ]);
      });
    } else if (activeTab === 'exam') {
      worksheet.addRow(['Rank / Position', 'Roll No', 'Student Name', 'Father Name', 'Class-Sec', 'Exam Term', 'Obtained Marks', 'Total Marks', 'Percentage', 'Grade', 'Result']);
      (reportData.meritList || []).forEach((m) => {
        worksheet.addRow([
          m.rank,
          m.rollNumber,
          m.studentName,
          m.fatherName,
          `${m.className}-${m.section}`,
          m.termName,
          m.grandTotalObtained,
          m.grandTotalMax,
          `${m.overallPercentage}%`,
          m.overallGrade,
          m.isPass ? 'PROMOTED / PASSED' : 'FAILED',
        ]);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab.toUpperCase()}_Report_${selectedSession}_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#ffa000]" />
              <span>School Reporting Center</span>
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportExcel}
              disabled={loading || !reportData}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
              title="Download Excel Spreadsheet"
            >
              <Download className="w-4 h-4" />
              <span>Export to Excel (.xlsx)</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={loading || !reportData}
              className="text-xs bg-[#041633] hover:bg-[#06204d] text-[#ffa000] font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
              title="Print Official Document"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official Report</span>
            </button>
          </div>
        </div>

        {/* 2. Top 5 Core Reports Tab Switcher */}
        <div className="flex flex-wrap gap-2 mt-5 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('fee')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'fee'
                ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Fee Collection & Defaulters</span>
          </button>

          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'financial'
                ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>2. Cash Flow & Expenses (P&L)</span>
          </button>

          <button
            onClick={() => setActiveTab('enrollment')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'enrollment'
                ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. Student Enrollment & Strength</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>4. Attendance & Absenteeism</span>
          </button>

          <button
            onClick={() => setActiveTab('exam')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'exam'
                ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>5. Exam Results & Merit Positions</span>
          </button>
        </div>

        {/* 3. Universal Filters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-4 text-xs">
          {/* Academic Session */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Academic Session</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              {sessions.map((s) => (
                <option key={s._id} value={s.sessionName}>
                  {s.sessionName} {s.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Classes</option>
              {classList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Sections</option>
              {['A', 'B', 'C', 'D'].map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-medium text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-medium text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Tab-Specific Secondary Parameter */}
          {activeTab === 'fee' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Fee Status</label>
              <select
                value={feeStatus}
                onChange={(e) => setFeeStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
              >
                <option value="ALL">All Vouchers</option>
                <option value="PAID">Paid Only</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="UNPAID">Unpaid / Defaulters</option>
              </select>
            </div>
          )}

          {activeTab === 'financial' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Expense Category</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
              >
                <option value="ALL">All Categories</option>
                {expenseCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'exam' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Exam Term</label>
              <select
                value={examTerm}
                onChange={(e) => setExamTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
              >
                <option value="ALL">All Terms</option>
                {termsList.map((t) => (
                  <option key={t._id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Attendance Filter</label>
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
              >
                <option value="ALL">All Students</option>
                <option value="CHRONIC_ABSENT">Chronic Absentees (&lt; 75%)</option>
              </select>
            </div>
          )}

          {activeTab === 'enrollment' && (
            <div className="flex items-end">
              <button
                onClick={handleResetFilters}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 rounded-lg border border-slate-300 transition cursor-pointer"
              >
                Reset All
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">
            Active Filter: <strong className="text-slate-800">Session {selectedSession}</strong> •{' '}
            <strong className="text-slate-800">{selectedClass === 'ALL' ? 'All Classes' : selectedClass}</strong> •{' '}
            <strong className="text-slate-800">{selectedSection === 'ALL' ? 'All Sections' : `Sec ${selectedSection}`}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="text-xs text-slate-600 hover:text-slate-900 underline font-semibold px-2 cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="text-xs bg-[#041633] hover:bg-[#06204d] text-[#ffa000] font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Apply & Generate Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Print-Only Official Letterhead Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <div className="text-center">
          <h1 className="text-2xl font-black uppercase text-slate-900">{schoolProfile.schoolName}</h1>
          <p className="text-xs font-bold text-slate-700 uppercase">{schoolProfile.address}</p>
          {schoolProfile.affiliation && (
            <p className="text-[10px] text-slate-600 uppercase font-semibold">{schoolProfile.affiliation}</p>
          )}
          <div className="mt-2 inline-block border-b-2 border-slate-900 pb-1">
            <h2 className="text-base font-black uppercase text-slate-900">
              {activeTab === 'fee' && 'STUDENT FEE COLLECTION & DEFAULTERS REPORT'}
              {activeTab === 'financial' && 'SCHOOL CASH FLOW & FINANCIAL STATEMENT (P&L)'}
              {activeTab === 'enrollment' && 'STUDENT ENROLLMENT & DEMOGRAPHIC STRENGTH REPORT'}
              {activeTab === 'attendance' && 'STUDENT ATTENDANCE & CHRONIC ABSENTEEISM REPORT'}
              {activeTab === 'exam' && 'EXAMINATION MERIT POSITIONS & PERFORMANCE REPORT'}
            </h2>
          </div>
          <div className="text-[10px] text-slate-500 font-semibold mt-1">
            Session: {selectedSession} | Class: {selectedClass} | Section: {selectedSection} | Generated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* 5. Summary KPI Strip */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#ffa000]" />
          <p className="font-semibold text-slate-700 text-sm">Aggregating report metrics from database...</p>
        </div>
      ) : !reportData ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="font-semibold text-slate-600 text-sm">No report data generated yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: FEE SUMMARY */}
          {activeTab === 'fee' && reportData.summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Total Billed</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  Rs. {reportData.summary.totalInvoiced?.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">{reportData.summary.totalVouchers} Vouchers</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/20">
                <span className="text-[11px] font-bold uppercase text-emerald-700 block">Total Collected</span>
                <span className="text-xl font-black text-emerald-700 mt-1 block">
                  Rs. {reportData.summary.totalCollected?.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                  {reportData.summary.collectionRate}% Collection Rate
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-rose-200 bg-rose-50/20">
                <span className="text-[11px] font-bold uppercase text-rose-700 block">Outstanding Arrears</span>
                <span className="text-xl font-black text-rose-700 mt-1 block">
                  Rs. {reportData.summary.totalBalance?.toLocaleString()}
                </span>
                <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">Pending Dues</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-200 bg-amber-50/20">
                <span className="text-[11px] font-bold uppercase text-amber-800 block">Defaulter Students</span>
                <span className="text-xl font-black text-amber-900 mt-1 block">
                  {reportData.summary.defaultersCount}
                </span>
                <span className="text-[10px] text-amber-700 mt-0.5 block">Unpaid / Partial Count</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Fully Paid Vouchers</span>
                <span className="text-xl font-black text-emerald-600 mt-1 block">
                  {reportData.summary.paidCount}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Clear Slips</span>
              </div>
            </div>
          )}

          {/* TAB 2: FINANCIAL P&L SUMMARY */}
          {activeTab === 'financial' && reportData.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/30">
                <span className="text-[11px] font-bold uppercase text-emerald-800 flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  Fee Income (Cash In)
                </span>
                <span className="text-xl font-black text-emerald-700 mt-1 block">
                  Rs. {reportData.summary.totalFeeIncome?.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-600 mt-0.5 block">
                  {reportData.summary.totalFeeTransactions} Collected Payments
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-rose-200 bg-rose-50/30">
                <span className="text-[11px] font-bold uppercase text-rose-800 flex items-center gap-1">
                  <ArrowDownRight className="w-4 h-4 text-rose-600" />
                  Operating Expenses
                </span>
                <span className="text-xl font-black text-rose-700 mt-1 block">
                  Rs. {reportData.summary.totalExpenses?.toLocaleString()}
                </span>
                <span className="text-[10px] text-rose-600 mt-0.5 block">
                  {reportData.summary.totalExpenseTransactions} Expense Entries
                </span>
              </div>

              <div
                className={`p-4 rounded-xl shadow-sm border ${
                  reportData.summary.isProfitable
                    ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950'
                    : 'border-rose-300 bg-rose-50/40 text-rose-950'
                }`}
              >
                <span className="text-[11px] font-bold uppercase block">
                  {reportData.summary.isProfitable ? 'Net Operating Profit' : 'Net Operating Deficit / Loss'}
                </span>
                <span className="text-xl font-black mt-1 block">
                  Rs. {Math.abs(reportData.summary.netOperatingBalance)?.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold mt-0.5 block">
                  {reportData.summary.isProfitable ? 'Positive Surplus' : 'Expenses exceed income'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Expense Categories</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {reportData.categoryBreakdown?.length || 0}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Active Cost Centers</span>
              </div>
            </div>
          )}

          {/* TAB 3: ENROLLMENT SUMMARY */}
          {activeTab === 'enrollment' && reportData.summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Total Enrollment</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {reportData.summary.totalStudents}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Active Students</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 bg-blue-50/20">
                <span className="text-[11px] font-bold uppercase text-blue-700 block">Boys (Male)</span>
                <span className="text-xl font-black text-blue-800 mt-1 block">
                  {reportData.summary.maleCount}
                </span>
                <span className="text-[10px] text-blue-600 font-bold mt-0.5 block">
                  {reportData.summary.malePercentage}% of Total
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-200 bg-pink-50/20">
                <span className="text-[11px] font-bold uppercase text-pink-700 block">Girls (Female)</span>
                <span className="text-xl font-black text-pink-800 mt-1 block">
                  {reportData.summary.femaleCount}
                </span>
                <span className="text-[10px] text-pink-600 font-bold mt-0.5 block">
                  {reportData.summary.femalePercentage}% of Total
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Active Classes</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {reportData.summary.totalClassesRepresented}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Enrolled Classes</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Class Average</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {reportData.summary.totalClassesRepresented > 0
                    ? Math.round(reportData.summary.totalStudents / reportData.summary.totalClassesRepresented)
                    : 0}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Students / Class</span>
              </div>
            </div>
          )}

          {/* TAB 4: ATTENDANCE SUMMARY */}
          {activeTab === 'attendance' && reportData.summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Analyzed Students</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {reportData.summary.totalStudentsAnalyzed}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">In Selected Period</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/20">
                <span className="text-[11px] font-bold uppercase text-emerald-800 block">Attendance Rate</span>
                <span className="text-xl font-black text-emerald-700 mt-1 block">
                  {reportData.summary.overallAttendanceRate}%
                </span>
                <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">Average Presence</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Total Presents</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {reportData.summary.totalPresentOverall}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Headcount</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-rose-200 bg-rose-50/20">
                <span className="text-[11px] font-bold uppercase text-rose-700 block">Chronic Absentees</span>
                <span className="text-xl font-black text-rose-700 mt-1 block">
                  {reportData.summary.chronicAbsenteesCount}
                </span>
                <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">Below 75% Threshold</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Daily Register Sheets</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {reportData.summary.totalSheets}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Submitted Sheets</span>
              </div>
            </div>
          )}

          {/* TAB 5: EXAM SUMMARY */}
          {activeTab === 'exam' && reportData.summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Candidates</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {reportData.summary.totalStudents}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Appeared in Exam</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/20">
                <span className="text-[11px] font-bold uppercase text-emerald-800 block">Class Pass Rate</span>
                <span className="text-xl font-black text-emerald-700 mt-1 block">
                  {reportData.summary.passRate}%
                </span>
                <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                  {reportData.summary.passCount} Passed / {reportData.summary.failCount} Failed
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-200 bg-amber-50/20">
                <span className="text-[11px] font-bold uppercase text-amber-800 block">Top Score</span>
                <span className="text-xl font-black text-amber-900 mt-1 block">
                  {reportData.summary.highestScore}
                </span>
                <span className="text-[10px] text-amber-700 font-bold mt-0.5 block">1st Merit Position</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Class Average</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {reportData.summary.classAverage}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Average Marks</span>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Subjects Tested</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {reportData.subjectBreakdown?.length || 0}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Curriculum Courses</span>
              </div>
            </div>
          )}

          {/* 6. Detailed Data Table Container */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 print:hidden">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-900">
                  {activeTab === 'fee' && 'Fee Vouchers & Defaulters Register'}
                  {activeTab === 'financial' && 'Expense Vouchers & Category Cost Distribution'}
                  {activeTab === 'enrollment' && 'Student Enrollment Roster & Class Strength'}
                  {activeTab === 'attendance' && 'Student Attendance Summary Ledger'}
                  {activeTab === 'exam' && 'Exam Merit Roster & Position Holders'}
                </span>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* TAB 1: FEE TABLE */}
            {activeTab === 'fee' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Voucher #</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Class-Sec</th>
                      <th className="py-3 px-4">Month</th>
                      <th className="py-3 px-4 text-right">Billed (PKR)</th>
                      <th className="py-3 px-4 text-right">Paid (PKR)</th>
                      <th className="py-3 px-4 text-right">Balance (PKR)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(reportData.data || [])
                      .filter((v) =>
                        !tableSearch ||
                        v.studentName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        v.voucherNo?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        v.rollNumber?.toLowerCase().includes(tableSearch.toLowerCase())
                      )
                      .map((v, idx) => (
                        <tr key={v._id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{v.voucherNo}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div>{v.studentName}</div>
                            <div className="text-[10px] text-slate-400 font-normal">S/O {v.fatherName}</div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {v.className}-{v.section} (R: {v.rollNumber})
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-600">{v.monthYear}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800">
                            Rs. {v.totalPayableWithinDueDate?.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">
                            Rs. {v.paidAmount?.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-600">
                            Rs. {v.balance?.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                v.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : v.status === 'PARTIALLY_PAID'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {v.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: FINANCIAL EXPENSE TABLE */}
            {activeTab === 'financial' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Voucher #</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Description / Remarks</th>
                      <th className="py-3 px-4 text-right">Amount (PKR)</th>
                      <th className="py-3 px-4 text-center">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(reportData.expenses || [])
                      .filter((e) =>
                        !tableSearch ||
                        e.categoryName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        e.remarks?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        e.voucherNo?.toLowerCase().includes(tableSearch.toLowerCase())
                      )
                      .map((e, idx) => (
                        <tr key={e._id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{e.voucherNo}</td>
                          <td className="py-3 px-4 font-medium text-slate-600">{e.dateString}</td>
                          <td className="py-3 px-4 font-bold text-[#ffa000]">{e.categoryName}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">{e.remarks}</td>
                          <td className="py-3 px-4 text-right font-black text-rose-600">
                            Rs. {e.amount?.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-500">
                            {e.recordedBy || 'Accountant'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: ENROLLMENT TABLE */}
            {activeTab === 'enrollment' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Admission #</th>
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Father Name</th>
                      <th className="py-3 px-4">Class-Sec</th>
                      <th className="py-3 px-4 text-center">Gender</th>
                      <th className="py-3 px-4">Admission Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(reportData.data || [])
                      .filter((s) =>
                        !tableSearch ||
                        s.fullName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        s.admissionNumber?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        s.fatherName?.toLowerCase().includes(tableSearch.toLowerCase())
                      )
                      .map((s, idx) => (
                        <tr key={s._id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{s.admissionNumber}</td>
                          <td className="py-3 px-4 font-bold text-slate-600">{s.rollNumber || '—'}</td>
                          <td className="py-3 px-4 font-black text-slate-900">{s.fullName}</td>
                          <td className="py-3 px-4 font-medium text-slate-700">{s.fatherName}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{s.className}-{s.section}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.gender === 'FEMALE' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {s.gender}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-medium">
                            {s.admissionDate ? new Date(s.admissionDate).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 4: ATTENDANCE TABLE */}
            {activeTab === 'attendance' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Class-Sec</th>
                      <th className="py-3 px-4 text-center">Total Working Days</th>
                      <th className="py-3 px-4 text-center">Present Days</th>
                      <th className="py-3 px-4 text-center">Absent Days</th>
                      <th className="py-3 px-4 text-center">Attendance %</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(reportData.data || [])
                      .filter((a) =>
                        attendanceFilter === 'CHRONIC_ABSENT' ? a.isChronicAbsent : true
                      )
                      .filter((a) =>
                        !tableSearch ||
                        a.studentName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        a.admissionNumber?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        a.rollNumber?.toLowerCase().includes(tableSearch.toLowerCase())
                      )
                      .map((a, idx) => (
                        <tr key={a.studentId || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-600">{a.rollNumber || '—'}</td>
                          <td className="py-3 px-4 font-black text-slate-900">{a.studentName}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{a.className}-{a.section}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">{a.totalDays}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-600">{a.presentDays}</td>
                          <td className="py-3 px-4 text-center font-bold text-rose-600">{a.absentDays}</td>
                          <td className="py-3 px-4 text-center font-black text-sm">
                            <span
                              className={
                                a.attendancePercent >= 85
                                  ? 'text-emerald-700'
                                  : a.attendancePercent >= 75
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }
                            >
                              {a.attendancePercent}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {a.isChronicAbsent ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <AlertTriangle className="w-3 h-3" /> Chronic Absent (&lt;75%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                Regular
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 5: EXAM MERIT TABLE */}
            {activeTab === 'exam' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4 w-16 text-center">Merit Rank</th>
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Class-Sec</th>
                      <th className="py-3 px-4">Term</th>
                      <th className="py-3 px-4 text-right">Obtained Marks</th>
                      <th className="py-3 px-4 text-right">Max Marks</th>
                      <th className="py-3 px-4 text-center">Percentage</th>
                      <th className="py-3 px-4 text-center">Grade</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(reportData.meritList || [])
                      .filter((m) =>
                        !tableSearch ||
                        m.studentName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        m.fatherName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        m.rollNumber?.toLowerCase().includes(tableSearch.toLowerCase())
                      )
                      .map((m) => (
                        <tr
                          key={m.studentId}
                          className={`hover:bg-slate-50 transition-colors ${
                            m.rank === 1
                              ? 'bg-amber-50/40 font-bold'
                              : m.rank === 2
                              ? 'bg-slate-50 font-semibold'
                              : m.rank === 3
                              ? 'bg-amber-50/20'
                              : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            {m.rank === 1 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-xs">
                                🥇 1st
                              </span>
                            ) : m.rank === 2 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
                                🥈 2nd
                              </span>
                            ) : m.rank === 3 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                                🥉 3rd
                              </span>
                            ) : (
                              <span className="font-bold text-slate-500">{m.rank}th</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-700">{m.rollNumber || '—'}</td>
                          <td className="py-3 px-4 font-black text-slate-900">
                            <div>{m.studentName}</div>
                            <div className="text-[10px] text-slate-400 font-normal">S/O {m.fatherName}</div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{m.className}-{m.section}</td>
                          <td className="py-3 px-4 font-bold text-amber-700">{m.termName}</td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            {m.grandTotalObtained}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-500">
                            {m.grandTotalMax}
                          </td>
                          <td className="py-3 px-4 text-center font-black text-sm text-slate-900">
                            {m.overallPercentage}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                m.overallGrade === 'F' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {m.overallGrade}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-xs font-black ${
                                m.isPass ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {m.isPass ? 'PROMOTED' : 'FAILED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Official Signatures Block (Visible in Print Only) */}
      <div className="hidden print:flex items-end justify-between pt-16 mt-8 border-t-2 border-slate-900 text-xs font-bold text-slate-900">
        <div className="text-center w-40">
          <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
          <span>Prepared By (Accountant / Incharge)</span>
        </div>

        <div className="text-center w-40">
          <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
          <span>Verified By (Vice Principal)</span>
        </div>

        <div className="text-center w-40">
          <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
          <span>Approved By ({schoolProfile.principalTitle || 'Principal'})</span>
        </div>
      </div>
    </div>
  );
}
