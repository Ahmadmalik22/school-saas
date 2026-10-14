import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Calendar, Search, Printer, Download,
  CheckCircle2, AlertCircle, RefreshCw, Users,
  FileSpreadsheet, Sparkles, DollarSign, Clock,
  Briefcase, ShieldAlert, Award, FileDown, FileText
} from 'lucide-react';

export default function StaffMonthlyRegister({ schoolCode, setActiveSubModule }) {
  const { schoolName, schoolProfile } = useAuth();

  const currentMonthStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [search, setSearch] = useState('');

  const [registerData, setRegisterData] = useState([]);
  const [totalMarkedDays, setTotalMarkedDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [toast, setToast] = useState(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch Monthly Staff Register
  const fetchRegister = async () => {
    if (!schoolCode || !selectedMonth) return;

    setLoading(true);
    try {
      const res = await api.get('/attendance/staff/monthly-register', {
        params: {
          schoolCode,
          monthYear: selectedMonth,
        },
      });

      if (res.data.success) {
        setRegisterData(res.data.data || []);
        setTotalMarkedDays(res.data.totalMarkedDays || 0);
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to fetch monthly staff register.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegister();
  }, [schoolCode, selectedMonth]);

  // Days in selected month (28, 29, 30, 31)
  const getDaysCount = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const daysCount = getDaysCount();
  const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);

  // Departments list for filter
  const departments = Array.from(
    new Set(registerData.map((st) => st.department).filter(Boolean))
  );

  // Filter staff by department and search
  const filteredData = registerData.filter((st) => {
    const matchDept =
      selectedDepartment === 'ALL' || st.department === selectedDepartment;
    const matchSearch =
      st.name.toLowerCase().includes(search.toLowerCase()) ||
      st.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      (st.role && st.role.toLowerCase().includes(search.toLowerCase()));
    return matchDept && matchSearch;
  });

  // Aggregated KPI Stats
  const totalStaffCount = registerData.length;
  const totalPayrollGross = registerData.reduce(
    (sum, st) => sum + (Number(st.basicSalary) || 0),
    0
  );
  const totalDeductions = registerData.reduce(
    (sum, st) => sum + (Number(st.payroll?.salaryDeduction) || 0),
    0
  );
  const totalNetPayable = registerData.reduce(
    (sum, st) => sum + (Number(st.payroll?.netPayableSalary) || 0),
    0
  );

  // Export CSV
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;

    const headers = [
      'Emp ID',
      'Staff Name',
      'Role',
      'Department',
      'Basic Salary (PKR)',
      ...daysArray.map((d) => `Day ${d}`),
      'Presents',
      'Lates',
      'Absents',
      'Leaves',
      'Deductible Days',
      'Salary Deduction (PKR)',
      'Net Payable Salary (PKR)',
    ];

    const rows = filteredData.map((st) => [
      st.employeeId,
      st.name,
      st.role,
      st.department,
      st.basicSalary || 0,
      ...daysArray.map((d) => st.dailyAttendance[d] || '-'),
      st.totals.present,
      st.totals.late,
      st.totals.absent,
      st.totals.leave,
      st.payroll?.totalDeductionDays || 0,
      st.payroll?.salaryDeduction || 0,
      st.payroll?.netPayableSalary || 0,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join(
        '\n'
      );

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute(
      'download',
      `Staff_Monthly_Attendance_Register_${schoolCode}_${selectedMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    if (!status || status === '-') {
      return <span className="text-slate-300 font-mono text-[10px]">-</span>;
    }
    switch (status) {
      case 'PRESENT':
        return (
          <span
            className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center mx-auto"
            title="Present"
          >
            P
          </span>
        );
      case 'LATE':
        return (
          <span
            className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold text-[9px] flex items-center justify-center mx-auto"
            title="Late Arrival"
          >
            L
          </span>
        );
      case 'ABSENT':
        return (
          <span
            className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] flex items-center justify-center mx-auto"
            title="Absent (Unpaid)"
          >
            A
          </span>
        );
      case 'LEAVE':
        return (
          <span
            className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] flex items-center justify-center mx-auto"
            title="Approved Leave"
          >
            Lv
          </span>
        );
      case 'HOLIDAY':
        return (
          <span
            className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px] flex items-center justify-center mx-auto"
            title="Official Holiday"
          >
            H
          </span>
        );
      case 'SUNDAY':
        return (
          <span
            className="w-5 h-5 rounded-full bg-orange-100 text-orange-800 font-bold text-[10px] flex items-center justify-center mx-auto"
            title="Sunday"
          >
            S
          </span>
        );
      case 'HALF_DAY':
        return (
          <span
            className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-bold text-[9px] flex items-center justify-center mx-auto"
            title="Half Day"
          >
            ½
          </span>
        );
      default:
        return <span className="text-slate-300 font-mono text-[10px]">{status}</span>;
    }
  };

  // Download Official Monthly Staff Attendance Register PDF
  const handleDownloadPdf = () => {
    if (!filteredData || filteredData.length === 0) {
      setToast({ type: 'error', message: 'No staff attendance records to export. Please adjust filters.' });
      return;
    }

    setExportingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 8;

      // School & Header Information
      const displaySchoolName = (schoolProfile?.schoolName || schoolName || 'SCHOOL STAFF MANAGEMENT SYSTEM').toUpperCase();
      const displayAddress = (schoolProfile?.address || `CAMPUS (${schoolCode || 'SYSTEM'})`).toUpperCase();
      const displayTagline = schoolProfile?.tagline ? schoolProfile.tagline.toUpperCase() : '';
      const principalTitle = schoolProfile?.principalTitle || 'Principal / Director';

      // 1. Top Decorative Accent Bars
      doc.setFillColor(4, 22, 51); // Akkhor Navy #041633
      doc.rect(0, 0, pageWidth, 4, 'F');
      doc.setFillColor(255, 160, 0); // Akkhor Gold #ffa000
      doc.rect(0, 4, pageWidth, 1.5, 'F');

      let currentY = 12;

      // 2. School Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(4, 22, 51);
      doc.text(displaySchoolName, pageWidth / 2, currentY, { align: 'center' });

      // 3. Address & Tagline
      if (displayAddress || displayTagline) {
        currentY += 4.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const subText = [displayAddress, displayTagline].filter(Boolean).join(' • ');
        doc.text(subText, pageWidth / 2, currentY, { align: 'center' });
      }

      // 4. Register Title
      currentY += 4.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(4, 22, 51);
      doc.text('OFFICIAL MONTHLY STAFF ATTENDANCE REGISTER', pageWidth / 2, currentY, { align: 'center' });

      // 5. Metadata Summary Bar
      currentY += 3.5;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 6, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      // Month Name Formatting (e.g., "October 2026")
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const formattedMonth = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      const metaItems = [
        `Department: ${selectedDepartment === 'ALL' ? 'All Departments' : selectedDepartment}`,
        `Month: ${formattedMonth.toUpperCase()}`,
        `Marked Days: ${totalMarkedDays} / ${daysCount}`,
        `Total Staff: ${filteredData.length}`,
        `Printed: ${new Date().toLocaleDateString('en-GB')}`,
      ];
      doc.text(metaItems.join('     |     '), pageWidth / 2, currentY + 4, { align: 'center' });

      currentY += 8;

      // 6. Build Table Head & Body
      const tableHead = [
        [
          '#',
          'Emp ID',
          'Staff Name',
          'Role',
          'Dept',
          ...daysArray.map((d) => String(d)),
          'P',
          'Lt',
          'A',
          'Lv',
          'Ded.',
          'Net Salary',
        ],
      ];

      const tableBody = filteredData.map((st, idx) => {
        const daysCols = daysArray.map((d) => {
          const status = st.dailyAttendance[d];
          if (status === 'PRESENT') return 'P';
          if (status === 'LATE') return 'Lt';
          if (status === 'ABSENT') return 'A';
          if (status === 'LEAVE') return 'Lv';
          if (status === 'HOLIDAY') return 'H';
          if (status === 'SUNDAY') return 'S';
          if (status === 'HALF_DAY') return '½';
          return '-';
        });

        return [
          idx + 1,
          st.employeeId || '—',
          st.name || '—',
          st.role || '—',
          st.department || '—',
          ...daysCols,
          st.totals.present ?? 0,
          st.totals.late ?? 0,
          st.totals.absent ?? 0,
          st.totals.leave ?? 0,
          st.payroll?.totalDeductionDays ?? 0,
          st.payroll?.netPayableSalary ? `Rs. ${Number(st.payroll.netPayableSalary).toLocaleString()}` : 'Rs. 0',
        ];
      });

      // Calculate width for days columns
      // Usable width: 297 - 16 = 281mm
      // Fixed: # (6mm), Emp ID (12mm), Name (28mm), Role (18mm), Dept (16mm), P (6.5mm), Lt (6.5mm), A (6.5mm), Lv (6.5mm), Ded (10mm), Net (18mm)
      // Fixed sum: 6 + 12 + 28 + 18 + 16 + 6.5 + 6.5 + 6.5 + 6.5 + 10 + 18 = 125mm
      // Remaining for 31 days: 281 - 125 = 156mm
      const dayColWidth = Math.max(4.5, (156 / daysCount));

      const colStyles = {
        0: { halign: 'center', cellWidth: 6 },
        1: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
        2: { halign: 'left', cellWidth: 28, fontStyle: 'bold' },
        3: { halign: 'left', cellWidth: 18 },
        4: { halign: 'left', cellWidth: 16 },
      };

      daysArray.forEach((_, i) => {
        colStyles[5 + i] = { halign: 'center', cellWidth: dayColWidth };
      });

      const pColIdx = 5 + daysCount;
      const ltColIdx = pColIdx + 1;
      const aColIdx = pColIdx + 2;
      const lvColIdx = pColIdx + 3;
      const dedColIdx = pColIdx + 4;
      const netColIdx = pColIdx + 5;

      colStyles[pColIdx] = { halign: 'center', cellWidth: 6.5, fontStyle: 'bold', textColor: [16, 120, 60] };
      colStyles[ltColIdx] = { halign: 'center', cellWidth: 6.5, fontStyle: 'bold', textColor: [180, 83, 9] };
      colStyles[aColIdx] = { halign: 'center', cellWidth: 6.5, fontStyle: 'bold', textColor: [190, 20, 20] };
      colStyles[lvColIdx] = { halign: 'center', cellWidth: 6.5, fontStyle: 'bold', textColor: [30, 64, 175] };
      colStyles[dedColIdx] = { halign: 'center', cellWidth: 10, fontStyle: 'bold' };
      colStyles[netColIdx] = { halign: 'right', cellWidth: 18, fontStyle: 'bold' };

      autoTable(doc, {
        startY: currentY,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        headStyles: {
          fillColor: [4, 22, 51],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 6,
          halign: 'center',
          cellPadding: 0.8,
        },
        bodyStyles: {
          fontSize: 6,
          textColor: [30, 41, 59],
          cellPadding: 0.8,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: colStyles,
        didParseCell: (data) => {
          if (data.section === 'body') {
            // Day attendance cells
            if (data.column.index >= 5 && data.column.index < pColIdx) {
              const val = data.cell.raw;
              if (val === 'P') {
                data.cell.styles.textColor = [16, 120, 60];
              } else if (val === 'A') {
                data.cell.styles.textColor = [185, 28, 28];
                data.cell.styles.fillColor = [254, 226, 226]; // soft red
                data.cell.styles.fontStyle = 'bold';
              } else if (val === 'Lt') {
                data.cell.styles.textColor = [180, 83, 9];
                data.cell.styles.fillColor = [254, 243, 199]; // soft amber
              } else if (val === 'Lv') {
                data.cell.styles.textColor = [30, 64, 175];
                data.cell.styles.fillColor = [219, 234, 254]; // soft blue
              } else if (val === 'S') {
                data.cell.styles.textColor = [180, 83, 9];
                data.cell.styles.fillColor = [254, 243, 199]; // sunday
              } else if (val === 'H') {
                data.cell.styles.textColor = [13, 148, 136];
                data.cell.styles.fillColor = [204, 251, 241]; // holiday
              }
            } else if (data.column.index === dedColIdx) {
              const val = Number(data.cell.raw);
              if (val > 0) {
                data.cell.styles.textColor = [190, 20, 20];
              }
            }
          }
        },
        margin: { left: margin, right: margin, bottom: 22 },
      });

      // 7. Footer Page Numbers on Every Page
      const totalPages = doc.getNumberOfPages();
      const finalY = doc.lastAutoTable?.finalY || currentY;

      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Official Staff Document — ${displaySchoolName}  |  Dept: ${selectedDepartment}  |  Page ${i} of ${totalPages}`,
          margin,
          pageHeight - 5
        );
        doc.text(
          `Generated automatically by Akkhor™ School ERP`,
          pageWidth - margin,
          pageHeight - 5,
          { align: 'right' }
        );
      }

      // 8. Official Signature Blocks on the Last Page
      doc.setPage(totalPages);
      let sigY = finalY + 12;
      if (sigY + 14 > pageHeight - 10) {
        doc.addPage();
        sigY = 30;
      }

      doc.setDrawColor(4, 22, 51);
      doc.setLineWidth(0.3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(4, 22, 51);

      const col1X = margin + 15;
      const col2X = pageWidth / 2;
      const col3X = pageWidth - margin - 45;

      doc.line(col1X, sigY, col1X + 45, sigY);
      doc.line(col2X - 22, sigY, col2X + 22, sigY);
      doc.line(col3X - 5, sigY, col3X + 40, sigY);

      doc.text('Prepared by (HR Officer)', col1X + 22.5, sigY + 3.8, { align: 'center' });
      doc.text('Checked by (Accountant)', col2X, sigY + 3.8, { align: 'center' });
      doc.text(`${principalTitle} (Stamp & Sign)`, col3X + 17.5, sigY + 3.8, { align: 'center' });

      const fileName = `Staff_Attendance_Register_${schoolCode}_${selectedDepartment}_${selectedMonth}.pdf`;
      doc.save(fileName);
      setToast({ type: 'success', message: `Official Staff Register PDF downloaded: ${fileName}` });
    } catch (err) {
      console.error('Staff PDF Export Error:', err);
      setToast({ type: 'error', message: 'Failed to generate Staff Register PDF: ' + err.message });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="max-w-[98%] mx-auto space-y-5">
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 6mm; }
          body { background: white !important; }
          aside, nav, .no-print { display: none !important; }
          .print-full { width: 100% !important; max-width: 100% !important; margin: 0 !important; }
        }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold text-white transition-all ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#041633] text-white rounded-2xl p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800 no-print">
        <div>
          <div className="flex items-center gap-2 text-[#ffa000] text-xs font-bold uppercase tracking-wider mb-1">
            <Briefcase className="w-4 h-4" />
            <span>Staff Attendance & Payroll Integration</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Staff Monthly Attendance Register</span>
            <span className="text-xs bg-[#ffa000]/20 text-[#ffa000] border border-[#ffa000]/30 px-2.5 py-0.5 rounded-full font-bold">
              1 - 31 Days Grid
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Full Month Visual Roster • Automated Working Days, Unpaid Absents & Salary Deductions
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {setActiveSubModule && (
            <button
              type="button"
              onClick={() => setActiveSubModule('staff_attendance')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>Daily Staff Attendance</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchRegister}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredData.length === 0}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exportingPdf || filteredData.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-[#ffa000] to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
            title="Download Official Staff Register PDF Format"
          >
            {exportingPdf ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 text-slate-950" />
                <span>Download Register PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
            title="Print Preview via Browser"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Top Filter & Metric Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
        {/* Month Selector */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Select Month</label>
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="month"
              max={currentMonthStr}
              value={selectedMonth}
              onChange={(e) => {
                const val = e.target.value;
                if (val > currentMonthStr) {
                  setSelectedMonth(currentMonthStr);
                  setToast({ type: 'error', message: 'Future months cannot be selected. Clamped to current month.' });
                } else {
                  setSelectedMonth(val);
                }
              }}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Department Filter */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Department</label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="sm:col-span-2">
          <label className="block font-bold text-slate-700 mb-1">Search Staff Member</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by staff name, employee ID, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Registered Staff
            </span>
            <span className="text-base font-black text-slate-900">{totalStaffCount} Members</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Marked Roster Days
            </span>
            <span className="text-base font-black text-slate-900">
              {totalMarkedDays} / {daysCount} Days
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Total Salary Deductions
            </span>
            <span className="text-base font-black text-rose-600">
              PKR {totalDeductions.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Total Net Payable Payroll
            </span>
            <span className="text-base font-black text-emerald-700">
              PKR {totalNetPayable.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Policy Notice Callout */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Payroll Attendance Policy:</strong> 30 Days/Month basis. Unpaid absents deduct 1 full day; half days deduct 0.5 day; 3 late arrivals equal 1 absent deduction.
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px] font-bold">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Present
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Late
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Absent
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Leave
          </span>
        </div>
      </div>

      {/* 1 - 31 Days Visual Attendance Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#041633] text-white uppercase text-[10px] font-bold tracking-wider">
                {/* 1. Index # - Sticky 0px */}
                <th className="py-3 px-2 w-[44px] min-w-[44px] max-w-[44px] text-center sticky left-0 bg-[#041633] z-30 border-b border-r border-slate-700/80">
                  #
                </th>

                {/* 2. Emp ID - Sticky 44px */}
                <th className="py-3 px-3 w-[116px] min-w-[116px] max-w-[116px] sticky left-[44px] bg-[#041633] z-30 border-b border-r border-slate-700/80 whitespace-nowrap">
                  Emp ID
                </th>

                {/* 3. Staff Name - Sticky 160px (44px + 116px) */}
                <th className="py-3 px-4 w-[180px] min-w-[180px] max-w-[180px] sticky left-[160px] bg-[#041633] z-30 border-b border-r border-slate-700/80 whitespace-nowrap shadow-[4px_0_6px_-2px_rgba(0,0,0,0.3)]">
                  Staff Name
                </th>

                {/* 4. Role & Department - Non Sticky */}
                <th className="py-3 px-3 min-w-[140px] whitespace-nowrap border-b border-r border-slate-700/80">
                  Role / Dept
                </th>

                {/* 5. Basic Salary - Non Sticky */}
                <th className="py-3 px-3 min-w-[115px] whitespace-nowrap text-right border-b border-r border-slate-700/80">
                  Basic Salary
                </th>

                {/* 6. Days 1 to 31 Columns */}
                {daysArray.map((day) => (
                  <th
                    key={day}
                    className="py-2.5 px-0.5 text-center w-[30px] min-w-[30px] max-w-[30px] font-mono border-b border-r border-slate-700/60"
                  >
                    {day}
                  </th>
                ))}

                {/* 7. Summary & Payroll Rollup Columns */}
                <th className="py-3 px-2 text-center text-emerald-400 w-10 min-w-[40px] bg-slate-900/60 border-b border-r border-slate-700/60">
                  P
                </th>
                <th className="py-3 px-2 text-center text-amber-400 w-12 min-w-[48px] bg-slate-900/60 border-b border-r border-slate-700/60">
                  Late
                </th>
                <th className="py-3 px-2 text-center text-rose-400 w-10 min-w-[40px] bg-slate-900/60 border-b border-r border-slate-700/60">
                  A
                </th>
                <th className="py-3 px-2 text-center text-blue-400 w-10 min-w-[40px] bg-slate-900/60 border-b border-r border-slate-700/60">
                  Lv
                </th>
                <th className="py-3 px-3 text-center text-rose-300 min-w-[95px] whitespace-nowrap border-b border-r border-slate-700/60">
                  Deduction Days
                </th>
                <th className="py-3 px-3 text-right text-rose-400 min-w-[110px] whitespace-nowrap border-b border-r border-slate-700/60">
                  Deduction
                </th>
                <th className="py-3 px-4 text-right text-emerald-400 min-w-[125px] whitespace-nowrap border-b border-slate-700/80">
                  Net Payable
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td
                    colSpan={daysArray.length + 12}
                    className="py-14 text-center text-slate-400"
                  >
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span className="font-semibold">Loading monthly staff register...</span>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={daysArray.length + 12}
                    className="py-14 text-center text-slate-400"
                  >
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600">No staff members found.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Check your search query or department filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredData.map((staff, idx) => (
                  <tr
                    key={staff.staffId}
                    className="group hover:bg-slate-50 transition-colors"
                  >
                    {/* 1. Index # (Sticky 0px) */}
                    <td className="py-2.5 px-2 text-center text-slate-400 font-bold sticky left-0 bg-white group-hover:bg-slate-50 z-20 border-b border-r border-slate-200 w-[44px] min-w-[44px] max-w-[44px]">
                      {idx + 1}
                    </td>

                    {/* 2. Emp ID (Sticky 44px) */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 sticky left-[44px] bg-white group-hover:bg-slate-50 z-20 border-b border-r border-slate-200 whitespace-nowrap w-[116px] min-w-[116px] max-w-[116px]">
                      {staff.employeeId}
                    </td>

                    {/* 3. Staff Name (Sticky 160px) */}
                    <td className="py-2.5 px-4 font-bold text-slate-900 sticky left-[160px] bg-white group-hover:bg-slate-50 z-20 border-b border-r border-slate-200 whitespace-nowrap shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)] w-[180px] min-w-[180px] max-w-[180px]">
                      <div className="truncate max-w-[160px]">
                        <span className="block font-bold text-slate-900 truncate" title={staff.name}>
                          {staff.name}
                        </span>
                        {staff.phone && (
                          <span className="text-[10px] text-slate-400 block font-normal truncate">
                            {staff.phone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. Role / Dept (Non-sticky) */}
                    <td className="py-2.5 px-3 whitespace-nowrap border-b border-r border-slate-100 min-w-[140px]">
                      <span className="font-semibold text-slate-800 block">{staff.role}</span>
                      <span className="text-[10px] text-slate-400">{staff.department}</span>
                    </td>

                    {/* 5. Basic Salary (Non-sticky) */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap border-b border-r border-slate-100 min-w-[115px]">
                      Rs. {Number(staff.basicSalary || 0).toLocaleString()}
                    </td>

                    {/* 6. Daily Status Cells (1 to 31) */}
                    {daysArray.map((day) => (
                      <td
                        key={day}
                        className="py-1 px-0.5 text-center border-b border-r border-slate-100 w-[30px] min-w-[30px] max-w-[30px]"
                      >
                        {renderStatusBadge(staff.dailyAttendance[day])}
                      </td>
                    ))}

                    {/* 7. Summary Totals */}
                    <td className="py-2.5 px-2 text-center font-black text-emerald-700 bg-emerald-50/20 border-b border-r border-slate-100 w-10 min-w-[40px]">
                      {staff.totals.present}
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-amber-700 bg-amber-50/20 border-b border-r border-slate-100 w-12 min-w-[48px]">
                      {staff.totals.late}
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-rose-700 bg-rose-50/20 border-b border-r border-slate-100 w-10 min-w-[40px]">
                      {staff.totals.absent}
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-blue-700 bg-blue-50/20 border-b border-r border-slate-100 w-10 min-w-[40px]">
                      {staff.totals.leave}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-600 bg-rose-50/10 whitespace-nowrap border-b border-r border-slate-100 min-w-[95px]">
                      {staff.payroll?.totalDeductionDays || 0} d
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 bg-rose-50/10 whitespace-nowrap border-b border-r border-slate-100 min-w-[110px]">
                      -Rs. {Number(staff.payroll?.salaryDeduction || 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-emerald-800 bg-emerald-50/30 whitespace-nowrap border-b border-slate-100 min-w-[125px]">
                      Rs. {Number(staff.payroll?.netPayableSalary || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Bar */}
        <div className="bg-[#041633] text-white p-3.5 px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-300">
            Showing <strong>{filteredData.length}</strong> of <strong>{totalStaffCount}</strong> staff members for <strong>{selectedMonth}</strong>
          </span>
          <div className="flex items-center gap-4 text-slate-200">
            <span>
              Gross Payroll: <strong className="text-white">PKR {totalPayrollGross.toLocaleString()}</strong>
            </span>
            <span className="text-slate-500">•</span>
            <span>
              Total Deductions: <strong className="text-rose-400">-PKR {totalDeductions.toLocaleString()}</strong>
            </span>
            <span className="text-slate-500">•</span>
            <span>
              Net Payable: <strong className="text-emerald-400">PKR {totalNetPayable.toLocaleString()}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
