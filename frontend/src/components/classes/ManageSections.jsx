import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import {
  DoorOpen, Plus, Search, Edit3, Trash2,
  CheckCircle, AlertCircle, RefreshCw, X,
  Users
} from 'lucide-react';

export default function ManageSections({ schoolCode }) {
  const { classes, refreshClasses } = useAcademicClasses(schoolCode);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSection, setEditSection] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Form: Just Class & Section Name
  const [targetClassId, setTargetClassId] = useState('');
  const [sectionNameInput, setSectionNameInput] = useState('');

  // Auto dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Keep targetClassId aligned with classes
  useEffect(() => {
    if (classes.length > 0 && !targetClassId) {
      setTargetClassId(classes[0]._id);
    }
  }, [classes, targetClassId]);

  // Fetch sections
  const fetchSections = async () => {
    setLoading(true);
    try {
      const res = await api.get('/classes/sections/all', {
        params: {
          schoolCode,
          classId: selectedClassId !== 'ALL' ? selectedClassId : undefined,
        },
      });

      if (res.data.success) {
        setSections(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to fetch sections.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, [schoolCode, selectedClassId]);

  // Handle Add Section
  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!targetClassId) {
      setToast({ type: 'error', message: 'Please select a class.' });
      return;
    }
    if (!sectionNameInput.trim()) {
      setToast({ type: 'error', message: 'Please enter a section name (e.g. A, B).' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/classes/${targetClassId}/sections`, {
        name: sectionNameInput.trim().toUpperCase(),
      });

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setShowAddModal(false);
        setSectionNameInput('');
        await fetchSections();
        await refreshClasses();
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

  // Handle Edit Section
  const handleEditSection = async (e) => {
    e.preventDefault();
    if (!editSection.sectionName.trim()) {
      setToast({ type: 'error', message: 'Section name cannot be empty.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.put(`/classes/${editSection.classId}/sections/${editSection.sectionId}`, {
        name: editSection.sectionName.trim().toUpperCase(),
      });

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setEditSection(null);
        await fetchSections();
        await refreshClasses();
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update section.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Section
  const handleDeleteSection = async (sec) => {
    if (sec.enrolledCount > 0) {
      alert(`⚠️ Cannot delete Section "${sec.sectionName}" in ${sec.className} because ${sec.enrolledCount} active students are in it.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete Section "${sec.sectionName}" from ${sec.className}?`)) {
      return;
    }

    try {
      const res = await api.delete(`/classes/${sec.classId}/sections/${sec.sectionId}`);
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        await fetchSections();
        await refreshClasses();
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete section.',
      });
    }
  };

  // Filter sections by search
  const filteredSections = sections.filter((sec) => {
    const searchLower = search.toLowerCase();
    const matchesName = sec.sectionName.toLowerCase().includes(searchLower);
    const matchesClass = sec.className.toLowerCase().includes(searchLower);
    return matchesName || matchesClass;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5">
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
            <DoorOpen className="w-4 h-4" />
            <span>Academic Setup</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Manage Sections
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Add sections (e.g. A, B, C) to your classes and see how many students are in each.
          </p>
        </div>

        <button
          onClick={() => {
            if (classes.length > 0 && !targetClassId) {
              setTargetClassId(classes[0]._id);
            }
            setSectionNameInput('');
            setShowAddModal(true);
          }}
          className="bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Section</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search section or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Classes</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              refreshClasses();
              fetchSections();
            }}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sections Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-[#041633] text-white uppercase text-[11px] font-bold tracking-wider">
            <tr>
              <th className="py-3 px-4 w-14 text-center">#</th>
              <th className="py-3 px-4">Class</th>
              <th className="py-3 px-4">Section Name</th>
              <th className="py-3 px-4">Enrolled Students</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {loading && sections.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-10 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                  Loading sections...
                </td>
              </tr>
            ) : filteredSections.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-10 text-center text-slate-400">
                  <DoorOpen className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                  No sections found. Click "+ Add Section" to add one.
                </td>
              </tr>
            ) : (
              filteredSections.map((sec, idx) => (
                <tr key={`${sec.classId}_${sec.sectionId}`} className="hover:bg-slate-50/80 transition">
                  {/* Serial */}
                  <td className="py-3 px-4 text-center text-slate-400 text-[11px]">
                    {idx + 1}
                  </td>

                  {/* Class Name */}
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 text-sm">
                      {sec.className}
                    </span>
                  </td>

                  {/* Section Name */}
                  <td className="py-3 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-black bg-amber-50 text-amber-950 border border-amber-200">
                      Section {sec.sectionName}
                    </span>
                  </td>

                  {/* Enrolled Students */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <span>{sec.enrolledCount || 0}</span>
                      <span className="text-[11px] text-slate-400 font-normal">Students</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditSection({ ...sec })}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        title="Edit Section"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSection(sec)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete Section"
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

      {/* =========================================================================
          MODAL 1: ADD NEW SECTION (Simple)
      ========================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-100">
            <div className="bg-[#041633] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-[#ffa000]" />
                <h3 className="text-xs font-black">Add New Section</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSection} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Select Class <span className="text-rose-500">*</span>
                </label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                >
                  {classes.map((cls) => (
                    <option key={cls._id} value={cls._id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. A, B, C, Rose, Green"
                  value={sectionNameInput}
                  onChange={(e) => setSectionNameInput(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-black uppercase text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                  autoFocus
                  required
                />
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
                  {submitting ? 'Saving...' : 'Save Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: EDIT SECTION
      ========================================================================== */}
      {editSection && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-100">
            <div className="bg-[#041633] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#ffa000]" />
                <h3 className="text-xs font-black">
                  Edit Section ({editSection.className})
                </h3>
              </div>
              <button
                onClick={() => setEditSection(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSection} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editSection.sectionName}
                  onChange={(e) => setEditSection({ ...editSection, sectionName: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-black uppercase text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditSection(null)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
