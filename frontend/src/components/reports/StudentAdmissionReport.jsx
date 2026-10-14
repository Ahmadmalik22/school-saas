import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../context/AcademicClassesContext';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  UserCheck,
  Download,
  FileDown,
  RefreshCw,
  Search,
  Filter,
  Clock,
  Users,
} from 'lucide-react';

export default function StudentAdmissionReport({ schoolCode }) {
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
  const [genderFilter, setGenderFilter] = useState('ALL'); // ALL, MALE, FEMALE
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE, STRUCK_OFF, PASSED_OUT
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
    schoolName: 'ISLAMABAD MODEL COLLEGE FOR BOYS',
    address: 'PAKISTAN TOWN, ISLAMABAD',
    affiliation: 'Federal Board (FBISE)',
  });

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

  // Fetch Admission & Enrollment Report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        schoolCode,
        academicSession: selectedSession,
        className: selectedClass,
        section: selectedSection,
        gender: genderFilter,
        status: statusFilter,
      };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await api.get('/reports/student-enrollment', { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching admission report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedSession, selectedClass, selectedSection, genderFilter, statusFilter]);

  const handleResetFilters = () => {
    setSelectedClass('ALL');
    setSelectedSection('ALL');
    setGenderFilter('ALL');
    setStatusFilter('ALL');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
  };

  // Filtered Summary List
  const filteredSummary = useMemo(() => {
    if (!reportData?.summarizedList) return [];
    return reportData.summarizedList.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.className?.toLowerCase().includes(q) ||
          item.section?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // Filtered Detailed Breakdown
  const filteredBreakdown = useMemo(() => {
    if (!reportData?.detailedBreakdown) return [];
    return reportData.detailedBreakdown.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.fullName?.toLowerCase().includes(q) ||
          item.rollNumber?.toLowerCase().includes(q) ||
          item.admissionNumber?.toLowerCase().includes(q) ||
          item.fatherName?.toLowerCase().includes(q) ||
          item.fatherPhone?.toLowerCase().includes(q) ||
          item.bFormOrCnic?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // Summary Totals
  const totalSummaryEnrolled = useMemo(() => {
    return filteredSummary.reduce((acc, curr) => ({
      boys: acc.boys + (curr.maleCount || 0),
      girls: acc.girls + (curr.femaleCount || 0),
      active: acc.active + (curr.activeCount || 0),
      inactive: acc.inactive + (curr.inactiveCount || 0),
      total: acc.total + (curr.totalEnrolled || 0),
    }), { boys: 0, girls: 0, active: 0, inactive: 0, total: 0 });
  }, [filteredSummary]);

  // Detailed Ledger Fee Totals
  const totalBreakdownFees = useMemo(() => {
    return filteredBreakdown.reduce((acc, curr) => ({
      admissionFee: acc.admissionFee + (Number(curr.admissionFee) || 0),
      monthlyFee: acc.monthlyFee + (Number(curr.monthlyFee) || 0),
    }), { admissionFee: 0, monthlyFee: 0 });
  }, [filteredBreakdown]);

  // 1. Export to Excel (.xlsx) using ExcelJS
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = viewFormat === 'summary' ? 'Enrollment Summary' : 'Admission Ledger';
    const worksheet = workbook.addWorksheet(sheetName);

    // School Header
    worksheet.mergeCells('A1:L1');
    worksheet.getCell('A1').value = `${schoolProfile.schoolName || 'School'} - Student Admission & Enrollment Report`;
    worksheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF041633' },
    };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    // Subtitle & Filters
    worksheet.mergeCells('A2:L2');
    worksheet.getCell('A2').value = `Session: ${selectedSession} | Class: ${selectedClass} | Section: ${selectedSection} | Range: ${fromDate || 'Earliest'} to ${toDate || 'Latest'} | Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A2').font = { size: 9, italic: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Blank line

    if (viewFormat === 'summary') {
      const headerRow = worksheet.addRow([
        '#',
        'Class',
        'Section',
        'Boys (Male)',
        'Girls (Female)',
        'Active Students',
        'Inactive / Other',
        'Total Enrolled',
        '% Share',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      const grandTotal = totalSummaryEnrolled.total || 1;

      filteredSummary.forEach((s, idx) => {
        const share = ((s.totalEnrolled / grandTotal) * 100).toFixed(1);
        const row = worksheet.addRow([
          idx + 1,
          s.className,
          `Section ${s.section}`,
          s.maleCount,
          s.femaleCount,
          s.activeCount,
          s.inactiveCount,
          s.totalEnrolled,
          `${share}%`,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).alignment = { horizontal: 'center' };
        row.getCell(9).alignment = { horizontal: 'center' };
      });

      // Grand Total Row
      const totalRow = worksheet.addRow([
        'TOTAL',
        '—',
        '—',
        totalSummaryEnrolled.boys,
        totalSummaryEnrolled.girls,
        totalSummaryEnrolled.active,
        totalSummaryEnrolled.inactive,
        totalSummaryEnrolled.total,
        '100%',
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
    } else {
      // Detailed Ledger
      const headerRow = worksheet.addRow([
        '#',
        'Admission No',
        'Admission Date',
        'Roll No',
        'Student Name',
        'Father Name',
        'Gender',
        'Class-Sec',
        'Phone / Contact',
        'Status',
        'Admission Fee (PKR)',
        'Monthly Fee (PKR)',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredBreakdown.forEach((item, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          item.admissionNumber,
          item.admissionDate,
          item.rollNumber,
          item.fullName,
          item.fatherName,
          item.gender,
          `${item.className}-${item.section}`,
          item.fatherPhone,
          item.status,
          item.admissionFee ?? 0,
          item.monthlyFee,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).alignment = { horizontal: 'center' };
        row.getCell(10).alignment = { horizontal: 'center' };
        row.getCell(11).alignment = { horizontal: 'right' };
        row.getCell(12).alignment = { horizontal: 'right' };
      });

      // Detailed Ledger Grand Total Row
      const totalRow = worksheet.addRow([
        'TOTAL',
        '—',
        '—',
        '—',
        `${filteredBreakdown.length} Students`,
        '—',
        '—',
        '—',
        '—',
        '—',
        totalBreakdownFees.admissionFee,
        totalBreakdownFees.monthlyFee,
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      totalRow.getCell(11).alignment = { horizontal: 'right' };
      totalRow.getCell(12).alignment = { horizontal: 'right' };
    }

    worksheet.columns.forEach((column) => {
      column.width = 16;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Student_Admission_${viewFormat}_Report_${selectedClass}_${new Date().toISOString().split('T')[0]}.xlsx`;
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
        viewFormat === 'summary'
          ? 'STUDENT ADMISSION & ENROLLMENT REPORT — SUMMARIZED FORMAT'
          : 'STUDENT ADMISSION & ENROLLMENT REPORT — DETAILED ADMISSION LEDGER';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(4, 22, 51);
      doc.text(reportTitle, pageWidth / 2, currentY, { align: 'center' });

      currentY += 2;
      doc.line(margin, currentY, pageWidth - margin, currentY);

      // Metadata Bar
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
        `Gender: ${genderFilter === 'ALL' ? 'All' : genderFilter}`,
        `Status: ${statusFilter === 'ALL' ? 'All' : statusFilter}`,
        `Date Range: ${fromDate || 'Earliest'} to ${toDate || 'Latest'}`,
        `Printed: ${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      ];
      doc.text(filterItems.join('    |    '), pageWidth / 2, currentY + 1.2, { align: 'center' });

      currentY += 6.5;

      // AutoTable
      if (viewFormat === 'summary') {
        const grandTotal = totalSummaryEnrolled.total || 1;
        const tableHead = [
          ['#', 'Class', 'Section', 'Boys (Male)', 'Girls (Female)', 'Active Students', 'Inactive / Other', 'Total Enrolled', '% Share'],
        ];

        const tableBody = filteredSummary.map((s, idx) => [
          idx + 1,
          s.className,
          `Section ${s.section}`,
          s.maleCount ?? 0,
          s.femaleCount ?? 0,
          s.activeCount ?? 0,
          s.inactiveCount ?? 0,
          s.totalEnrolled ?? 0,
          `${((s.totalEnrolled / grandTotal) * 100).toFixed(1)}%`,
        ]);

        // Totals Row
        tableBody.push([
          'TOTAL',
          'All Classes',
          '—',
          totalSummaryEnrolled.boys,
          totalSummaryEnrolled.girls,
          totalSummaryEnrolled.active,
          totalSummaryEnrolled.inactive,
          totalSummaryEnrolled.total,
          '100%',
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
            1: { halign: 'left', cellWidth: 40, fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 26 },
            3: { halign: 'center', cellWidth: 28 },
            4: { halign: 'center', cellWidth: 28 },
            5: { halign: 'center', cellWidth: 32, textColor: [21, 128, 61], fontStyle: 'bold' },
            6: { halign: 'center', cellWidth: 32 },
            7: { halign: 'center', cellWidth: 36, fontStyle: 'bold' },
            8: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.row.index === tableBody.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [241, 245, 249];
            }
          },
          margin: { left: margin, right: margin, bottom: 25 },
        });
      } else {
        // Detailed Ledger
        const tableHead = [
          ['#', 'Adm No', 'Adm Date', 'Roll No', 'Student Name', 'Father Name', 'Gender', 'Class-Sec', 'Phone / Contact', 'Status', 'Adm Fee (PKR)', 'Monthly Fee'],
        ];

        const tableBody = filteredBreakdown.map((item, idx) => [
          idx + 1,
          item.admissionNumber || '—',
          item.admissionDate || '—',
          item.rollNumber || '—',
          item.fullName || '—',
          item.fatherName || '—',
          item.gender || '—',
          `${item.className || ''}-${item.section || ''}`,
          item.fatherPhone || '—',
          item.status || 'ACTIVE',
          (item.admissionFee ?? 0).toLocaleString(),
          (item.monthlyFee ?? 0).toLocaleString(),
        ]);

        // Append Grand Total Row to PDF Table
        tableBody.push([
          'TOTAL',
          '—',
          '—',
          '—',
          `${filteredBreakdown.length} Students`,
          '—',
          '—',
          '—',
          '—',
          '—',
          totalBreakdownFees.admissionFee.toLocaleString(),
          totalBreakdownFees.monthlyFee.toLocaleString(),
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
            0: { halign: 'center', cellWidth: 8 },
            1: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 20 },
            3: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
            4: { halign: 'left', cellWidth: 40, fontStyle: 'bold' },
            5: { halign: 'left', cellWidth: 38 },
            6: { halign: 'center', cellWidth: 16 },
            7: { halign: 'center', cellWidth: 18 },
            8: { halign: 'center', cellWidth: 24 },
            9: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
            10: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
            11: { halign: 'right', cellWidth: 26 },
          },
          didParseCell: (data) => {
            if (data.row.index === tableBody.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [241, 245, 249];
            } else if (data.section === 'body' && data.column.index === 9) {
              const status = data.cell.raw;
              if (status === 'ACTIVE') {
                data.cell.styles.textColor = [21, 128, 61];
              } else {
                data.cell.styles.textColor = [185, 28, 28];
              }
            }
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

      doc.text('Admissions Incharge / Registrar', col1X + 23, sigY + 4, { align: 'center' });
      doc.text('Accounts Officer', col2X, sigY + 4, { align: 'center' });
      doc.text(principalTitle, col3X + 18, sigY + 4, { align: 'center' });

      const fileName = `Student_Admission_${viewFormat.toUpperCase()}_${selectedClass}_${new Date().toISOString().split('T')[0]}.pdf`;
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
              <UserCheck className="w-6 h-6 text-[#ffa000]" />
              Student Admission & Enrollment Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Analyze student admissions, enrollment statistics, and class-wise demographic distributions.
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
            Summarized Format (Class & Section Totals)
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
            Detailed Breakdown (Student Admission Ledger)
          </button>
        </div>

        {/* 3. Parameter Filters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mt-3 text-xs">
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

          {/* Gender Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Gender</label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Genders</option>
              <option value="MALE">Boys (Male)</option>
              <option value="FEMALE">Girls (Female)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="STRUCK_OFF">Struck Off</option>
              <option value="PASSED_OUT">Passed Out</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Adm From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Adm To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="relative w-full sm:w-96">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, roll #, admission #, phone..."
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

      {/* 4. Official Report Sheet (Screen view & Print template) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 text-slate-900">
        {/* Official Letterhead Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
          <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">{schoolProfile.schoolName}</h1>
          <p className="text-xs font-bold text-slate-700 uppercase mt-0.5">{schoolProfile.address}</p>
          {schoolProfile.affiliation && (
            <p className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">{schoolProfile.affiliation}</p>
          )}
          <div className="mt-3 inline-block border-b-2 border-slate-900 pb-1">
            <h2 className="text-base font-black uppercase text-slate-900 tracking-wide">
              STUDENT ADMISSION & ENROLLMENT REPORT — {viewFormat === 'summary' ? 'SUMMARIZED FORMAT' : 'DETAILED LEDGER'}
            </h2>
          </div>
          <div className="text-[11px] text-slate-600 font-semibold mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span>Session: <strong>{selectedSession}</strong></span>
            <span>•</span>
            <span>Class: <strong>{selectedClass === 'ALL' ? 'All Classes' : selectedClass}</strong></span>
            <span>•</span>
            <span>Section: <strong>{selectedSection === 'ALL' ? 'All Sections' : selectedSection}</strong></span>
            <span>•</span>
            <span>Gender: <strong>{genderFilter === 'ALL' ? 'All' : genderFilter}</strong></span>
            <span>•</span>
            <span>Status: <strong>{statusFilter === 'ALL' ? 'All' : statusFilter}</strong></span>
            <span>•</span>
            <span>Adm Range: <strong>{fromDate || 'Earliest'} to {toDate || 'Latest'}</strong></span>
            <span>•</span>
            <span>Generated: <strong>{new Date().toLocaleString()}</strong></span>
          </div>
        </div>

        {/* 5. Main Content: Summarized Format vs Detailed Breakdown */}
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="font-semibold text-slate-600 text-sm">Loading enrollment records...</p>
          </div>
        ) : !reportData || (viewFormat === 'summary' ? filteredSummary.length === 0 : filteredBreakdown.length === 0) ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-700 text-base">No Admission Records Found</p>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting the date range, class, section, or status filters above.
            </p>
          </div>
        ) : viewFormat === 'summary' ? (
          /* SUMMARIZED FORMAT TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-10 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 border border-slate-300">Class</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Section</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Boys (Male)</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Girls (Female)</th>
                  <th className="py-2.5 px-3 w-32 text-center border border-slate-300">Active Students</th>
                  <th className="py-2.5 px-3 w-32 text-center border border-slate-300">Inactive / Struck</th>
                  <th className="py-2.5 px-3 w-32 text-center border border-slate-300">Total Enrolled</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">% Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredSummary.map((s, idx) => {
                  const grandTotal = totalSummaryEnrolled.total || 1;
                  const share = ((s.totalEnrolled / grandTotal) * 100).toFixed(1);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-black text-slate-900 border border-slate-200">
                        {s.className}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-700 border border-slate-200">
                        Section {s.section}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-blue-700 border border-slate-200">
                        {s.maleCount}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-pink-700 border border-slate-200">
                        {s.femaleCount}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-700 border border-slate-200">
                        {s.activeCount}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {s.inactiveCount}
                      </td>
                      <td className="py-2 px-3 text-center font-black text-slate-900 border border-slate-200">
                        {s.totalEnrolled}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-700 border border-slate-200">
                        {share}%
                      </td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td className="py-2.5 px-3 border border-slate-300">All Displayed Classes</td>
                  <td className="py-2.5 px-3 text-center border border-slate-300">—</td>
                  <td className="py-2.5 px-3 text-center text-blue-800 border border-slate-300">
                    {totalSummaryEnrolled.boys}
                  </td>
                  <td className="py-2.5 px-3 text-center text-pink-800 border border-slate-300">
                    {totalSummaryEnrolled.girls}
                  </td>
                  <td className="py-2.5 px-3 text-center text-emerald-800 border border-slate-300">
                    {totalSummaryEnrolled.active}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-600 border border-slate-300">
                    {totalSummaryEnrolled.inactive}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-950 text-sm border border-slate-300">
                    {totalSummaryEnrolled.total}
                  </td>
                  <td className="py-2.5 px-3 text-center border border-slate-300">100%</td>
                </tr>
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
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Adm No</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Adm Date</th>
                  <th className="py-2.5 px-3 w-18 text-center border border-slate-300">Roll No</th>
                  <th className="py-2.5 px-3 border border-slate-300">Student Name</th>
                  <th className="py-2.5 px-3 border border-slate-300">Father Name</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Gender</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Class-Sec</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Contact</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Status</th>
                  <th className="py-2.5 px-3 w-28 text-right border border-slate-300">Adm Fee (PKR)</th>
                  <th className="py-2.5 px-3 w-28 text-right border border-slate-300">Monthly Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredBreakdown.map((item, idx) => (
                  <tr key={item._id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 border border-slate-200">
                      {item.admissionNumber}
                    </td>
                    <td className="py-2 px-3 text-center font-medium text-slate-600 border border-slate-200">
                      {item.admissionDate}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border border-slate-200">
                      {item.rollNumber}
                    </td>
                    <td className="py-2 px-3 font-black text-slate-900 border border-slate-200">
                      {item.fullName}
                    </td>
                    <td className="py-2 px-3 text-slate-700 border border-slate-200">
                      {item.fatherName}
                    </td>
                    <td className="py-2 px-3 text-center border border-slate-200">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.gender === 'MALE'
                            ? 'text-blue-700 bg-blue-50 border border-blue-200'
                            : 'text-pink-700 bg-pink-50 border border-pink-200'
                        }`}
                      >
                        {item.gender}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-slate-800 border border-slate-200">
                      {item.className}-{item.section}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-slate-600 border border-slate-200">
                      {item.fatherPhone}
                    </td>
                    <td className="py-2 px-3 text-center border border-slate-200">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                          item.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border border-slate-200">
                      Rs. {(item.admissionFee ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 border border-slate-200">
                      Rs. {(item.monthlyFee ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td colSpan={3} className="py-2.5 px-3 border border-slate-300 font-bold">
                    {filteredBreakdown.length} Students Listed
                  </td>
                  <td colSpan={6} className="py-2.5 px-3 border border-slate-300 text-right font-bold text-slate-700">
                    Grand Totals:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-950 text-xs border border-slate-300">
                    Rs. {totalBreakdownFees.admissionFee.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-950 text-xs border border-slate-300">
                    Rs. {totalBreakdownFees.monthlyFee.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Official Signatures */}
        <div className="flex items-end justify-between pt-16 mt-8 border-t-2 border-slate-900 text-xs font-bold text-slate-900">
          <div className="text-center w-44">
            <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
            <span>Admissions Incharge / Registrar</span>
          </div>

          <div className="text-center w-40">
            <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
            <span>Accounts Officer</span>
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
