import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import {
  GraduationCap,
  LayoutDashboard,
  UserPlus,
  Users,
  Briefcase,
  Clock,
  CreditCard,
  Award,
  FileText,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  School,
  LogOut,
  User,
  X,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { ROUTES } from '../../routes/appRoutes';
import { useAcademicSession } from '../../context/AcademicSessionContext';
import { useAuth } from '../../context/AuthContext';
import { SYSTEM_MODULES } from '../../constants/moduleCatalog';
import SchoolLogo from '../common/SchoolLogo';

// Fallback Module icon mapping
const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  academic: Layers,
  admissions: UserPlus,
  students: Users,
  staff: Briefcase,
  attendance: Clock,
  financials: CreditCard,
  exams: Award,
  reports: FileText,
  messaging: MessageSquare,
};

// Dynamic icon resolver: Supports any Lucide icon name string from moduleCatalog
const resolveModuleIcon = (iconName, moduleId) => {
  if (typeof iconName === 'string' && LucideIcons[iconName]) {
    return LucideIcons[iconName];
  }
  return MODULE_ICONS[moduleId] || Layers;
};

export default function Sidebar({
  activeSubModule,
  setActiveSubModule,
  schoolCode,
  isOpen = false,
  setIsOpen,
  isCollapsed = false,
  setIsCollapsed,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const { currentSession, activeSession, sessions = [], switchSession } = useAcademicSession();
  const {
    user,
    hasPermission,
    hasModule,
    isSuperAdmin,
    logout,
    schoolName,
    schoolProfile,
    schoolLogo,
  } = useAuth();

  // Accordion state: which parent module is open
  const [openAccordions, setOpenAccordions] = useState(() => {
    const initial = {};
    SYSTEM_MODULES.forEach((mod) => {
      const isMatch = mod.submodules.some(
        (sub) => currentPath === sub.route || currentPath.startsWith(sub.route + '/')
      );
      if (isMatch) initial[mod.id] = true;
    });
    return initial;
  });

  // Keep accordion open when navigating
  useEffect(() => {
    SYSTEM_MODULES.forEach((mod) => {
      const isMatch = mod.submodules.some(
        (sub) => currentPath === sub.route || currentPath.startsWith(sub.route + '/')
      );
      if (isMatch) {
        setOpenAccordions((prev) => ({ ...prev, [mod.id]: true }));
      }
    });
  }, [currentPath]);

  const toggleAccordion = (modId) => {
    // If collapsed on desktop and user clicks an accordion, expand sidebar first
    if (isCollapsed && setIsCollapsed) {
      setIsCollapsed(false);
      try {
        localStorage.setItem('sidebar_collapsed', 'false');
      } catch {}
      setOpenAccordions({ [modId]: true });
      return;
    }

    setOpenAccordions((prev) => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  };

  const handleNav = (routePath, legacyKey) => {
    navigate(routePath);
    if (setActiveSubModule) setActiveSubModule(legacyKey);
    // On mobile screens, automatically close drawer after navigation tap
    if (setIsOpen && window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  const isNavActive = (routePath, legacyKey) => {
    return (
      currentPath === routePath ||
      (routePath === ROUTES.DASHBOARD && currentPath === '/') ||
      activeSubModule === legacyKey
    );
  };

  const handleToggleCollapse = () => {
    if (setIsCollapsed) {
      const next = !isCollapsed;
      setIsCollapsed(next);
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {}
    }
  };

  const effectiveSchoolName = schoolProfile?.schoolName || schoolName || 'School System';
  const effectiveTagline = schoolProfile?.tagline || 'Official School Portal';
  const effectiveAddress = schoolProfile?.address || `Campus (${schoolCode || 'SYSTEM'})`;

  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-50
        bg-[#041633] text-slate-300 flex flex-col h-screen select-none shrink-0 border-r border-slate-800
        transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'lg:w-20' : 'w-72 lg:w-64'}
      `}
    >
      {/* 1. Top School Brand Header */}
      <div className="h-16 bg-gradient-to-r from-[#ffa000] via-[#ffb300] to-[#ffa000] text-slate-950 flex items-center justify-between px-3.5 font-bold tracking-wide shadow-sm shrink-0 border-b border-amber-600/30">
        <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? 'lg:justify-center lg:w-full' : ''}`}>
          <SchoolLogo
            logoUrl={schoolProfile?.logoUrl || schoolLogo}
            schoolName={effectiveSchoolName}
            schoolCode={schoolCode}
            size={isCollapsed ? 'md' : 'md'}
            variant="navy"
            ring={false}
            className="shadow-sm shrink-0"
          />

          {/* School Name & Tagline (Hidden when desktop collapsed) */}
          <div className={`min-w-0 flex-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
            <div
              className="text-[12px] leading-tight font-black tracking-tight text-slate-950 uppercase line-clamp-2"
              title={effectiveSchoolName}
            >
              {effectiveSchoolName}
            </div>
            <div className="text-[9px] font-extrabold tracking-wider text-slate-800 uppercase truncate mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 shrink-0"></span>
              <span className="truncate">{effectiveTagline}</span>
            </div>
          </div>
        </div>

        {/* Mobile Close Button (Visible on mobile screens only) */}
        <button
          onClick={() => setIsOpen && setIsOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-950 hover:bg-black/10 transition cursor-pointer"
          title="Close Navigation Drawer"
          aria-label="Close Navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. School Info & Campus Pill (Hidden in compact desktop mode) */}
      <div
        className={`px-3.5 py-2 bg-[#0a1f42] border-b border-slate-800 flex items-center justify-between shrink-0 ${
          isCollapsed ? 'lg:hidden' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0" title={effectiveAddress}>
          <School className="w-3.5 h-3.5 text-[#ffa000] shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-white tracking-wide truncate">
              {effectiveAddress}
            </div>
            <div className="text-[9px] font-mono text-slate-400">
              Code: <span className="text-amber-400 font-bold">{schoolCode || 'SYSTEM'}</span>
            </div>
          </div>
        </div>
        <span
          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
            isSuperAdmin
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
          }`}
        >
          {isSuperAdmin ? 'DEV SAAS' : 'OFFICIAL'}
        </span>
      </div>

      {/* 2b. Academic Session Switcher in Mobile Drawer */}
      {sessions && sessions.length > 0 && (
        <div className="lg:hidden mx-3 my-2 p-2.5 rounded-xl bg-[#031127] border border-slate-800 shrink-0">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Calendar className="w-3.5 h-3.5" />
              Academic Session
            </span>
            <span className="text-emerald-400 font-mono text-[9px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {currentSession}
            </span>
          </div>
          <select
            value={currentSession}
            onChange={(e) => switchSession(e.target.value)}
            className="w-full bg-[#0a1f42] text-white font-bold text-xs p-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            {sessions.map((s) => (
              <option key={s._id} value={s.sessionName}>
                Session: {s.sessionName} {s.sessionName === activeSession ? '★ (Active)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3. Navigation Modules (Scrollable List) */}
      <div className="flex-1 overflow-y-auto py-2.5 px-2.5 lg:px-3 space-y-1 text-sm custom-scrollbar">
        {/* Developer Hub Link (Visible exclusively to Super Admin) */}
        {isSuperAdmin && (
          <div className="pb-2 border-b border-slate-800/80 mb-2">
            <button
              onClick={() => handleNav(ROUTES.DEVELOPER_SCHOOLS, 'developer_schools')}
              title={isCollapsed ? 'Developer Schools Hub' : ''}
              className={`w-full flex items-center ${
                isCollapsed ? 'lg:justify-center px-2' : 'justify-between px-3'
              } py-2 rounded-xl font-bold transition-all cursor-pointer ${
                currentPath === ROUTES.DEVELOPER_SCHOOLS
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/40'
                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className={`text-xs ${isCollapsed ? 'lg:hidden' : ''}`}>Developer Hub</span>
              </div>
              <span className={`text-[10px] bg-slate-900/60 px-1.5 py-0.5 rounded font-mono ${isCollapsed ? 'lg:hidden' : ''}`}>
                SAAS
              </span>
            </button>
          </div>
        )}

        {/* 1. Dashboard (Single click submodule) */}
        {hasPermission('dashboard') && (
          <button
            onClick={() => handleNav(ROUTES.DASHBOARD, 'dashboard')}
            title={isCollapsed ? 'Executive Dashboard' : ''}
            className={`w-full flex items-center ${
              isCollapsed ? 'lg:justify-center px-2' : 'justify-between px-3'
            } py-2.5 rounded-xl font-medium transition-all cursor-pointer ${
              isNavActive(ROUTES.DASHBOARD, 'dashboard')
                ? 'bg-[#ffa000] text-slate-950 font-black shadow-md'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className={isCollapsed ? 'lg:hidden' : ''}>Dashboard</span>
            </div>
          </button>
        )}

        {/* 2 to 9: Master Modules & Granular Submodules */}
        {SYSTEM_MODULES.filter((m) => m.id !== 'dashboard').map((parent) => {
          if (!hasModule(parent.id)) {
            return null;
          }

          const IconComponent = resolveModuleIcon(parent.icon, parent.id);
          const isOpen = !!openAccordions[parent.id];
          const allowedSubmodules = parent.submodules.filter((sub) => hasPermission(sub.id));
          const hasActiveChild = allowedSubmodules.some((s) => isNavActive(s.route, s.id));

          return (
            <div key={parent.id} className="pt-0.5">
              {/* Parent Accordion Trigger */}
              <button
                onClick={() => toggleAccordion(parent.id)}
                title={isCollapsed ? parent.name : ''}
                className={`w-full flex items-center ${
                  isCollapsed ? 'lg:justify-center px-2' : 'justify-between px-3'
                } py-2 rounded-xl font-semibold transition cursor-pointer ${
                  hasActiveChild && isCollapsed
                    ? 'bg-amber-500/20 text-[#ffa000] border border-amber-500/40'
                    : 'text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-1 rounded shrink-0 transition-colors ${
                      hasActiveChild ? 'bg-[#ffa000] text-slate-950' : 'bg-amber-500/20 text-[#ffa000]'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span className={`text-white text-xs truncate ${isCollapsed ? 'lg:hidden' : ''}`}>
                    {parent.name}
                  </span>
                </div>

                {!isCollapsed && (
                  <span className="shrink-0 text-slate-400">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </span>
                )}
              </button>

              {/* Submodules List (Expanded Accordion) */}
              {isOpen && !isCollapsed && (
                <div className="mt-1 ml-4 pl-3 border-l-2 border-slate-700/60 space-y-1">
                  {allowedSubmodules.map((sub) => {
                    const active = isNavActive(sub.route, sub.id);

                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleNav(sub.route, sub.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer text-left ${
                          active
                            ? 'bg-[#ffa000] text-slate-950 font-black shadow-xs'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>
                        <span className="truncate">{sub.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Desktop Collapse/Expand Toggle Action Bar (Hidden on Mobile) */}
      <div className="hidden lg:flex items-center justify-between px-3 py-2 bg-[#030e21] border-t border-slate-800/80">
        <button
          onClick={handleToggleCollapse}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 text-xs font-medium transition cursor-pointer"
          title={isCollapsed ? 'Expand Sidebar (Full Width)' : 'Collapse Sidebar (Mini Mode)'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-amber-400" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[11px] font-semibold text-slate-400">Collapse Menu</span>
            </>
          )}
        </button>
      </div>

      {/* 5. User / Session Footer with Logout */}
      <div className="p-3 bg-[#061225] border-t border-slate-800 text-xs flex items-center justify-between shrink-0">
        <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'lg:justify-center lg:w-full' : ''}`}>
          <div
            className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ffa000] to-amber-600 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow-inner"
            title={user?.name || 'User'}
          >
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
          </div>
          <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
            <div className="font-bold text-white truncate text-xs">
              {user?.name || 'Staff User'}
            </div>
            <div className="text-[10px] text-amber-400 font-semibold truncate">
              {user?.role || 'USER'} • {schoolCode}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className={`p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer ${
            isCollapsed ? 'lg:hidden' : ''
          }`}
          title="Sign Out of Portal"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
