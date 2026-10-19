import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Printer,
  Search,
  Filter,
  User,
  School,
  Calendar,
  Phone,
  MapPin,
  X,
  FileDown,
  RefreshCw,
  CheckCircle,
  Eye,
} from 'lucide-react';

export default function PrintAdmissionForm({ schoolCode }) {
  const { classNames } = useAcademicClasses(schoolCode);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [search, setSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Selected student for printable preview modal
  const [printStudent, setPrintStudent] = useState(null);

  // Dynamic School Profile
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

  // Handle ESC key to close preview modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && printStudent) {
        setPrintStudent(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printStudent]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admissions/print-forms', {
        params: {
          schoolCode,
          className: selectedClass,
          section: selectedSection,
          search,
        },
      });
      if (res.data.success) {
        setStudents(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass !== 'ALL' || search.trim() !== '' || hasSearched) {
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [schoolCode, selectedClass, selectedSection, hasSearched]);

  const handleSearch = (e) => {
    e.preventDefault();
    setHasSearched(true);
    fetchStudents();
  };

  // Generate Official Crisp Vector A4 PDF for Admission Form
  const generateAdmissionPdf = (student) => {
    if (!student) return;
    setExportingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
      const margin = 12;
      const contentWidth = pageWidth - margin * 2; // 186mm

      const schoolName = (schoolProfile.schoolName || student?.schoolName || 'School Campus').toUpperCase();
      const address = (schoolProfile.address || '').toUpperCase();
      const affiliation = schoolProfile.affiliation ? schoolProfile.affiliation.toUpperCase() : '';
      const principalTitle = schoolProfile.principalTitle || 'Principal';

      // 1. Decorative Header Ribbon
      doc.setFillColor(4, 22, 51); // Navy #041633
      doc.rect(0, 0, pageWidth, 4, 'F');
      doc.setFillColor(255, 160, 0); // Gold #ffa000
      doc.rect(0, 4, pageWidth, 1.5, 'F');

      let currentY = 13;

      // 2. School Title & Letterhead
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(4, 22, 51);
      doc.text(schoolName, pageWidth / 2, currentY, { align: 'center' });

      if (address) {
        currentY += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(address, pageWidth / 2, currentY, { align: 'center' });
      }

      if (affiliation) {
        currentY += 3.8;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Affiliated with: ${affiliation}  •  School Code: ${student.schoolCode || schoolCode}`, pageWidth / 2, currentY, { align: 'center' });
      }

      // 3. Form Title Banner
      currentY += 5;
      doc.setDrawColor(4, 22, 51);
      doc.setLineWidth(0.4);
      doc.line(margin, currentY, pageWidth - margin, currentY);

      currentY += 4.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(4, 22, 51);
      doc.text('OFFICIAL STUDENT ADMISSION FORM & ENROLLMENT RECORD', pageWidth / 2, currentY, { align: 'center' });

      currentY += 2;
      doc.line(margin, currentY, pageWidth - margin, currentY);

      // Metadata Pill
      currentY += 4;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY - 3, contentWidth, 6, 1, 1, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      const admDateStr = student.admissionDate ? new Date(student.admissionDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
      const metaText = `Session: ${student.academicSession || '2025-2026'}    |    Admission Date: ${admDateStr}    |    Issued on: ${new Date().toLocaleDateString('en-GB')}`;
      doc.text(metaText, pageWidth / 2, currentY + 1, { align: 'center' });

      currentY += 7;

      // Section Helper
      const drawSectionHeader = (title, y) => {
        doc.setFillColor(4, 22, 51);
        doc.rect(margin, y, contentWidth, 5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), margin + 3, y + 3.6);
        return y + 6.5;
      };

      // 4. Section A: Academic Placement & Basic ID
      currentY = drawSectionHeader('1. Academic Placement & Identity', currentY);

      autoTable(doc, {
        startY: currentY,
        body: [
          [
            { content: 'Admission No:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.admissionNumber || '—',
            { content: 'Class & Section:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            `${student.className || '—'} (Sec: ${student.section || '—'})`,
          ],
          [
            { content: 'Roll Number:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.rollNumber || '—',
            { content: 'Enrollment Status:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.status || 'ACTIVE',
          ],
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 55, fontStyle: 'bold' },
          2: { cellWidth: 38 },
          3: { cellWidth: 55, fontStyle: 'bold' },
        },
        margin: { left: margin, right: margin },
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 5. Section B: Student Personal Information
      currentY = drawSectionHeader('2. Student Personal Particulars', currentY);

      const dobStr = student.dob ? new Date(student.dob).toLocaleDateString('en-GB') : '—';
      autoTable(doc, {
        startY: currentY,
        body: [
          [
            { content: 'Student Full Name:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.fullName || '—',
            { content: 'Gender:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.gender || '—',
          ],
          [
            { content: 'Date of Birth:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            dobStr,
            { content: 'B-Form / CNIC No:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.bFormOrCnic || '—',
          ],
          [
            { content: 'Blood Group:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.bloodGroup || '—',
            { content: 'Religion:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.religion || 'Islam',
          ],
          [
            { content: 'Residential Address:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            { content: `${student.address || '—'}${student.city ? `, ${student.city}` : ''}`, colSpan: 3 },
          ],
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 55 },
          2: { cellWidth: 38 },
          3: { cellWidth: 55 },
        },
        margin: { left: margin, right: margin },
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 6. Section C: Parent & Guardian Details
      currentY = drawSectionHeader('3. Parent & Guardian Particulars', currentY);

      autoTable(doc, {
        startY: currentY,
        body: [
          [
            { content: 'Father Name:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.fatherName || '—',
            { content: 'Father CNIC:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.fatherCnic || '—',
          ],
          [
            { content: 'Father Contact / Mobile:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.fatherPhone || '—',
            { content: 'Father Occupation:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.fatherOccupation || '—',
          ],
          [
            { content: 'Mother Name:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.motherName || '—',
            { content: 'Emergency Contact:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            student.emergencyContact || student.fatherPhone || '—',
          ],
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 55 },
          2: { cellWidth: 38 },
          3: { cellWidth: 55 },
        },
        margin: { left: margin, right: margin },
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 7. Section D: Financial Profile & Concessions
      currentY = drawSectionHeader('4. Fee Profile & Financial Details', currentY);

      autoTable(doc, {
        startY: currentY,
        body: [
          [
            { content: 'Standard Monthly Fee:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            `Rs. ${(student.monthlyFee ?? 0).toLocaleString()}`,
            { content: 'One-Time Admission Fee:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            `Rs. ${(student.admissionFee ?? 0).toLocaleString()}`,
          ],
          [
            { content: 'Monthly Concession / Discount:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            `Rs. ${(student.monthlyDiscount ?? 0).toLocaleString()} ${student.discountReason ? `(${student.discountReason})` : ''}`,
            { content: 'Net Monthly Payable Fee:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            `Rs. ${(student.netMonthlyFee ?? student.monthlyFee ?? 0).toLocaleString()}`,
          ],
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
        columnStyles: {
          0: { cellWidth: 42 },
          1: { cellWidth: 51, fontStyle: 'bold' },
          2: { cellWidth: 42 },
          3: { cellWidth: 51, fontStyle: 'bold', textColor: [21, 128, 61] },
        },
        margin: { left: margin, right: margin },
      });

      currentY = doc.lastAutoTable.finalY + 4;

      // 8. Section E: Declaration & Undertaking
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, currentY, contentWidth, 19, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(4, 22, 51);
      doc.text('DECLARATION & PARENTAL UNDERTAKING:', margin + 3, currentY + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      const declarationText =
        'I solemnly affirm that the particulars provided above are authentic and correct to the best of my knowledge and belief. I agree to abide by all the school regulations, codes of conduct, exam policies, and prescribed fee schedules of the institution. In case of any violation or default, the administration holds the right to take appropriate disciplinary action.';
      const splitText = doc.splitTextToSize(declarationText, contentWidth - 6);
      doc.text(splitText, margin + 3, currentY + 8);

      currentY += 24;

      // 9. Official Signatures Section
      const sigLineY = currentY + 12;
      doc.setDrawColor(4, 22, 51);
      doc.setLineWidth(0.3);

      const col1X = margin + 10;
      const col2X = pageWidth / 2;
      const col3X = pageWidth - margin - 38;

      doc.line(col1X - 5, sigLineY, col1X + 40, sigLineY);
      doc.line(col2X - 22, sigLineY, col2X + 22, sigLineY);
      doc.line(col3X - 5, sigLineY, col3X + 40, sigLineY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(4, 22, 51);

      doc.text('Father / Guardian Signature', col1X + 17.5, sigLineY + 3.5, { align: 'center' });
      doc.text('Admission Incharge / Registrar', col2X, sigLineY + 3.5, { align: 'center' });
      doc.text(principalTitle, col3X + 17.5, sigLineY + 3.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Date: ______________', col1X + 17.5, sigLineY + 7, { align: 'center' });
      doc.text('Verified & Entered', col2X, sigLineY + 7, { align: 'center' });
      doc.text('Official Seal & Stamp', col3X + 17.5, sigLineY + 7, { align: 'center' });

      // Footer
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Official Document — ${schoolName}  |  Generated by EduNexus™ SaaS`,
        margin,
        pageHeight - 5
      );
      doc.text(
        `Student Ref: ${student.admissionNumber} (${student.rollNumber})`,
        pageWidth - margin,
        pageHeight - 5,
        { align: 'right' }
      );

      const fileName = `Admission_Form_${student.admissionNumber || student.rollNumber}_${student.fullName.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Error generating admission PDF:', err);
      alert('Error generating PDF. Please check console.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-500" />
            <span>Print Admission Forms</span>
          </h2>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Filter by Class</label>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setSelectedSection('ALL');
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
          >
            <option value="ALL">All Classes</option>
            {classNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Filter by Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
          >
            <option value="ALL">All Sections</option>
            {['A', 'B', 'C', 'D'].map((sec) => (
              <option key={sec} value={sec}>Section {sec}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block font-semibold text-slate-700 mb-1">Search Student</label>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name, roll #, admission #, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
            />
            <button
              type="submit"
              className="bg-[#041633] text-[#ffa000] font-bold px-4 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </form>
        </div>
      </div>

      {/* Admitted Students Roster */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#041633] text-white uppercase text-[11px] font-bold">
              <tr>
                <th className="p-3 w-12">Photo</th>
                <th className="p-3">Roll No</th>
                <th className="p-3">Adm No</th>
                <th className="p-3">Student Name</th>
                <th className="p-3">Class-Sec</th>
                <th className="p-3">Father Name</th>
                <th className="p-3">Mobile Contact</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    {loading ? (
                      'Searching students...'
                    ) : selectedClass === 'ALL' && !search.trim() && !hasSearched ? (
                      <div className="py-6 flex flex-col items-center justify-center text-slate-500">
                        <Search className="w-8 h-8 text-slate-400 mb-2" />
                        <span className="font-bold text-slate-700">Admission Slips Search Ready</span>
                        <span className="text-xs text-slate-400 mt-1 mb-3">
                          Select a Class above or search by Name/Roll to print admission forms.
                        </span>
                        <button
                          type="button"
                          onClick={() => { setHasSearched(true); fetchStudents(); }}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-sm"
                        >
                          Load All Students
                        </button>
                      </div>
                    ) : (
                      'No admitted students found for this class/section.'
                    )}
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student._id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3">
                      {student.photo?.url ? (
                        <img
                          src={student.photo.url}
                          alt={student.fullName}
                          className="w-9 h-9 rounded-full object-cover border border-amber-400 shadow-sm"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                          {student.fullName.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">{student.rollNumber}</td>
                    <td className="p-3 font-mono text-slate-600">{student.admissionNumber}</td>
                    <td className="p-3 font-bold text-slate-900">{student.fullName}</td>
                    <td className="p-3 font-semibold text-slate-700">
                      {student.className} - {student.section}
                    </td>
                    <td className="p-3 text-slate-700">{student.fatherName}</td>
                    <td className="p-3 font-mono text-slate-800">{student.fatherPhone}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => generateAdmissionPdf(student)}
                          disabled={exportingPdf}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
                          title="Direct PDF Download"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>

                        <button
                          onClick={() => setPrintStudent(student)}
                          className="bg-slate-900 hover:bg-[#ffa000] hover:text-slate-950 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
                          title="Preview Form"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Preview / Print</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINTABLE ADMISSION FORM MODAL (Formatted for A4 Paper) */}
      {printStudent && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintStudent(null);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8 flex flex-col animate-in fade-in zoom-in-95 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Action Bar (Sticky top - Hidden when printed) */}
            <div className="sticky top-0 z-30 bg-[#041633] text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shadow-md print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-amber-500/20 text-[#ffa000] rounded-lg">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-sm block leading-tight">Official Admission Form Preview</span>
                  <span className="text-[11px] text-slate-300 font-medium">
                    {printStudent.studentName} ({printStudent.admissionNumber || printStudent.rollNumber || 'N/A'}) • {printStudent.className || printStudent.grade}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => generateAdmissionPdf(printStudent)}
                  disabled={exportingPdf}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
                  title="Download PDF"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="hidden sm:inline">Download PDF</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
                  title="Browser Print"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  onClick={() => setPrintStudent(null)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
                  title="Close Preview (Esc)"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* PRINTABLE A4 FORM CONTENT */}
            <div className="p-8 bg-white text-slate-900 space-y-5 print:p-0 print:m-0" id="printable-admission-form">
              {/* School Header */}
              <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                <div>
                  <div className="text-xl font-black tracking-wider uppercase text-slate-900">
                    {schoolProfile.schoolName}
                  </div>
                  <div className="text-xs text-slate-700 font-bold tracking-wide uppercase mt-0.5">
                    {schoolProfile.address}
                  </div>
                  {schoolProfile.affiliation && (
                    <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                      Affiliated with: {schoolProfile.affiliation} • Campus Code: {printStudent.schoolCode}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-xs font-black bg-slate-900 text-white px-3 py-1 rounded inline-block uppercase">
                    Admission Form
                  </div>
                  <div className="text-[11px] font-bold text-slate-700 mt-1">
                    Session: {printStudent.academicSession || '2025-2026'}
                  </div>
                </div>
              </div>

              {/* Student Details Grid + Photo */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 border border-slate-300 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2 font-bold bg-slate-50 text-slate-600 w-1/3">Admission No:</td>
                        <td className="p-2 font-mono font-bold text-slate-900">{printStudent.admissionNumber}</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold bg-slate-50 text-slate-600">Roll Number:</td>
                        <td className="p-2 font-mono font-bold text-slate-900">{printStudent.rollNumber}</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold bg-slate-50 text-slate-600">Student Full Name:</td>
                        <td className="p-2 font-bold text-slate-900">{printStudent.fullName}</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold bg-slate-50 text-slate-600">Class & Section:</td>
                        <td className="p-2 font-semibold text-slate-900">
                          {printStudent.className} ({printStudent.section})
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold bg-slate-50 text-slate-600">Date of Birth:</td>
                        <td className="p-2 text-slate-900">
                          {printStudent.dob ? new Date(printStudent.dob).toLocaleDateString('en-GB') : '—'} ({printStudent.gender})
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold bg-slate-50 text-slate-600">B-Form / CNIC:</td>
                        <td className="p-2 font-mono text-slate-900">{printStudent.bFormOrCnic || '—'}</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold bg-slate-50 text-slate-600">Blood Group / Religion:</td>
                        <td className="p-2 text-slate-900">
                          {printStudent.bloodGroup || '—'} • {printStudent.religion || 'Islam'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="col-span-1 flex flex-col items-center justify-start">
                  <div className="w-32 h-36 border-2 border-slate-800 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center shadow-inner">
                    {printStudent.photo?.url ? (
                      <img
                        src={printStudent.photo.url}
                        alt="Student"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-[10px] text-slate-400 font-bold text-center p-2">
                        Affix Student Photo Here
                      </div>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-500 font-semibold mt-1">Official Photograph</div>
                </div>
              </div>

              {/* Parent & Guardian Info Section */}
              <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
                <div className="bg-slate-100 p-2 font-bold text-slate-800 border-b border-slate-200 uppercase tracking-wide text-[10px]">
                  Parent & Guardian Particulars
                </div>
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2 font-bold bg-slate-50 text-slate-600 w-1/4">Father Name:</td>
                      <td className="p-2 font-bold text-slate-900 w-1/4">{printStudent.fatherName}</td>
                      <td className="p-2 font-bold bg-slate-50 text-slate-600 w-1/4">Father Mobile:</td>
                      <td className="p-2 font-mono font-bold text-slate-900 w-1/4">{printStudent.fatherPhone}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold bg-slate-50 text-slate-600">Father CNIC:</td>
                      <td className="p-2 font-mono text-slate-900">{printStudent.fatherCnic || '—'}</td>
                      <td className="p-2 font-bold bg-slate-50 text-slate-600">Occupation:</td>
                      <td className="p-2 text-slate-900">{printStudent.fatherOccupation || '—'}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold bg-slate-50 text-slate-600">Residential Address:</td>
                      <td colSpan={3} className="p-2 text-slate-900">
                        {printStudent.address || '—'}, {printStudent.city || ''}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Fee Profile */}
              <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
                <div className="bg-slate-100 p-2 font-bold text-slate-800 border-b border-slate-200 uppercase tracking-wide text-[10px]">
                  Fee Structure Details
                </div>
                <div className="p-2.5 grid grid-cols-4 gap-2 text-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Monthly Tuition Fee</span>
                    <span className="font-bold">Rs. {(printStudent.monthlyFee ?? 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Admission Fee</span>
                    <span className="font-bold">Rs. {(printStudent.admissionFee ?? 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Monthly Discount</span>
                    <span className="font-bold">Rs. {(printStudent.monthlyDiscount ?? 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Net Monthly Fee</span>
                    <span className="font-bold text-emerald-700">Rs. {(printStudent.netMonthlyFee ?? printStudent.monthlyFee ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Official Declaration / Undertaking */}
              <div className="border border-dashed border-slate-300 p-3 rounded-lg text-[10px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 uppercase">Declaration & Undertaking:</div>
                <p>
                  I solemnly declare that the particulars provided above are authentic and correct to the best of my knowledge. I promise that my child will abide by all discipline rules, fee schedules, and academic codes of the institution.
                </p>
              </div>

              {/* Signatures Row */}
              <div className="pt-6 grid grid-cols-3 gap-8 text-xs">
                <div className="border-t-2 border-slate-800 pt-2 text-center">
                  <div className="font-bold text-slate-900">Parent / Guardian</div>
                  <div className="text-[10px] text-slate-500">Signature</div>
                </div>

                <div className="border-t-2 border-slate-800 pt-2 text-center">
                  <div className="font-bold text-slate-900">Admission Incharge</div>
                  <div className="text-[10px] text-slate-500">Verified & Recorded</div>
                </div>

                <div className="border-t-2 border-slate-800 pt-2 text-center">
                  <div className="font-bold text-slate-900">{schoolProfile.principalTitle || 'Principal'}</div>
                  <div className="text-[10px] text-slate-500">Official Seal & Stamp</div>
                </div>
              </div>
            </div>

            {/* Bottom Sticky/Fixed Footer Bar (Hidden when printed) */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="text-xs text-slate-500 font-medium">
                Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 font-semibold text-[11px] shadow-xs">Esc</kbd> or click outside to close preview
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintStudent(null)}
                  className="bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Close Preview</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="bg-[#041633] hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#ffa000]" />
                  <span>Print Form</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
