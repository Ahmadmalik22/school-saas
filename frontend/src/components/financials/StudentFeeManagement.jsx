import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import confetti from 'canvas-confetti';
import {
  CreditCard, Search, CheckCircle2, AlertCircle, RefreshCw,
  TrendingUp, TrendingDown, DollarSign, Receipt, Clock,
  ArrowRight, X, ShieldCheck, Printer, Users, FileSpreadsheet
} from 'lucide-react';
import { exportFeeSheetToExcel } from '../../utils/excelExporter';

export default function StudentFeeManagement({ schoolCode, setActiveSubModule }) {
  const { classNames, getSectionsForClass } = useAcademicClasses(schoolCode);

  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  // Navigation Sub-Tabs
  const [activeTab, setActiveTab] = useState('counter'); // 'counter' | 'revision'

  // Counter Filters
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [search, setSearch] = useState('');

  // Vouchers Data
  const [vouchers, setVouchers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Cash Collection Modal State
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [cashReceived, setCashReceived] = useState('');
  const [receivedBy, setReceivedBy] = useState('School Accountant');
  const [savingPayment, setSavingPayment] = useState(false);

  // Bulk Revision Form State
  const [revScope, setRevScope] = useState('CLASS'); // 'CLASS' | 'ALL'
  const [revClass, setRevClass] = useState('');
  const [revAction, setRevAction] = useState('INCREMENT'); // 'INCREMENT' | 'DECREMENT'
  const [revType, setRevType] = useState('PERCENTAGE'); // 'PERCENTAGE' | 'FIXED'
  const [revValue, setRevValue] = useState(10);
  const [applyingRevision, setApplyingRevision] = useState(false);

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
      setRevClass(first);
      const secs = getSectionsForClass(first);
      setSelectedSection(secs[0] || 'A');
    }
  }, [classNames, selectedClass, getSectionsForClass]);

  // Fetch Fee Sheet for Counter
  const fetchVouchers = async () => {
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
        setVouchers(res.data.data || []);
        setStats(res.data.stats || null);
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to fetch vouchers for fee counter.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass && selectedMonth) {
      fetchVouchers();
    }
  }, [schoolCode, selectedClass, selectedSection, selectedMonth]);

  // Open Cash Collection Modal
  const openCollectionModal = (voucher) => {
    setSelectedVoucher(voucher);
    if (voucher.status === 'PAID') {
      setCashReceived(String(voucher.paidAmount || voucher.totalPayableWithinDueDate));
    } else if (voucher.status === 'PARTIALLY_PAID') {
      const remainingDues = Number(voucher.balance !== undefined ? voucher.balance : Math.max(0, voucher.totalPayableWithinDueDate - (voucher.paidAmount || 0)));
      setCashReceived(String(remainingDues));
    } else {
      setCashReceived(String(voucher.balance || voucher.totalPayableWithinDueDate));
    }
  };

  // Submit Cash Collection
  const handleCollectCash = async () => {
    if (!selectedVoucher) return;
    setSavingPayment(true);
    try {
      const res = await api.post(`/fees/voucher/${selectedVoucher._id}/collect-cash`, {
        cashReceived: Number(cashReceived) || 0,
        receivedBy,
      });

      if (res.data.success) {
        const status = res.data.data.status;
        setToast({
          type: 'success',
          message: `Payment saved successfully. Voucher marked as ${status}.`,
        });
        if (status === 'PAID') {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        }
        setSelectedVoucher(null);
        fetchVouchers();
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Error collecting cash payment.',
      });
    } finally {
      setSavingPayment(false);
    }
  };

  // Apply Bulk Revision
  const handleApplyRevision = async () => {
    if (!revValue || Number(revValue) <= 0) {
      setToast({ type: 'error', message: 'Please enter a valid revision value greater than 0.' });
      return;
    }

    setApplyingRevision(true);
    try {
      const res = await api.post('/fees/bulk-revision', {
        schoolCode,
        scope: revScope,
        className: revClass,
        action: revAction,
        type: revType,
        value: Number(revValue),
      });

      if (res.data.success) {
        setToast({
          type: 'success',
          message: res.data.message || 'Bulk fee revision applied successfully!',
        });
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
        fetchVouchers();
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Error applying bulk revision.',
      });
    } finally {
      setApplyingRevision(false);
    }
  };

  // Filter vouchers
  const filteredVouchers = vouchers.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.studentName?.toLowerCase().includes(q) ||
      v.fatherName?.toLowerCase().includes(q) ||
      v.rollNumber?.toLowerCase().includes(q) ||
      v.voucherNo?.toLowerCase().includes(q)
    );
  });

  // Real-time calculation inside collection modal with robust partial dues tracking
  const modalTotal = selectedVoucher ? Number(selectedVoucher.totalPayableWithinDueDate || 0) : 0;
  const modalAlreadyPaid = selectedVoucher ? Number(selectedVoucher.paidAmount || 0) : 0;
  const modalCurrentDue = selectedVoucher
    ? Number(selectedVoucher.balance !== undefined ? selectedVoucher.balance : Math.max(0, modalTotal - modalAlreadyPaid))
    : 0;
  const modalInputReceived = Math.max(0, Number(cashReceived) || 0);

  let modalNewBalance = 0;
  let modalStatus = 'UNPAID';

  if (modalInputReceived === 0) {
    modalNewBalance = modalCurrentDue;
    modalStatus = modalAlreadyPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
  } else if (modalInputReceived === modalCurrentDue || modalInputReceived >= modalTotal) {
    // Exact remaining dues paid or full total paid -> Cleared!
    modalNewBalance = 0;
    modalStatus = 'PAID';
  } else if (modalAlreadyPaid > 0) {
    if (modalInputReceived < modalCurrentDue) {
      modalNewBalance = Math.max(0, modalCurrentDue - modalInputReceived);
      modalStatus = modalNewBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';
    } else {
      // Received cumulative amount
      modalNewBalance = Math.max(0, modalTotal - modalInputReceived);
      modalStatus = modalNewBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';
    }
  } else {
    // Initial partial payment on unpaid voucher
    modalNewBalance = Math.max(0, modalTotal - modalInputReceived);
    modalStatus = modalInputReceived >= modalTotal ? 'PAID' : 'PARTIALLY_PAID';
  }

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

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#041633] via-[#09234e] to-[#041633] rounded-2xl p-6 border border-slate-700 shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#ffa000] uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Financials & Accounts Desk</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Student Fee Management & Cash Counter
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Accountant physical cash collection desk (Paid, Partially Paid, Unpaid with auto dues tracking)
            plus bulk fee increment/decrement revisions.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-700 flex items-center gap-1">
          <button
            onClick={() => setActiveTab('counter')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition flex items-center gap-2 ${
              activeTab === 'counter'
                ? 'bg-[#ffa000] text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Cash Collection Counter</span>
          </button>
          <button
            onClick={() => setActiveTab('revision')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition flex items-center gap-2 ${
              activeTab === 'revision'
                ? 'bg-[#ffa000] text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Bulk Fee Revision (±)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CASH COLLECTION COUNTER */}
      {activeTab === 'counter' && (
        <div className="space-y-6">
          {/* Top Filter Bar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
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
              <label className="block font-bold text-slate-700 mb-1">Fee Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <button
                onClick={fetchVouchers}
                disabled={loading}
                className="w-full bg-[#041633] hover:bg-slate-800 text-white font-bold p-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <Search className="w-4 h-4 text-amber-400" />
                )}
                <span>Search / Refresh</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Receivables
                </span>
                <div className="text-xl font-black text-indigo-700 mt-1">
                  PKR {stats.totalReceivables?.toLocaleString()}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  Cash Collected
                </span>
                <div className="text-xl font-black text-emerald-600 mt-1">
                  PKR {stats.totalCollected?.toLocaleString()}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                  Carried Arrears
                </span>
                <div className="text-xl font-black text-rose-600 mt-1">
                  PKR {stats.totalArrears?.toLocaleString()}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                  Remaining Dues
                </span>
                <div className="text-xl font-black text-amber-600 mt-1">
                  PKR {stats.totalRemaining?.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Vouchers Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="text-sm font-black text-slate-800">
                Fee Collection Register ({filteredVouchers.length} Vouchers)
              </span>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() =>
                    exportFeeSheetToExcel({
                      schoolCode,
                      className: selectedClass,
                      section: selectedSection,
                      monthYear: selectedMonth,
                      vouchers: filteredVouchers,
                      stats,
                    })
                  }
                  disabled={filteredVouchers.length === 0}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-40"
                  title="Export styled Excel workbook (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search student or roll..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs font-semibold">Loading vouchers...</span>
              </div>
            ) : filteredVouchers.length === 0 ? (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-slate-300" />
                <span className="text-sm font-bold text-slate-600">No vouchers generated yet</span>
                <p className="text-xs text-slate-400">
                  Switch to <strong>Fee Generation</strong> tab to generate vouchers for this month.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="py-3 px-3">Roll</th>
                      <th className="py-3 px-3">Student Name</th>
                      <th className="py-3 px-3">Voucher #</th>
                      <th className="py-3 px-3 text-right">Net Fee</th>
                      <th className="py-3 px-3 text-right">Arrears</th>
                      <th className="py-3 px-3 text-right font-black text-slate-900">Total Payable</th>
                      <th className="py-3 px-3 text-right">Paid</th>
                      <th className="py-3 px-3 text-right">Balance</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredVouchers.map((v) => (
                      <tr key={v._id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-bold text-slate-900">{v.rollNumber}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{v.studentName}</div>
                          <div className="text-[10px] text-slate-400">Father: {v.fatherName}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{v.voucherNo}</td>
                        <td className="py-3 px-3 text-right font-semibold">
                          PKR {v.netMonthlyFee?.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-rose-600">
                          {v.previousArrears > 0 ? `PKR ${v.previousArrears.toLocaleString()}` : '0'}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-indigo-700">
                          PKR {v.totalPayableWithinDueDate?.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600">
                          {v.paidAmount > 0 ? `PKR ${v.paidAmount.toLocaleString()}` : '0'}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-rose-600">
                          {v.balance > 0 ? `PKR ${v.balance.toLocaleString()}` : '0'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                              v.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : v.status === 'PARTIALLY_PAID'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => openCollectionModal(v)}
                            className="px-3 py-1.5 bg-[#10b981] hover:bg-emerald-600 text-white font-black rounded-lg shadow-xs flex items-center justify-center gap-1 text-[11px] transition mx-auto cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Collect Cash</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BULK FEE REVISION (INCREMENT / DECREMENT) */}
      {activeTab === 'revision' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ffa000]" />
              <span>Bulk Student Fee Revision</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Apply a blanket increase or decrease across an entire class or the whole school.
              This modifies the students' base monthly tuition fee profile.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Scope */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Scope</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRevScope('CLASS')}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition ${
                    revScope === 'CLASS'
                      ? 'border-[#ffa000] bg-amber-50 text-slate-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>Single Class</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRevScope('ALL')}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition ${
                    revScope === 'ALL'
                      ? 'border-[#ffa000] bg-amber-50 text-slate-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>Whole School (All Classes)</span>
                </button>
              </div>
            </div>

            {/* If Class Scope, select class */}
            {revScope === 'CLASS' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Class</label>
                <select
                  value={revClass}
                  onChange={(e) => setRevClass(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                >
                  {classNames.map((c) => (
                    <option key={c} value={c}>
                      Class {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action: Increment vs Decrement */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Action</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRevAction('INCREMENT')}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition ${
                    revAction === 'INCREMENT'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Increment (+) Increase Fee</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRevAction('DECREMENT')}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition ${
                    revAction === 'DECREMENT'
                      ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                  <span>Decrement (-) Reduce Fee</span>
                </button>
              </div>
            </div>

            {/* Type & Value */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Revision Type</label>
                <select
                  value={revType}
                  onChange={(e) => setRevType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount (PKR)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Value ({revType === 'PERCENTAGE' ? '%' : 'PKR'})
                </label>
                <input
                  type="number"
                  min="1"
                  value={revValue}
                  onChange={(e) => setRevValue(e.target.value)}
                  placeholder="e.g. 10 or 500"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-black text-slate-800"
                />
              </div>
            </div>

            {/* Apply Button */}
            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={handleApplyRevision}
                disabled={applyingRevision}
                className="w-full py-3 bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {applyingRevision ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  Apply {revAction === 'INCREMENT' ? 'Increment (+)' : 'Decrement (-)'} of{' '}
                  {revValue} {revType === 'PERCENTAGE' ? '%' : 'PKR'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNTANT CASH RECEPTION MODAL */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#041633] to-[#09234e] p-4 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#ffa000] uppercase tracking-wider">
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Accountant Fee Reception</span>
                </div>
                <h3 className="text-base font-black text-white">
                  {selectedVoucher.studentName} (Roll {selectedVoucher.rollNumber})
                </h3>
              </div>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Particulars Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Class & Section:</span>
                  <span className="font-bold text-slate-900">
                    Class {selectedVoucher.className} - {selectedVoucher.section}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Voucher Number:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedVoucher.voucherNo}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Current Month Fee:</span>
                  <span className="font-bold text-slate-900">
                    PKR {selectedVoucher.netMonthlyFee?.toLocaleString()}
                  </span>
                </div>
                {selectedVoucher.previousArrears > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Past Arrears (Previous Dues):</span>
                    <span>PKR {selectedVoucher.previousArrears.toLocaleString()}</span>
                  </div>
                )}
                {modalAlreadyPaid > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                    <span>Already Paid So Far:</span>
                    <span>PKR {modalAlreadyPaid.toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-sm text-indigo-700">
                  <span>Total Voucher Bill:</span>
                  <span>PKR {modalTotal.toLocaleString()}</span>
                </div>
                {modalAlreadyPaid > 0 && modalCurrentDue > 0 && (
                  <div className="flex justify-between font-black text-sm text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <span>Remaining Outstanding Dues:</span>
                    <span>PKR {modalCurrentDue.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Cash Received Input */}
              <div>
                <label className="block font-black text-slate-800 mb-1">
                  {modalAlreadyPaid > 0
                    ? 'Payment to Clear Dues / Pay Installment (PKR)'
                    : 'Cash Amount Received (PKR)'}{' '}
                  <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                    PKR
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Enter cash amount..."
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-2 border-emerald-500 rounded-xl font-black text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCashReceived(String(modalAlreadyPaid > 0 ? modalCurrentDue : modalTotal))}
                  className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black rounded-lg border border-emerald-300 transition text-[11px]"
                >
                  {modalAlreadyPaid > 0
                    ? `✓ Clear Remaining Dues (PKR ${modalCurrentDue.toLocaleString()})`
                    : `✓ Full Paid (PKR ${modalTotal.toLocaleString()})`}
                </button>
                <button
                  type="button"
                  onClick={() => setCashReceived('0')}
                  className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-300 transition text-[11px]"
                >
                  Reset (0)
                </button>
              </div>

              {/* Live Calculation Feedback Card */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  modalStatus === 'PAID'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : modalStatus === 'PARTIALLY_PAID'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block">
                    Calculated Status
                  </span>
                  <span className="text-sm font-black">{modalStatus.replace('_', ' ')}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider block">
                    Remaining Balance
                  </span>
                  <span className="text-sm font-black">
                    PKR {modalNewBalance.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Accountant Name */}
              <div>
                <label className="block font-bold text-slate-600 mb-1">Received By / Accountant</label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setSelectedVoucher(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCollectCash}
                  disabled={savingPayment}
                  className="px-5 py-2 bg-[#10b981] hover:bg-emerald-600 text-white font-black rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  {savingPayment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Cash & Update Ledger</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
