import FeeVoucher from '../models/FeeVoucher.js';
import Expense from '../models/Expense.js';
import StudentAttendance from '../models/StudentAttendance.js';
import StaffAttendance from '../models/StaffAttendance.js';
import Student from '../models/Student.js';
import AdmissionInquiry from '../models/AdmissionInquiry.js';

/**
 * Executive Daily Command Center Dashboard Controller
 * Aggregates all daily school metrics into a single high-performance summary.
 */
export const getDailyDashboardSummary = async (req, res) => {
  try {
    const { schoolCode, date } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();

    // Default to today in YYYY-MM-DD
    const todayStr = date || new Date().toISOString().split('T')[0];
    const [year, month, day] = todayStr.split('-').map(Number);

    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

    // 1. Fee Collections Today
    // Search by receiptDate on that day OR paymentHistory entries on that day
    const feeFilter = {
      schoolCode: code,
      paidAmount: { $gt: 0 },
      $or: [
        { receiptDate: { $gte: startOfDay, $lte: endOfDay } },
        { 'paymentHistory.paymentDate': { $gte: startOfDay, $lte: endOfDay } },
      ],
    };

    const feesToday = await FeeVoucher.find(feeFilter)
      .sort({ receiptDate: -1, updatedAt: -1 })
      .lean();

    let totalFeeCollectedToday = 0;
    let cashFeeToday = 0;
    let bankFeeToday = 0;

    feesToday.forEach((f) => {
      let todayPaidAmt = 0;
      const method = f.paymentMethod || 'CASH';

      if (f.paymentHistory && f.paymentHistory.length > 0) {
        const todayPayments = f.paymentHistory.filter(
          (p) => p.paymentDate && new Date(p.paymentDate) >= startOfDay && new Date(p.paymentDate) <= endOfDay
        );
        if (todayPayments.length > 0) {
          todayPayments.forEach((p) => {
            const pAmt = Number(p.amount) || 0;
            todayPaidAmt += pAmt;
            if (p.paymentMethod === 'BANK_TRANSFER' || p.paymentMethod === 'ONLINE') {
              bankFeeToday += pAmt;
            } else {
              cashFeeToday += pAmt;
            }
          });
        } else if (f.receiptDate && new Date(f.receiptDate) >= startOfDay && new Date(f.receiptDate) <= endOfDay) {
          todayPaidAmt = Number(f.paidAmount) || 0;
          if (method === 'BANK_TRANSFER' || method === 'ONLINE') bankFeeToday += todayPaidAmt;
          else cashFeeToday += todayPaidAmt;
        }
      } else {
        todayPaidAmt = Number(f.paidAmount) || 0;
        if (method === 'BANK_TRANSFER' || method === 'ONLINE') bankFeeToday += todayPaidAmt;
        else cashFeeToday += todayPaidAmt;
      }

      f._todayPaidAmt = todayPaidAmt;
      totalFeeCollectedToday += todayPaidAmt;
    });

    const feeBreakdownList = feesToday.map((f) => ({
      voucherNo: f.voucherNo,
      receiptNo: f.receiptNo || '—',
      receiptDate: f.receiptDate ? new Date(f.receiptDate).toISOString().split('T')[0] : todayStr,
      studentName: f.studentName,
      rollNumber: f.rollNumber || '—',
      className: f.className,
      section: f.section,
      monthYear: f.monthYear,
      paidAmount: f._todayPaidAmt !== undefined ? f._todayPaidAmt : (Number(f.paidAmount) || 0),
      paymentMethod: f.paymentMethod || 'CASH',
      receivedBy: f.receivedBy || 'School Accountant',
      status: f.status,
    }));

    // 2. Student Attendance Today
    const studentAttendanceSheets = await StudentAttendance.find({
      schoolCode: code,
      $or: [
        { dateString: todayStr },
        { date: { $gte: startOfDay, $lte: endOfDay } },
      ],
    }).lean();

    let studentEnrolledCount = 0;
    let studentPresentCount = 0;
    let studentAbsentCount = 0;
    let studentLeaveCount = 0;

    const classAttendanceMap = {};
    const todayAbsenteesList = [];

    studentAttendanceSheets.forEach((sheet) => {
      const cKey = `${sheet.className}__${sheet.section}`;
      if (!classAttendanceMap[cKey]) {
        classAttendanceMap[cKey] = {
          className: sheet.className,
          section: sheet.section,
          total: 0,
          present: 0,
          absent: 0,
          leave: 0,
        };
      }

      (sheet.records || []).forEach((rec) => {
        studentEnrolledCount++;
        classAttendanceMap[cKey].total++;

        if (rec.status === 'PRESENT') {
          studentPresentCount++;
          classAttendanceMap[cKey].present++;
        } else if (rec.status === 'ABSENT') {
          studentAbsentCount++;
          classAttendanceMap[cKey].absent++;
          todayAbsenteesList.push({
            studentId: rec.studentId,
            studentName: rec.studentName,
            rollNumber: rec.rollNumber || '—',
            admissionNumber: rec.admissionNumber || '—',
            className: sheet.className,
            section: sheet.section,
            fatherName: rec.fatherName || '—',
            fatherPhone: '—', // Enriched below
            remarks: rec.remarks || 'Absent today',
          });
        } else if (rec.status === 'LEAVE') {
          studentLeaveCount++;
          classAttendanceMap[cKey].leave++;
        }
      });
    });

    // Enrich absentees with father contact phone from Student collection
    if (todayAbsenteesList.length > 0) {
      const studentIds = todayAbsenteesList.map((a) => a.studentId).filter(Boolean);
      const studentDocs = await Student.find(
        { _id: { $in: studentIds } },
        { fatherPhone: 1, emergencyContact: 1 }
      ).lean();

      const phoneMap = new Map(studentDocs.map((s) => [String(s._id), s.fatherPhone || s.emergencyContact || '—']));
      todayAbsenteesList.forEach((a) => {
        if (a.studentId && phoneMap.has(String(a.studentId))) {
          a.fatherPhone = phoneMap.get(String(a.studentId));
        }
      });
    }

    const studentAttendanceRate =
      studentEnrolledCount > 0
        ? Number(((studentPresentCount / studentEnrolledCount) * 100).toFixed(1))
        : 0;

    const classAttendanceBreakdown = Object.values(classAttendanceMap).map((c) => ({
      ...c,
      rate: c.total > 0 ? Number(((c.present / c.total) * 100).toFixed(1)) : 0,
    })).sort((a, b) => a.className.localeCompare(b.className));

    // 3. Staff Attendance Today
    const staffAttendanceSheet = await StaffAttendance.findOne({
      schoolCode: code,
      $or: [
        { dateString: todayStr },
        { date: { $gte: startOfDay, $lte: endOfDay } },
      ],
    }).lean();

    let staffTotalCount = 0;
    let staffPresentCount = 0;
    let staffAbsentCount = 0;
    let staffLeaveCount = 0;
    let staffLateCount = 0;
    const staffRosterToday = [];

    if (staffAttendanceSheet) {
      (staffAttendanceSheet.records || []).forEach((rec) => {
        staffTotalCount++;
        if (rec.status === 'PRESENT') staffPresentCount++;
        else if (rec.status === 'ABSENT') staffAbsentCount++;
        else if (rec.status === 'LEAVE') staffLeaveCount++;
        else if (rec.status === 'LATE') staffLateCount++;

        staffRosterToday.push({
          employeeId: rec.employeeId,
          name: rec.name,
          role: rec.role || 'Teacher',
          department: rec.department || 'General',
          status: rec.status,
          timeIn: rec.timeIn || '—',
          timeOut: rec.timeOut || '—',
          remarks: rec.remarks || '',
        });
      });
    }

    const staffAttendanceRate =
      staffTotalCount > 0
        ? Number(((staffPresentCount / staffTotalCount) * 100).toFixed(1))
        : 0;

    // 4. School Expenses Today
    const expensesToday = await Expense.find({
      schoolCode: code,
      $or: [
        { dateString: todayStr },
        { expenseDate: { $gte: startOfDay, $lte: endOfDay } },
      ],
    }).sort({ createdAt: -1 }).lean();

    let totalExpenseToday = 0;
    expensesToday.forEach((e) => {
      totalExpenseToday += Number(e.amount) || 0;
    });

    const expenseBreakdownList = expensesToday.map((e) => ({
      voucherNo: e.voucherNo,
      categoryName: e.categoryName,
      amount: Number(e.amount) || 0,
      remarks: e.remarks || '—',
      recordedBy: e.recordedBy || 'School Accountant',
      dateString: e.dateString || todayStr,
    }));

    // 5. New Admissions & Total Enrolled Strength
    const totalActiveStudents = await Student.countDocuments({ schoolCode: code, status: 'ACTIVE' });

    // Admissions Today
    const admissionsToday = await Student.find({
      schoolCode: code,
      admissionDate: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    // Admissions this month
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const admissionsThisMonthCount = await Student.countDocuments({
      schoolCode: code,
      admissionDate: { $gte: startOfMonth, $lte: endOfDay },
    });

    // Open inquiries
    const openInquiriesCount = await AdmissionInquiry.countDocuments({
      schoolCode: code,
      status: 'OPEN',
    });

    const recentAdmissionsList = await Student.find({ schoolCode: code })
      .sort({ admissionDate: -1, createdAt: -1 })
      .limit(10)
      .lean();

    // 6. Outstanding Fee Dues & Defaulters Alert
    const pendingDuesVouchers = await FeeVoucher.find({
      schoolCode: code,
      balance: { $gt: 0 },
      status: { $in: ['UNPAID', 'PARTIALLY_PAID'] },
    }).lean();

    let grandTotalPendingDues = 0;
    const defaulterStudentMap = new Map();

    pendingDuesVouchers.forEach((v) => {
      const bal = Number(v.balance) || 0;
      grandTotalPendingDues += bal;

      const sId = String(v.studentId);
      if (!defaulterStudentMap.has(sId)) {
        defaulterStudentMap.set(sId, {
          studentId: v.studentId,
          studentName: v.studentName,
          fatherName: v.fatherName || '—',
          rollNumber: v.rollNumber || '—',
          className: v.className,
          section: v.section,
          totalPending: 0,
          pendingMonths: [],
        });
      }

      const entry = defaulterStudentMap.get(sId);
      entry.totalPending += bal;
      if (!entry.pendingMonths.includes(v.monthYear)) {
        entry.pendingMonths.push(v.monthYear);
      }
    });

    const topDefaulters = Array.from(defaulterStudentMap.values())
      .map((d) => ({
        ...d,
        monthsDueCount: d.pendingMonths.length,
        pendingMonthsStr: d.pendingMonths.join(', '),
      }))
      .sort((a, b) => b.totalPending - a.totalPending)
      .slice(0, 15);

    // 7. Today's Net Operating Cash Balance
    const netCashToday = totalFeeCollectedToday - totalExpenseToday;

    return res.status(200).json({
      success: true,
      date: todayStr,
      schoolCode: code,
      summary: {
        // Fee Collection Today
        feeCollection: {
          totalCollected: totalFeeCollectedToday,
          totalToday: totalFeeCollectedToday,
          voucherCount: feesToday.length,
          cashCollected: cashFeeToday,
          cashToday: cashFeeToday,
          bankCollected: bankFeeToday,
          bankToday: bankFeeToday,
        },
        // Student Attendance Today
        studentAttendance: {
          enrolledCount: studentEnrolledCount || totalActiveStudents,
          presentCount: studentPresentCount,
          absentCount: studentAbsentCount,
          leaveCount: studentLeaveCount,
          attendanceRate: studentAttendanceRate,
          hasMarkedAttendance: studentAttendanceSheets.length > 0,
        },
        // Staff Attendance Today
        staffAttendance: {
          totalStaff: staffTotalCount,
          presentCount: staffPresentCount,
          absentCount: staffAbsentCount,
          leaveCount: staffLeaveCount,
          lateCount: staffLateCount,
          attendanceRate: staffAttendanceRate,
          hasMarkedAttendance: !!staffAttendanceSheet,
        },
        // Expenses Today
        expenses: {
          totalExpense: totalExpenseToday,
          voucherCount: expensesToday.length,
        },
        // Net Cash Today
        financialPulse: {
          feeCollected: totalFeeCollectedToday,
          expenses: totalExpenseToday,
          netOperatingCash: netCashToday,
          isPositive: netCashToday >= 0,
        },
        // Admissions Strength
        admissions: {
          totalActiveEnrolled: totalActiveStudents,
          admittedToday: admissionsToday.length,
          admittedThisMonth: admissionsThisMonthCount,
          openInquiries: openInquiriesCount,
        },
        // Pending Dues Alert
        pendingDues: {
          totalPendingAmount: grandTotalPendingDues,
          totalDefaulters: defaulterStudentMap.size,
        },
      },
      // Drill-down breakdown lists for interactive modal cards
      breakdowns: {
        feeCollectionToday: feeBreakdownList,
        todayAbsentees: todayAbsenteesList,
        classAttendance: classAttendanceBreakdown,
        staffRosterToday: staffRosterToday,
        expensesToday: expenseBreakdownList,
        topDefaulters: topDefaulters,
        recentAdmissions: recentAdmissionsList.map((s) => ({
          admissionNumber: s.admissionNumber,
          fullName: s.fullName,
          fatherName: s.fatherName || '—',
          className: s.className,
          section: s.section,
          admissionDate: s.admissionDate ? new Date(s.admissionDate).toISOString().split('T')[0] : '—',
          admissionFee: s.admissionFee ?? 0,
          status: s.status,
        })),
      },
    });
  } catch (error) {
    console.error('Error in getDailyDashboardSummary:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
