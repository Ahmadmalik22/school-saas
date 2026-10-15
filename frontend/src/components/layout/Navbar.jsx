import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  User,
  School,
  Calendar,
  LogOut,
  ShieldCheck,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes/appRoutes';
import SchoolBrandingModal from '../common/SchoolBrandingModal';

export default function Navbar({
  schoolCode,
  setSchoolCode,
  activeSubModule,
  sidebarOpen,
  setSidebarOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
}) {
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
    if (path === ROUTES.DEVELOPER_SCHOOLS) return 'Developer SaaS Hub';
    if (path === '/academic/sessions' || activeSubModule === 'academic_sessions') return 'Academic Sessions';
    if (path === '/classes/manage' || activeSubModule === 'manage_classes') return 'Manage Classes';
    if (path === '/classes/sections' || activeSubModule === 'manage_sections') return 'Manage Sections';
    if (path === '/admissions/admit' || activeSubModule === 'admit_student') return 'Admit Student';
    if (path === '/admissions/bulk' || activeSubModule === 'admit_bulk') return 'Admit Bulk (Excel)';
    if (path === '/admissions/inquiries' || activeSubModule === 'inquiries') return 'Inquiries';
    if (path === '/admissions/print-slip' || activeSubModule === 'print_form') return 'Print Admission Slips';
    if (path === '/students/directory' || activeSubModule === 'student_info') return 'Student Directory';
    if (path === '/students/promotion' || activeSubModule === 'student_promotion') return 'Student Promotion';
    if (path === '/students/id-cards' || activeSubModule === 'generate_id_card') return 'Student ID Cards Generator';
    if (path === '/staff/add' || activeSubModule === 'add_staff') return 'Register Staff';
    if (path === '/staff/directory' || activeSubModule === 'staff_directory') return 'Staff Directory';
    if (path === '/attendance/student' || activeSubModule === 'student_attendance') return 'Student Attendance';
    if (path === '/attendance/student-register' || activeSubModule === 'student_attendance_register') return 'Student Register';
    if (path === '/attendance/staff' || activeSubModule === 'staff_attendance') return 'Staff Attendance';
    if (path === '/attendance/staff-register' || activeSubModule === 'staff_attendance_register') return 'Staff Register';
    if (path === '/attendance/qr-scanner' || activeSubModule === 'qr_scanner') return 'QR Attendance Scanner';
    if (path === '/financials/fee-generation' || activeSubModule === 'student_fee_generation') return 'Fee Generation';
    if (path === '/financials/fee-management' || activeSubModule === 'student_fee_management') return 'Fee Cash Counter';
    if (path === '/financials/family-voucher' || activeSubModule === 'family_fee_voucher') return 'Family Voucher';
    if (path === '/financials/staff-salary' || activeSubModule === 'staff_salary_generation') return 'Staff Salary';
    if (path === '/financials/print-vouchers' || activeSubModule === 'fee_vouchers_print') return 'Print Vouchers';
    if (path === '/financials/expenses' || activeSubModule === 'school_expenses') return 'School Expenses';
    if (path === '/exams/terms' || activeSubModule === 'exam_terms') return 'Exam Terms';
    if (path === '/exams/subjects' || activeSubModule === 'exam_subjects') return 'Class Subjects';
    if (path === '/exams/marks-entry' || activeSubModule === 'exam_marks_entry') return 'Marks Entry';
    if (path === '/exams/report-cards' || activeSubModule === 'exam_report_cards') return 'Report Cards';
    if (path.startsWith('/reports') || activeSubModule?.startsWith('reports')) return 'Reports Center';
    return 'School Dashboard';
  };

  const handleToggle = () => {
    if (setSidebarOpen) setSidebarOpen(!sidebarOpen);
  };

  const effectiveSchoolName = schoolProfile?.schoolName || schoolName || 'School Management Portal';

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-5 lg:px-6 flex items-center justify-between select-none shrink-0 shadow-xs z-30">
      {/* Left: Sidebar Toggle Hamburger (Mobile Only) & Active Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={handleToggle}
          className="lg:hidden p-1.5 sm:p-2 -ml-1 sm:-ml-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition cursor-pointer shrink-0"
          title="Open Navigation Menu"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5 text-slate-800" />
        </button>

        <div className="w-1 h-6 sm:h-7 bg-gradient-to-b from-[#ffa000] to-amber-600 rounded-full shrink-0"></div>

        <div className="min-w-0 flex-1">
          <h1 className="text-xs sm:text-sm lg:text-base font-black text-slate-900 tracking-tight truncate leading-tight">
            {getSubModuleTitle()}
          </h1>
          <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 truncate mt-0.5 leading-tight">
            <span className="text-slate-600 font-semibold truncate max-w-[130px] sm:max-w-xs">
              {effectiveSchoolName}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-amber-600 font-bold">{currentSession || schoolCode}</span>
          </div>
        </div>
      </div>

      {/* Right: Actions, Academic Session, School ID Badge & User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Developer Portal Quick Link (Super Admin only) */}
        {isSuperAdmin && path !== ROUTES.DEVELOPER_SCHOOLS && (
          <button
            onClick={() => navigate(ROUTES.DEVELOPER_SCHOOLS)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Developer Hub</span>
          </button>
        )}

        {/* Global Academic Session Switcher (Hidden on mobile < sm, visible on tablets/desktops) */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs transition shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-slate-500 font-medium hidden md:inline">Session:</span>
          <select
            value={currentSession}
            onChange={(e) => switchSession(e.target.value)}
            className="bg-transparent font-bold text-slate-900 text-xs focus:outline-none cursor-pointer max-w-[90px] sm:max-w-none truncate"
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
            className="text-[9px] sm:text-[10px] bg-white hover:bg-amber-100 text-amber-900 font-bold px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200 transition cursor-pointer shadow-2xs hidden md:inline-block"
            title="Define New Academic Session or Manage Calendar"
          >
            Manage
          </button>
        </div>

        {/* Official School ID Badge (Hidden on mobile < md, visible on desktops) */}
        <div
          className="hidden md:flex items-center gap-1.5 bg-[#041633] text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-800 shadow-xs select-none"
          title={`Institutional School Code: ${schoolCode || 'SCH-101'} (Active & Verified)`}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></div>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider hidden lg:inline">
            School ID:
          </span>
          <span className="text-[11px] sm:text-xs font-mono font-black text-[#ffa000] tracking-wider">
            {schoolCode || 'SCH-101'}
          </span>
        </div>

        {/* School Branding Customizer (Hidden on mobile < sm) */}
        {(isAdmin || isSuperAdmin) && (
          <button
            onClick={() => setShowBrandingModal(true)}
            className="hidden sm:flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
            title="School Logo & Official Branding Settings"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="hidden sm:inline">Branding</span>
          </button>
        )}

        {/* User Profile Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 border-l border-slate-200 pl-2 sm:pl-3">
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-[#041633] to-[#0a2555] text-amber-400 font-black flex items-center justify-center text-xs shadow-xs border border-amber-500/20 shrink-0"
            title={user?.name || 'Administrator'}
          >
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
          </div>
          <div className="hidden xl:block text-left">
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
            className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
            title="Sign Out of Portal"
            aria-label="Logout"
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
