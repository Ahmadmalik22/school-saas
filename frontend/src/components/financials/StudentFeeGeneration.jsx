import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import confetti from 'canvas-confetti';
import {
  DollarSign, Calendar, Search, Edit3, CheckCircle2,
  AlertCircle, RefreshCw, Layers, ShieldCheck, Printer,
  FileSpreadsheet, ArrowRight, X, Clock, HelpCircle
} from 'lucide-react';

export default function StudentFeeGeneration({ schoolCode, setActiveSubModule }) {
  const { classNames, getSectionsForClass } = useAcademicClasses(schoolCode);

  // Filter State
  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const defaultDueDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const defaultIssueDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [issueDate, setIssueDate] = useState(defaultIssueDate);
  const [dueDate, setDueDate] = useState(defaultDueDate);

  // Data & State
  const [vouchers, setVouchers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Edit Modal State
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [editForm, setEditForm] = useState({
    baseMonthlyFee: 0,
    discount: 0,
    annualOrOtherCharges: 0,
    previousArrears: 0,
    fine: 0,
    lateFine: 200,
    remarks: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

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

  // Fetch Existing Fee Sheet
  const fetchFeeSheet = async () => {
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
        message: err.response?.data?.message || 'Failed to fetch fee sheet.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass && selectedMonth) {
      fetchFeeSheet();
    }
  }, [schoolCode, selectedClass, selectedSection, selectedMonth]);

  // Generate Fee Action
  const handleGenerateFee = async () => {
    if (!selectedClass || !selectedSection || !selectedMonth || !dueDate) {
      setToast({ type: 'error', message: 'Please select class, section, month, and due date.' });
      return;
    }

    setGenerating(true);
    try {
      const res = await api.post('/fees/generate', {
        schoolCode,
        className: selectedClass,
        section: selectedSection,
        monthYear: selectedMonth,
        issueDate,
        dueDate,
      });

      if (res.data.success) {
        setToast({
          type: 'success',
          message: res.data.message || 'Fee vouchers generated successfully!',
        });
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        fetchFeeSheet();
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Error generating fee vouchers.',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (v) => {
    setEditingVoucher(v);
    setEditForm({
      baseMonthlyFee: v.baseMonthlyFee || 0,
      discount: v.discount || 0,
      annualOrOtherCharges: v.annualOrOtherCharges || 0,
      previousArrears: v.previousArrears || 0,
      fine: v.fine || 0,
      lateFine: v.lateFine !== undefined ? v.lateFine : 200,
      remarks: v.remarks || '',
    });
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingVoucher) return;
    setSavingEdit(true);
    try {
      const res = await api.put(`/fees/voucher/${editingVoucher._id}`, editForm);
      if (res.data.success) {
        setToast({ type: 'success', message: 'Voucher updated with remarks successfully.' });
        setEditingVoucher(null);
        fetchFeeSheet();
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update voucher.',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // Calculated Preview inside Modal
  const modalNetFee = Math.max(0, Number(editForm.baseMonthlyFee) - Number(editForm.discount));
  const modalTotalWithin =
    modalNetFee +
    Number(editForm.previousArrears) +
    Number(editForm.annualOrOtherCharges) +
    Number(editForm.fine);
  const modalTotalAfter = modalTotalWithin + Number(editForm.lateFine);

  const filteredVouchers = vouchers.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.studentName?.toLowerCase().includes(q) ||
      v.fatherName?.toLowerCase().includes(q) ||
      v.rollNumber?.toLowerCase().includes(q) ||
      v.voucherNo?.toLowerCase().includes(q)
    );
  });

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
            <DollarSign className="w-4 h-4" />
            <span>Financials & Student Billing</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Monthly Fee Generation
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Generate monthly fee vouchers for all enrolled students in 1-click. Automatic previous dues
            rollforward, editable voucher adjustments, and custom remarks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveSubModule('student_fee_management')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm"
          >
            <span>Fee Management & Counter</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#ffa000]" />
          </button>
          <button
            onClick={() => setActiveSubModule('fee_vouchers_print')}
            className="px-4 py-2.5 bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>Print 4-in-1 Vouchers</span>
          </button>
        </div>
      </div>

      {/* Filter & Generation Control Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1">Class</label>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              const secs = getSectionsForClass(e.target.value);
              setSelectedSection(secs[0] || 'A');
            }}
            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
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
            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
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
            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Issue Date</label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
          />
        </div>

        {/* Generate Fee Action Button */}
        <div>
          <button
            onClick={handleGenerateFee}
            disabled={generating}
            className="w-full bg-[#10b981] hover:bg-emerald-600 text-white font-black p-2.5 rounded-lg shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {generating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <DollarSign className="w-4 h-4" />
            )}
            <span>Generate Fee</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Vouchers
            </span>
            <div className="text-xl font-black text-slate-900 mt-1">
              {stats.totalVouchers} Students
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Class {selectedClass}-{selectedSection}</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Receivables
            </span>
            <div className="text-xl font-black text-indigo-700 mt-1">
              PKR {stats.totalReceivables?.toLocaleString()}
            </div>
            <div className="text-[10px] text-indigo-500 font-semibold mt-1">Within Due Date</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              Collected
            </span>
            <div className="text-xl font-black text-emerald-600 mt-1">
              PKR {stats.totalCollected?.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-1">{stats.paidCount} Paid in Full</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
              Pending Arrears
            </span>
            <div className="text-xl font-black text-rose-600 mt-1">
              PKR {stats.totalArrears?.toLocaleString()}
            </div>
            <div className="text-[10px] text-rose-500 font-semibold mt-1">Past Month Balance</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              Remaining Due
            </span>
            <div className="text-xl font-black text-amber-600 mt-1">
              PKR {stats.totalRemaining?.toLocaleString()}
            </div>
            <div className="text-[10px] text-amber-600 font-semibold mt-1">{stats.partialCount} Partial, {stats.unpaidCount} Unpaid</div>
          </div>
        </div>
      )}

      {/* Search and Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-800">
              Vouchers Roster ({filteredVouchers.length})
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {selectedMonth}
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by roll, name, voucher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs font-semibold">Loading monthly fee sheet...</span>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8 text-slate-300" />
            <span className="text-sm font-bold text-slate-600">No fee vouchers found for this month</span>
            <p className="text-xs text-slate-400 max-w-sm">
              Click the green <strong>"Generate Fee"</strong> button above to create vouchers for Class{' '}
              {selectedClass} - Section {selectedSection}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Roll</th>
                  <th className="py-3 px-3">Student & Parent</th>
                  <th className="py-3 px-3">Voucher #</th>
                  <th className="py-3 px-3 text-right">Base Fee</th>
                  <th className="py-3 px-3 text-right">Discount</th>
                  <th className="py-3 px-3 text-right">Net Fee</th>
                  <th className="py-3 px-3 text-right">Arrears</th>
                  <th className="py-3 px-3 text-right font-black text-slate-900">Total Payable</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-3 text-right">Balance</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Remarks</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredVouchers.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-bold text-slate-900">{v.rollNumber}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{v.studentName}</div>
                      <div className="text-[10px] text-slate-400">S/D/O {v.fatherName}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{v.voucherNo}</td>
                    <td className="py-3 px-3 text-right font-semibold">
                      PKR {v.baseMonthlyFee?.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-600 font-semibold">
                      {v.discount > 0 ? `-PKR ${v.discount.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">
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
                    <td className="py-3 px-3 max-w-[140px] truncate text-[11px] text-slate-500 italic">
                      {v.remarks || '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => openEditModal(v)}
                        title="Edit voucher particulars and remarks"
                        className="p-1.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 rounded-lg transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Voucher Modal with Custom Remarks */}
      {editingVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
            <div className="bg-gradient-to-r from-[#041633] to-[#09234e] p-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#ffa000] uppercase tracking-wider">
                  Edit Voucher Particulars
                </span>
                <h3 className="text-base font-black text-white">
                  {editingVoucher.studentName} ({editingVoucher.rollNumber})
                </h3>
              </div>
              <button
                onClick={() => setEditingVoucher(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Base Monthly Fee (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.baseMonthlyFee}
                    onChange={(e) =>
                      setEditForm({ ...editForm, baseMonthlyFee: Number(e.target.value) || 0 })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Concession / Discount</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.discount}
                    onChange={(e) =>
                      setEditForm({ ...editForm, discount: Number(e.target.value) || 0 })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Previous Arrears (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.previousArrears}
                    onChange={(e) =>
                      setEditForm({ ...editForm, previousArrears: Number(e.target.value) || 0 })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-rose-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Other Charges / Fine</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.fine}
                    onChange={(e) =>
                      setEditForm({ ...editForm, fine: Number(e.target.value) || 0 })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Remarks Field (Your Requirement) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Remarks / Adjustment Reason <span className="text-amber-600">*</span>
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Special concession approved by Principal, fine for lost book added..."
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                ></textarea>
              </div>

              {/* Real-time Calculation Summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Within Due Date</span>
                  <span className="text-sm font-black text-indigo-700">
                    PKR {modalTotalWithin.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold block">After Due Date (+200)</span>
                  <span className="text-sm font-black text-slate-800">
                    PKR {modalTotalAfter.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setEditingVoucher(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-5 py-2 bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black rounded-lg shadow-md transition flex items-center gap-1.5"
                >
                  {savingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
