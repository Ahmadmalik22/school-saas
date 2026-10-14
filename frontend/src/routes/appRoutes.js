/**
 * App Route Definitions & Path Mappings
 * Enables full URL routing, browser history, bookmarks, and deep links.
 */

export const ROUTES = {
  DASHBOARD: '/dashboard',
  ACADEMIC_SESSIONS: '/academic/sessions',
  CLASSES_MANAGE: '/classes/manage',
  CLASSES_SECTIONS: '/classes/sections',
  ADMISSIONS_ADMIT: '/admissions/admit',
  ADMISSIONS_MANAGE: '/admissions/manage',
  ADMISSIONS_BULK: '/admissions/bulk',
  ADMISSIONS_INQUIRIES: '/admissions/inquiries',
  ADMISSIONS_PRINT: '/admissions/print-slip',
  STUDENTS_DIRECTORY: '/students/directory',
  STUDENTS_PROMOTION: '/students/promotion',
  STAFF_ADD: '/staff/add',
  STAFF_DIRECTORY: '/staff/directory',
  ATTENDANCE_STUDENT: '/attendance/student',
  ATTENDANCE_STUDENT_REGISTER: '/attendance/student-register',
  ATTENDANCE_STAFF: '/attendance/staff',
  ATTENDANCE_STAFF_REGISTER: '/attendance/staff-register',
  FINANCIALS_FEE_GEN: '/financials/fee-generation',
  FINANCIALS_FEE_MGMT: '/financials/fee-management',
  FINANCIALS_FAMILY_VOUCHER: '/financials/family-voucher',
  FINANCIALS_STAFF_SALARY: '/financials/staff-salary',
  FINANCIALS_PRINT_VOUCHERS: '/financials/print-vouchers',
  FINANCIALS_EXPENSES: '/financials/expenses',
  EXAMS_TERMS: '/exams/terms',
  EXAMS_SUBJECTS: '/exams/subjects',
  EXAMS_MARKS_ENTRY: '/exams/marks-entry',
  EXAMS_REPORT_CARDS: '/exams/report-cards',
  REPORTS_CENTER: '/reports',
  REPORTS_ATTENDANCE: '/reports/attendance',
  REPORTS_ADMISSION: '/reports/admissions',
  REPORTS_FEE_COLLECTION: '/reports/fee-collection',
  REPORTS_PENDING_DUES: '/reports/pending-dues',
  REPORTS_EXPENSES: '/reports/expenses',
  REPORTS_STAFF_ATTENDANCE: '/reports/staff-attendance',
  REPORTS_STAFF_SALARIES: '/reports/staff-salaries',
  REPORTS_EXAM_PERFORMANCE: '/reports/exam-performance',
  DEVELOPER_SCHOOLS: '/developer/schools',
};

// Maps legacy submodule key to Route path
export const SUBMODULE_TO_PATH = {
  dashboard: ROUTES.DASHBOARD,
  academic_sessions: ROUTES.ACADEMIC_SESSIONS,
  manage_classes: ROUTES.CLASSES_MANAGE,
  manage_sections: ROUTES.CLASSES_SECTIONS,
  admit_student: ROUTES.ADMISSIONS_ADMIT,
  manage_admissions: ROUTES.ADMISSIONS_MANAGE,
  admit_bulk: ROUTES.ADMISSIONS_BULK,
  inquiries: ROUTES.ADMISSIONS_INQUIRIES,
  print_form: ROUTES.ADMISSIONS_PRINT,
  student_info: ROUTES.STUDENTS_DIRECTORY,
  student_promotion: ROUTES.STUDENTS_PROMOTION,
  add_staff: ROUTES.STAFF_ADD,
  staff_directory: ROUTES.STAFF_DIRECTORY,
  student_attendance: ROUTES.ATTENDANCE_STUDENT,
  student_attendance_register: ROUTES.ATTENDANCE_STUDENT_REGISTER,
  staff_attendance: ROUTES.ATTENDANCE_STAFF,
  staff_attendance_register: ROUTES.ATTENDANCE_STAFF_REGISTER,
  student_fee_generation: ROUTES.FINANCIALS_FEE_GEN,
  student_fee_management: ROUTES.FINANCIALS_FEE_MGMT,
  family_fee_voucher: ROUTES.FINANCIALS_FAMILY_VOUCHER,
  staff_salary_generation: ROUTES.FINANCIALS_STAFF_SALARY,
  fee_vouchers_print: ROUTES.FINANCIALS_PRINT_VOUCHERS,
  school_expenses: ROUTES.FINANCIALS_EXPENSES,
  exam_terms: ROUTES.EXAMS_TERMS,
  exam_subjects: ROUTES.EXAMS_SUBJECTS,
  exam_marks_entry: ROUTES.EXAMS_MARKS_ENTRY,
  exam_report_cards: ROUTES.EXAMS_REPORT_CARDS,
  reports: ROUTES.REPORTS_CENTER,
  reports_attendance: ROUTES.REPORTS_ATTENDANCE,
  reports_admission: ROUTES.REPORTS_ADMISSION,
  reports_fee_collection: ROUTES.REPORTS_FEE_COLLECTION,
  reports_pending_dues: ROUTES.REPORTS_PENDING_DUES,
  reports_expenses: ROUTES.REPORTS_EXPENSES,
  reports_staff_attendance: ROUTES.REPORTS_STAFF_ATTENDANCE,
  reports_staff_salaries: ROUTES.REPORTS_STAFF_SALARIES,
  reports_exam_performance: ROUTES.REPORTS_EXAM_PERFORMANCE,
};

// Maps Route path to legacy submodule key
export const PATH_TO_SUBMODULE = Object.entries(SUBMODULE_TO_PATH).reduce(
  (acc, [k, v]) => ({ ...acc, [v]: k }),
  { '/': 'dashboard' }
);

export const getRouteForSubmodule = (key) => {
  if (!key) return ROUTES.DASHBOARD;
  if (key.startsWith('/')) return key;
  return SUBMODULE_TO_PATH[key] || ROUTES.DASHBOARD;
};
