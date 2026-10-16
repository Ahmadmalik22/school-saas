import { StudentAttendance } from '../models/StudentAttendance.js';
import { StaffAttendance } from '../models/StaffAttendance.js';
import { Student } from '../models/Student.js';
import { Staff } from '../models/Staff.js';

// Helper to get standard dateString (YYYY-MM-DD) in Pakistan Standard Time (PKT)
const getStandardDateString = (inputDate) => {
  if (!inputDate) {
    const today = new Date();
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(today);
  }
  if (typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
    return inputDate;
  }
  const d = new Date(inputDate);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(d);
};

// =========================================================================
// 🅰️ SUB-MODULE 1: STUDENT ATTENDANCE CONTROLLERS
// =========================================================================

/**
 * 1. Get Class Attendance Sheet for a specific date
 * If already marked: returns saved sheet with existing statuses.
 * If not marked yet: dynamically loads active students in that class & section,
 * pre-filled with "PRESENT" for lightning-fast 1-click marking!
 */
export const getClassAttendanceSheet = async (req, res) => {
  try {
    const { schoolCode, className, section, date, session } = req.query;

    if (!schoolCode || !className || !section) {
      return res.status(400).json({
        success: false,
        message: 'School code, class name, and section are required.',
      });
    }

    const cleanCode = schoolCode.trim().toUpperCase();
    const cleanClass = className.trim();
    const cleanSection = section.trim().toUpperCase();
    const dateString = getStandardDateString(date);
    const monthYear = dateString.substring(0, 7);

    // 1. Fetch all currently ACTIVE students in this class & section
    const activeStudents = await Student.find({
      schoolCode: cleanCode,
      className: cleanClass,
      section: cleanSection,
      status: 'ACTIVE',
    })
      .select('_id admissionNumber rollNumber fullName fatherName photo')
      .sort({ rollNumber: 1, fullName: 1 })
      .lean();

    // Natural numeric sort for roll numbers (e.g. 1, 2, 10 instead of 1, 10, 2)
    activeStudents.sort((a, b) => {
      const numA = parseInt(a.rollNumber, 10);
      const numB = parseInt(b.rollNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return (a.rollNumber || '').localeCompare(b.rollNumber || '');
    });

    // 2. Check if sheet already exists in database
    const existingSheet = await StudentAttendance.findOne({
      schoolCode: cleanCode,
      className: cleanClass,
      section: cleanSection,
      dateString,
    }).lean();

    if (existingSheet && Array.isArray(existingSheet.records) && existingSheet.records.length > 0) {
      // Self-healing: Check if any active student is missing from existing sheet
      const existingIds = new Set(existingSheet.records.map((r) => r.studentId.toString()));
      let hasMissing = false;
      const mergedRecords = [...existingSheet.records];

      activeStudents.forEach((st) => {
        if (!existingIds.has(st._id.toString())) {
          hasMissing = true;
          mergedRecords.push({
            studentId: st._id,
            admissionNumber: st.admissionNumber,
            rollNumber: st.rollNumber || '',
            studentName: st.fullName,
            fatherName: st.fatherName || '',
            status: 'PRESENT',
            timeIn: '',
            remarks: '',
          });
        }
      });

      // Recalculate summary metrics if students merged
      let presentCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let holidayCount = 0;
      let sundayCount = 0;
      let halfDayCount = 0;

      mergedRecords.forEach((rec) => {
        const st = (rec.status || 'PRESENT').toUpperCase();
        if (st === 'PRESENT') presentCount += 1;
        else if (st === 'ABSENT') absentCount += 1;
        else if (st === 'LEAVE') leaveCount += 1;
        else if (st === 'HOLIDAY') holidayCount += 1;
        else if (st === 'SUNDAY') sundayCount += 1;
        else if (st === 'HALF_DAY') halfDayCount += 1;
      });

      const totalStudents = mergedRecords.length;
      const activeAttended = presentCount + halfDayCount * 0.5;
      const activeTarget = totalStudents - holidayCount - sundayCount;
      const percentage =
        activeTarget > 0 ? Math.round((activeAttended / activeTarget) * 100) : 100;

      const updatedSummary = {
        totalStudents,
        presentCount,
        absentCount,
        leaveCount,
        holidayCount,
        sundayCount,
        halfDayCount,
        percentage,
      };

      const isManualSubmitted = existingSheet.attendanceType === 'MANUAL';

      return res.status(200).json({
        success: true,
        isExisting: isManualSubmitted,
        message: isManualSubmitted
          ? (hasMissing ? 'Existing attendance sheet loaded and synced with newly enrolled students.' : 'Existing attendance sheet loaded.')
          : 'Gate QR scans loaded. Ready for teacher manual review and marking.',
        data: {
          ...existingSheet,
          records: mergedRecords,
          summary: updatedSummary,
        },
      });
    }

    // Clean up empty / corrupt document if any
    if (existingSheet && (!existingSheet.records || existingSheet.records.length === 0)) {
      await StudentAttendance.deleteOne({ _id: existingSheet._id });
    }

    // 3. Draft new records: All defaulted to "PRESENT"
    const draftRecords = activeStudents.map((st) => ({
      studentId: st._id,
      admissionNumber: st.admissionNumber,
      rollNumber: st.rollNumber || '',
      studentName: st.fullName,
      fatherName: st.fatherName || '',
      status: 'PRESENT',
      timeIn: '',
      remarks: '',
    }));

    const draftSummary = {
      totalStudents: draftRecords.length,
      presentCount: draftRecords.length,
      absentCount: 0,
      leaveCount: 0,
      holidayCount: 0,
      sundayCount: 0,
      halfDayCount: 0,
      percentage: draftRecords.length > 0 ? 100 : 0,
    };

    return res.status(200).json({
      success: true,
      isExisting: false,
      message: 'Draft attendance sheet generated with active students.',
      data: {
        schoolCode: cleanCode,
        className: cleanClass,
        section: cleanSection,
        date: new Date(dateString),
        dateString,
        monthYear,
        academicSession: session || '2025-2026',
        attendanceType: 'MANUAL',
        records: draftRecords,
        summary: draftSummary,
      },
    });
  } catch (error) {
    console.error('Error in getClassAttendanceSheet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch class attendance sheet.',
      error: error.message,
    });
  }
};

