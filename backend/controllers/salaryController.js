import StaffSalary from '../models/StaffSalary.js';
import Staff from '../models/Staff.js';
import StaffAttendance from '../models/StaffAttendance.js';

/**
 * Staff Salary Controller
 * Generates and manages monthly payroll based on attendance records and late/leave policies.
 */

// 1. Generate Staff Monthly Payroll
export const generateStaffPayroll = async (req, res) => {
  try {
    const {
      schoolCode,
      monthYear, // e.g. "2026-10"
      latePolicyRate = 3, // 3 lates = 1 absent deduction
      daysInMonth = 30,
    } = req.body;

    if (!schoolCode || !monthYear) {
      return res.status(400).json({
        success: false,
        message: 'School code and month/year are required.',
      });
    }

    // 1. Fetch all active staff members
    const staffList = await Staff.find({
      schoolCode,
      status: 'ACTIVE',
    }).sort({ employeeId: 1 });

    if (!staffList || staffList.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active staff members found in this school.',
      });
    }

    // 2. Fetch all daily staff attendance sheets for this monthYear
    const attendanceSheets = await StaffAttendance.find({
      schoolCode,
      monthYear,
    });

    // Tally attendance per staffId
    const attendanceStats = {};
    for (const staff of staffList) {
      attendanceStats[staff._id.toString()] = {
        present: 0,
        absent: 0,
        halfDay: 0,
        late: 0,
        leave: 0,
      };
    }

    for (const sheet of attendanceSheets) {
      for (const rec of sheet.records || []) {
        const sid = rec.staffId ? rec.staffId.toString() : null;
        if (sid && attendanceStats[sid]) {
          if (rec.status === 'PRESENT') attendanceStats[sid].present++;
          else if (rec.status === 'ABSENT') attendanceStats[sid].absent++;
          else if (rec.status === 'HALF_DAY') attendanceStats[sid].halfDay++;
          else if (rec.status === 'LATE') attendanceStats[sid].late++;
          else if (rec.status === 'LEAVE') attendanceStats[sid].leave++;
        }
      }
    }

    // 3. Generate or update salary records
    const generatedSalaries = [];
    const totalDays = Number(daysInMonth) || 30;

    for (const staff of staffList) {
      const stats = attendanceStats[staff._id.toString()] || {
        present: 0,
        absent: 0,
        halfDay: 0,
        late: 0,
        leave: 0,
      };

      const basicSalary = staff.basicSalary || 25000;
      const dailyRate = Math.round(basicSalary / totalDays);

      // Deductions
      const absentDeduction = stats.absent * dailyRate;
      const halfDayDeduction = Math.round(stats.halfDay * (dailyRate * 0.5));
      const lateDeduction = Math.floor(stats.late / latePolicyRate) * dailyRate;
      const bonusesOrAllowance = 0;

      const totalDeductions = absentDeduction + halfDayDeduction + lateDeduction;
      const netSalary = Math.max(0, basicSalary - totalDeductions + bonusesOrAllowance);

      // Check existing record
      let salaryRecord = await StaffSalary.findOne({
        staffId: staff._id,
        monthYear,
      });

      const cleanMonth = monthYear.replace('-', '');
      const salaryId = `SAL-${cleanMonth}-${staff.employeeId || staff._id.toString().slice(-4)}`;

      if (salaryRecord) {
        // If already existing but not yet marked PAID, refresh attendance metrics
        if (salaryRecord.status !== 'PAID') {
          salaryRecord.presentDays = stats.present;
          salaryRecord.absentDays = stats.absent;
          salaryRecord.halfDays = stats.halfDay;
          salaryRecord.lateCount = stats.late;
          salaryRecord.leaveDays = stats.leave;
          salaryRecord.absentDeduction = absentDeduction;
          salaryRecord.halfDayDeduction = halfDayDeduction;
          salaryRecord.lateDeduction = lateDeduction;
          salaryRecord.netSalary = Math.max(
            0,
            basicSalary - (absentDeduction + halfDayDeduction + lateDeduction) + (salaryRecord.bonusesOrAllowance || 0)
          );
          await salaryRecord.save();
        }
      } else {
        salaryRecord = new StaffSalary({
          schoolCode,
          salaryId,
          staffId: staff._id,
          employeeId: staff.employeeId,
          name: staff.fullName,
          role: staff.designation || 'Teacher',
          department: staff.department || 'General',
          monthYear,
          basicSalary,
          totalDays,
          presentDays: stats.present,
          absentDays: stats.absent,
          halfDays: stats.halfDay,
          lateCount: stats.late,
          leaveDays: stats.leave,
          absentDeduction,
          lateDeduction,
          halfDayDeduction,
          bonusesOrAllowance,
          netSalary,
          status: 'GENERATED',
          remarks: stats.late >= 3 ? `${stats.late} lates incurred ${Math.floor(stats.late / latePolicyRate)} day salary deduction.` : '',
        });
        await salaryRecord.save();
      }

      generatedSalaries.push(salaryRecord);
    }

    return res.status(200).json({
      success: true,
      message: `Staff payroll generated successfully for ${generatedSalaries.length} employees.`,
      data: generatedSalaries,
    });
  } catch (error) {
    console.error('Error generating staff payroll:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error generating staff payroll.',
    });
  }
};

