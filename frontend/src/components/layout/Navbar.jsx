import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, User, School, Calendar, LogOut, ShieldCheck, ExternalLink, Sparkles } from 'lucide-react';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes/appRoutes';
import SchoolBrandingModal from '../common/SchoolBrandingModal';

export default function Navbar({ schoolCode, setSchoolCode, activeSubModule }) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const { currentSession, activeSession, sessions, switchSession } = useAcademicSession();
  const {
    user,
    isSuperAdmin,
    isAdmin,
    logout,
    schoolName,
    schoolProfile,
    schoolLogo,
    schoolTagline,
    schoolAddress,
  } = useAuth();

  const getSubModuleTitle = () => {
    if (path === ROUTES.DEVELOPER_SCHOOLS) return 'Developer SaaS Schools & Permissions Command Center';
    if (path === '/academic/sessions' || activeSubModule === 'academic_sessions') return 'Academic Sessions & Calendar Setup';
    if (path === '/classes/manage' || activeSubModule === 'manage_classes') return 'Manage Classes';
    if (path === '/classes/sections' || activeSubModule === 'manage_sections') return 'Manage Sections';
    if (path === '/admissions/admit' || activeSubModule === 'admit_student') return 'Admit Student (New Admission Form)';
    if (path === '/admissions/bulk' || activeSubModule === 'admit_bulk') return 'Admit Bulk (Upload Class via Excel)';
    if (path === '/admissions/inquiries' || activeSubModule === 'inquiries') return 'Admission Inquiries & 1-Click Convert';
    if (path === '/admissions/print-slip' || activeSubModule === 'print_form') return 'Print Student Admission Slips';
    if (path === '/students/directory' || activeSubModule === 'student_info') return 'Student Information & Profile Directory';
    if (path === '/students/promotion' || activeSubModule === 'student_promotion') return 'Annual Student Promotion (Class Transition)';
    if (path === '/staff/add' || activeSubModule === 'add_staff') return 'Staff & Teacher Registration';
    if (path === '/staff/directory' || activeSubModule === 'staff_directory') return 'Staff & Faculty Directory';
    if (path === '/attendance/student' || activeSubModule === 'student_attendance') return 'Manage Student Attendance';
    if (path === '/attendance/student-register' || activeSubModule === 'student_attendance_register') return 'Monthly Student Attendance Register';
    if (path === '/attendance/staff' || activeSubModule === 'staff_attendance') return 'Staff Daily Attendance Roster';
    if (path === '/attendance/staff-register' || activeSubModule === 'staff_attendance_register') return 'Monthly Staff Attendance & Payroll Register';
    if (path === '/financials/fee-generation' || activeSubModule === 'student_fee_generation') return 'Student Fee Generation & Billing';
    if (path === '/financials/fee-management' || activeSubModule === 'student_fee_management') return 'Student Fee Management & Cash Counter';
    if (path === '/financials/family-voucher' || activeSubModule === 'family_fee_voucher') return 'Family Sibling Consolidated Fee Voucher';
    if (path === '/financials/staff-salary' || activeSubModule === 'staff_salary_generation') return 'Staff Monthly Salary & Payroll';
    if (path === '/financials/print-vouchers' || activeSubModule === 'fee_vouchers_print') return 'Print 4-in-1 Fee Vouchers (A4 Dual Slips)';
    if (path === '/financials/expenses' || activeSubModule === 'school_expenses') return 'School Expense Management & Ledger';
    if (path === '/exams/terms' || activeSubModule === 'exam_terms') return 'Define School Exams';
    if (path === '/exams/subjects' || activeSubModule === 'exam_subjects') return 'Class Subjects & Curriculum Setup';
    if (path === '/exams/marks-entry' || activeSubModule === 'exam_marks_entry') return 'Spreadsheet Exam Marks Entry';
    if (path === '/exams/report-cards' || activeSubModule === 'exam_report_cards') return 'Print Report Cards & Consolidated Results';
    if (path.startsWith('/reports') || activeSubModule?.startsWith('reports')) return 'Reports & Analytics Center';
    return 'School Management Dashboard';
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'ACCOUNTANT':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      default:
        return 'bg-purple-100 text-purple-900 border-purple-300';
    }
  };

  const effectiveSchoolName = schoolProfile?.schoolName || schoolName || 'School Management Portal';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between select-none shrink-0 shadow-xs">
      {/* Left: Active Module / Page Title with subtle School Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-1.5 h-8 bg-gradient-to-b from-[#ffa000] to-amber-600 rounded-full shrink-0"></div>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2 truncate">
            <span className="truncate">{getSubModuleTitle()}</span>
          </h1>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
            <span className="text-slate-600 font-semibold truncate max-w-xs">{effectiveSchoolName}</span>
            <span className="text-slate-300">•</span>
            <span>Workspace</span>
          </div>
        </div>
      </div>

      {/* Right: Actions, Academic Session, Read-Only School ID Badge & User Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Developer Portal Quick Link (Super Admin only) */}
        {isSuperAdmin && path !== ROUTES.DEVELOPER_SCHOOLS && (
          <button
            onClick={() => navigate(ROUTES.DEVELOPER_SCHOOLS)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Developer Hub</span>
          </button>
        )}

        {/* Global Academic Session Switcher */}
        <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 px-3 py-1.5 rounded-xl text-xs transition shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-slate-500 font-medium hidden md:inline">Session:</span>
          <select
            value={currentSession}
            onChange={(e) => switchSession(e.target.value)}
            className="bg-transparent font-bold text-slate-900 text-xs focus:outline-none cursor-pointer"
            title="Global Working Academic Session"
          >
            {sessions.map((s) => (
              <option key={s._id} value={s.sessionName}>
                {s.sessionName} {s.sessionName === activeSession ? '★ Active' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => navigate('/academic/sessions')}
            className="text-[10px] bg-white hover:bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md border border-slate-200 transition cursor-pointer shadow-2xs"
            title="Define New Academic Session or Manage Calendar"
          >
            Manage
          </button>
        </div>

        {/* Official School ID Badge (Strictly Read-Only & Presentable) */}
        <div
          className="flex items-center gap-2 bg-[#041633] text-white px-3 py-1.5 rounded-xl border border-slate-800 shadow-xs select-none"
          title={`Institutional School Code: ${schoolCode || 'SCH-101'} (Active & Verified)`}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></div>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider hidden sm:inline">School ID:</span>
          <span className="text-xs font-mono font-black text-[#ffa000] tracking-wider">{schoolCode || 'SCH-101'}</span>
        </div>

        {/* School Branding Customizer (For School Admin & Super Admin) */}
        {(isAdmin || isSuperAdmin) && (
          <button
            onClick={() => setShowBrandingModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
            title="School Logo & Official Branding Settings"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="hidden sm:inline">Branding</span>
          </button>
        )}

        {/* User Profile Pill */}
        <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#041633] to-[#0a2555] text-amber-400 font-black flex items-center justify-center text-xs shadow-xs border border-amber-500/20">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-bold text-slate-800 leading-tight">
              {user?.name || 'Administrator'}
            </div>
            <div className="text-[10px] font-semibold text-slate-400 leading-tight mt-0.5">
              {user?.role === 'SUPER_ADMIN' ? 'Developer' : user?.role || 'Staff'}
            </div>
          </div>

          {/* Logout Action */}
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer ml-1"
            title="Sign Out of Portal"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* School Branding Modal */}
      <SchoolBrandingModal
        isOpen={showBrandingModal}
        onClose={() => setShowBrandingModal(false)}
      />
    </header>
  );
}