/**
 * 2. Save / Update Class Attendance Sheet
 * Upserts 1 document per class-section per day (preserves Atlas storage).
 * Emits real-time Socket.io event for principal/dashboard.
 */
export const saveClassAttendanceSheet = async (req, res) => {
  try {
    const {
      schoolCode,
      className,
      section,
      dateString,
      academicSession,
      attendanceType,
      records,
      markedBy,
    } = req.body;

    if (!schoolCode || !className || !section || !dateString) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields (schoolCode, className, section, dateString).',
      });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Attendance records array cannot be empty.',
      });
    }

    const cleanCode = schoolCode.trim().toUpperCase();
    const cleanClass = className.trim();
    const cleanSection = section.trim().toUpperCase();
    const cleanDateString = getStandardDateString(dateString);
    const monthYear = cleanDateString.substring(0, 7);

    // Calculate Summary Metrics
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let holidayCount = 0;
    let sundayCount = 0;
    let halfDayCount = 0;

    records.forEach((rec) => {
      const st = (rec.status || 'PRESENT').toUpperCase();
      if (st === 'PRESENT') presentCount += 1;
      else if (st === 'ABSENT') absentCount += 1;
      else if (st === 'LEAVE') leaveCount += 1;
      else if (st === 'HOLIDAY') holidayCount += 1;
      else if (st === 'SUNDAY') sundayCount += 1;
      else if (st === 'HALF_DAY') halfDayCount += 1;
    });

    const totalStudents = records.length;
    // Percentage calculated based on active instruction days (excluding official holidays/Sundays)
    const activeAttended = presentCount + halfDayCount * 0.5;
    const activeTarget = totalStudents - holidayCount - sundayCount;
    const percentage =
      activeTarget > 0 ? Math.round((activeAttended / activeTarget) * 100) : 100;

    const summary = {
      totalStudents,
      presentCount,
      absentCount,
      leaveCount,
      holidayCount,
      sundayCount,
      halfDayCount,
      percentage,
    };

    // Upsert single daily document
    const updatedSheet = await StudentAttendance.findOneAndUpdate(
      {
        schoolCode: cleanCode,
        className: cleanClass,
        section: cleanSection,
        dateString: cleanDateString,
      },
      {
        $set: {
          schoolCode: cleanCode,
          className: cleanClass,
          section: cleanSection,
          date: new Date(cleanDateString),
          dateString: cleanDateString,
          monthYear,
          academicSession: academicSession || '2025-2026',
          attendanceType: attendanceType || 'MANUAL',
          records,
          summary,
          markedBy: markedBy || 'Class Teacher',
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // Real-Time Socket.io Broadcast
    if (req?.io) {
      const eventPayload = {
        action: 'STUDENT_ATTENDANCE_SAVED',
        schoolCode: cleanCode,
        className: cleanClass,
        section: cleanSection,
        dateString: cleanDateString,
        summary,
        timestamp: Date.now(),
      };
      req.io.to(`school:${cleanCode}`).emit('attendance_updated', eventPayload);
      req.io.emit('attendance_updated', eventPayload);
    }

    return res.status(200).json({
      success: true,
      message: `Attendance for ${cleanClass} (${cleanSection}) saved successfully!`,
      data: updatedSheet,
    });
  } catch (error) {
    console.error('Error in saveClassAttendanceSheet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save class attendance.',
      error: error.message,
    });
  }
};

