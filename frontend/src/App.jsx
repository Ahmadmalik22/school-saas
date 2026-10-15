import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AcademicSessionProvider } from './context/AcademicSessionContext';
import { AcademicClassesProvider } from './context/AcademicClassesContext';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import { ROUTES, getRouteForSubmodule, PATH_TO_SUBMODULE } from './routes/appRoutes';

// Auth & Developer Views
import Login from './components/auth/Login';
import DeveloperSchoolManager from './components/developer/DeveloperSchoolManager';

// Submodule Views
import ExecutiveCommandCenter from './components/dashboard/ExecutiveCommandCenter';
import AdmissionDashboard from './components/dashboard/AdmissionDashboard';
import AdmitStudentForm from './components/admissions/AdmitStudentForm';
import ManageAdmissions from './components/admissions/ManageAdmissions';
import AdmitBulkExcel from './components/admissions/AdmitBulkExcel';
import AdmissionInquiries from './components/admissions/AdmissionInquiries';
import PrintAdmissionForm from './components/admissions/PrintAdmissionForm';
import StudentInformation from './components/students/StudentInformation';
import StudentPromotion from './components/students/StudentPromotion';
import GenerateIdCard from './components/students/GenerateIdCard';
import ManageClasses from './components/classes/ManageClasses';
import ManageSections from './components/classes/ManageSections';
import AddStaffForm from './components/staff/AddStaffForm';
import StaffDirectory from './components/staff/StaffDirectory';
import StudentAttendance from './components/attendance/StudentAttendance';
import StudentMonthlyRegister from './components/attendance/StudentMonthlyRegister';
import StaffAttendance from './components/attendance/StaffAttendance';
import StaffMonthlyRegister from './components/attendance/StaffMonthlyRegister';
import QrAttendanceScanner from './components/attendance/QrAttendanceScanner';
import StudentFeeGeneration from './components/financials/StudentFeeGeneration';
import StudentFeeManagement from './components/financials/StudentFeeManagement';
import FamilyFeeVoucher from './components/financials/FamilyFeeVoucher';
import StaffSalaryGeneration from './components/financials/StaffSalaryGeneration';
import PrintFeeVouchers from './components/financials/PrintFeeVouchers';
import ExpenseManagement from './components/financials/ExpenseManagement';
import ExamTermsManager from './components/exams/ExamTermsManager';
import ClassSubjectManager from './components/exams/ClassSubjectManager';
import ExamMarksEntry from './components/exams/ExamMarksEntry';
import PrintReportCards from './components/exams/PrintReportCards';
import AcademicSessionManager from './components/academic/AcademicSessionManager';
import StudentAttendanceReport from './components/reports/StudentAttendanceReport';
import StudentAdmissionReport from './components/reports/StudentAdmissionReport';
import FeeCollectionReport from './components/reports/FeeCollectionReport';
import PendingDuesReport from './components/reports/PendingDuesReport';
import ExpenseReport from './components/reports/ExpenseReport';
import StaffAttendanceReport from './components/reports/StaffAttendanceReport';
import StaffSalaryReport from './components/reports/StaffSalaryReport';
import ExamPerformanceReport from './components/reports/ExamPerformanceReport';
import ReportingCenter from './components/reports/ReportingCenter';

import { ShieldAlert } from 'lucide-react';

/**
 * Granular Sub-Module Route Guard:
 * Blocks unauthorized route navigation and renders a polite restricted access banner.
 */
function ProtectedSubmodule({ submoduleKey, element }) {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();

  if (!hasPermission(submoduleKey)) {
    const firstAllowedKey = user?.permissions?.[0];
    const fallbackRoute = firstAllowedKey ? getRouteForSubmodule(firstAllowedKey) : '/dashboard';

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 select-none">
        <div className="bg-white border border-red-200/80 rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Access Restricted</h2>
          <span className="inline-block mt-2 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-mono font-bold rounded-lg border border-red-200">
            Sub-module: {submoduleKey}
          </span>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Your user account does not have permission for this specific sub-module.
            Rights can be assigned from the Developer or School Administration panel.
          </p>
          <button
            onClick={() => navigate(fallbackRoute)}
            className="mt-6 w-full py-2.5 bg-[#041633] hover:bg-[#072454] text-[#ffa000] font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
          >
            Go to Permitted Workspace
          </button>
        </div>
      </div>
    );
  }

  return element;
}

