import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAcademicClasses } from '../../hooks/useAcademicClasses';
import {
  Users, Search, Filter, Eye, Edit3, Trash2,
  ChevronLeft, ChevronRight, X, CheckCircle, AlertCircle,
  RefreshCw, User, Phone, MapPin, Calendar, CheckSquare,
  ShieldCheck, AlertTriangle, FileSpreadsheet, Camera, Upload
} from 'lucide-react';
import { exportStudentDirectoryToExcel } from '../../utils/excelExporter';

export default function StudentInformation({ schoolCode }) {
  const { classNames, getSectionsForClass } = useAcademicClasses(schoolCode);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    totalStudents: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Modal States
  const [viewStudent, setViewStudent] = useState(null);
  const [editStudent, setEditStudent] = useState(null);
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Fetch Students with Pagination
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
          limit: 10,
        },
      });

      if (res.data.success) {
        setStudents(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error(err);
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

  // Toggle Status (ACTIVE <-> INACTIVE)
  const handleToggleStatus = async (student) => {
    const newStatus = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await api.patch(`/students/${student._id}/status`, { status: newStatus });
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setStudents((prev) =>
          prev.map((s) => (s._id === student._id ? { ...s, status: newStatus } : s))
        );
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to update status.' });
    }
  };

  // Delete Student
  const handleDeleteStudent = async (student) => {
    if (!window.confirm(`Are you sure you want to delete ${student.fullName} (Roll: ${student.rollNumber})? This will also remove their photo from Cloudinary.`)) {
      return;
    }

    try {
      const res = await api.delete(`/students/${student._id}`);
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        fetchStudents();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to delete student.' });
    }
  };

  // Edit Form Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);

    try {
      let res;
      if (editPhotoFile) {
        const formData = new FormData();
        Object.keys(editStudent).forEach((k) => {
          if (k !== 'photo' && editStudent[k] !== undefined && editStudent[k] !== null) {
            formData.append(k, editStudent[k]);
          }
        });
        formData.append('photo', editPhotoFile);
        res = await api.put(`/students/${editStudent._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.put(`/students/${editStudent._id}`, editStudent);
      }

      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setEditStudent(null);
        setEditPhotoFile(null);
        setEditPhotoPreview(null);
        fetchStudents();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to update student.' });
    } finally {
      setEditLoading(false);
    }
  };

  const classOptions = [
    'ALL', 'Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4',
    'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <span>Student Information Directory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View, search, edit, and manage all enrolled students with server-side pagination for <span className="font-bold text-slate-800">{schoolCode}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              exportStudentDirectoryToExcel({
                schoolCode,
                students,
                filterClass: selectedClass,
              })
            }
            disabled={students.length === 0}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-40"
            title="Export full enrolled students list to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Roster (Excel)</span>
          </button>

          <div className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-bold">
            Total Students: {pagination.totalStudents}
          </div>
        </div>
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

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Class</label>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setSelectedSection('ALL');
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
          >
            <option value="ALL">All Classes</option>
            {classNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
          >
            <option value="ALL">All Sections</option>
            {getSectionsForClass(selectedClass).map((s) => (
              <option key={s} value={s}>Section {s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Students</option>
            <option value="INACTIVE">Inactive Students</option>
            <option value="STRUCK_OFF">Struck Off</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Search</label>
          <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
            <input
              type="text"
              placeholder="Name, Roll, Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              className="bg-slate-900 text-white font-bold px-3 py-2 rounded-lg text-xs shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Enrolled Students ({pagination.totalStudents})
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Page {pagination.currentPage} of {pagination.totalPages || 1}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Photo</th>
                <th className="p-3">Roll No</th>
                <th className="p-3">Admission No</th>
                <th className="p-3">Student Name</th>
                <th className="p-3">Class & Sec</th>
                <th className="p-3">Father Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    {loading ? 'Loading students...' : 'No student records found matching filters.'}
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student._id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3">
                      {student.photo?.url ? (
                        <img
                          src={student.photo.url}
                          alt={student.fullName}
                          className="w-9 h-9 rounded-full object-cover border border-amber-400 shadow-sm"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                          {student.fullName.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">{student.rollNumber}</td>
                    <td className="p-3 font-mono text-slate-600">{student.admissionNumber}</td>
                    <td className="p-3 font-bold text-slate-900">{student.fullName}</td>
                    <td className="p-3 font-semibold text-slate-700">
                      {student.className} ({student.section})
                    </td>
                    <td className="p-3 text-slate-700">{student.fatherName}</td>
                    <td className="p-3 font-mono text-slate-800">{student.fatherPhone}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(student)}
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider cursor-pointer ${
                          student.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                        title="Click to toggle status"
                      >
                        {student.status}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* 1. View Profile Button */}
                        <button
                          onClick={() => setViewStudent(student)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Full Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* 2. Edit Student Button */}
                        <button
                          onClick={() => {
                            setEditStudent(student);
                            setEditPhotoFile(null);
                            setEditPhotoPreview(student.photo?.url || null);
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Edit Information"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* 3. Delete Student Button */}
                        <button
                          onClick={() => handleDeleteStudent(student)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Record"
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

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing Page <span className="font-bold text-slate-900">{pagination.currentPage}</span> of{' '}
            <span className="font-bold text-slate-900">{pagination.totalPages || 1}</span> (Total{' '}
            {pagination.totalStudents} students)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrevPage}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1 disabled:opacity-40 transition cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: VIEW STUDENT PROFILE */}
      {viewStudent && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="bg-[#041633] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
                  {viewStudent.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{viewStudent.fullName}</h3>
                  <div className="text-[11px] text-slate-400">
                    Roll: {viewStudent.rollNumber} • {viewStudent.className} ({viewStudent.section})
                  </div>
                </div>
              </div>
              <button onClick={() => setViewStudent(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs">
              {/* Photo & Basic Badge Grid */}
              <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-100 pb-5">
                <div className="w-28 h-32 rounded-xl overflow-hidden bg-slate-100 border-2 border-amber-400 shadow-md shrink-0">
                  {viewStudent.photo?.url ? (
                    <img src={viewStudent.photo.url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">No Photo</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Admission No</span>
                    <span className="font-mono font-bold text-slate-900">{viewStudent.admissionNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Session</span>
                    <span className="font-bold text-slate-900">{viewStudent.academicSession || '2025-2026'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Gender & Blood Group</span>
                    <span className="font-bold text-slate-900">{viewStudent.gender} • {viewStudent.bloodGroup}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Date of Birth</span>
                    <span className="font-bold text-slate-900">{new Date(viewStudent.dob).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Guardian & Contact */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Guardian & Contact Details</h4>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Father's Name</span>
                    <span className="font-bold text-slate-900">{viewStudent.fatherName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Father's Phone</span>
                    <span className="font-mono font-bold text-slate-900">{viewStudent.fatherPhone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Father CNIC</span>
                    <span className="font-mono text-slate-800">{viewStudent.fatherCnic || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Father Occupation</span>
                    <span className="text-slate-800">{viewStudent.fatherOccupation || 'N/A'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Residential Address</span>
                    <span className="text-slate-800">{viewStudent.address}, {viewStudent.city}</span>
                  </div>
                </div>
              </div>

              {/* Fee & Concession */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                  Agreed Fee Structure & Concession Profile
                </h4>
                <div className="grid grid-cols-3 gap-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                  <div>
                    <div className="text-[10px] text-amber-800 font-semibold">Monthly Tuition Fee</div>
                    <div className="text-sm font-black text-slate-900">
                      PKR {Number(viewStudent.monthlyFee || 2500).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-800 font-semibold">Monthly Concession</div>
                    <div className="text-sm font-bold text-rose-600">
                      - PKR {Number(viewStudent.monthlyDiscount || 0).toLocaleString()}
                    </div>
                    {viewStudent.discountReason && (
                      <div className="text-[9px] text-slate-500 italic truncate" title={viewStudent.discountReason}>
                        {viewStudent.discountReason}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-800 font-semibold">Net Payable / Month</div>
                    <div className="text-sm font-black text-emerald-700">
                      PKR {Number(
                        viewStudent.netMonthlyFee ||
                        Math.max(0, (Number(viewStudent.monthlyFee) || 2500) - (Number(viewStudent.monthlyDiscount) || 0))
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT STUDENT */}
      {editStudent && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="bg-[#041633] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Edit Student: {editStudent.fullName}</h3>
              </div>
              <button onClick={() => setEditStudent(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 text-xs">
              {/* Photo Upload & Preview Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border-2 border-slate-300 shadow-2xs shrink-0 flex items-center justify-center">
                  {editPhotoPreview ? (
                    <img src={editPhotoPreview} alt="Student" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <User className="w-6 h-6" />
                      <span className="text-[8px] font-bold mt-0.5">No Photo</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-bold text-slate-800 text-xs">Student Photograph</div>
                  <div className="text-[10px] text-slate-500">
                    Upload or change passport-size photo (JPEG, PNG, WebP).
                  </div>
                  <div className="pt-1 flex items-center gap-2">
                    <label className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs transition">
                      <Camera className="w-3 h-3 text-amber-600" />
                      <span>{editPhotoPreview ? 'Change Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files[0];
                          if (f) {
                            if (f.size > 10 * 1024 * 1024) {
                              setToast({ type: 'error', message: 'Photo size must be less than 10MB.' });
                              return;
                            }
                            setEditPhotoFile(f);
                            setEditPhotoPreview(URL.createObjectURL(f));
                          }
                        }}
                      />
                    </label>
                    {editPhotoFile && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3" /> New photo selected ({(editPhotoFile.size / 1024).toFixed(0)} KB)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editStudent.fullName}
                    onChange={(e) => setEditStudent({ ...editStudent, fullName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Roll Number</label>
                  <input
                    type="text"
                    required
                    value={editStudent.rollNumber}
                    onChange={(e) => setEditStudent({ ...editStudent, rollNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold font-mono focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Class</label>
                  <select
                    value={editStudent.className}
                    onChange={(e) => {
                      const newCls = e.target.value;
                      const secs = getSectionsForClass(newCls);
                      setEditStudent({
                        ...editStudent,
                        className: newCls,
                        section: secs[0] || 'A',
                      });
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    {classNames.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Section</label>
                  <select
                    value={editStudent.section}
                    onChange={(e) => setEditStudent({ ...editStudent, section: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    {getSectionsForClass(editStudent.className).map((s) => (
                      <option key={s} value={s}>Section {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Father's Name</label>
                  <input
                    type="text"
                    required
                    value={editStudent.fatherName}
                    onChange={(e) => setEditStudent({ ...editStudent, fatherName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Father's Mobile</label>
                  <input
                    type="tel"
                    required
                    value={editStudent.fatherPhone}
                    onChange={(e) => setEditStudent({ ...editStudent, fatherPhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={editStudent.address}
                    onChange={(e) => setEditStudent({ ...editStudent, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly Tuition Fee (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={editStudent.monthlyFee !== undefined ? editStudent.monthlyFee : 2500}
                    onChange={(e) => setEditStudent({ ...editStudent, monthlyFee: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly Discount (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={editStudent.monthlyDiscount || 0}
                    onChange={(e) => setEditStudent({ ...editStudent, monthlyDiscount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-rose-600"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Discount Reason</label>
                  <input
                    type="text"
                    value={editStudent.discountReason || ''}
                    onChange={(e) => setEditStudent({ ...editStudent, discountReason: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditStudent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 bg-[#ffa000] hover:bg-amber-500 text-slate-950 rounded-lg font-black shadow"
                >
                  {editLoading ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