/**
 * 3. Get Monthly Student Register (1 to 31 Grid)
 * Prepares the complete matrix for printable attendance register
 * and fee fine calculations (Total Absents per student).
 */
export const getMonthlyStudentRegister = async (req, res) => {
  try {
    const { schoolCode, className, section, monthYear } = req.query;

    if (!schoolCode || !className || !section) {
      return res.status(400).json({
        success: false,
        message: 'School code, class name, and section are required.',
      });
    }

    const cleanCode = schoolCode.trim().toUpperCase();
    const cleanClass = className.trim();
    const cleanSection = section.trim().toUpperCase();
    const targetMonthYear = monthYear || new Date().toISOString().substring(0, 7); // e.g. "2026-10"

    // 1. Fetch active students
    const students = await Student.find({
      schoolCode: cleanCode,
      className: cleanClass,
      section: cleanSection,
      status: 'ACTIVE',
    })
      .select('_id admissionNumber rollNumber fullName fatherName')
      .sort({ rollNumber: 1, fullName: 1 })
      .lean();

    // 2. Fetch all saved daily sheets for this month
    const sheets = await StudentAttendance.find({
      schoolCode: cleanCode,
      className: cleanClass,
      section: cleanSection,
      monthYear: targetMonthYear,
    })
      .select('dateString records summary')
      .lean();

    // Map sheets by day number (e.g. "01", "12")
    const daySheetMap = new Map();
    sheets.forEach((sheet) => {
      const dayNum = parseInt(sheet.dateString.split('-')[2], 10);
      daySheetMap.set(dayNum, sheet);
    });

    // 3. Build student monthly matrix
    const matrix = students.map((st) => {
      const dailyAttendance = {};
      let totalPresents = 0;
      let totalAbsents = 0;
      let totalLeaves = 0;
      let totalHolidays = 0;
      let totalSundays = 0;
      let totalHalfDays = 0;

      // Days 1 through 31
      for (let day = 1; day <= 31; day++) {
        const sheet = daySheetMap.get(day);
        if (sheet) {
          const rec = sheet.records.find(
            (r) => r.studentId.toString() === st._id.toString()
          );
          if (rec) {
            const s = rec.status;
            dailyAttendance[day] = s;
            if (s === 'PRESENT') totalPresents++;
            else if (s === 'ABSENT') totalAbsents++;
            else if (s === 'LEAVE') totalLeaves++;
            else if (s === 'HOLIDAY') totalHolidays++;
            else if (s === 'SUNDAY') totalSundays++;
            else if (s === 'HALF_DAY') totalHalfDays++;
          } else {
            dailyAttendance[day] = '-';
          }
        } else {
          dailyAttendance[day] = ''; // Day not marked yet
        }
      }

      return {
        studentId: st._id,
        admissionNumber: st.admissionNumber,
        rollNumber: st.rollNumber,
        studentName: st.fullName,
        fatherName: st.fatherName,
        dailyAttendance,
        totals: {
          present: totalPresents,
          absent: totalAbsents,
          leave: totalLeaves,
          holiday: totalHolidays,
          sunday: totalSundays,
          halfDay: totalHalfDays,
        },
      };
    });

    return res.status(200).json({
      success: true,
      monthYear: targetMonthYear,
      className: cleanClass,
      section: cleanSection,
      totalMarkedDays: sheets.length,
      data: matrix,
    });
  } catch (error) {
    console.error('Error in getMonthlyStudentRegister:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate monthly student register.',
      error: error.message,
    });
  }
};

