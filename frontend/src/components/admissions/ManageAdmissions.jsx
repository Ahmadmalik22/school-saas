import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import {
  Users,
  Search,
  Edit3,
  Trash2,
  Printer,
  X,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Phone,
  Calendar,
  School,
  Save,
  User,
  DollarSign,
  Filter,
  Camera,
  Upload,
} from 'lucide-react';

export default function ManageAdmissions({ schoolCode }) {
  const { classNames } = useAcademicClasses(schoolCode);
  const { currentSession, sessions } = useAcademicSession();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalStudents: 0, totalPages: 1 });

  // Modals state
  const [editStudent, setEditStudent] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  // Edit Form Fields State
  const [editForm, setEditForm] = useState({
    fullName: '',
    gender: 'MALE',
    dob: '',
    bFormOrCnic: '',
    bloodGroup: 'Unknown',
    religion: 'Islam',
    address: '',
    city: 'Lahore',
    className: '',
    section: 'A',
    rollNumber: '',
    admissionNumber: '',
    admissionDate: '',
    academicSession: '2025-2026',
    fatherName: '',
    fatherCnic: '',
    fatherPhone: '',
    fatherOccupation: '',
    motherName: '',
    emergencyContact: '',
    monthlyFee: 2500,
    admissionFee: 0,
    annualCharges: 0,
    monthlyDiscount: 0,
    discountReason: '',
    status: 'ACTIVE',
  });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/students', {
        params: {
          schoolCode,
          className: selectedClass,
          section: selectedSection,
          status: statusFilter,
          search,
          page,
          limit: 15,
        },
      });
      if (res.data?.success) {
        setStudents(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Error fetching admitted students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [schoolCode, selectedClass, selectedSection, statusFilter, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  const handleResetFilters = () => {
    setSelectedClass('ALL');
    setSelectedSection('ALL');
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
  };

  // Open Edit Modal & Populate Form
  const handleOpenEdit = (student) => {
    setEditStudent(student);
    setEditPhotoFile(null);
    setEditPhotoPreview(student.photo?.url || null);
    setEditForm({
      fullName: student.fullName || '',
      gender: student.gender || 'MALE',
      dob: student.dob ? new Date(student.dob).toISOString().split('T')[0] : '',
      bFormOrCnic: student.bFormOrCnic || '',
      bloodGroup: student.bloodGroup || 'Unknown',
      religion: student.religion || 'Islam',
      address: student.address || '',
      city: student.city || 'Lahore',
      className: student.className || '',
      section: student.section || 'A',
      rollNumber: student.rollNumber || '',
      admissionNumber: student.admissionNumber || '',
      admissionDate: student.admissionDate ? new Date(student.admissionDate).toISOString().split('T')[0] : '',
      academicSession: student.academicSession || currentSession || '2025-2026',
      fatherName: student.fatherName || '',
      fatherCnic: student.fatherCnic || '',
      fatherPhone: student.fatherPhone || '',
      fatherOccupation: student.fatherOccupation || '',
      motherName: student.motherName || '',
      emergencyContact: student.emergencyContact || '',
      monthlyFee: student.monthlyFee ?? 2500,
      admissionFee: student.admissionFee ?? 0,
      annualCharges: student.annualCharges ?? 0,
      monthlyDiscount: student.monthlyDiscount ?? 0,
      discountReason: student.discountReason || '',
      status: student.status || 'ACTIVE',
    });
  };

  // Save Edit Handler
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editStudent) return;
    setSavingEdit(true);

    try {
      const netMonthlyFee = Math.max(0, (Number(editForm.monthlyFee) || 0) - (Number(editForm.monthlyDiscount) || 0));

      let res;
      if (editPhotoFile) {
        // Send multipart form-data to update info and upload new photo to Cloudinary
        const formData = new FormData();
        Object.keys(editForm).forEach((key) => {
          if (editForm[key] !== undefined && editForm[key] !== null) {
            formData.append(key, editForm[key]);
          }
        });
        formData.set('netMonthlyFee', netMonthlyFee);
        formData.set('monthlyFee', Number(editForm.monthlyFee) || 0);
        formData.set('admissionFee', Number(editForm.admissionFee) || 0);
        formData.set('annualCharges', Number(editForm.annualCharges) || 0);
        formData.set('monthlyDiscount', Number(editForm.monthlyDiscount) || 0);
        formData.append('photo', editPhotoFile);

        res = await api.put(`/students/${editStudent._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        const payload = {
          ...editForm,
          netMonthlyFee,
          monthlyFee: Number(editForm.monthlyFee) || 0,
          admissionFee: Number(editForm.admissionFee) || 0,
          annualCharges: Number(editForm.annualCharges) || 0,
          monthlyDiscount: Number(editForm.monthlyDiscount) || 0,
        };
        res = await api.put(`/students/${editStudent._id}`, payload);
      }

      if (res.data?.success) {
        setAlertMsg({ type: 'success', text: `Admission record & photo for "${editForm.fullName}" updated successfully!` });
        setEditStudent(null);
        setEditPhotoFile(null);
        setEditPhotoPreview(null);
        fetchStudents();
      } else {
        setAlertMsg({ type: 'error', text: res.data?.message || 'Failed to update student.' });
      }
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Error saving admission changes.' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Handler
  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleting(true);

    try {
      const res = await api.delete(`/students/${deleteCandidate._id}`);
      if (res.data?.success) {
        setAlertMsg({ type: 'success', text: `Student "${deleteCandidate.fullName}" deleted successfully.` });
        setDeleteCandidate(null);
        fetchStudents();
      } else {
        setAlertMsg({ type: 'error', text: res.data?.message || 'Failed to delete student.' });
      }
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Error deleting student.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Alert Notification */}
      {alertMsg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border text-xs font-semibold ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{alertMsg.text}</span>
          </div>
          <button onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#ffa000]" />
            <span>Manage Admissions & Student Directory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View all admitted students, edit comprehensive admission details, and manage student enrollments for school <span className="font-bold text-slate-800">{schoolCode}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200">
          <span>Total Admitted:</span>
          <span className="text-[#041633] text-sm font-black">{pagination.totalStudents}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 text-xs">
          {/* Class Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Classes</option>
              {classNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Sections</option>
              {['A', 'B', 'C', 'D'].map((sec) => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="STRUCK_OFF">Struck Off</option>
              <option value="PASSED_OUT">Passed Out</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Search Student</label>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Search name, roll #, admission #, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 text-xs focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="bg-[#041633] text-[#ffa000] font-bold px-3.5 rounded-lg flex items-center gap-1 cursor-pointer text-xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 rounded-lg text-xs cursor-pointer"
              >
                Reset
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Admitted Students Roster */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#041633] text-white uppercase text-[11px] font-bold">
              <tr>
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3 w-12 text-center">Photo</th>
                <th className="p-3">Adm No</th>
                <th className="p-3">Roll No</th>
                <th className="p-3">Student Name</th>
                <th className="p-3">Father Name</th>
                <th className="p-3 text-center">Class-Sec</th>
                <th className="p-3">Mobile Contact</th>
                <th className="p-3 text-right">Monthly Fee</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading admissions data...</span>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-slate-400">
                    No student admission records found matching current criteria.
                  </td>
                </tr>
              ) : (
                students.map((student, idx) => (
                  <tr key={student._id} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-center font-bold text-slate-500">
                      {(page - 1) * 15 + idx + 1}
                    </td>
                    <td className="p-3 text-center">
                      {student.photo?.url ? (
                        <img
                          src={student.photo.url}
                          alt={student.fullName}
                          className="w-8 h-8 rounded-full object-cover border border-amber-400 mx-auto"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center mx-auto text-[11px]">
                          {student.fullName ? student.fullName.charAt(0) : 'S'}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800">
                      {student.admissionNumber}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-700">
                      {student.rollNumber}
                    </td>
                    <td className="p-3 font-black text-slate-900">
                      {student.fullName}
                    </td>
                    <td className="p-3 text-slate-700">
                      {student.fatherName}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-800">
                      {student.className}-{student.section}
                    </td>
                    <td className="p-3 font-mono text-slate-700">
                      {student.fatherPhone}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      Rs. {(student.netMonthlyFee ?? student.monthlyFee ?? 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                          student.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : student.status === 'INACTIVE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(student)}
                          className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg transition shadow-xs cursor-pointer"
                          title="Edit Admission Information"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeleteCandidate(student)}
                          className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg transition shadow-xs cursor-pointer"
                          title="Delete Admission Record"
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

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalStudents} total records)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="px-3 py-1 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EDIT ADMISSION MODAL */}
      {editStudent && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-[#041633] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#ffa000]" />
                <span className="font-bold text-sm">
                  Edit Admission Details — {editStudent.fullName} ({editStudent.admissionNumber})
                </span>
              </div>
              <button
                onClick={() => setEditStudent(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="p-6 max-h-[80vh] overflow-y-auto space-y-5 text-xs text-slate-800">
              {/* Student Profile Photo Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white border-2 border-slate-300 shadow-sm shrink-0 flex items-center justify-center">
                  {editPhotoPreview ? (
                    <img src={editPhotoPreview} alt="Student" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <User className="w-8 h-8" />
                      <span className="text-[9px] font-bold mt-0.5">No Photo</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1 text-center sm:text-left">
                  <div className="font-bold text-slate-800 text-xs">Student Profile Photograph</div>
                  <div className="text-[11px] text-slate-500">
                    Upload or update passport-size photo (JPEG, PNG, WebP up to 10MB). Automatically crops and optimizes for ID card & admission slip.
                  </div>
                  <div className="pt-1.5 flex items-center gap-2 justify-center sm:justify-start">
                    <label className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs transition">
                      <Camera className="w-3.5 h-3.5 text-amber-600" />
                      <span>{editPhotoPreview ? 'Change Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files[0];
                          if (f) {
                            if (f.size > 10 * 1024 * 1024) {
                              setAlertMsg({ type: 'error', text: 'Photo size must be less than 10MB.' });
                              return;
                            }
                            setEditPhotoFile(f);
                            setEditPhotoPreview(URL.createObjectURL(f));
                          }
                        }}
                      />
                    </label>
                    {editPhotoFile && (
                      <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> New photo selected ({(editPhotoFile.size / 1024).toFixed(0)} KB)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 1: Academic & Placement */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wide flex items-center gap-1.5">
                  <School className="w-4 h-4 text-amber-600" />
                  <span>1. Academic Placement Details</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Class *</label>
                    <select
                      value={editForm.className}
                      onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
                    >
                      {classNames.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Section *</label>
                    <select
                      value={editForm.section}
                      onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
                    >
                      {['A', 'B', 'C', 'D'].map((sec) => (
                        <option key={sec} value={sec}>Section {sec}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Roll Number *</label>
                    <input
                      type="text"
                      value={editForm.rollNumber}
                      onChange={(e) => setEditForm({ ...editForm, rollNumber: e.target.value })}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Admission Number *</label>
                    <input
                      type="text"
                      value={editForm.admissionNumber}
                      onChange={(e) => setEditForm({ ...editForm, admissionNumber: e.target.value })}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Academic Session</label>
                    <select
                      value={editForm.academicSession}
                      onChange={(e) => setEditForm({ ...editForm, academicSession: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold"
                    >
                      {sessions.map((s) => (
                        <option key={s._id} value={s.sessionName}>{s.sessionName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Admission Date</label>
                    <input
                      type="date"
                      value={editForm.admissionDate}
                      onChange={(e) => setEditForm({ ...editForm, admissionDate: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="STRUCK_OFF">STRUCK OFF</option>
                      <option value="PASSED_OUT">PASSED OUT</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Student Personal Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wide flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>2. Student Personal Information</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Student Full Name *</label>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Gender *</label>
                    <select
                      value={editForm.gender}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editForm.dob}
                      onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">B-Form / CNIC</label>
                    <input
                      type="text"
                      placeholder="e.g. 35202-xxxxxxx-x"
                      value={editForm.bFormOrCnic}
                      onChange={(e) => setEditForm({ ...editForm, bFormOrCnic: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Blood Group</label>
                    <select
                      value={editForm.bloodGroup}
                      onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Residential Address *</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Parent & Guardian Particulars */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wide flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span>3. Parent & Guardian Particulars</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Father Name *</label>
                    <input
                      type="text"
                      value={editForm.fatherName}
                      onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Father Mobile / WhatsApp *</label>
                    <input
                      type="text"
                      value={editForm.fatherPhone}
                      onChange={(e) => setEditForm({ ...editForm, fatherPhone: e.target.value })}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Father CNIC</label>
                    <input
                      type="text"
                      value={editForm.fatherCnic}
                      onChange={(e) => setEditForm({ ...editForm, fatherCnic: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Father Occupation</label>
                    <input
                      type="text"
                      value={editForm.fatherOccupation}
                      onChange={(e) => setEditForm({ ...editForm, fatherOccupation: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mother Name</label>
                    <input
                      type="text"
                      value={editForm.motherName}
                      onChange={(e) => setEditForm({ ...editForm, motherName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Emergency Contact Phone</label>
                    <input
                      type="text"
                      value={editForm.emergencyContact}
                      onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Fee Structure & Concessions */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wide flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>4. Fee Structure & Concession</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Monthly Tuition Fee (PKR)</label>
                    <input
                      type="number"
                      value={editForm.monthlyFee}
                      onChange={(e) => setEditForm({ ...editForm, monthlyFee: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Admission Fee (PKR)</label>
                    <input
                      type="number"
                      value={editForm.admissionFee}
                      onChange={(e) => setEditForm({ ...editForm, admissionFee: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Monthly Discount (PKR)</label>
                    <input
                      type="number"
                      value={editForm.monthlyDiscount}
                      onChange={(e) => setEditForm({ ...editForm, monthlyDiscount: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Discount Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. Sibling concession"
                      value={editForm.discountReason}
                      onChange={(e) => setEditForm({ ...editForm, discountReason: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditStudent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-[#041633] hover:bg-[#06204d] text-[#ffa000] font-bold rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteCandidate && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Delete Admission Record?</h3>
              <p className="text-xs text-slate-600 mt-1">
                Are you sure you want to permanently delete student{' '}
                <strong>"{deleteCandidate.fullName}"</strong> (Roll: {deleteCandidate.rollNumber}, Adm No: {deleteCandidate.admissionNumber})?
              </p>
              <p className="text-[11px] text-rose-600 font-semibold mt-2">
                This action is irreversible and will remove all student profile information.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
              >
                No, Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Student</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