// 2. Get Staff Payroll Sheet
export const getStaffPayrollSheet = async (req, res) => {
  try {
    const { schoolCode, monthYear, department } = req.query;

    if (!schoolCode || !monthYear) {
      return res.status(400).json({
        success: false,
        message: 'School code and month/year are required.',
      });
    }

    const query = { schoolCode, monthYear };
    if (department && department !== 'ALL') {
      query.department = department;
    }

    const salaries = await StaffSalary.find(query).sort({ employeeId: 1 });

    const totalStaff = salaries.length;
    const totalBasicSalary = salaries.reduce((acc, s) => acc + (s.basicSalary || 0), 0);
    const totalDeductions = salaries.reduce(
      (acc, s) => acc + (s.absentDeduction + s.lateDeduction + s.halfDayDeduction),
      0
    );
    const totalBonuses = salaries.reduce((acc, s) => acc + (s.bonusesOrAllowance || 0), 0);
    const totalNetPayroll = salaries.reduce((acc, s) => acc + (s.netSalary || 0), 0);
    const paidCount = salaries.filter((s) => s.status === 'PAID').length;
    const pendingCount = salaries.filter((s) => s.status !== 'PAID').length;

    return res.status(200).json({
      success: true,
      data: salaries,
      stats: {
        totalStaff,
        totalBasicSalary,
        totalDeductions,
        totalBonuses,
        totalNetPayroll,
        paidCount,
        pendingCount,
      },
    });
  } catch (error) {
    console.error('Error fetching payroll sheet:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error fetching payroll sheet.',
    });
  }
};

// 3. Update / Edit Staff Salary Record (Adjust Deductions, Add Allowance, Remarks)
export const updateStaffSalaryRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      absentDeduction,
      lateDeduction,
      halfDayDeduction,
      bonusesOrAllowance,
      remarks,
      status,
      paymentMethod,
    } = req.body;

    const salary = await StaffSalary.findById(id);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'Staff salary record not found.',
      });
    }

    const absDed = absentDeduction !== undefined ? Number(absentDeduction) : salary.absentDeduction;
    const lateDed = lateDeduction !== undefined ? Number(lateDeduction) : salary.lateDeduction;
    const halfDed = halfDayDeduction !== undefined ? Number(halfDayDeduction) : salary.halfDayDeduction;
    const bonus = bonusesOrAllowance !== undefined ? Number(bonusesOrAllowance) : salary.bonusesOrAllowance;

    salary.absentDeduction = absDed;
    salary.lateDeduction = lateDed;
    salary.halfDayDeduction = halfDed;
    salary.bonusesOrAllowance = bonus;
    salary.netSalary = Math.max(0, salary.basicSalary - (absDed + lateDed + halfDed) + bonus);

    if (remarks !== undefined) salary.remarks = remarks;
    if (status) {
      salary.status = status;
      if (status === 'PAID') salary.paidDate = new Date();
    }
    if (paymentMethod) salary.paymentMethod = paymentMethod;

    await salary.save();

    return res.status(200).json({
      success: true,
      message: 'Staff salary record updated successfully.',
      data: salary,
    });
  } catch (error) {
    console.error('Error updating staff salary:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error updating staff salary.',
    });
  }
};
