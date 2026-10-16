import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { broadcastDataChange } from '../../utils/realtimeEvents';
import confetti from 'canvas-confetti';
import {
  Users, Search, DollarSign, Printer, CheckCircle2,
  AlertCircle, RefreshCw, X, Receipt, ShieldCheck,
  FileSpreadsheet, ArrowRight, UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function FamilyFeeVoucher({ schoolCode, setActiveSubModule }) {
  const { schoolName, schoolProfile } = useAuth();
  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [fatherCnic, setFatherCnic] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [familyData, setFamilyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Family Cash Collection Modal
  const [collectingModal, setCollectingModal] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [receivedBy, setReceivedBy] = useState('School Accountant');
  const [savingPayment, setSavingPayment] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Search Family Voucher
  const handleSearchFamily = async () => {
    if (!fatherCnic || fatherCnic.trim().length < 5) {
      setToast({ type: 'error', message: 'Please enter a valid Father CNIC or digits.' });
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/fees/family-voucher', {
        params: {
          schoolCode,
          fatherCnic: fatherCnic.trim(),
          monthYear: selectedMonth,
        },
      });

      if (res.data.success) {
        setFamilyData(res.data.data);
        setCashAmount(String(res.data.data.grandBalance || res.data.data.grandPayable));
      }
    } catch (err) {
      console.error(err);
      setFamilyData(null);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'No students found matching this Father CNIC.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Submit Family Cash Payment
  const handleFamilyPayment = async () => {
    if (!familyData) return;
    setSavingPayment(true);
    try {
      const res = await api.post('/fees/family-voucher/collect-cash', {
        schoolCode,
        fatherCnic: familyData.fatherCnic,
        monthYear: selectedMonth,
        totalCashReceived: Number(cashAmount) || 0,
        receivedBy,
      });

      if (res.data.success) {
        setToast({ type: 'success', message: 'Family cash payment processed & all siblings updated!' });
        confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
        setCollectingModal(false);
        handleSearchFamily();
        broadcastDataChange('fee');
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Error processing family payment.',
      });
    } finally {
      setSavingPayment(false);
    }
  };

  // Print Family Voucher Slip
  const handlePrintFamilySlip = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-6">
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
      <div className="bg-gradient-to-r from-[#041633] via-[#09234e] to-[#041633] rounded-2xl p-6 border border-slate-700 shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#ffa000] uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Family Billing & Sibling Management</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Family Consolidated Fee Voucher
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            When multiple siblings (2, 3, or more children) study in the school across different classes,
            enter the Father's CNIC to generate and print a single consolidated family voucher.
          </p>
        </div>
      </div>

      {/* Search Bar Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3 items-end text-xs print:hidden">
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Father CNIC (e.g. 35201-1234567-1)
          </label>
          <div className="relative">
            <UserCheck className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Enter Father CNIC..."
              value={fatherCnic}
              onChange={(e) => setFatherCnic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchFamily()}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
            />
          </div>
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
          <button
            onClick={handleSearchFamily}
            disabled={loading}
            className="w-full bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black p-2.5 rounded-lg shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>Search & Build Family Voucher</span>
          </button>
        </div>
      </div>

      {/* Result Container */}
      {familyData && (
        <div className="space-y-6">
          {/* Family Header & Actions Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-slate-900">{familyData.fatherName}</span>
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                  CNIC: {familyData.fatherCnic}
                </span>
                <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                  {familyData.totalChildren} Siblings Enrolled
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                <span>Phone: {familyData.fatherPhone}</span>
                <span>•</span>
                <span>Voucher ID: <strong className="font-mono text-slate-800">{familyData.familyVoucherId}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCollectingModal(true)}
                className="px-4 py-2.5 bg-[#10b981] hover:bg-emerald-600 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                <span>Collect Family Cash</span>
              </button>
              <button
                onClick={handlePrintFamilySlip}
                className="px-4 py-2.5 bg-[#041633] hover:bg-slate-800 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Print Consolidated Slip</span>
              </button>
            </div>
          </div>

          {/* Consolidated KPI Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 print:hidden">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Siblings
              </span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {familyData.totalChildren} Kids
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Tuition
              </span>
              <div className="text-xl font-black text-slate-800 mt-1">
                PKR {familyData.totalTuition?.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Total Sibling Discount
              </span>
              <div className="text-xl font-black text-emerald-600 mt-1">
                PKR {familyData.totalDiscount?.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                Combined Past Arrears
              </span>
              <div className="text-xl font-black text-rose-600 mt-1">
                PKR {familyData.totalArrears?.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                Grand Net Payable
              </span>
              <div className="text-xl font-black text-indigo-700 mt-1">
                PKR {familyData.grandPayable?.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Sibling Breakdown Table (Screen View) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
            <div className="p-4 border-b border-slate-100 font-black text-sm text-slate-800">
              Enrolled Children Breakdown ({familyData.siblings?.length})
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Child Name</th>
                    <th className="py-3 px-3">Class & Section</th>
                    <th className="py-3 px-3">Roll #</th>
                    <th className="py-3 px-3 text-right">Tuition Fee</th>
                    <th className="py-3 px-3 text-right">Discount</th>
                    <th className="py-3 px-3 text-right">Arrears</th>
                    <th className="py-3 px-3 text-right font-black text-slate-900">Net Payable</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-3 text-right">Balance</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {familyData.siblings?.map((child, idx) => (
                    <tr key={child._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-bold text-slate-900">{child.studentName}</td>
                      <td className="py-3 px-3">
                        Class {child.className} - {child.section}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-700">{child.rollNumber}</td>
                      <td className="py-3 px-3 text-right font-semibold">
                        PKR {child.baseMonthlyFee?.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-600 font-semibold">
                        {child.discount > 0 ? `-PKR ${child.discount.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-600">
                        {child.previousArrears > 0 ? `PKR ${child.previousArrears.toLocaleString()}` : '0'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-indigo-700">
                        PKR {child.totalPayableWithinDueDate?.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">
                        PKR {child.paidAmount?.toLocaleString() || '0'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-rose-600">
                        PKR {child.balance?.toLocaleString() || '0'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                            child.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : child.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {child.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DUAL PRINT SLIP TEMPLATE (Hidden on screen, perfectly visible when printed or saving PDF) */}
          <div className="hidden print:block bg-white text-slate-900 p-2 space-y-4 font-sans text-[11px]">
            {/* The Dual Voucher: School Copy + Parent Copy */}
            <div className="grid grid-cols-2 gap-4 border-2 border-slate-900 p-3 rounded-lg relative">
              {/* Vertical Dotted Perforation Line */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-r-2 border-dashed border-slate-400"></div>

              {/* LEFT HALF: SCHOOL COPY */}
              <div className="pr-3 space-y-2">
                <div className="flex justify-between items-start border-b border-slate-300 pb-1.5">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider">{schoolProfile?.schoolName || schoolName || 'School System'}</h2>
                    <span className="text-[9px] font-bold text-slate-600 uppercase">{schoolProfile?.address || `Campus Code: ${schoolCode}`}</span>
                  </div>
                  <span className="text-[9px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded">
                    SCHOOL COPY
                  </span>
                </div>

                <div className="flex justify-between text-[10px]">
                  <span>Voucher #: <strong>{familyData.familyVoucherId}</strong></span>
                  <span>Month: <strong>{familyData.monthYear}</strong></span>
                </div>

                <div className="bg-slate-100 p-1.5 rounded text-[10px]">
                  <div>Guardian: <strong>{familyData.fatherName}</strong></div>
                  <div>CNIC: <strong>{familyData.fatherCnic}</strong> | Phone: {familyData.fatherPhone}</div>
                </div>

                {/* Sibling table */}
                <table className="w-full text-left text-[9px] border-collapse mt-1">
                  <thead>
                    <tr className="border-b border-slate-300 font-bold">
                      <th>Child Name</th>
                      <th>Class</th>
                      <th className="text-right">Fee</th>
                      <th className="text-right">Arrears</th>
                      <th className="text-right">Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyData.siblings?.map((s) => (
                      <tr key={s._id} className="border-b border-slate-200">
                        <td>{s.studentName}</td>
                        <td>{s.className}-{s.section}</td>
                        <td className="text-right">{s.netMonthlyFee}</td>
                        <td className="text-right">{s.previousArrears}</td>
                        <td className="text-right font-bold">{s.totalPayableWithinDueDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t-2 border-slate-900 pt-1 flex justify-between font-black text-xs">
                  <span>Grand Total Payable:</span>
                  <span>PKR {familyData.grandPayable?.toLocaleString()}</span>
                </div>

                <div className="pt-6 flex justify-between text-[8px] text-slate-500">
                  <span>Accountant Signature: ____________</span>
                  <span>Stamp: ________</span>
                </div>
              </div>

              {/* RIGHT HALF: PARENT COPY */}
              <div className="pl-3 space-y-2">
                <div className="flex justify-between items-start border-b border-slate-300 pb-1.5">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider">{schoolProfile?.schoolName || schoolName || 'School System'}</h2>
                    <span className="text-[9px] font-bold text-slate-600 uppercase">{schoolProfile?.address || `Campus Code: ${schoolCode}`}</span>
                  </div>
                  <span className="text-[9px] font-black bg-emerald-700 text-white px-1.5 py-0.5 rounded">
                    PARENT COPY
                  </span>
                </div>

                <div className="flex justify-between text-[10px]">
                  <span>Voucher #: <strong>{familyData.familyVoucherId}</strong></span>
                  <span>Month: <strong>{familyData.monthYear}</strong></span>
                </div>

                <div className="bg-slate-100 p-1.5 rounded text-[10px]">
                  <div>Guardian: <strong>{familyData.fatherName}</strong></div>
                  <div>CNIC: <strong>{familyData.fatherCnic}</strong> | Phone: {familyData.fatherPhone}</div>
                </div>

                {/* Sibling table */}
                <table className="w-full text-left text-[9px] border-collapse mt-1">
                  <thead>
                    <tr className="border-b border-slate-300 font-bold">
                      <th>Child Name</th>
                      <th>Class</th>
                      <th className="text-right">Fee</th>
                      <th className="text-right">Arrears</th>
                      <th className="text-right">Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyData.siblings?.map((s) => (
                      <tr key={s._id} className="border-b border-slate-200">
                        <td>{s.studentName}</td>
                        <td>{s.className}-{s.section}</td>
                        <td className="text-right">{s.netMonthlyFee}</td>
                        <td className="text-right">{s.previousArrears}</td>
                        <td className="text-right font-bold">{s.totalPayableWithinDueDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t-2 border-slate-900 pt-1 flex justify-between font-black text-xs text-emerald-800">
                  <span>Grand Total Payable:</span>
                  <span>PKR {familyData.grandPayable?.toLocaleString()}</span>
                </div>

                <div className="pt-6 flex justify-between text-[8px] text-slate-500">
                  <span>Received By: ____________</span>
                  <span>Parent Receipt Copy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COLLECT FAMILY CASH MODAL */}
      {collectingModal && familyData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
            <div className="bg-gradient-to-r from-[#041633] to-[#09234e] p-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#ffa000] uppercase tracking-wider">
                  Family Cash Collection
                </span>
                <h3 className="text-base font-black text-white">{familyData.fatherName}</h3>
              </div>
              <button
                onClick={() => setCollectingModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Total Enrolled Siblings:</span>
                  <span className="font-bold text-slate-900">{familyData.totalChildren} Children</span>
                </div>
                <div className="flex justify-between font-black text-sm text-indigo-700 pt-1 border-t border-slate-200">
                  <span>Grand Total Payable:</span>
                  <span>PKR {familyData.grandPayable?.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">
                  Cash Amount Received (PKR) <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                    PKR
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Enter cash received..."
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-2 border-emerald-500 rounded-xl font-black text-lg text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Received By / Accountant</label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setCollectingModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFamilyPayment}
                  disabled={savingPayment}
                  className="px-5 py-2 bg-[#10b981] hover:bg-emerald-600 text-white font-black rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  {savingPayment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Settle All Siblings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          nav, aside, header, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
