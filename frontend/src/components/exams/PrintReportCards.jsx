import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../context/AcademicClassesContext';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import {
  Printer,
  FileDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Award,
  Layers,
  School,
  Sparkles,
} from 'lucide-react';

export default function PrintReportCards({ schoolCode }) {
  const { classes } = useAcademicClasses();
  const { currentSession: academicSession, sessions, switchSession } = useAcademicSession();

  const classList = classes && classes.length > 0
    ? classes.map((c) => c.name || c)
    : ['Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

  const [reportMode, setReportMode] = useState('consolidated'); // 'consolidated' or 'single'
  const [selectedClass, setSelectedClass] = useState(classList[0] || 'Class 1');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedTerm, setSelectedTerm] = useState('Mid Term');
  const [selectedStudentId, setSelectedStudentId] = useState('ALL');

  const [terms, setTerms] = useState([]);
  const [reportCards, setReportCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [message, setMessage] = useState(null);

  // School Profile & Branding State (Automatically populated from database)
  const [schoolProfile, setSchoolProfile] = useState({
    schoolName: 'ISLAMABAD MODEL COLLEGE FOR BOYS',
    tagline: 'Excellence in Education & Character Building',
    address: 'PAKISTAN TOWN, ISLAMABAD',
    phone: '+92 51 9283741',
    affiliation: 'Affiliated with Federal Board of Intermediate and Secondary Education (FBISE)',
    principalTitle: 'Principal',
    vicePrincipalTitle: 'Vice Principal',
    logoUrl: null,
  });

  // 1. Fetch School Profile automatically for logged-in school
  useEffect(() => {
    const fetchSchoolProfile = async () => {
      try {
        const res = await api.get('/school-profile', { params: { schoolCode } });
        if (res.data?.success && res.data.data) {
          setSchoolProfile(res.data.data);
        }
      } catch (err) {
        console.warn('Could not fetch school profile:', err);
      }
    };
    fetchSchoolProfile();
  }, [schoolCode]);

  // 2. Fetch available terms for session
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await api.get('/exams/terms', {
          params: { schoolCode, academicSession },
        });
        if (res.data?.success && res.data.data?.length > 0) {
          setTerms(res.data.data);
          if (!selectedTerm || !res.data.data.some((t) => t.name === selectedTerm)) {
            setSelectedTerm(res.data.data[0].name);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchTerms();
  }, [schoolCode, academicSession]);

  // 3. Fetch report cards based on mode
  const fetchReportCards = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const endpoint = reportMode === 'consolidated'
        ? '/exams/report-cards/consolidated'
        : '/exams/report-cards/single-term';

      const params = {
        schoolCode,
        className: selectedClass,
        section: selectedSection,
        academicSession,
      };

      if (reportMode === 'single') {
        params.termName = selectedTerm;
      }

      if (selectedStudentId && selectedStudentId !== 'ALL') {
        params.studentId = selectedStudentId;
      }

      const res = await api.get(endpoint, { params });
      if (res.data?.success) {
        setReportCards(res.data.data || []);
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to fetch report cards.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Network error while fetching report cards.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportCards();
  }, [reportMode, selectedClass, selectedSection, selectedTerm, selectedStudentId, schoolCode, academicSession]);

  // High-Resolution Professional PDF Export using html-to-image & jsPDF
  const handleDownloadPdf = async (singleStudentId = null) => {
    if (reportCards.length === 0) return;
    setGeneratingPdf(true);
    setPdfProgress(0);
    setMessage(null);

    try {
      // Find cards to export
      let targetCards = [];
      if (singleStudentId) {
        const cardNode = document.getElementById(`report-card-inner-${singleStudentId}`);
        if (cardNode) {
          targetCards = [{ node: cardNode, student: reportCards.find((r) => r.studentId === singleStudentId) }];
        }
      } else {
        targetCards = reportCards.map((rc) => ({
          node: document.getElementById(`report-card-inner-${rc.studentId}`),
          student: rc,
        })).filter((item) => item.node !== null);
      }

      if (targetCards.length === 0) {
        throw new Error('Report card elements not found in DOM.');
      }

      // Initialize jsPDF A4 portrait in millimeters
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const totalElements = targetCards.length;

      for (let i = 0; i < totalElements; i++) {
        const { node } = targetCards[i];
        setPdfProgress(Math.round(((i + 1) / totalElements) * 100));

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        // Render card node with high DPI (pixelRatio: 2) via html-to-image
        const imgData = await htmlToImage.toJpeg(node, {
          quality: 0.95,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: false,
          filter: (domNode) => {
            if (domNode?.classList && domNode.classList.contains('print:hidden')) return false;
            return true;
          },
        });

        // Exact A4 dimensions in mm
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 8;
        const printWidth = pageWidth - margin * 2; // 194 mm

        // Image natural aspect ratio
        const img = new Image();
        img.src = imgData;
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
        });

        const printHeight = (img.height * printWidth) / img.width;

        pdf.addImage(
          imgData,
          'JPEG',
          margin,
          margin,
          printWidth,
          Math.min(printHeight, pageHeight - margin * 2)
        );
      }

      // Filename
      const filename = singleStudentId
        ? `Report_Card_${reportCards.find((r) => r.studentId === singleStudentId)?.studentName?.replace(/\s+/g, '_') || 'Student'}_${academicSession}.pdf`
        : `${selectedClass.replace(/\s+/g, '_')}_${selectedSection}_Report_Cards_${academicSession}.pdf`;

      pdf.save(filename);
      setMessage({ type: 'success', text: `Official PDF "${filename}" downloaded successfully!` });
    } catch (err) {
      console.error('PDF Generation Error:', err);
      setMessage({
        type: 'error',
        text: `Error generating PDF: ${err.message || 'Rendering failed'}. Standard browser print is also ready.`,
      });
    } finally {
      setGeneratingPdf(false);
      setPdfProgress(0);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-[1800px] mx-auto pb-12 space-y-6">
      {/* Screen Controls Header (Hidden in Print) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Printer className="w-6 h-6 text-amber-500" />
              Report Cards & Result Certificates Print Engine
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Official school report cards automatically branded with <strong className="text-slate-800">{schoolProfile.schoolName}</strong> for Session <strong className="text-amber-600">{academicSession}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchReportCards}
              disabled={loading}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Direct High-Res PDF Download Button */}
            <button
              onClick={() => handleDownloadPdf()}
              disabled={reportCards.length === 0 || generatingPdf}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-5 py-2 rounded-lg flex items-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
            >
              {generatingPdf ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Creating PDF ({pdfProgress}%)...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Download Official PDF ({reportCards.length})</span>
                </>
              )}
            </button>

            {/* Standard Window Print Button */}
            <button
              onClick={handleBrowserPrint}
              disabled={reportCards.length === 0}
              className="bg-[#041633] hover:bg-[#06204d] text-[#ffa000] text-xs font-black px-4 py-2 rounded-lg flex items-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mt-5">
          {/* Mode Switcher */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Report Card Type</label>
            <select
              value={reportMode}
              onChange={(e) => setReportMode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="consolidated">Annual Consolidated (All Exams)</option>
              <option value="single">Single Term / Exam Only</option>
            </select>
          </div>

          {/* Exam Term (if single) OR Academic Session Switcher */}
          {reportMode === 'single' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Exam Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {terms.map((t) => (
                  <option key={t._id || t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Academic Session</label>
              <select
                value={academicSession}
                onChange={(e) => switchSession(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {sessions.map((s) => (
                  <option key={s._id} value={s.sessionName}>
                    {s.sessionName} {s.isActive ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {classList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {['A', 'B', 'C', 'D'].map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Student Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Filter Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Students ({reportCards.length})</option>
              {reportCards.map((r) => (
                <option key={r.studentId} value={r.studentId}>
                  {r.studentName} ({r.rollNumber || 'No Roll'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs md:text-sm font-medium print:hidden ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs underline hover:opacity-75 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Printable Report Cards Container */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-500" />
          <p className="font-semibold text-slate-600">Generating report cards from database...</p>
        </div>
      ) : reportCards.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center text-slate-400 print:hidden">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-40 text-amber-500" />
          <p className="font-bold text-slate-700 text-base">No Report Cards Found</p>
          <p className="text-xs text-slate-500 mt-1">
            Ensure marks have been entered in the Marks Entry Sheet for {selectedClass} Section {selectedSection} ({academicSession}).
          </p>
        </div>
      ) : (
        <div className="space-y-12 print:space-y-0">
          {reportCards.map((rc, cardIdx) => (
            <div
              key={rc.studentId || cardIdx}
              id={`report-card-${rc.studentId}`}
              className="bg-white p-4 sm:p-6 md:p-10 rounded-xl shadow-sm border border-slate-300 max-w-4xl mx-auto overflow-x-auto print:overflow-visible print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:page-break relative"
              style={{ pageBreakAfter: 'always' }}
            >
              {/* Single Student Download PDF Button (Screen only) */}
              <div className="absolute top-3 right-3 print:hidden flex items-center gap-2 z-10">
                <button
                  onClick={() => handleDownloadPdf(rc.studentId)}
                  disabled={generatingPdf}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                  title="Download single student PDF"
                >
                  <FileDown className="w-3.5 h-3.5 text-rose-400" />
                  <span>Download This PDF</span>
                </button>
              </div>

              {/* Inner Official Card (Rendered to PDF / Printed) */}
              <div
                id={`report-card-inner-${rc.studentId}`}
                className="report-card-inner-node border-[3px] border-slate-900 p-5 sm:p-6 md:p-8 rounded-lg relative min-h-[920px] min-w-[580px] md:min-w-0 flex flex-col justify-between bg-white text-slate-900"
              >
                <div>
                  {/* Header: Dynamic School Logo, Dynamic Name & Title from logged-in school profile */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
                    {/* School Logo */}
                    <div className="w-20 h-20 rounded-full border-2 border-slate-900 flex items-center justify-center p-1 bg-amber-50/20 shrink-0 overflow-hidden">
                      {schoolProfile.logoUrl ? (
                        <img
                          src={schoolProfile.logoUrl}
                          alt={schoolProfile.schoolName}
                          className="w-full h-full object-contain"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <GraduationCap className="w-12 h-12 text-[#041633]" />
                      )}
                    </div>

                    {/* School Title & Address (Auto-loaded from logged-in School Profile) */}
                    <div className="text-center flex-1 px-4">
                      <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-slate-900 leading-tight">
                        {schoolProfile.schoolName || 'ISLAMABAD MODEL COLLEGE FOR BOYS'}
                      </h1>
                      <p className="text-xs md:text-sm font-bold uppercase tracking-wide text-slate-700 mt-0.5">
                        {schoolProfile.address || 'PAKISTAN TOWN, ISLAMABAD'}
                      </p>
                      {schoolProfile.affiliation && (
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                          {schoolProfile.affiliation}
                        </p>
                      )}
                      <div className="inline-block border-b-2 border-slate-900 mt-2 pb-0.5">
                        <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-900">
                          {reportMode === 'consolidated'
                            ? 'FINAL CONSOLIDATED REPORT CARD'
                            : `${selectedTerm.toUpperCase()} REPORT CARD`}
                        </h2>
                      </div>
                    </div>

                    <div className="w-20 shrink-0"></div>
                  </div>

                  {/* Class & Academic Session Banner */}
                  <div className="text-center mb-6">
                    <span className="text-sm md:text-base font-black text-slate-900">
                      Class: {rc.className}-{rc.section} ({rc.academicSession || academicSession})
                    </span>
                  </div>

                  {/* Student Particulars Block + Photo */}
                  <div className="flex justify-between items-start gap-6 mb-8 text-xs md:text-sm">
                    <div className="flex-1 space-y-3 font-semibold text-slate-800">
                      <div className="flex items-end">
                        <span className="w-32 font-bold text-slate-900 shrink-0">Student Name:</span>
                        <span className="flex-1 border-b border-slate-800 pb-0.5 font-black uppercase text-slate-900 tracking-wide">
                          {rc.studentName}
                        </span>
                      </div>

                      <div className="flex items-end">
                        <span className="w-32 font-bold text-slate-900 shrink-0">Father Name:</span>
                        <span className="flex-1 border-b border-slate-800 pb-0.5 font-bold uppercase text-slate-800">
                          {rc.fatherName || '—'}
                        </span>
                      </div>

                      <div className="flex items-center gap-8 pt-1">
                        <div className="flex items-end flex-1">
                          <span className="w-20 font-bold text-slate-900 shrink-0">Roll No.:</span>
                          <span className="w-24 border-b border-slate-800 pb-0.5 font-bold text-center">
                            {rc.rollNumber || '—'}
                          </span>
                        </div>

                        <div className="flex items-end flex-1">
                          <span className="w-32 font-bold text-slate-900 shrink-0">Admission No.:</span>
                          <span className="flex-1 border-b border-slate-800 pb-0.5 font-bold text-center">
                            {rc.admissionNumber || '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Student Photo */}
                    <div className="w-24 h-28 border-2 border-slate-900 rounded bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                      {rc.studentPhoto ? (
                        <img
                          src={rc.studentPhoto}
                          alt={rc.studentName}
                          className="w-full h-full object-cover"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <GraduationCap className="w-8 h-8 mx-auto text-slate-400 mb-1" />
                          <span className="text-[10px] text-slate-400 font-semibold block">Photo</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Marks & Grades Table */}
                  <div className="mb-6 overflow-hidden border-2 border-slate-900 rounded">
                    {reportMode === 'consolidated' ? (
                      /* Consolidated Table: Subjects x Defined Terms */
                      <table className="w-full text-left border-collapse text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-slate-900 font-black border-b-2 border-slate-900 uppercase">
                            <th className="py-2.5 px-3 border-r-2 border-slate-900 w-12 text-center">#</th>
                            <th className="py-2.5 px-3 border-r-2 border-slate-900">Subject</th>
                            {/* Dynamically list defined exams as columns without percentage weightages */}
                            {(rc.terms || terms).map((t, idx) => (
                              <th
                                key={t._id || idx}
                                className="py-2.5 px-3 border-r-2 border-slate-900 text-center"
                              >
                                {t.name}
                              </th>
                            ))}
                            <th className="py-2.5 px-3 border-r-2 border-slate-900 text-center w-24">Total</th>
                            <th className="py-2.5 px-3 border-r-2 border-slate-900 text-center w-16">Grade</th>
                            <th className="py-2.5 px-3 text-center w-20">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y border-slate-900 font-semibold text-slate-900">
                          {rc.subjects?.map((sub, sIdx) => {
                            const subPercentage = sub.totalMax > 0 ? (sub.totalObtained / sub.totalMax) * 100 : 0;
                            let subGrade = 'F';
                            if (subPercentage >= 80) subGrade = 'A+';
                            else if (subPercentage >= 70) subGrade = 'A';
                            else if (subPercentage >= 60) subGrade = 'B';
                            else if (subPercentage >= 50) subGrade = 'C';
                            else if (subPercentage >= 40) subGrade = 'D';

                            return (
                              <tr key={sIdx} className="border-b border-slate-800">
                                <td className="py-2 px-3 border-r-2 border-slate-900 text-center font-bold">
                                  {sIdx + 1}
                                </td>
                                <td className="py-2 px-3 border-r-2 border-slate-900 font-bold">
                                  {sub.subjectName}
                                </td>
                                {sub.termScores?.map((ts, tsIdx) => (
                                  <td
                                    key={tsIdx}
                                    className="py-2 px-3 border-r-2 border-slate-900 text-center font-mono font-bold"
                                  >
                                    {ts.scoreDisplay}
                                  </td>
                                ))}
                                <td className="py-2 px-3 border-r-2 border-slate-900 text-center font-black">
                                  {sub.totalObtained} / {sub.totalMax}
                                </td>
                                <td className="py-2 px-3 border-r-2 border-slate-900 text-center font-black">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[11px] ${
                                      subGrade === 'F' ? 'text-rose-700 bg-rose-50' : 'text-emerald-800'
                                    }`}
                                  >
                                    {subGrade}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center text-xs font-bold">
                                  {sub.remarks}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-black border-t-2 border-slate-900 text-slate-900">
                            <td colSpan={2} className="py-2.5 px-3 border-r-2 border-slate-900 text-right uppercase">
                              Grand Total:
                            </td>
                            {(rc.terms || terms).map((t, idx) => (
                              <td key={idx} className="py-2.5 px-3 border-r-2 border-slate-900 text-center font-mono">
                                —
                              </td>
                            ))}
                            <td className="py-2.5 px-3 border-r-2 border-slate-900 text-center font-black">
                              {rc.grandTotalObtained} / {rc.grandTotalMax}
                            </td>
                            <td className="py-2.5 px-3 border-r-2 border-slate-900 text-center font-black">
                              {rc.overallGrade}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {rc.overallPercentage >= 40 ? 'PROMOTED' : 'FAILED'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      /* Single Term Table */
                      <table className="w-full text-left border-collapse text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-slate-900 font-black border-b-2 border-slate-900 uppercase">
                            <th className="py-2.5 px-3 border-r-2 border-slate-900 w-12 text-center">#</th>
                            <th className="py-2.5 px-3 border-r-2 border-slate-900">Subject</th>
                            <th className="py-2.5 px-3 border-r-2 border-slate-900 text-center w-24">Max Marks</th>
                            <th className="py-2.5 px-3 border-r-2 border-slate-900 text-center w-24">Pass Marks</th>
                            <th className="py-2.5 px-3 border-r-2 border-slate-900 text-center w-28">Obtained</th>
                            <th className="py-2.5 px-3 border-r-2 border-slate-900 text-center w-16">Grade</th>
                            <th className="py-2.5 px-3 text-center w-20">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y border-slate-900 font-semibold text-slate-900">
                          {rc.marks?.map((m, mIdx) => (
                            <tr key={mIdx} className="border-b border-slate-800">
                              <td className="py-2 px-3 border-r-2 border-slate-900 text-center font-bold">
                                {mIdx + 1}
                              </td>
                              <td className="py-2 px-3 border-r-2 border-slate-900 font-bold">
                                {m.subjectName}
                              </td>
                              <td className="py-2 px-3 border-r-2 border-slate-900 text-center font-mono">
                                {m.totalMarks}
                              </td>
                              <td className="py-2 px-3 border-r-2 border-slate-900 text-center font-mono">
                                {m.passingMarks}
                              </td>
                              <td className="py-2 px-3 border-r-2 border-slate-900 text-center font-mono font-black">
                                {m.isAbsent ? (
                                  <span className="text-rose-600 font-bold">Absent</span>
                                ) : (
                                  m.obtainedMarks
                                )}
                              </td>
                              <td className="py-2 px-3 border-r-2 border-slate-900 text-center font-black">
                                {m.grade}
                              </td>
                              <td className="py-2 px-3 text-center text-xs font-bold">
                                {m.isPassed ? 'Pass' : 'Fail'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-black border-t-2 border-slate-900 text-slate-900">
                            <td colSpan={2} className="py-2.5 px-3 border-r-2 border-slate-900 text-right uppercase">
                              Total Marks:
                            </td>
                            <td className="py-2.5 px-3 border-r-2 border-slate-900 text-center font-black">
                              {rc.totalMax}
                            </td>
                            <td className="py-2.5 px-3 border-r-2 border-slate-900 text-center">—</td>
                            <td className="py-2.5 px-3 border-r-2 border-slate-900 text-center font-black">
                              {rc.totalObtained}
                            </td>
                            <td className="py-2.5 px-3 border-r-2 border-slate-900 text-center font-black">
                              {rc.grade}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {rc.percentage >= 40 ? 'PASSED' : 'FAILED'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>

                  {/* Summary Metric Strip: Total, Percentage, Position, Grade */}
                  <div className="grid grid-cols-4 gap-3 border-2 border-slate-900 rounded p-3 mb-6 bg-slate-50 text-center">
                    <div className="border-r-2 border-slate-900">
                      <span className="text-[10px] md:text-xs font-black uppercase text-slate-600 block">Total Marks</span>
                      <span className="text-sm md:text-base font-black text-slate-900">
                        {reportMode === 'consolidated'
                          ? `${rc.grandTotalObtained} / ${rc.grandTotalMax}`
                          : `${rc.totalObtained} / ${rc.totalMax}`}
                      </span>
                    </div>

                    <div className="border-r-2 border-slate-900">
                      <span className="text-[10px] md:text-xs font-black uppercase text-slate-600 block">Percentage</span>
                      <span className="text-sm md:text-base font-black text-slate-900">
                        {reportMode === 'consolidated' ? `${rc.overallPercentage}%` : `${rc.percentage}%`}
                      </span>
                    </div>

                    <div className="border-r-2 border-slate-900">
                      <span className="text-[10px] md:text-xs font-black uppercase text-slate-600 block">Overall Grade</span>
                      <span className="text-sm md:text-base font-black text-emerald-800">
                        {reportMode === 'consolidated' ? rc.overallGrade : rc.grade}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] md:text-xs font-black uppercase text-slate-600 block">Class Position</span>
                      <span className="text-sm md:text-base font-black text-slate-900">
                        {rc.rank ? `${rc.rank}${rc.rank === 1 ? 'st' : rc.rank === 2 ? 'nd' : rc.rank === 3 ? 'rd' : 'th'}` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Teacher Remarks & Grading Scale */}
                  <div className="grid grid-cols-3 gap-4 mb-6 text-xs">
                    <div className="col-span-2 border-2 border-slate-900 rounded p-3">
                      <span className="font-bold text-slate-900 block mb-1">Class Teacher Remarks:</span>
                      <p className="text-slate-800 italic font-medium leading-relaxed">
                        {reportMode === 'consolidated'
                          ? (rc.overallPercentage >= 80
                            ? 'Outstanding academic performance throughout the session. Demonstrates exceptional aptitude and leadership qualities.'
                            : rc.overallPercentage >= 60
                            ? 'Good academic effort shown during the year. Consistent focus and practice in weaker subjects will ensure even higher achievement.'
                            : 'Needs focused attention and improvement in foundational subjects for the upcoming academic year.')
                          : (rc.percentage >= 80
                            ? 'Excellent academic performance and commendable participation in class.'
                            : 'Good effort. Keep working hard to achieve higher marks in the next term.')}
                      </p>
                    </div>

                    {/* Grading Scale Legend */}
                    <div className="border-2 border-slate-900 rounded p-2 text-[10px] font-bold text-slate-800">
                      <span className="block border-b border-slate-400 pb-0.5 mb-1 text-center font-black">
                        GRADING SCALE
                      </span>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                        <span>A+: 80% & Above</span>
                        <span>C: 50% - 59%</span>
                        <span>A: 70% - 79%</span>
                        <span>D: 40% - 49%</span>
                        <span>B: 60% - 69%</span>
                        <span>F: Below 40%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Signatures & Seal Block */}
                <div className="pt-8 border-t-2 border-slate-900 flex items-end justify-between text-xs font-bold text-slate-900">
                  <div className="text-center w-36">
                    <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
                    <span>Class Incharge</span>
                  </div>

                  <div className="text-center w-36">
                    <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
                    <span>Controller of Exams</span>
                  </div>

                  {/* Official Circular Seal */}
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-[9px] font-black uppercase text-slate-500 text-center leading-tight">
                    School Seal
                  </div>

                  <div className="text-center w-36">
                    <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
                    <span>{schoolProfile.principalTitle || 'Principal'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
