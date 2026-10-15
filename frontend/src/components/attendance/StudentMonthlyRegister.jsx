import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import { useAuth } from '../../context/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Calendar, Search, Printer, Download,
  CheckCircle2, AlertCircle, RefreshCw, Users,
  FileSpreadsheet, Sparkles, FileDown, FileText
} from 'lucide-react';

export default function StudentMonthlyRegister({ schoolCode, setActiveSubModule }) {
  const { schoolName, schoolProfile } = useAuth();
  const { classNames, getSectionsForClass } = useAcademicClasses(schoolCode);

  const currentMonthStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [perDayFine, setPerDayFine] = useState(50); // PKR 50 default absent fine

  const [registerData, setRegisterData] = useState([]);
  const [totalMarkedDays, setTotalMarkedDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Sync initial class
  useEffect(() => {
    if (classNames && classNames.length > 0 && !selectedClass) {
      const first = classNames[0];
      setSelectedClass(first);
      const secs = getSectionsForClass(first);
      setSelectedSection(secs[0] || 'A');
    }
  }, [classNames, selectedClass, getSectionsForClass]);

  // Fetch Monthly Register
  const fetchRegister = async () => {
    if (!selectedClass || !selectedSection || !selectedMonth) return;

    setLoading(true);
    try {
      const res = await api.get('/attendance/student/monthly-register', {
        params: {
          schoolCode,
          className: selectedClass,
          section: selectedSection,
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
        message: err.response?.data?.message || 'Failed to fetch monthly register.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegister();
  }, [selectedClass, selectedSection, selectedMonth]);

  // Days in selected month (28, 29, 30, 31)
  const getDaysCount = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const daysCount = getDaysCount();
  const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);

  // Filter students by search
  const filteredData = registerData.filter((st) =>
    st.studentName.toLowerCase().includes(search.toLowerCase()) ||
    (st.rollNumber && st.rollNumber.toLowerCase().includes(search.toLowerCase()))
  );

  // Export CSV
  const handleExportCSV = () => {
    if (registerData.length === 0) return;

    const headers = ['Roll No', 'Student Name', 'Father Name', ...daysArray.map((d) => `Day ${d}`), 'Total P', 'Total A', 'Fine (PKR)'];
    const rows = registerData.map((st) => [
      st.rollNumber,
      st.studentName,
      st.fatherName,
      ...daysArray.map((d) => st.dailyAttendance[d] || '-'),
      st.totals.present,
      st.totals.absent,
      st.totals.absent * perDayFine,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Monthly_Attendance_${selectedClass}_${selectedSection}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Official Monthly Attendance Register PDF
  const handleDownloadPdf = () => {
    if (!registerData || registerData.length === 0) {
      setToast({ type: 'error', message: 'No attendance records to export. Please select a class with students.' });
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
      const displaySchoolName = (schoolProfile?.schoolName || schoolName || 'SCHOOL ATTENDANCE SYSTEM').toUpperCase();
      const displayAddress = (schoolProfile?.address || `CAMPUS (${schoolCode || 'SYSTEM'})`).toUpperCase();
      const displayTagline = schoolProfile?.tagline ? schoolProfile.tagline.toUpperCase() : '';
      const principalTitle = schoolProfile?.principalTitle || 'Principal / Headmaster';

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
      doc.text('OFFICIAL MONTHLY STUDENT ATTENDANCE REGISTER', pageWidth / 2, currentY, { align: 'center' });

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
        `Class: ${selectedClass} (${selectedSection})`,
        `Month: ${formattedMonth.toUpperCase()}`,
        `Marked Days: ${totalMarkedDays} / ${daysCount}`,
        `Total Students: ${filteredData.length}`,
        `Absent Fine Rate: PKR ${perDayFine}/day`,
        `Printed: ${new Date().toLocaleDateString('en-GB')}`,
      ];
      doc.text(metaItems.join('     |     '), pageWidth / 2, currentY + 4, { align: 'center' });

      currentY += 8;

      // 6. Build Table Head & Body
      const tableHead = [
        [
          '#',
          'Roll',
          'Student Name',
          'Father Name',
          ...daysArray.map((d) => String(d)),
          'P',
          'A',
          'L',
          'Fine (PKR)',
        ],
      ];

      const tableBody = filteredData.map((st, idx) => {
        const absentFineAmount = st.totals.absent * perDayFine;
        const daysCols = daysArray.map((d) => {
          const status = st.dailyAttendance[d];
          if (status === 'PRESENT') return 'P';
          if (status === 'ABSENT') return 'A';
          if (status === 'LEAVE') return 'L';
          if (status === 'HOLIDAY') return 'H';
          if (status === 'SUNDAY') return 'S';
          if (status === 'HALF_DAY') return '½';
          return '-';
        });

        return [
          idx + 1,
          st.rollNumber || '—',
          st.studentName || '—',
          st.fatherName || '—',
          ...daysCols,
          st.totals.present,
          st.totals.absent,
          st.totals.leave,
          absentFineAmount > 0 ? `${absentFineAmount}` : '0',
        ];
      });

      // Calculate width for days columns
      // Usable width: 297 - 16 = 281mm
      // Fixed columns: # (6mm), Roll (12mm), Student Name (34mm), Father Name (26mm), P (7.5mm), A (7.5mm), L (7.5mm), Fine (15mm)
      // Remaining for days: 281 - (6 + 12 + 34 + 26 + 7.5 + 7.5 + 7.5 + 15) = 281 - 115.5 = 165.5mm
      const dayColWidth = Math.max(4.6, (165.5 / daysCount));

      const colStyles = {
        0: { halign: 'center', cellWidth: 6 },
        1: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
        2: { halign: 'left', cellWidth: 34, fontStyle: 'bold' },
        3: { halign: 'left', cellWidth: 26 },
      };

      daysArray.forEach((_, i) => {
        colStyles[4 + i] = { halign: 'center', cellWidth: dayColWidth };
      });

      const pColIdx = 4 + daysCount;
      const aColIdx = pColIdx + 1;
      const lColIdx = pColIdx + 2;
      const fineColIdx = pColIdx + 3;

      colStyles[pColIdx] = { halign: 'center', cellWidth: 7.5, fontStyle: 'bold', textColor: [16, 120, 60] };
      colStyles[aColIdx] = { halign: 'center', cellWidth: 7.5, fontStyle: 'bold', textColor: [190, 20, 20] };
      colStyles[lColIdx] = { halign: 'center', cellWidth: 7.5, fontStyle: 'bold', textColor: [30, 64, 175] };
      colStyles[fineColIdx] = { halign: 'right', cellWidth: 15, fontStyle: 'bold' };

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
            if (data.column.index >= 4 && data.column.index < pColIdx) {
              const val = data.cell.raw;
              if (val === 'P') {
                data.cell.styles.textColor = [16, 120, 60];
              } else if (val === 'A') {
                data.cell.styles.textColor = [185, 28, 28];
                data.cell.styles.fillColor = [254, 226, 226]; // soft light red
                data.cell.styles.fontStyle = 'bold';
              } else if (val === 'L') {
                data.cell.styles.textColor = [30, 64, 175];
                data.cell.styles.fillColor = [219, 234, 254]; // soft blue
              } else if (val === 'S') {
                data.cell.styles.textColor = [180, 83, 9];
                data.cell.styles.fillColor = [254, 243, 199]; // sunday
              } else if (val === 'H') {
                data.cell.styles.textColor = [13, 148, 136];
                data.cell.styles.fillColor = [204, 251, 241]; // holiday
              }
            } else if (data.column.index === fineColIdx) {
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
          `Official Document — ${displaySchoolName}  |  Class ${selectedClass} (${selectedSection})  |  Page ${i} of ${totalPages}`,
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

      doc.text('Class Incharge / Teacher', col1X + 22.5, sigY + 3.8, { align: 'center' });
      doc.text('Attendance Clerk / Incharge', col2X, sigY + 3.8, { align: 'center' });
      doc.text(`${principalTitle} (Stamp & Sign)`, col3X + 17.5, sigY + 3.8, { align: 'center' });

      const fileName = `Attendance_Register_${selectedClass}_${selectedSection}_${selectedMonth}.pdf`;
      doc.save(fileName);
      setToast({ type: 'success', message: `Official Register PDF downloaded: ${fileName}` });
    } catch (err) {
      console.error('PDF Export Error:', err);
      setToast({ type: 'error', message: 'Failed to generate Register PDF: ' + err.message });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-5">
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 6mm; }
          body { background: white !important; }
          aside, nav, .no-print { display: none !important; }
          .print-full { width: 100% !important; max-width: 100% !important; margin: 0 !important; }
        }
      `}</style>

      {/* Toast Alert */}
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
            <Calendar className="w-4 h-4" />
            <span>Class Register & Fee Fine Engine</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">
            Monthly Student Attendance Register
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            1 to 31 Days Visual Grid • Automated Absent Fine Calculation • Vector Crisp PDF Download
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {setActiveSubModule && (
            <button
              onClick={() => setActiveSubModule('student_attendance')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <span>Daily Attendance</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={exportingPdf || filteredData.length === 0}
            className="bg-gradient-to-r from-[#ffa000] to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
            title="Download Official Register PDF Format"
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
            onClick={() => window.print()}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
            title="Print Preview via Browser"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1">Class</label>
          <select
            value={selectedClass}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedClass(next);
              const secs = getSectionsForClass(next);
              setSelectedSection(secs[0] || 'A');
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800"
          >
            {classNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800"
          >
            {getSectionsForClass(selectedClass).map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Month & Year</label>
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
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 cursor-pointer"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Absent Fine / Day (PKR)
          </label>
          <input
            type="number"
            min="0"
            value={perDayFine}
            onChange={(e) => setPerDayFine(Number(e.target.value) || 0)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-rose-600"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Search Student</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Name or Roll..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Register Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700">
              Total Marked Days: <strong className="text-blue-600">{totalMarkedDays}</strong> / {daysCount}
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-bold text-slate-700">
              Class Strength: <strong className="text-slate-900">{registerData.length}</strong> Students
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> P (Present)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> A (Absent)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> L (Leave)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> H (Holiday)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] text-slate-700 border-separate border-spacing-0">
            <thead className="bg-[#041633] text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="py-2.5 px-2.5 sticky left-0 bg-[#041633] z-30 w-[44px] min-w-[44px] max-w-[44px] text-center border-b border-r border-slate-700/80">
                  #
                </th>
                <th className="py-2.5 px-2.5 sticky left-[44px] bg-[#041633] z-30 w-[90px] min-w-[90px] max-w-[90px] border-b border-r border-slate-700/80 whitespace-nowrap">
                  Roll No
                </th>
                <th className="py-2.5 px-3 sticky left-[134px] bg-[#041633] z-30 w-[180px] min-w-[180px] max-w-[180px] border-b border-r border-slate-700/80 whitespace-nowrap shadow-[4px_0_6px_-2px_rgba(0,0,0,0.3)]">
                  Student Name
                </th>
                {daysArray.map((d) => (
                  <th
                    key={d}
                    className="py-2 px-1 text-center w-7 min-w-[28px] border-b border-r border-slate-800"
                  >
                    {d}
                  </th>
                ))}
                <th className="py-2.5 px-2 text-center w-10 min-w-[40px] text-emerald-400 bg-slate-900 border-b border-r border-slate-700/80">
                  P
                </th>
                <th className="py-2.5 px-2 text-center w-10 min-w-[40px] text-rose-400 bg-slate-900 border-b border-r border-slate-700/80">
                  A
                </th>
                <th className="py-2.5 px-2 text-center w-10 min-w-[40px] text-blue-400 bg-slate-900 border-b border-r border-slate-700/80">
                  L
                </th>
                <th className="py-2.5 px-3 text-right w-24 min-w-[96px] text-amber-400 bg-slate-900 border-b border-slate-700/80 whitespace-nowrap">
                  Fine (PKR)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={daysCount + 7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading monthly attendance matrix...</span>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={daysCount + 7} className="py-12 text-center text-slate-400">
                    <Users className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                    <span>No students found in this class.</span>
                  </td>
                </tr>
              ) : (
                filteredData.map((st, idx) => {
                  const absentFineAmount = st.totals.absent * perDayFine;
                  return (
                    <tr key={st.studentId} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-2.5 text-center text-slate-400 font-bold sticky left-0 bg-white group-hover:bg-slate-50 border-b border-r border-slate-200 z-20 w-[44px] min-w-[44px] max-w-[44px]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2.5 font-mono font-bold text-slate-900 sticky left-[44px] bg-white group-hover:bg-slate-50 border-b border-r border-slate-200 z-20 w-[90px] min-w-[90px] max-w-[90px] whitespace-nowrap">
                        {st.rollNumber || '—'}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 sticky left-[134px] bg-white group-hover:bg-slate-50 border-b border-r border-slate-200 z-20 w-[180px] min-w-[180px] max-w-[180px] whitespace-nowrap shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)] truncate">
                        {st.studentName}
                      </td>

                      {/* Day 1 to 31 Cells */}
                      {daysArray.map((d) => {
                        const status = st.dailyAttendance[d];
                        return (
                          <td
                            key={d}
                            className={`py-1 px-0.5 text-center font-bold text-[10px] border-b border-r border-slate-100 ${
                              status === 'PRESENT'
                                ? 'bg-emerald-50/50 text-emerald-700'
                                : status === 'ABSENT'
                                ? 'bg-rose-100 text-rose-800'
                                : status === 'LEAVE'
                                ? 'bg-blue-100 text-blue-800'
                                : status === 'HOLIDAY'
                                ? 'bg-teal-50 text-teal-700'
                                : status === 'SUNDAY'
                                ? 'bg-amber-50 text-amber-700'
                                : 'text-slate-300'
                            }`}
                          >
                            {status === 'PRESENT'
                              ? 'P'
                              : status === 'ABSENT'
                              ? 'A'
                              : status === 'LEAVE'
                              ? 'L'
                              : status === 'HOLIDAY'
                              ? 'H'
                              : status === 'SUNDAY'
                              ? 'S'
                              : status === 'HALF_DAY'
                              ? '½'
                              : status === '-'
                              ? '-'
                              : ''}
                          </td>
                        );
                      })}

                      {/* Totals */}
                      <td className="py-2 px-2 text-center font-black text-emerald-700 bg-emerald-50/30 border-b border-r border-slate-100">
                        {st.totals.present}
                      </td>
                      <td className="py-2 px-2 text-center font-black text-rose-700 bg-rose-50/30 border-b border-r border-slate-100">
                        {st.totals.absent}
                      </td>
                      <td className="py-2 px-2 text-center font-black text-blue-700 bg-blue-50/30 border-b border-r border-slate-100">
                        {st.totals.leave}
                      </td>
                      <td className="py-2 px-3 text-right font-black font-mono text-rose-600 bg-rose-50/40 border-b border-slate-100 whitespace-nowrap">
                        {absentFineAmount > 0 ? `Rs. ${absentFineAmount}` : 'Rs. 0'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