// =========================================================================
// 🅱️ SUB-MODULE 2: STAFF ATTENDANCE CONTROLLERS
// =========================================================================

/**
 * 4. Get Daily Staff Attendance Sheet
 * If marked: returns saved sheet with check-in times and statuses.
 * If not marked yet: pre-loads all active staff pre-filled with "PRESENT".
 */
export const getStaffAttendanceSheet = async (req, res) => {
  try {
    const { schoolCode, date } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanCode = schoolCode.trim().toUpperCase();
    const dateString = getStandardDateString(date);
    const monthYear = dateString.substring(0, 7);

    // 1. Fetch all currently ACTIVE staff members
    const activeStaff = await Staff.find({
      schoolCode: cleanCode,
      status: 'ACTIVE',
    })
      .select('_id employeeId fullName role department phone basicSalary')
      .sort({ role: 1, fullName: 1 })
      .lean();

    // 2. Check existing sheet
    const existing = await StaffAttendance.findOne({
      schoolCode: cleanCode,
      dateString,
    }).lean();

    if (existing && Array.isArray(existing.records) && existing.records.length > 0) {
      // Self-healing: Check if any active staff member is missing from the existing sheet
      const existingIds = new Set(existing.records.map((r) => r.staffId.toString()));
      let hasMissing = false;
      const mergedRecords = [...existing.records];

      activeStaff.forEach((st) => {
        if (!existingIds.has(st._id.toString())) {
          hasMissing = true;
          mergedRecords.push({
            staffId: st._id,
            employeeId: st.employeeId,
            name: st.fullName,
            role: st.role || 'Teacher',
            department: st.department || 'General',
            status: 'PRESENT',
            timeIn: '08:00 AM',
            timeOut: '02:00 PM',
            remarks: '',
          });
        }
      });

      // Recalculate summary metrics if staff were merged
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;
      let holidayCount = 0;
      let halfDayCount = 0;

      mergedRecords.forEach((rec) => {
        const s = (rec.status || 'PRESENT').toUpperCase();
        if (s === 'PRESENT') presentCount++;
        else if (s === 'ABSENT') absentCount++;
        else if (s === 'LATE') lateCount++;
        else if (s === 'LEAVE') leaveCount++;
        else if (s === 'HOLIDAY') holidayCount++;
        else if (s === 'HALF_DAY') halfDayCount++;
      });

      const updatedSummary = {
        totalStaff: mergedRecords.length,
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        holidayCount,
        halfDayCount,
      };

      return res.status(200).json({
        success: true,
        isExisting: true,
        message: hasMissing
          ? 'Existing sheet loaded and synced with newly registered staff.'
          : 'Existing staff attendance sheet loaded.',
        data: {
          ...existing,
          records: mergedRecords,
          summary: updatedSummary,
        },
      });
    }

    // Clean up empty / corrupt document if any was saved previously
    if (existing && (!existing.records || existing.records.length === 0)) {
      await StaffAttendance.deleteOne({ _id: existing._id });
    }

    // 3. Draft records for all active staff (all defaulted to PRESENT)
    const draftRecords = activeStaff.map((st) => ({
      staffId: st._id,
      employeeId: st.employeeId,
      name: st.fullName,
      role: st.role || 'Teacher',
      department: st.department || 'General',
      status: 'PRESENT',
      timeIn: '08:00 AM',
      timeOut: '02:00 PM',
      remarks: '',
    }));

    const draftSummary = {
      totalStaff: draftRecords.length,
      presentCount: draftRecords.length,
      absentCount: 0,
      lateCount: 0,
      leaveCount: 0,
      holidayCount: 0,
      halfDayCount: 0,
    };

    return res.status(200).json({
      success: true,
      isExisting: false,
      message: 'Draft staff attendance sheet generated.',
      data: {
        schoolCode: cleanCode,
        date: new Date(dateString),
        dateString,
        monthYear,
        records: draftRecords,
        summary: draftSummary,
      },
    });
  } catch (error) {
    console.error('Error in getStaffAttendanceSheet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch staff attendance sheet.',
      error: error.message,
    });
  }
};

