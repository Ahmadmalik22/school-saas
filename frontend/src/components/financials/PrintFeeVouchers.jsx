import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import {
  Printer, Search, RefreshCw, AlertCircle, CheckCircle2,
  GraduationCap, Scissors, ArrowRight, ShieldCheck, DollarSign,
  Filter, CheckSquare, Square, Building2, Landmark
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SchoolLogo from '../common/SchoolLogo';

export default function PrintFeeVouchers({ schoolCode, setActiveSubModule }) {
  const { schoolName, schoolProfile, schoolLogo } = useAuth();
  const { classNames, getSectionsForClass } = useAcademicClasses(schoolCode);

  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [searchQuery, setSearchQuery] = useState('');

  const [vouchers, setVouchers] = useState([]);
  const [selectedVoucherIds, setSelectedVoucherIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Initial Class sync
  useEffect(() => {
    if (classNames && classNames.length > 0 && !selectedClass) {
      const first = classNames[0];
      setSelectedClass(first);
      const secs = getSectionsForClass(first);
      setSelectedSection(secs[0] || 'A');
    }
  }, [classNames, selectedClass, getSectionsForClass]);

  // Fetch Vouchers for Printing
  const fetchPrintVouchers = async () => {
    if (!selectedClass || !selectedMonth) return;
    setLoading(true);
    try {
      const res = await api.get('/fees/sheet', {
        params: {
          schoolCode,
          className: selectedClass,
          section: selectedSection,
          monthYear: selectedMonth,
        },
      });

      if (res.data.success) {
        const fetched = res.data.data || [];
        setVouchers(fetched);
        // By default select all for printing
        setSelectedVoucherIds(new Set(fetched.map((v) => v._id)));
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to fetch vouchers for print.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass && selectedMonth) {
      fetchPrintVouchers();
    }
  }, [schoolCode, selectedClass, selectedSection, selectedMonth]);

  // Filter vouchers by search query
  const filteredVouchers = vouchers.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (v.studentName && v.studentName.toLowerCase().includes(q)) ||
      (v.rollNumber && v.rollNumber.toLowerCase().includes(q)) ||
      (v.fatherName && v.fatherName.toLowerCase().includes(q)) ||
      (v.voucherNo && v.voucherNo.toLowerCase().includes(q))
    );
  });

  // Vouchers that are currently chosen for printing
  const printableVouchers = filteredVouchers.filter((v) => selectedVoucherIds.has(v._id));

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedVoucherIds.size === filteredVouchers.length) {
      setSelectedVoucherIds(new Set());
    } else {
      setSelectedVoucherIds(new Set(filteredVouchers.map((v) => v._id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedVoucherIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Helper to chunk vouchers into groups of 4 for A4 pages
  const chunkIntoFours = (arr) => {
    const pages = [];
    for (let i = 0; i < arr.length; i += 4) {
      pages.push(arr.slice(i, i + 4));
    }
    return pages;
  };

  const a4Pages = chunkIntoFours(printableVouchers);

  const handlePrint = () => {
    window.print();
  };

  // Print single student voucher
  const handlePrintSingle = (vId) => {
    setSelectedVoucherIds(new Set([vId]));
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Barcode generator (Pure SVG Code 128 replica)
  const renderBarcodeSvg = (code) => (
    <div className="flex flex-col items-center">
      <svg className="w-24 h-4" viewBox="0 0 140 20" fill="currentColor">
        <rect x="0" y="0" width="2" height="20" />
        <rect x="4" y="0" width="1" height="20" />
        <rect x="7" y="0" width="3" height="20" />
        <rect x="12" y="0" width="1" height="20" />
        <rect x="15" y="0" width="2" height="20" />
        <rect x="19" y="0" width="4" height="20" />
        <rect x="25" y="0" width="1" height="20" />
        <rect x="28" y="0" width="2" height="20" />
        <rect x="32" y="0" width="3" height="20" />
        <rect x="37" y="0" width="1" height="20" />
        <rect x="40" y="0" width="4" height="20" />
        <rect x="46" y="0" width="2" height="20" />
        <rect x="50" y="0" width="1" height="20" />
        <rect x="53" y="0" width="3" height="20" />
        <rect x="58" y="0" width="2" height="20" />
        <rect x="62" y="0" width="4" height="20" />
        <rect x="68" y="0" width="1" height="20" />
        <rect x="71" y="0" width="2" height="20" />
        <rect x="75" y="0" width="3" height="20" />
        <rect x="80" y="0" width="1" height="20" />
        <rect x="83" y="0" width="4" height="20" />
        <rect x="89" y="0" width="2" height="20" />
        <rect x="93" y="0" width="1" height="20" />
        <rect x="96" y="0" width="3" height="20" />
        <rect x="101" y="0" width="2" height="20" />
        <rect x="105" y="0" width="4" height="20" />
        <rect x="111" y="0" width="1" height="20" />
        <rect x="114" y="0" width="2" height="20" />
        <rect x="118" y="0" width="3" height="20" />
        <rect x="123" y="0" width="1" height="20" />
        <rect x="126" y="0" width="4" height="20" />
        <rect x="132" y="0" width="2" height="20" />
        <rect x="136" y="0" width="4" height="20" />
      </svg>
      <span className="font-mono text-[6.5px] text-slate-800 font-bold tracking-widest">{code}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-semibold transition-all duration-300 animate-slide-in ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 border-emerald-500 text-white'
              : 'bg-rose-900/90 border-rose-500 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Screen Controls & Header (Hidden when printing) */}
      <div className="print:hidden space-y-5">
        <div className="bg-gradient-to-r from-[#041633] via-[#09234e] to-[#041633] rounded-2xl p-6 border border-slate-700 shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#ffa000] uppercase tracking-wider mb-1">
              <Printer className="w-4 h-4" />
              <span>Official Print Engine • Dual Challan Slip System</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Print Fee Vouchers (Executive 4-in-1 A4 Sheet)
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Authentic bank challan typography with crest emblem, barcode, bank deposit info, dual copies
              (Bank/School Copy & Student/Parent Copy), and perforated cut guides.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              disabled={printableVouchers.length === 0}
              className="px-6 py-3 bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF ({printableVouchers.length} Vouchers)</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                const secs = getSectionsForClass(e.target.value);
                setSelectedSection(secs[0] || 'A');
              }}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
            >
              {classNames.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
            >
              {getSectionsForClass(selectedClass).map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Search Student / Roll</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Name, Roll, Challan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium placeholder-slate-400 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <button
              onClick={fetchPrintVouchers}
              disabled={loading}
              className="w-full bg-[#041633] hover:bg-slate-800 text-white font-bold p-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Search className="w-4 h-4 text-amber-400" />
              )}
              <span>Load Vouchers</span>
            </button>
          </div>
        </div>

        {/* Paper Layout & Bulk Selector Indicator */}
        {filteredVouchers.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-amber-300 px-3 py-1.5 rounded-lg shadow-xs hover:bg-amber-100/50 transition cursor-pointer"
              >
                {selectedVoucherIds.size === filteredVouchers.length ? (
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {selectedVoucherIds.size === filteredVouchers.length ? 'Deselect All' : 'Select All'} ({filteredVouchers.length})
                </span>
              </button>

              <span>
                Selected: <strong>{printableVouchers.length} students</strong> = <strong>{a4Pages.length} A4 Pages</strong> (exact 4 vouchers per page).
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-amber-800 font-semibold">
              <Landmark className="w-3.5 h-3.5 text-amber-600" />
              <span>In print preview: Select <strong>"Save as PDF"</strong>, Paper size <strong>A4</strong>, Layout <strong>Portrait</strong>.</span>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredVouchers.length === 0 && !loading && (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 text-slate-400 flex flex-col items-center gap-2 print:hidden">
          <AlertCircle className="w-8 h-8 text-slate-300" />
          <span className="text-sm font-bold text-slate-600">No vouchers found matching criteria</span>
          <p className="text-xs text-slate-400">
            Please make sure vouchers are generated under the <strong>Student Fee Generation</strong> tab.
          </p>
        </div>
      )}

      {/* PRINT ENGINE CONTAINER (Formatted strictly for A4 Portrait, 4 Vouchers Per Page) */}
      <div className="overflow-x-auto py-2">
        <div className="voucher-print-container min-w-[210mm]">
        {a4Pages.map((pageVouchers, pageIdx) => (
          <div
            key={pageIdx}
            className="a4-page bg-white text-slate-900 mx-auto shadow-2xl print:shadow-none mb-8 print:mb-0 border border-slate-300 print:border-none"
            style={{
              width: '210mm',
              minHeight: '295mm',
              maxHeight: '297mm',
              pageBreakAfter: 'always',
              breakAfter: 'page',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '2.5mm 3.5mm',
            }}
          >
            {pageVouchers.map((v, vIdx) => {
              const formattedDueDate = v.dueDate
                ? new Date(v.dueDate).toLocaleDateString('en-GB')
                : '10-10-2026';
              const formattedIssueDate = v.issueDate
                ? new Date(v.issueDate).toLocaleDateString('en-GB')
                : '01-10-2026';

              return (
                <div
                  key={v._id}
                  className="voucher-row relative bg-white border border-slate-800 rounded-[2px]"
                  style={{
                    height: '68mm',
                    maxHeight: '68mm',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    padding: '1.8mm 2mm',
                    marginBottom: vIdx === pageVouchers.length - 1 ? '0' : '1.5mm',
                  }}
                >
                  {/* Quick Select & Print Single Controls on hover (Screen only) */}
                  <div className="absolute top-1 right-2 z-20 flex items-center gap-1.5 print:hidden opacity-0 hover:opacity-100 transition">
                    <button
                      onClick={() => handlePrintSingle(v._id)}
                      className="px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] font-bold shadow hover:bg-slate-800 cursor-pointer"
                      title="Print only this student's voucher"
                    >
                      Print This Single
                    </button>
                    <button
                      onClick={() => toggleSelectOne(v._id)}
                      className="p-0.5 bg-white border border-slate-300 rounded shadow cursor-pointer text-slate-700"
                    >
                      {selectedVoucherIds.has(v._id) ? (
                        <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>

                  {/* DUAL SLIP CONTAINER (Bank/School Copy on Left, Parent Copy on Right) */}
                  <div className="grid grid-cols-2 gap-2 h-full relative">
                    {/* Perforation Divider Line */}
                    <div
                      className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-r border-dashed border-slate-400 flex flex-col items-center justify-between text-[6.5px] text-slate-400 pointer-events-none z-10"
                      style={{ padding: '2px 0' }}
                    >
                      <Scissors className="w-2.5 h-2.5 -rotate-90 text-slate-600" />
                      <span className="rotate-90 tracking-widest uppercase font-mono font-bold text-slate-500">TEAR HERE</span>
                      <Scissors className="w-2.5 h-2.5 -rotate-90 text-slate-600" />
                    </div>

                    {/* ======================= LEFT: SCHOOL / BANK COPY ======================= */}
                    <div className="pr-2 flex flex-col justify-between text-[8.5px] leading-tight">
                      {/* 1. Header Banner */}
                      <div className="border-b border-slate-800 pb-0.5">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Official School Crest / Logo */}
                            <SchoolLogo
                              logoUrl={schoolProfile?.logoUrl || schoolLogo}
                              schoolName={schoolProfile?.schoolName || schoolName}
                              schoolCode={schoolCode}
                              size="xs"
                              ring={false}
                              className="w-5 h-5 rounded shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-black text-[10px] uppercase tracking-tight text-slate-950 font-serif leading-none truncate max-w-[210px]">
                                {schoolProfile?.schoolName || schoolName || 'School System'}
                              </div>
                              <div className="text-[6.5px] font-semibold text-slate-600 tracking-wider uppercase mt-0.5 truncate max-w-[210px]">
                                {schoolProfile?.address || `Campus: ${schoolCode}`} {schoolProfile?.affiliation ? `• ${schoolProfile.affiliation}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="bg-[#041633] text-[#ffa000] border border-amber-400/50 font-black text-[7px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                              🏦 School / Bank Copy
                            </span>
                          </div>
                        </div>

                        {/* Bank Deposit Instruction Banner */}
                        <div className="mt-0.5 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded text-[6.5px] text-slate-700 flex justify-between font-medium">
                          <span>Payable at: <strong>Allied Bank / MCB / HBL (A/C: 0142-0091823-01)</strong> or School Cash Counter</span>
                          <span className="font-bold text-slate-900">{v.monthYear}</span>
                        </div>
                      </div>

                      {/* 2. Metadata Bar & Challan Particulars */}
                      <div className="grid grid-cols-4 gap-0.5 bg-slate-50 border border-slate-300 px-1 py-0.5 rounded-[2px] text-[7.5px] text-center">
                        <div className="border-r border-slate-200 pr-0.5">
                          <span className="text-slate-500 block text-[6.5px]">Challan #</span>
                          <strong className="font-mono text-slate-950 text-[8px]">{v.voucherNo}</strong>
                        </div>
                        <div className="border-r border-slate-200 pr-0.5">
                          <span className="text-slate-500 block text-[6.5px]">Month</span>
                          <strong className="text-slate-900">{v.monthYear}</strong>
                        </div>
                        <div className="border-r border-slate-200 pr-0.5">
                          <span className="text-slate-500 block text-[6.5px]">Issue Date</span>
                          <strong className="text-slate-900">{formattedIssueDate}</strong>
                        </div>
                        <div>
                          <span className="text-rose-600 block text-[6.5px] font-bold">Due Date</span>
                          <strong className="text-rose-700 font-black">{formattedDueDate}</strong>
                        </div>
                      </div>

                      {/* 3. Student Particulars Card */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.2 border border-slate-300 px-1.5 py-0.5 rounded-[2px] bg-white text-[8px]">
                        <div className="truncate">
                          <span className="text-slate-500">Student: </span>
                          <strong className="text-slate-950 uppercase">{v.studentName}</strong>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-500">Roll No: </span>
                          <strong className="text-slate-900 font-mono font-bold">{v.rollNumber}</strong>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-500">Father: </span>
                          <strong className="text-slate-800 uppercase">{v.fatherName}</strong>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-500">Class: </span>
                          <strong className="text-slate-900 font-bold">Class {v.className}-{v.section}</strong>
                        </div>
                      </div>

                      {/* 4. Itemized Fee Ledger Table */}
                      <table className="w-full text-left text-[7.5px] border-collapse border border-slate-300">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold text-[7px]">
                            <th className="py-0.5 px-1">Particulars</th>
                            <th className="py-0.5 px-1 text-right">Amount (PKR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <td className="py-0.5 px-1">1. Monthly Tuition Fee</td>
                            <td className="text-right py-0.5 px-1 font-semibold">{v.baseMonthlyFee}</td>
                          </tr>
                          {v.discount > 0 && (
                            <tr className="border-b border-slate-200 text-emerald-800 font-bold bg-emerald-50/50">
                              <td className="py-0.5 px-1">2. Sibling / Concession Discount</td>
                              <td className="text-right py-0.5 px-1">- {v.discount}</td>
                            </tr>
                          )}
                          <tr className={`border-b border-slate-200 ${v.previousArrears > 0 ? 'bg-rose-50 text-rose-800 font-bold' : ''}`}>
                            <td className="py-0.5 px-1">3. Previous Dues / Arrears</td>
                            <td className="text-right py-0.5 px-1 font-bold">{v.previousArrears || 0}</td>
                          </tr>
                          <tr className="border-t border-slate-900 bg-slate-900 text-white font-black text-[8px]">
                            <td className="py-0.5 px-1">Payable Within Due Date</td>
                            <td className="text-right py-0.5 px-1 text-amber-300">PKR {v.totalPayableWithinDueDate}</td>
                          </tr>
                          <tr className="text-[7px] text-slate-700 bg-slate-50 border-t border-slate-200">
                            <td className="py-0.5 px-1">Payable After Due Date (+PKR {v.lateFine || 200})</td>
                            <td className="text-right py-0.5 px-1 font-black text-rose-700">PKR {v.totalPayableAfterDueDate}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 5. Footer with Barcode & Signatures */}
                      <div className="flex justify-between items-end border-t border-slate-300 pt-0.5 text-[6.5px] text-slate-500">
                        {renderBarcodeSvg(v.voucherNo)}
                        <div className="text-center">
                          <div className="w-16 border-b border-slate-400 mb-0.5"></div>
                          <span>Accountant Sign</span>
                        </div>
                        <div className="border border-slate-300 rounded px-1 py-0.5 text-center text-[6px] text-slate-400 font-bold w-14">
                          Bank / Stamp
                        </div>
                      </div>
                    </div>

                    {/* ======================= RIGHT: PARENT / STUDENT COPY ======================= */}
                    <div className="pl-2 flex flex-col justify-between text-[8.5px] leading-tight">
                      {/* 1. Header Banner */}
                      <div className="border-b border-slate-800 pb-0.5">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Official School Crest / Logo */}
                            <SchoolLogo
                              logoUrl={schoolProfile?.logoUrl || schoolLogo}
                              schoolName={schoolProfile?.schoolName || schoolName}
                              schoolCode={schoolCode}
                              size="xs"
                              ring={false}
                              className="w-5 h-5 rounded shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-black text-[10px] uppercase tracking-tight text-slate-950 font-serif leading-none truncate max-w-[210px]">
                                {schoolProfile?.schoolName || schoolName || 'School System'}
                              </div>
                              <div className="text-[6.5px] font-semibold text-slate-600 tracking-wider uppercase mt-0.5 truncate max-w-[210px]">
                                {schoolProfile?.address || `Campus: ${schoolCode}`} {schoolProfile?.affiliation ? `• ${schoolProfile.affiliation}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="bg-emerald-900 text-emerald-100 border border-emerald-500/50 font-black text-[7px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                              👨‍👩‍👧 Parent / Student Copy
                            </span>
                          </div>
                        </div>

                        {/* Bank Deposit Instruction Banner */}
                        <div className="mt-0.5 bg-emerald-50/60 border border-emerald-200 px-1 py-0.2 rounded text-[6.5px] text-emerald-900 flex justify-between font-medium">
                          <span>Payable at: <strong>Allied Bank / MCB / HBL (A/C: 0142-0091823-01)</strong> or School Cash Counter</span>
                          <span className="font-bold text-emerald-950">{v.monthYear}</span>
                        </div>
                      </div>

                      {/* 2. Metadata Bar & Challan Particulars */}
                      <div className="grid grid-cols-4 gap-0.5 bg-slate-50 border border-slate-300 px-1 py-0.5 rounded-[2px] text-[7.5px] text-center">
                        <div className="border-r border-slate-200 pr-0.5">
                          <span className="text-slate-500 block text-[6.5px]">Challan #</span>
                          <strong className="font-mono text-slate-950 text-[8px]">{v.voucherNo}</strong>
                        </div>
                        <div className="border-r border-slate-200 pr-0.5">
                          <span className="text-slate-500 block text-[6.5px]">Month</span>
                          <strong className="text-slate-900">{v.monthYear}</strong>
                        </div>
                        <div className="border-r border-slate-200 pr-0.5">
                          <span className="text-slate-500 block text-[6.5px]">Issue Date</span>
                          <strong className="text-slate-900">{formattedIssueDate}</strong>
                        </div>
                        <div>
                          <span className="text-rose-600 block text-[6.5px] font-bold">Due Date</span>
                          <strong className="text-rose-700 font-black">{formattedDueDate}</strong>
                        </div>
                      </div>

                      {/* 3. Student Particulars Card */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.2 border border-slate-300 px-1.5 py-0.5 rounded-[2px] bg-white text-[8px]">
                        <div className="truncate">
                          <span className="text-slate-500">Student: </span>
                          <strong className="text-slate-950 uppercase">{v.studentName}</strong>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-500">Roll No: </span>
                          <strong className="text-slate-900 font-mono font-bold">{v.rollNumber}</strong>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-500">Father: </span>
                          <strong className="text-slate-800 uppercase">{v.fatherName}</strong>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-500">Class: </span>
                          <strong className="text-slate-900 font-bold">Class {v.className}-{v.section}</strong>
                        </div>
                      </div>

                      {/* 4. Itemized Fee Ledger Table */}
                      <table className="w-full text-left text-[7.5px] border-collapse border border-slate-300">
                        <thead>
                          <tr className="bg-emerald-50 text-emerald-950 border-b border-emerald-300 font-bold text-[7px]">
                            <th className="py-0.5 px-1">Particulars</th>
                            <th className="py-0.5 px-1 text-right">Amount (PKR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <td className="py-0.5 px-1">1. Monthly Tuition Fee</td>
                            <td className="text-right py-0.5 px-1 font-semibold">{v.baseMonthlyFee}</td>
                          </tr>
                          {v.discount > 0 && (
                            <tr className="border-b border-slate-200 text-emerald-800 font-bold bg-emerald-50/50">
                              <td className="py-0.5 px-1">2. Sibling / Concession Discount</td>
                              <td className="text-right py-0.5 px-1">- {v.discount}</td>
                            </tr>
                          )}
                          <tr className={`border-b border-slate-200 ${v.previousArrears > 0 ? 'bg-rose-50 text-rose-800 font-bold' : ''}`}>
                            <td className="py-0.5 px-1">3. Previous Dues / Arrears</td>
                            <td className="text-right py-0.5 px-1 font-bold">{v.previousArrears || 0}</td>
                          </tr>
                          <tr className="border-t border-slate-900 bg-emerald-900 text-white font-black text-[8px]">
                            <td className="py-0.5 px-1">Payable Within Due Date</td>
                            <td className="text-right py-0.5 px-1 text-emerald-200">PKR {v.totalPayableWithinDueDate}</td>
                          </tr>
                          <tr className="text-[7px] text-slate-700 bg-slate-50 border-t border-slate-200">
                            <td className="py-0.5 px-1">Payable After Due Date (+PKR {v.lateFine || 200})</td>
                            <td className="text-right py-0.5 px-1 font-black text-rose-700">PKR {v.totalPayableAfterDueDate}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 5. Footer with Payment Notice & Cashier Stamp */}
                      <div className="flex justify-between items-end border-t border-slate-300 pt-0.5 text-[6.5px] text-slate-500">
                        <div>
                          <div className="font-bold text-slate-700">Valid: Across all bank branches / School Counter</div>
                          <div className="text-[6px] text-slate-400 italic">Fee once deposited is non-refundable.</div>
                        </div>
                        <div className="text-center">
                          <div className="w-16 border-b border-slate-400 mb-0.5"></div>
                          <span>Receiving Cashier</span>
                        </div>
                        <div className="border border-emerald-300 rounded px-1 py-0.5 text-center text-[6px] text-emerald-800 font-bold w-14">
                          [ Valid Student Copy ]
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        </div>
      </div>

      {/* Strict A4 Print CSS Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 3.5mm 4mm;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background: white !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }
          nav, aside, header, .print\\:hidden {
            display: none !important;
          }
          .a4-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 1.5mm !important;
            width: 100% !important;
            min-height: 288mm !important;
            max-height: 295mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
          }
          .voucher-row {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
