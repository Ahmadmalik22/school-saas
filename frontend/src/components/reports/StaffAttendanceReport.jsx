import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Users,
  Download,
  FileDown,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BadgeAlert,
} from 'lucide-react';

export default function StaffAttendanceReport({ schoolCode }) {
  // Parameters
  const [selectedMonthYear, setSelectedMonthYear] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
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

  // Fetch Staff Attendance Report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        schoolCode,
        monthYear: selectedMonthYear,
        role: selectedRole,
        department: selectedDepartment,
        status: selectedStatus,
      };

      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/reports/staff-attendance', { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching staff attendance report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonthYear, selectedRole, selectedDepartment, selectedStatus]);

  const handleResetFilters = () => {
    setSelectedMonthYear('ALL');
    setSelectedRole('ALL');
    setSelectedDepartment('ALL');
    setSelectedStatus('ALL');
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
        return (
          item.name?.toLowerCase().includes(q) ||
          item.employeeId?.toLowerCase().includes(q) ||
          item.role?.toLowerCase().includes(q) ||
          item.department?.toLowerCase().includes(q)
        );
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
          item.role?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reportData, searchQuery]);

  // Summary Totals
  const summaryTotals = useMemo(() => {
    return filteredSummary.reduce(
      (acc, curr) => ({
        workingDays: acc.workingDays + (curr.workingDays || 0),
        present: acc.present + (curr.presentDays || 0),
        absent: acc.absent + (curr.absentDays || 0),
        leave: acc.leave + (curr.leaveDays || 0),
        late: acc.late + (curr.lateDays || 0),
      }),
      { workingDays: 0, present: 0, absent: 0, leave: 0, late: 0 }
    );
  }, [filteredSummary]);

  // Overall attendance rate
  const overallRate = useMemo(() => {
    const totalWorking = summaryTotals.workingDays;
    return totalWorking > 0 ? Number(((summaryTotals.present / totalWorking) * 100).toFixed(1)) : 0;
  }, [summaryTotals]);

  // 1. Export to Excel (.xlsx) using ExcelJS
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = viewFormat === 'summary' ? 'Staff Attendance Roster' : 'Daily Staff Register';
    const worksheet = workbook.addWorksheet(sheetName);

    // School Title Header
    worksheet.mergeCells('A1:J1');
    worksheet.getCell('A1').value = `${schoolProfile.schoolName || 'School'} - Staff Attendance & Punctuality Report`;
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
    worksheet.getCell('A2').value = `Role: ${selectedRole} | Department: ${selectedDepartment} | Range: ${fromDate || 'Earliest'} to ${toDate || 'Latest'} | Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A2').font = { size: 9, italic: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Blank line

    if (viewFormat === 'summary') {
      const headerRow = worksheet.addRow([
        '#',
        'Emp ID',
        'Staff Name',
        'Role / Designation',
        'Department',
        'Working Days',
        'Present',
        'Absent',
        'Leave',
        'Late / Delay',
        'Attendance %',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredSummary.forEach((s, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          s.employeeId,
          s.name,
          s.role,
          s.department,
          s.workingDays,
          s.presentDays,
          s.absentDays,
          s.leaveDays,
          s.lateDays,
          `${s.attendancePercent}%`,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).alignment = { horizontal: 'center' };
        row.getCell(9).alignment = { horizontal: 'center' };
        row.getCell(10).alignment = { horizontal: 'center' };
        row.getCell(11).alignment = { horizontal: 'center' };
      });

      // Total Row
      const totalRow = worksheet.addRow([
        'TOTAL',
        '—',
        `${filteredSummary.length} Staff Members`,
        '—',
        '—',
        summaryTotals.workingDays,
        summaryTotals.present,
        summaryTotals.absent,
        summaryTotals.leave,
        summaryTotals.late,
        `${overallRate}%`,
      ]);
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      totalRow.getCell(6).alignment = { horizontal: 'center' };
      totalRow.getCell(7).alignment = { horizontal: 'center' };
      totalRow.getCell(8).alignment = { horizontal: 'center' };
      totalRow.getCell(9).alignment = { horizontal: 'center' };
      totalRow.getCell(10).alignment = { horizontal: 'center' };
      totalRow.getCell(11).alignment = { horizontal: 'center' };
    } else {
      // Detailed Daily Register
      const headerRow = worksheet.addRow([
        '#',
        'Date',
        'Emp ID',
        'Staff Name',
        'Role / Designation',
        'Department',
        'Status',
        'Time In',
        'Time Out',
        'Remarks',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041633' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      filteredBreakdown.forEach((item, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          item.date,
          item.employeeId,
          item.name,
          item.role,
          item.department,
          item.status,
          item.timeIn,
          item.timeOut,
          item.remarks,
        ]);
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).alignment = { horizontal: 'center' };
        row.getCell(9).alignment = { horizontal: 'center' };
      });
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
    a.download = `Staff_Attendance_${viewFormat}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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

      const schoolName = (schoolProfile.schoolName || 'School Campus').toUpperCase();
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
          ? `STAFF ATTENDANCE & PUNCTUALITY REPORT — EMPLOYEE ROSTER SUMMARY`
          : `STAFF ATTENDANCE REPORT — DAILY REGISTER BREAKDOWN`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(4, 22, 51);
      doc.text(reportTitle, pageWidth / 2, currentY, { align: 'center' });

      // Parameters Ribbon
      currentY += 4.2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      const paramsText = `Role: ${selectedRole}  |  Department: ${selectedDepartment}  |  Range: ${fromDate || 'Earliest'} to ${toDate || 'Latest'}  |  Generated: ${new Date().toLocaleString()}`;
      doc.text(paramsText, pageWidth / 2, currentY, { align: 'center' });

      currentY += 4;

      if (viewFormat === 'summary') {
        const tableHead = [
          ['#', 'Emp ID', 'Staff Name', 'Role / Designation', 'Department', 'Working Days', 'Present', 'Absent', 'Leave', 'Late', 'Attendance %'],
        ];

        const tableBody = filteredSummary.map((s, idx) => [
          idx + 1,
          s.employeeId,
          s.name,
          s.role,
          s.department,
          s.workingDays,
          s.presentDays,
          s.absentDays,
          s.leaveDays,
          s.lateDays,
          `${s.attendancePercent}%`,
        ]);

        tableBody.push([
          'TOTAL',
          '—',
          `${filteredSummary.length} Staff`,
          '—',
          '—',
          summaryTotals.workingDays,
          summaryTotals.present,
          summaryTotals.absent,
          summaryTotals.leave,
          summaryTotals.late,
          `${overallRate}%`,
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
            1: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
            2: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
            3: { halign: 'left', cellWidth: 38 },
            4: { halign: 'center', cellWidth: 28 },
            5: { halign: 'center', cellWidth: 22 },
            6: { halign: 'center', cellWidth: 20, textColor: [21, 128, 61], fontStyle: 'bold' },
            7: { halign: 'center', cellWidth: 20, textColor: [185, 28, 28], fontStyle: 'bold' },
            8: { halign: 'center', cellWidth: 20 },
            9: { halign: 'center', cellWidth: 20 },
            10: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
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
        // Detailed Register
        const tableHead = [
          ['#', 'Date', 'Emp ID', 'Staff Name', 'Role', 'Department', 'Status', 'Time In', 'Time Out', 'Remarks'],
        ];

        const tableBody = filteredBreakdown.map((item, idx) => [
          idx + 1,
          item.date,
          item.employeeId,
          item.name,
          item.role,
          item.department,
          item.status,
          item.timeIn,
          item.timeOut,
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
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'center', cellWidth: 24 },
            2: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
            3: { halign: 'left', cellWidth: 44, fontStyle: 'bold' },
            4: { halign: 'left', cellWidth: 36 },
            5: { halign: 'center', cellWidth: 30 },
            6: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
            7: { halign: 'center', cellWidth: 22 },
            8: { halign: 'center', cellWidth: 22 },
            9: { halign: 'left', cellWidth: 39 },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 6) {
              const status = data.cell.raw;
              if (status === 'PRESENT') {
                data.cell.styles.textColor = [21, 128, 61];
              } else if (status === 'ABSENT') {
                data.cell.styles.textColor = [185, 28, 28];
              } else if (status === 'LATE' || status === 'HALF_DAY') {
                data.cell.styles.textColor = [180, 110, 0];
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
          `Generated automatically by EduNexus™ SaaS`,
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

      doc.text('HR / Attendance Officer', col1X + 23, sigY + 4, { align: 'center' });
      doc.text('Vice Principal / Head Teacher', col2X, sigY + 4, { align: 'center' });
      doc.text(principalTitle, col3X + 18, sigY + 4, { align: 'center' });

      const fileName = `Staff_Attendance_${viewFormat.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
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
              <Users className="w-6 h-6 text-[#ffa000]" />
              Staff Attendance & Punctuality Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Consolidated employee presence, absent and late tracking, leave counts, and chronic absenteeism audits.
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
              Summarized Format (Employee Roster Rates)
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
              Detailed Breakdown (Daily Attendance Register)
            </button>
          </div>

          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Overall Staff Attendance Rate:</span>
            <span className="font-mono text-sm font-black text-emerald-700">
              {reportData?.summary?.overallAttendanceRate ?? 0}%
            </span>
          </div>
        </div>

        {/* 3. Parameter Filters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-3 text-xs">
          {/* Role Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Designation / Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Roles</option>
              {(reportData?.roles || []).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Departments</option>
              {['Science', 'Mathematics', 'English & Languages', 'Urdu & Islamiyat', 'Computer & IT', 'Accounts & Finance', 'Administration', 'General / Support'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LEAVE">Leave</option>
              <option value="LATE">Late</option>
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
              placeholder="Search by staff name, employee ID, role, or department..."
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
            <p className="text-xs font-bold text-slate-500">Loading staff attendance report...</p>
          </div>
        ) : viewFormat === 'summary' ? (
          /* SUMMARIZED FORMAT TABLE (Roster Rates) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-12 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Emp ID</th>
                  <th className="py-2.5 px-3 border border-slate-300">Staff Name</th>
                  <th className="py-2.5 px-3 border border-slate-300">Role / Designation</th>
                  <th className="py-2.5 px-3 border border-slate-300">Department</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Working Days</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Present</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Absent</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Leave</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Late</th>
                  <th className="py-2.5 px-3 w-28 text-center border border-slate-300">Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                      No staff attendance records found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((s, idx) => (
                    <tr key={s.employeeId || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 border border-slate-200">
                        {s.employeeId}
                      </td>
                      <td className="py-2 px-3 font-black text-slate-900 border border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span>{s.name}</span>
                          {s.isChronicAbsent && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">
                              Low
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium border border-slate-200">
                        {s.role}
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium border border-slate-200">
                        {s.department}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border border-slate-200">
                        {s.workingDays}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700 border border-slate-200">
                        {s.presentDays}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-rose-700 border border-slate-200">
                        {s.absentDays}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-700 border border-slate-200">
                        {s.leaveDays}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-amber-700 font-bold border border-slate-200">
                        {s.lateDays}
                      </td>
                      <td className="py-2 px-3 text-center font-black border border-slate-200">
                        <span className={s.attendancePercent >= 80 ? 'text-emerald-700' : 'text-rose-700'}>
                          {s.attendancePercent}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
                {/* Total Row */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-center border border-slate-300">TOTAL</td>
                  <td colSpan={2} className="py-2.5 px-3 border border-slate-300 font-bold">
                    {filteredSummary.length} Staff Members Listed
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 border border-slate-300 text-right font-bold text-slate-700">
                    Grand Totals:
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-900 border border-slate-300">
                    {summaryTotals.workingDays}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-emerald-800 text-sm border border-slate-300">
                    {summaryTotals.present}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-rose-800 text-sm border border-slate-300">
                    {summaryTotals.absent}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-900 border border-slate-300">
                    {summaryTotals.leave}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-amber-800 border border-slate-300">
                    {summaryTotals.late}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-emerald-800 text-sm border border-slate-300">
                    {overallRate}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* DETAILED BREAKDOWN TABLE (Daily Register) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2.5 px-3 w-10 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Date</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Emp ID</th>
                  <th className="py-2.5 px-3 border border-slate-300">Staff Name</th>
                  <th className="py-2.5 px-3 border border-slate-300">Role</th>
                  <th className="py-2.5 px-3 border border-slate-300">Department</th>
                  <th className="py-2.5 px-3 w-24 text-center border border-slate-300">Status</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Time In</th>
                  <th className="py-2.5 px-3 w-20 text-center border border-slate-300">Time Out</th>
                  <th className="py-2.5 px-3 border border-slate-300">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                {filteredBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                      No daily attendance logs found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBreakdown.map((item, idx) => (
                    <tr key={`${item.date}-${item.employeeId}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border border-slate-200">
                        {item.date}
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
                      <td className="py-2 px-3 text-slate-700 border border-slate-200">
                        {item.department}
                      </td>
                      <td className="py-2 px-3 text-center border border-slate-200">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                            item.status === 'PRESENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'ABSENT'
                              ? 'bg-rose-100 text-rose-800'
                              : item.status === 'LATE' || item.status === 'HALF_DAY'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 border border-slate-200">
                        {item.timeIn || '—'}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 border border-slate-200">
                        {item.timeOut || '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-600 border border-slate-200">
                        {item.remarks || '—'}
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