/**
 * 5. Save / Update Daily Staff Attendance Sheet
 * Upserts 1 document per school per day. Emits real-time Socket.io event.
 */
export const saveStaffAttendanceSheet = async (req, res) => {
  try {
    const { schoolCode, dateString, records, markedBy } = req.body;

    if (!schoolCode || !dateString || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'School code, dateString, and records are required.',
      });
    }

    const cleanCode = schoolCode.trim().toUpperCase();
    const cleanDateString = getStandardDateString(dateString);
    const monthYear = cleanDateString.substring(0, 7);

    // Summary calculation
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;
    let holidayCount = 0;
    let halfDayCount = 0;

    records.forEach((rec) => {
      const st = (rec.status || 'PRESENT').toUpperCase();
      if (st === 'PRESENT') presentCount += 1;
      else if (st === 'ABSENT') absentCount += 1;
      else if (st === 'LATE') lateCount += 1;
      else if (st === 'LEAVE') leaveCount += 1;
      else if (st === 'HOLIDAY') holidayCount += 1;
      else if (st === 'HALF_DAY') halfDayCount += 1;
    });

    const summary = {
      totalStaff: records.length,
      presentCount,
      absentCount,
      lateCount,
      leaveCount,
      holidayCount,
      halfDayCount,
    };

    const updatedSheet = await StaffAttendance.findOneAndUpdate(
      {
        schoolCode: cleanCode,
        dateString: cleanDateString,
      },
      {
        $set: {
          schoolCode: cleanCode,
          date: new Date(cleanDateString),
          dateString: cleanDateString,
          monthYear,
          records,
          summary,
          markedBy: markedBy || 'Principal / HR',
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // Real-Time Socket.io Broadcast
    if (req?.io) {
      const eventPayload = {
        action: 'STAFF_ATTENDANCE_SAVED',
        schoolCode: cleanCode,
        dateString: cleanDateString,
        summary,
        timestamp: Date.now(),
      };
      req.io.to(`school:${cleanCode}`).emit('attendance_updated', eventPayload);
      req.io.emit('attendance_updated', eventPayload);
    }

    return res.status(200).json({
      success: true,
      message: 'Staff attendance saved successfully!',
      data: updatedSheet,
    });
  } catch (error) {
    console.error('Error in saveStaffAttendanceSheet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save staff attendance.',
      error: error.message,
    });
  }
};

/**
 * 6. Get Monthly Staff Register (For Salary / Payroll Calculations)
 * Returns staff attendance days, unpaid absents, and lates for salary generation.
 */
