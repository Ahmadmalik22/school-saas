import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import html2canvas from 'html2canvas';
import {
  CreditCard,
  Printer,
  Download,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
  QrCode,
  Phone,
  AlertCircle,
  CheckCircle2,
  Palette,
  Eye,
  FileDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademicSession } from '../../context/AcademicSessionContext';

// Harmonious, curated color schemes
const COLOR_THEMES = {
  maroon: {
    id: 'maroon',
    name: 'Govt Crimson & Gold (Image 2 Style)',
    primary: '#881337', // Deep rose-900 / crimson
    primaryDark: '#4c0519',
    secondary: '#0284c7', // Slate / Cyan subline
    studentNameColor: '#1e3a8a', // Navy blue
    accent: '#f59e0b', // Rich gold
    accentLight: '#fef3c7',
    badgeBg: 'bg-[#881337] text-white',
    sessionBadge: 'bg-amber-400 text-slate-950',
    strapGradient: 'from-rose-800 to-rose-600',
  },
  navy: {
    id: 'navy',
    name: 'Executive Navy & Amber',
    primary: '#041633', // Deep navy
    primaryDark: '#020b18',
    secondary: '#0284c7',
    studentNameColor: '#041633',
    accent: '#ffa000', // Amber
    accentLight: '#fef3c7',
    badgeBg: 'bg-[#041633] text-amber-300',
    sessionBadge: 'bg-[#ffa000] text-slate-950',
    strapGradient: 'from-[#041633] to-[#0a2754]',
  },
  emerald: {
    id: 'emerald',
    name: 'Royal Emerald & Gold',
    primary: '#064e3b',
    primaryDark: '#022c22',
    secondary: '#0284c7',
    studentNameColor: '#064e3b',
    accent: '#f59e0b',
    accentLight: '#fef3c7',
    badgeBg: 'bg-[#064e3b] text-white',
    sessionBadge: 'bg-amber-400 text-slate-950',
    strapGradient: 'from-emerald-800 to-emerald-600',
  },
  indigo: {
    id: 'indigo',
    name: 'Classic Indigo & Cyan',
    primary: '#1e1b4b',
    primaryDark: '#0f0e26',
    secondary: '#0284c7',
    studentNameColor: '#1e1b4b',
    accent: '#38bdf8',
    accentLight: '#e0f2fe',
    badgeBg: 'bg-[#1e1b4b] text-sky-200',
    sessionBadge: 'bg-sky-400 text-slate-950',
    strapGradient: 'from-indigo-900 to-indigo-700',
  },
};

