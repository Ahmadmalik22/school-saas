import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../context/AcademicClassesContext';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Award,
  Download,
  FileDown,
  RefreshCw,
  Search,
  Filter,
  Medal,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function ExamPerformanceReport({ schoolCode }) {
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
  const [selectedTerm, setSelectedTerm] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // View format toggle: 'merit' or 'subject'
  const [viewFormat, setViewFormat] = useState('merit');

  // Data state
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [termsList, setTermsList] = useState([]);
  const [schoolProfile, setSchoolProfile] = useState({
    schoolName: 'ISLAMABAD MODEL COLLEGE FOR BOYS',
    address: 'PAKISTAN TOWN, ISLAMABAD',
    affiliation: 'Federal Board (FBISE)',
    principalTitle: 'Principal',
  });

  useEffect(() => {
    if (currentSession) setSelectedSession(currentSession);
  }, [currentSession]);

  useEffect(() => {
    const fetchProfileAndTerms = async () => {
      try {
        const [profRes, termRes] = await Promise.all([
          api.get('/school-profile', { params: { schoolCode } }),
          api.get('/exam-terms', { params: { schoolCode, academicSession: selectedSession } }),
        ]);

        if (profRes.data?.success && profRes.data.data) {
          setSchoolProfile(profRes.data.data);
        }
        if (termRes.data?.success && termRes.data.data) {
          setTermsList(termRes.data.data.map((t) => t.termName || t));
        }
      } catch (e) {
        console.warn(e);
      }
    };
    fetchProfileAndTerms();
  }, [schoolCode, selectedSession]);

  // Fetch Exam Performance Report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        schoolCode,
        academicSession: selectedSession,
        className: selectedClass,
        section: selectedSection,
        termName: selectedTerm,
      };

      const res = await api.get('/reports/exam-performance', { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching exam performance report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedSession, selectedClass, selectedSection, selectedTerm]);

  const handleResetFilters = () => {
    setSelectedClass('ALL');
    setSelectedSection('ALL');
    setSelectedTerm('ALL');
    setSearchQuery('');
  };

  // Filtered Merit List
  const filteredMerit = useMemo(() => {
    if (!reportData?.meritList) return [];
    return reportData.meritList.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.studentName?.toLowerCase().includes(q) ||
          item.rollNumber?.toLowerCase().includes(q) ||
          item.fatherName?.toLowerCase().includes(q) ||
          item.className?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // Filtered Subject Breakdown
  const filteredSubjects = useMemo(() => {
    if (!reportData?.subjectBreakdown) return [];
    return reportData.subjectBreakdown.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.subjectName?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // 1. Export to Excel (.xlsx) using ExcelJS
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = viewFormat === 'merit' ? 'Exam Merit Positions' : 'Subject Analytics';
    const worksheet = workbook.addWorksheet(sheetName);

    // School Title Header
    worksheet.mergeCells('A1:J1');
    worksheet.getCell('A1').value = `${schoolProfile.schoolName || 'School'} - Examination Merit List & Performance Report`;
    worksheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF041633' },
    };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    // Subtitle & Filters
    worksheet.mergeCells('A2:J2');
    worksheet.getCell('A2').value = `Session: ${selectedSession} | Class: ${selectedClass} | Section: ${selectedSection} | Term: ${selectedTerm} | Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A2').font = { size: 9, italic: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Blank line

    if (viewFormat === 'merit') {
      const headerRow = worksheet.addRow([
        'Rank / Position',
        'Roll No',
        'Student Name',
        'Father Name',
        'Class-Sec',
        'Exam Term',
        'Obtained Marks',
        'Total Marks',
        'Percentage (%)',
        'Grade',
        'Result Status',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredMerit.forEach((item) => {
        const row = worksheet.addRow([
          item.rank,
          item.rollNumber,
          item.studentName,
          item.fatherName,
          `${item.className}-${item.section}`,
          item.termName,
          item.grandTotalObtained,
          item.grandTotalMax,
          `${item.overallPercentage}%`,
          item.overallGrade,
          item.isPass ? 'PASS' : 'FAIL',
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'right' };
        row.getCell(8).alignment = { horizontal: 'right' };
        row.getCell(9).alignment = { horizontal: 'center' };
        row.getCell(10).alignment = { horizontal: 'center' };
        row.getCell(11).alignment = { horizontal: 'center' };
      });
    } else {
      // Subject Breakdown
      const headerRow = worksheet.addRow([
        '#',
        'Subject Name',
        'Total Students',
        'Passed Students',
        'Failed Students',
        'Subject Highest Score',
        'Class Average Score',
        'Subject Pass Rate (%)',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredSubjects.forEach((s, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          s.subjectName,
          s.totalStudents,
          s.passed,
          s.failed,
          s.highest,
          s.average,
          `${s.passRate}%`,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).alignment = { horizontal: 'center' };
      });
    }

    worksheet.columns.forEach((column) => {
      column.width = 17;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Exam_Performance_${viewFormat}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // 2. Download Official Well-Formatted PDF using jsPDF + autoTable (Vector Crisp Quality)
  const handleDownloadPdf = () => {
    setExportingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;

      const schoolName = (schoolProfile.schoolName || 'ISLAMABAD MODEL COLLEGE FOR BOYS').toUpperCase();
      const address = (schoolProfile.address || '').toUpperCase();
      const affiliation = schoolProfile.affiliation ? schoolProfile.affiliation.toUpperCase() : '';
      const principalTitle = schoolProfile.principalTitle || 'Principal';

      // Top Header Ribbon
      doc.setFillColor(4, 22, 51); // Navy #041633
      doc.rect(0, 0, pageWidth, 4, 'F');
      doc.setFillColor(255, 160, 0); // Gold #ffa000
      doc.rect(0, 4, pageWidth, 1.5, 'F');

      let currentY = 14;

      // School Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(4, 22, 51);
      doc.text(schoolName, pageWidth / 2, currentY, { align: 'center' });

      // Address & Affiliation
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

      // Report Title
      currentY += 5;
      doc.setDrawColor(4, 22, 51);
      doc.setLineWidth(0.4);
      doc.line(margin, currentY, pageWidth - margin, currentY);

      currentY += 4.8;
      const reportTitle =
        viewFormat === 'merit'
          ? `EXAMINATION MERIT LIST & POSITION HOLDERS REPORT`
          : `EXAMINATION SUBJECT-WISE PERFORMANCE & BENCHMARK REPORT`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(4, 22, 51);
      doc.text(reportTitle, pageWidth / 2, currentY, { align: 'center' });

      // Parameters Ribbon
      currentY += 4.2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      const paramsText = `Session: ${selectedSession}  |  Class: ${selectedClass}  |  Section: ${selectedSection}  |  Term: ${selectedTerm}  |  Generated: ${new Date().toLocaleString()}`;
      doc.text(paramsText, pageWidth / 2, currentY, { align: 'center' });

      currentY += 4;

      if (viewFormat === 'merit') {
        const tableHead = [
          ['Rank', 'Roll #', 'Student Name', 'Father Name', 'Class-Sec', 'Exam Term', 'Obtained', 'Total', 'Pct %', 'Grade', 'Status'],
        ];

        const tableBody = filteredMerit.map((item) => [
          item.rank === 1 ? '1st (Gold)' : item.rank === 2 ? '2nd (Silver)' : item.rank === 3 ? '3rd (Bronze)' : `#${item.rank}`,
          item.rollNumber || '—',
          item.studentName || '—',
          item.fatherName || '—',
          `${item.className || ''}-${item.section || ''}`,
          item.termName || '—',
          item.grandTotalObtained,
          item.grandTotalMax,
          `${item.overallPercentage}%`,
          item.overallGrade,
          item.isPass ? 'PASS' : 'FAIL',
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
            0: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
            1: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
            2: { halign: 'left', cellWidth: 42, fontStyle: 'bold' },
            3: { halign: 'left', cellWidth: 38 },
            4: { halign: 'center', cellWidth: 22 },
            5: { halign: 'center', cellWidth: 24 },
            6: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
            7: { halign: 'right', cellWidth: 20 },
            8: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
            9: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
            10: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 10) {
              const status = data.cell.raw;
              if (status === 'PASS') {
                data.cell.styles.textColor = [21, 128, 61];
              } else {
                data.cell.styles.textColor = [185, 28, 28];
              }
            } else if (data.section === 'body' && data.column.index === 0 && data.row.index < 3) {
              data.cell.styles.textColor = [180, 110, 0]; // Gold badge
            }
          },
          margin: { left: margin, right: margin, bottom: 25 },
        });
      } else {
        // Subject Breakdown
        const tableHead = [
          ['#', 'Subject Name', 'Total Students', 'Passed', 'Failed', 'Highest Score', 'Class Average', 'Pass Rate (%)'],
        ];

        const tableBody = filteredSubjects.map((s, idx) => [
          idx + 1,
          s.subjectName,
          s.totalStudents,
          s.passed,
          s.failed,
          s.highest,
          s.average,
          `${s.passRate}%`,
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
            fontSize: 8,
            halign: 'center',
            cellPadding: 2,
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [30, 41, 59],
            cellPadding: 2,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            1: { halign: 'left', cellWidth: 60, fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 30 },
            3: { halign: 'center', cellWidth: 28, textColor: [21, 128, 61], fontStyle: 'bold' },
            4: { halign: 'center', cellWidth: 28, textColor: [185, 28, 28], fontStyle: 'bold' },
            5: { halign: 'center', cellWidth: 32, fontStyle: 'bold' },
            6: { halign: 'center', cellWidth: 32 },
            7: { halign: 'center', cellWidth: 32, fontStyle: 'bold' },
          },
          margin: { left: margin, right: margin, bottom: 25 },
        });
      }

      // Page numbering footer
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
          `Generated automatically by Akkhor™ SaaS`,
          pageWidth - margin,
          pageHeight - 6,
          { align: 'right' }
        );
      }

      // Official Signatures on Last Page
      doc.setPage(totalPages);
      let sigY = finalY + 16;
      if (sigY + 18 > pageHeight - 10) {
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

      doc.line(col1X, sigY, col1X + 46, sigY);
      doc.line(col2X - 23, sigY, col2X + 23, sigY);
      doc.line(col3X - 5, sigY, col3X + 41, sigY);

      doc.text('Controller of Examinations', col1X + 23, sigY + 4, { align: 'center' });
      doc.text('Vice Principal / Academic Head', col2X, sigY + 4, { align: 'center' });
      doc.text(principalTitle, col3X + 18, sigY + 4, { align: 'center' });

      const fileName = `Exam_Performance_${viewFormat.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
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
      {/* 1. Header Banner & Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-6 h-6 text-[#ffa000]" />
              Exam Merit Positions & Performance Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Top rank position holders, class result summaries, subject averages, and passing percentages.
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

        {/* 2. Format Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 mr-2">Report Format:</span>
            <button
              type="button"
              onClick={() => setViewFormat('merit')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewFormat === 'merit'
                  ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Merit List (Student Positions & Rankings)
            </button>
            <button
              type="button"
              onClick={() => setViewFormat('subject')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewFormat === 'subject'
                  ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Subject Analytics (Pass Rates & Averages)
            </button>
          </div>

          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Overall Passing Rate:</span>
            <span className="font-mono text-sm font-black text-emerald-700">
              {reportData?.summary?.passRate ?? 0}%
            </span>
          </div>
        </div>

        {/* 3. Parameter Filters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-3 text-xs">
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
                <option key={c} value={c}>{c}</option>
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
                <option key={s} value={s}>Section {s}</option>
              ))}
            </select>
          </div>

          {/* Exam Term Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Exam Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Terms</option>
              {termsList.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-300 transition text-center cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* 4. Search Filter Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by student name, roll number, or father name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            onClick={fetchReport}
            className="px-4 py-1.5 bg-[#041633] text-white font-bold rounded-lg text-xs hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Apply</span>
          </button>
        </div>
      </div>

      {/* 2. Main Data Presentation Table (Clean, Professional, No KPI Cards) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-[#ffa000] animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading exam merit report...</p>
          </div>
        ) : viewFormat === 'merit' ? (
          /* MERIT LIST TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-16 text-center border border-slate-300">Rank</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Roll #</th>
                  <th className="py-2.5 px-3 border border-slate-300">Student Name</th>
                  <th className="py-2.5 px-3 border border-slate-300">Father Name</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Class-Sec</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Exam Term</th>
                  <th className="py-2.5 px-3 w-24 text-right border border-slate-300">Obtained</th>
                  <th className="py-2.5 px-3 w-24 text-right border border-slate-300">Total</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Pct %</th>
                  <th className="py-2.5 px-3 w-16 text-center border border-slate-300">Grade</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredMerit.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                      No examination marks recorded for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMerit.map((item) => (
                    <tr
                      key={item.studentId || item.rank}
                      className={`hover:bg-slate-50 transition-colors ${
                        item.rank === 1
                          ? 'bg-amber-50/50'
                          : item.rank === 2
                          ? 'bg-slate-50/60'
                          : item.rank === 3
                          ? 'bg-orange-50/30'
                          : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center font-black border border-slate-200">
                        {item.rank === 1 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[11px]">
                            1st 🥇
                          </span>
                        ) : item.rank === 2 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-300 text-slate-900 font-bold text-[11px]">
                            2nd 🥈
                          </span>
                        ) : item.rank === 3 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-300 text-slate-900 font-bold text-[11px]">
                            3rd 🥉
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold">#{item.rank}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 border border-slate-200">
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
                      <td className="py-2 px-3 text-center font-medium text-slate-600 border border-slate-200">
                        {item.termName}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border border-slate-200">
                        {item.grandTotalObtained}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600 border border-slate-200">
                        {item.grandTotalMax}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-black text-slate-900 border border-slate-200">
                        {item.overallPercentage}%
                      </td>
                      <td className="py-2 px-3 text-center font-black text-slate-900 border border-slate-200">
                        {item.overallGrade}
                      </td>
                      <td className="py-2 px-3 text-center border border-slate-200">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                            item.isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.isPass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* SUBJECT ANALYTICS TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-12 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 border border-slate-300">Subject Name</th>
                  <th className="py-2.5 px-3 w-32 text-center border border-slate-300">Total Students</th>
                  <th className="py-2.5 px-3 w-32 text-center border border-slate-300">Passed Students</th>
                  <th className="py-2.5 px-3 w-32 text-center border border-slate-300">Failed Students</th>
                  <th className="py-2.5 px-3 w-36 text-center border border-slate-300">Highest Score</th>
                  <th className="py-2.5 px-3 w-36 text-center border border-slate-300">Class Average</th>
                  <th className="py-2.5 px-3 w-36 text-center border border-slate-300">Pass Rate (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                      No subject analytics found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSubjects.map((s, idx) => (
                    <tr key={s.subjectName} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 border border-slate-200">
                        {s.subjectName}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border border-slate-200">
                        {s.totalStudents}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700 border border-slate-200">
                        {s.passed}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-rose-700 border border-slate-200">
                        {s.failed}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 border border-slate-200">
                        {s.highest}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-700 border border-slate-200">
                        {s.average}
                      </td>
                      <td className="py-2 px-3 text-center font-black border border-slate-200">
                        <span className={s.passRate >= 70 ? 'text-emerald-700' : 'text-amber-700'}>
                          {s.passRate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
