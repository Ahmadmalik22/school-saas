import ExcelJS from 'exceljs';

/**
 * Enterprise Excel Export Engine (Powered by ExcelJS)
 * Generates executive-styled .xlsx workbooks with school branding,
 * custom typography, color-coded headers, currency formats, and automated totals.
 */

// Save and trigger browser download
async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Common Border Style
const thinBorder = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

const headerBorder = {
  top: { style: 'medium', color: { argb: 'FF041633' } },
  left: { style: 'thin', color: { argb: 'FF334155' } },
  bottom: { style: 'medium', color: { argb: 'FF041633' } },
  right: { style: 'thin', color: { argb: 'FF334155' } },
};

/**
 * 1. Export Student Fee Sheet / Recovery Ledger
 */
export async function exportFeeSheetToExcel({
  schoolCode = 'SCH-101',
  schoolName = 'ISLAMABAD MODEL COLLEGE FOR BOYS',
  className = '',
  section = '',
  monthYear = '',
  vouchers = [],
  stats = null,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = `${schoolName} Portal`;
  wb.created = new Date();

  const ws = wb.addWorksheet(`Class ${className}-${section} Fee`);

  // 1. Institution Banner (Row 1-3)
  ws.getCell('A1').value = schoolName.toUpperCase();
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF041633' }, name: 'Calibri' };

  ws.getCell('A2').value = `STUDENT MONTHLY FEE & COLLECTION LEDGER — ${monthYear.toUpperCase()}`;
  ws.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };

  ws.getCell('A3').value = `Campus: ${schoolCode}  |  Class: Class ${className} (${section})  |  Generated on: ${new Date().toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

  // Spacing
  ws.addRow([]);

  // 2. Column Headers (Row 5)
  const headers = [
    'Sr #',
    'Challan No',
    'Roll #',
    'Student Full Name',
    'Father Name',
    'Monthly Fee (PKR)',
    'Discount (PKR)',
    'Arrears / Dues (PKR)',
    'Payable by Due Date (PKR)',
    'Amount Paid (PKR)',
    'Remaining Balance (PKR)',
    'Payment Status',
    'Receipt No',
    'Remarks',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 26;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF041633' }, // Akkhor Deep Navy
    };
    cell.border = headerBorder;
  });

  // Highlight Key Financial Headers
  headerRow.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Payable
  headerRow.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } }; // Paid (Dark Emerald)
  headerRow.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } }; // Balance (Dark Crimson)

  // 3. Populate Data Rows
  let totalBase = 0;
  let totalDiscount = 0;
  let totalArrears = 0;
  let totalPayable = 0;
  let totalPaid = 0;
  let totalBalance = 0;

  vouchers.forEach((v, idx) => {
    const rowValues = [
      idx + 1,
      v.voucherNo || '-',
      v.rollNumber || '-',
      (v.studentName || '').toUpperCase(),
      (v.fatherName || '').toUpperCase(),
      v.baseMonthlyFee || 0,
      v.discount || 0,
      v.previousArrears || 0,
      v.totalPayableWithinDueDate || 0,
      v.paidAmount || 0,
      v.balance || 0,
      v.status || 'UNPAID',
      v.receiptNo || '-',
      v.remarks || '',
    ];

    totalBase += v.baseMonthlyFee || 0;
    totalDiscount += v.discount || 0;
    totalArrears += v.previousArrears || 0;
    totalPayable += v.totalPayableWithinDueDate || 0;
    totalPaid += v.paidAmount || 0;
    totalBalance += v.balance || 0;

    const row = ws.addRow(rowValues);
    row.height = 20;

    const isEven = idx % 2 === 0;
    row.eachCell((cell, colIndex) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };

      // Zebra striping
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      // Column specific formatting
      if (colIndex === 1) {
        cell.alignment = { horizontal: 'center' };
      } else if (colIndex === 2 || colIndex === 3) {
        cell.alignment = { horizontal: 'center' };
        cell.font = { name: 'Courier New', bold: true, size: 9 };
      } else if (colIndex >= 6 && colIndex <= 11) {
        cell.alignment = { horizontal: 'right' };
        cell.numFormat = '#,##0;[Red](#,##0);"-"';
      } else if (colIndex === 12) {
        cell.alignment = { horizontal: 'center' };
        cell.font = { bold: true, size: 9 };
        if (v.status === 'PAID') {
          cell.font = { color: { argb: 'FF047857' }, bold: true };
        } else if (v.status === 'PARTIALLY_PAID') {
          cell.font = { color: { argb: 'FFD97706' }, bold: true };
        } else {
          cell.font = { color: { argb: 'FFDC2626' }, bold: true };
        }
      }
    });
  });

  // 4. Grand Totals Row
  const totalRowValues = [
    'TOTAL',
    '',
    '',
    `Students: ${vouchers.length}`,
    '',
    totalBase,
    totalDiscount,
    totalArrears,
    totalPayable,
    totalPaid,
    totalBalance,
    '',
    '',
    '',
  ];

  const totalRow = ws.addRow(totalRowValues);
  totalRow.height = 24;

  totalRow.eachCell((cell, colIndex) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }, // Slate 900
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF041633' } },
      bottom: { style: 'double', color: { argb: 'FF041633' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };

    if (colIndex >= 6 && colIndex <= 11) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFormat = '#,##0;[Red](#,##0);"-"';
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // Column Widths Auto-sizing
  const colWidths = [6, 20, 10, 24, 22, 16, 14, 16, 20, 16, 18, 16, 18, 22];
  colWidths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  const filename = `${schoolCode}_Class_${className}_${section}_Fee_${monthYear}.xlsx`;
  await downloadWorkbook(wb, filename);
}

/**
 * 2. Export Staff Monthly Payroll / Salary Sheet
 */
export async function exportStaffPayrollToExcel({
  schoolCode = 'SCH-101',
  schoolName = 'ISLAMABAD MODEL COLLEGE FOR BOYS',
  monthYear = '',
  records = [],
  stats = null,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = `${schoolName} Portal`;
  wb.created = new Date();

  const ws = wb.addWorksheet('Staff Payroll');

  // Title Banner
  ws.getCell('A1').value = schoolName.toUpperCase();
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF041633' } };

  ws.getCell('A2').value = `FACULTY & STAFF MONTHLY PAYROLL STATEMENT — ${monthYear.toUpperCase()}`;
  ws.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };

  ws.getCell('A3').value = `Campus: ${schoolCode}  |  Generated on: ${new Date().toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

  ws.addRow([]);

  // Headers
  const headers = [
    'Sr #',
    'Employee ID',
    'Full Name',
    'Role / Designation',
    'Department',
    'Basic Salary (PKR)',
    'Present Days',
    'Lates',
    'Half Days',
    'Absents',
    'Late Fine (PKR)',
    'Absent Deduction (PKR)',
    'Allowances (PKR)',
    'Net Salary Payable (PKR)',
    'Status',
    'Disbursement Date',
    'Remarks',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 26;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF041633' },
    };
    cell.border = headerBorder;
  });

  // Highlight Net Salary header
  headerRow.getCell(14).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };

  let totalBasic = 0;
  let totalDeductions = 0;
  let totalAllowances = 0;
  let totalNet = 0;

  records.forEach((r, idx) => {
    const totalDed = (r.absentDeduction || 0) + (r.lateDeduction || 0) + (r.halfDayDeduction || 0);
    totalBasic += r.basicSalary || 0;
    totalDeductions += totalDed;
    totalAllowances += r.allowances || 0;
    totalNet += r.netSalary || 0;

    const row = ws.addRow([
      idx + 1,
      r.employeeId || '-',
      (r.name || '').toUpperCase(),
      r.role || 'Teacher',
      r.department || 'General',
      r.basicSalary || 0,
      r.attendanceMetrics?.present || 0,
      r.attendanceMetrics?.late || 0,
      r.attendanceMetrics?.halfDay || 0,
      r.attendanceMetrics?.absent || 0,
      r.lateDeduction || 0,
      r.absentDeduction || 0,
      r.allowances || 0,
      r.netSalary || 0,
      r.status || 'UNPAID',
      r.paymentDate ? new Date(r.paymentDate).toLocaleDateString('en-GB') : '-',
      r.remarks || '',
    ]);

    row.height = 20;
    const isEven = idx % 2 === 0;

    row.eachCell((cell, colIndex) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      if (colIndex === 1 || colIndex === 2) {
        cell.alignment = { horizontal: 'center' };
      } else if (colIndex >= 6 && colIndex <= 14) {
        cell.alignment = { horizontal: 'right' };
        if (colIndex === 6 || colIndex >= 11) {
          cell.numFormat = '#,##0;[Red](#,##0);"-"';
        }
      } else if (colIndex === 15) {
        cell.alignment = { horizontal: 'center' };
        cell.font = { bold: true };
        cell.font = r.status === 'PAID'
          ? { color: { argb: 'FF047857' }, bold: true }
          : { color: { argb: 'FFDC2626' }, bold: true };
      }
    });
  });

  // Grand Total Row
  const totalRow = ws.addRow([
    'TOTAL',
    '',
    `Staff: ${records.length}`,
    '',
    '',
    totalBasic,
    '',
    '',
    '',
    '',
    '',
    '',
    totalAllowances,
    totalNet,
    '',
    '',
    '',
  ]);

  totalRow.height = 24;
  totalRow.eachCell((cell, colIndex) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    if (colIndex === 6 || colIndex === 13 || colIndex === 14) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFormat = '#,##0;[Red](#,##0);"-"';
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  const colWidths = [6, 16, 22, 18, 16, 18, 12, 10, 10, 10, 14, 18, 16, 20, 14, 16, 20];
  colWidths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  const filename = `${schoolCode}_Staff_Payroll_${monthYear}.xlsx`;
  await downloadWorkbook(wb, filename);
}

