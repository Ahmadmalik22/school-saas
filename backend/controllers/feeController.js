import FeeVoucher from '../models/FeeVoucher.js';
import Student from '../models/Student.js';

/**
 * Fee Controller
 * Complete Financial Operations: Generation, Management, Sibling Vouchers, and Cash Collection.
 */

/**
 * Accurately reconcile and synchronize all historical and future fee vouchers for a student.
 * Cascades accumulated unpaid debt from month to month:
 * - If prior dues are cleared (balance = 0), subsequent months' arrears automatically drop to 0!
 * - If voucher was generated with outdated arrears, totalPayable and balance dynamically realign.
 */
export const reconcileStudentVouchers = async (studentId) => {
  if (!studentId) return;
  const vouchers = await FeeVoucher.find({ studentId }).sort({ monthYear: 1 });
  if (!vouchers || vouchers.length === 0) return;

  let accumulatedDebt = 0;

  for (let i = 0; i < vouchers.length; i++) {
    const v = vouchers[i];
    let changed = false;

    // For the very first voucher in history:
    if (i === 0) {
      const basePayable =
        (Number(v.netMonthlyFee) || 0) +
        (Number(v.previousArrears) || 0) +
        (Number(v.annualOrOtherCharges) || 0) +
        (Number(v.fine) || 0);
      const paid = Number(v.paidAmount) || 0;
      const currentBal = Math.max(0, basePayable - paid);
      accumulatedDebt = currentBal;
      continue;
    }

    // For all subsequent months:
    // Its previousArrears must be EXACTLY the accumulatedDebt from prior months!
    const expectedArrears = accumulatedDebt;
    if (Number(v.previousArrears) !== expectedArrears) {
      v.previousArrears = expectedArrears;
      changed = true;
    }

    const netFee = Number(v.netMonthlyFee) || 0;
    const charges = Number(v.annualOrOtherCharges) || 0;
    const fine = Number(v.fine) || 0;
    const expectedPayable = netFee + expectedArrears + charges + fine;

    if (Number(v.totalPayableWithinDueDate) !== expectedPayable) {
      v.totalPayableWithinDueDate = expectedPayable;
      v.totalPayableAfterDueDate = expectedPayable + (Number(v.lateFine) || 200);
      changed = true;
    }

    let paid = Number(v.paidAmount) || 0;
    // If paid exceeds expectedPayable (because old ghost arrears inflated the bill),
    // cap paid at expectedPayable so student is not overcharged or showing incorrect balance
    if (paid > expectedPayable && expectedPayable > 0) {
      paid = expectedPayable;
      v.paidAmount = paid;
      changed = true;
    }

    const expectedBalance = Math.max(0, expectedPayable - paid);
    if (Number(v.balance) !== expectedBalance) {
      v.balance = expectedBalance;
      changed = true;
    }

    const expectedStatus =
      expectedBalance === 0 && expectedPayable > 0
        ? 'PAID'
        : paid > 0
        ? 'PARTIALLY_PAID'
        : 'UNPAID';

    if (v.status !== expectedStatus) {
      v.status = expectedStatus;
      changed = true;
    }

    if (changed) {
      await v.save();
    }

    // Accumulated debt passed to the NEXT month
    accumulatedDebt = expectedBalance;
  }
};