export const getMonthlyStaffRegister = async (req, res) => {
  try {
    const { schoolCode, monthYear } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanCode = schoolCode.trim().toUpperCase();
    const targetMonthYear = monthYear || new Date().toISOString().substring(0, 7);

    // 1. Fetch active staff with basic salary
    const staffList = await Staff.find({
      schoolCode: cleanCode,
      status: 'ACTIVE',
    })
      .select('_id employeeId fullName role department basicSalary phone')
      .sort({ role: 1, fullName: 1 })
      .lean();

    // 2. Fetch all staff sheets for this month
    const sheets = await StaffAttendance.find({
      schoolCode: cleanCode,
      monthYear: targetMonthYear,
    })
      .select('dateString records summary')
      .lean();

    const daySheetMap = new Map();
    sheets.forEach((sheet) => {
      const dayNum = parseInt(sheet.dateString.split('-')[2], 10);
      daySheetMap.set(dayNum, sheet);
    });

    // 3. Build staff matrix
    const matrix = staffList.map((st) => {
      const dailyAttendance = {};
      let totalPresents = 0;
      let totalAbsents = 0;
      let totalLates = 0;
      let totalLeaves = 0;
      let totalHolidays = 0;
      let totalHalfDays = 0;

      for (let day = 1; day <= 31; day++) {
        const sheet = daySheetMap.get(day);
        if (sheet) {
          const rec = sheet.records.find(
            (r) => r.staffId.toString() === st._id.toString()
          );
          if (rec) {
            const s = rec.status;
            dailyAttendance[day] = s;
            if (s === 'PRESENT') totalPresents++;
            else if (s === 'ABSENT') totalAbsents++;
            else if (s === 'LATE') totalLates++;
            else if (s === 'LEAVE') totalLeaves++;
            else if (s === 'HOLIDAY') totalHolidays++;
            else if (s === 'HALF_DAY') totalHalfDays++;
          } else {
            dailyAttendance[day] = '-';
          }
        } else {
          dailyAttendance[day] = '';
        }
      }

      // Payroll calculation details:
      // Basic salary per day (assuming standard 30 day month)
      const basicSalary = Number(st.basicSalary) || 25000;
      const perDaySalary = Math.round(basicSalary / 30);
      // Policy: 3 lates = 1 absent deduction
      const lateEquivalentAbsents = Math.floor(totalLates / 3);
      const totalDeductionDays = totalAbsents + (totalHalfDays * 0.5) + lateEquivalentAbsents;
      const salaryDeduction = Math.round(totalDeductionDays * perDaySalary);
      const netPayableSalary = Math.max(0, basicSalary - salaryDeduction);

      return {
        staffId: st._id,
        employeeId: st.employeeId,
        name: st.fullName,
        role: st.role,
        department: st.department,
        phone: st.phone,
        basicSalary,
        perDaySalary,
        dailyAttendance,
        totals: {
          present: totalPresents,
          absent: totalAbsents,
          late: totalLates,
          leave: totalLeaves,
          holiday: totalHolidays,
          halfDay: totalHalfDays,
        },
        payroll: {
          totalDeductionDays,
          salaryDeduction,
          netPayableSalary,
        },
      };
    });

    return res.status(200).json({
      success: true,
      monthYear: targetMonthYear,
      totalMarkedDays: sheets.length,
      data: matrix,
    });
  } catch (error) {
    console.error('Error in getMonthlyStaffRegister:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate monthly staff register.',
      error: error.message,
    });
  }
};

// =========================================================================
// 🅲 SUB-MODULE 5: DIGITAL QR ATTENDANCE GATE SCANNER CONTROLLERS
// =========================================================================

/**
 * 1. Process instant QR Code scan from Mobile Camera or Laptop Webcam
 * Automatically marks the student PRESENT in today's class daily sheet with exact timeIn.
 */
