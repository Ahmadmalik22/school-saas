/**
 * Master Module & Sub-Module Catalog for Granular Role-Based Access Control (RBAC)
 * Every sub-module corresponds to an exact route and functionality in the application.
 */

export const SYSTEM_MODULES = [
  {
    id: 'dashboard',
    name: 'Executive Dashboard',
    icon: 'LayoutDashboard',
    submodules: [
      { id: 'dashboard', name: 'Executive Command Center', route: '/dashboard' },
    ],
  },
  {
    id: 'academic',
    name: 'Classes & Sessions',
    icon: 'School',
    submodules: [
      { id: 'academic_sessions', name: 'Academic Sessions', route: '/academic/sessions' },
      { id: 'manage_classes', name: 'Manage Classes', route: '/classes/manage' },
      { id: 'manage_sections', name: 'Manage Sections', route: '/classes/sections' },
    ],
  },
  {
    id: 'admissions',
    name: 'Admissions & Inquiries',
    icon: 'UserPlus',
    submodules: [
      { id: 'admit_student', name: 'Admit Student', route: '/admissions/admit' },
      { id: 'manage_admissions', name: 'Manage Admissions', route: '/admissions/manage' },
      { id: 'admit_bulk', name: 'Bulk Student Import', route: '/admissions/bulk' },
      { id: 'inquiries', name: 'Admission Inquiries', route: '/admissions/inquiries' },
      { id: 'print_form', name: 'Print Admission Forms', route: '/admissions/print-slip' },
    ],
  },
  {
    id: 'students',
    name: 'Student Management',
    icon: 'Users',
    submodules: [
      { id: 'student_info', name: 'Student Directory', route: '/students/directory' },
      { id: 'student_promotion', name: 'Student Class Promotion', route: '/students/promotion' },
      { id: 'generate_id_card', name: 'Student ID Cards', route: '/students/id-cards' },
    ],
  },
  {
    id: 'staff',
    name: 'Staff & Faculty',
    icon: 'Briefcase',
    submodules: [
      { id: 'add_staff', name: 'Add Staff Member', route: '/staff/add' },
      { id: 'staff_directory', name: 'Staff Directory', route: '/staff/directory' },
    ],
  },
  {
    id: 'attendance',
    name: 'Attendance Center',
    icon: 'Clock',
    submodules: [
      { id: 'student_attendance', name: 'Student Daily Attendance', route: '/attendance/student' },
      { id: 'student_attendance_register', name: 'Student Monthly Register', route: '/attendance/student-register' },
      { id: 'staff_attendance', name: 'Staff Daily Attendance', route: '/attendance/staff' },
      { id: 'staff_attendance_register', name: 'Staff Monthly Register', route: '/attendance/staff-register' },
      { id: 'qr_scanner', name: 'QR Attendance Scanner', route: '/attendance/qr-scanner' },
    ],
  },
  {
    id: 'financials',
    name: 'Financials & Fees',
    icon: 'CreditCard',
    submodules: [
      { id: 'student_fee_generation', name: 'Monthly Fee Generation', route: '/financials/fee-generation' },
      { id: 'student_fee_management', name: 'Fee Collection & Counter', route: '/financials/fee-management' },
      { id: 'family_fee_voucher', name: 'Family Sibling Voucher', route: '/financials/family-voucher' },
      { id: 'fee_vouchers_print', name: 'Print Fee Vouchers', route: '/financials/print-vouchers' },
      { id: 'school_expenses', name: 'Expense Management', route: '/financials/expenses' },
      { id: 'staff_salary_generation', name: 'Staff Salary & Payroll', route: '/financials/staff-salary' },
    ],
  },
  {
    id: 'exams',
    name: 'Examinations',
    icon: 'Award',
    submodules: [
      { id: 'exam_terms', name: 'Exam Terms Setup', route: '/exams/terms' },
      { id: 'exam_subjects', name: 'Class Subjects Setup', route: '/exams/subjects' },
      { id: 'exam_marks_entry', name: 'Marks Entry Sheet', route: '/exams/marks-entry' },
      { id: 'exam_report_cards', name: 'Print Report Cards', route: '/exams/report-cards' },
    ],
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    icon: 'FileText',
    submodules: [
      { id: 'reports', name: 'Reports Overview Hub', route: '/reports' },
      { id: 'reports_fee_collection', name: 'Fee Collection Report', route: '/reports/fee-collection' },
      { id: 'reports_pending_dues', name: 'Outstanding Dues / Defaulters', route: '/reports/pending-dues' },
      { id: 'reports_expenses', name: 'School Expense Report', route: '/reports/expenses' },
      { id: 'reports_admission', name: 'Admission & Enrollment Report', route: '/reports/admissions' },
      { id: 'reports_attendance', name: 'Student Attendance Report', route: '/reports/attendance' },
      { id: 'reports_staff_attendance', name: 'Staff Attendance Report', route: '/reports/staff-attendance' },
      { id: 'reports_staff_salaries', name: 'Staff Salaries Report', route: '/reports/staff-salaries' },
      { id: 'reports_exam_performance', name: 'Exam Merit & Performance', route: '/reports/exam-performance' },
    ],
  },
  {
    id: 'messaging',
    name: 'Message Alerts',
    icon: 'MessageSquare',
    submodules: [
      { id: 'absent_alerts', name: 'Absent Student Alerts', route: '/messaging/absent-alerts' },
      { id: 'class_diary', name: 'Daily Class Diary', route: '/messaging/class-diary' },
      { id: 'broadcast_announcements', name: 'Broadcast Announcements', route: '/messaging/broadcast' },
    ],
  },
];

// Flat array of all granular sub-module keys
export const ALL_SUBMODULE_KEYS = SYSTEM_MODULES.flatMap((m) =>
  m.submodules.map((s) => s.id)
);

// Helpful Role-Based Presets
export const ROLE_PRESETS = {
  ADMIN: ALL_SUBMODULE_KEYS,
  ACCOUNTANT: [
    'student_fee_management',
    'family_fee_voucher',
    'fee_vouchers_print',
    'school_expenses',
    'staff_salary_generation',
    'reports_fee_collection',
    'reports_pending_dues',
    'reports_expenses',
  ],
  CASHIER: [
    'student_fee_management',
    'family_fee_voucher',
  ],
  ADMISSION_OFFICER: [
    'admit_student',
    'manage_admissions',
    'admit_bulk',
    'inquiries',
    'print_form',
    'student_info',
    'generate_id_card',
    'reports_admission',
  ],
  EXAM_INCHARGE: [
    'exam_terms',
    'exam_subjects',
    'exam_marks_entry',
    'exam_report_cards',
    'reports_exam_performance',
  ],
  TEACHER: [
    'student_attendance',
    'student_attendance_register',
    'qr_scanner',
    'exam_marks_entry',
  ],
  CUSTOM: [],
};
