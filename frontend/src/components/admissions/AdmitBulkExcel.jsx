import React, { useState } from 'react';
import api from '../../api/axios';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import {
  Upload, FileSpreadsheet, Download, CheckCircle,
  AlertCircle, RefreshCw, AlertTriangle, Users
} from 'lucide-react';

export default function AdmitBulkExcel({ schoolCode: propSchoolCode }) {
  const { schoolCode: authSchoolCode } = useAuth();
  const schoolCode = propSchoolCode || authSchoolCode || 'DEFAULT';
  const { currentSession } = useAcademicSession();
  const { classNames, getSectionsForClass } = useAcademicClasses(schoolCode);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setError(null);
      setResult(null);
    }
  };

  // Download Sample Excel Template
  const handleDownloadSample = () => {
    const headers = [
      'Admission No (Optional)',
      'Full Name',
      'Class',
      'Section',
      'Roll No',
      'Gender',
      'DOB (YYYY-MM-DD)',
      'Father Name',
      'Father Phone',
      'Father CNIC',
      'B-Form / CNIC',
      'Monthly Fee',
      'Discount',
      'Discount Reason',
      'Admission Date (YYYY-MM-DD)',
      'Blood Group',
      'Emergency Contact',
      'Address',
    ];

    const sampleClass = classNames[0] || 'Class 1';
    const sampleSec = (getSectionsForClass(sampleClass) || ['A'])[0] || 'A';

    const sampleRows = [
      ['', 'Ali Hassan', sampleClass, sampleSec, '1', 'MALE', '2016-04-12', 'Hassan Raza', '03001234567', '35201-1234567-1', '35201-9876543-1', '3000', '0', '', '2025-04-01', 'B+', '03001234567', 'Gulberg III, Lahore'],
      ['GR-1042', 'Fatima Zahra', sampleClass, sampleSec, '2', 'FEMALE', '2016-08-20', 'Zahid Hussain', '03217654321', '35202-7654321-2', '35202-1234567-2', '3500', '500', 'Teacher Child Concession', '2024-03-15', 'O+', '03217654321', 'Model Town, Lahore'],
      ['', 'Bilal Ahmed', sampleClass, sampleSec, '3', 'MALE', '2017-02-15', 'Ahmed Nadeem', '03339876543', '35201-5555555-3', '', '2500', '0', '', '2025-04-01', 'A+', '03339876543', 'Johar Town, Lahore'],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...sampleRows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sample_Student_Bulk_Upload_${schoolCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload Excel via Axios
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose an Excel or CSV file first.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('schoolCode', schoolCode);
      formData.append('academicSession', currentSession || '2025-2026');
      formData.append('file', file);

      const res = await api.post('/admissions/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setResult(res.data);
        if (res.data.stats?.admittedCount > 0) {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Bulk import failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-500" />
            <span>Bulk Student Admission (Excel Import)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Admit an entire class or session in seconds by uploading a pre-filled Excel or CSV spreadsheet for <span className="font-bold text-slate-800">{schoolCode}</span>.
          </p>
        </div>

        {/* Download Sample Button */}
        <button
          type="button"
          onClick={handleDownloadSample}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Sample CSV Template</span>
        </button>
      </div>

      {/* Main Upload Box */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
        <form onSubmit={handleUpload} className="space-y-6">
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100/60 transition relative">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-3">
                <Upload className="w-7 h-7" />
              </div>
              <div className="text-sm font-bold text-slate-800">
                {file ? file.name : 'Click to Browse or Drag & Drop Excel File'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) files up to 5MB
              </div>
              {file && (
                <div className="mt-3 text-xs bg-amber-100 text-amber-900 font-semibold px-3 py-1 rounded-full">
                  Selected File: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              ⚡ Excel rows are verified in memory to prevent duplicate admission and roll numbers.
            </div>
            <button
              type="submit"
              disabled={loading || !file}
              className="bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black text-sm px-6 py-2.5 rounded-lg shadow-md flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Excel...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload & Admit Students</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick Instructions & Best Practices */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2 text-slate-600">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-600" />
            <span>Important Guidelines for Bulk Excel Upload:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 text-[11px] leading-relaxed">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <strong className="text-slate-800">1. Auto Admission No:</strong> Agar purana General Register No nahi hai, to <em>Admission No</em> column khali chor dein — system khud auto-generate kar dega.
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <strong className="text-slate-800">2. Father CNIC (Family Vouchers):</strong> Behan-bhaiyon ka aik ikatha Family Fee Voucher banane ke liye <em>Father CNIC</em> zaroor darj karein.
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <strong className="text-slate-800">3. Student Photographs:</strong> Excel import ke baad <em>Manage Admissions</em> mein ja kar har bache ki photo Edit modal se upload ki ja sakti hai.
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <strong className="text-slate-800">4. 100% Duplicate Safe:</strong> Agar kisi row par error aaye aur sheet dobara upload ki jaye, to pehle se mojood bache skip ho jayein ge (Duplicate nahi banenge).
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Import Results Summary Card */}
      {result && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Import Execution Results</span>
            </h3>
            <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-bold">
              School: {schoolCode}
            </span>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-2xl font-black text-slate-800">{result.stats?.totalRows || 0}</div>
              <div className="text-[11px] font-semibold text-slate-500">Total Rows in Sheet</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-2xl font-black text-emerald-600">{result.stats?.admittedCount || 0}</div>
              <div className="text-[11px] font-semibold text-emerald-700">Admitted Successfully</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-2xl font-black text-amber-600">{result.stats?.skippedCount || 0}</div>
              <div className="text-[11px] font-semibold text-amber-700">Skipped (Duplicates/Errors)</div>
            </div>
          </div>

          {/* Skipped Rows Table (if any) */}
          {result.skippedRows && result.skippedRows.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Skipped / Rejected Rows Breakdown ({result.skippedRows.length}):</span>
                </div>
                <span className="text-[11px] text-slate-500 italic">
                  Tip: Fix these rows in your Excel file and upload again (already admitted students won't duplicate).
                </span>
              </div>
              <div className="border border-amber-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-50/80 text-amber-900 font-bold border-b border-amber-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-2.5 text-center w-16">Row #</th>
                      <th className="p-2.5">Student Name</th>
                      <th className="p-2.5">Class & Section</th>
                      <th className="p-2.5 text-center">Roll No</th>
                      <th className="p-2.5">Reason for Skipping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {result.skippedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/30 transition">
                        <td className="p-2.5 font-mono font-bold text-center text-slate-800 bg-slate-50/60">
                          {row.row}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{row.name}</td>
                        <td className="p-2.5 text-slate-700">
                          {row.className !== '—' ? (
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800 border border-slate-200">
                              {row.className} ({row.section})
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-center font-bold text-slate-800">
                          {row.roll || '—'}
                        </td>
                        <td className="p-2.5 text-rose-700 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          <span>{row.reason}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
