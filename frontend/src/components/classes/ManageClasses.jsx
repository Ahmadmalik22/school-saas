import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import {
  Plus, Search, Edit3, Trash2,
  Users, CheckCircle, AlertCircle, RefreshCw, X,
  Layers, DoorOpen
} from 'lucide-react';

export default function ManageClasses({ schoolCode }) {
  const { classes, loading, refreshClasses } = useAcademicClasses(schoolCode);
  const [search, setSearch] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [quickSectionClass, setQuickSectionClass] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Form: Just Class Name & Numeric Sequence
  const [classNameInput, setClassNameInput] = useState('');
  const [orderInput, setOrderInput] = useState('');

  // Quick section input
  const [newSectionName, setNewSectionName] = useState('B');

  // Auto hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle Add Class
  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!classNameInput.trim()) {
      setToast({ type: 'error', message: 'Please enter a class name.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/classes', {
        schoolCode,
        name: classNameInput.trim(),
        numericOrder: Number(orderInput) || (classes.length + 1),
      });

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setShowAddModal(false);
        setClassNameInput('');
        setOrderInput('');
        refreshClasses();
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to create class.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Class
  const handleEditClass = async (e) => {
    e.preventDefault();
    if (!editClass.name.trim()) {
      setToast({ type: 'error', message: 'Class name cannot be empty.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.put(`/classes/${editClass._id}`, {
        name: editClass.name.trim(),
        numericOrder: Number(editClass.numericOrder),
        isActive: editClass.isActive,
      });

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setEditClass(null);
        refreshClasses();
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update class.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Quick Add Section
  const handleQuickAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) {
      setToast({ type: 'error', message: 'Please enter a section name.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/classes/${quickSectionClass._id}/sections`, {
        name: newSectionName.trim().toUpperCase(),
      });

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setQuickSectionClass(null);
        setNewSectionName('B');
        refreshClasses();
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to add section.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Class
  const handleDeleteClass = async (cls) => {
    if (cls.totalEnrolled > 0) {
      alert(`⚠️ Cannot delete "${cls.name}" because it currently has ${cls.totalEnrolled} active students enrolled.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${cls.name}"?`)) {
      return;
    }

    try {
      const res = await api.delete(`/classes/${cls._id}`);
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        refreshClasses();
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete class.',
      });
    }
  };

  // Natural sorting helper (Nursery, Prep, Class 1, Class 2, ... Class 10)
  const getClassWeight = (name = '') => {
    const lower = name.toLowerCase().trim();
    if (lower.includes('pg') || lower.includes('play')) return 0.05;
    if (lower.includes('nursery')) return 0.1;
    if (lower.includes('prep') || lower.includes('kg')) return 0.2;
    const match = lower.match(/\d+/);
    if (match) return parseInt(match[0], 10);
    return 999;
  };

  // Filter and sort classes in natural sequential order
  const filteredClasses = useMemo(() => {
    return [...classes]
      .filter((cls) => cls.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const weightA = a.numericOrder && a.numericOrder !== 1 ? a.numericOrder : getClassWeight(a.name);
        const weightB = b.numericOrder && b.numericOrder !== 1 ? b.numericOrder : getClassWeight(b.name);
        if (weightA !== weightB) return weightA - weightB;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
  }, [classes, search]);

  const totalClassesCount = classes.length;
  const totalSectionsCount = classes.reduce((acc, c) => acc + (c.sections?.length || 0), 0);
  const totalStudentsEnrolled = classes.reduce((acc, c) => acc + (c.totalEnrolled || 0), 0);

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-5">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-bold text-white transition-all ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-wider mb-0.5">
            <Layers className="w-4 h-4" />
            <span>Academic Setup</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Manage Classes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Add and manage classes for your school. Each class automatically gets sections.
          </p>
        </div>

        <button
          onClick={() => {
            setClassNameInput('');
            setOrderInput(classes.length + 1);
            setShowAddModal(true);
          }}
          className="bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Class</span>
        </button>
      </div>

      {/* 3 Simple KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Total Classes</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalClassesCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Total Sections</div>
            <div className="text-2xl font-black text-blue-600 mt-1">{totalSectionsCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <DoorOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Enrolled Students</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{totalStudentsEnrolled}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and Refresh Bar */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search class by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <button
          onClick={refreshClasses}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Classes Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-[#041633] text-white uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4 w-14 text-center">#</th>
                <th className="py-3 px-4">Class Name</th>
                <th className="py-3 px-4">Sections</th>
                <th className="py-3 px-4">Total Students</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && classes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading classes...
                  </td>
                </tr>
              ) : filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-slate-400">
                    <Layers className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                    No classes found. Click "+ Add Class" to create one.
                  </td>
                </tr>
              ) : (
                filteredClasses.map((cls, idx) => (
                  <tr key={cls._id} className="hover:bg-slate-50/80 transition">
                    {/* Serial Number */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-slate-500 text-[11px]">
                        {idx + 1}
                      </span>
                    </td>

                    {/* Class Name */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 text-sm">
                        {cls.name}
                      </span>
                    </td>

                    {/* Sections Badges */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {cls.sections && cls.sections.length > 0 ? (
                          cls.sections.map((sec) => (
                            <span
                              key={sec._id || sec.name}
                              className="bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-bold"
                            >
                              Sec {sec.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">No section</span>
                        )}

                        {/* Quick Add Section */}
                        <button
                          onClick={() => {
                            setQuickSectionClass(cls);
                            setNewSectionName('');
                          }}
                          className="text-[10px] text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded font-bold border border-amber-200 transition cursor-pointer"
                          title="Add Section to this class"
                        >
                          + Add Sec
                        </button>
                      </div>
                    </td>

                    {/* Enrolled Students */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        <span>{cls.totalEnrolled || 0}</span>
                        <span className="text-[11px] text-slate-400 font-normal">Students</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          cls.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {cls.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditClass(cls)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Edit Class"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClass(cls)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Class"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* =========================================================================
          MODAL 1: ADD NEW CLASS (Super Simple)
      ========================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-100">
            <div className="bg-[#041633] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#ffa000]" />
                <h3 className="text-xs font-black">Add New Class</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddClass} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Class 1, Nursery, Prep, Class 9"
                  value={classNameInput}
                  onChange={(e) => setClassNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Order / Serial
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1, 2, 3"
                  value={orderInput}
                  onChange={(e) => setOrderInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-[10px] text-slate-400">Sequence in which class appears</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: EDIT CLASS
      ========================================================================== */}
      {editClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-100">
            <div className="bg-[#041633] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#ffa000]" />
                <h3 className="text-xs font-black">Edit Class</h3>
              </div>
              <button
                onClick={() => setEditClass(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditClass} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editClass.name}
                  onChange={(e) => setEditClass({ ...editClass, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Class Order</label>
                <input
                  type="number"
                  value={editClass.numericOrder}
                  onChange={(e) => setEditClass({ ...editClass, numericOrder: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditClass(null)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: QUICK ADD SECTION
      ========================================================================== */}
      {quickSectionClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-100">
            <div className="bg-[#041633] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-[#ffa000]" />
                <h3 className="text-xs font-black">
                  Add Section ({quickSectionClass.name})
                </h3>
              </div>
              <button
                onClick={() => setQuickSectionClass(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSection} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. B, Rose, Green"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-black uppercase text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickSectionClass(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
