import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CreditCard,
  Download,
  FileDown,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  CheckCircle,
  Clock,
} from 'lucide-react';

export default function StaffSalaryReport({ schoolCode }) {
  // Parameters
  const [selectedMonthYear, setSelectedMonthYear] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // View format toggle: 'summary' or 'breakdown'
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

  // Fetch Staff Salary Report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        schoolCode,
        monthYear: selectedMonthYear,
        role: selectedRole,
        status: selectedStatus,
        paymentMethod: selectedMethod,
      };

      const res = await api.get('/reports/staff-salaries', { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching staff salary report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonthYear, selectedRole, selectedStatus, selectedMethod]);

  const handleResetFilters = () => {
    setSelectedRole('ALL');
    setSelectedStatus('ALL');
    setSelectedMethod('ALL');
    setSearchQuery('');
  };

  // Filtered Summary
  const filteredSummary = useMemo(() => {
    if (!reportData?.summarizedList) return [];
    return reportData.summarizedList.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.role?.toLowerCase().includes(q);
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
          item.name?.toLowerCase().includes(q) ||
          item.employeeId?.toLowerCase().includes(q) ||
          item.role?.toLowerCase().includes(q) ||
          item.salaryId?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // Summary Totals
  const summaryTotals = useMemo(() => {
    return filteredSummary.reduce(
      (acc, curr) => ({
        staffCount: acc.staffCount + (curr.staffCount || 0),
        basic: acc.basic + (curr.totalBasic || 0),
        deductions: acc.deductions + (curr.totalDeductions || 0),
        netPayable: acc.netPayable + (curr.totalNetPayable || 0),
        paid: acc.paid + (curr.totalPaid || 0),
        pending: acc.pending + (curr.totalPending || 0),
      }),
      { staffCount: 0, basic: 0, deductions: 0, netPayable: 0, paid: 0, pending: 0 }
    );
  }, [filteredSummary]);

  // Breakdown Totals
  const breakdownTotals = useMemo(() => {
    return filteredBreakdown.reduce(
      (acc, curr) => ({
        basic: acc.basic + (Number(curr.basicSalary) || 0),
        deductions: acc.deductions + (Number(curr.totalDeductions) || 0),
        allowances: acc.allowances + (Number(curr.bonusesOrAllowance) || 0),
        net: acc.net + (Number(curr.netSalary) || 0),
      }),
      { basic: 0, deductions: 0, allowances: 0, net: 0 }
    );
  }, [filteredBreakdown]);

  // 1. Export to Excel (.xlsx) using ExcelJS
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = viewFormat === 'summary' ? 'Payroll Summary' : 'Staff Salary Ledger';
    const worksheet = workbook.addWorksheet(sheetName);

    // School Title Header
    worksheet.mergeCells('A1:L1');
    worksheet.getCell('A1').value = `${schoolProfile.schoolName || 'School'} - Staff Salaries & Monthly Payroll Report`;
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
    worksheet.getCell('A2').value = `Month: ${selectedMonthYear} | Role: ${selectedRole} | Status: ${selectedStatus} | Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A2').font = { size: 9, italic: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Blank line

    if (viewFormat === 'summary') {
      const headerRow = worksheet.addRow([
        '#',
        'Staff Designation / Role',
        'Staff Count',
        'Gross Basic Salary (PKR)',
        'Attendance Deductions (PKR)',
        'Net Payable Payroll (PKR)',
        'Disbursed Amount (PKR)',
        'Pending Payroll (PKR)',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredSummary.forEach((s, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          s.role,
          s.staffCount,
          s.totalBasic,
          s.totalDeductions,
          s.totalNetPayable,
          s.totalPaid,
          s.totalPending,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'right' };
        row.getCell(5).alignment = { horizontal: 'right' };
        row.getCell(6).alignment = { horizontal: 'right' };
        row.getCell(7).alignment = { horizontal: 'right' };
        row.getCell(8).alignment = { horizontal: 'right' };
      });

      // Total Row
      const totalRow = worksheet.addRow([
        'TOTAL',
        'All Designations',
        summaryTotals.staffCount,
        summaryTotals.basic,
        summaryTotals.deductions,
        summaryTotals.netPayable,
        summaryTotals.paid,
        summaryTotals.pending,
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      totalRow.getCell(4).alignment = { horizontal: 'right' };
      totalRow.getCell(5).alignment = { horizontal: 'right' };
      totalRow.getCell(6).alignment = { horizontal: 'right' };
      totalRow.getCell(7).alignment = { horizontal: 'right' };
      totalRow.getCell(8).alignment = { horizontal: 'right' };
    } else {
      // Detailed Ledger
      const headerRow = worksheet.addRow([
        '#',
        'Salary ID',
        'Emp ID',
        'Staff Name',
        'Role / Designation',
        'Month',
        'Basic Salary (PKR)',
        'Deductions (PKR)',
        'Allowances (PKR)',
        'Net Salary (PKR)',
        'Status',
        'Disbursed Date',
        'Method',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredBreakdown.forEach((item, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          item.salaryId,
          item.employeeId,
          item.name,
          item.role,
          item.monthYear,
          item.basicSalary,
          item.totalDeductions,
          item.bonusesOrAllowance,
          item.netSalary,
          item.status,
          item.paidDate,
          item.paymentMethod,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'right' };
        row.getCell(8).alignment = { horizontal: 'right' };
        row.getCell(9).alignment = { horizontal: 'right' };
        row.getCell(10).alignment = { horizontal: 'right' };
        row.getCell(11).alignment = { horizontal: 'center' };
        row.getCell(12).alignment = { horizontal: 'center' };
        row.getCell(13).alignment = { horizontal: 'center' };
      });

      // Total Row
      const totalRow = worksheet.addRow([
        'TOTAL',
        '—',
        '—',
        `${filteredBreakdown.length} Records`,
        '—',
        '—',
        breakdownTotals.basic,
        breakdownTotals.deductions,
        breakdownTotals.allowances,
        breakdownTotals.net,
        '—',
        '—',
        '—',
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      totalRow.getCell(7).alignment = { horizontal: 'right' };
      totalRow.getCell(8).alignment = { horizontal: 'right' };
      totalRow.getCell(9).alignment = { horizontal: 'right' };
      totalRow.getCell(10).alignment = { horizontal: 'right' };
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
    a.download = `Staff_Salary_${viewFormat}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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
          ? `STAFF SALARIES & PAYROLL REPORT — DESIGNATION-WISE SUMMARY`
          : `STAFF SALARIES & PAYROLL REPORT — INDIVIDUAL PAYROLL LEDGER`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(4, 22, 51);
      doc.text(reportTitle, pageWidth / 2, currentY, { align: 'center' });

      // Parameters Ribbon
      currentY += 4.2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      const paramsText = `Month: ${selectedMonthYear}  |  Role: ${selectedRole}  |  Status: ${selectedStatus}  |  Generated: ${new Date().toLocaleString()}`;
      doc.text(paramsText, pageWidth / 2, currentY, { align: 'center' });

      currentY += 4;

      if (viewFormat === 'summary') {
        const tableHead = [
          ['#', 'Designation / Role', 'Staff Count', 'Basic (PKR)', 'Deductions (PKR)', 'Net Payable (PKR)', 'Paid (PKR)', 'Pending (PKR)'],
        ];

        const tableBody = filteredSummary.map((s, idx) => [
          idx + 1,
          s.role,
          s.staffCount,
          s.totalBasic.toLocaleString(),
          s.totalDeductions.toLocaleString(),
          s.totalNetPayable.toLocaleString(),
          s.totalPaid.toLocaleString(),
          s.totalPending.toLocaleString(),
        ]);

        tableBody.push([
          'TOTAL',
          'All Designations',
          summaryTotals.staffCount,
          summaryTotals.basic.toLocaleString(),
          summaryTotals.deductions.toLocaleString(),
          summaryTotals.netPayable.toLocaleString(),
          summaryTotals.paid.toLocaleString(),
          summaryTotals.pending.toLocaleString(),
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
            1: { halign: 'left', cellWidth: 50, fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 26 },
            3: { halign: 'right', cellWidth: 36 },
            4: { halign: 'right', cellWidth: 34, textColor: [185, 28, 28] },
            5: { halign: 'right', cellWidth: 38, fontStyle: 'bold' },
            6: { halign: 'right', cellWidth: 38, textColor: [21, 128, 61], fontStyle: 'bold' },
            7: { halign: 'right', cellWidth: 38, textColor: [185, 28, 28], fontStyle: 'bold' },
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
          ['#', 'Emp ID', 'Staff Name', 'Role', 'Month', 'Basic (PKR)', 'Deductions', 'Allowances', 'Net Pay (PKR)', 'Status', 'Date', 'Method'],
        ];

        const tableBody = filteredBreakdown.map((item, idx) => [
          idx + 1,
          item.employeeId,
          item.name,
          item.role,
          item.monthYear,
          (item.basicSalary ?? 0).toLocaleString(),
          (item.totalDeductions ?? 0).toLocaleString(),
          (item.bonusesOrAllowance ?? 0).toLocaleString(),
          (item.netSalary ?? 0).toLocaleString(),
          item.status,
          item.paidDate || '—',
          item.paymentMethod || 'CASH',
        ]);

        tableBody.push([
          'TOTAL',
          '—',
          `${filteredBreakdown.length} Records`,
          '—',
          '—',
          breakdownTotals.basic.toLocaleString(),
          breakdownTotals.deductions.toLocaleString(),
          breakdownTotals.allowances.toLocaleString(),
          breakdownTotals.net.toLocaleString(),
          '—',
          '—',
          '—',
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
            2: { halign: 'left', cellWidth: 40, fontStyle: 'bold' },
            3: { halign: 'left', cellWidth: 32 },
            4: { halign: 'center', cellWidth: 18 },
            5: { halign: 'right', cellWidth: 26 },
            6: { halign: 'right', cellWidth: 24, textColor: [185, 28, 28] },
            7: { halign: 'right', cellWidth: 24, textColor: [21, 128, 61] },
            8: { halign: 'right', cellWidth: 30, fontStyle: 'bold', textColor: [4, 22, 51] },
            9: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
            10: { halign: 'center', cellWidth: 20 },
            11: { halign: 'center', cellWidth: 18 },
          },
          didParseCell: (data) => {
            if (data.row.index === tableBody.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [241, 245, 249];
            } else if (data.section === 'body' && data.column.index === 9) {
              const status = data.cell.raw;
              if (status === 'PAID') {
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

      doc.text('Accounts Officer / Payroll', col1X + 23, sigY + 4, { align: 'center' });
      doc.text('Admin / Finance Incharge', col2X, sigY + 4, { align: 'center' });
      doc.text(principalTitle, col3X + 18, sigY + 4, { align: 'center' });

      const fileName = `Staff_Salary_${viewFormat.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
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
              <CreditCard className="w-6 h-6 text-[#ffa000]" />
              <span>Staff Salaries & Payroll Report</span>
            </h2>
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
              Detailed Breakdown (Individual Payroll Ledger)
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
              Summarized Format (Designation Totals)
            </button>
          </div>

          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Disbursement Rate:</span>
            <span className="font-mono text-sm font-black text-emerald-700">
              {reportData?.summary?.disbursementRate ?? 0}%
            </span>
          </div>
        </div>

        {/* 3. Parameter Filters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-3 text-xs">
          {/* Month Year */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Month-Year</label>
            <input
              type="month"
              value={selectedMonthYear}
              onChange={(e) => setSelectedMonthYear(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Role Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Designation</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Roles</option>
              {['Teacher', 'Head Teacher / Vice Principal', 'Principal / Director', 'Accountant', 'Admin / Clerk', 'Librarian', 'Lab Assistant', 'Support Staff / Peon / Guard'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Payment Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Disbursed / Paid</option>
              <option value="GENERATED">Generated / Pending</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          {/* Method Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
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
              placeholder="Search by staff name, employee ID, role, or salary ID..."
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
            <p className="text-xs font-bold text-slate-500">Loading staff salary report...</p>
          </div>
        ) : viewFormat === 'summary' ? (
          /* SUMMARIZED FORMAT TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-12 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 border border-slate-300">Staff Designation</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Staff Count</th>
                  <th className="py-2.5 px-3 w-36 text-right border border-slate-300">Basic (PKR)</th>
                  <th className="py-2.5 px-3 w-36 text-right border border-slate-300">Deductions (PKR)</th>
                  <th className="py-2.5 px-3 w-36 text-right border border-slate-300">Net Payable (PKR)</th>
                  <th className="py-2.5 px-3 w-36 text-right border border-slate-300">Disbursed (PKR)</th>
                  <th className="py-2.5 px-3 w-36 text-right border border-slate-300">Pending (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                      No staff salary records found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((s, idx) => (
                    <tr key={s.role} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 border border-slate-200">
                        {s.role}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border border-slate-200">
                        {s.staffCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-800 border border-slate-200">
                        Rs. {s.totalBasic.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-rose-700 font-bold border border-slate-200">
                        Rs. {s.totalDeductions.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-slate-900 border border-slate-200">
                        Rs. {s.totalNetPayable.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 border border-slate-200">
                        Rs. {s.totalPaid.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-amber-700 border border-slate-200">
                        Rs. {s.totalPending.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td className="py-2.5 px-3 border border-slate-300">All Designations</td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-900 border border-slate-300">
                    {summaryTotals.staffCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-900 border border-slate-300">
                    Rs. {summaryTotals.basic.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-800 border border-slate-300">
                    Rs. {summaryTotals.deductions.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-950 text-sm border border-slate-300">
                    Rs. {summaryTotals.netPayable.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm border border-slate-300">
                    Rs. {summaryTotals.paid.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-800 text-sm border border-slate-300">
                    Rs. {summaryTotals.pending.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* DETAILED BREAKDOWN TABLE (Payroll Ledger) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-10 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Emp ID</th>
                  <th className="py-2.5 px-3 border border-slate-300">Staff Name</th>
                  <th className="py-2.5 px-3 border border-slate-300">Designation</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Month</th>
                  <th className="py-2.5 px-3 w-28 text-right border border-slate-300">Basic (PKR)</th>
                  <th className="py-2.5 px-3 w-28 text-right border border-slate-300">Deductions</th>
                  <th className="py-2.5 px-3 w-28 text-right border border-slate-300">Allowances</th>
                  <th className="py-2.5 px-3 w-32 text-right border border-slate-300">Net Salary (PKR)</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Status</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Paid Date</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400 font-medium">
                      No payroll slip records found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBreakdown.map((item, idx) => (
                    <tr key={item._id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 border border-slate-200">
                        {item.employeeId}
                      </td>
                      <td className="py-2 px-3 font-black text-slate-900 border border-slate-200">
                        {item.name}
                      </td>
                      <td className="py-2 px-3 text-slate-700 border border-slate-200">
                        {item.role}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 border border-slate-200">
                        {item.monthYear}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-800 border border-slate-200">
                        Rs. {(item.basicSalary ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-rose-700 font-bold border border-slate-200">
                        Rs. {(item.totalDeductions ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold border border-slate-200">
                        Rs. {(item.bonusesOrAllowance ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-slate-950 text-sm border border-slate-200">
                        Rs. {(item.netSalary ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-center border border-slate-200">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                            item.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 border border-slate-200">
                        {item.paidDate}
                      </td>
                      <td className="py-2 px-3 text-center font-medium text-[11px] border border-slate-200">
                        {item.paymentMethod}
                      </td>
                    </tr>
                  ))
                )}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td colSpan={2} className="py-2.5 px-3 border border-slate-300 font-bold">
                    {filteredBreakdown.length} Records Listed
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 border border-slate-300 text-right font-bold text-slate-700">
                    Grand Payroll Totals:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-950 text-xs border border-slate-300">
                    Rs. {breakdownTotals.basic.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-800 text-xs border border-slate-300">
                    Rs. {breakdownTotals.deductions.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-xs border border-slate-300">
                    Rs. {breakdownTotals.allowances.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-950 text-sm border border-slate-300">
                    Rs. {breakdownTotals.net.toLocaleString()}
                  </td>
                  <td colSpan={3} className="py-2.5 px-3 border border-slate-300 text-center">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
