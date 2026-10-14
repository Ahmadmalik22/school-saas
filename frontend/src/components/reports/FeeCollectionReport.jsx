import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../context/AcademicClassesContext';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Banknote,
  Download,
  FileDown,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Hash,
} from 'lucide-react';

export default function FeeCollectionReport({ schoolCode }) {
  const { classes } = useAcademicClasses();
  const { currentSession, sessions } = useAcademicSession();

  const classList = useMemo(() => {
    return classes && classes.length > 0
      ? classes.map((c) => c.name || c)
      : ['Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
  }, [classes]);

  // Parameters
  const [selectedSession, setSelectedSession] = useState(currentSession || '2025-2026');
  const [periodMode, setPeriodMode] = useState('ALL'); // ALL, DAILY, MONTHLY, ANNUAL
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PAID, PARTIALLY_PAID, UNPAID
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL'); // ALL, CASH, BANK_TRANSFER, ONLINE, CHEQUE
  const [selectedAccountant, setSelectedAccountant] = useState('ALL');
  const [rollNumbersFilter, setRollNumbersFilter] = useState(''); // e.g. "101" or "101, 102"
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

  // Adjust Date Range based on Period Mode Presets
  const handlePeriodModeChange = (mode) => {
    setPeriodMode(mode);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (mode === 'DAILY') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (mode === 'MONTHLY') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const firstDay = `${year}-${month}-01`;
      const lastDay = new Date(year, today.getMonth() + 1, 0).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(lastDay);
    } else if (mode === 'ANNUAL') {
      const year = today.getFullYear();
      setFromDate(`${year}-01-01`);
      setToDate(`${year}-12-31`);
    } else {
      setFromDate('');
      setToDate('');
    }
  };

  // Fetch Fee Collection Report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        schoolCode,
        academicSession: selectedSession,
        className: selectedClass,
        section: selectedSection,
        status: statusFilter,
        paymentMethod: paymentMethodFilter,
        receivedBy: selectedAccountant,
      };

      if (rollNumbersFilter.trim()) {
        params.rollNumbers = rollNumbersFilter.trim();
      }
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await api.get('/reports/fee-collection', { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching fee collection report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedSession, selectedClass, selectedSection, statusFilter, paymentMethodFilter, selectedAccountant, periodMode]);

  const handleResetFilters = () => {
    setPeriodMode('ALL');
    setSelectedClass('ALL');
    setSelectedSection('ALL');
    setStatusFilter('ALL');
    setPaymentMethodFilter('ALL');
    setSelectedAccountant('ALL');
    setRollNumbersFilter('');
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
          item.studentName?.toLowerCase().includes(q) ||
          item.rollNumber?.toLowerCase().includes(q) ||
          item.fatherName?.toLowerCase().includes(q) ||
          item.voucherNo?.toLowerCase().includes(q) ||
          item.receiptNo?.toLowerCase().includes(q) ||
          item.receivedBy?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // Summary Totals for Summarized View
  const summaryTotals = useMemo(() => {
    return filteredSummary.reduce(
      (acc, curr) => ({
        vouchers: acc.vouchers + (curr.voucherCount || 0),
        invoiced: acc.invoiced + (curr.totalInvoiced || 0),
        discount: acc.discount + (curr.totalDiscount || 0),
        collected: acc.collected + (curr.totalCollected || 0),
        balance: acc.balance + (curr.totalBalance || 0),
      }),
      { vouchers: 0, invoiced: 0, discount: 0, collected: 0, balance: 0 }
    );
  }, [filteredSummary]);

  // Breakdown Totals for Detailed Ledger View
  const breakdownTotals = useMemo(() => {
    return filteredBreakdown.reduce(
      (acc, curr) => ({
        payable: acc.payable + (Number(curr.totalPayable) || 0),
        paid: acc.paid + (Number(curr.paidAmount) || 0),
        balance: acc.balance + (Number(curr.balance) || 0),
      }),
      { payable: 0, paid: 0, balance: 0 }
    );
  }, [filteredBreakdown]);

  // 1. Export to Excel (.xlsx) using ExcelJS
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = viewFormat === 'summary' ? 'Fee Collection Summary' : 'Collection Ledger';
    const worksheet = workbook.addWorksheet(sheetName);

    // School Title Header
    worksheet.mergeCells('A1:L1');
    worksheet.getCell('A1').value = `${schoolProfile.schoolName || 'School'} - Fee Collection Report (${periodMode} Mode)`;
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
    const rollsInfo = rollNumbersFilter ? ` | Rolls: [${rollNumbersFilter}]` : '';
    const accInfo = selectedAccountant !== 'ALL' ? ` | Accountant: ${selectedAccountant}` : '';
    worksheet.getCell('A2').value = `Session: ${selectedSession} | Period: ${periodMode} | Class: ${selectedClass} | Status: ${statusFilter}${accInfo}${rollsInfo} | Range: ${fromDate || 'Earliest'} to ${toDate || 'Latest'} | Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A2').font = { size: 9, italic: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Blank line

    if (viewFormat === 'summary') {
      const headerRow = worksheet.addRow([
        '#',
        'Class',
        'Section',
        'Vouchers Count',
        'Total Invoiced (PKR)',
        'Discount (PKR)',
        'Total Collected (PKR)',
        'Outstanding Balance (PKR)',
        'Collection Rate %',
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
          s.voucherCount,
          s.totalInvoiced,
          s.totalDiscount,
          s.totalCollected,
          s.totalBalance,
          `${s.collectionRate}%`,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'right' };
        row.getCell(6).alignment = { horizontal: 'right' };
        row.getCell(7).alignment = { horizontal: 'right' };
        row.getCell(8).alignment = { horizontal: 'right' };
        row.getCell(9).alignment = { horizontal: 'center' };
      });

      // Total Row
      const grandRate = summaryTotals.invoiced > 0 ? ((summaryTotals.collected / summaryTotals.invoiced) * 100).toFixed(1) : 0;
      const totalRow = worksheet.addRow([
        'TOTAL',
        '—',
        '—',
        summaryTotals.vouchers,
        summaryTotals.invoiced,
        summaryTotals.discount,
        summaryTotals.collected,
        summaryTotals.balance,
        `${grandRate}%`,
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      totalRow.getCell(5).alignment = { horizontal: 'right' };
      totalRow.getCell(6).alignment = { horizontal: 'right' };
      totalRow.getCell(7).alignment = { horizontal: 'right' };
      totalRow.getCell(8).alignment = { horizontal: 'right' };
    } else {
      // Detailed Ledger
      const headerRow = worksheet.addRow([
        '#',
        'Voucher No',
        'Receipt Date',
        'Roll No',
        'Student Name',
        'Father Name',
        'Class-Sec',
        'Month',
        'Payable (PKR)',
        'Paid (PKR)',
        'Balance (PKR)',
        'Method',
        'Collected By / Accountant',
        'Status',
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
          item.receiptDate,
          item.rollNumber,
          item.studentName,
          item.fatherName,
          `${item.className}-${item.section}`,
          item.monthYear,
          item.totalPayable,
          item.paidAmount,
          item.balance,
          item.paymentMethod,
          item.receivedBy || 'School Accountant',
          item.status,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).alignment = { horizontal: 'center' };
        row.getCell(9).alignment = { horizontal: 'right' };
        row.getCell(10).alignment = { horizontal: 'right' };
        row.getCell(11).alignment = { horizontal: 'right' };
        row.getCell(12).alignment = { horizontal: 'center' };
        row.getCell(13).alignment = { horizontal: 'left' };
        row.getCell(14).alignment = { horizontal: 'center' };
      });

      // Total Row
      const totalRow = worksheet.addRow([
        'TOTAL',
        '—',
        '—',
        '—',
        `${filteredBreakdown.length} Records`,
        '—',
        '—',
        '—',
        breakdownTotals.payable,
        breakdownTotals.paid,
        breakdownTotals.balance,
        '—',
        '—',
        '—',
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      totalRow.getCell(9).alignment = { horizontal: 'right' };
      totalRow.getCell(10).alignment = { horizontal: 'right' };
      totalRow.getCell(11).alignment = { horizontal: 'right' };
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
    a.download = `Fee_Collection_${viewFormat}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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
      const periodLabel = periodMode === 'ALL' ? 'DAILY, MONTHLY & ANNUAL' : `${periodMode}`;
      const reportTitle =
        viewFormat === 'summary'
          ? `FEE COLLECTION REPORT (${periodLabel}) — SUMMARIZED FORMAT`
          : `FEE COLLECTION REPORT (${periodLabel}) — DETAILED LEDGER`;

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

      const rollsPill = rollNumbersFilter ? `Rolls: [${rollNumbersFilter}]` : null;
      const filterItems = [
        `Session: ${selectedSession}`,
        `Mode: ${periodMode}`,
        `Class: ${selectedClass === 'ALL' ? 'All Classes' : selectedClass}`,
        `Status: ${statusFilter === 'ALL' ? 'All' : statusFilter}`,
        rollsPill,
        `Date Range: ${fromDate || 'Earliest'} to ${toDate || 'Latest'}`,
        `Printed: ${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      ].filter(Boolean);

      doc.text(filterItems.join('   |   '), pageWidth / 2, currentY + 1.2, { align: 'center' });

      currentY += 6.5;

      // AutoTable Generation
      if (viewFormat === 'summary') {
        const tableHead = [
          ['#', 'Class', 'Section', 'Vouchers', 'Invoiced (PKR)', 'Discount (PKR)', 'Collected (PKR)', 'Balance (PKR)', 'Collection %'],
        ];

        const tableBody = filteredSummary.map((s, idx) => [
          idx + 1,
          s.className,
          `Section ${s.section}`,
          s.voucherCount ?? 0,
          (s.totalInvoiced ?? 0).toLocaleString(),
          (s.totalDiscount ?? 0).toLocaleString(),
          (s.totalCollected ?? 0).toLocaleString(),
          (s.totalBalance ?? 0).toLocaleString(),
          `${s.collectionRate ?? 0}%`,
        ]);

        const grandRate = summaryTotals.invoiced > 0 ? ((summaryTotals.collected / summaryTotals.invoiced) * 100).toFixed(1) : 0;
        tableBody.push([
          'TOTAL',
          'All Classes',
          '—',
          summaryTotals.vouchers,
          summaryTotals.invoiced.toLocaleString(),
          summaryTotals.discount.toLocaleString(),
          summaryTotals.collected.toLocaleString(),
          summaryTotals.balance.toLocaleString(),
          `${grandRate}%`,
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
            1: { halign: 'left', cellWidth: 42, fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 26 },
            3: { halign: 'center', cellWidth: 24 },
            4: { halign: 'right', cellWidth: 34 },
            5: { halign: 'right', cellWidth: 30 },
            6: { halign: 'right', cellWidth: 36, textColor: [21, 128, 61], fontStyle: 'bold' },
            7: { halign: 'right', cellWidth: 36, textColor: [185, 28, 28], fontStyle: 'bold' },
            8: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
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
          ['#', 'Voucher #', 'Date', 'Roll No', 'Student Name', 'Father Name', 'Class-Sec', 'Month', 'Payable', 'Paid', 'Balance', 'Method', 'Accountant', 'Status'],
        ];

        const tableBody = filteredBreakdown.map((item, idx) => [
          idx + 1,
          item.voucherNo || '—',
          item.receiptDate || item.issueDate || '—',
          item.rollNumber || '—',
          item.studentName || '—',
          item.fatherName || '—',
          `${item.className || ''}-${item.section || ''}`,
          item.monthYear || '—',
          (item.totalPayable ?? 0).toLocaleString(),
          (item.paidAmount ?? 0).toLocaleString(),
          (item.balance ?? 0).toLocaleString(),
          item.paymentMethod || 'CASH',
          item.receivedBy || 'Accountant',
          item.status || 'UNPAID',
        ]);

        tableBody.push([
          'TOTAL',
          '—',
          '—',
          '—',
          `${filteredBreakdown.length} Records`,
          '—',
          '—',
          '—',
          breakdownTotals.payable.toLocaleString(),
          breakdownTotals.paid.toLocaleString(),
          breakdownTotals.balance.toLocaleString(),
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
            0: { halign: 'center', cellWidth: 7 },
            1: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 18 },
            3: { halign: 'center', cellWidth: 13, fontStyle: 'bold' },
            4: { halign: 'left', cellWidth: 32, fontStyle: 'bold' },
            5: { halign: 'left', cellWidth: 30 },
            6: { halign: 'center', cellWidth: 16 },
            7: { halign: 'center', cellWidth: 16 },
            8: { halign: 'right', cellWidth: 22 },
            9: { halign: 'right', cellWidth: 22, textColor: [21, 128, 61], fontStyle: 'bold' },
            10: { halign: 'right', cellWidth: 22, textColor: [185, 28, 28], fontStyle: 'bold' },
            11: { halign: 'center', cellWidth: 16 },
            12: { halign: 'left', cellWidth: 26 },
            13: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.row.index === tableBody.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [241, 245, 249];
            } else if (data.section === 'body' && data.column.index === 13) {
              const status = data.cell.raw;
              if (status === 'PAID') {
                data.cell.styles.textColor = [21, 128, 61];
              } else if (status === 'PARTIALLY_PAID') {
                data.cell.styles.textColor = [180, 110, 0];
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

      doc.text('Accounts Officer / Cashier', col1X + 23, sigY + 4, { align: 'center' });
      doc.text('Admin / Finance Incharge', col2X, sigY + 4, { align: 'center' });
      doc.text(principalTitle, col3X + 18, sigY + 4, { align: 'center' });

      const fileName = `Fee_Collection_${viewFormat.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
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
              <Banknote className="w-6 h-6 text-[#ffa000]" />
              Fee Collection Report (Daily, Monthly & Annual)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Analyze fees invoiced, discounts granted, cash/bank collections, and outstanding dues with multi-student roll number filtering.
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

        {/* 2. Format Switcher & Period Quick Mode */}
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
              Detailed Breakdown (Collection Ledger)
            </button>
          </div>

          {/* Quick Period Presets: Daily / Monthly / Annual */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <span className="text-[11px] font-bold text-slate-600 px-2">Preset:</span>
            {['ALL', 'DAILY', 'MONTHLY', 'ANNUAL'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handlePeriodModeChange(mode)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  periodMode === mode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'ALL' ? 'Custom' : mode}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Parameter Filters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-3 text-xs">
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

          {/* Status Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid Only</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="UNPAID">Unpaid / Defaulters</option>
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Method</label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="ONLINE">Online</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>

          {/* Accountant / Received By */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Accountant</label>
            <select
              value={selectedAccountant}
              onChange={(e) => setSelectedAccountant(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Accountants</option>
              {(reportData?.accountants || ['School Accountant']).map((acc) => (
                <option key={acc} value={acc}>{acc}</option>
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
        </div>

        {/* 4. Roll Numbers Filter & Search Query Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
          {/* Roll Numbers Filter: Single or Comma Separated */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 text-xs flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-amber-500" />
              <span>Roll Number(s) Filter:</span>
              <span className="font-normal text-slate-500 text-[10px]">(e.g. 101 or 101, 102)</span>
            </label>
            <input
              type="text"
              placeholder="Enter roll numbers separated by comma..."
              value={rollNumbersFilter}
              onChange={(e) => setRollNumbersFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* General Search Query */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 text-xs">Search Student / Voucher</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name, father, voucher #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-end justify-end gap-2">
            <button
              onClick={handleResetFilters}
              className="text-xs text-slate-600 hover:text-slate-900 underline font-semibold px-2 py-1.5 cursor-pointer"
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

      {/* 5. Official Report Sheet (Target for Print & Vector PDF) */}
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
              FEE COLLECTION REPORT ({periodMode === 'ALL' ? 'DAILY, MONTHLY & ANNUAL' : `${periodMode} MODE`}) — {viewFormat === 'summary' ? 'SUMMARIZED FORMAT' : 'COLLECTION LEDGER'}
            </h2>
          </div>
          <div className="text-[11px] text-slate-600 font-semibold mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span>Session: <strong>{selectedSession}</strong></span>
            <span>•</span>
            <span>Period: <strong>{periodMode}</strong></span>
            <span>•</span>
            <span>Class: <strong>{selectedClass === 'ALL' ? 'All Classes' : selectedClass}</strong></span>
            <span>•</span>
            <span>Section: <strong>{selectedSection === 'ALL' ? 'All Sections' : selectedSection}</strong></span>
            <span>•</span>
            <span>Status: <strong>{statusFilter === 'ALL' ? 'All' : statusFilter}</strong></span>
            {rollNumbersFilter && (
              <>
                <span>•</span>
                <span>Rolls Filter: <strong className="font-mono">[{rollNumbersFilter}]</strong></span>
              </>
            )}
            <span>•</span>
            <span>Range: <strong>{fromDate || 'Earliest'} to {toDate || 'Latest'}</strong></span>
            <span>•</span>
            <span>Generated: <strong>{new Date().toLocaleString()}</strong></span>
          </div>
        </div>

        {/* 6. Main Content: Summarized Format vs Detailed Breakdown */}
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="font-semibold text-slate-600 text-sm">Loading fee collection data...</p>
          </div>
        ) : !reportData || (viewFormat === 'summary' ? filteredSummary.length === 0 : filteredBreakdown.length === 0) ? (
          <div className="py-16 text-center text-slate-400">
            <Banknote className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-700 text-base">No Fee Collection Records Found</p>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting the date range, class, section, status, or roll number filters above.
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
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Vouchers</th>
                  <th className="py-2.5 px-3 w-36 text-right border border-slate-300">Invoiced (PKR)</th>
                  <th className="py-2.5 px-3 w-32 text-right border border-slate-300">Discount (PKR)</th>
                  <th className="py-2.5 px-3 w-36 text-right border border-slate-300">Collected (PKR)</th>
                  <th className="py-2.5 px-3 w-36 text-right border border-slate-300">Balance / Due</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Collection %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredSummary.map((s, idx) => (
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
                    <td className="py-2 px-3 text-center font-bold text-slate-700 border border-slate-200">
                      {s.voucherCount}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border border-slate-200">
                      Rs. {(s.totalInvoiced ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 border border-slate-200">
                      Rs. {(s.totalDiscount ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 border border-slate-200">
                      Rs. {(s.totalCollected ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 border border-slate-200">
                      Rs. {(s.totalBalance ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-center font-black text-slate-900 border border-slate-200">
                      <span className={s.collectionRate >= 80 ? 'text-emerald-700' : 'text-amber-700'}>
                        {s.collectionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td className="py-2.5 px-3 border border-slate-300">All Displayed Classes</td>
                  <td className="py-2.5 px-3 text-center border border-slate-300">—</td>
                  <td className="py-2.5 px-3 text-center text-slate-900 border border-slate-300">
                    {summaryTotals.vouchers}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-950 border border-slate-300">
                    Rs. {summaryTotals.invoiced.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700 border border-slate-300">
                    Rs. {summaryTotals.discount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm border border-slate-300">
                    Rs. {summaryTotals.collected.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-800 text-sm border border-slate-300">
                    Rs. {summaryTotals.balance.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-center border border-slate-300">
                    {summaryTotals.invoiced > 0 ? `${((summaryTotals.collected / summaryTotals.invoiced) * 100).toFixed(1)}%` : '0%'}
                  </td>
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
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Voucher #</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Receipt Date</th>
                  <th className="py-2.5 px-3 w-18 text-center border border-slate-300">Roll No</th>
                  <th className="py-2.5 px-3 border border-slate-300">Student Name</th>
                  <th className="py-2.5 px-3 border border-slate-300">Father Name</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Class-Sec</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Month</th>
                  <th className="py-2.5 px-3 w-28 text-right border border-slate-300">Payable</th>
                  <th className="py-2.5 px-3 w-28 text-right border border-slate-300">Paid Amount</th>
                  <th className="py-2.5 px-3 w-28 text-right border border-slate-300">Balance</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Method</th>
                  <th className="py-2.5 px-3 w-32 border border-slate-300">Collected By</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredBreakdown.map((item, idx) => (
                  <tr key={item._id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 border border-slate-200">
                      {item.voucherNo}
                    </td>
                    <td className="py-2 px-3 text-center font-medium text-slate-600 border border-slate-200">
                      {item.receiptDate !== '—' ? item.receiptDate : item.issueDate}
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
                    <td className="py-2 px-3 text-center font-mono text-slate-600 border border-slate-200">
                      {item.monthYear}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 border border-slate-200">
                      Rs. {(item.totalPayable ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 border border-slate-200">
                      Rs. {(item.paidAmount ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 border border-slate-200">
                      Rs. {(item.balance ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-center font-medium text-[11px] border border-slate-200">
                      {item.paymentMethod}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-700 border border-slate-200 text-xs">
                      {item.receivedBy || 'School Accountant'}
                    </td>
                    <td className="py-2 px-3 text-center border border-slate-200">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                          item.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td colSpan={3} className="py-2.5 px-3 border border-slate-300 font-bold">
                    {filteredBreakdown.length} Vouchers Listed
                  </td>
                  <td colSpan={4} className="py-2.5 px-3 border border-slate-300 text-right font-bold text-slate-700">
                    Grand Totals:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-950 text-xs border border-slate-300">
                    Rs. {breakdownTotals.payable.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-xs border border-slate-300">
                    Rs. {breakdownTotals.paid.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-800 text-xs border border-slate-300">
                    Rs. {breakdownTotals.balance.toLocaleString()}
                  </td>
                  <td colSpan={3} className="py-2.5 px-3 border border-slate-300 text-center">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 7. Official Signatures */}
        <div className="flex items-end justify-between pt-16 mt-8 border-t-2 border-slate-900 text-xs font-bold text-slate-900">
          <div className="text-center w-44">
            <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
            <span>Accounts Officer / Cashier</span>
          </div>

          <div className="text-center w-40">
            <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
            <span>Admin / Finance Incharge</span>
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