export const markQrAttendance = async (req, res) => {
  try {
    const { schoolCode, qrPayload, timeIn, clientDate } = req.body;

    if (!schoolCode || !qrPayload) {
      return res.status(400).json({
        success: false,
        message: 'School code and QR payload are required.',
      });
    }

    const cleanCode = schoolCode.trim().toUpperCase();

    // Parse payload (Supports plain admissionNumber, rollNumber, ObjectId, or JSON string/object)
    let searchCriteria = {};
    let parsedData = null;

    if (typeof qrPayload === 'string') {
      try {
        parsedData = JSON.parse(qrPayload);
      } catch {
        // Not JSON - treat as plain text identifier
        parsedData = null;
      }
    } else if (typeof qrPayload === 'object' && qrPayload !== null) {
      parsedData = qrPayload;
    }

    if (parsedData) {
      const candidateId = parsedData.studentId || parsedData._id || parsedData.id;
      const candidateAdm = parsedData.admissionNumber || parsedData.admissionNo || parsedData.adm;
      const candidateRoll = parsedData.rollNo || parsedData.rollNumber;

      if (candidateId && /^[0-9a-fA-F]{24}$/.test(String(candidateId))) {
        searchCriteria._id = candidateId;
      } else if (candidateAdm) {
        searchCriteria.admissionNumber = String(candidateAdm).trim();
      } else if (candidateRoll && parsedData.className) {
        searchCriteria.rollNumber = String(candidateRoll).trim();
        searchCriteria.className = parsedData.className;
        if (parsedData.section) searchCriteria.section = parsedData.section;
      }
    } else {
      const trimmed = String(qrPayload).trim();
      if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
        searchCriteria._id = trimmed;
      } else {
        searchCriteria.$or = [
          { admissionNumber: { $regex: `^${trimmed}$`, $options: 'i' } },
          { rollNumber: trimmed },
        ];
      }
    }

    // Find student in active database for this schoolCode
    let student = await Student.findOne({
      schoolCode: cleanCode,
      ...searchCriteria,
      status: 'ACTIVE',
    }).lean();

    // Fallback 1: case-insensitive admissionNumber if not found by primary criteria
    if (!student && searchCriteria.admissionNumber) {
      student = await Student.findOne({
        schoolCode: cleanCode,
        admissionNumber: { $regex: `^${String(searchCriteria.admissionNumber).trim()}$`, $options: 'i' },
        status: 'ACTIVE',
      }).lean();
    }

    // Fallback 2: search by rollNumber if string was provided
    if (!student && typeof qrPayload === 'string' && !parsedData) {
      student = await Student.findOne({
        schoolCode: cleanCode,
        rollNumber: qrPayload.trim(),
        status: 'ACTIVE',
      }).lean();
    }

    // Fallback 3: check parsedData.rollNo
    if (!student && parsedData?.rollNo) {
      const query = { schoolCode: cleanCode, rollNumber: String(parsedData.rollNo).trim(), status: 'ACTIVE' };
      if (parsedData.className) query.className = parsedData.className;
      student = await Student.findOne(query).lean();
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in active records or invalid ID card for this campus.',
      });
    }

    const today = new Date();
    const dateString = clientDate || getStandardDateString();
    const monthYear = dateString.substring(0, 7);
    const scanTime =
      timeIn ||
      today.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

    // Find or create StudentAttendance sheet for this student's class and section today
    let sheet = await StudentAttendance.findOne({
      schoolCode: cleanCode,
      className: student.className,
      section: student.section,
      dateString,
    });

    let alreadyMarked = false;

    if (!sheet) {
      // Initialize sheet with ONLY the scanned student (never pre-fill rest of class)
      const records = [
        {
          studentId: student._id,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber || '',
          studentName: student.fullName,
          fatherName: student.fatherName || '',
          status: 'PRESENT',
          timeIn: scanTime,
          remarks: 'Digital QR Gate Scan',
        },
      ];

      sheet = new StudentAttendance({
        schoolCode: cleanCode,
        className: student.className,
        section: student.section,
        date: today,
        dateString,
        monthYear,
        academicSession: student.academicSession || '2025-2026',
        attendanceType: 'QR_SCANNER',
        records,
        summary: {
          totalStudents: 1,
          presentCount: 1,
          absentCount: 0,
          leaveCount: 0,
          holidayCount: 0,
          sundayCount: 0,
          halfDayCount: 0,
          percentage: 100,
        },
        markedBy: 'Digital QR Attendance Gate Scanner',
      });

      await sheet.save();
    } else {
      // Sheet already exists: find this student's record
      const recIndex = sheet.records.findIndex(
        (r) => String(r.studentId) === String(student._id)
      );

      if (recIndex !== -1) {
        if (sheet.records[recIndex].status === 'PRESENT') {
          alreadyMarked = true;
        } else {
          sheet.records[recIndex].status = 'PRESENT';
          sheet.records[recIndex].timeIn = scanTime;
          sheet.records[recIndex].remarks = 'Digital QR Gate Scan';
        }
      } else {
        sheet.records.push({
          studentId: student._id,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber || '',
          studentName: student.fullName,
          fatherName: student.fatherName || '',
          status: 'PRESENT',
          timeIn: scanTime,
          remarks: 'Digital QR Gate Scan',
        });
      }

      // Recalculate summary metrics
      let presentCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let holidayCount = 0;
      let sundayCount = 0;
      let halfDayCount = 0;

      sheet.records.forEach((rec) => {
        const st = (rec.status || 'ABSENT').toUpperCase();
        if (st === 'PRESENT') presentCount += 1;
        else if (st === 'ABSENT') absentCount += 1;
        else if (st === 'LEAVE') leaveCount += 1;
        else if (st === 'HOLIDAY') holidayCount += 1;
        else if (st === 'SUNDAY') sundayCount += 1;
        else if (st === 'HALF_DAY') halfDayCount += 1;
      });

      const totalStudents = sheet.records.length;
      const activeAttended = presentCount + halfDayCount * 0.5;
      const activeTarget = totalStudents - holidayCount - sundayCount;
      const percentage =
        activeTarget > 0 ? Math.round((activeAttended / activeTarget) * 100) : 100;

      sheet.summary = {
        totalStudents,
        presentCount,
        absentCount,
        leaveCount,
        holidayCount,
        sundayCount,
        halfDayCount,
        percentage,
      };

      sheet.attendanceType = 'QR_SCANNER';
      await sheet.save();
    }

    const recordedStudent = sheet.records.find(
      (r) => String(r.studentId) === String(student._id)
    );

    return res.status(200).json({
      success: true,
      alreadyMarked,
      message: alreadyMarked
        ? `${student.fullName} is already marked PRESENT today at ${recordedStudent?.timeIn || scanTime}.`
        : `Attendance marked successfully for ${student.fullName}!`,
      data: {
        studentId: student._id,
        fullName: student.fullName,
        fatherName: student.fatherName,
        rollNumber: student.rollNumber,
        admissionNumber: student.admissionNumber,
        className: student.className,
        section: student.section,
        photo: student.photo?.url || null,
        status: 'PRESENT',
        timeIn: recordedStudent?.timeIn || scanTime,
        dateString,
      },
    });
  } catch (error) {
    console.error('Error in markQrAttendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark attendance via QR scan.',
      error: error.message,
    });
  }
};

