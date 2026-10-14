import FeeVoucher from '../models/FeeVoucher.js';
import Expense from '../models/Expense.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import Student from '../models/Student.js';
import StudentAttendance from '../models/StudentAttendance.js';
import StudentExamMarks from '../models/StudentExamMarks.js';
import ExamTerm from '../models/ExamTerm.js';
import ClassSubject from '../models/ClassSubject.js';
import SchoolProfile from '../models/SchoolProfile.js';
import StaffAttendance from '../models/StaffAttendance.js';
import StaffSalary from '../models/StaffSalary.js';
import Staff from '../models/Staff.js';

/**
 * 1. Fee Collection & Defaulters Report
 */
export const getFeeCollectionReport = async (req, res) => {
  try {
    const {
      schoolCode,
      academicSession,
      className,
      section,
      monthYear,
      fromDate,
      toDate,
      dateFilterField = 'receiptDate', // 'receiptDate' or 'issueDate'
      status, // ALL, PAID, PARTIALLY_PAID, UNPAID
      paymentMethod, // ALL, CASH, BANK_TRANSFER, ONLINE, CHEQUE
      receivedBy, // ALL or specific accountant name
      rollNumbers, // single roll or comma-separated e.g. "101, 102"
    } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();
    const filter = { schoolCode: code };

    if (className && className !== 'ALL') filter.className = className;
    if (section && section !== 'ALL') filter.section = section;
    if (monthYear && monthYear !== 'ALL') filter.monthYear = monthYear;
    if (status && status !== 'ALL') filter.status = status;
    if (paymentMethod && paymentMethod !== 'ALL') filter.paymentMethod = paymentMethod;
    if (receivedBy && receivedBy !== 'ALL') {
      filter.receivedBy = new RegExp(`^${receivedBy.trim()}$`, 'i');
    }

    // Roll number(s) filtering
    if (rollNumbers && rollNumbers.trim()) {
      const rolls = rollNumbers.split(/[, ]+/).map((r) => r.trim()).filter(Boolean);
      if (rolls.length === 1) {
        filter.rollNumber = new RegExp(`^${rolls[0]}$`, 'i');
      } else if (rolls.length > 1) {
        filter.rollNumber = { $in: rolls };
      }
    }

    // Date range filter
    if (fromDate || toDate) {
      const field = dateFilterField === 'issueDate' ? 'issueDate' : 'receiptDate';
      filter[field] = {};
      if (fromDate) filter[field].$gte = new Date(fromDate);
      if (toDate) {
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999);
        filter[field].$lte = toD;
      }
    }

    const vouchers = await FeeVoucher.find(filter)
      .sort({ className: 1, section: 1, rollNumber: 1, createdAt: -1 })
      .lean();

    // Summary calculations & Class-Section Breakdown
    let totalInvoiced = 0;
    let totalDiscount = 0;
    let totalCollected = 0;
    let totalBalance = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    const classSecMap = {};

    vouchers.forEach((v) => {
      const payable = Number(v.totalPayableWithinDueDate) || 0;
      const discount = Number(v.discount) || 0;
      const paid = Number(v.paidAmount) || 0;
      const bal = Number(v.balance) || 0;

      totalInvoiced += payable;
      totalDiscount += discount;
      totalCollected += paid;
      totalBalance += bal;

      if (v.status === 'PAID') paidCount++;
      else if (v.status === 'PARTIALLY_PAID') partialCount++;
      else unpaidCount++;

      const key = `${v.className || 'Unknown'}__${v.section || 'All'}`;
      if (!classSecMap[key]) {
        classSecMap[key] = {
          className: v.className || 'Unknown',
          section: v.section || 'All',
          voucherCount: 0,
          totalInvoiced: 0,
          totalDiscount: 0,
          totalCollected: 0,
          totalBalance: 0,
          paidCount: 0,
          partialCount: 0,
          unpaidCount: 0,
        };
      }

      classSecMap[key].voucherCount++;
      classSecMap[key].totalInvoiced += payable;
      classSecMap[key].totalDiscount += discount;
      classSecMap[key].totalCollected += paid;
      classSecMap[key].totalBalance += bal;

      if (v.status === 'PAID') classSecMap[key].paidCount++;
      else if (v.status === 'PARTIALLY_PAID') classSecMap[key].partialCount++;
      else classSecMap[key].unpaidCount++;
    });

    const summarizedList = Object.values(classSecMap).map((item) => ({
      ...item,
      collectionRate: item.totalInvoiced > 0 ? Number(((item.totalCollected / item.totalInvoiced) * 100).toFixed(1)) : 0,
    })).sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.section.localeCompare(b.section);
    });

    const detailedBreakdown = vouchers.map((v) => ({
      _id: v._id,
      voucherNo: v.voucherNo,
      receiptNo: v.receiptNo || '—',
      receiptDate: v.receiptDate ? new Date(v.receiptDate).toISOString().split('T')[0] : '—',
      issueDate: v.issueDate ? new Date(v.issueDate).toISOString().split('T')[0] : '—',
      dueDate: v.dueDate ? new Date(v.dueDate).toISOString().split('T')[0] : '—',
      rollNumber: v.rollNumber || '—',
      studentName: v.studentName,
      fatherName: v.fatherName || '—',
      className: v.className,
      section: v.section,
      monthYear: v.monthYear,
      baseMonthlyFee: v.baseMonthlyFee || 0,
      discount: v.discount || 0,
      totalPayable: v.totalPayableWithinDueDate || 0,
      paidAmount: v.paidAmount || 0,
      balance: v.balance || 0,
      paymentMethod: v.paymentMethod || 'CASH',
      receivedBy: v.receivedBy || 'School Accountant',
      status: v.status || 'UNPAID',
    }));

    const totalVouchers = vouchers.length;
    const collectionRate = totalInvoiced > 0 ? Number(((totalCollected / totalInvoiced) * 100).toFixed(2)) : 0;

    // Get list of all accountants who collected fees in this school
    const distinctAccountants = await FeeVoucher.distinct('receivedBy', { schoolCode: code });
    const accountants = Array.from(new Set(['School Accountant', ...distinctAccountants.filter(Boolean)]));

    return res.status(200).json({
      success: true,
      summary: {
        totalVouchers,
        totalInvoiced,
        totalDiscount,
        totalCollected,
        totalBalance,
        paidCount,
        partialCount,
        unpaidCount,
        defaultersCount: unpaidCount + partialCount,
        collectionRate,
      },
      accountants,
      summarizedList,
      detailedBreakdown,
      data: detailedBreakdown,
    });
  } catch (error) {
    console.error('Error in getFeeCollectionReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. School Financial Cash Flow / Income vs Expense Report
 */
export const getFinancialSummaryReport = async (req, res) => {
  try {
    const { schoolCode, monthYear, fromDate, toDate, categoryId } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();

    // Build filter for Fee Collections (Income)
    const feeFilter = { schoolCode: code, paidAmount: { $gt: 0 } };
    if (monthYear && monthYear !== 'ALL') feeFilter.monthYear = monthYear;
    if (fromDate || toDate) {
      feeFilter.receiptDate = {};
      if (fromDate) feeFilter.receiptDate.$gte = new Date(fromDate);
      if (toDate) {
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999);
        feeFilter.receiptDate.$lte = toD;
      }
    }

    const feePayments = await FeeVoucher.find(feeFilter, {
      voucherNo: 1,
      studentName: 1,
      className: 1,
      section: 1,
      paidAmount: 1,
      receiptDate: 1,
      receiptNo: 1,
      paymentMethod: 1,
      monthYear: 1,
    })
      .sort({ receiptDate: -1 })
      .lean();

    const totalFeeIncome = feePayments.reduce((sum, f) => sum + (Number(f.paidAmount) || 0), 0);

    // Build filter for Expenses
    const expenseFilter = { schoolCode: code };
    if (monthYear && monthYear !== 'ALL') expenseFilter.monthYear = monthYear;
    if (categoryId && categoryId !== 'ALL') expenseFilter.categoryId = categoryId;
    if (fromDate || toDate) {
      expenseFilter.expenseDate = {};
      if (fromDate) expenseFilter.expenseDate.$gte = new Date(fromDate);
      if (toDate) {
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999);
        expenseFilter.expenseDate.$lte = toD;
      }
    }

    const expenses = await Expense.find(expenseFilter).sort({ expenseDate: -1 }).lean();
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Category breakdown
    const categoryMap = {};
    expenses.forEach((e) => {
      const cat = e.categoryName || 'Other';
      categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.amount) || 0);
    });

    const categoryBreakdown = Object.entries(categoryMap).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.amount - a.amount);

    const netOperatingBalance = totalFeeIncome - totalExpenses;

    return res.status(200).json({
      success: true,
      summary: {
        totalFeeIncome,
        totalExpenses,
        netOperatingBalance,
        isProfitable: netOperatingBalance >= 0,
        totalExpenseTransactions: expenses.length,
        totalFeeTransactions: feePayments.length,
      },
      categoryBreakdown,
      expenses,
      feePayments: feePayments.slice(0, 50), // Sample recent receipts
    });
  } catch (error) {
    console.error('Error in getFinancialSummaryReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Student Enrollment & Class Strength Demographics Report
 */
export const getStudentEnrollmentReport = async (req, res) => {
  try {
    const {
      schoolCode,
      academicSession,
      className,
      section,
      gender,
      status,
      fromDate,
      toDate,
    } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();
    const filter = { schoolCode: code };

    if (academicSession && academicSession !== 'ALL') filter.academicSession = academicSession;
    if (className && className !== 'ALL') filter.className = className;
    if (section && section !== 'ALL') filter.section = section;
    if (gender && gender !== 'ALL') filter.gender = gender;
    if (status && status !== 'ALL') filter.status = status;

    if (fromDate || toDate) {
      filter.admissionDate = {};
      if (fromDate) filter.admissionDate.$gte = new Date(fromDate);
      if (toDate) {
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999);
        filter.admissionDate.$lte = toD;
      }
    }

    const students = await Student.find(filter)
      .sort({ className: 1, section: 1, rollNumber: 1 })
      .lean();

    // Calculate Demographic & Class-Section Breakdown Statistics
    const totalStudents = students.length;
    let maleCount = 0;
    let femaleCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;
    const classSecMap = {};

    students.forEach((s) => {
      const g = (s.gender || 'OTHER').toUpperCase();
      const st = (s.status || 'ACTIVE').toUpperCase();

      if (st === 'ACTIVE') activeCount++;
      else inactiveCount++;

      if (g === 'FEMALE') femaleCount++;
      else maleCount++;

      const key = `${s.className || 'Unknown'}__${s.section || 'All'}`;
      if (!classSecMap[key]) {
        classSecMap[key] = {
          className: s.className || 'Unknown',
          section: s.section || 'All',
          maleCount: 0,
          femaleCount: 0,
          activeCount: 0,
          inactiveCount: 0,
          totalEnrolled: 0,
        };
      }

      if (g === 'FEMALE') classSecMap[key].femaleCount++;
      else classSecMap[key].maleCount++;

      if (st === 'ACTIVE') classSecMap[key].activeCount++;
      else classSecMap[key].inactiveCount++;

      classSecMap[key].totalEnrolled++;
    });

    const summarizedList = Object.values(classSecMap).sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.section.localeCompare(b.section);
    });

    // Detailed Individual Student Ledger
    const detailedBreakdown = students.map((s) => ({
      _id: s._id,
      admissionNumber: s.admissionNumber || '—',
      admissionDate: s.admissionDate ? new Date(s.admissionDate).toISOString().split('T')[0] : '—',
      rollNumber: s.rollNumber || '—',
      fullName: s.fullName,
      fatherName: s.fatherName || '—',
      gender: s.gender || '—',
      className: s.className,
      section: s.section,
      fatherPhone: s.fatherPhone || s.emergencyContact || '—',
      bFormOrCnic: s.bFormOrCnic || '—',
      admissionFee: s.admissionFee ?? 0,
      monthlyFee: s.netMonthlyFee ?? s.monthlyFee ?? 0,
      status: s.status || 'ACTIVE',
    }));

    return res.status(200).json({
      success: true,
      summary: {
        totalStudents,
        maleCount,
        femaleCount,
        activeCount,
        inactiveCount,
        totalClassesRepresented: summarizedList.length,
      },
      summarizedList,
      detailedBreakdown,
      classBreakdown: summarizedList,
      data: detailedBreakdown,
    });
  } catch (error) {
    console.error('Error in getStudentEnrollmentReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Student Attendance & Chronic Absenteeism Report
 */
export const getAttendanceSummaryReport = async (req, res) => {
  try {
    const {
      schoolCode,
      academicSession,
      className,
      section,
      monthYear,
      fromDate,
      toDate,
    } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();
    const filter = { schoolCode: code };

    if (academicSession && academicSession !== 'ALL') filter.academicSession = academicSession;
    if (className && className !== 'ALL') filter.className = className;
    if (section && section !== 'ALL') filter.section = section;
    if (monthYear && monthYear !== 'ALL') filter.monthYear = monthYear;

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) {
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999);
        filter.date.$lte = toD;
      }
    }

    const attendanceSheets = await StudentAttendance.find(filter).sort({ date: -1 }).lean();

    // Roll up per-student statistics
    const studentStats = new Map();
    let totalPresentOverall = 0;
    let totalAbsentOverall = 0;
    let totalLeaveOverall = 0;
    let totalRecordedInstances = 0;

    attendanceSheets.forEach((sheet) => {
      (sheet.records || []).forEach((rec) => {
        const sId = String(rec.studentId);
        if (!studentStats.has(sId)) {
          studentStats.set(sId, {
            studentId: rec.studentId,
            studentName: rec.studentName,
            fatherName: rec.fatherName || '—',
            admissionNumber: rec.admissionNumber,
            rollNumber: rec.rollNumber,
            className: sheet.className,
            section: sheet.section,
            presentDays: 0,
            absentDays: 0,
            leaveDays: 0,
            totalDays: 0,
          });
        }

        const stat = studentStats.get(sId);
        stat.totalDays++;
        totalRecordedInstances++;

        if (rec.status === 'PRESENT') {
          stat.presentDays++;
          totalPresentOverall++;
        } else if (rec.status === 'ABSENT') {
          stat.absentDays++;
          totalAbsentOverall++;
        } else if (rec.status === 'LEAVE') {
          stat.leaveDays++;
          totalLeaveOverall++;
        }
      });
    });

    // Compute percentages and identify chronic absentees (< 75% attendance)
    let chronicAbsenteesCount = 0;
    const roster = Array.from(studentStats.values()).map((s) => {
      const attendancePercent = s.totalDays > 0 ? Number(((s.presentDays / s.totalDays) * 100).toFixed(1)) : 0;
      const isChronicAbsent = attendancePercent < 75 && s.totalDays >= 3;
      if (isChronicAbsent) chronicAbsenteesCount++;
      return {
        ...s,
        attendancePercent,
        isChronicAbsent,
      };
    }).sort((a, b) => b.attendancePercent - a.attendancePercent);

    const overallRate = totalRecordedInstances > 0
      ? Number(((totalPresentOverall / totalRecordedInstances) * 100).toFixed(1))
      : 0;

    // Also gather flattened detailed breakdown by date & student
    const detailedBreakdown = [];
    attendanceSheets.forEach((sheet) => {
      (sheet.records || []).forEach((rec) => {
        detailedBreakdown.push({
          date: sheet.dateString || (sheet.date ? new Date(sheet.date).toISOString().split('T')[0] : ''),
          className: sheet.className,
          section: sheet.section,
          studentId: rec.studentId,
          studentName: rec.studentName,
          fatherName: rec.fatherName || '—',
          rollNumber: rec.rollNumber || '—',
          admissionNumber: rec.admissionNumber || '—',
          status: rec.status,
          remarks: rec.remarks || '',
        });
      });
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalSheets: attendanceSheets.length,
        totalStudentsAnalyzed: roster.length,
        totalPresentOverall,
        totalAbsentOverall,
        totalLeaveOverall,
        overallAttendanceRate: overallRate,
        chronicAbsenteesCount,
      },
      summaryList: roster,
      detailedBreakdown,
      data: roster,
    });
  } catch (error) {
    console.error('Error in getAttendanceSummaryReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Academic Performance & Merit Positions Report
 */
export const getExamPerformanceReport = async (req, res) => {
  try {
    const {
      schoolCode,
      academicSession = '2025-2026',
      className,
      section,
      termName,
    } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();
    const filter = { schoolCode: code, academicSession };

    if (className && className !== 'ALL') filter.className = className;
    if (section && section !== 'ALL') filter.section = section;
    if (termName && termName !== 'ALL') filter.termName = termName;

    const examRecords = await StudentExamMarks.find(filter)
      .sort({ grandTotalObtained: -1, overallPercentage: -1 })
      .lean();

    if (examRecords.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          totalStudents: 0,
          passCount: 0,
          failCount: 0,
          passRate: 0,
          classAverage: 0,
          highestScore: 0,
        },
        meritList: [],
        subjectBreakdown: [],
      });
    }

    // Merit Ranking
    let totalObtainedSum = 0;
    let passCount = 0;
    let failCount = 0;
    const subjectScoresMap = {};

    const meritList = examRecords.map((rec, index) => {
      const pct = Number(rec.overallPercentage) || 0;
      const isPass = pct >= 40;
      if (isPass) passCount++;
      else failCount++;

      totalObtainedSum += Number(rec.grandTotalObtained) || 0;

      // Subject stats
      (rec.subjectMarks || []).forEach((sm) => {
        const sub = sm.subjectName;
        if (!subjectScoresMap[sub]) {
          subjectScoresMap[sub] = {
            subjectName: sub,
            totalStudents: 0,
            passed: 0,
            failed: 0,
            highest: 0,
            totalObtained: 0,
            maxMarks: Number(sm.totalMarks) || 100,
          };
        }
        const sStat = subjectScoresMap[sub];
        sStat.totalStudents++;
        const obt = Number(sm.obtainedMarks) || 0;
        sStat.totalObtained += obt;
        if (obt > sStat.highest) sStat.highest = obt;
        if (obt >= (sm.passingMarks || 40)) sStat.passed++;
        else sStat.failed++;
      });

      return {
        rank: index + 1,
        studentId: rec.studentId,
        studentName: rec.studentName,
        fatherName: rec.fatherName,
        rollNumber: rec.rollNumber,
        admissionNumber: rec.admissionNumber,
        className: rec.className,
        section: rec.section,
        termName: rec.termName,
        grandTotalObtained: rec.grandTotalObtained,
        grandTotalMax: rec.grandTotalMax,
        overallPercentage: pct,
        overallGrade: rec.overallGrade || (pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 40 ? 'D' : 'F'),
        isPass,
        subjectMarks: rec.subjectMarks,
      };
    });

    const totalStudents = meritList.length;
    const passRate = totalStudents > 0 ? Number(((passCount / totalStudents) * 100).toFixed(1)) : 0;
    const classAverage = totalStudents > 0 ? Number((totalObtainedSum / totalStudents).toFixed(1)) : 0;
    const highestScore = meritList[0]?.grandTotalObtained || 0;

    const subjectBreakdown = Object.values(subjectScoresMap).map((sb) => ({
      ...sb,
      average: sb.totalStudents > 0 ? Number((sb.totalObtained / sb.totalStudents).toFixed(1)) : 0,
      passRate: sb.totalStudents > 0 ? Number(((sb.passed / sb.totalStudents) * 100).toFixed(1)) : 0,
    }));

    return res.status(200).json({
      success: true,
      summary: {
        totalStudents,
        passCount,
        failCount,
        passRate,
        classAverage,
        highestScore,
      },
      meritList,
      subjectBreakdown,
    });
  } catch (error) {
    console.error('Error in getExamPerformanceReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Pending Dues & Fee Defaulters Detailed Report
 * Clearly identifies students with outstanding fee balances,
 * exactly which months are pending (kb kb k), contact info, and total arrears.
 */
export const getPendingDuesReport = async (req, res) => {
  try {
    const {
      schoolCode,
      academicSession,
      className,
      section,
      minMonthsDue, // e.g. 1, 2, 3
      search,
    } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();
    const filter = {
      schoolCode: code,
      balance: { $gt: 0 },
      status: { $in: ['UNPAID', 'PARTIALLY_PAID'] },
    };

    if (className && className !== 'ALL') filter.className = className;
    if (section && section !== 'ALL') filter.section = section;

    const overdueVouchers = await FeeVoucher.find(filter)
      .sort({ monthYear: 1, dueDate: 1 })
      .lean();

    // Group vouchers by studentId
    const studentMap = new Map();
    const studentIds = new Set();

    overdueVouchers.forEach((v) => {
      const sId = String(v.studentId);
      studentIds.add(v.studentId);

      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          studentId: v.studentId,
          studentName: v.studentName,
          fatherName: v.fatherName || '—',
          fatherCnic: v.fatherCnic || '—',
          rollNumber: v.rollNumber || '—',
          className: v.className,
          section: v.section,
          fatherPhone: '—',
          admissionNumber: '—',
          bFormOrCnic: v.fatherCnic || '—',
          pendingVouchers: [],
          pendingMonths: [],
          totalPendingBalance: 0,
          totalInvoiced: 0,
          totalPaidSoFar: 0,
        });
      }

      const entry = studentMap.get(sId);
      const bal = Number(v.balance) || 0;
      const payable = Number(v.totalPayableWithinDueDate) || 0;
      const paid = Number(v.paidAmount) || 0;

      entry.totalPendingBalance += bal;
      entry.totalInvoiced += payable;
      entry.totalPaidSoFar += paid;

      entry.pendingVouchers.push({
        voucherNo: v.voucherNo,
        monthYear: v.monthYear,
        dueDate: v.dueDate ? new Date(v.dueDate).toISOString().split('T')[0] : '—',
        balance: bal,
        totalPayable: payable,
        paidAmount: paid,
        status: v.status,
      });

      if (!entry.pendingMonths.includes(v.monthYear)) {
        entry.pendingMonths.push(v.monthYear);
      }
    });

    // Fetch phone & admission number from Student model
    if (studentIds.size > 0) {
      const studentDocs = await Student.find(
        { _id: { $in: Array.from(studentIds) } },
        { fatherPhone: 1, emergencyContact: 1, admissionNumber: 1, bFormOrCnic: 1 }
      ).lean();

      const docMap = new Map(studentDocs.map((doc) => [String(doc._id), doc]));

      studentMap.forEach((entry, sId) => {
        const doc = docMap.get(sId);
        if (doc) {
          entry.fatherPhone = doc.fatherPhone || doc.emergencyContact || '—';
          if (doc.admissionNumber) entry.admissionNumber = doc.admissionNumber;
          if (doc.bFormOrCnic) entry.bFormOrCnic = doc.bFormOrCnic;
        }
      });
    }

    // Transform into final array
    let defaulters = Array.from(studentMap.values()).map((s) => {
      const monthsDueCount = s.pendingMonths.length;
      const pendingBreakdownString = s.pendingVouchers
        .map((pv) => `${pv.monthYear} (Rs ${pv.balance.toLocaleString()})`)
        .join(', ');

      const oldestMonth = s.pendingMonths[0] || '—';
      const newestMonth = s.pendingMonths[s.pendingMonths.length - 1] || '—';

      return {
        ...s,
        monthsDueCount,
        pendingBreakdownString,
        oldestMonth,
        newestMonth,
      };
    });

    // Filter by minMonthsDue
    if (minMonthsDue && !isNaN(Number(minMonthsDue)) && Number(minMonthsDue) > 0) {
      const minDue = Number(minMonthsDue);
      defaulters = defaulters.filter((d) => d.monthsDueCount >= minDue);
    }

    // Filter by search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      defaulters = defaulters.filter(
        (d) =>
          d.studentName.toLowerCase().includes(q) ||
          d.rollNumber.toLowerCase().includes(q) ||
          d.fatherName.toLowerCase().includes(q) ||
          (d.fatherPhone && d.fatherPhone.toLowerCase().includes(q))
      );
    }

    // Sort by total balance descending
    defaulters.sort((a, b) => b.totalPendingBalance - a.totalPendingBalance);

    // Class & Section summarized aggregation
    const classSummaryMap = {};
    let totalPendingAmount = 0;
    let singleMonthCount = 0;
    let twoMonthsCount = 0;
    let threePlusMonthsCount = 0;

    defaulters.forEach((d) => {
      totalPendingAmount += d.totalPendingBalance;
      if (d.monthsDueCount === 1) singleMonthCount++;
      else if (d.monthsDueCount === 2) twoMonthsCount++;
      else if (d.monthsDueCount >= 3) threePlusMonthsCount++;

      const key = `${d.className}__${d.section}`;
      if (!classSummaryMap[key]) {
        classSummaryMap[key] = {
          className: d.className,
          section: d.section,
          defaulterCount: 0,
          totalPendingAmount: 0,
          due1MonthCount: 0,
          due2MonthsCount: 0,
          due3PlusMonthsCount: 0,
        };
      }

      classSummaryMap[key].defaulterCount++;
      classSummaryMap[key].totalPendingAmount += d.totalPendingBalance;
      if (d.monthsDueCount === 1) classSummaryMap[key].due1MonthCount++;
      else if (d.monthsDueCount === 2) classSummaryMap[key].due2MonthsCount++;
      else if (d.monthsDueCount >= 3) classSummaryMap[key].due3PlusMonthsCount++;
    });

    const summarizedList = Object.values(classSummaryMap).sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.section.localeCompare(b.section);
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalDefaulters: defaulters.length,
        totalPendingAmount,
        singleMonthCount,
        twoMonthsCount,
        threePlusMonthsCount,
        multiMonthCount: twoMonthsCount + threePlusMonthsCount,
      },
      summarizedList,
      detailedBreakdown: defaulters,
      data: defaulters,
    });
  } catch (error) {
    console.error('Error in getPendingDuesReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 7. School Expense Report
 * Categorized expenditure breakdown and individual expense voucher ledger.
 */
export const getExpenseReport = async (req, res) => {
  try {
    const {
      schoolCode,
      categoryId,
      monthYear,
      fromDate,
      toDate,
      recordedBy,
      search,
    } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();
    const filter = { schoolCode: code };

    if (categoryId && categoryId !== 'ALL') filter.categoryId = categoryId;
    if (monthYear && monthYear !== 'ALL') filter.monthYear = monthYear;
    if (recordedBy && recordedBy !== 'ALL') {
      filter.recordedBy = new RegExp(`^${recordedBy.trim()}$`, 'i');
    }

    if (fromDate || toDate) {
      filter.expenseDate = {};
      if (fromDate) filter.expenseDate.$gte = new Date(fromDate);
      if (toDate) {
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999);
        filter.expenseDate.$lte = toD;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { voucherNo: new RegExp(q, 'i') },
        { remarks: new RegExp(q, 'i') },
        { categoryName: new RegExp(q, 'i') },
      ];
    }

    const expenses = await Expense.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .lean();

    let totalExpensesAmount = 0;
    const categoryMap = {};

    expenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      totalExpensesAmount += amt;

      const cat = e.categoryName || 'Other Expense';
      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          categoryName: cat,
          voucherCount: 0,
          totalAmount: 0,
        };
      }
      categoryMap[cat].voucherCount++;
      categoryMap[cat].totalAmount += amt;
    });

    const summarizedList = Object.values(categoryMap).map((c) => ({
      ...c,
      percentage: totalExpensesAmount > 0 ? Number(((c.totalAmount / totalExpensesAmount) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    const detailedBreakdown = expenses.map((e) => ({
      _id: e._id,
      voucherNo: e.voucherNo,
      dateString: e.dateString || (e.expenseDate ? new Date(e.expenseDate).toISOString().split('T')[0] : '—'),
      categoryName: e.categoryName || 'General',
      amount: Number(e.amount) || 0,
      remarks: e.remarks || '—',
      recordedBy: e.recordedBy || 'School Accountant',
      monthYear: e.monthYear || '—',
    }));

    // Retrieve distinct category list and accountants
    const distinctCategories = await ExpenseCategory.find({ schoolCode: code, isActive: true })
      .select('_id name')
      .lean();
    const distinctRecorded = await Expense.distinct('recordedBy', { schoolCode: code });
    const recordedByList = Array.from(new Set(['School Accountant', ...distinctRecorded.filter(Boolean)]));

    return res.status(200).json({
      success: true,
      summary: {
        totalExpensesAmount,
        totalVouchersCount: expenses.length,
        distinctCategoriesCount: summarizedList.length,
        averagePerExpense: expenses.length > 0 ? Math.round(totalExpensesAmount / expenses.length) : 0,
      },
      categories: distinctCategories,
      recordedByList,
      summarizedList,
      detailedBreakdown,
      data: detailedBreakdown,
    });
  } catch (error) {
    console.error('Error in getExpenseReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 8. Staff Attendance & Punctuality Report
 * Summarized employee attendance rate + daily register breakdown.
 */
export const getStaffAttendanceReport = async (req, res) => {
  try {
    const {
      schoolCode,
      monthYear,
      fromDate,
      toDate,
      role,
      department,
      status,
      search,
    } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();
    const filter = { schoolCode: code };

    if (monthYear && monthYear !== 'ALL') filter.monthYear = monthYear;

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) {
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999);
        filter.date.$lte = toD;
      }
    }

    const sheets = await StaffAttendance.find(filter).sort({ date: -1 }).lean();

    // Roll up per-staff member statistics
    const staffMap = new Map();
    const detailedBreakdown = [];

    sheets.forEach((sheet) => {
      const dateStr = sheet.dateString || (sheet.date ? new Date(sheet.date).toISOString().split('T')[0] : '');

      (sheet.records || []).forEach((rec) => {
        // Filter by role & department if requested
        if (role && role !== 'ALL' && rec.role !== role) return;
        if (department && department !== 'ALL' && rec.department !== department) return;
        if (status && status !== 'ALL' && rec.status !== status) return;
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          const match = rec.name.toLowerCase().includes(q) || rec.employeeId.toLowerCase().includes(q);
          if (!match) return;
        }

        const empId = rec.employeeId || String(rec.staffId);
        if (!staffMap.has(empId)) {
          staffMap.set(empId, {
            staffId: rec.staffId,
            employeeId: rec.employeeId,
            name: rec.name,
            role: rec.role || 'Teacher',
            department: rec.department || 'General',
            workingDays: 0,
            presentDays: 0,
            absentDays: 0,
            leaveDays: 0,
            lateDays: 0,
            halfDays: 0,
          });
        }

        const stat = staffMap.get(empId);
        stat.workingDays++;

        if (rec.status === 'PRESENT') stat.presentDays++;
        else if (rec.status === 'ABSENT') stat.absentDays++;
        else if (rec.status === 'LEAVE') stat.leaveDays++;
        else if (rec.status === 'LATE') stat.lateDays++;
        else if (rec.status === 'HALF_DAY') stat.halfDays++;

        detailedBreakdown.push({
          date: dateStr,
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
    });

    const summarizedList = Array.from(staffMap.values()).map((s) => {
      const attendancePercent = s.workingDays > 0 ? Number(((s.presentDays / s.workingDays) * 100).toFixed(1)) : 0;
      const isChronicAbsent = attendancePercent < 75 && s.workingDays >= 3;
      return {
        ...s,
        attendancePercent,
        isChronicAbsent,
      };
    }).sort((a, b) => b.attendancePercent - a.attendancePercent);

    let totalPresentOverall = 0;
    let totalAbsentOverall = 0;
    let totalLeaveOverall = 0;
    let totalLateOverall = 0;

    summarizedList.forEach((s) => {
      totalPresentOverall += s.presentDays;
      totalAbsentOverall += s.absentDays;
      totalLeaveOverall += s.leaveDays;
      totalLateOverall += s.lateDays;
    });

    const totalRecordedDays = totalPresentOverall + totalAbsentOverall + totalLeaveOverall + totalLateOverall;
    const overallRate = totalRecordedDays > 0 ? Number(((totalPresentOverall / totalRecordedDays) * 100).toFixed(1)) : 0;

    // Distinct roles & departments
    const distinctRoles = [
      'Teacher',
      'Head Teacher / Vice Principal',
      'Principal / Director',
      'Accountant',
      'Admin / Clerk',
      'Librarian',
      'Lab Assistant',
      'Support Staff / Peon / Guard',
    ];

    return res.status(200).json({
      success: true,
      summary: {
        totalStaffAnalyzed: summarizedList.length,
        totalSheets: sheets.length,
        totalPresentOverall,
        totalAbsentOverall,
        totalLeaveOverall,
        totalLateOverall,
        overallAttendanceRate: overallRate,
      },
      roles: distinctRoles,
      summarizedList,
      detailedBreakdown,
      data: summarizedList,
    });
  } catch (error) {
    console.error('Error in getStaffAttendanceReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 9. Staff Salaries & Monthly Payroll Report
 * Breakdown of gross salary, attendance deductions, net pay, and disbursement status.
 */
export const getStaffSalaryReport = async (req, res) => {
  try {
    const {
      schoolCode,
      monthYear,
      role,
      department,
      status, // ALL, PAID, GENERATED, DRAFT
      paymentMethod,
    } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();
    const filter = { schoolCode: code };

    if (monthYear && monthYear !== 'ALL') filter.monthYear = monthYear;
    if (role && role !== 'ALL') filter.role = role;
    if (department && department !== 'ALL') filter.department = department;
    if (status && status !== 'ALL') filter.status = status;
    if (paymentMethod && paymentMethod !== 'ALL') filter.paymentMethod = paymentMethod;

    const salaryRecords = await StaffSalary.find(filter)
      .sort({ createdAt: -1, name: 1 })
      .lean();

    let totalBasicSum = 0;
    let totalDeductionsSum = 0;
    let totalBonusesSum = 0;
    let totalNetPayableSum = 0;
    let totalPaidSum = 0;
    let totalUnpaidSum = 0;
    let paidCount = 0;
    let pendingCount = 0;

    const roleSummaryMap = {};

    salaryRecords.forEach((s) => {
      const basic = Number(s.basicSalary) || 0;
      const deductions = (Number(s.absentDeduction) || 0) + (Number(s.lateDeduction) || 0) + (Number(s.halfDayDeduction) || 0);
      const bonus = Number(s.bonusesOrAllowance) || 0;
      const net = Number(s.netSalary) || 0;
      const isPaid = s.status === 'PAID';

      totalBasicSum += basic;
      totalDeductionsSum += deductions;
      totalBonusesSum += bonus;
      totalNetPayableSum += net;

      if (isPaid) {
        totalPaidSum += net;
        paidCount++;
      } else {
        totalUnpaidSum += net;
        pendingCount++;
      }

      const r = s.role || 'Teacher';
      if (!roleSummaryMap[r]) {
        roleSummaryMap[r] = {
          role: r,
          staffCount: 0,
          totalBasic: 0,
          totalDeductions: 0,
          totalNetPayable: 0,
          totalPaid: 0,
          totalPending: 0,
          paidCount: 0,
          pendingCount: 0,
        };
      }

      roleSummaryMap[r].staffCount++;
      roleSummaryMap[r].totalBasic += basic;
      roleSummaryMap[r].totalDeductions += deductions;
      roleSummaryMap[r].totalNetPayable += net;
      if (isPaid) {
        roleSummaryMap[r].totalPaid += net;
        roleSummaryMap[r].paidCount++;
      } else {
        roleSummaryMap[r].totalPending += net;
        roleSummaryMap[r].pendingCount++;
      }
    });

    const summarizedList = Object.values(roleSummaryMap).sort((a, b) => b.totalNetPayable - a.totalNetPayable);

    const detailedBreakdown = salaryRecords.map((s) => {
      const deductions = (Number(s.absentDeduction) || 0) + (Number(s.lateDeduction) || 0) + (Number(s.halfDayDeduction) || 0);
      return {
        _id: s._id,
        salaryId: s.salaryId,
        employeeId: s.employeeId,
        name: s.name,
        role: s.role || 'Teacher',
        department: s.department || 'General',
        monthYear: s.monthYear,
        basicSalary: Number(s.basicSalary) || 0,
        absentDeduction: Number(s.absentDeduction) || 0,
        lateDeduction: Number(s.lateDeduction) || 0,
        halfDayDeduction: Number(s.halfDayDeduction) || 0,
        totalDeductions: deductions,
        bonusesOrAllowance: Number(s.bonusesOrAllowance) || 0,
        netSalary: Number(s.netSalary) || 0,
        status: s.status || 'GENERATED',
        paidDate: s.paidDate ? new Date(s.paidDate).toISOString().split('T')[0] : '—',
        paymentMethod: s.paymentMethod || 'CASH',
        remarks: s.remarks || '',
      };
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalStaff: salaryRecords.length,
        totalBasicSum,
        totalDeductionsSum,
        totalBonusesSum,
        totalNetPayableSum,
        totalPaidSum,
        totalUnpaidSum,
        paidCount,
        pendingCount,
        disbursementRate: totalNetPayableSum > 0 ? Number(((totalPaidSum / totalNetPayableSum) * 100).toFixed(1)) : 0,
      },
      summarizedList,
      detailedBreakdown,
      data: detailedBreakdown,
    });
  } catch (error) {
    console.error('Error in getStaffSalaryReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