// 1. Generate Class Monthly Fee Vouchers (High-Performance Batch Processing)
export const generateClassFee = async (req, res) => {
  try {
    const {
      schoolCode,
      className,
      section,
      monthYear, // e.g. "2026-10"
      dueDate,
      issueDate,
    } = req.body;

    if (!schoolCode || !className || !section || !monthYear || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'School code, class, section, month/year, and due date are required.',
      });
    }

    // Find all enrolled students of this class and section
    const students = await Student.find({
      schoolCode,
      $or: [{ className: className }, { currentClass: className }],
      section: section,
      status: { $ne: 'EXPELLED' },
    })
      .sort({ rollNumber: 1 })
      .lean();

    if (!students || students.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No active students found in Class ${className} - Section ${section}.`,
      });
    }

    const studentIds = students.map((s) => s._id);

    // Batch Check: Fetch all already generated vouchers for this month in 1 query
    const existingVouchers = await FeeVoucher.find({
      schoolCode,
      studentId: { $in: studentIds },
      monthYear,
    }).lean();

    const existingMap = new Map(existingVouchers.map((v) => [String(v.studentId), v]));
    const studentsNeedingVoucher = students.filter((s) => !existingMap.has(String(s._id)));

    let insertedVouchers = [];

    if (studentsNeedingVoucher.length > 0) {
      const missingIds = studentsNeedingVoucher.map((s) => s._id);

      // Single aggregation to fetch latest prior unpaid balance (arrears) for all students at once
      const priorArrearsAgg = await FeeVoucher.aggregate([
        {
          $match: {
            schoolCode,
            studentId: { $in: missingIds },
            monthYear: { $lt: monthYear },
          },
        },
        { $sort: { monthYear: -1 } },
        {
          $group: {
            _id: '$studentId',
            latestBalance: { $first: '$balance' },
          },
        },
      ]);

      const arrearsMap = new Map(
        priorArrearsAgg.map((a) => [String(a._id), Math.max(0, Number(a.latestBalance) || 0)])
      );

      const cleanMonth = monthYear.replace('-', '');

      const docsToInsert = studentsNeedingVoucher.map((student) => {
        const previousArrears = arrearsMap.get(String(student._id)) || 0;
        const baseMonthlyFee = student.monthlyFee || 2500;
        const discount = student.monthlyDiscount || 0;
        const netMonthlyFee = student.netMonthlyFee || Math.max(0, baseMonthlyFee - discount);
        const annualOrOtherCharges = 0;
        const fine = 0;
        const lateFine = 200;

        const totalPayableWithinDueDate = netMonthlyFee + previousArrears + annualOrOtherCharges + fine;
        const totalPayableAfterDueDate = totalPayableWithinDueDate + lateFine;

        const roll = (student.rollNumber || '00').padStart(2, '0');
        const rand = Math.floor(100 + Math.random() * 900);
        const voucherNo = `VCH-${cleanMonth}-${roll}-${rand}`;

        return {
          schoolCode,
          voucherNo,
          studentId: student._id,
          studentName: student.fullName,
          fatherName: student.fatherName,
          fatherCnic: student.fatherCnic || '',
          rollNumber: student.rollNumber || 'N/A',
          className,
          section,
          monthYear,
          issueDate: issueDate ? new Date(issueDate) : new Date(),
          dueDate: new Date(dueDate),
          baseMonthlyFee,
          discount,
          netMonthlyFee,
          annualOrOtherCharges,
          previousArrears,
          fine,
          totalPayableWithinDueDate,
          lateFine,
          totalPayableAfterDueDate,
          paidAmount: 0,
          balance: totalPayableWithinDueDate,
          status: 'UNPAID',
          remarks: '',
        };
      });

      // Atomic bulk insert (1 single database call instead of 50 individual saves!)
      insertedVouchers = await FeeVoucher.insertMany(docsToInsert, { ordered: false });
    }

    const allVouchers = [...existingVouchers, ...insertedVouchers];

    return res.status(200).json({
      success: true,
      message: `Fee vouchers processed successfully (${insertedVouchers.length} created, ${existingVouchers.length} existing).`,
      data: allVouchers,
      summary: {
        totalStudents: students.length,
        newlyCreated: insertedVouchers.length,
        alreadyExisting: existingVouchers.length,
      },
    });
  } catch (error) {
    console.error('Error generating class fee:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while generating fee vouchers.',
    });
  }
};

// 2. Get Class Fee Sheet for a specific Month (Ultra-Fast Lean Read)
export const getClassFeeSheet = async (req, res) => {
  try {
    const { schoolCode, className, section, monthYear } = req.query;

    if (!schoolCode || !className || !monthYear) {
      return res.status(400).json({
        success: false,
        message: 'School code, class, and month/year are required.',
      });
    }

    const query = { schoolCode, className, monthYear };
    if (section && section !== 'ALL') {
      query.section = section;
    }

    // Direct, ultra-fast indexed lean read (0 unnecessary DB writes)
    const vouchers = await FeeVoucher.find(query).sort({ rollNumber: 1 }).lean();

    // Aggregate KPI Stats
    const totalVouchers = vouchers.length;
    const totalReceivables = vouchers.reduce((acc, v) => acc + (v.totalPayableWithinDueDate || 0), 0);
    const totalCollected = vouchers.reduce((acc, v) => acc + (v.paidAmount || 0), 0);
    const totalArrears = vouchers.reduce((acc, v) => acc + (v.previousArrears || 0), 0);
    const totalRemaining = vouchers.reduce((acc, v) => acc + (v.balance || 0), 0);

    const paidCount = vouchers.filter((v) => v.status === 'PAID').length;
    const partialCount = vouchers.filter((v) => v.status === 'PARTIALLY_PAID').length;
    const unpaidCount = vouchers.filter((v) => v.status === 'UNPAID').length;

    return res.status(200).json({
      success: true,
      data: vouchers,
      stats: {
        totalVouchers,
        totalReceivables,
        totalCollected,
        totalArrears,
        totalRemaining,
        paidCount,
        partialCount,
        unpaidCount,
      },
    });
  } catch (error) {
    console.error('Error fetching class fee sheet:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error fetching fee sheet.',
    });
  }
};

// 3. Update / Edit Generated Fee Voucher (with Custom Remarks & Adjustments)
export const updateFeeVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      baseMonthlyFee,
      discount,
      annualOrOtherCharges,
      previousArrears,
      fine,
      lateFine,
      remarks,
    } = req.body;

    const voucher = await FeeVoucher.findById(id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Fee voucher not found.',
      });
    }

    const bFee = Number(baseMonthlyFee !== undefined ? baseMonthlyFee : voucher.baseMonthlyFee);
    const disc = Number(discount !== undefined ? discount : voucher.discount);
    const net = Math.max(0, bFee - disc);
    const other = Number(annualOrOtherCharges !== undefined ? annualOrOtherCharges : voucher.annualOrOtherCharges);
    const arrears = Number(previousArrears !== undefined ? previousArrears : voucher.previousArrears);
    const extraFine = Number(fine !== undefined ? fine : voucher.fine);
    const lFine = Number(lateFine !== undefined ? lateFine : voucher.lateFine);

    const totalWithin = net + arrears + other + extraFine;
    const totalAfter = totalWithin + lFine;

    voucher.baseMonthlyFee = bFee;
    voucher.discount = disc;
    voucher.netMonthlyFee = net;
    voucher.annualOrOtherCharges = other;
    voucher.previousArrears = arrears;
    voucher.fine = extraFine;
    voucher.lateFine = lFine;
    voucher.totalPayableWithinDueDate = totalWithin;
    voucher.totalPayableAfterDueDate = totalAfter;

    // Recalculate remaining balance against already paid amount
    const paid = voucher.paidAmount || 0;
    const newBalance = Math.max(0, totalWithin - paid);
    voucher.balance = newBalance;

    if (newBalance === 0 && totalWithin > 0) {
      voucher.status = 'PAID';
    } else if (paid > 0 && newBalance > 0) {
      voucher.status = 'PARTIALLY_PAID';
    } else if (paid === 0) {
      voucher.status = 'UNPAID';
    }

    if (remarks !== undefined) {
      voucher.remarks = remarks;
    }
    voucher.isEdited = true;

    await voucher.save();
    // Synchronize historical and future vouchers for this student
    await reconcileStudentVouchers(voucher.studentId);

    return res.status(200).json({
      success: true,
      message: 'Fee voucher updated successfully with remarks.',
      data: voucher,
    });
  } catch (error) {
    console.error('Error updating fee voucher:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error updating fee voucher.',
    });
  }
};

// 4. Accountant Cash Collection Counter (PAID, PARTIALLY_PAID, UNPAID with accurate dues clearance)
export const collectCashPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { cashReceived, receivedBy, paymentMethod = 'CASH', isClearDues = false } = req.body;

    const voucher = await FeeVoucher.findById(id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Fee voucher not found.',
      });
    }

    const received = Math.max(0, Number(cashReceived) || 0);
    const total = Number(voucher.totalPayableWithinDueDate) || 0;
    const alreadyPaid = Number(voucher.paidAmount) || 0;
    const currentBalance = Number(voucher.balance !== undefined ? voucher.balance : Math.max(0, total - alreadyPaid));

    let newlyPaidThisTransaction = 0;
    let newTotalPaid = 0;

    if (received === 0 && !isClearDues) {
      // Zero cash reset to UNPAID
      voucher.paidAmount = 0;
      voucher.balance = total;
      voucher.status = 'UNPAID';
    } else if (isClearDues || (currentBalance > 0 && received === currentBalance)) {
      // CLEAR REMAINING DUES!
      newlyPaidThisTransaction = currentBalance;
      newTotalPaid = total;
      voucher.paidAmount = total;
      voucher.balance = 0;
      voucher.status = 'PAID';
    } else if (received >= total && total > 0) {
      // Full payment covering entire voucher
      newlyPaidThisTransaction = Math.max(0, total - alreadyPaid);
      newTotalPaid = total;
      voucher.paidAmount = total;
      voucher.balance = 0;
      voucher.status = 'PAID';
    } else if (alreadyPaid > 0 && received <= currentBalance) {
      // Paying an installment of the remaining balance!
      newlyPaidThisTransaction = received;
      newTotalPaid = alreadyPaid + received;
      voucher.paidAmount = newTotalPaid;
      voucher.balance = Math.max(0, total - newTotalPaid);
      voucher.status = voucher.balance === 0 ? 'PAID' : 'PARTIALLY_PAID';
    } else if (alreadyPaid > 0 && received > currentBalance && received < total) {
      // User passed cumulative total paid
      newlyPaidThisTransaction = Math.max(0, received - alreadyPaid);
      newTotalPaid = received;
      voucher.paidAmount = newTotalPaid;
      voucher.balance = Math.max(0, total - newTotalPaid);
      voucher.status = voucher.balance === 0 ? 'PAID' : 'PARTIALLY_PAID';
    } else {
      // Initial partial payment on an UNPAID voucher
      newlyPaidThisTransaction = Math.min(received, total);
      newTotalPaid = newlyPaidThisTransaction;
      voucher.paidAmount = newTotalPaid;
      voucher.balance = Math.max(0, total - newTotalPaid);
      voucher.status = voucher.balance === 0 ? 'PAID' : (newTotalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
    }

    // Receipt particulars
    const cleanMonth = (voucher.monthYear || '202610').replace('-', '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const receiptNo = `REC-${cleanMonth}-${rand}`;
    voucher.receiptNo = receiptNo;
    voucher.receiptDate = new Date();
    voucher.receivedBy = receivedBy || 'School Accountant';
    voucher.paymentMethod = paymentMethod || 'CASH';

    // Log in paymentHistory
    if (!voucher.paymentHistory) voucher.paymentHistory = [];
    if (newlyPaidThisTransaction > 0) {
      voucher.paymentHistory.push({
        amount: newlyPaidThisTransaction,
        paymentDate: new Date(),
        paymentMethod: voucher.paymentMethod,
        receivedBy: voucher.receivedBy,
        receiptNo: voucher.receiptNo,
        note: voucher.status === 'PAID' ? 'Dues fully cleared' : 'Partial installment payment',
      });
    }

    await voucher.save();
    // Synchronize downstream vouchers for this student
    await reconcileStudentVouchers(voucher.studentId);

    return res.status(200).json({
      success: true,
      message: `Cash payment recorded successfully. Status: ${voucher.status}. Remaining Balance: PKR ${voucher.balance}`,
      data: voucher,
    });
  } catch (error) {
    console.error('Error collecting cash payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error collecting payment.',
    });
  }
};

// 5. Bulk Fee Revision (Increment / Decrement % or Fixed PKR)
export const bulkFeeRevision = async (req, res) => {
  try {
    const {
      schoolCode,
      scope, // 'CLASS' or 'ALL'
      className,
      action, // 'INCREMENT' or 'DECREMENT'
      type, // 'PERCENTAGE' or 'FIXED'
      value, // e.g. 10 (%) or 500 (PKR)
    } = req.body;

    if (!schoolCode || !action || !type || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'School code, action, type, and value are required.',
      });
    }

    const val = Number(value);
    if (val <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Revision value must be greater than zero.',
      });
    }

    const query = { schoolCode, status: { $ne: 'EXPELLED' } };
    if (scope === 'CLASS' && className) {
      query.$or = [{ className: className }, { currentClass: className }];
    }

    const students = await Student.find(query);
    if (!students || students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No eligible students found for fee revision.',
      });
    }

    const bulkOps = students.map((student) => {
      const oldFee = student.monthlyFee || 2500;
      let newFee = oldFee;

      if (type === 'PERCENTAGE') {
        const delta = Math.round((oldFee * val) / 100);
        newFee = action === 'INCREMENT' ? oldFee + delta : Math.max(0, oldFee - delta);
      } else {
        newFee = action === 'INCREMENT' ? oldFee + val : Math.max(0, oldFee - val);
      }

      const discount = student.monthlyDiscount || 0;
      const netFee = Math.max(0, newFee - discount);

      return {
        updateOne: {
          filter: { _id: student._id },
          update: { $set: { monthlyFee: newFee, netMonthlyFee: netFee } },
        },
      };
    });

    if (bulkOps.length > 0) {
      await Student.bulkWrite(bulkOps);
    }
    const updatedCount = bulkOps.length;

    return res.status(200).json({
      success: true,
      message: `Fee revision applied successfully to ${updatedCount} students (${action} of ${val}${type === 'PERCENTAGE' ? '%' : ' PKR'}).`,
      data: { updatedCount },
    });
  } catch (error) {
    console.error('Error applying bulk fee revision:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error applying bulk fee revision.',
    });
  }
};

// 6. Family Sibling Consolidated Fee Voucher
export const getFamilyVoucher = async (req, res) => {
  try {
    const { schoolCode, fatherCnic, monthYear } = req.query;

    if (!schoolCode || !fatherCnic || !monthYear) {
      return res.status(400).json({
        success: false,
        message: 'School code, Father CNIC, and month/year are required.',
      });
    }

    // Clean CNIC query: match formatted (35201-1234567-1) or digits only (3520112345671)
    const rawDigits = fatherCnic.replace(/\D/g, '');
    const regex = new RegExp(rawDigits.split('').join('-?'), 'i');

    const siblings = await Student.find({
      schoolCode,
      status: { $ne: 'EXPELLED' },
      fatherCnic: { $regex: regex },
    }).sort({ currentClass: 1 });

    if (!siblings || siblings.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No active students found matching Father CNIC: ${fatherCnic}.`,
      });
    }

    const siblingVouchers = [];

    for (const student of siblings) {
      await reconcileStudentVouchers(student._id);

      let voucher = await FeeVoucher.findOne({
        studentId: student._id,
        monthYear,
      });

      // If voucher doesn't exist yet, auto-create it
      if (!voucher) {
        const priorVouchers = await FeeVoucher.find({
          studentId: student._id,
          monthYear: { $lt: monthYear },
        }).sort({ monthYear: -1 });

        const previousArrears = priorVouchers.length > 0 ? Math.max(0, Number(priorVouchers[0].balance) || 0) : 0;
        const baseMonthlyFee = student.monthlyFee || 2500;
        const discount = student.monthlyDiscount || 0;
        const netMonthlyFee = student.netMonthlyFee || Math.max(0, baseMonthlyFee - discount);
        const totalWithin = netMonthlyFee + previousArrears;

        const cleanMonth = monthYear.replace('-', '');
        const roll = (student.rollNumber || '00').padStart(2, '0');
        const rand = Math.floor(100 + Math.random() * 900);
        const voucherNo = `VCH-${cleanMonth}-${roll}-${rand}`;

        voucher = new FeeVoucher({
          schoolCode,
          voucherNo,
          studentId: student._id,
          studentName: student.fullName,
          fatherName: student.fatherName,
          fatherCnic: student.fatherCnic || fatherCnic,
          rollNumber: student.rollNumber || 'N/A',
          className: student.className || student.currentClass || 'General',
          section: student.section || 'A',
          monthYear,
          issueDate: new Date(),
          dueDate: new Date(new Date().setDate(new Date().getDate() + 10)),
          baseMonthlyFee,
          discount,
          netMonthlyFee,
          annualOrOtherCharges: 0,
          previousArrears,
          fine: 0,
          totalPayableWithinDueDate: totalWithin,
          lateFine: 200,
          totalPayableAfterDueDate: totalWithin + 200,
          paidAmount: 0,
          balance: totalWithin,
          status: 'UNPAID',
        });

        await voucher.save();
      }

      siblingVouchers.push(voucher);
    }

    // Consolidated Grand Totals
    const totalTuition = siblingVouchers.reduce((acc, v) => acc + v.baseMonthlyFee, 0);
    const totalDiscount = siblingVouchers.reduce((acc, v) => acc + v.discount, 0);
    const totalArrears = siblingVouchers.reduce((acc, v) => acc + v.previousArrears, 0);
    const grandPayable = siblingVouchers.reduce((acc, v) => acc + v.totalPayableWithinDueDate, 0);
    const grandPaid = siblingVouchers.reduce((acc, v) => acc + v.paidAmount, 0);
    const grandBalance = siblingVouchers.reduce((acc, v) => acc + v.balance, 0);

    const familyVoucherId = `FAM-${monthYear.replace('-', '')}-${rawDigits.slice(-5)}`;

    return res.status(200).json({
      success: true,
      data: {
        familyVoucherId,
        fatherName: siblings[0].fatherName,
        fatherCnic,
        fatherPhone: siblings[0].fatherPhone || 'N/A',
        monthYear,
        totalChildren: siblings.length,
        totalTuition,
        totalDiscount,
        totalArrears,
        grandPayable,
        grandPaid,
        grandBalance,
        status: grandBalance === 0 ? 'PAID' : grandPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
        siblings: siblingVouchers,
      },
    });
  } catch (error) {
    console.error('Error fetching family voucher:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error fetching family voucher.',
    });
  }
};

