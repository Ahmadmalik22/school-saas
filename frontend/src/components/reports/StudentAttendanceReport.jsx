import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../context/AcademicClassesContext';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CalendarCheck,
  Download,
  FileDown,
  Printer,
  RefreshCw,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

export default function StudentAttendanceReport({ schoolCode }) {
  const { classes } = useAcademicClasses();
  const { currentSession, sessions } = useAcademicSession();

  const classList = useMemo(() => {
    return classes && classes.length > 0
      ? classes.map((c) => c.name || c)
      : ['Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
  }, [classes]);

  // Parameters
  const [selectedSession, setSelectedSession] = useState(currentSession || '2025-2026');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PRESENT, ABSENT, LEAVE
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // View format toggle: 'summary' or 'breakdown'
  const [viewFormat, setViewFormat] = useState('summary');

  // Data state
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState({
    schoolName: '',
    address: '',
    affiliation: '',
  });

  const reportPrintRef = useRef(null);

  useEffect(() => {
    if (currentSession) setSelectedSession(currentSession);
  }, [currentSession]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/school-profile', { params: { schoolCode } });
        if (res.data?.success && res.data.data) setSchoolProfile(res.data.data);
      } catch (e) {
        console.warn(e);
      }
    };
    fetchProfile();
  }, [schoolCode]);

  // Fetch Attendance Report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        schoolCode,
        academicSession: selectedSession,
        className: selectedClass,
        section: selectedSection,
      };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await api.get('/reports/attendance-summary', { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching attendance report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedSession, selectedClass, selectedSection]);

  const handleResetFilters = () => {
    setSelectedClass('ALL');
    setSelectedSection('ALL');
    setStatusFilter('ALL');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
  };

  // Filtered Summary List
  const filteredSummary = useMemo(() => {
    if (!reportData?.summaryList) return [];
    return reportData.summaryList.filter((s) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          s.studentName?.toLowerCase().includes(q) ||
          s.rollNumber?.toLowerCase().includes(q) ||
          s.admissionNumber?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // Filtered Detailed Breakdown
  const filteredBreakdown = useMemo(() => {
    if (!reportData?.detailedBreakdown) return [];
    return reportData.detailedBreakdown.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.studentName?.toLowerCase().includes(q) ||
          item.rollNumber?.toLowerCase().includes(q) ||
          item.admissionNumber?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [reportData, statusFilter, searchQuery]);

  // 1. Export to Excel (.xlsx) using exceljs
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Student Attendance Report');

    // School Title Header
    worksheet.mergeCells('A1:I1');
    worksheet.getCell('A1').value = `${schoolProfile.schoolName || 'School'} - Student Attendance Report`;
    worksheet.getCell('A1').font = { size: 14, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Subheader info
    worksheet.mergeCells('A2:I2');
    worksheet.getCell('A2').value = `Format: ${viewFormat === 'summary' ? 'Summarized Format' : 'Detailed Breakdown'} | Session: ${selectedSession} | Class: ${selectedClass} | Section: ${selectedSection} | Range: ${fromDate || 'Start'} to ${toDate || 'End'}`;
    worksheet.getCell('A2').font = { size: 10, italic: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Blank row

    if (viewFormat === 'summary') {
      worksheet.addRow(['#', 'Roll No', 'Student Name', 'Father Name', 'Class-Sec', 'Total Working Days', 'Present Days', 'Absent Days', 'Leave Days', 'Attendance %', 'Status']);
      filteredSummary.forEach((s, idx) => {
        worksheet.addRow([
          idx + 1,
          s.rollNumber || '—',
          s.studentName,
          s.fatherName || '—',
          `${s.className}-${s.section}`,
          s.totalDays,
          s.presentDays,
          s.absentDays,
          s.leaveDays,
          `${s.attendancePercent}%`,
          s.attendancePercent >= 75 ? 'REGULAR' : 'LOW ATTENDANCE (<75%)',
        ]);
      });
    } else {
      worksheet.addRow(['#', 'Date', 'Roll No', 'Student Name', 'Father Name', 'Class-Sec', 'Status', 'Remarks']);
      filteredBreakdown.forEach((item, idx) => {
        worksheet.addRow([
          idx + 1,
          item.date,
          item.rollNumber || '—',
          item.studentName,
          item.fatherName || '—',
          `${item.className}-${item.section}`,
          item.status,
          item.remarks || '',
        ]);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Student_Attendance_${viewFormat}_Report_${selectedSession}_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // 2. Download Official Well-Formatted PDF using jsPDF + autoTable (Vector Crisp Quality)
  const handleDownloadPdf = () => {
    setExportingPdf(true);

    try {
      // Landscape orientation provides clean, expansive columns for comprehensive reports
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;

      // School & Header Information
      const schoolName = (schoolProfile.schoolName || 'School Campus').toUpperCase();
      const address = (schoolProfile.address || '').toUpperCase();
      const affiliation = schoolProfile.affiliation ? schoolProfile.affiliation.toUpperCase() : '';
      const principalTitle = schoolProfile.principalTitle || 'Principal';

      // 1. Official Header Accent Bars
      doc.setFillColor(4, 22, 51); // Akkhor Navy #041633
      doc.rect(0, 0, pageWidth, 4, 'F');
      doc.setFillColor(255, 160, 0); // Akkhor Gold #ffa000
      doc.rect(0, 4, pageWidth, 1.5, 'F');

      let currentY = 14;

      // 2. School Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(4, 22, 51);
      doc.text(schoolName, pageWidth / 2, currentY, { align: 'center' });

      // 3. Address & Affiliation
      if (address) {
        currentY += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(address, pageWidth / 2, currentY, { align: 'center' });
      }

      if (affiliation) {
        currentY += 3.8;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Affiliated with: ${affiliation}`, pageWidth / 2, currentY, { align: 'center' });
      }

      // 4. Report Title Banner
      currentY += 5;
      doc.setDrawColor(4, 22, 51);
      doc.setLineWidth(0.4);
      doc.line(margin, currentY, pageWidth - margin, currentY);

      currentY += 4.8;
      const reportTitle =
        viewFormat === 'summary'
          ? 'STUDENT ATTENDANCE REPORT — SUMMARIZED FORMAT'
          : 'STUDENT ATTENDANCE REPORT — DETAILED BREAKDOWN';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(4, 22, 51);
      doc.text(reportTitle, pageWidth / 2, currentY, { align: 'center' });

      currentY += 2;
      doc.line(margin, currentY, pageWidth - margin, currentY);

      // 5. Filter Parameters / Metadata Summary Bar
      currentY += 4;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY - 3, pageWidth - margin * 2, 6.5, 1, 1, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      const filterItems = [
        `Session: ${selectedSession}`,
        `Class: ${selectedClass === 'ALL' ? 'All Classes' : selectedClass}`,
        `Section: ${selectedSection === 'ALL' ? 'All Sections' : selectedSection}`,
        `Date Range: ${fromDate || 'Earliest'} to ${toDate || 'Latest'}`,
        `Printed: ${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      ];
      doc.text(filterItems.join('    |    '), pageWidth / 2, currentY + 1.2, { align: 'center' });

      currentY += 6.5;

      // 6. Table Generation via autoTable
      if (viewFormat === 'summary') {
        const tableHead = [
          ['#', 'Roll No', 'Student Name', 'Father Name', 'Class-Sec', 'Total Days', 'Present', 'Absent', 'Leave', 'Att %', 'Remarks'],
        ];

        const tableBody = filteredSummary.map((s, idx) => [
          idx + 1,
          s.rollNumber || '—',
          s.studentName || '—',
          s.fatherName || '—',
          `${s.className || ''}-${s.section || ''}`,
          s.totalDays ?? 0,
          s.presentDays ?? 0,
          s.absentDays ?? 0,
          s.leaveDays ?? 0,
          `${s.attendancePercent ?? 0}%`,
          s.attendancePercent < 75 ? 'Low (<75%)' : 'Regular',
        ]);

        autoTable(doc, {
          startY: currentY,
          head: tableHead,
          body: tableBody,
          theme: 'grid',
          headStyles: {
            fillColor: [4, 22, 51],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center',
            cellPadding: 1.8,
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [30, 41, 59],
            cellPadding: 1.8,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
            2: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
            3: { halign: 'left', cellWidth: 44 },
            4: { halign: 'center', cellWidth: 22 },
            5: { halign: 'center', cellWidth: 22 },
            6: { halign: 'center', cellWidth: 18, textColor: [16, 120, 60], fontStyle: 'bold' },
            7: { halign: 'center', cellWidth: 18, textColor: [180, 20, 30], fontStyle: 'bold' },
            8: { halign: 'center', cellWidth: 18, textColor: [180, 110, 0] },
            9: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
            10: { halign: 'center', cellWidth: 26 },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 9) {
              const val = parseFloat(data.cell.raw);
              if (val < 75) {
                data.cell.styles.textColor = [185, 28, 28]; // red
              } else {
                data.cell.styles.textColor = [21, 128, 61]; // green
              }
            }
          },
          margin: { left: margin, right: margin, bottom: 25 },
        });
      } else {
        // Detailed Breakdown Format
        const tableHead = [
          ['#', 'Date', 'Roll No', 'Student Name', 'Father Name', 'Class-Sec', 'Status', 'Remarks'],
        ];

        const tableBody = filteredBreakdown.map((item, idx) => [
          idx + 1,
          item.date || '—',
          item.rollNumber || '—',
          item.studentName || '—',
          item.fatherName || '—',
          `${item.className || ''}-${item.section || ''}`,
          item.status || '—',
          item.remarks || '—',
        ]);

        autoTable(doc, {
          startY: currentY,
          head: tableHead,
          body: tableBody,
          theme: 'grid',
          headStyles: {
            fillColor: [4, 22, 51],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center',
            cellPadding: 1.8,
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [30, 41, 59],
            cellPadding: 1.8,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            1: { halign: 'center', cellWidth: 28 },
            2: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
            3: { halign: 'left', cellWidth: 54, fontStyle: 'bold' },
            4: { halign: 'left', cellWidth: 50 },
            5: { halign: 'center', cellWidth: 26 },
            6: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
            7: { halign: 'left', cellWidth: 50 },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 6) {
              const status = data.cell.raw;
              if (status === 'PRESENT') {
                data.cell.styles.textColor = [21, 128, 61];
              } else if (status === 'ABSENT') {
                data.cell.styles.textColor = [185, 28, 28];
              } else if (status === 'LEAVE') {
                data.cell.styles.textColor = [180, 110, 0];
              }
            }
          },
          margin: { left: margin, right: margin, bottom: 25 },
        });
      }

      // 7. Footer Page Numbers on Every Page
      const totalPages = doc.getNumberOfPages();
      const finalY = doc.lastAutoTable?.finalY || currentY;

      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Official Document — ${schoolName}  |  Page ${i} of ${totalPages}`,
          margin,
          pageHeight - 6
        );
        doc.text(
          `Generated automatically by EduNexus™ SaaS`,
          pageWidth - margin,
          pageHeight - 6,
          { align: 'right' }
        );
      }

      // 8. Official Signature Blocks on the Last Page
      doc.setPage(totalPages);
      let sigY = finalY + 16;
      if (sigY + 18 > pageHeight - 10) {
        // Not enough space at bottom of table, append a dedicated sign-off page
        doc.addPage();
        sigY = 35;
      }

      doc.setDrawColor(4, 22, 51);
      doc.setLineWidth(0.3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(4, 22, 51);

      const col1X = margin + 12;
      const col2X = pageWidth / 2;
      const col3X = pageWidth - margin - 42;

      // Signature baseline lines
      doc.line(col1X, sigY, col1X + 46, sigY);
      doc.line(col2X - 23, sigY, col2X + 23, sigY);
      doc.line(col3X - 5, sigY, col3X + 41, sigY);

      // Signature Labels below lines
      doc.text('Class Incharge / Teacher', col1X + 23, sigY + 4, { align: 'center' });
      doc.text('Attendance Incharge', col2X, sigY + 4, { align: 'center' });
      doc.text(principalTitle, col3X + 18, sigY + 4, { align: 'center' });

      const fileName = `Student_Attendance_${viewFormat.toUpperCase()}_${selectedClass}_${selectedSection}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Error generating PDF. Please check console.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-[#ffa000]" />
              Student Attendance Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Analyze student presence, absences, and leaves. Toggle between summarized totals and complete daily breakdown.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportExcel}
              disabled={loading || !reportData}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export to Excel</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={loading || !reportData || exportingPdf}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
            >
              {exportingPdf ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Format Switcher: Summarized vs Breakdown */}
        <div className="flex items-center gap-2 mt-4 pb-2">
          <span className="text-xs font-bold text-slate-700 mr-2">Report Format:</span>
          <button
            type="button"
            onClick={() => setViewFormat('summary')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewFormat === 'summary'
                ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Summarized Format (Student Totals)
          </button>
          <button
            type="button"
            onClick={() => setViewFormat('breakdown')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewFormat === 'breakdown'
                ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Detailed Breakdown (Date-Wise Records)
          </button>
        </div>

        {/* 3. Parameter Filters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-3 text-xs">
          {/* Academic Session */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Session</label>
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

          {/* Class Filter (with All option) */}
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

          {/* Section Filter (with All option) */}
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
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          {/* Status Filter (Active in Breakdown or general) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present Only</option>
              <option value="ABSENT">Absent Only</option>
              <option value="LEAVE">Leave Only</option>
            </select>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search student by name, roll, or admission #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
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
              <span>Apply Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Report Print Container (Target for PDF Generation & Screen Display) */}
      <div ref={reportPrintRef} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 text-slate-900">
        {/* Official Letterhead Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
          <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">{schoolProfile.schoolName}</h1>
          <p className="text-xs font-bold text-slate-700 uppercase mt-0.5">{schoolProfile.address}</p>
          {schoolProfile.affiliation && (
            <p className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">{schoolProfile.affiliation}</p>
          )}
          <div className="mt-3 inline-block border-b-2 border-slate-900 pb-1">
            <h2 className="text-base font-black uppercase text-slate-900 tracking-wide">
              STUDENT ATTENDANCE REPORT — {viewFormat === 'summary' ? 'SUMMARIZED FORMAT' : 'DETAILED BREAKDOWN'}
            </h2>
          </div>
          <div className="text-[11px] text-slate-600 font-semibold mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span>Session: <strong>{selectedSession}</strong></span>
            <span>•</span>
            <span>Class: <strong>{selectedClass === 'ALL' ? 'All Classes' : selectedClass}</strong></span>
            <span>•</span>
            <span>Section: <strong>{selectedSection === 'ALL' ? 'All Sections' : selectedSection}</strong></span>
            <span>•</span>
            <span>Date Range: <strong>{fromDate || 'Earliest'} to {toDate || 'Latest'}</strong></span>
            <span>•</span>
            <span>Generated: <strong>{new Date().toLocaleString()}</strong></span>
          </div>
        </div>

        {/* 5. Main Content: Summarized Format vs Detailed Breakdown */}
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="font-semibold text-slate-600 text-sm">Loading attendance records...</p>
          </div>
        ) : !reportData || (viewFormat === 'summary' ? filteredSummary.length === 0 : filteredBreakdown.length === 0) ? (
          <div className="py-16 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-700 text-base">No Attendance Records Found</p>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting the date range, class, or section filters above.
            </p>
          </div>
        ) : viewFormat === 'summary' ? (
          /* SUMMARIZED FORMAT TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-10 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Roll No</th>
                  <th className="py-2.5 px-3 border border-slate-300">Student Name</th>
                  <th className="py-2.5 px-3 border border-slate-300">Father Name</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Class-Sec</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Total Working Days</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Present</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Absent</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Leave</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Attendance %</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredSummary.map((s, idx) => {
                  const isLow = s.attendancePercent < 75;
                  return (
                    <tr key={s.studentId || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border border-slate-200">
                        {s.rollNumber || '—'}
                      </td>
                      <td className="py-2 px-3 font-black text-slate-900 border border-slate-200">
                        {s.studentName}
                      </td>
                      <td className="py-2 px-3 text-slate-700 border border-slate-200">
                        {s.fatherName || '—'}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-800 border border-slate-200">
                        {s.className}-{s.section}
                      </td>
                      <td className="py-2 px-3 text-center font-bold border border-slate-200">
                        {s.totalDays}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-700 border border-slate-200">
                        {s.presentDays}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-rose-700 border border-slate-200">
                        {s.absentDays}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-amber-700 border border-slate-200">
                        {s.leaveDays}
                      </td>
                      <td className="py-2 px-3 text-center font-black text-sm border border-slate-200">
                        <span className={isLow ? 'text-rose-700' : 'text-emerald-700'}>
                          {s.attendancePercent}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center border border-slate-200">
                        {isLow ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Low (&lt;75%)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Regular
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* DETAILED BREAKDOWN TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-10 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Date</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Roll No</th>
                  <th className="py-2.5 px-3 border border-slate-300">Student Name</th>
                  <th className="py-2.5 px-3 border border-slate-300">Father Name</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Class-Sec</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Status</th>
                  <th className="py-2.5 px-3 border border-slate-300">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredBreakdown.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 text-center font-medium border border-slate-200">
                      {item.date}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border border-slate-200">
                      {item.rollNumber}
                    </td>
                    <td className="py-2 px-3 font-black text-slate-900 border border-slate-200">
                      {item.studentName}
                    </td>
                    <td className="py-2 px-3 text-slate-700 border border-slate-200">
                      {item.fatherName}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-slate-800 border border-slate-200">
                      {item.className}-{item.section}
                    </td>
                    <td className="py-2 px-3 text-center border border-slate-200">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                          item.status === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'ABSENT'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 border border-slate-200">
                      {item.remarks || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Official Signatures (Included in PDF & Print) */}
        <div className="flex items-end justify-between pt-16 mt-8 border-t-2 border-slate-900 text-xs font-bold text-slate-900">
          <div className="text-center w-40">
            <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
            <span>Class Incharge / Teacher</span>
          </div>

          <div className="text-center w-40">
            <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
            <span>Attendance Incharge</span>
          </div>

          <div className="text-center w-40">
            <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
            <span>{schoolProfile.principalTitle || 'Principal'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
