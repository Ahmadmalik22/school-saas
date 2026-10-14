import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import ExcelJS from 'exceljs';
import {
  TrendingUp,
  Download,
  Printer,
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Layers,
} from 'lucide-react';

export default function FinancialSummaryReport({ schoolCode }) {
  const { currentSession, sessions } = useAcademicSession();

  const [selectedSession, setSelectedSession] = useState(currentSession || '2025-2026');
  const [monthYear, setMonthYear] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [tableSearch, setTableSearch] = useState('');

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState({
    schoolName: 'ISLAMABAD MODEL COLLEGE FOR BOYS',
    address: 'PAKISTAN TOWN, ISLAMABAD',
  });

  useEffect(() => {
    if (currentSession) setSelectedSession(currentSession);
  }, [currentSession]);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.get('/expenses/categories', { params: { schoolCode } });
        if (res.data?.success) setCategories(res.data.data || []);
      } catch (e) {}
    };
    fetchCats();
  }, [schoolCode]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/school-profile', { params: { schoolCode } });
        if (res.data?.success && res.data.data) setSchoolProfile(res.data.data);
      } catch (e) {}
    };
    fetchProfile();
  }, [schoolCode]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = { schoolCode };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (monthYear !== 'ALL') params.monthYear = monthYear;
      if (categoryId !== 'ALL') params.categoryId = categoryId;

      const res = await api.get('/reports/financial-summary', { params });
      if (res.data?.success) setReportData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [monthYear, categoryId]);

  const handleExportExcel = async () => {
    if (!reportData?.expenses) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Financial Statement');

    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = `${schoolProfile.schoolName} - Operating Expenses & Cash Flow`;
    worksheet.getCell('A1').font = { size: 14, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.addRow([]);
    worksheet.addRow(['Voucher #', 'Date', 'Category', 'Description / Remarks', 'Amount (PKR)', 'Recorded By']);

    (reportData.expenses || []).forEach((e) => {
      worksheet.addRow([
        e.voucherNo,
        e.dateString || (e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : ''),
        e.categoryName,
        e.remarks,
        e.amount,
        e.recordedBy || 'Accountant',
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Financial_Statement_${selectedSession}_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#ffa000]" />
              School Cash Flow & Financial Statement (P&L)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Analyze operating fee revenues versus school expenses. Track net surplus, operational deficit, and cost category breakdowns.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportExcel}
              disabled={loading || !reportData}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export to Excel</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={loading || !reportData}
              className="text-xs bg-[#041633] hover:bg-[#06204d] text-[#ffa000] font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print Financial Statement</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Expense Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="w-full text-xs bg-[#041633] hover:bg-[#06204d] text-[#ffa000] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Generate Statement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6 text-center">
        <h1 className="text-2xl font-black uppercase text-slate-900">{schoolProfile.schoolName}</h1>
        <p className="text-xs font-bold text-slate-700 uppercase">{schoolProfile.address}</p>
        <h2 className="text-base font-black uppercase text-slate-900 mt-2 border-b-2 border-slate-900 inline-block pb-1">
          SCHOOL CASH FLOW & FINANCIAL STATEMENT (P&L)
        </h2>
        <div className="text-[10px] text-slate-500 font-semibold mt-1">
          Generated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* KPI Cards */}
      {reportData?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/20">
            <span className="text-[11px] font-bold uppercase text-emerald-800 flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              Fee Revenue (Inflow)
            </span>
            <span className="text-xl font-black text-emerald-700 mt-1 block">
              Rs. {reportData.summary.totalFeeIncome?.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-600 mt-0.5 block">
              {reportData.summary.totalFeeTransactions} Collected Slips
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-rose-200 bg-rose-50/20">
            <span className="text-[11px] font-bold uppercase text-rose-800 flex items-center gap-1">
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
              Total Expenses (Outflow)
            </span>
            <span className="text-xl font-black text-rose-700 mt-1 block">
              Rs. {reportData.summary.totalExpenses?.toLocaleString()}
            </span>
            <span className="text-[10px] text-rose-600 mt-0.5 block">
              {reportData.summary.totalExpenseTransactions} Expense Entries
            </span>
          </div>

          <div
            className={`p-4 rounded-xl shadow-sm border ${
              reportData.summary.isProfitable
                ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950'
                : 'border-rose-300 bg-rose-50/40 text-rose-950'
            }`}
          >
            <span className="text-[11px] font-bold uppercase block">
              {reportData.summary.isProfitable ? 'Net Operating Profit' : 'Operating Deficit (Loss)'}
            </span>
            <span className="text-xl font-black mt-1 block">
              Rs. {Math.abs(reportData.summary.netOperatingBalance)?.toLocaleString()}
            </span>
            <span className="text-[10px] font-semibold mt-0.5 block">
              {reportData.summary.isProfitable ? 'Surplus Balance' : 'Expenses exceed income'}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <span className="text-[11px] font-bold uppercase text-slate-500 block">Expense Categories</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">
              {reportData.categoryBreakdown?.length || 0}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Active Cost Heads</span>
          </div>
        </div>
      )}

      {/* Category Breakdown Chips */}
      {reportData?.categoryBreakdown && reportData.categoryBreakdown.length > 0 && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-3">
            Category-Wise Expense Distribution
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {reportData.categoryBreakdown.map((c) => (
              <div key={c.category} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-xs font-bold text-slate-800 truncate">{c.category}</div>
                <div className="text-sm font-black text-rose-600 mt-0.5">Rs. {c.amount.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400 font-medium">{c.percentage}% of Total</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Expenses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 print:hidden">
          <span className="text-sm font-bold text-slate-900">
            Expense Vouchers ({reportData?.expenses?.length || 0})
          </span>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Voucher #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description / Remarks</th>
                <th className="py-3 px-4 text-right">Amount (PKR)</th>
                <th className="py-3 px-4 text-center">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading financial data...</span>
                  </td>
                </tr>
              ) : !reportData || reportData.expenses?.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-slate-600">No expenses recorded for selected filters.</p>
                  </td>
                </tr>
              ) : (
                reportData.expenses
                  .filter((e) =>
                    !tableSearch ||
                    e.categoryName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                    e.remarks?.toLowerCase().includes(tableSearch.toLowerCase()) ||
                    e.voucherNo?.toLowerCase().includes(tableSearch.toLowerCase())
                  )
                  .map((e, idx) => (
                    <tr key={e._id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{e.voucherNo}</td>
                      <td className="py-3 px-4 font-medium text-slate-600">{e.dateString}</td>
                      <td className="py-3 px-4 font-bold text-[#ffa000]">{e.categoryName}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{e.remarks}</td>
                      <td className="py-3 px-4 text-right font-black text-rose-600">
                        Rs. {e.amount?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-500">
                        {e.recordedBy || 'Accountant'}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Signatures */}
      <div className="hidden print:flex items-end justify-between pt-16 mt-8 border-t-2 border-slate-900 text-xs font-bold text-slate-900">
        <div className="text-center w-40">
          <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
          <span>Accountant</span>
        </div>
        <div className="text-center w-40">
          <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
          <span>Internal Auditor</span>
        </div>
        <div className="text-center w-40">
          <div className="border-b-2 border-slate-900 pb-1 mb-1"></div>
          <span>Principal / Director</span>
        </div>
      </div>
    </div>
  );
}