// 7. Collect Family Sibling Cash Payment
export const collectFamilyCashPayment = async (req, res) => {
  try {
    const { schoolCode, fatherCnic, monthYear, totalCashReceived, receivedBy } = req.body;

    if (!schoolCode || !fatherCnic || !monthYear || totalCashReceived === undefined) {
      return res.status(400).json({
        success: false,
        message: 'School code, Father CNIC, month/year, and cash amount are required.',
      });
    }

    let remainingCash = Math.max(0, Number(totalCashReceived) || 0);

    const rawDigits = fatherCnic.replace(/\D/g, '');
    const regex = new RegExp(rawDigits.split('').join('-?'), 'i');

    const siblings = await Student.find({
      schoolCode,
      status: { $ne: 'EXPELLED' },
      fatherCnic: { $regex: regex },
    });

    if (!siblings || siblings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No siblings found.',
      });
    }

    const siblingIds = siblings.map((s) => s._id);
    const vouchers = await FeeVoucher.find({
      studentId: { $in: siblingIds },
      monthYear,
    }).sort({ totalPayableWithinDueDate: 1 });

    const updatedVouchers = [];

    for (const v of vouchers) {
      const payable = Number(v.totalPayableWithinDueDate) || 0;
      const alreadyPaid = Number(v.paidAmount) || 0;
      const currentBalance = Number(v.balance !== undefined ? v.balance : Math.max(0, payable - alreadyPaid));

      if (currentBalance === 0) {
        updatedVouchers.push(v);
        continue;
      }

      if (remainingCash >= currentBalance) {
        const paymentNow = currentBalance;
        v.paidAmount = payable;
        v.balance = 0;
        v.status = 'PAID';
        remainingCash -= paymentNow;

        if (!v.paymentHistory) v.paymentHistory = [];
        v.paymentHistory.push({
          amount: paymentNow,
          paymentDate: new Date(),
          paymentMethod: 'CASH',
          receivedBy: receivedBy || 'School Accountant',
          note: 'Family voucher dues cleared',
        });
      } else if (remainingCash > 0) {
        const paymentNow = remainingCash;
        v.paidAmount = alreadyPaid + paymentNow;
        v.balance = Math.max(0, payable - v.paidAmount);
        v.status = v.balance === 0 ? 'PAID' : 'PARTIALLY_PAID';
        remainingCash = 0;

        if (!v.paymentHistory) v.paymentHistory = [];
        v.paymentHistory.push({
          amount: paymentNow,
          paymentDate: new Date(),
          paymentMethod: 'CASH',
          receivedBy: receivedBy || 'School Accountant',
          note: 'Family voucher partial installment',
        });
      }

      v.receiptDate = new Date();
      v.receivedBy = receivedBy || 'School Accountant';
      v.paymentMethod = 'CASH';
      await v.save();
      updatedVouchers.push(v);
    }

    // Reconcile all siblings' fee cascades
    for (const sId of siblingIds) {
      await reconcileStudentVouchers(sId);
    }

    return res.status(200).json({
      success: true,
      message: 'Family cash payment distributed and settled successfully.',
      data: updatedVouchers,
    });
  } catch (error) {
    console.error('Error collecting family cash payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error processing family payment.',
    });
  }
};