function AppContent() {
  const {
    user,
    schoolCode,
    setSchoolCode,
    schoolName,
    schoolProfile,
    isAuthenticated,
    isSuperAdmin,
    hasPermission,
    loading,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  // Helper function passed to components that call setActiveSubModule
  const handleSetActiveSubModule = (target) => {
    const route = getRouteForSubmodule(target);
    navigate(route);
  };

  const activeSubModule = PATH_TO_SUBMODULE[location.pathname] || 'dashboard';

  // Responsive Sidebar Controls: Mobile Drawer & Desktop Mini Collapse
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // 1. Loading splash while verifying session
  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#041633] flex flex-col items-center justify-center text-white select-none">
        <div className="w-12 h-12 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-sm font-black tracking-wide text-amber-400 uppercase">
          {schoolProfile?.schoolName || schoolName || 'School Management Portal'}
        </div>
        <div className="text-xs text-slate-400 mt-1">Verifying Multi-Tenant Security & Sub-module Rights...</div>
      </div>
    );
  }

  // 2. Unauthenticated: Only Login Route is accessible
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 3. Authenticated: Render Main Application Shell with Granular Route Protection
  const firstAllowedKey = user?.permissions?.[0];
  const defaultHomeRoute = hasPermission('dashboard')
    ? ROUTES.DASHBOARD
    : firstAllowedKey
    ? getRouteForSubmodule(firstAllowedKey)
    : ROUTES.DASHBOARD;

  return (
    <AcademicSessionProvider schoolCode={schoolCode}>
      <AcademicClassesProvider schoolCode={schoolCode}>
        <div className="flex h-screen bg-[#f0f2f5] overflow-hidden font-sans relative">
          {/* Mobile Backdrop Overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* 1. Left Sidebar (Akkhor Dark Navy Theme with Mobile Drawer & Desktop Collapse) */}
          <Sidebar
            activeSubModule={activeSubModule}
            setActiveSubModule={handleSetActiveSubModule}
            schoolCode={schoolCode}
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
            isCollapsed={sidebarCollapsed}
            setIsCollapsed={setSidebarCollapsed}
          />

          {/* 2. Main Content Wrapper */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Top Navbar with Sidebar Toggle */}
            <Navbar
              schoolCode={schoolCode}
              setSchoolCode={setSchoolCode}
              activeSubModule={activeSubModule}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              sidebarCollapsed={sidebarCollapsed}
              setSidebarCollapsed={setSidebarCollapsed}
            />

            {/* Dynamic View Body with Mobile Responsive Padding */}
            <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 custom-scrollbar">
              <Routes>
                {/* Redirect /login when already authenticated */}
                <Route
                  path="/login"
                  element={<Navigate to={isSuperAdmin ? ROUTES.DEVELOPER_SCHOOLS : defaultHomeRoute} replace />}
                />

                {/* Developer Hub: Multi-Tenant Schools & Permissions Management */}
                <Route
                  path={ROUTES.DEVELOPER_SCHOOLS}
                  element={
                    isSuperAdmin ? (
                      <DeveloperSchoolManager />
                    ) : (
                      <Navigate to={defaultHomeRoute} replace />
                    )
                  }
                />

                {/* Home & Executive Command Center Dashboard */}
                <Route
                  path="/"
                  element={
                    hasPermission('dashboard') ? (
                      <ExecutiveCommandCenter
                        schoolCode={schoolCode}
                        setActiveSubModule={handleSetActiveSubModule}
                      />
                    ) : (
                      <Navigate to={defaultHomeRoute} replace />
                    )
                  }
                />
                <Route
                  path={ROUTES.DASHBOARD}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="dashboard"
                      element={
                        <ExecutiveCommandCenter
                          schoolCode={schoolCode}
                          setActiveSubModule={handleSetActiveSubModule}
                        />
                      }
                    />
                  }
                />

                {/* Academic & Classes */}
                <Route
                  path={ROUTES.ACADEMIC_SESSIONS}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="academic_sessions"
                      element={<AcademicSessionManager schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.CLASSES_MANAGE}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="manage_classes"
                      element={<ManageClasses schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.CLASSES_SECTIONS}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="manage_sections"
                      element={<ManageSections schoolCode={schoolCode} />}
                    />
                  }
                />

                {/* Admissions */}
                <Route
                  path={ROUTES.ADMISSIONS_ADMIT}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="admit_student"
                      element={
                        <AdmitStudentForm
                          schoolCode={schoolCode}
                          setActiveSubModule={handleSetActiveSubModule}
                        />
                      }
                    />
                  }
                />
                <Route
                  path={ROUTES.ADMISSIONS_MANAGE}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="manage_admissions"
                      element={<ManageAdmissions schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.ADMISSIONS_BULK}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="admit_bulk"
                      element={<AdmitBulkExcel schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.ADMISSIONS_INQUIRIES}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="inquiries"
                      element={<AdmissionInquiries schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.ADMISSIONS_PRINT}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="print_form"
                      element={<PrintAdmissionForm schoolCode={schoolCode} />}
                    />
                  }
                />

                {/* Student Management */}
                <Route
                  path={ROUTES.STUDENTS_DIRECTORY}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="student_info"
                      element={<StudentInformation schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.STUDENTS_PROMOTION}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="student_promotion"
                      element={<StudentPromotion schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.STUDENTS_ID_CARDS}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="generate_id_card"
                      element={<GenerateIdCard schoolCode={schoolCode} />}
                    />
                  }
                />

                {/* Staff & Faculty */}
                <Route
                  path={ROUTES.STAFF_ADD}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="add_staff"
                      element={<AddStaffForm schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.STAFF_DIRECTORY}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="staff_directory"
                      element={<StaffDirectory schoolCode={schoolCode} />}
                    />
                  }
                />

                {/* Attendance Center */}
                <Route
                  path={ROUTES.ATTENDANCE_STUDENT}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="student_attendance"
                      element={<StudentAttendance schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.ATTENDANCE_STUDENT_REGISTER}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="student_attendance_register"
                      element={<StudentMonthlyRegister schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.ATTENDANCE_STAFF}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="staff_attendance"
                      element={<StaffAttendance schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.ATTENDANCE_STAFF_REGISTER}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="staff_attendance_register"
                      element={<StaffMonthlyRegister schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.ATTENDANCE_QR_SCANNER}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="qr_scanner"
                      element={<QrAttendanceScanner schoolCode={schoolCode} />}
                    />
                  }
                />

                {/* Financials & Fees */}
                <Route
                  path={ROUTES.FINANCIALS_FEE_GEN}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="student_fee_generation"
                      element={<StudentFeeGeneration schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.FINANCIALS_FEE_MGMT}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="student_fee_management"
                      element={<StudentFeeManagement schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.FINANCIALS_FAMILY_VOUCHER}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="family_fee_voucher"
                      element={<FamilyFeeVoucher schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.FINANCIALS_STAFF_SALARY}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="staff_salary_generation"
                      element={<StaffSalaryGeneration schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.FINANCIALS_PRINT_VOUCHERS}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="fee_vouchers_print"
                      element={<PrintFeeVouchers schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.FINANCIALS_EXPENSES}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="school_expenses"
                      element={
                        <ExpenseManagement
                          schoolCode={schoolCode}
                          setActiveSubModule={handleSetActiveSubModule}
                        />
                      }
                    />
                  }
                />

                {/* Examinations & Report Cards */}
                <Route
                  path={ROUTES.EXAMS_TERMS}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="exam_terms"
                      element={<ExamTermsManager schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.EXAMS_SUBJECTS}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="exam_subjects"
                      element={<ClassSubjectManager schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.EXAMS_MARKS_ENTRY}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="exam_marks_entry"
                      element={<ExamMarksEntry schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.EXAMS_REPORT_CARDS}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="exam_report_cards"
                      element={<PrintReportCards schoolCode={schoolCode} />}
                    />
                  }
                />

                {/* Reports & Analytics */}
                <Route
                  path={ROUTES.REPORTS_CENTER}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="reports"
                      element={<ReportingCenter schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.REPORTS_ATTENDANCE}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="reports_attendance"
                      element={<StudentAttendanceReport schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.REPORTS_ADMISSION}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="reports_admission"
                      element={<StudentAdmissionReport schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.REPORTS_FEE_COLLECTION}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="reports_fee_collection"
                      element={<FeeCollectionReport schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.REPORTS_PENDING_DUES}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="reports_pending_dues"
                      element={<PendingDuesReport schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.REPORTS_EXPENSES}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="reports_expenses"
                      element={<ExpenseReport schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.REPORTS_STAFF_ATTENDANCE}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="reports_staff_attendance"
                      element={<StaffAttendanceReport schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.REPORTS_STAFF_SALARIES}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="reports_staff_salaries"
                      element={<StaffSalaryReport schoolCode={schoolCode} />}
                    />
                  }
                />
                <Route
                  path={ROUTES.REPORTS_EXAM_PERFORMANCE}
                  element={
                    <ProtectedSubmodule
                      submoduleKey="reports_exam_performance"
                      element={<ExamPerformanceReport schoolCode={schoolCode} />}
                    />
                  }
                />

                {/* Category-Level Redirects */}
                <Route path="/classes" element={<Navigate to={ROUTES.CLASSES_MANAGE} replace />} />
                <Route path="/admissions" element={<Navigate to={ROUTES.ADMISSIONS_ADMIT} replace />} />
                <Route path="/students" element={<Navigate to={ROUTES.STUDENTS_DIRECTORY} replace />} />
                <Route path="/staff" element={<Navigate to={ROUTES.STAFF_DIRECTORY} replace />} />
                <Route path="/attendance" element={<Navigate to={ROUTES.ATTENDANCE_STUDENT} replace />} />
                <Route path="/financials" element={<Navigate to={ROUTES.FINANCIALS_FEE_GEN} replace />} />
                <Route path="/exams" element={<Navigate to={ROUTES.EXAMS_SUBJECTS} replace />} />

                {/* Fallback to Default Home Route */}
                <Route path="*" element={<Navigate to={defaultHomeRoute} replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </AcademicClassesProvider>
    </AcademicSessionProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
