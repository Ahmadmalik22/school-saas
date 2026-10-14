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
  ShieldCheck,
  School,
  LogOut,
  User,
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
};

// Dynamic icon resolver: Supports any Lucide icon name string from moduleCatalog
const resolveModuleIcon = (iconName, moduleId) => {
  if (typeof iconName === 'string' && LucideIcons[iconName]) {
    return LucideIcons[iconName];
  }
  return MODULE_ICONS[moduleId] || Layers;
};

export default function Sidebar({ activeSubModule, setActiveSubModule, schoolCode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const { currentSession } = useAcademicSession();
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
      // Check if current route matches any of its submodules
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
    setOpenAccordions((prev) => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  };

  const handleNav = (routePath, legacyKey) => {
    navigate(routePath);
    if (setActiveSubModule) setActiveSubModule(legacyKey);
  };

  const isNavActive = (routePath, legacyKey) => {
    return (
      currentPath === routePath ||
      (routePath === ROUTES.DASHBOARD && currentPath === '/') ||
      activeSubModule === legacyKey
    );
  };

  const effectiveSchoolName = schoolProfile?.schoolName || schoolName || 'School System';
  const effectiveTagline = schoolProfile?.tagline || 'Official School Portal';
  const effectiveAddress = schoolProfile?.address || `Campus (${schoolCode || 'SYSTEM'})`;

  return (
    <aside className="w-64 bg-[#041633] text-slate-300 flex flex-col h-screen select-none shrink-0 border-r border-slate-800">
      {/* Top School Brand Header - Complete White-Label Branding */}
      <div className="h-16 bg-gradient-to-r from-[#ffa000] via-[#ffb300] to-[#ffa000] text-slate-950 flex items-center px-3.5 font-bold tracking-wide gap-3 shadow-sm shrink-0 border-b border-amber-600/30">
        <SchoolLogo
          logoUrl={schoolProfile?.logoUrl || schoolLogo}
          schoolName={effectiveSchoolName}
          schoolCode={schoolCode}
          size="md"
          variant="navy"
          ring={false}
          className="shadow-sm shrink-0"
        />
        <div className="min-w-0 flex-1">
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

      {/* School Info & Campus Pill */}
      <div className="px-3.5 py-2 bg-[#0a1f42] border-b border-slate-800 flex items-center justify-between shrink-0">
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

      {/* Navigation Modules (Granular RBAC Filtered) */}
      <div className="flex-1 overflow-y-auto py-2.5 px-3 space-y-1 text-sm custom-scrollbar">
        {/* Developer Hub Link (Visible exclusively to Super Admin) */}
        {isSuperAdmin && (
          <div className="pb-2 border-b border-slate-800/80 mb-2">
            <button
              onClick={() => handleNav(ROUTES.DEVELOPER_SCHOOLS, 'developer_schools')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                currentPath === ROUTES.DEVELOPER_SCHOOLS
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/40'
                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs">Developer Schools Hub</span>
              </div>
              <span className="text-[10px] bg-slate-900/60 px-1.5 py-0.5 rounded font-mono">
                SAAS
              </span>
            </button>
          </div>
        )}

        {/* 1. Dashboard (Single click submodule) */}
        {hasPermission('dashboard') && (
          <button
            onClick={() => handleNav(ROUTES.DASHBOARD, 'dashboard')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-all cursor-pointer ${
              isNavActive(ROUTES.DASHBOARD, 'dashboard')
                ? 'bg-[#ffa000] text-slate-950 font-bold shadow-md'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </div>
          </button>
        )}

        {/* 2 to 9: Master Modules & Granular Submodules */}
        {SYSTEM_MODULES.filter((m) => m.id !== 'dashboard').map((parent) => {
          // Check if user has permission for AT LEAST ONE submodule in this parent module
          if (!hasModule(parent.id)) {
            return null; // Entire parent module accordion is hidden for this user!
          }

          const IconComponent = resolveModuleIcon(parent.icon, parent.id);
          const isOpen = !!openAccordions[parent.id];

          // Filter submodules by individual rights
          const allowedSubmodules = parent.submodules.filter((sub) => hasPermission(sub.id));

          return (
            <div key={parent.id} className="pt-0.5">
              {/* Parent Accordion Trigger */}
              <button
                onClick={() => toggleAccordion(parent.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1 bg-amber-500/20 text-[#ffa000] rounded">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span className="text-white text-xs">{parent.name}</span>
                </div>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Allowed Submodules List */}
              {isOpen && (
                <div className="mt-1 ml-4 pl-3 border-l-2 border-slate-700/60 space-y-1">
                  {allowedSubmodules.map((sub) => {
                    const active = isNavActive(sub.route, sub.id);

                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleNav(sub.route, sub.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer text-left ${
                          active
                            ? 'bg-[#ffa000] text-slate-950 font-bold shadow-sm'
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

      {/* User / Session Footer with Logout */}
      <div className="p-3 bg-[#061225] border-t border-slate-800 text-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#ffa000] text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow-inner">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
          </div>
          <div className="min-w-0">
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
          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
          title="Sign Out of Portal"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
