import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { SYSTEM_MODULES, ALL_SUBMODULE_KEYS, ROLE_PRESETS } from '../../constants/moduleCatalog';
import {
  Building2,
  Plus,
  Users,
  GraduationCap,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  KeyRound,
  ExternalLink,
  Search,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  UserPlus,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  Lock,
  Edit2,
  Trash2,
  User,
  ArrowRight,
  Upload,
  Camera,
  Image,
  X,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import SchoolLogo from '../common/SchoolLogo';

const getModuleIcon = (iconName) => {
  if (typeof iconName === 'string' && LucideIcons[iconName]) {
    return LucideIcons[iconName];
  }
  return Layers;
};

export default function DeveloperSchoolManager() {
  const { switchSchoolContext, user: loggedInUser, socket } = useAuth();
  const navigate = useNavigate();

  // State: Schools list & loading
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null); // When managing users of a school
  const [showUsersModal, setShowUsersModal] = useState(false);

  // School Users state
  const [schoolUsers, setSchoolUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModalMode, setUserModalMode] = useState('LIST'); // 'LIST' | 'CREATE' | 'EDIT'
  const [editingUserId, setEditingUserId] = useState(null);

  // New School Form state
  const [newSchoolData, setNewSchoolData] = useState({
    schoolName: '',
    schoolCode: '',
    tagline: 'Excellence in Education & Character Building',
    address: '',
    phone: '',
    email: '',
    affiliation: 'Affiliated with Board of Education',
    activeSession: '2025-2026',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    logoUrl: '',
  });
  const [registering, setRegistering] = useState(false);

  // User Create / Edit Form state
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'CUSTOM',
    permissions: [], // Array of individual submodule IDs
  });
  const [savingUser, setSavingUser] = useState(false);

  // Expanded module accordions in permissions selector
  const [expandedModules, setExpandedModules] = useState(() => {
    // Expand all by default for visibility
    const acc = {};
    SYSTEM_MODULES.forEach((m) => {
      acc[m.id] = true;
    });
    return acc;
  });

  // Fetch all schools on mount & listen to real-time socket events
  useEffect(() => {
    fetchSchools();

    if (socket) {
      const handleAllSchoolsUpdated = () => {
        fetchSchools();
      };
      const handleSchoolUsersUpdated = (data) => {
        if (selectedSchool && data?.schoolCode === selectedSchool.schoolCode) {
          fetchSchoolUsers(selectedSchool.schoolCode);
        }
      };

      socket.on('all_schools_updated', handleAllSchoolsUpdated);
      socket.on('school_users_updated', handleSchoolUsersUpdated);

      return () => {
        socket.off('all_schools_updated', handleAllSchoolsUpdated);
        socket.off('school_users_updated', handleSchoolUsersUpdated);
      };
    }
  }, [socket, selectedSchool?.schoolCode]);

  const fetchSchools = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/auth/developer/schools');
      if (res.data?.success) {
        setSchools(res.data.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load registered schools.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle school active/suspended status
  const handleToggleStatus = async (schoolCode, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await api.patch(`/auth/developer/schools/${schoolCode}/status`, {
        status: newStatus,
      });
      if (res.data?.success) {
        setSchools((prev) =>
          prev.map((s) => (s.schoolCode === schoolCode ? { ...s, status: newStatus } : s))
        );
        setSuccessMsg(`School [${schoolCode}] status updated to ${newStatus}.`);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle school status.');
    }
  };

  // Developer switches active school context and enters portal
  const handleEnterSchool = (school) => {
    switchSchoolContext(school.schoolCode, school.schoolName);
    navigate('/dashboard');
  };

  // Open Manage Users Modal for a school
  const handleOpenUsersModal = async (school) => {
    setSelectedSchool(school);
    setShowUsersModal(true);
    setUserModalMode('LIST');
    fetchSchoolUsers(school.schoolCode);
  };

  const fetchSchoolUsers = async (schoolCode) => {
    try {
      setLoadingUsers(true);
      const res = await api.get(`/auth/developer/schools/${schoolCode}/users`);
      if (res.data?.success) {
        setSchoolUsers(res.data.data || []);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load school users.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setNewSchoolData((prev) => ({ ...prev, logoUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // Handle Register School Submit
  const handleRegisterSchoolSubmit = async (e) => {
    e.preventDefault();
    try {
      setRegistering(true);
      const res = await api.post('/auth/developer/register-school', newSchoolData);
      if (res.data?.success) {
        setSuccessMsg(`School "${newSchoolData.schoolName}" successfully provisioned with all default modules!`);
        setShowRegisterModal(false);
        setNewSchoolData({
          schoolName: '',
          schoolCode: '',
          tagline: 'Excellence in Education & Character Building',
          address: '',
          phone: '',
          email: '',
          affiliation: 'Affiliated with Board of Education',
          activeSession: '2025-2026',
          adminName: '',
          adminEmail: '',
          adminPassword: '',
          logoUrl: '',
        });
        fetchSchools();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register school.');
    } finally {
      setRegistering(false);
    }
  };

  // Open Create User Form
  const handleStartCreateUser = () => {
    setUserFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'CUSTOM',
      permissions: [],
    });
    setEditingUserId(null);
    setUserModalMode('CREATE');
  };

  // Open Edit User Form
  const handleStartEditUser = (u) => {
    setEditingUserId(u._id);
    setUserFormData({
      name: u.name,
      email: u.email,
      password: '', // Blank unless changing
      phone: u.phone || '',
      role: u.role || 'CUSTOM',
      permissions: Array.isArray(u.permissions) ? [...u.permissions] : [],
    });
    setUserModalMode('EDIT');
  };

  // Apply Role Preset to sub-module selections
  const handleApplyPreset = (presetKey) => {
    if (presetKey === 'ADMIN') {
      setUserFormData((prev) => ({
        ...prev,
        role: 'ADMIN',
        permissions: [...ALL_SUBMODULE_KEYS],
      }));
    } else if (presetKey === 'CLEAR') {
      setUserFormData((prev) => ({
        ...prev,
        role: 'CUSTOM',
        permissions: [],
      }));
    } else if (ROLE_PRESETS[presetKey]) {
      setUserFormData((prev) => ({
        ...prev,
        role: presetKey,
        permissions: [...ROLE_PRESETS[presetKey]],
      }));
    }
  };

  // Toggle a single sub-module right
  const handleToggleSubmodule = (submoduleId) => {
    setUserFormData((prev) => {
      const current = prev.permissions || [];
      const has = current.includes(submoduleId);
      const nextPermissions = has
        ? current.filter((id) => id !== submoduleId)
        : [...current, submoduleId];
      return {
        ...prev,
        permissions: nextPermissions,
      };
    });
  };

  // Toggle an entire parent module's submodules
  const handleToggleParentModule = (moduleId) => {
    const parent = SYSTEM_MODULES.find((m) => m.id === moduleId);
    if (!parent) return;

    const subIds = parent.submodules.map((s) => s.id);
    const current = userFormData.permissions || [];
    const allSelected = subIds.every((id) => current.includes(id));

    setUserFormData((prev) => {
      let nextPermissions;
      if (allSelected) {
        // Remove all submodules of this parent
        nextPermissions = current.filter((id) => !subIds.includes(id));
      } else {
        // Add all missing submodules of this parent
        const missing = subIds.filter((id) => !current.includes(id));
        nextPermissions = [...current, ...missing];
      }
      return {
        ...prev,
        permissions: nextPermissions,
      };
    });
  };

  // Save (Create or Update) User
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userFormData.name || !userFormData.email) {
      alert('Please enter Name and Email.');
      return;
    }

    try {
      setSavingUser(true);
      if (userModalMode === 'CREATE') {
        if (!userFormData.password) {
          alert('Password is required for new users.');
          setSavingUser(false);
          return;
        }

        const res = await api.post(`/auth/developer/schools/${selectedSchool.schoolCode}/users`, {
          ...userFormData,
        });

        if (res.data?.success) {
          alert(`User "${userFormData.name}" created with ${userFormData.permissions.length} submodule permissions!`);
          fetchSchoolUsers(selectedSchool.schoolCode);
          setUserModalMode('LIST');
        }
      } else if (userModalMode === 'EDIT') {
        const payload = {
          name: userFormData.name,
          phone: userFormData.phone,
          role: userFormData.role,
          permissions: userFormData.permissions,
        };
        if (userFormData.password && userFormData.password.trim().length >= 6) {
          payload.password = userFormData.password.trim();
        }

        const res = await api.put(`/auth/developer/users/${editingUserId}`, payload);
        if (res.data?.success) {
          alert(`User "${userFormData.name}" permissions updated!`);
          fetchSchoolUsers(selectedSchool.schoolCode);
          setUserModalMode('LIST');
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save user.');
    } finally {
      setSavingUser(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.name}" (${user.email})?`)) {
      return;
    }

    try {
      const res = await api.delete(`/auth/developer/users/${user._id}`);
      if (res.data?.success) {
        fetchSchoolUsers(selectedSchool.schoolCode);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  // Filtered Schools by search query
  const filteredSchools = schools.filter(
    (s) =>
      s.schoolName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.schoolCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 select-none font-sans">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-[#041633] via-[#09224f] to-[#041633] text-white p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <span className="text-xs uppercase tracking-widest font-bold text-amber-400">
              Developer SaaS Command Center
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            School Tenants & Granular Permissions Hub
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Register client schools, configure sub-module access rights for school staff (Accountants, Cashiers, Admins), and manage multi-tenant activations.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-xl text-xs tracking-wide shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Register New School</span>
          </button>

          <button
            onClick={fetchSchools}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
            title="Refresh schools list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* 2. Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{schools.length}</div>
            <div className="text-xs text-slate-500 font-medium">Registered Schools</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-700">
              {schools.filter((s) => s.status !== 'SUSPENDED').length}
            </div>
            <div className="text-xs text-slate-500 font-medium">Active Tenants</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-blue-900">
              {schools.reduce((acc, s) => acc + (s.studentCount || 0), 0)}
            </div>
            <div className="text-xs text-slate-500 font-medium">Total Students Enrolled</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-purple-900">
              {schools.reduce((acc, s) => acc + (s.usersCount || 0), 0)}
            </div>
            <div className="text-xs text-slate-500 font-medium">Authorized Users & Staff</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search school name, code (e.g. SCH-101), or address..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white transition"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filteredSchools.length}</strong> of <strong>{schools.length}</strong> schools
        </div>
      </div>

      {/* 4. Schools Grid */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500 font-medium">Loading school tenant directory...</p>
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Schools Found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {searchQuery ? 'No schools matched your search criteria.' : 'No client schools registered yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredSchools.map((sch) => {
            const isSuspended = sch.status === 'SUSPENDED';

            return (
              <div
                key={sch._id || sch.schoolCode}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${
                  isSuspended ? 'border-red-200 bg-red-50/20' : 'border-slate-200'
                }`}
              >
                {/* School Card Header */}
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <SchoolLogo
                        logoUrl={sch.logoUrl}
                        schoolName={sch.schoolName}
                        schoolCode={sch.schoolCode}
                        size="lg"
                        className="shadow-sm shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-black text-slate-900 leading-tight">
                            {sch.schoolName}
                          </h3>
                          <span className="px-2 py-0.5 bg-[#041633] text-[#ffa000] text-[10px] font-black rounded font-mono tracking-wider shadow-xs">
                            {sch.schoolCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 italic">
                          "{sch.tagline || 'Excellence in Education'}"
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 flex-wrap">
                          {sch.address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {sch.address}
                            </span>
                          )}
                          {sch.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {sch.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Toggle */}
                    <button
                      onClick={() => handleToggleStatus(sch.schoolCode, sch.status)}
                      title={`Click to ${isSuspended ? 'Activate' : 'Suspend'} this school`}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 border ${
                        isSuspended
                          ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSuspended ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                      ></span>
                      <span>{sch.status || 'ACTIVE'}</span>
                    </button>
                  </div>
                </div>

                {/* Metrics counts */}
                <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Students</div>
                    <div className="text-sm font-black text-slate-800">{sch.studentCount || 0}</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Faculty / Staff</div>
                    <div className="text-sm font-black text-slate-800">{sch.staffCount || 0}</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">System Users</div>
                    <div className="text-sm font-black text-slate-800">{sch.usersCount || 0}</div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-4 bg-white flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleOpenUsersModal(sch)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    <span>Manage Users & Sub-module Rights</span>
                  </button>

                  <button
                    onClick={() => handleEnterSchool(sch)}
                    className="py-2 px-3.5 bg-[#041633] hover:bg-[#072454] text-[#ffa000] font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Developer Quick-Switch to this School Portal"
                  >
                    <span>Test School</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: REGISTER NEW SCHOOL & PROVISION */}
      {/* ========================================================================= */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#041633] to-[#072454] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-[#ffa000] rounded-xl border border-amber-500/30">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Register & Provision New School</h3>
                  <p className="text-[11px] text-slate-300">
                    Creates School Tenant & Seeds Classes (Nursery–10), Exam Terms & Expenses
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleRegisterSchoolSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Developer Automatic Day-1 Provisioning:</strong> This will automatically seed 12 Academic Classes (Nursery through Class 10 with Section A), standard 3 Exam Terms (1st Term, Mid Term, Final Term), and default expense categories.
                </div>
              </div>

              {/* School Logo / Campus Picture Upload */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-amber-600" />
                  <span>School Logo / Campus Picture</span>
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Image Preview Box */}
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-inner relative group">
                    {newSchoolData.logoUrl ? (
                      <>
                        <img
                          src={newSchoolData.logoUrl}
                          alt="School Logo Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setNewSchoolData({ ...newSchoolData, logoUrl: '' })}
                          className="absolute inset-0 bg-slate-950/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          title="Remove Photo"
                        >
                          <X className="w-5 h-5 text-red-400" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <Image className="w-7 h-7 mx-auto stroke-1" />
                        <span className="text-[9px] font-bold block mt-0.5">No Logo</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="px-3.5 py-1.5 bg-[#041633] hover:bg-[#072454] text-[#ffa000] text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo File (PNG / JPG)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="sr-only"
                        />
                      </label>
                      {newSchoolData.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setNewSchoolData({ ...newSchoolData, logoUrl: '' })}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="url"
                        placeholder="Or paste image URL (e.g. https://.../logo.png)"
                        value={newSchoolData.logoUrl?.startsWith('data:') ? '' : newSchoolData.logoUrl || ''}
                        onChange={(e) => setNewSchoolData({ ...newSchoolData, logoUrl: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Recommended: 250x250px transparent PNG or JPG logo. Will appear on school portal banner, ID cards, and fee vouchers.
                    </p>
                  </div>
                </div>
              </div>

              {/* School Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    School Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Beaconhouse School System"
                    value={newSchoolData.schoolName}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, schoolName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    School Code (Tenant ID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BSS-01, APS-02, SCH-200"
                    value={newSchoolData.schoolCode}
                    onChange={(e) =>
                      setNewSchoolData({ ...newSchoolData, schoolCode: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Campus Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Sector H-8, Islamabad"
                    value={newSchoolData.address}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Campus Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +92 51 9283741"
                    value={newSchoolData.phone}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Affiliation / Board</label>
                  <input
                    type="text"
                    placeholder="e.g. Federal Board (FBISE) / Cambridge"
                    value={newSchoolData.affiliation}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, affiliation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Active Session</label>
                  <input
                    type="text"
                    placeholder="2025-2026"
                    value={newSchoolData.activeSession}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, activeSession: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white"
                  />
                </div>
              </div>

              {/* Primary Admin Credentials */}
              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold text-[#041633] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span>Primary School Administrator (Principal Account)</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Admin Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Tariq Mehmood"
                      value={newSchoolData.adminName}
                      onChange={(e) => setNewSchoolData({ ...newSchoolData, adminName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Admin Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. principal@bss.edu.pk"
                      value={newSchoolData.adminEmail}
                      onChange={(e) => setNewSchoolData({ ...newSchoolData, adminEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Admin Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={newSchoolData.adminPassword}
                      onChange={(e) => setNewSchoolData({ ...newSchoolData, adminPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {registering ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Provisioning School...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Provision School Tenant</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: MANAGE SCHOOL USERS & GRANULAR SUB-MODULE RIGHTS */}
      {/* ========================================================================= */}
      {showUsersModal && selectedSchool && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6 animate-in fade-in duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#041633] via-[#09224f] to-[#041633] text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-[#ffa000] rounded-xl border border-amber-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      User Accounts & Sub-Module Access Rights
                    </h3>
                    <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded font-mono">
                      {selectedSchool.schoolCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Tenant: <strong>{selectedSchool.schoolName}</strong> • Configure granular rights for each staff member
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {userModalMode !== 'LIST' ? (
                  <button
                    onClick={() => setUserModalMode('LIST')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    ← Back to Users List
                  </button>
                ) : (
                  <button
                    onClick={handleStartCreateUser}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Create New User</span>
                  </button>
                )}
                <button
                  onClick={() => setShowUsersModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* MODE 1: LIST USERS */}
              {userModalMode === 'LIST' && (
                <div className="space-y-4">
                  {loadingUsers ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Loading users for {selectedSchool.schoolName}...
                    </div>
                  ) : schoolUsers.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <div className="text-xs font-bold text-slate-700">No Users Found</div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Click "Create New User" to assign login rights for this school.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {schoolUsers.map((u) => {
                        const totalAllowed =
                          u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'
                            ? ALL_SUBMODULE_KEYS.length
                            : (u.permissions || []).length;

                        return (
                          <div
                            key={u._id}
                            className="p-4 bg-white hover:bg-slate-50/80 transition flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-slate-900 text-[#ffa000] font-black flex items-center justify-center text-xs shadow-inner">
                                {u.name?.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900">{u.name}</span>
                                  <span
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                      u.role === 'ADMIN'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : u.role === 'ACCOUNTANT'
                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        : 'bg-blue-100 text-blue-900 border border-blue-300'
                                    }`}
                                  >
                                    {u.role}
                                  </span>
                                  {!u.isActive && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                                  <span>{u.email}</span>
                                  {u.phone && <span>• {u.phone}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Rights Counter & Actions */}
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-xs font-black text-slate-800">
                                  {totalAllowed} / {ALL_SUBMODULE_KEYS.length}
                                </div>
                                <div className="text-[10px] text-slate-400">Sub-modules Allowed</div>
                              </div>

                              <button
                                onClick={() => handleStartEditUser(u)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                                title="Edit User & Permissions"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {u.role !== 'SUPER_ADMIN' && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition cursor-pointer"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* MODE 2 & 3: CREATE OR EDIT USER WITH GRANULAR SUB-MODULE CHECKBOXES */}
              {(userModalMode === 'CREATE' || userModalMode === 'EDIT') && (
                <form onSubmit={handleSaveUser} className="space-y-6">
                  {/* Basic User Information */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-amber-600" />
                      <span>User Account Credentials</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Kashif Ali"
                          value={userFormData.name}
                          onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          disabled={userModalMode === 'EDIT'} // Keep email stable on edit
                          placeholder="e.g. kashif.acc@bss.edu.pk"
                          value={userFormData.email}
                          onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:bg-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Password {userModalMode === 'EDIT' ? '(Leave blank to keep)' : <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="password"
                          required={userModalMode === 'CREATE'}
                          placeholder="••••••••"
                          value={userFormData.password}
                          onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Role Presets Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>1-Click Role Presets</span>
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Clicking a preset automatically selects default sub-modules. You can still toggle any checkbox below!
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('ADMIN')}
                        className="px-3 py-1.5 bg-[#041633] text-[#ffa000] hover:bg-[#072454] rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        ★ Full Administrator (All 33)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('ACCOUNTANT')}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        💼 Accountant Preset (8 Sub-modules)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('CASHIER')}
                        className="px-3 py-1.5 bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        💵 Cashier Preset (Fee Counter only)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('ADMISSION_OFFICER')}
                        className="px-3 py-1.5 bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        📝 Admission Officer Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('EXAM_INCHARGE')}
                        className="px-3 py-1.5 bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        🏆 Exam Incharge Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('TEACHER')}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        📚 Teacher Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('CLEAR')}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        ✕ Clear All
                      </button>
                    </div>
                  </div>

                  {/* Total Selected Counter */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div className="text-xs font-bold text-amber-950 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-600" />
                      <span>Active Sub-module Permissions Selected:</span>
                    </div>
                    <div className="text-sm font-black text-amber-900 bg-amber-200/60 px-3 py-0.5 rounded-full font-mono">
                      {userFormData.permissions?.length || 0} / {ALL_SUBMODULE_KEYS.length}
                    </div>
                  </div>

                  {/* ========================================================= */}
                  {/* GRANULAR SUB-MODULE SELECTION ACCORDIONS & CHECKBOXES */}
                  {/* ========================================================= */}
                  <div className="space-y-3">
                    {SYSTEM_MODULES.map((parent) => {
                      const isExpanded = !!expandedModules[parent.id];
                      const subIds = parent.submodules.map((s) => s.id);
                      const currentSelectedCount = subIds.filter((id) =>
                        userFormData.permissions?.includes(id)
                      ).length;
                      const allInParentSelected =
                        subIds.length > 0 && currentSelectedCount === subIds.length;

                      return (
                        <div
                          key={parent.id}
                          className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs"
                        >
                          {/* Module Header with Quick Select Toggle */}
                          <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3">
                            <div
                              onClick={() =>
                                setExpandedModules((prev) => ({
                                  ...prev,
                                  [parent.id]: !prev[parent.id],
                                }))
                              }
                              className="flex items-center gap-2.5 cursor-pointer flex-1"
                            >
                              {(() => {
                                const ModIcon = getModuleIcon(parent.icon);
                                return (
                                  <div className="p-1.5 bg-white text-slate-700 rounded-lg border border-slate-200 shadow-xs">
                                    <ModIcon className="w-4 h-4 text-amber-600" />
                                  </div>
                                );
                              })()}
                              <div>
                                <span className="text-xs font-bold text-slate-900">{parent.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono ml-2">
                                  ({parent.id})
                                </span>
                              </div>
                            </div>

                            {/* Parent Module Actions */}
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  currentSelectedCount === 0
                                    ? 'bg-slate-200 text-slate-600'
                                    : allInParentSelected
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {currentSelectedCount} / {subIds.length} Granted
                              </span>

                              <button
                                type="button"
                                onClick={() => handleToggleParentModule(parent.id)}
                                className="text-[11px] px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold transition cursor-pointer"
                              >
                                {allInParentSelected ? 'Deselect Module' : 'Select All in Module'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedModules((prev) => ({
                                    ...prev,
                                    [parent.id]: !prev[parent.id],
                                  }))
                                }
                                className="p-1 text-slate-400 hover:text-slate-600"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Individual Sub-module Checkboxes */}
                          {isExpanded && (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-white">
                              {parent.submodules.map((sub) => {
                                const isChecked = userFormData.permissions?.includes(sub.id);

                                return (
                                  <label
                                    key={sub.id}
                                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                                      isChecked
                                        ? 'bg-amber-50/70 border-amber-300 text-slate-900 shadow-xs'
                                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleSubmodule(sub.id)}
                                      className="sr-only"
                                    />
                                    <div className="mt-0.5 shrink-0">
                                      {isChecked ? (
                                        <CheckSquare className="w-4 h-4 text-amber-600" />
                                      ) : (
                                        <Square className="w-4 h-4 text-slate-400" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold leading-tight line-clamp-1">
                                        {sub.name}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                        {sub.id}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Form Actions Footer */}
                  <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-3">
                    <button
                      type="button"
                      onClick={() => setUserModalMode('LIST')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingUser}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingUser ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                          <span>Saving Rights...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            {userModalMode === 'CREATE'
                              ? 'Create User & Assign Sub-modules'
                              : 'Save Updated Rights'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