/**
 * 3. Export Student Master Directory / Enrollment Roster
 */
export async function exportStudentDirectoryToExcel({
  schoolCode = 'SCH-101',
  schoolName = 'ISLAMABAD MODEL COLLEGE FOR BOYS',
  students = [],
  filterClass = 'ALL',
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = `${schoolName} Portal`;
  wb.created = new Date();

  const ws = wb.addWorksheet('Enrolled Students');

  ws.getCell('A1').value = schoolName.toUpperCase();
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF041633' } };

  ws.getCell('A2').value = `STUDENT ENROLLMENT & MASTER DIRECTORY (Filter: ${filterClass})`;
  ws.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };

  ws.getCell('A3').value = `Campus: ${schoolCode}  |  Total Enrolled: ${students.length}  |  Generated on: ${new Date().toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

  ws.addRow([]);

  const headers = [
    'Sr #',
    'Admission No',
    'Roll #',
    'Full Name',
    'Class',
    'Section',
    'Gender',
    'Father Name',
    'Father CNIC',
    'Father Mobile',
    'Residential Address',
    'Agreed Monthly Fee (PKR)',
    'Concession (PKR)',
    'Net Payable / Mo (PKR)',
    'Status',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF041633' },
    };
    cell.border = headerBorder;
  });

  students.forEach((s, idx) => {
    const net = Math.max(0, (s.monthlyFee || 2500) - (s.monthlyDiscount || 0));
    const row = ws.addRow([
      idx + 1,
      s.admissionNumber || '-',
      s.rollNumber || '-',
      (s.fullName || '').toUpperCase(),
      s.className || '-',
      s.section || '-',
      s.gender || '-',
      (s.fatherName || '').toUpperCase(),
      s.fatherCnic || '-',
      s.fatherPhone || '-',
      s.address || '-',
      s.monthlyFee || 2500,
      s.monthlyDiscount || 0,
      net,
      s.status || 'ACTIVE',
    ]);

    row.height = 19;
    const isEven = idx % 2 === 0;

    row.eachCell((cell, colIndex) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
      if (colIndex === 1 || colIndex === 2 || colIndex === 3 || colIndex === 5 || colIndex === 6) {
        cell.alignment = { horizontal: 'center' };
      } else if (colIndex >= 12 && colIndex <= 14) {
        cell.alignment = { horizontal: 'right' };
        cell.numFormat = '#,##0;[Red](#,##0);"-"';
      }
    });
  });

  const widths = [6, 16, 10, 22, 12, 10, 10, 22, 18, 16, 30, 20, 16, 20, 14];
  widths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  const filename = `${schoolCode}_Students_Directory.xlsx`;
  await downloadWorkbook(wb, filename);
}

/**
 * 4. Export Roznamcha / Daily Expense Ledger
 */
export async function exportExpenseLedgerToExcel({
  schoolCode = 'SCH-101',
  schoolName = 'ISLAMABAD MODEL COLLEGE FOR BOYS',
  monthYear = '',
  expenses = [],
  stats = null,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = `${schoolName} Portal`;
  wb.created = new Date();

  const ws = wb.addWorksheet(`Expenses ${monthYear}`);

  // Title Banner
  ws.getCell('A1').value = schoolName.toUpperCase();
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF041633' } };

  ws.getCell('A2').value = `ROZNAMCHA — EXPENSE & AKHRAJAAT STATEMENT (${monthYear.toUpperCase()})`;
  ws.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };

  ws.getCell('A3').value = `Campus: ${schoolCode}  |  Total Recorded: ${expenses.length} Entries  |  Generated on: ${new Date().toLocaleDateString('en-GB')}`;
  ws.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

  ws.addRow([]);

  // Headers
  const headers = [
    'Sr #',
    'Voucher No',
    'Date',
    'Category Head',
    'Remarks / Description',
    'Amount (PKR)',
    'Recorded By',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF041633' },
    };
    cell.border = headerBorder;
  });

  headerRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } }; // Dark red for Amount

  let totalExpenseAmount = 0;

  expenses.forEach((exp, idx) => {
    const amt = Number(exp.amount) || 0;
    totalExpenseAmount += amt;

    const row = ws.addRow([
      idx + 1,
      exp.voucherNo || '-',
      exp.dateString || (exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString('en-GB') : '-'),
      exp.categoryName || 'General',
      exp.remarks || '',
      amt,
      exp.recordedBy || 'Accountant',
    ]);

    row.height = 20;
    const isEven = idx % 2 === 0;

    row.eachCell((cell, colIndex) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
      if (colIndex === 1 || colIndex === 2 || colIndex === 3) {
        cell.alignment = { horizontal: 'center' };
      } else if (colIndex === 6) {
        cell.alignment = { horizontal: 'right' };
        cell.numFormat = '#,##0;[Red](#,##0);"-"';
        cell.font = { bold: true, color: { argb: 'FFDC2626' } };
      }
    });
  });

  // Grand Total Row
  const totalRow = ws.addRow([
    'TOTAL',
    '',
    '',
    `Entries: ${expenses.length}`,
    'TOTAL MONTHLY EXPENDITURE',
    totalExpenseAmount,
    '',
  ]);

  totalRow.height = 24;
  totalRow.eachCell((cell, colIndex) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    if (colIndex === 6) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFormat = '#,##0;[Red](#,##0);"-"';
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  const widths = [6, 18, 14, 26, 36, 18, 20];
  widths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  const filename = `${schoolCode}_Expenses_Ledger_${monthYear}.xlsx`;
  await downloadWorkbook(wb, filename);
}