export default function GenerateIdCard({ schoolCode }) {
  const { schoolProfile, schoolLogo, schoolName } = useAuth();
  const { currentSession, activeSession } = useAcademicSession();

  // State
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [qrCodeUrls, setQrCodeUrls] = useState({});
  const [viewSide, setViewSide] = useState('both'); // 'both', 'front', 'back'
  const [activeTheme, setActiveTheme] = useState('maroon');
  const [showLanyardSlot, setShowLanyardSlot] = useState(true);
  const [toast, setToast] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  const printAreaRef = useRef(null);

  const currentTheme = COLOR_THEMES[activeTheme] || COLOR_THEMES.maroon;

  // School branding data
  const displaySchoolName = (
    schoolProfile?.schoolName ||
    schoolName ||
    'GOVT. HIGH SEC. SCHOOL'
  ).toUpperCase();

  const displayAddress = (
    schoolProfile?.address ||
    `CAMPUS (${schoolCode || 'SYSTEM'})`
  ).toUpperCase();

  const displayPhone = schoolProfile?.phone || schoolProfile?.contactNumber || '0300-1234567';
  const displayEmail = schoolProfile?.email || 'info@school.edu.pk';
  const effectiveSession = currentSession || activeSession || '2025-2026';
  const displaySignature = schoolProfile?.principalSignatureUrl || null;
  const principalTitle = schoolProfile?.principalTitle || 'Principal';

  const { classNames = [], getSectionsForClass } = useAcademicClasses(schoolCode);

  // 1. Fetch active students
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/students', {
        params: {
          schoolCode,
          status: 'ACTIVE',
          limit: 1500,
          className: selectedClass !== 'ALL' ? selectedClass : undefined,
          section: selectedSection !== 'ALL' ? selectedSection : undefined,
          search: searchQuery.trim() || undefined,
        },
      });

      if (res.data.success && Array.isArray(res.data.data)) {
        const fetched = res.data.data;
        setStudents(fetched);

        // Auto select all initially
        setSelectedStudentIds(new Set(fetched.map((s) => s._id)));

        // Generate QR codes
        generateQrCodes(fetched);
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
      setToast({ type: 'error', message: 'Failed to load students for ID card generation.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schoolCode) fetchStudents();
  }, [schoolCode, selectedClass, selectedSection]);

  // 2. High-Speed, Instantly Scannable Attendance QR Code Generator
  const generateQrCodes = async (studentList) => {
    const qrs = {};
    for (const student of studentList) {
      try {
        // Compact identifier payload (Admission Number or ID)
        // Level 'L' produces Version 1 (21x21 matrix) with the largest, boldest squares possible
        const qrPayload = student.admissionNumber || String(student._id);

        const qrDataUrl = await QRCode.toDataURL(qrPayload, {
          width: 380,
          margin: 1,
          color: {
            dark: '#000000', // Pure pitch black for maximum optical contrast
            light: '#ffffff',
          },
          errorCorrectionLevel: 'L', // Level L: Maximum square module size for instant webcam recognition
        });
        qrs[student._id] = qrDataUrl;
      } catch (err) {
        console.error(`QR gen error for ${student.fullName}:`, err);
      }
    }
    setQrCodeUrls(qrs);
  };

  // Toggle selection
  const toggleSelectStudent = (id) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.size === students.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(students.map((s) => s._id)));
    }
  };

  // Clean Class Name formatting (strips redundant "Class" prefix)
  const formatClassName = (className, section) => {
    if (!className) return section ? `CLASS - ${section}` : 'CLASS - 1 (A)';
    const cleaned = className.replace(/^(class|grade)\s*/i, '').trim();
    const sec = section && section !== 'ALL' ? ` (${section})` : '';
    return `CLASS - ${cleaned}${sec}`;
  };

  // Format Date of Birth
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Safe element render to DataURL (Primary: html-to-image, Fallback: html2canvas)
  const renderCardToDataUrl = async (element) => {
    try {
      return await htmlToImage.toPng(element, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: false,
        skipAutoScale: true,
      });
    } catch (primaryErr) {
      console.warn('htmlToImage encountered error, using fallback html2canvas:', primaryErr);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      return canvas.toDataURL('image/png');
    }
  };

  // 3. Export High-Res Printable PDF (A4 Sheet layout: 3 x 3 CR80 cards)
  const handleExportPdf = async () => {
    const selectedStudents = students.filter((s) => selectedStudentIds.has(s._id));
    if (selectedStudents.length === 0) {
      setToast({ type: 'error', message: 'Please select at least one student card to export.' });
      return;
    }

    setExportingPdf(true);
    setPdfProgress(0);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const cardWidth = 54;
      const cardHeight = 85.6;
      const marginX = 12;
      const marginY = 10;
      const gapX = 12;
      const gapY = 10;
      const cardsPerRow = 3;
      const cardsPerCol = 3;
      const maxCardsPerPage = cardsPerRow * cardsPerCol;

      let currentCardIndex = 0;
      const totalStudents = selectedStudents.length;

      for (let i = 0; i < totalStudents; i++) {
        const student = selectedStudents[i];
        setPdfProgress(Math.round(((i + 1) / totalStudents) * 100));

        const frontElement = document.getElementById(`id-card-front-${student._id}`);
        const backElement = document.getElementById(`id-card-back-${student._id}`);

        // 1. Process Front Card
        if (frontElement && (viewSide === 'both' || viewSide === 'front')) {
          const frontImgData = await renderCardToDataUrl(frontElement);

          if (currentCardIndex > 0 && currentCardIndex % maxCardsPerPage === 0) {
            pdf.addPage('a4', 'portrait');
          }

          const pageSlot = currentCardIndex % maxCardsPerPage;
          const col = pageSlot % cardsPerRow;
          const row = Math.floor(pageSlot / cardsPerRow);

          const posX = marginX + col * (cardWidth + gapX);
          const posY = marginY + row * (cardHeight + gapY);

          pdf.addImage(frontImgData, 'PNG', posX, posY, cardWidth, cardHeight, undefined, 'FAST');
          currentCardIndex++;
        }

        // 2. Process Back Card
        if (backElement && (viewSide === 'both' || viewSide === 'back')) {
          const backImgData = await renderCardToDataUrl(backElement);

          if (currentCardIndex > 0 && currentCardIndex % maxCardsPerPage === 0) {
            pdf.addPage('a4', 'portrait');
          }

          const pageSlot = currentCardIndex % maxCardsPerPage;
          const col = pageSlot % cardsPerRow;
          const row = Math.floor(pageSlot / cardsPerRow);

          const posX = marginX + col * (cardWidth + gapX);
          const posY = marginY + row * (cardHeight + gapY);

          pdf.addImage(backImgData, 'PNG', posX, posY, cardWidth, cardHeight, undefined, 'FAST');
          currentCardIndex++;
        }
      }

      const fileName = `Student_ID_Cards_${selectedClass}_${effectiveSession}.pdf`;
      pdf.save(fileName);

      setToast({
        type: 'success',
        message: `Successfully generated official PDF for ${totalStudents} students!`,
      });
    } catch (err) {
      console.error('PDF Generation Error:', err);
      setToast({
        type: 'error',
        message: `Failed to export PDF: ${err.message}. You can also use the "Print Sheet" option.`,
      });
    } finally {
      setExportingPdf(false);
      setPdfProgress(0);
    }
  };

  // 4. Download Single Student Card (Front & Back)
  const handleDownloadSingleCard = async (student) => {
    try {
      const frontElement = document.getElementById(`id-card-front-${student._id}`);
      const backElement = document.getElementById(`id-card-back-${student._id}`);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [60, 95],
      });

      if (frontElement) {
        const frontImg = await renderCardToDataUrl(frontElement);
        pdf.addImage(frontImg, 'PNG', 3, 4, 54, 85.6);
      }

      if (backElement && viewSide === 'both') {
        pdf.addPage([60, 95], 'portrait');
        const backImg = await renderCardToDataUrl(backElement);
        pdf.addImage(backImg, 'PNG', 3, 4, 54, 85.6);
      }

      const safeName = (student.fullName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`ID_Card_${safeName}_${student.rollNumber || 'Card'}.pdf`);

      setToast({
        type: 'success',
        message: `Downloaded ID card for ${student.fullName}!`,
      });
    } catch (err) {
      console.error('Single card export error:', err);
      setToast({ type: 'error', message: 'Failed to download card: ' + err.message });
    }
  };

  // 5. Browser Native Print Dialog
  const handleBrowserPrint = () => {
    window.print();
  };

  const selectedStudents = students.filter((s) => selectedStudentIds.has(s._id));

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-5 pb-16">
      {/* Print Specific CSS Sheet for PVC Card Printers & A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          nav, aside, header, .no-print {
            display: none !important;
          }
          .print-area {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 10mm 8mm !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .id-card-wrapper {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
            margin: 0 auto !important;
          }
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

      {/* 1. TOP HEADER BANNER */}
      <div className="bg-[#041633] text-white rounded-2xl p-5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 no-print">
        <div>
          <div className="flex items-center gap-2 text-[#ffa000] text-xs font-bold uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Student Management • Digital Smart Pass</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Student Identity Cards Generator</span>
            <span className="text-xs bg-amber-500/20 text-[#ffa000] px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold">
              PVC CR80 Standard
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Generate authentic school ID cards. Front features school branding, student photo, and
            aligned particulars with rich design accents. Back includes a <strong>High-Contrast Digital Attendance QR Code</strong> for automated scanning.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchStudents}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Reload</span>
          </button>

          {/* Export High-Res PDF Button */}
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf || selectedStudents.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
            title="Download PVC Print-Ready PDF Format"
          >
            {exportingPdf ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting ({pdfProgress}%)...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF ({selectedStudents.length})</span>
              </>
            )}
          </button>

          {/* Browser Direct Print Button */}
          <button
            onClick={handleBrowserPrint}
            disabled={selectedStudents.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-[#ffa000] to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
            title="Print directly to PVC or A4 Printer"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER & CARD CUSTOMIZATION CONTROLS */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4 no-print">
        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs">
          {/* Class Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Select Class</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSection('ALL');
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Enrolled Classes</option>
              {classNames.map((c) => (
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
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="ALL">All Sections</option>
              {getSectionsForClass(selectedClass).map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Quick Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Roll, Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Color Theme Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-500" />
              <span>Card Color Scheme</span>
            </label>
            <select
              value={activeTheme}
              onChange={(e) => setActiveTheme(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="maroon">Govt Crimson & Gold (Image 2 Style)</option>
              <option value="navy">Executive Navy & Amber</option>
              <option value="emerald">Royal Emerald & Gold</option>
              <option value="indigo">Classic Indigo & Cyan</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              <span>Card Sides Preview</span>
            </label>
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewSide('both')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition cursor-pointer ${
                  viewSide === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                Front & Back
              </button>
              <button
                type="button"
                onClick={() => setViewSide('front')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition cursor-pointer ${
                  viewSide === 'front' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                Front Only
              </button>
              <button
                type="button"
                onClick={() => setViewSide('back')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition cursor-pointer ${
                  viewSide === 'back' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                QR Back Only
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Selection Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer transition"
            >
              {selectedStudentIds.size === students.length && students.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {selectedStudentIds.size === students.length ? 'Deselect All' : 'Select All Candidates'}
              </span>
            </button>

            <span className="text-slate-400">|</span>

            <span className="font-semibold text-slate-600">
              Selected: <strong className="text-slate-900 font-black">{selectedStudentIds.size}</strong>{' '}
              of {students.length} Students
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={showLanyardSlot}
                onChange={(e) => setShowLanyardSlot(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
              />
              <span>Display Lanyard Punch Hole</span>
            </label>

            <span className="text-slate-300">•</span>

            <span className="text-slate-500">
              Session: <strong className="text-amber-600 font-mono font-bold">{effectiveSession}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. CARDS DISPLAY & PRINT GRID */}
      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
          <span className="text-sm font-bold text-slate-700">Generating student ID cards...</span>
          <span className="text-xs text-slate-400">Preparing high-resolution QR codes and layout</span>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-sm">
          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Student Records Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            No active students found matching the selected class and section filters. Please adjust the
            filters above or enroll students in the Admission module.
          </p>
        </div>
      ) : (
        <div
          ref={printAreaRef}
          className="print-area grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 justify-items-center"
        >
          {students.map((student) => {
            const isSelected = selectedStudentIds.has(student._id);
            const qrUrl = qrCodeUrls[student._id];

            return (
              <div
                key={student._id}
                className={`id-card-wrapper flex flex-col items-center gap-3 p-3 rounded-2xl transition ${
                  isSelected ? 'bg-slate-50/90 border border-slate-200' : 'opacity-40 hover:opacity-80'
                }`}
              >
                {/* Single Card Selection Checkbox & Quick Download (Screen Only) */}
                <div className="w-full flex items-center justify-between px-2 text-xs font-semibold no-print">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectStudent(student._id)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <span className="text-slate-800 font-bold truncate max-w-[150px]">
                      Roll #{student.rollNumber || '—'} • {student.fullName}
                    </span>
                  </label>

                  <button
                    onClick={() => handleDownloadSingleCard(student)}
                    className="flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded cursor-pointer transition border border-rose-200 shadow-2xs"
                    title="Download this single card as PDF"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>

                {/* Card Pair Layout: Front & Back */}
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {/* ======================================================== */}
                  {/* FRONT SIDE (FAVORITE ORIGINAL CLEAN WHITE UI + DESIGN)    */}
                  {/* ======================================================== */}
                  {(viewSide === 'both' || viewSide === 'front') && (
                    <div
                      id={`id-card-front-${student._id}`}
                      className="relative w-[245px] h-[395px] bg-white rounded-[20px] shadow-lg border-[3px] border-slate-300 overflow-hidden flex flex-col justify-between text-slate-800 shrink-0 select-none"
                      style={{
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                      }}
                    >
                      {/* Top Red Lanyard Clip Ribbon Graphic (Like Reference Image 2) */}
                      {showLanyardSlot && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
                          <div
                            className={`w-5 h-2.5 bg-gradient-to-b ${currentTheme.strapGradient} rounded-t-sm shadow-xs border-x border-rose-900/40`}
                          ></div>
                          <div className="w-3 h-1 bg-slate-300 rounded-full border border-slate-400 shadow-inner -mt-0.5"></div>
                        </div>
                      )}

                      {/* Top Lanyard Punch Slot Hole */}
                      {showLanyardSlot && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-11 h-2 rounded-full bg-slate-200 border border-slate-400/70 shadow-inner pointer-events-none"></div>
                      )}

                      {/* Top-Right Decorative Geometric Wing Accent (Strictly corner, clear of text) */}
                      <div className="absolute top-0 right-0 w-28 h-20 pointer-events-none z-10 overflow-hidden">
                        <div
                          className="absolute -top-10 -right-8 w-24 h-24 rounded-bl-[40px] transform rotate-12 shadow-xs"
                          style={{ backgroundColor: currentTheme.primary }}
                        ></div>
                        <div
                          className="absolute -top-12 -right-5 w-20 h-20 rounded-bl-[30px] opacity-40 transform rotate-6"
                          style={{ backgroundColor: currentTheme.accent }}
                        ></div>
                      </div>

                      {/* Top-Right Session Badge & Origami Airplane Icon (Image 2 style) */}
                      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                        <div className="w-3.5 h-3.5 transform -rotate-12 drop-shadow-xs">
                          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                            <path d="M2 12L22 2L15 22L11 13L2 12Z" fill="#facc15" stroke="#ca8a04" strokeWidth="0.8" />
                            <path d="M11 13L22 2" stroke="#3b82f6" strokeWidth="1.2" />
                          </svg>
                        </div>
                        <div className="bg-amber-400 text-slate-950 font-black text-[8px] px-2 py-0.5 rounded shadow-xs tracking-wider uppercase font-mono">
                          {effectiveSession}
                        </div>
                      </div>

                      {/* Top-Left Champagne Concentric Arcs (Image 2 style) */}
                      <div className="absolute top-0 left-0 w-20 h-20 pointer-events-none z-0 overflow-hidden">
                        <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full border-[3px] border-amber-300/40"></div>
                        <div className="absolute -top-6 -left-6 w-18 h-18 rounded-full border-[2px] border-amber-400/25"></div>
                      </div>

                      {/* Subtle Security Guilloche Watermark Pattern in Background */}
                      <div className="absolute inset-0 pointer-events-none opacity-[0.035] z-0 overflow-hidden">
                        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <pattern id={`guilloche-${student._id}`} width="36" height="36" patternUnits="userSpaceOnUse">
                              <path d="M 0 18 Q 9 0 18 18 T 36 18" fill="none" stroke="#000" strokeWidth="1" />
                              <path d="M 0 36 Q 9 18 18 36 T 36 36" fill="none" stroke="#000" strokeWidth="1" />
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill={`url(#guilloche-${student._id})`} />
                        </svg>
                      </div>

                      {/* 1. School Header: Logo + Bold School Name + Campus Line */}
                      <div className="relative z-10 pt-4 pb-1 px-3 text-center flex flex-col items-center">
                        {/* Soft arched backdrop behind school name & logo */}
                        <div className="absolute inset-x-3 top-2 bottom-0 rounded-2xl bg-gradient-to-b from-amber-50/40 via-slate-50/20 to-transparent border border-amber-200/40 pointer-events-none z-0"></div>

                        {/* Official School Logo Emblem with Golden Ring */}
                        <div className="relative z-10 mx-auto w-12 h-12 rounded-full bg-white p-0.5 shadow-sm border-2 border-amber-400 flex items-center justify-center mb-1">
                          {schoolProfile?.logoUrl || schoolLogo ? (
                            <img
                              src={schoolProfile?.logoUrl || schoolLogo}
                              alt="Logo"
                              className="w-full h-full object-contain rounded-full"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div
                              className="w-full h-full rounded-full flex items-center justify-center font-black text-xs text-white"
                              style={{ backgroundColor: currentTheme.primary }}
                            >
                              {displaySchoolName.slice(0, 3)}
                            </div>
                          )}
                        </div>

                        {/* School Name in Bold Theme Primary Color (100% visible on white) */}
                        <h2
                          className="relative z-10 text-[11.5px] font-black uppercase tracking-tight leading-tight line-clamp-2 max-w-[195px] mx-auto drop-shadow-xs"
                          style={{ color: currentTheme.primary }}
                          title={displaySchoolName}
                        >
                          {displaySchoolName}
                        </h2>

                        {/* Campus Subline in Cyan / Slate */}
                        <p
                          className="relative z-10 text-[8px] font-extrabold uppercase tracking-wide truncate mt-0.5 max-w-[190px] mx-auto"
                          style={{ color: currentTheme.secondary }}
                        >
                          {displayAddress}
                        </p>
                      </div>

                      {/* 2. Central Student Photo & Profile Name */}
                      <div className="px-3 text-center flex flex-col items-center z-10 -mt-0.5">
                        {/* Framed Student Photo with Gold Ring & Shadow */}
                        <div className="relative w-[82px] h-[94px] rounded-xl bg-slate-100 p-0.5 ring-2 ring-amber-400/80 border-2 border-white shadow-md overflow-hidden">
                          {student.photo?.url ? (
                            <img
                              src={student.photo.url}
                              alt={student.fullName}
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full rounded-lg bg-gradient-to-b from-slate-200 to-slate-300 text-slate-600 flex flex-col items-center justify-center font-bold text-lg">
                              <span>{student.fullName ? student.fullName.charAt(0) : 'S'}</span>
                              <span className="text-[7px] text-slate-500 uppercase font-normal">Photo</span>
                            </div>
                          )}
                        </div>

                        {/* Student Name in Bold Navy Blue */}
                        <h3
                          className="text-[12.5px] font-black uppercase tracking-tight mt-1 truncate max-w-[205px]"
                          style={{ color: currentTheme.studentNameColor }}
                        >
                          {student.fullName}
                        </h3>

                        {/* Class & Section Pill Badge (Formatted cleanly: e.g. CLASS - 10 (A)) */}
                        <div
                          className="inline-block px-3 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider text-white shadow-xs mt-0.5"
                          style={{ backgroundColor: currentTheme.primary }}
                        >
                          {formatClassName(student.className, student.section)}
                        </div>
                      </div>

                      {/* 3. Student Particulars - CLEAN, UNBOXED LIST WITH LIGHT DIVIDERS */}
                      <div className="px-3.5 py-0.5 text-[8.5px] font-semibold text-slate-700 space-y-0.5 z-10">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-0.5">
                          <span className="text-slate-500 font-bold">Father Name:</span>
                          <span className="font-bold text-slate-900 truncate max-w-[130px]">
                            {student.fatherName ? `Mr. ${student.fatherName}` : '—'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center border-b border-slate-100 pb-0.5">
                          <span className="text-slate-500 font-bold">Roll No.:</span>
                          <span className="font-mono font-black text-rose-800 bg-rose-50 px-1.5 py-0.2 rounded text-[8.5px] border border-rose-200/50">
                            {student.rollNumber || '—'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center border-b border-slate-100 pb-0.5">
                          <span className="text-slate-500 font-bold">Date of Birth:</span>
                          <span className="font-mono text-slate-900">{formatDate(student.dob)}</span>
                        </div>

                        <div className="flex justify-between items-center border-b border-slate-100 pb-0.5">
                          <span className="text-slate-500 font-bold">Mobile No.:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {student.fatherPhone || displayPhone}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pb-0.5">
                          <span className="text-slate-500 font-bold">Address:</span>
                          <span
                            className="font-bold text-slate-900 truncate max-w-[140px] text-[8.5px]"
                            title={student.address || displayAddress}
                          >
                            {student.address || displayAddress}
                          </span>
                        </div>
                      </div>

                      {/* 4. Bottom Footer Section: Principal Signature & Helpline */}
                      <div className="relative bg-gradient-to-r from-slate-50 via-white to-amber-50/40 border-t border-slate-200/80 px-3 pt-1 pb-2 min-h-[50px] flex items-end justify-between overflow-hidden z-20">
                        {/* Principal Signature Block */}
                        <div className="z-10 flex flex-col items-center justify-end min-w-[85px] max-w-[95px] pl-1">
                          {/* Signature Graphic or Digital Cursive */}
                          <div className="h-6 flex items-end justify-center mb-0.5 w-full">
                            {displaySignature ? (
                              <img
                                src={displaySignature}
                                alt="Principal Signature"
                                className="max-h-6 max-w-[85px] object-contain filter contrast-125"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <span
                                className="font-serif italic font-bold text-[13px] text-slate-800 leading-none select-none tracking-wide"
                                style={{ fontFamily: "'Brush Script MT', 'Dancing Script', 'Playfair Display', serif" }}
                              >
                                {principalTitle}
                              </span>
                            )}
                          </div>
                          {/* Divider line */}
                          <div className="w-18 h-[1.2px] bg-slate-400 rounded-full mb-0.5"></div>
                          {/* Label */}
                          <span className="text-[6.5px] text-slate-500 uppercase font-black tracking-wider block text-center whitespace-nowrap">
                            {principalTitle ? `${principalTitle.toUpperCase()} SIGN` : 'PRINCIPAL SIGN'}
                          </span>
                        </div>

                        {/* Emergency Contact Badge */}
                        <div className="z-10 flex items-center gap-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-slate-950 font-black text-[8px] px-2.5 py-1 rounded-full shadow-xs border border-amber-600/30 shrink-0 mb-0.5 mr-0.5">
                          <Phone className="w-2.5 h-2.5 fill-slate-950 text-slate-950 shrink-0" />
                          <span className="font-mono font-bold tracking-tight">{displayPhone}</span>
                        </div>

                        {/* Stylized Burgundy / Crimson Corner Wave on Bottom-Right (subtle background) */}
                        <div
                          className="absolute -bottom-6 -right-6 w-16 h-16 rounded-tl-[30px] transform rotate-6 pointer-events-none opacity-25 shadow-xs"
                          style={{ backgroundColor: currentTheme.primary }}
                        ></div>
                        <div
                          className="absolute -bottom-8 -right-4 w-14 h-14 rounded-tl-[22px] pointer-events-none opacity-20"
                          style={{ backgroundColor: currentTheme.accent }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* BACK SIDE (WITH HIGH-CONTRAST DIGITAL ATTENDANCE QR CODE) */}
                  {/* ======================================================== */}
                  {(viewSide === 'both' || viewSide === 'back') && (
                    <div
                      id={`id-card-back-${student._id}`}
                      className="relative w-[245px] h-[395px] bg-white rounded-[20px] shadow-lg border-[3px] border-slate-300 overflow-hidden flex flex-col justify-between text-slate-800 shrink-0 select-none"
                      style={{
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                      }}
                    >
                      {/* Top Lanyard Clip Ribbon Graphic */}
                      {showLanyardSlot && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
                          <div
                            className={`w-5 h-2.5 bg-gradient-to-b ${currentTheme.strapGradient} rounded-t-sm shadow-xs border-x border-rose-900/40`}
                          ></div>
                          <div className="w-3 h-1 bg-slate-300 rounded-full border border-slate-400 shadow-inner -mt-0.5"></div>
                        </div>
                      )}

                      {/* Top Lanyard Punch Slot Hole */}
                      {showLanyardSlot && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-11 h-2 rounded-full bg-slate-200 border border-slate-400/70 shadow-inner pointer-events-none"></div>
                      )}

                      {/* Back Header Banner */}
                      <div
                        className="pt-4 pb-2 px-3 text-center text-white"
                        style={{ backgroundColor: currentTheme.primary }}
                      >
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                          {displaySchoolName}
                        </h4>
                        <div className="text-[8px] font-bold text-slate-200 tracking-wider uppercase mt-0.5">
                          Student Digital Pass • {schoolCode}
                        </div>
                      </div>

                      {/* Central QR Code Container */}
                      <div className="px-3 text-center flex flex-col items-center">
                        <div className="bg-white p-2 rounded-xl border-2 border-slate-800 shadow-sm inline-block">
                          {qrUrl ? (
                            <img
                              src={qrUrl}
                              alt="Attendance QR Code"
                              className="w-28 h-28 object-contain"
                            />
                          ) : (
                            <div className="w-28 h-28 bg-slate-100 flex items-center justify-center">
                              <QrCode className="w-10 h-10 text-slate-400 animate-pulse" />
                            </div>
                          )}
                        </div>

                        <div className="text-[9px] font-mono font-black text-slate-900 mt-1 uppercase">
                          Scan for Digital Attendance
                        </div>
                        <div className="text-[8px] text-slate-500 font-mono">
                          ID: {student.admissionNumber || student.rollNumber}
                        </div>
                      </div>

                      {/* Terms & Conditions Block */}
                      <div className="px-3 py-1 text-[7.5px] leading-tight text-slate-600 space-y-1 bg-amber-50/50 rounded-lg mx-2.5 border border-amber-200/60">
                        <div className="font-bold text-slate-900 uppercase text-[8px] border-b border-amber-200 pb-0.5 text-amber-900">
                          Terms & Conditions
                        </div>
                        <p className="flex items-start gap-1">
                          <span className="text-amber-600 font-bold">▪</span>
                          <span>This card is non-transferable and must be worn inside campus.</span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-amber-600 font-bold">▪</span>
                          <span>In case of loss, report immediately to the admin office.</span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-amber-600 font-bold">▪</span>
                          <span>Used for automated QR gate attendance and library entry.</span>
                        </p>
                      </div>

                      {/* Emergency Return Address Footer */}
                      <div className="bg-slate-100 border-t border-slate-200 p-2 text-center text-[7.5px] text-slate-600">
                        <div className="font-bold text-slate-900">If found, please return to:</div>
                        <div className="truncate font-medium">{displayAddress}</div>
                        <div className="font-mono text-slate-800 font-bold mt-0.5">
                          Helpline: {displayPhone} • {displayEmail}
                        </div>
                        <div className="text-[7px] text-slate-400 mt-0.5">
                          Valid for Session: <strong className="text-slate-700">{effectiveSession}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
