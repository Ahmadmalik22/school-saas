import ExpenseCategory from '../models/ExpenseCategory.js';
import Expense from '../models/Expense.js';
import SchoolProfile from '../models/SchoolProfile.js';

// Default Pakistani school expense heads to seed on first launch
const DEFAULT_EXPENSE_HEADS = [
  { name: 'Staff Tea & Refreshment', description: 'Daily tea, milk, biscuits & guest refreshment' },
  { name: 'Photostate & Stationery', description: 'Exam papers, copies, diaries & office supplies' },
  { name: 'Electricity & Utilities', description: 'WAPDA/LESCO electricity, gas, water & internet' },
  { name: 'Building Maintenance & Repairs', description: 'Plumbing, electrician, whitewash & carpentry' },
  { name: 'Campus Rent', description: 'Monthly school building rent' },
  { name: 'Miscellaneous & Petty Cash', description: 'Cleaning supplies, peon daily petty expenses' },
];

/**
 * 1. Get All Categories (Auto-seeds default Pakistani school heads if empty)
 */
export const getCategories = async (req, res) => {
  try {
    const { schoolCode } = req.query;
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    let categories = await ExpenseCategory.find({ schoolCode, isActive: true }).sort({ name: 1 });

    // Seed defaults if brand new school AND school genuinely exists in SchoolProfile
    if (!categories || categories.length === 0) {
      const schoolExists = await SchoolProfile.exists({ schoolCode });
      if (!schoolExists) {
        return res.status(200).json({ success: true, data: [] });
      }

      const seedData = DEFAULT_EXPENSE_HEADS.map((h) => ({
        schoolCode,
        name: h.name,
        description: h.description,
        isActive: true,
      }));

      try {
        categories = await ExpenseCategory.insertMany(seedData, { ordered: false });
      } catch (seedErr) {
        // In case of parallel inserts, fetch existing
        categories = await ExpenseCategory.find({ schoolCode, isActive: true }).sort({ name: 1 });
      }
    }

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error in getCategories:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Create / Open New Expense Category
 */
export const createCategory = async (req, res) => {
  try {
    const { schoolCode, name, description } = req.body;
    if (!schoolCode || !name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'School code and category name are required.' });
    }

    const trimmedName = name.trim();

    // Check if category already exists
    const existing = await ExpenseCategory.findOne({
      schoolCode,
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        await existing.save();
        return res.status(200).json({
          success: true,
          message: 'Category reactivated successfully.',
          data: existing,
        });
      }
      return res.status(400).json({
        success: false,
        message: 'A category with this name is already open.',
      });
    }

    const newCategory = new ExpenseCategory({
      schoolCode,
      name: trimmedName,
      description: description ? description.trim() : '',
      isActive: true,
    });

    await newCategory.save();

    return res.status(201).json({
      success: true,
      message: `Category "${trimmedName}" opened successfully.`,
      data: newCategory,
    });
  } catch (error) {
    console.error('Error in createCategory:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Record Daily Expense
 */
export const recordExpense = async (req, res) => {
  try {
    const { schoolCode, categoryId, amount, expenseDate, remarks, recordedBy } = req.body;

    if (!schoolCode || !categoryId || !amount || Number(amount) <= 0 || !remarks || !remarks.trim()) {
      return res.status(400).json({
        success: false,
        message: 'School code, category, positive amount, and remarks are required.',
      });
    }

    const category = await ExpenseCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Expense category not found.' });
    }

    const d = expenseDate ? new Date(expenseDate) : new Date();
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Generate unique Voucher No: EXP-YYYYMM-XXXX
    const cleanMonth = monthYear.replace('-', '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const voucherNo = `EXP-${cleanMonth}-${rand}`;

    const expense = new Expense({
      schoolCode,
      voucherNo,
      categoryId: category._id,
      categoryName: category.name,
      amount: Number(amount),
      expenseDate: d,
      dateString,
      monthYear,
      remarks: remarks.trim(),
      recordedBy: recordedBy ? recordedBy.trim() : 'School Accountant',
    });

    await expense.save();

    return res.status(201).json({
      success: true,
      message: `Expense of PKR ${Number(amount).toLocaleString()} recorded successfully under "${category.name}".`,
      data: expense,
    });
  } catch (error) {
    console.error('Error in recordExpense:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Get Expense Ledger & Statistics
 */
export const getExpenseLedger = async (req, res) => {
  try {
    const { schoolCode, monthYear, categoryId, search } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const currentD = new Date();
    const todayStr = `${currentD.getFullYear()}-${String(currentD.getMonth() + 1).padStart(2, '0')}-${String(currentD.getDate()).padStart(2, '0')}`;
    const targetMonth = monthYear || `${currentD.getFullYear()}-${String(currentD.getMonth() + 1).padStart(2, '0')}`;

    const query = { schoolCode, monthYear: targetMonth };

    if (categoryId && categoryId !== 'ALL') {
      query.categoryId = categoryId;
    }

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { categoryName: { $regex: q, $options: 'i' } },
        { remarks: { $regex: q, $options: 'i' } },
        { voucherNo: { $regex: q, $options: 'i' } },
      ];
    }

    const expenses = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 });

    // Calculate Statistics for this month
    const allMonthExpenses = await Expense.find({ schoolCode, monthYear: targetMonth });

    let totalMonthlyAmount = 0;
    let todayAmount = 0;
    const categoryTotals = {};

    allMonthExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      totalMonthlyAmount += amt;

      if (exp.dateString === todayStr) {
        todayAmount += amt;
      }

      categoryTotals[exp.categoryName] = (categoryTotals[exp.categoryName] || 0) + amt;
    });

    // Top Category
    let topCategory = { name: 'None', amount: 0 };
    Object.entries(categoryTotals).forEach(([catName, amt]) => {
      if (amt > topCategory.amount) {
        topCategory = { name: catName, amount: amt };
      }
    });

    return res.status(200).json({
      success: true,
      data: expenses,
      stats: {
        totalMonthlyAmount,
        todayAmount,
        totalEntries: allMonthExpenses.length,
        topCategory,
        categoryTotals,
        monthYear: targetMonth,
      },
    });
  } catch (error) {
    console.error('Error in getExpenseLedger:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Update Expense Entry
 */
export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, categoryId, remarks, expenseDate } = req.body;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    if (categoryId && categoryId !== String(expense.categoryId)) {
      const cat = await ExpenseCategory.findById(categoryId);
      if (cat) {
        expense.categoryId = cat._id;
        expense.categoryName = cat.name;
      }
    }

    if (amount !== undefined && Number(amount) > 0) {
      expense.amount = Number(amount);
    }

    if (remarks !== undefined && remarks.trim()) {
      expense.remarks = remarks.trim();
    }

    if (expenseDate) {
      const d = new Date(expenseDate);
      expense.expenseDate = d;
      expense.dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expense.monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    await expense.save();

    return res.status(200).json({
      success: true,
      message: 'Expense record updated successfully.',
      data: expense,
    });
  } catch (error) {
    console.error('Error in updateExpense:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Delete Expense Entry
 */
export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Expense.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Expense voucher ${deleted.voucherNo} deleted successfully.`,
    });
  } catch (error) {
    console.error('Error in deleteExpense:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
