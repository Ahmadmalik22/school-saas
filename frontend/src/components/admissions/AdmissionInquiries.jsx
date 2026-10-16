import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import confetti from 'canvas-confetti';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import {
  HelpCircle, Plus, Search, CheckCircle2, UserCheck,
  Calendar, Phone, Clock, RefreshCw, X, AlertCircle, Trash2
} from 'lucide-react';

export default function AdmissionInquiries({ schoolCode }) {
  const { classNames, getSectionsForClass } = useAcademicClasses(schoolCode);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State for New Inquiry
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInquiry, setNewInquiry] = useState({
    studentName: '',
    gender: 'MALE',
    targetClass: 'Class 1',
    targetSection: 'A',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    address: '',
    inquirySource: 'Walk-in',
    remarks: '',
  });

  // Modal State for 1-Click Admit
  const [admitModalInquiry, setAdmitModalInquiry] = useState(null);
  const [admitForm, setAdmitForm] = useState({
    admissionNumber: '',
    rollNumber: '',
    className: '',
    section: 'A',
    academicSession: '2025-2026',
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Auto sync targetClass with dynamic classes
  useEffect(() => {
    if (classNames && classNames.length > 0) {
      if (!newInquiry.targetClass || !classNames.includes(newInquiry.targetClass)) {
        const first = classNames[0];
        const secs = getSectionsForClass(first);
        setNewInquiry((prev) => ({
          ...prev,
          targetClass: first,
          targetSection: secs[0] || 'A',
        }));
      }
    }
  }, [classNames]);

  // Fetch Inquiries
  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admissions/inquiries', {
        params: {
          schoolCode,
          status: statusFilter,
          search,
        },
      });
      if (res.data.success) {
        setInquiries(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (statusFilter !== 'ALL' || search.trim() !== '' || hasSearched) {
      fetchInquiries();
    } else {
      setInquiries([]);
    }
  }, [schoolCode, statusFilter, hasSearched]);

  // Handle Search Submit
  const handleSearch = (e) => {
    e.preventDefault();
    setHasSearched(true);
    fetchInquiries();
  };

  // Create New Inquiry
  const handleCreateInquiry = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.post('/admissions/inquiry', {
        ...newInquiry,
        schoolCode,
      });
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setShowAddModal(false);
        setNewInquiry({
          studentName: '',
          gender: 'MALE',
          targetClass: 'Class 1',
          targetSection: 'A',
          parentName: '',
          parentPhone: '',
          parentEmail: '',
          address: '',
          inquirySource: 'Walk-in',
          remarks: '',
        });
        fetchInquiries();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to add inquiry.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Open 1-Click Admit Modal
  const openAdmitModal = (inquiry) => {
    setAdmitModalInquiry(inquiry);
    setAdmitForm({
      admissionNumber: `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      rollNumber: '',
      className: inquiry.targetClass,
      section: inquiry.targetSection || 'A',
      academicSession: '2025-2026',
    });
  };

  // Execute 1-Click Admit
  const handleConfirmAdmit = async (e) => {
    e.preventDefault();
    if (!admitModalInquiry) return;

    setActionLoading(true);
    try {
      const res = await api.post(`/admissions/inquiries/${admitModalInquiry._id}/admit`, admitForm);
      if (res.data.success) {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
        setToast({ type: 'success', message: res.data.message });
        setAdmitModalInquiry(null);
        fetchInquiries();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to convert inquiry.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Inquiry to save database space
  const handleDeleteInquiry = async (id, inquiryNumber) => {
    if (!window.confirm(`Are you sure you want to delete Inquiry #${inquiryNumber}?`)) {
      return;
    }
    try {
      const res = await api.delete(`/admissions/inquiries/${id}`);
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setInquiries((prev) => prev.filter((i) => i._id !== id));
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to delete inquiry.' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Banner & Controls */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            <span>Admission Inquiries & 1-Click Conversion</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log visitor & prospective student inquiries for <span className="font-bold text-slate-800">{schoolCode}</span>. Convert into enrolled student with 1-click.
          </p>
        </div>

        {/* New Inquiry Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#ffa000] hover:bg-amber-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Inquiry Record</span>
        </button>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 text-xs">
          {['ALL', 'OPEN', 'ADMITTED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-80">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by student, parent, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Inquiries Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Inquiries Directory ({inquiries.length})
          </h3>
          <button
            onClick={fetchInquiries}
            className="text-slate-400 hover:text-slate-700 p-1 rounded"
            title="Refresh Inquiries"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Inquiry #</th>
                <th className="p-3">Student Name</th>
                <th className="p-3">Class</th>
                <th className="p-3">Parent Name</th>
                <th className="p-3">Mobile Contact</th>
                <th className="p-3">Source</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inquiries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    {loading ? (
                      'Loading inquiries...'
                    ) : !hasSearched && statusFilter === 'ALL' && !search.trim() ? (
                      <div className="py-6 flex flex-col items-center justify-center text-slate-500">
                        <Search className="w-8 h-8 text-slate-400 mb-2" />
                        <span className="font-bold text-slate-700">Inquiry Directory Ready</span>
                        <span className="text-xs text-slate-400 mt-1 mb-3">
                          Enter search term or select status to view inquiries.
                        </span>
                        <button
                          type="button"
                          onClick={() => { setHasSearched(true); fetchInquiries(); }}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-sm"
                        >
                          Load All Inquiries
                        </button>
                      </div>
                    ) : (
                      'No inquiries found for this filter.'
                    )}
                  </td>
                </tr>
              ) : (
                inquiries.map((inq) => (
                  <tr key={inq._id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-slate-800">{inq.inquiryNumber}</td>
                    <td className="p-3 font-bold text-slate-900">{inq.studentName}</td>
                    <td className="p-3 font-semibold text-slate-700">
                      {inq.targetClass} ({inq.targetSection || 'A'})
                    </td>
                    <td className="p-3 text-slate-700">{inq.parentName}</td>
                    <td className="p-3 font-mono font-semibold text-slate-800">{inq.parentPhone}</td>
                    <td className="p-3 text-slate-500">{inq.inquirySource}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          inq.status === 'ADMITTED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {inq.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inq.status === 'OPEN' ? (
                          <button
                            onClick={() => openAdmitModal(inq)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Admit Now</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 mr-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Enrolled</span>
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteInquiry(inq._id, inq.inquiryNumber)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Inquiry to save space"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* MODAL 1: ADD NEW INQUIRY */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#041633] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Add New Admission Inquiry</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInquiry} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Student Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abdullah Shah"
                    value={newInquiry.studentName}
                    onChange={(e) => setNewInquiry({ ...newInquiry, studentName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Class <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newInquiry.targetClass}
                    onChange={(e) => {
                      const newCls = e.target.value;
                      const secs = getSectionsForClass(newCls);
                      setNewInquiry({ ...newInquiry, targetClass: newCls, targetSection: secs[0] || 'A' });
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    {classNames.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={newInquiry.gender}
                    onChange={(e) => setNewInquiry({ ...newInquiry, gender: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    <option value="MALE">Male (Boy)</option>
                    <option value="FEMALE">Female (Girl)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Parent / Guardian Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Father Name"
                    value={newInquiry.parentName}
                    onChange={(e) => setNewInquiry({ ...newInquiry, parentName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Parent Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="03001234567"
                    value={newInquiry.parentPhone}
                    onChange={(e) => setNewInquiry({ ...newInquiry, parentPhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inquiry Source</label>
                  <select
                    value={newInquiry.inquirySource}
                    onChange={(e) => setNewInquiry({ ...newInquiry, inquirySource: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2"
                  >
                    <option value="Walk-in">Walk-in</option>
                    <option value="Banner/Flex">Banner/Flex</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Word of Mouth / Reference">Reference</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Remarks / Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Will visit again on Monday"
                    value={newInquiry.remarks}
                    onChange={(e) => setNewInquiry({ ...newInquiry, remarks: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#ffa000] hover:bg-amber-500 text-slate-950 rounded-lg font-black shadow"
                >
                  {actionLoading ? 'Saving...' : 'Save Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: 1-CLICK ADMIT CONVERSION */}
      {admitModalInquiry && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-sm">1-Click Convert Inquiry to Student</h3>
              </div>
              <button onClick={() => setAdmitModalInquiry(null)} className="text-emerald-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdmit} className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900">
                <div className="font-bold text-sm">{admitModalInquiry.studentName}</div>
                <div className="text-[11px] mt-0.5">
                  Father: {admitModalInquiry.parentName} • Contact: {admitModalInquiry.parentPhone}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assign Admission No. <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={admitForm.admissionNumber}
                    onChange={(e) => setAdmitForm({ ...admitForm, admissionNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Class</label>
                    <input
                      type="text"
                      disabled
                      value={admitForm.className}
                      className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 font-bold text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Roll Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 105"
                      value={admitForm.rollNumber}
                      onChange={(e) => setAdmitForm({ ...admitForm, rollNumber: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdmitModalInquiry(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black shadow flex items-center gap-1.5"
                >
                  {actionLoading ? 'Enrolling...' : 'Confirm Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