/**
 * 2. Get Today's Live Scanned QR Attendance Feed
 */
export const getTodayQrAttendance = async (req, res) => {
  try {
    const { schoolCode, date } = req.query;

    if (!schoolCode) {
      return res.status(400).json({
        success: false,
        message: 'School code is required.',
      });
    }

    const cleanCode = schoolCode.trim().toUpperCase();
    const dateString = getStandardDateString(date);

    const sheets = await StudentAttendance.find({
      schoolCode: cleanCode,
      dateString,
    })
      .populate('records.studentId', 'photo')
      .lean();

    const presentsToday = [];

    sheets.forEach((sheet) => {
      sheet.records.forEach((rec) => {
        // Only include students who actually scanned their QR code at the scanner
        const isQrScanned = rec.remarks === 'Digital QR Gate Scan' || (rec.timeIn && sheet.attendanceType === 'QR_SCANNER');
        if (rec.status === 'PRESENT' && isQrScanned) {
          presentsToday.push({
            studentId: rec.studentId?._id || rec.studentId,
            fullName: rec.studentName,
            fatherName: rec.fatherName,
            rollNumber: rec.rollNumber,
            admissionNumber: rec.admissionNumber,
            className: sheet.className,
            section: sheet.section,
            photo: rec.studentId?.photo?.url || null,
            status: rec.status,
            timeIn: rec.timeIn || '—',
            remarks: rec.remarks || 'Digital QR Gate Scan',
          });
        }
      });
    });

    // Reverse so latest appears on top
    presentsToday.reverse();

    return res.status(200).json({
      success: true,
      dateString,
      totalPresent: presentsToday.length,
      data: presentsToday,
    });
  } catch (error) {
    console.error('Error in getTodayQrAttendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch today QR attendance feed.',
      error: error.message,
    });
  }
};
