import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
  Users, Search, Filter, Eye, Edit3, Trash2,
  ChevronLeft, ChevronRight, X, CheckCircle, AlertCircle,
  Briefcase, Phone, Mail, MapPin, DollarSign, BookOpen
} from 'lucide-react';

export default function StaffDirectory({ schoolCode }) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    totalStaff: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Modal States
  const [viewStaff, setViewStaff] = useState(null);
  const [editStaff, setEditStaff] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff', {
        params: {
          schoolCode,
          role: selectedRole,
          department: selectedDepartment,
          status: statusFilter,
          search,
          page,
          limit: 10,
        },
      });

      if (res.data.success) {
        setStaffList(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [schoolCode, selectedRole, selectedDepartment, statusFilter, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchStaff();
  };

  const handleToggleStatus = async (staff) => {
    const nextStatus = staff.status === 'ACTIVE' ? 'ON_LEAVE' : 'ACTIVE';
    try {
      const res = await api.patch(`/staff/${staff._id}/status`, { status: nextStatus });
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setStaffList((prev) =>
          prev.map((s) => (s._id === staff._id ? { ...s, status: nextStatus } : s))
        );
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to update staff status.' });
    }
  };

  const handleDeleteStaff = async (staff) => {
    if (!window.confirm(`Are you sure you want to delete ${staff.fullName} (${staff.employeeId})? This will also remove their photo from Cloudinary.`)) {
      return;
    }

    try {
      const res = await api.delete(`/staff/${staff._id}`);
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        fetchStaff();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to delete staff member.' });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);

    try {
      const res = await api.put(`/staff/${editStaff._id}`, editStaff);
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        setEditStaff(null);
        fetchStaff();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to update staff.' });
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-500" />
            <span>Staff & Teachers Directory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage faculty, administrative personnel, and support team members for <span className="font-bold text-slate-800">{schoolCode}</span>.
          </p>
        </div>

        <div className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-bold">
          Total Employees: {pagination.totalStaff}
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

      {/* Filters Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Role / Designation</label>
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
          >
            <option value="ALL">All Roles</option>
            <option value="Teacher">Teacher / Lecturer</option>
            <option value="Head Teacher / Vice Principal">Head Teacher / Vice Principal</option>
            <option value="Principal / Director">Principal / Director</option>
            <option value="Accountant">Accountant</option>
            <option value="Admin / Clerk">Admin / Clerk</option>
            <option value="Librarian">Librarian</option>
            <option value="Lab Assistant">Lab Assistant</option>
            <option value="Support Staff / Peon / Guard">Support Staff</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Department</label>
          <select
            value={selectedDepartment}
            onChange={(e) => {
              setSelectedDepartment(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
          >
            <option value="ALL">All Departments</option>
            <option value="Science">Science</option>
            <option value="Mathematics">Mathematics</option>
            <option value="English & Languages">English & Languages</option>
            <option value="Urdu & Islamiyat">Urdu & Islamiyat</option>
            <option value="Computer & IT">Computer & IT</option>
            <option value="Accounts & Finance">Accounts & Finance</option>
            <option value="Administration">Administration</option>
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
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="RESIGNED">Resigned</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Search Staff</label>
          <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
            <input
              type="text"
              placeholder="Name, ID, CNIC, Phone..."
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

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Staff Records ({pagination.totalStaff})
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
                <th className="p-3">Staff ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Role / Designation</th>
                <th className="p-3">Department</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Monthly Salary</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    {loading ? 'Fetching staff members...' : 'No staff members found matching filters.'}
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff._id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3">
                      {staff.photo?.url ? (
                        <img
                          src={staff.photo.url}
                          alt={staff.fullName}
                          className="w-9 h-9 rounded-full object-cover border border-amber-400 shadow-sm"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {staff.fullName.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800">{staff.employeeId}</td>
                    <td className="p-3 font-bold text-slate-900">{staff.fullName}</td>
                    <td className="p-3">
                      <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {staff.role}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-600">{staff.department}</td>
                    <td className="p-3 font-mono text-slate-800">{staff.phone}</td>
                    <td className="p-3 font-bold font-mono text-slate-900">
                      PKR {staff.basicSalary?.toLocaleString() || 0}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(staff)}
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider cursor-pointer ${
                          staff.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                        title="Click to toggle status"
                      >
                        {staff.status}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewStaff(staff)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setEditStaff(staff)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Edit Information"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteStaff(staff)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Staff"
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
            {pagination.totalStaff} staff members)
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

      {/* MODAL 1: VIEW STAFF PROFILE */}
      {viewStaff && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="bg-[#041633] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
                  {viewStaff.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{viewStaff.fullName}</h3>
                  <div className="text-[11px] text-slate-400">
                    ID: {viewStaff.employeeId} • {viewStaff.role} ({viewStaff.department})
                  </div>
                </div>
              </div>
              <button onClick={() => setViewStaff(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-100 pb-5">
                <div className="w-28 h-32 rounded-xl overflow-hidden bg-slate-100 border-2 border-amber-400 shadow-md shrink-0">
                  {viewStaff.photo?.url ? (
                    <img src={viewStaff.photo.url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">No Photo</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <div>
                    <span className="text-slate-400 block text-[10px]">CNIC No.</span>
                    <span className="font-mono font-bold text-slate-900">{viewStaff.cnic}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Mobile Phone</span>
                    <span className="font-mono font-bold text-slate-900">{viewStaff.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Qualification</span>
                    <span className="font-bold text-slate-900">{viewStaff.qualification}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Basic Salary</span>
                    <span className="font-mono font-black text-emerald-700">PKR {viewStaff.basicSalary?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Additional Employment & Contact Information */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Joining Date</span>
                  <span className="font-semibold text-slate-800">
                    {viewStaff.joiningDate ? new Date(viewStaff.joiningDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Experience</span>
                  <span className="font-semibold text-slate-800">{viewStaff.experienceYears || 0} Years</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Email Address</span>
                  <span className="font-semibold text-slate-800 truncate block">{viewStaff.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Emergency Contact</span>
                  <span className="font-semibold text-slate-800">{viewStaff.emergencyContact || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">City / Address</span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {viewStaff.city ? `${viewStaff.city} - ` : ''}{viewStaff.address || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Bank Account</span>
                  <span className="font-mono font-semibold text-slate-800 truncate block">{viewStaff.bankAccountNumber || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT STAFF */}
      {editStaff && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="bg-[#041633] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Edit Staff: {editStaff.fullName}</h3>
              </div>
              <button onClick={() => setEditStaff(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editStaff.fullName}
                    onChange={(e) => setEditStaff({ ...editStaff, fullName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={editStaff.phone}
                    onChange={(e) => setEditStaff({ ...editStaff, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role / Designation</label>
                  <select
                    value={editStaff.role}
                    onChange={(e) => setEditStaff({ ...editStaff, role: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    <option value="Teacher">Teacher</option>
                    <option value="Head Teacher / Vice Principal">Head Teacher / Vice Principal</option>
                    <option value="Principal / Director">Principal / Director</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Admin / Clerk">Admin / Clerk</option>
                    <option value="Support Staff / Peon / Guard">Support Staff</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={editStaff.department}
                    onChange={(e) => setEditStaff({ ...editStaff, department: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    <option value="Science">Science</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="English & Languages">English & Languages</option>
                    <option value="Urdu & Islamiyat">Urdu & Islamiyat</option>
                    <option value="Computer & IT">Computer & IT</option>
                    <option value="Accounts & Finance">Accounts & Finance</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Qualification</label>
                  <input
                    type="text"
                    required
                    value={editStaff.qualification}
                    onChange={(e) => setEditStaff({ ...editStaff, qualification: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Basic Salary (PKR)</label>
                  <input
                    type="number"
                    required
                    value={editStaff.basicSalary}
                    onChange={(e) => setEditStaff({ ...editStaff, basicSalary: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={editStaff.address}
                    onChange={(e) => setEditStaff({ ...editStaff, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditStaff(null)}
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
