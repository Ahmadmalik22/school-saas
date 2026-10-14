import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../context/AcademicClassesContext';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertTriangle,
  Download,
  FileDown,
  RefreshCw,
  Search,
  Filter,
  Phone,
  Calendar,
  Clock,
  Layers,
} from 'lucide-react';

export default function PendingDuesReport({ schoolCode }) {
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
  const [minMonthsDue, setMinMonthsDue] = useState('ALL'); // ALL, 1, 2, 3
  const [searchQuery, setSearchQuery] = useState('');

  // View format toggle: 'breakdown' (default for dues) or 'summary'
  const [viewFormat, setViewFormat] = useState('breakdown');

  // Data state
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [reportData, setReportData] = useState(null);
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

  // Fetch Pending Dues Report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        schoolCode,
        academicSession: selectedSession,
        className: selectedClass,
        section: selectedSection,
      };

      if (minMonthsDue !== 'ALL') {
        params.minMonthsDue = minMonthsDue;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await api.get('/reports/pending-dues', { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching pending dues report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedSession, selectedClass, selectedSection, minMonthsDue]);

  const handleResetFilters = () => {
    setSelectedClass('ALL');
    setSelectedSection('ALL');
    setMinMonthsDue('ALL');
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
          item.studentName?.toLowerCase().includes(q) ||
          item.rollNumber?.toLowerCase().includes(q) ||
          item.fatherName?.toLowerCase().includes(q) ||
          item.fatherPhone?.toLowerCase().includes(q) ||
          item.pendingBreakdownString?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // Summary Totals
  const summaryTotals = useMemo(() => {
    return filteredSummary.reduce(
      (acc, curr) => ({
        defaulters: acc.defaulters + (curr.defaulterCount || 0),
        due1Month: acc.due1Month + (curr.due1MonthCount || 0),
        due2Months: acc.due2Months + (curr.due2MonthsCount || 0),
        due3PlusMonths: acc.due3PlusMonths + (curr.due3PlusMonthsCount || 0),
        totalPending: acc.totalPending + (curr.totalPendingAmount || 0),
      }),
      { defaulters: 0, due1Month: 0, due2Months: 0, due3PlusMonths: 0, totalPending: 0 }
    );
  }, [filteredSummary]);

  // Breakdown Totals
  const breakdownTotals = useMemo(() => {
    return filteredBreakdown.reduce(
      (acc, curr) => ({
        totalPending: acc.totalPending + (Number(curr.totalPendingBalance) || 0),
        totalInvoiced: acc.totalInvoiced + (Number(curr.totalInvoiced) || 0),
        totalPaid: acc.totalPaid + (Number(curr.totalPaidSoFar) || 0),
      }),
      { totalPending: 0, totalInvoiced: 0, totalPaid: 0 }
    );
  }, [filteredBreakdown]);

  // 1. Export to Excel (.xlsx) using ExcelJS
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = viewFormat === 'summary' ? 'Dues Summary by Class' : 'Pending Dues Ledger';
    const worksheet = workbook.addWorksheet(sheetName);

    // School Title Header
    worksheet.mergeCells('A1:K1');
    worksheet.getCell('A1').value = `${schoolProfile.schoolName || 'School'} - Outstanding Fee Dues & Defaulters Report`;
    worksheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF041633' },
    };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    // Subtitle & Filters
    worksheet.mergeCells('A2:K2');
    worksheet.getCell('A2').value = `Session: ${selectedSession} | Class: ${selectedClass} | Section: ${selectedSection} | Min Overdue Months: ${minMonthsDue} | Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A2').font = { size: 9, italic: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Blank line

    if (viewFormat === 'summary') {
      const headerRow = worksheet.addRow([
        '#',
        'Class',
        'Section',
        'Defaulter Students',
        '1 Month Due',
        '2 Months Due',
        '3+ Months Due',
        'Total Pending Amount (PKR)',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredSummary.forEach((s, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          s.className,
          `Section ${s.section}`,
          s.defaulterCount,
          s.due1MonthCount,
          s.due2MonthsCount,
          s.due3PlusMonthsCount,
          s.totalPendingAmount,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).alignment = { horizontal: 'right' };
      });

      // Total Row
      const totalRow = worksheet.addRow([
        'TOTAL',
        'All Classes',
        '—',
        summaryTotals.defaulters,
        summaryTotals.due1Month,
        summaryTotals.due2Months,
        summaryTotals.due3PlusMonths,
        summaryTotals.totalPending,
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      totalRow.getCell(8).alignment = { horizontal: 'right' };
    } else {
      // Detailed Defaulters Ledger
      const headerRow = worksheet.addRow([
        '#',
        'Roll No',
        'Student Name',
        'Father Name',
        'Class-Sec',
        'Father Contact',
        'Months Overdue',
        'Oldest Due Month',
        'Pending Months & Amounts Breakdown (kb kb k)',
        'Total Pending Dues (PKR)',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredBreakdown.forEach((item, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          item.rollNumber,
          item.studentName,
          item.fatherName,
          `${item.className}-${item.section}`,
          item.fatherPhone,
          `${item.monthsDueCount} Month(s)`,
          item.oldestMonth,
          item.pendingBreakdownString,
          item.totalPendingBalance,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).alignment = { horizontal: 'center' };
        row.getCell(9).alignment = { horizontal: 'left' };
        row.getCell(10).alignment = { horizontal: 'right' };
      });

      // Total Row
      const totalRow = worksheet.addRow([
        'TOTAL',
        '—',
        `${filteredBreakdown.length} Defaulters`,
        '—',
        '—',
        '—',
        '—',
        '—',
        'Grand Outstanding Balance:',
        breakdownTotals.totalPending,
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      totalRow.getCell(10).alignment = { horizontal: 'right' };
    }

    worksheet.columns.forEach((column) => {
      column.width = 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pending_Dues_Defaulters_${viewFormat}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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
      doc.setFillColor(220, 38, 38); // Crimson Red #dc2626 for Defaulters Alert
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
          ? `OUTSTANDING FEE DUES & DEFAULTERS REPORT — CLASS-WISE SUMMARY`
          : `OUTSTANDING FEE DUES & DEFAULTERS REPORT — DETAILED LEDGER WITH OVERDUE MONTHS`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(185, 28, 28); // Bold Red
      doc.text(reportTitle, pageWidth / 2, currentY, { align: 'center' });

      // Parameters Ribbon
      currentY += 4.2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      const paramsText = `Session: ${selectedSession}  |  Class: ${selectedClass}  |  Section: ${selectedSection}  |  Min Overdue: ${minMonthsDue} Months  |  Generated: ${new Date().toLocaleString()}`;
      doc.text(paramsText, pageWidth / 2, currentY, { align: 'center' });

      currentY += 4;

      if (viewFormat === 'summary') {
        const tableHead = [
          ['#', 'Class', 'Section', 'Defaulter Students', '1 Month Due', '2 Months Due', '3+ Months Due', 'Total Pending Balance (PKR)'],
        ];

        const tableBody = filteredSummary.map((s, idx) => [
          idx + 1,
          s.className,
          `Section ${s.section}`,
          s.defaulterCount,
          s.due1MonthCount,
          s.due2MonthsCount,
          s.due3PlusMonthsCount,
          s.totalPendingAmount.toLocaleString(),
        ]);

        tableBody.push([
          'TOTAL',
          'All Displayed Classes',
          '—',
          summaryTotals.defaulters,
          summaryTotals.due1Month,
          summaryTotals.due2Months,
          summaryTotals.due3PlusMonths,
          summaryTotals.totalPending.toLocaleString(),
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
            1: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 30 },
            3: { halign: 'center', cellWidth: 34, fontStyle: 'bold', textColor: [185, 28, 28] },
            4: { halign: 'center', cellWidth: 30 },
            5: { halign: 'center', cellWidth: 30 },
            6: { halign: 'center', cellWidth: 30 },
            7: { halign: 'right', cellWidth: 48, textColor: [185, 28, 28], fontStyle: 'bold' },
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
          ['#', 'Roll #', 'Student Name', 'Father Name', 'Class-Sec', 'Father Contact', 'Overdue', 'Oldest', 'Pending Months Breakdown (kb kb k)', 'Pending (PKR)'],
        ];

        const tableBody = filteredBreakdown.map((item, idx) => [
          idx + 1,
          item.rollNumber || '—',
          item.studentName || '—',
          item.fatherName || '—',
          `${item.className || ''}-${item.section || ''}`,
          item.fatherPhone || '—',
          `${item.monthsDueCount}M`,
          item.oldestMonth || '—',
          item.pendingBreakdownString || '—',
          (item.totalPendingBalance ?? 0).toLocaleString(),
        ]);

        tableBody.push([
          'TOTAL',
          '—',
          `${filteredBreakdown.length} Defaulters`,
          '—',
          '—',
          '—',
          '—',
          '—',
          'Grand Total Outstanding Balance:',
          breakdownTotals.totalPending.toLocaleString(),
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
            1: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
            2: { halign: 'left', cellWidth: 34, fontStyle: 'bold' },
            3: { halign: 'left', cellWidth: 32 },
            4: { halign: 'center', cellWidth: 18 },
            5: { halign: 'center', cellWidth: 26 },
            6: { halign: 'center', cellWidth: 16, fontStyle: 'bold', textColor: [185, 28, 28] },
            7: { halign: 'center', cellWidth: 20 },
            8: { halign: 'left', cellWidth: 64 },
            9: { halign: 'right', cellWidth: 28, textColor: [185, 28, 28], fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.row.index === tableBody.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [241, 245, 249];
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

      doc.text('Accounts Officer / Recovery', col1X + 23, sigY + 4, { align: 'center' });
      doc.text('Admin / Finance Incharge', col2X, sigY + 4, { align: 'center' });
      doc.text(principalTitle, col3X + 18, sigY + 4, { align: 'center' });

      const fileName = `Pending_Dues_Defaulters_${viewFormat.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
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
              <AlertTriangle className="w-6 h-6 text-rose-600" />
              Outstanding Fee Dues & Defaulters Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Complete breakdown of pending fee balances per student, months overdue (kb kb k), father contact for recovery, and class-wise summaries.
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
              onClick={() => setViewFormat('breakdown')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewFormat === 'breakdown'
                  ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Detailed Breakdown (Student-by-Student Overdue Ledger)
            </button>
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
          </div>

          <div className="text-xs font-bold text-rose-700 flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
            <span>Total Overdue:</span>
            <span className="font-mono text-sm font-black">
              Rs. {(reportData?.summary?.totalPendingAmount || 0).toLocaleString()}
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

          {/* Min Months Overdue */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Min Overdue Months</label>
            <select
              value={minMonthsDue}
              onChange={(e) => setMinMonthsDue(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Overdue (1+ Months)</option>
              <option value="2">2+ Months Pending</option>
              <option value="3">3+ Months Pending (Severe)</option>
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
              placeholder="Search by student name, roll number, father name, or phone number..."
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
            <p className="text-xs font-bold text-slate-500">Loading pending dues and defaulters ledger...</p>
          </div>
        ) : viewFormat === 'summary' ? (
          /* SUMMARIZED FORMAT TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-12 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 border border-slate-300">Class</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Section</th>
                  <th className="py-2.5 px-3 w-32 text-center border border-slate-300">Defaulters</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">1 Month Due</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">2 Months Due</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">3+ Months Due</th>
                  <th className="py-2.5 px-3 w-44 text-right border border-slate-300">Total Pending Dues (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                      No fee defaulters found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((s, idx) => (
                    <tr key={`${s.className}-${s.section}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 border border-slate-200">
                        {s.className}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-700 border border-slate-200">
                        Section {s.section}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-rose-700 border border-slate-200">
                        {s.defaulterCount}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-700 border border-slate-200">
                        {s.due1MonthCount}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-amber-700 font-bold border border-slate-200">
                        {s.due2MonthsCount}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-rose-700 font-bold border border-slate-200">
                        {s.due3PlusMonthsCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 border border-slate-200">
                        Rs. {s.totalPendingAmount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td className="py-2.5 px-3 border border-slate-300">All Displayed Classes</td>
                  <td className="py-2.5 px-3 text-center border border-slate-300">—</td>
                  <td className="py-2.5 px-3 text-center font-mono text-rose-800 text-sm border border-slate-300">
                    {summaryTotals.defaulters}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-900 border border-slate-300">
                    {summaryTotals.due1Month}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-amber-800 border border-slate-300">
                    {summaryTotals.due2Months}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-rose-800 border border-slate-300">
                    {summaryTotals.due3PlusMonths}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-800 text-sm border border-slate-300">
                    Rs. {summaryTotals.totalPending.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* DETAILED BREAKDOWN TABLE (Student-by-Student Ledger) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-10 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Roll #</th>
                  <th className="py-2.5 px-3 border border-slate-300">Student Name</th>
                  <th className="py-2.5 px-3 border border-slate-300">Father Name</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Class-Sec</th>
                  <th className="py-2.5 px-3 w-32 border border-slate-300">Father Contact</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Overdue</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Since</th>
                  <th className="py-2.5 px-3 border border-slate-300">Pending Months Breakdown (kb kb k)</th>
                  <th className="py-2.5 px-3 w-36 text-right border border-slate-300">Total Pending (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                      No student fee dues recorded under the selected parameters.
                    </td>
                  </tr>
                ) : (
                  filteredBreakdown.map((item, idx) => (
                    <tr key={item.studentId || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
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
                      <td className="py-2 px-3 border border-slate-200 font-mono text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          <span>{item.fatherPhone}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center border border-slate-200">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                            item.monthsDueCount >= 3
                              ? 'bg-rose-100 text-rose-800'
                              : item.monthsDueCount === 2
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {item.monthsDueCount} {item.monthsDueCount === 1 ? 'Month' : 'Months'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 border border-slate-200">
                        {item.oldestMonth}
                      </td>
                      <td className="py-2 px-3 border border-slate-200">
                        <div className="flex flex-wrap gap-1">
                          {item.pendingVouchers.map((pv) => (
                            <span
                              key={pv.voucherNo}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-semibold"
                            >
                              <span>{pv.monthYear}:</span>
                              <span className="font-bold">Rs. {pv.balance.toLocaleString()}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-rose-700 text-sm border border-slate-200">
                        Rs. {(item.totalPendingBalance ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td colSpan={2} className="py-2.5 px-3 border border-slate-300 font-bold">
                    {filteredBreakdown.length} Defaulters Listed
                  </td>
                  <td colSpan={6} className="py-2.5 px-3 border border-slate-300 text-right font-bold text-slate-700">
                    Grand Total Outstanding Dues:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-800 text-sm border border-slate-300">
                    Rs. {breakdownTotals.totalPending.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
