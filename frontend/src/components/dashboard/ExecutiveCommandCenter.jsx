import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { ROUTES } from '../../routes/appRoutes';
import {
  Calendar,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  Wallet,
  Scale,
  Users,
  Briefcase,
  GraduationCap,
  AlertTriangle,
  ChevronRight,
  ArrowUpRight,
  X,
  Search,
  Phone,
  CheckCircle2,
  Sparkles,
  FileText,
  UserPlus,
  Receipt,
  Layers,
  Copy,
  ShieldCheck,
  School,
  Radio,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SchoolLogo from '../common/SchoolLogo';
import { subscribeToDataChanges } from '../../utils/realtimeEvents';

export default function ExecutiveCommandCenter({ schoolCode = 'SCH-101', setActiveSubModule }) {
  const navigate = useNavigate();
  const {
    user,
    schoolName,
    schoolProfile,
    schoolLogo,
    schoolTagline,
    schoolAddress,
    schoolAffiliation,
  } = useAuth();

  // Helper for navigating to routes or submodules
  const handleNavigate = (route, submoduleKey) => {
    if (setActiveSubModule && submoduleKey) {
      setActiveSubModule(submoduleKey);
    } else if (route) {
      navigate(route);
    }
  };

  // Date selection state helpers (YYYY-MM-DD)
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 1. ALL HOOKS / STATE DECLARED FIRST (No temporal dead zone)
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Privacy Mode (Persisted in localStorage)
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    try {
      return localStorage.getItem('executive_privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  // Individual card privacy toggle state overrides
  const [cardPrivacyOverrides, setCardPrivacyOverrides] = useState({});

  // Active Drill-Down Modal State: null | 'fee' | 'expenses' | 'studentAttendance' | 'staffAttendance' | 'admissions' | 'pendingDues'
  const [activeModal, setActiveModal] = useState(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalAttendanceTab, setModalAttendanceTab] = useState('absentees'); // 'absentees' | 'classes'
  const [copiedPhone, setCopiedPhone] = useState(null);

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState({
    summary: {
      date: getTodayString(),
      feeCollection: { totalToday: 0, cashToday: 0, bankToday: 0, voucherCount: 0 },
      studentAttendance: { enrolledCount: 0, presentCount: 0, absentCount: 0, leaveCount: 0, attendanceRate: 0, hasMarkedAttendance: false },
      staffAttendance: { totalStaff: 0, presentCount: 0, absentCount: 0, leaveCount: 0, lateCount: 0, attendanceRate: 0, hasMarkedAttendance: false },
      expenses: { totalExpense: 0, voucherCount: 0 },
      financialPulse: { feeCollected: 0, expenses: 0, netOperatingCash: 0, isPositive: true },
      admissions: { totalActiveEnrolled: 0, admittedToday: 0, admittedThisMonth: 0, openInquiries: 0 },
      pendingDues: { totalPendingAmount: 0, totalDefaulters: 0 }
    },
    breakdowns: {
      feeCollectionToday: [],
      todayAbsentees: [],
      classAttendance: [],
      staffRosterToday: [],
      expensesToday: [],
      topDefaulters: [],
      recentAdmissions: []
    }
  });

  // 2. PRIVACY TOGGLE HANDLERS
  const toggleGlobalPrivacy = () => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('executive_privacy_mode', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
    setCardPrivacyOverrides({});
  };

  const toggleCardPrivacy = (e, cardKey) => {
    e.stopPropagation();
    setCardPrivacyOverrides((prev) => ({
      ...prev,
      [cardKey]: prev[cardKey] !== undefined ? !prev[cardKey] : !isPrivacyMode,
    }));
  };

  const isCardMasked = (cardKey) => {
    if (cardPrivacyOverrides[cardKey] !== undefined) {
      return cardPrivacyOverrides[cardKey];
    }
    return isPrivacyMode;
  };

  const formatAmount = (num, isMasked, prefix = 'Rs. ') => {
    if (isMasked) return '••••••';
    return `${prefix}${Number(num || 0).toLocaleString()}`;
  };

  const handleCopyPhone = (phone) => {
    if (!phone || phone === '—') return;
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2200);
  };

  const isTodaySelected = selectedDate === getTodayString();

  // 3. REAL-TIME DATA FETCHING (Pure Event-Driven: Silent background refresh without blinking)
  const fetchDashboardData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await api.get('/dashboard/daily-summary', {
        params: {
          schoolCode,
          date: selectedDate
        }
      });
      if (res.data?.success) {
        setDashboardData(res.data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch dashboard summary:', err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [schoolCode, selectedDate]);

  // 1. Initial Load & on selectedDate / schoolCode change
  useEffect(() => {
    fetchDashboardData({ silent: false });
  }, [fetchDashboardData]);

  // 2. Real-Time Cross-Tab & Cross-Component Instant Sync
  // Pure Event-Driven: Only fires when an actual attendance, fee, expense, or student action occurs
  useEffect(() => {
    const unsubscribe = subscribeToDataChanges(() => {
      fetchDashboardData({ silent: true });
    });
    return unsubscribe;
  }, [fetchDashboardData]);

  // 3. Tab Focus & Visibility Event (Silent refresh once when admin returns to tab)
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData({ silent: true });
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [fetchDashboardData]);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeModal) {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal]);

  // 4. COMPUTED / MEMOIZED VALUES
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning, Principal';
    if (hour < 17) return 'Good Afternoon, Principal';
    return 'Good Evening, Principal';
  }, []);

  const formattedDisplayDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const parts = selectedDate.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const { summary = {}, breakdowns = {} } = dashboardData || {};

  // Filtered lists for active modal
  const filteredFeeList = useMemo(() => {
    const list = breakdowns.feeCollectionToday || [];
    const q = modalSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (item) =>
        (item.studentName || '').toLowerCase().includes(q) ||
        (item.rollNumber || '').toLowerCase().includes(q) ||
        (item.voucherNo || '').toLowerCase().includes(q) ||
        (item.className || '').toLowerCase().includes(q)
    );
  }, [breakdowns.feeCollectionToday, modalSearch]);

  const filteredAbsenteesList = useMemo(() => {
    const list = breakdowns.todayAbsentees || [];
    const q = modalSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (item) =>
        (item.studentName || '').toLowerCase().includes(q) ||
        (item.rollNumber || '').toLowerCase().includes(q) ||
        (item.className || '').toLowerCase().includes(q) ||
        (item.fatherName || '').toLowerCase().includes(q) ||
        (item.fatherPhone || '').toLowerCase().includes(q)
    );
  }, [breakdowns.todayAbsentees, modalSearch]);

  const filteredStaffList = useMemo(() => {
    const list = breakdowns.staffRosterToday || [];
    const q = modalSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (item) =>
        (item.name || '').toLowerCase().includes(q) ||
        (item.employeeId || '').toLowerCase().includes(q) ||
        (item.role || '').toLowerCase().includes(q) ||
        (item.department || '').toLowerCase().includes(q)
    );
  }, [breakdowns.staffRosterToday, modalSearch]);

  const filteredExpensesList = useMemo(() => {
    const list = breakdowns.expensesToday || [];
    const q = modalSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (item) =>
        (item.categoryName || '').toLowerCase().includes(q) ||
        (item.remarks || '').toLowerCase().includes(q) ||
        (item.voucherNo || '').toLowerCase().includes(q) ||
        (item.recordedBy || '').toLowerCase().includes(q)
    );
  }, [breakdowns.expensesToday, modalSearch]);

  const filteredDefaultersList = useMemo(() => {
    const list = breakdowns.topDefaulters || [];
    const q = modalSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (item) =>
        (item.studentName || '').toLowerCase().includes(q) ||
        (item.rollNumber || '').toLowerCase().includes(q) ||
        (item.className || '').toLowerCase().includes(q) ||
        (item.fatherName || '').toLowerCase().includes(q)
    );
  }, [breakdowns.topDefaulters, modalSearch]);

  const filteredAdmissionsList = useMemo(() => {
    const list = breakdowns.recentAdmissions || [];
    const q = modalSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (item) =>
        (item.fullName || '').toLowerCase().includes(q) ||
        (item.admissionNumber || '').toLowerCase().includes(q) ||
        (item.className || '').toLowerCase().includes(q) ||
        (item.fatherName || '').toLowerCase().includes(q)
    );
  }, [breakdowns.recentAdmissions, modalSearch]);

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-6 pb-12">
      {/* 1. EXECUTIVE HEADER & CONTROLS */}
      <div className="bg-gradient-to-r from-[#041633] via-[#082046] to-[#0d2f66] rounded-2xl p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Greeting, School Logo & Context */}
          <div className="flex items-start sm:items-center gap-4">
            <SchoolLogo
              logoUrl={schoolProfile?.logoUrl || schoolLogo}
              schoolName={schoolProfile?.schoolName || schoolName}
              schoolCode={schoolCode}
              size="lg"
              variant="gold"
              className="hidden sm:inline-flex shadow-xl ring-2 ring-amber-400/40 shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-[#ffa000] border border-amber-500/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  Official School Executive Command Center
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <School className="w-3.5 h-3.5" />
                  {schoolCode}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300">
                  {schoolProfile?.activeSession || 'Session 2025-2026'}
                </span>
                {schoolProfile?.affiliation && (
                  <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 truncate max-w-xs">
                    {schoolProfile.affiliation}
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-2 uppercase">
                {schoolProfile?.schoolName || schoolName || 'School Executive Portal'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                <span className="text-amber-400 font-semibold">{greeting}, {user?.name || 'Administrator'}! </span>
                {schoolProfile?.tagline ? `${schoolProfile.tagline}. ` : ''}
                Real-time daily operations overview: fee receipts, live attendance roster, expenses, and pending dues.
              </p>
            </div>
          </div>

          {/* Right Action Bar: Date Selectors & Privacy Mode Toggle */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Quick Date Pills */}
            <div className="bg-slate-900/80 backdrop-blur-sm p-1 rounded-xl border border-slate-700/80 flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedDate(getTodayString())}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  isTodaySelected
                    ? 'bg-[#ffa000] text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getYesterdayString())}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  selectedDate === getYesterdayString()
                    ? 'bg-[#ffa000] text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Yesterday
              </button>
              <div className="h-4 w-px bg-slate-700 mx-0.5" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="bg-transparent text-white px-2 py-1 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
              />
            </div>

            {/* Privacy Mode Eye Toggle */}
            <button
              type="button"
              onClick={toggleGlobalPrivacy}
              title={isPrivacyMode ? 'Privacy Mode is ON (Amounts Hidden)' : 'Privacy Mode is OFF (Amounts Visible)'}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border shadow-sm ${
                isPrivacyMode
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 hover:bg-amber-400/30'
                  : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
            >
              {isPrivacyMode ? (
                <>
                  <EyeOff className="w-4 h-4 text-[#ffa000]" />
                  <span>Privacy Mode: ON</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span>Privacy Mode: OFF</span>
                </>
              )}
            </button>

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={() => fetchDashboardData({ silent: false })}
              disabled={loading}
              title="Force Refresh Live Data"
              className="p-2.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  loading ? 'animate-spin text-[#ffa000]' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Date Active Banner */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#ffa000]" />
            <span>Viewing Date:</span>
            <strong className="text-white bg-slate-800/90 px-2.5 py-0.5 rounded-md font-semibold border border-slate-700">
              {formattedDisplayDate}
            </strong>
            {isTodaySelected && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                Live Day
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            {isPrivacyMode && (
              <span className="flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Sensitive figures masked for desk visitors
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. THE 7 EXECUTIVE OPERATIONAL CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {/* CARD 1: TODAY'S FEE COLLECTION */}
        <div
          onClick={() => {
            setActiveModal('fee');
            setModalSearch('');
          }}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all cursor-pointer relative group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Today's Fee Collection
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => toggleCardPrivacy(e, 'fee')}
                title="Toggle card visibility"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                {isCardMasked('fee') ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-2">
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {formatAmount(summary.feeCollection?.totalCollected ?? summary.feeCollection?.totalToday ?? (breakdowns.feeCollectionToday || []).reduce((acc, c) => acc + (Number(c.paidAmount) || 0), 0), isCardMasked('fee'))}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Total money collected today
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[11px] text-slate-600 font-semibold">
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                Cash: {formatAmount(summary.feeCollection?.cashCollected ?? summary.feeCollection?.cashToday, isCardMasked('fee'))}
              </span>
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                Bank: {formatAmount(summary.feeCollection?.bankCollected ?? summary.feeCollection?.bankToday, isCardMasked('fee'))}
              </span>
            </div>
            <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[11px] group-hover:translate-x-0.5 transition">
              Breakdown <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* CARD 2: TODAY'S EXPENSES */}
        <div
          onClick={() => {
            setActiveModal('expenses');
            setModalSearch('');
          }}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-rose-300 transition-all cursor-pointer relative group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 group-hover:bg-rose-600 group-hover:text-white transition">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Today's Expenses
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => toggleCardPrivacy(e, 'expenses')}
                title="Toggle card visibility"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                {isCardMasked('expenses') ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-2">
              <div className="text-2xl font-black text-rose-600 tracking-tight">
                {formatAmount(summary.expenses?.totalExpense, isCardMasked('expenses'))}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {summary.expenses?.voucherCount || 0} expense vouchers recorded
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-medium truncate max-w-[170px]">
              {breakdowns.expensesToday?.[0]
                ? `${breakdowns.expensesToday[0].categoryName}: ${formatAmount(breakdowns.expensesToday[0].amount, isCardMasked('expenses'))}`
                : 'No expenses recorded'}
            </span>
            <span className="text-rose-600 font-bold flex items-center gap-0.5 text-[11px] group-hover:translate-x-0.5 transition">
              Vouchers <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* CARD 3: NET OPERATING CASH-IN-HAND TODAY */}
        <div
          onClick={() => {
            setActiveModal('fee');
            setModalSearch('');
          }}
          className={`rounded-2xl p-5 border shadow-sm hover:shadow-xl transition-all cursor-pointer relative group flex flex-col justify-between ${
            summary.financialPulse?.isPositive
              ? 'bg-gradient-to-br from-emerald-50/60 to-white border-emerald-200 hover:border-emerald-300'
              : 'bg-gradient-to-br from-amber-50/60 to-white border-amber-200 hover:border-amber-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border transition ${
                    summary.financialPulse?.isPositive
                      ? 'bg-emerald-100/70 text-emerald-700 border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white'
                      : 'bg-amber-100/70 text-amber-700 border-amber-200 group-hover:bg-amber-600 group-hover:text-white'
                  }`}
                >
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Cash-In-Hand Today
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => toggleCardPrivacy(e, 'netCash')}
                title="Toggle card visibility"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                {isCardMasked('netCash') ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-2">
              <div
                className={`text-2xl font-black tracking-tight ${
                  summary.financialPulse?.isPositive ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {formatAmount(summary.financialPulse?.netOperatingCash, isCardMasked('netCash'))}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                (Fee Received - Expenses Today)
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                summary.financialPulse?.isPositive
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {summary.financialPulse?.isPositive ? '✓ Positive Cashflow' : 'Operating Deficit'}
            </span>
            <span className="text-slate-700 font-bold flex items-center gap-0.5 text-[11px] group-hover:translate-x-0.5 transition">
              Audit <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* CARD 4: STUDENT ATTENDANCE TODAY */}
        <div
          onClick={() => {
            setActiveModal('studentAttendance');
            setModalSearch('');
            setModalAttendanceTab('absentees');
          }}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer relative group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Student Attendance
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  summary.studentAttendance?.hasMarkedAttendance
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {summary.studentAttendance?.hasMarkedAttendance ? 'Marked' : 'Not Marked'}
              </span>
            </div>

            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {summary.studentAttendance?.hasMarkedAttendance
                    ? `${summary.studentAttendance?.attendanceRate}%`
                    : 'Pending'}
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  ({summary.studentAttendance?.presentCount || 0} / {summary.studentAttendance?.enrolledCount || 0} Present)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(summary.studentAttendance?.attendanceRate || 0, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded border border-rose-100">
                Absent: {summary.studentAttendance?.absentCount || 0}
              </span>
              <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-100">
                Leave: {summary.studentAttendance?.leaveCount || 0}
              </span>
            </div>
            <span className="text-blue-600 font-bold flex items-center gap-0.5 text-[11px] group-hover:translate-x-0.5 transition">
              Absentees <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* CARD 5: STAFF ATTENDANCE TODAY */}
        <div
          onClick={() => {
            setActiveModal('staffAttendance');
            setModalSearch('');
          }}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-purple-300 transition-all cursor-pointer relative group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 group-hover:bg-purple-600 group-hover:text-white transition">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Staff & Teachers
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  summary.staffAttendance?.hasMarkedAttendance
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {summary.staffAttendance?.hasMarkedAttendance ? 'Marked' : 'Not Marked'}
              </span>
            </div>

            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {summary.staffAttendance?.presentCount || 0} / {summary.staffAttendance?.totalStaff || 0}
                </span>
                <span className="text-xs text-purple-600 font-bold">
                  ({summary.staffAttendance?.attendanceRate || 0}%)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {summary.staffAttendance?.absentCount || 0} absent, {summary.staffAttendance?.leaveCount || 0} on leave
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500">
              Late Arrivals: <strong className="text-slate-800">{summary.staffAttendance?.lateCount || 0}</strong>
            </span>
            <span className="text-purple-600 font-bold flex items-center gap-0.5 text-[11px] group-hover:translate-x-0.5 transition">
              Staff Roster <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* CARD 6: ADMISSIONS & TOTAL STRENGTH */}
        <div
          onClick={() => {
            setActiveModal('admissions');
            setModalSearch('');
          }}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all cursor-pointer relative group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:bg-[#ffa000] group-hover:text-slate-950 transition">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Admissions & Strength
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Active
              </span>
            </div>

            <div className="mt-2">
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {summary.admissions?.totalActiveEnrolled || 0} Students
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Total active enrolled in school
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-emerald-700 font-bold">
                +{summary.admissions?.admittedThisMonth || 0} this month
              </span>
              {summary.admissions?.openInquiries > 0 && (
                <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                  {summary.admissions.openInquiries} inq
                </span>
              )}
            </div>
            <span className="text-amber-700 font-bold flex items-center gap-0.5 text-[11px] group-hover:translate-x-0.5 transition">
              Details <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* CARD 7: OUTSTANDING DUES & DEFAULTERS */}
        <div
          onClick={() => {
            setActiveModal('pendingDues');
            setModalSearch('');
          }}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-amber-400 transition-all cursor-pointer relative group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:bg-amber-600 group-hover:text-white transition">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Outstanding Fee Dues
                  </span>
                  <span className="text-[10px] text-slate-400">واجب الادا بقایا فیس</span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => toggleCardPrivacy(e, 'dues')}
                title="Toggle card visibility"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                {isCardMasked('dues') ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-2">
              <div className="text-2xl font-black text-amber-600 tracking-tight">
                {formatAmount(summary.pendingDues?.totalPendingAmount, isCardMasked('dues'))}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Across {summary.pendingDues?.totalDefaulters || 0} student accounts
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
              {summary.pendingDues?.totalDefaulters || 0} Defaulters
            </span>
            <span className="text-amber-700 font-bold flex items-center gap-0.5 text-[11px] group-hover:translate-x-0.5 transition">
              Defaulters <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* 3. CLASS-WISE ATTENDANCE PULSE SNAPSHOT */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#ffa000]" />
              Class-Wise Attendance Pulse
            </h2>
            <p className="text-xs text-slate-500">
              Quick visual check of student presence across all grades for {formattedDisplayDate}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveModal('studentAttendance');
              setModalAttendanceTab('classes');
            }}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>View Full Matrix</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {breakdowns.classAttendance && breakdowns.classAttendance.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
            {breakdowns.classAttendance.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setActiveModal('studentAttendance');
                  setModalSearch(item.className);
                  setModalAttendanceTab('absentees');
                }}
                className="bg-slate-50 hover:bg-blue-50/50 p-3.5 rounded-xl border border-slate-200/80 hover:border-blue-300 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 text-xs truncate">
                      {item.className}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {item.section}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-black text-slate-800">
                    {item.rate}%
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>{item.present} / {item.total}</span>
                  {item.absent > 0 && (
                    <span className="text-rose-600 font-bold">
                      {item.absent} abs
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-6 text-center border border-dashed border-slate-200">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">
              No class attendance marked for {formattedDisplayDate} yet.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Once class teachers or the administration submit daily attendance sheets, live progress bars will appear here.
            </p>
            <button
              type="button"
              onClick={() => handleNavigate(ROUTES.STUDENTS_ATTENDANCE, 'mark_student_attendance')}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-[#041633] hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <span>+ Mark Student Attendance Now</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. PRINCIPAL'S FAST ACTION HIGHWAY */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#ffa000]" />
            Quick Command Actions
          </h2>
          <p className="text-xs text-slate-500">
            Frequently needed operational shortcuts for school management
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            type="button"
            onClick={() => handleNavigate(ROUTES.FEE_COLLECTION, 'fee_collection')}
            className="p-3.5 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded-xl border border-slate-200 hover:border-emerald-300 transition flex flex-col items-center text-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Collect Fee</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate(ROUTES.ADMISSION_APPLY, 'admit_student')}
            className="p-3.5 bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 rounded-xl border border-slate-200 hover:border-amber-300 transition flex flex-col items-center text-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Admit Student</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate(ROUTES.STUDENTS_ATTENDANCE, 'mark_student_attendance')}
            className="p-3.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-800 rounded-xl border border-slate-200 hover:border-blue-300 transition flex flex-col items-center text-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Student Attend</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate(ROUTES.STAFF_ATTENDANCE, 'mark_staff_attendance')}
            className="p-3.5 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-800 rounded-xl border border-slate-200 hover:border-purple-300 transition flex flex-col items-center text-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Staff Attend</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate(ROUTES.EXPENSES_RECORD, 'record_expense')}
            className="p-3.5 bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-800 rounded-xl border border-slate-200 hover:border-rose-300 transition flex flex-col items-center text-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-105 transition">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Record Expense</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate(ROUTES.REPORTS_CENTER, 'reports_center')}
            className="p-3.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 rounded-xl border border-slate-200 hover:border-indigo-300 transition flex flex-col items-center text-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Reports & Analytics</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE DRILL-DOWN MODALS                                         */}
      {/* ========================================================================= */}
      {activeModal && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#041633] to-[#0a2757] p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/10 text-[#ffa000]">
                  {activeModal === 'fee' && <Wallet className="w-5 h-5" />}
                  {activeModal === 'expenses' && <Receipt className="w-5 h-5" />}
                  {activeModal === 'studentAttendance' && <Users className="w-5 h-5" />}
                  {activeModal === 'staffAttendance' && <Briefcase className="w-5 h-5" />}
                  {activeModal === 'admissions' && <GraduationCap className="w-5 h-5" />}
                  {activeModal === 'pendingDues' && <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    {activeModal === 'fee' && "Today's Fee Collection Ledger"}
                    {activeModal === 'expenses' && "Today's School Expense Vouchers"}
                    {activeModal === 'studentAttendance' && "Student Attendance & Absentees Action"}
                    {activeModal === 'staffAttendance' && "Staff & Teachers Daily Attendance Roster"}
                    {activeModal === 'admissions' && 'Student Strength & Recent Admissions'}
                    {activeModal === 'pendingDues' && 'Fee Defaulters & Outstanding Dues'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Detailed records for {formattedDisplayDate} (School: {schoolCode})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Subheader: Search bar & Tabs */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter records by name, roll #, voucher #..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffa000] focus:border-transparent"
                />
                {modalSearch && (
                  <button
                    type="button"
                    onClick={() => setModalSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Attendance specific tabs */}
              {activeModal === 'studentAttendance' && (
                <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setModalAttendanceTab('absentees')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      modalAttendanceTab === 'absentees'
                        ? 'bg-white text-rose-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Absentees List ({breakdowns.todayAbsentees?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAttendanceTab('classes')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      modalAttendanceTab === 'classes'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Class Summary ({breakdowns.classAttendance?.length || 0})
                  </button>
                </div>
              )}

              {/* Quick totals badge */}
              <div className="text-xs text-slate-600 font-semibold self-end sm:self-auto">
                {activeModal === 'fee' && (
                  <span>
                    Total Collected:{' '}
                    <strong className="text-emerald-700 font-black">
                      {formatAmount(
                        filteredFeeList.reduce((acc, curr) => acc + (Number(curr.paidAmount) || 0), 0),
                        isCardMasked('fee')
                      )}
                    </strong>
                  </span>
                )}
                {activeModal === 'expenses' && (
                  <span>
                    Total: <strong className="text-rose-700 font-black">{formatAmount(summary.expenses?.totalExpense, isCardMasked('expenses'))}</strong>
                  </span>
                )}
                {activeModal === 'pendingDues' && (
                  <span>
                    Total Dues: <strong className="text-amber-700 font-black">{formatAmount(summary.pendingDues?.totalPendingAmount, isCardMasked('dues'))}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Modal Body / Scrollable Table */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {/* 1. FEE COLLECTION BREAKDOWN TABLE */}
              {activeModal === 'fee' && (
                <div className="space-y-4">
                  {filteredFeeList.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                      <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-sm">No fee vouchers recorded for this date.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        When the accountant marks vouchers as PAID today, they will show up here immediately.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3">Student Name</th>
                            <th className="py-2.5 px-3">Roll / Class</th>
                            <th className="py-2.5 px-3">Payment Mode</th>
                            <th className="py-2.5 px-3">Received By</th>
                            <th className="py-2.5 px-3">Receipt / Ref</th>
                            <th className="py-2.5 px-3 text-right">Amount Collected</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {filteredFeeList.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {item.studentName}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-slate-800">{item.className}</span>
                                <span className="text-slate-400 ml-1">({item.section})</span>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-2">
                                  Roll: {item.rollNumber}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    item.paymentMethod === 'BANK'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  }`}
                                >
                                  {item.paymentMethod || 'CASH'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">
                                {item.receivedBy || 'Accountant'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                                {item.receiptNo !== '—' ? item.receiptNo : item.voucherNo}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-emerald-700 text-sm">
                                {formatAmount(item.paidAmount, isCardMasked('fee'))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 2. TODAY'S EXPENSES TABLE */}
              {activeModal === 'expenses' && (
                <div className="space-y-4">
                  {filteredExpensesList.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                      <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-sm">No school expenses recorded for this date.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Use the Record Expense action to log generator fuel, stationery, refreshment, or bills.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3">Voucher #</th>
                            <th className="py-2.5 px-3">Expense Category</th>
                            <th className="py-2.5 px-3">Description / Remarks</th>
                            <th className="py-2.5 px-3">Recorded By</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {filteredExpensesList.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {item.voucherNo}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-rose-800">
                                {item.categoryName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {item.remarks || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">
                                {item.recordedBy || 'Accountant'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-rose-600 text-sm">
                                {formatAmount(item.amount, isCardMasked('expenses'))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 3. STUDENT ATTENDANCE & ABSENTEES MODAL */}
              {activeModal === 'studentAttendance' && (
                <div>
                  {modalAttendanceTab === 'absentees' ? (
                    <div className="space-y-4">
                      {filteredAbsenteesList.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                          <p className="font-bold text-sm text-slate-800">
                            No absentees reported for this date!
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Either 100% of students were present or attendance is pending submission.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
                            <span>
                              Follow-up list: <strong>{filteredAbsenteesList.length} students</strong> are absent today.
                            </span>
                            <span className="text-[11px] font-bold">Principal Action Hotline</span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                                <tr>
                                  <th className="py-2.5 px-3">Roll #</th>
                                  <th className="py-2.5 px-3">Student Name</th>
                                  <th className="py-2.5 px-3">Class & Sec</th>
                                  <th className="py-2.5 px-3">Father Name</th>
                                  <th className="py-2.5 px-3">Father Phone</th>
                                  <th className="py-2.5 px-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {filteredAbsenteesList.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-rose-50/40 transition">
                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                      {item.rollNumber}
                                    </td>
                                    <td className="py-2.5 px-3 font-bold text-slate-900">
                                      {item.studentName}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className="font-semibold">{item.className}</span>
                                      <span className="text-slate-400 ml-1">({item.section})</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600">
                                      {item.fatherName}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                                      {item.fatherPhone || '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      {item.fatherPhone && item.fatherPhone !== '—' ? (
                                        <div className="flex items-center justify-end gap-1.5">
                                          <a
                                            href={`tel:${item.fatherPhone}`}
                                            className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                            title="Call Father"
                                          >
                                            <Phone className="w-3.5 h-3.5" />
                                            <span>Call</span>
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyPhone(item.fatherPhone)}
                                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                                            title="Copy Phone"
                                          >
                                            {copiedPhone === item.fatherPhone ? (
                                              <span className="text-emerald-600 text-[10px]">Copied!</span>
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 text-[10px]">No contact</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Class Summary Tab */
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3">Class</th>
                            <th className="py-2.5 px-3">Section</th>
                            <th className="py-2.5 px-3 text-center">Enrolled</th>
                            <th className="py-2.5 px-3 text-center">Present</th>
                            <th className="py-2.5 px-3 text-center">Absent</th>
                            <th className="py-2.5 px-3 text-center">Leave</th>
                            <th className="py-2.5 px-3 text-right">Attendance Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {breakdowns.classAttendance?.map((c, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {c.className}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">
                                {c.section}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold">
                                {c.total}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                                {c.present}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-rose-600">
                                {c.absent}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-amber-600">
                                {c.leave}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span
                                  className={`font-black text-xs px-2 py-0.5 rounded-full ${
                                    c.rate >= 90
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : c.rate >= 75
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {c.rate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 4. STAFF ATTENDANCE ROSTER */}
              {activeModal === 'staffAttendance' && (
                <div className="space-y-4">
                  {filteredStaffList.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                      <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-sm">No staff attendance recorded for this date.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Mark staff attendance to see teachers, administrative staff, and attendance timings here.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3">Emp ID</th>
                            <th className="py-2.5 px-3">Staff Name</th>
                            <th className="py-2.5 px-3">Role / Department</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-center">Time In</th>
                            <th className="py-2.5 px-3 text-center">Time Out</th>
                            <th className="py-2.5 px-3">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {filteredStaffList.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {item.employeeId}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {item.name}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-slate-800">{item.role}</span>
                                <span className="text-slate-400 text-[10px] ml-1">({item.department})</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    item.status === 'PRESENT'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : item.status === 'ABSENT'
                                      ? 'bg-rose-100 text-rose-800'
                                      : item.status === 'LATE'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                                {item.timeIn || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                                {item.timeOut || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">
                                {item.remarks || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 5. ADMISSIONS BREAKDOWN */}
              {activeModal === 'admissions' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-[11px] font-bold text-amber-700 uppercase">Active Enrolled</span>
                      <div className="text-xl font-black text-amber-950 mt-1">
                        {summary.admissions?.totalActiveEnrolled || 0} Students
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase">Admitted This Month</span>
                      <div className="text-xl font-black text-emerald-950 mt-1">
                        +{summary.admissions?.admittedThisMonth || 0} Students
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <span className="text-[11px] font-bold text-blue-700 uppercase">Open Inquiries</span>
                      <div className="text-xl font-black text-blue-950 mt-1">
                        {summary.admissions?.openInquiries || 0} Inquiries
                      </div>
                    </div>
                  </div>

                  <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider">
                    Recent Admissions Roster
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Admission #</th>
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Father Name</th>
                          <th className="py-2.5 px-3">Class & Sec</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {filteredAdmissionsList.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {item.admissionNumber}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {item.fullName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {item.fatherName}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800">{item.className}</span>
                              <span className="text-slate-400 ml-1">({item.section})</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {item.admissionDate}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 6. OUTSTANDING DEFAULTERS BREAKDOWN */}
              {activeModal === 'pendingDues' && (
                <div className="space-y-4">
                  {filteredDefaultersList.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                      <p className="font-bold text-sm text-slate-800">No overdue fee accounts found!</p>
                      <p className="text-xs text-slate-400 mt-1">
                        All student fee accounts are fully paid.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                        <span>
                          Pending Fee Ledger: <strong>{filteredDefaultersList.length} students</strong> have outstanding balances.
                        </span>
                        <span>
                          Total Due: <strong>{formatAmount(summary.pendingDues?.totalPendingAmount, isCardMasked('dues'))}</strong>
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">Roll #</th>
                              <th className="py-2.5 px-3">Student Name</th>
                              <th className="py-2.5 px-3">Class & Sec</th>
                              <th className="py-2.5 px-3">Father Name</th>
                              <th className="py-2.5 px-3">Overdue Months</th>
                              <th className="py-2.5 px-3 text-right">Pending Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {filteredDefaultersList.map((item, idx) => (
                              <tr key={idx} className="hover:bg-amber-50/40 transition">
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                  {item.rollNumber}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-900">
                                  {item.studentName}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-semibold text-slate-800">{item.className}</span>
                                  <span className="text-slate-400 ml-1">({item.section})</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {item.fatherName}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                    {item.monthsDueCount} mo: {item.pendingMonthsStr}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-rose-700 text-sm">
                                  {formatAmount(item.totalPending, isCardMasked('dues'))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Showing live verified records for {schoolProfile?.schoolName || schoolName || 'School'} Database
              </span>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-[#041633] hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
