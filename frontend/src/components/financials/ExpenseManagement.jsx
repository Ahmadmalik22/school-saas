import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { broadcastDataChange } from '../../utils/realtimeEvents';
import confetti from 'canvas-confetti';
import {
  Wallet, Plus, Search, Calendar, RefreshCw, CheckCircle2,
  AlertCircle, DollarSign, Edit3, Trash2, X, FileSpreadsheet,
  Tag, Clock, ArrowRight, ShieldCheck, Layers, HelpCircle
} from 'lucide-react';
import { exportExpenseLedgerToExcel } from '../../utils/excelExporter';

export default function ExpenseManagement({ schoolCode, setActiveSubModule }) {
  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Core Data State
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters State
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');

  // Quick Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    categoryId: '',
    amount: '',
    expenseDate: todayStr,
    remarks: '',
  });

  // Modal 1: Open New Category
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Modal 2: Edit Expense Entry
  const [editingExpense, setEditingExpense] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch Categories
  const fetchCategories = async () => {
    try {
      const res = await api.get('/expenses/categories', {
        params: { schoolCode },
      });
      if (res.data.success) {
        const cats = res.data.data || [];
        setCategories(cats);
        if (cats.length > 0 && !expenseForm.categoryId) {
          setExpenseForm((prev) => ({ ...prev, categoryId: cats[0]._id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Expense Ledger
  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await api.get('/expenses/ledger', {
        params: {
          schoolCode,
          monthYear: selectedMonth,
          categoryId: selectedCategory,
          search,
        },
      });

      if (res.data.success) {
        setExpenses(res.data.data || []);
        setStats(res.data.stats || null);
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to fetch expense ledger.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial load & filter change
  useEffect(() => {
    fetchCategories();
  }, [schoolCode]);

  useEffect(() => {
    fetchLedger();
  }, [schoolCode, selectedMonth, selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLedger();
  };

  // Handle Quick Expense Submit
  const handleRecordExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.categoryId || !expenseForm.amount || Number(expenseForm.amount) <= 0 || !expenseForm.remarks.trim()) {
      setToast({ type: 'error', message: 'Please select a category, enter a valid amount and remarks.' });
      return;
    }

    setSavingExpense(true);
    try {
      const res = await api.post('/expenses/record', {
        schoolCode,
        categoryId: expenseForm.categoryId,
        amount: Number(expenseForm.amount),
        expenseDate: expenseForm.expenseDate,
        remarks: expenseForm.remarks.trim(),
        recordedBy: 'School Accountant',
      });

      if (res.data.success) {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
        setToast({ type: 'success', message: res.data.message });
        setExpenseForm((prev) => ({
          ...prev,
          amount: '',
          remarks: '',
        }));
        fetchLedger();
        broadcastDataChange('expense');
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to record expense.',
      });
    } finally {
      setSavingExpense(false);
    }
  };

  // Handle Open New Category Submit
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setToast({ type: 'error', message: 'Category name is required.' });
      return;
    }

    setSavingCategory(true);
    try {
      const res = await api.post('/expenses/categories', {
        schoolCode,
        name: newCatName.trim(),
        description: newCatDesc.trim(),
      });

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        const createdCat = res.data.data;
        setCategories((prev) => [...prev, createdCat].sort((a, b) => a.name.localeCompare(b.name)));
        setExpenseForm((prev) => ({ ...prev, categoryId: createdCat._id }));
        setNewCatName('');
        setNewCatDesc('');
        setShowCategoryModal(false);
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to create category.',
      });
    } finally {
      setSavingCategory(false);
    }
  };

  // Handle Edit Expense Submit
  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    if (!editingExpense) return;

    setSavingEdit(true);
    try {
      const res = await api.put(`/expenses/${editingExpense._id}`, {
        categoryId: editingExpense.categoryId,
        amount: Number(editingExpense.amount),
        remarks: editingExpense.remarks,
        expenseDate: editingExpense.expenseDate,
      });

      if (res.data.success) {
        setToast({ type: 'success', message: 'Expense updated successfully.' });
        setEditingExpense(null);
        fetchLedger();
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update expense.',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Delete Expense
  const handleDeleteExpense = async (exp) => {
    if (!window.confirm(`Are you sure you want to delete expense voucher "${exp.voucherNo}" (PKR ${exp.amount})?`)) {
      return;
    }

    try {
      const res = await api.delete(`/expenses/${exp._id}`);
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        fetchLedger();
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete expense.',
      });
    }
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

      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-[#041633] via-[#09234e] to-[#041633] rounded-2xl p-6 border border-slate-700 shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#ffa000] uppercase tracking-wider mb-1">
            <Wallet className="w-4 h-4" />
            <span>School Accounts & Roznamcha • Campus Expenses</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            School Expense Management & Ledger
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Quick daily expense entry with category management. Select category, enter amount and remarks.
            Categories remain permanently saved once opened.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Open New Category</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Today's Total Expense
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                PKR {stats.todayAmount?.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Recorded today ({todayStr})</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Monthly Total ({selectedMonth})
              </span>
              <div className="text-2xl font-black text-rose-600 mt-1">
                PKR {stats.totalMonthlyAmount?.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Total monthly expenditure</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
              <Wallet className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Top Expense Category
              </span>
              <div className="text-lg font-black text-slate-900 mt-1 truncate max-w-[170px]" title={stats.topCategory?.name}>
                {stats.topCategory?.name || 'None'}
              </div>
              <span className="text-[10px] text-emerald-600 font-bold">
                PKR {stats.topCategory?.amount?.toLocaleString() || 0}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
              <Tag className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Ledger Entries
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {stats.totalEntries} Vouchers
              </div>
              <span className="text-[10px] text-slate-400 font-medium">In current selected month</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* 3. QUICK EXPENSE ENTRY FORM (FAST & SIMPLE) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-[#ffa000]">
              <Plus className="w-4 h-4 font-black" />
            </div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Quick Expense Entry
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Takes only 5 seconds</span>
        </div>

        <form onSubmit={handleRecordExpense} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end text-xs">
          {/* Date */}
          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={expenseForm.expenseDate}
              onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          {/* Category Dropdown */}
          <div className="sm:col-span-3">
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-slate-700">Expense Category Head</label>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                <span>Open New</span>
              </button>
            </div>
            <select
              value={expenseForm.categoryId}
              onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
              required
            >
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Amount (PKR)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 font-bold text-slate-400">Rs.</span>
              <input
                type="number"
                min="1"
                placeholder="500"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-rose-600 text-sm focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
          </div>

          {/* Remarks */}
          <div className="sm:col-span-3">
            <label className="block font-bold text-slate-700 mb-1">Remarks / Description</label>
            <input
              type="text"
              placeholder="e.g. Milk & biscuits for teachers room..."
              value={expenseForm.remarks}
              onChange={(e) => setExpenseForm({ ...expenseForm, remarks: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          {/* Submit Button */}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={savingExpense}
              className="w-full bg-[#041633] hover:bg-slate-800 text-amber-400 font-black p-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {savingExpense ? (
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              <span>Save Expense</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. ROZNAMCHA / EXPENSE LEDGER REGISTER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filter Top Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-800">
              Expense Ledger ({expenses.length} Records)
            </span>
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Month Filter */}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500"
            />

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer focus:ring-2 focus:ring-amber-500 max-w-[150px]"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={() =>
                exportExpenseLedgerToExcel({
                  schoolCode,
                  monthYear: selectedMonth,
                  expenses,
                  stats,
                })
              }
              disabled={expenses.length === 0}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-40"
              title="Export styled Excel roznamcha (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search remarks, voucher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500"
              />
            </form>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs font-semibold">Loading roznamcha ledger...</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8 text-slate-300" />
            <span className="text-sm font-bold text-slate-600">No expenses recorded for this filter</span>
            <p className="text-xs text-slate-400">
              Use the quick form above to record today's expenses.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Voucher #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Category Head</th>
                  <th className="py-3 px-3">Remarks / Description</th>
                  <th className="py-3 px-3 text-right">Amount (PKR)</th>
                  <th className="py-3 px-3 text-center">Recorded By</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {expenses.map((exp) => (
                  <tr key={exp._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{exp.voucherNo}</td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {exp.dateString || new Date(exp.expenseDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 border border-slate-200 text-slate-800">
                        {exp.categoryName}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-normal text-slate-800">{exp.remarks}</td>
                    <td className="py-3 px-3 text-right font-black text-rose-600 text-sm">
                      PKR {exp.amount?.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-500 text-[11px]">{exp.recordedBy}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() =>
                            setEditingExpense({
                              _id: exp._id,
                              categoryId: exp.categoryId,
                              categoryName: exp.categoryName,
                              amount: exp.amount,
                              expenseDate: exp.dateString || todayStr,
                              remarks: exp.remarks,
                            })
                          }
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-amber-600 rounded-md transition cursor-pointer"
                          title="Edit expense entry"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition cursor-pointer"
                          title="Delete expense voucher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: OPEN NEW EXPENSE CATEGORY */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#041633] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Open New Expense Category Head</h3>
              </div>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Generator Fuel / Diesel"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                  required
                  autoFocus
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  This category will remain permanently saved and available in the dropdown.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  placeholder="e.g. Fuel expenses for backup power during electricity loadshedding..."
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-amber-500 h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-5 py-2 bg-[#041633] hover:bg-slate-800 text-amber-400 font-black rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  {savingCategory ? 'Opening...' : 'Save & Open Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT EXPENSE ENTRY */}
      {editingExpense && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#041633] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Edit Expense Voucher</h3>
              </div>
              <button
                onClick={() => setEditingExpense(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateExpense} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={editingExpense.expenseDate}
                  onChange={(e) => setEditingExpense({ ...editingExpense, expenseDate: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={editingExpense.categoryId}
                  onChange={(e) => setEditingExpense({ ...editingExpense, categoryId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                  required
                >
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  min="1"
                  value={editingExpense.amount}
                  onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-rose-600 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={editingExpense.remarks}
                  onChange={(e) => setEditingExpense({ ...editingExpense, remarks: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-[#041633] hover:bg-slate-800 text-amber-400 font-black rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Updating...' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
