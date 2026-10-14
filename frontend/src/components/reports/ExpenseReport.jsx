import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Receipt,
  Download,
  FileDown,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Layers,
  Tag,
} from 'lucide-react';

export default function ExpenseReport({ schoolCode }) {
  // Parameters
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedMonthYear, setSelectedMonthYear] = useState('ALL');
  const [selectedRecordedBy, setSelectedRecordedBy] = useState('ALL');
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
    principalTitle: 'Principal',
  });

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

  // Fetch Expense Report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        schoolCode,
        categoryId: selectedCategory,
        monthYear: selectedMonthYear,
        recordedBy: selectedRecordedBy,
      };

      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/reports/expenses', { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching expense report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedCategory, selectedMonthYear, selectedRecordedBy]);

  const handleResetFilters = () => {
    setSelectedCategory('ALL');
    setSelectedMonthYear('ALL');
    setSelectedRecordedBy('ALL');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
  };

  // Filtered Summary
  const filteredSummary = useMemo(() => {
    if (!reportData?.summarizedList) return [];
    return reportData.summarizedList.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.categoryName?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // Filtered Breakdown
  const filteredBreakdown = useMemo(() => {
    if (!reportData?.detailedBreakdown) return [];
    return reportData.detailedBreakdown.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.voucherNo?.toLowerCase().includes(q) ||
          item.remarks?.toLowerCase().includes(q) ||
          item.categoryName?.toLowerCase().includes(q) ||
          item.recordedBy?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // Summary Totals
  const summaryTotals = useMemo(() => {
    return filteredSummary.reduce(
      (acc, curr) => ({
        vouchers: acc.vouchers + (curr.voucherCount || 0),
        amount: acc.amount + (curr.totalAmount || 0),
      }),
      { vouchers: 0, amount: 0 }
    );
  }, [filteredSummary]);

  // Breakdown Totals
  const breakdownTotals = useMemo(() => {
    return filteredBreakdown.reduce(
      (acc, curr) => ({
        amount: acc.amount + (Number(curr.amount) || 0),
      }),
      { amount: 0 }
    );
  }, [filteredBreakdown]);

  // 1. Export to Excel (.xlsx) using ExcelJS
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = viewFormat === 'summary' ? 'Expense Category Summary' : 'Expense Ledger';
    const worksheet = workbook.addWorksheet(sheetName);

    // School Title Header
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = `${schoolProfile.schoolName || 'School'} - School Expenditure & Expense Report`;
    worksheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF041633' },
    };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    // Subtitle & Filters
    worksheet.mergeCells('A2:G2');
    worksheet.getCell('A2').value = `Category: ${selectedCategory} | Date Range: ${fromDate || 'Earliest'} to ${toDate || 'Latest'} | Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A2').font = { size: 9, italic: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Blank line

    if (viewFormat === 'summary') {
      const headerRow = worksheet.addRow([
        '#',
        'Expense Category',
        'Vouchers Count',
        'Total Expenditure (PKR)',
        'Share of Total Expense (%)',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredSummary.forEach((s, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          s.categoryName,
          s.voucherCount,
          s.totalAmount,
          `${s.percentage}%`,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'right' };
        row.getCell(5).alignment = { horizontal: 'center' };
      });

      // Total Row
      const totalRow = worksheet.addRow([
        'TOTAL',
        'All Categories',
        summaryTotals.vouchers,
        summaryTotals.amount,
        '100%',
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      totalRow.getCell(4).alignment = { horizontal: 'right' };
    } else {
      // Detailed Ledger
      const headerRow = worksheet.addRow([
        '#',
        'Voucher No',
        'Expense Date',
        'Category Name',
        'Description / Remarks',
        'Recorded By / Accountant',
        'Amount (PKR)',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredBreakdown.forEach((item, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          item.voucherNo,
          item.dateString,
          item.categoryName,
          item.remarks,
          item.recordedBy,
          item.amount,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'right' };
      });

      // Total Row
      const totalRow = worksheet.addRow([
        'TOTAL',
        '—',
        `${filteredBreakdown.length} Transactions`,
        '—',
        'Grand Total Expenditures:',
        '—',
        breakdownTotals.amount,
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      totalRow.getCell(7).alignment = { horizontal: 'right' };
    }

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `School_Expense_${viewFormat}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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
          ? `SCHOOL EXPENDITURE REPORT — CATEGORY-WISE SUMMARY`
          : `SCHOOL EXPENDITURE REPORT — DETAILED EXPENSE VOUCHER LEDGER`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(4, 22, 51);
      doc.text(reportTitle, pageWidth / 2, currentY, { align: 'center' });

      // Parameters Ribbon
      currentY += 4.2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      const paramsText = `Category: ${selectedCategory}  |  Accountant: ${selectedRecordedBy}  |  Range: ${fromDate || 'Earliest'} to ${toDate || 'Latest'}  |  Generated: ${new Date().toLocaleString()}`;
      doc.text(paramsText, pageWidth / 2, currentY, { align: 'center' });

      currentY += 4;

      if (viewFormat === 'summary') {
        const tableHead = [
          ['#', 'Expense Category', 'Vouchers Count', 'Total Amount (PKR)', 'Share %'],
        ];

        const tableBody = filteredSummary.map((s, idx) => [
          idx + 1,
          s.categoryName,
          s.voucherCount,
          s.totalAmount.toLocaleString(),
          `${s.percentage}%`,
        ]);

        tableBody.push([
          'TOTAL',
          'All Categories',
          summaryTotals.vouchers,
          summaryTotals.amount.toLocaleString(),
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
            fontSize: 8.5,
            halign: 'center',
            cellPadding: 2.2,
          },
          bodyStyles: {
            fontSize: 8.5,
            textColor: [30, 41, 59],
            cellPadding: 2.2,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 14 },
            1: { halign: 'left', cellWidth: 90, fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 40 },
            3: { halign: 'right', cellWidth: 60, fontStyle: 'bold', textColor: [185, 28, 28] },
            4: { halign: 'center', cellWidth: 40 },
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
          ['#', 'Voucher #', 'Date', 'Category', 'Description / Remarks', 'Recorded By', 'Amount (PKR)'],
        ];

        const tableBody = filteredBreakdown.map((item, idx) => [
          idx + 1,
          item.voucherNo || '—',
          item.dateString || '—',
          item.categoryName || '—',
          item.remarks || '—',
          item.recordedBy || 'School Accountant',
          (item.amount ?? 0).toLocaleString(),
        ]);

        tableBody.push([
          'TOTAL',
          '—',
          `${filteredBreakdown.length} Records`,
          '—',
          'Grand Total Expenditures:',
          '—',
          breakdownTotals.amount.toLocaleString(),
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
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'center', cellWidth: 32, fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 26 },
            3: { halign: 'left', cellWidth: 50, fontStyle: 'bold' },
            4: { halign: 'left', cellWidth: 70 },
            5: { halign: 'center', cellWidth: 42 },
            6: { halign: 'right', cellWidth: 36, fontStyle: 'bold', textColor: [185, 28, 28] },
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

      doc.text('Accounts Officer / Cashier', col1X + 23, sigY + 4, { align: 'center' });
      doc.text('Admin / Finance Incharge', col2X, sigY + 4, { align: 'center' });
      doc.text(principalTitle, col3X + 18, sigY + 4, { align: 'center' });

      const fileName = `School_Expense_${viewFormat.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
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
              <Receipt className="w-6 h-6 text-[#ffa000]" />
              School Expense & Expenditure Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Detailed tracking of campus utilities, stationery, lab supplies, maintenance, and administrative expenses.
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
              onClick={() => setViewFormat('summary')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewFormat === 'summary'
                  ? 'bg-[#041633] text-[#ffa000] shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Summarized Format (Category-wise Totals)
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
              Detailed Breakdown (Expense Voucher Ledger)
            </button>
          </div>

          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Total Expenditure:</span>
            <span className="font-mono text-sm font-black text-rose-700">
              Rs. {(reportData?.summary?.totalExpensesAmount || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 3. Parameter Filters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-3 text-xs">
          {/* Category Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Categories</option>
              {(reportData?.categories || []).map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Recorded By / Accountant */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Recorded By</label>
            <select
              value={selectedRecordedBy}
              onChange={(e) => setSelectedRecordedBy(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Accountants</option>
              {(reportData?.recordedByList || ['School Accountant']).map((rec) => (
                <option key={rec} value={rec}>{rec}</option>
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
              placeholder="Search by voucher number, expense remarks, or category..."
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
            <p className="text-xs font-bold text-slate-500">Loading school expense report...</p>
          </div>
        ) : viewFormat === 'summary' ? (
          /* SUMMARIZED FORMAT TABLE (Category Breakdown) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-12 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 border border-slate-300">Expense Category</th>
                  <th className="py-2.5 px-3 w-32 text-center border border-slate-300">Vouchers Count</th>
                  <th className="py-2.5 px-3 w-44 text-right border border-slate-300">Total Spent (PKR)</th>
                  <th className="py-2.5 px-3 w-32 text-center border border-slate-300">Share of Total (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                      No expense transactions recorded matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((c, idx) => (
                    <tr key={c.categoryName} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 border border-slate-200">
                        {c.categoryName}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border border-slate-200">
                        {c.voucherCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 border border-slate-200">
                        Rs. {c.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-700 border border-slate-200">
                        {c.percentage}%
                      </td>
                    </tr>
                  ))
                )}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td className="py-2.5 px-3 border border-slate-300">All Displayed Categories</td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-900 border border-slate-300">
                    {summaryTotals.vouchers}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-800 text-sm border border-slate-300">
                    Rs. {summaryTotals.amount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-900 border border-slate-300">
                    100%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* DETAILED BREAKDOWN TABLE (Voucher Ledger) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-10 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Voucher #</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Expense Date</th>
                  <th className="py-2.5 px-3 w-40 border border-slate-300">Category</th>
                  <th className="py-2.5 px-3 border border-slate-300">Description / Remarks</th>
                  <th className="py-2.5 px-3 w-36 border border-slate-300">Recorded By</th>
                  <th className="py-2.5 px-3 w-36 text-right border border-slate-300">Amount (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      No expense vouchers found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBreakdown.map((item, idx) => (
                    <tr key={item._id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 border border-slate-200">
                        {item.voucherNo}
                      </td>
                      <td className="py-2 px-3 text-center font-medium text-slate-600 border border-slate-200">
                        {item.dateString}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 border border-slate-200">
                        {item.categoryName}
                      </td>
                      <td className="py-2 px-3 text-slate-700 border border-slate-200">
                        {item.remarks}
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium border border-slate-200">
                        {item.recordedBy || 'School Accountant'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-rose-700 text-sm border border-slate-200">
                        Rs. {(item.amount ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td colSpan={2} className="py-2.5 px-3 border border-slate-300 font-bold">
                    {filteredBreakdown.length} Expenses Listed
                  </td>
                  <td colSpan={3} className="py-2.5 px-3 border border-slate-300 text-right font-bold text-slate-700">
                    Grand Total Expenditure:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-800 text-sm border border-slate-300">
                    Rs. {breakdownTotals.amount.toLocaleString()}
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
