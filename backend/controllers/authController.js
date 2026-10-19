import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import SchoolProfile from '../models/SchoolProfile.js';
import Student from '../models/Student.js';
import Staff from '../models/Staff.js';
import { AcademicClass } from '../models/AcademicClass.js';
import AcademicSession from '../models/AcademicSession.js';
import ExamTerm from '../models/ExamTerm.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import StudentAttendance from '../models/StudentAttendance.js';
import StaffAttendance from '../models/StaffAttendance.js';
import FeeVoucher from '../models/FeeVoucher.js';
import StaffSalary from '../models/StaffSalary.js';
import Expense from '../models/Expense.js';
import ClassSubject from '../models/ClassSubject.js';
import StudentExamMarks from '../models/StudentExamMarks.js';
import AdmissionInquiry from '../models/AdmissionInquiry.js';
import ClassWhatsAppGroup from '../models/ClassWhatsAppGroup.js';
import SchoolWhatsAppSession from '../models/SchoolWhatsAppSession.js';
import { disconnectSession } from '../services/whatsappGateway.js';

import { ALL_SUBMODULE_KEYS, ROLE_PRESETS, SYSTEM_MODULES } from '../config/moduleCatalog.js';

// Export catalog for frontend rights assignment
export const getModuleCatalog = (req, res) => {
  return res.status(200).json({
    success: true,
    data: SYSTEM_MODULES,
    allKeys: ALL_SUBMODULE_KEYS,
    presets: ROLE_PRESETS,
  });
};

// Helper to generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolCode: user.schoolCode,
      schoolName: user.schoolName,
      permissions: user.permissions || [],
    },
    process.env.JWT_SECRET || 'wholesale_b2b_jwt_secret_token_key_2026_secure',
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

// =========================================================================
// 1. AUTO-SEED DEVELOPER & DEFAULT ADMIN ACCOUNTS (Self-healing on startup)
// =========================================================================
export const ensureDeveloperAndDefaultAccounts = async () => {
  try {
    // 1. Master Developer Account
    let dev = await User.findOne({ role: 'SUPER_ADMIN' });
    if (!dev) {
      dev = new User({
        name: 'Master Developer',
        email: 'developer@edunexus.com',
        password: 'dev123456',
        role: 'SUPER_ADMIN',
        schoolCode: 'SYSTEM',
        schoolName: 'EduNexus SaaS Developer Platform',
        permissions: ALL_SUBMODULE_KEYS,
        isActive: true,
      });
      await dev.save();
      console.log('✅ Master Developer Account provisioned: developer@edunexus.com / dev123456');
    } else {
      if (dev.schoolName && dev.schoolName.includes('Akkhor')) {
        dev.schoolName = 'EduNexus SaaS Developer Platform';
        await dev.save();
      }
    }

    // 2. Default School SCH-101 Profile & Admin
    let sch101Profile = await SchoolProfile.findOne({ schoolCode: 'SCH-101' });
    if (!sch101Profile) {
      sch101Profile = await SchoolProfile.create({
        schoolCode: 'SCH-101',
        schoolName: 'ISLAMABAD MODEL COLLEGE FOR BOYS',
        tagline: 'Excellence in Education & Character Building',
        address: 'PAKISTAN TOWN, ISLAMABAD',
        phone: '+92 51 9283741',
        email: 'admin@imcb.edu.pk',
        affiliation: 'Affiliated with Federal Board (FBISE)',
        status: 'ACTIVE',
      });
    }

    const sch101Admin = await User.findOne({ schoolCode: 'SCH-101', role: 'ADMIN' });
    if (!sch101Admin) {
      const admin = new User({
        name: 'Principal Admin',
        email: 'admin@imcb.edu.pk',
        password: 'admin123',
        role: 'ADMIN',
        schoolCode: 'SCH-101',
        schoolName: 'ISLAMABAD MODEL COLLEGE FOR BOYS',
        permissions: ALL_SUBMODULE_KEYS,
        isActive: true,
      });
      await admin.save();
      console.log('✅ Default School Admin provisioned: admin@imcb.edu.pk / admin123');
    }
  } catch (error) {
    console.error('Error ensuring developer/default accounts:', error.message);
  }
};

// =========================================================================
// 2. USER LOGIN CONTROLLER (Supports Developer, Principal, Accountant & Staff)
// =========================================================================
export const login = async (req, res) => {
  try {
    const { email, password, schoolCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    let query = { email: cleanEmail };

    // Seamless support for Master Developer with edunexus or akkhor domain
    if (cleanEmail === 'developer@edunexus.com' || cleanEmail === 'developer@akkhor.com') {
      const devUser = await User.findOne({ role: 'SUPER_ADMIN' });
      if (devUser) {
        query = { _id: devUser._id };
      }
    } else if (schoolCode && schoolCode.trim().toUpperCase() !== 'SYSTEM') {
      query.schoolCode = schoolCode.trim().toUpperCase();
    }

    // Find user
    let user = await User.findOne(query);

    // If not found with specific school code, try finding developer or globally unique user
    if (!user && !schoolCode) {
      user = await User.findOne({ email: cleanEmail });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User account does not exist.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact your school administrator or developer.',
      });
    }

    // Validate password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Please check your credentials.',
      });
    }

    // If not Developer, check if School license is Active
    let schoolProfile = null;
    if (user.schoolCode && user.schoolCode !== 'SYSTEM') {
      schoolProfile = await SchoolProfile.findOne({ schoolCode: user.schoolCode }).lean();
      if (schoolProfile && schoolProfile.status === 'SUSPENDED' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          message: `School license for [${user.schoolCode}] is currently SUSPENDED. Please contact your system provider.`,
        });
      }
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        schoolCode: user.schoolCode,
        schoolName: schoolProfile?.schoolName || user.schoolName,
        permissions: user.permissions || ALL_SUBMODULE_KEYS,
        profilePicture: user.profilePicture?.url || null,
      },
      schoolProfile: schoolProfile || {
        schoolCode: user.schoolCode,
        schoolName: user.schoolName,
        tagline: 'School Management Portal',
        logoUrl: null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during login.',
    });
  }
};

// =========================================================================
// 3. GET CURRENT LOGGED IN USER PROFILE
// =========================================================================
export const getMe = async (req, res) => {
  try {
    let schoolProfile = null;
    if (req.user.schoolCode && req.user.schoolCode !== 'SYSTEM') {
      schoolProfile = await SchoolProfile.findOne({ schoolCode: req.user.schoolCode }).lean();
    }

    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || '',
        role: req.user.role,
        schoolCode: req.user.schoolCode,
        schoolName: schoolProfile?.schoolName || req.user.schoolName,
        permissions: req.user.permissions || ALL_SUBMODULE_KEYS,
        profilePicture: req.user.profilePicture?.url || null,
      },
      schoolProfile: schoolProfile || {
        schoolCode: req.user.schoolCode,
        schoolName: req.user.schoolName,
        tagline: 'School Management Portal',
        logoUrl: null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. DEVELOPER END: REGISTER / PROVISION NEW SCHOOL
// =========================================================================
export const registerSchool = async (req, res) => {
  try {
    const {
      schoolName,
      schoolCode,
      tagline,
      address,
      phone,
      email,
      affiliation,
      adminName,
      adminEmail,
      adminPassword,
      activeSession = '2025-2026',
      logoUrl,
      principalSignatureUrl,
    } = req.body;

    if (!schoolName || !schoolCode || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: 'School Name, School Code, Principal Name, Admin Email, and Password are required.',
      });
    }

    const cleanCode = schoolCode.trim().toUpperCase();
    const cleanAdminEmail = adminEmail.trim().toLowerCase();

    // Check if School Code already exists
    const existingSchool = await SchoolProfile.findOne({ schoolCode: cleanCode });
    if (existingSchool) {
      return res.status(400).json({
        success: false,
        message: `School Code "${cleanCode}" is already in use by another school. Please choose a unique code.`,
      });
    }

    // 1. Create School Profile
    const newSchool = await SchoolProfile.create({
      schoolCode: cleanCode,
      schoolName: schoolName.trim(),
      tagline: tagline ? tagline.trim() : 'Excellence in Education',
      address: address ? address.trim() : 'City Campus',
      phone: phone ? phone.trim() : '',
      email: email ? email.trim() : cleanAdminEmail,
      affiliation: affiliation ? affiliation.trim() : 'Affiliated with Board of Education',
      activeSession: activeSession.trim(),
      status: 'ACTIVE',
      logoUrl: logoUrl ? logoUrl.trim() : null,
      principalSignatureUrl: principalSignatureUrl ? principalSignatureUrl.trim() : null,
    });

    // 2. Create Primary Admin / Principal User
    const adminUser = new User({
      name: adminName.trim(),
      email: cleanAdminEmail,
      password: adminPassword,
      role: 'ADMIN',
      schoolCode: cleanCode,
      schoolName: schoolName.trim(),
      phone: phone ? phone.trim() : '',
      permissions: ALL_SUBMODULE_KEYS, // Full access to all 33 granular submodules
      isActive: true,
    });
    await adminUser.save();

    // 3. Auto-Seed Initial School Essentials for Immediate Day-1 Operation
    // A. Academic Classes (Nursery to Class 10)
    const defaultClasses = [
      { name: 'Nursery', order: 1 },
      { name: 'Prep', order: 2 },
      { name: 'Class 1', order: 3 },
      { name: 'Class 2', order: 4 },
      { name: 'Class 3', order: 5 },
      { name: 'Class 4', order: 6 },
      { name: 'Class 5', order: 7 },
      { name: 'Class 6', order: 8 },
      { name: 'Class 7', order: 9 },
      { name: 'Class 8', order: 10 },
      { name: 'Class 9', order: 11 },
      { name: 'Class 10', order: 12 },
    ];
    for (const c of defaultClasses) {
      await AcademicClass.create({
        schoolCode: cleanCode,
        name: c.name,
        order: c.order,
        sections: [{ name: 'A', maxCapacity: 40 }],
      }).catch(() => {});
    }

    // B. Academic Session
    await AcademicSession.create({
      schoolCode: cleanCode,
      sessionName: activeSession,
      isCurrent: true,
      startDate: new Date(),
    }).catch(() => {});

    // C. Default 3 Exam Terms
    const defaultTerms = [
      { name: '1st Term', order: 1 },
      { name: 'Mid Term', order: 2 },
      { name: 'Final Term', order: 3 },
    ];
    for (const t of defaultTerms) {
      await ExamTerm.create({
        schoolCode: cleanCode,
        academicSession: activeSession,
        name: t.name,
        order: t.order,
        isPublished: true,
      }).catch(() => {});
    }

    // D. Default Expense Categories
    const defaultExpenseHeads = [
      'Staff Tea & Refreshment',
      'Photostate & Stationery',
      'Electricity & Utilities',
      'Building Maintenance',
      'Campus Rent',
      'Miscellaneous & Petty Cash',
    ];
    for (const h of defaultExpenseHeads) {
      await ExpenseCategory.create({
        schoolCode: cleanCode,
        name: h,
        isActive: true,
      }).catch(() => {});
    }

    // Emit real-time SaaS update to developers
    if (req.io) {
      req.io.to('role:SUPER_ADMIN').emit('all_schools_updated');
    }

    return res.status(201).json({
      success: true,
      message: `School "${schoolName}" [${cleanCode}] successfully registered and provisioned!`,
      data: {
        school: newSchool,
        adminCredentials: {
          name: adminUser.name,
          email: adminUser.email,
          schoolCode: cleanCode,
          role: adminUser.role,
        },
      },
    });
  } catch (error) {
    console.error('Error registering school:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to register school.',
    });
  }
};

// =========================================================================
// 5. DEVELOPER END: GET ALL REGISTERED SCHOOLS WITH METRICS
// =========================================================================
export const getAllSchools = async (req, res) => {
  try {
    const schools = await SchoolProfile.find({}).sort({ createdAt: -1 }).lean();

    const schoolsWithStats = await Promise.all(
      schools.map(async (sch) => {
        const studentCount = await Student.countDocuments({
          schoolCode: sch.schoolCode,
          status: { $ne: 'EXPELLED' },
        });

        const staffCount = await Staff.countDocuments({
          schoolCode: sch.schoolCode,
          status: 'ACTIVE',
        });

        const usersCount = await User.countDocuments({
          schoolCode: sch.schoolCode,
        });

        return {
          ...sch,
          studentCount,
          staffCount,
          usersCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: schoolsWithStats,
    });
  } catch (error) {
    console.error('Error fetching all schools:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. GET ALL USERS FOR A SPECIFIC SCHOOL (With Assigned Modules)
// =========================================================================
export const getSchoolUsers = async (req, res) => {
  try {
    const { schoolCode } = req.params;
    const targetCode = schoolCode.toUpperCase().trim();

    // Security check: non-super admin can only view their own school's users
    if (req.user.role !== 'SUPER_ADMIN' && req.user.schoolCode !== targetCode) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const users = await User.find({ schoolCode: targetCode })
      .select('-password')
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 7. CREATE A NEW USER FOR A SPECIFIC SCHOOL WITH CUSTOM MODULE RIGHTS
// =========================================================================
export const createSchoolUser = async (req, res) => {
  try {
    const { schoolCode } = req.params;
    const { name, email, password, role = 'CUSTOM', permissions = [], phone } = req.body;

    const targetCode = schoolCode.toUpperCase().trim();

    if (req.user.role !== 'SUPER_ADMIN' && req.user.schoolCode !== targetCode) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists for this school
    const existing = await User.findOne({ schoolCode: targetCode, email: cleanEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A user with email "${cleanEmail}" already exists in School [${targetCode}].`,
      });
    }

    // Get school name
    const school = await SchoolProfile.findOne({ schoolCode: targetCode });
    const schoolName = school ? school.schoolName : targetCode;

    // Determine final permissions based on role preset or custom array
    let finalPermissions = Array.isArray(permissions) ? permissions : [];
    if (role === 'ADMIN') {
      finalPermissions = ALL_SUBMODULE_KEYS;
    } else if (ROLE_PRESETS[role] && finalPermissions.length === 0) {
      finalPermissions = ROLE_PRESETS[role];
    }

    const newUser = new User({
      schoolCode: targetCode,
      schoolName,
      name: name.trim(),
      email: cleanEmail,
      password,
      role,
      phone: phone ? phone.trim() : '',
      permissions: finalPermissions,
      isActive: true,
    });

    await newUser.save();

    // Emit real-time update to school room and developer
    if (req.io) {
      req.io.to(`school:${targetCode}`).emit('school_users_updated', {
        schoolCode: targetCode,
        userId: newUser._id,
      });
      req.io.to('role:SUPER_ADMIN').emit('all_schools_updated');
    }

    return res.status(201).json({
      success: true,
      message: `User "${name}" created successfully with ${finalPermissions.length} module permissions.`,
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        permissions: newUser.permissions,
        schoolCode: newUser.schoolCode,
      },
    });
  } catch (error) {
    console.error('Error creating school user:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 8. UPDATE USER PERMISSIONS / DETAILS / PASSWORD
// =========================================================================
export const updateSchoolUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, phone, role, permissions, password, isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && req.user.schoolCode !== user.schoolCode) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (role) user.role = role;
    if (permissions && Array.isArray(permissions)) user.permissions = permissions;
    if (isActive !== undefined) user.isActive = isActive;
    if (password && password.trim().length >= 6) {
      user.password = password.trim(); // Will be hashed by pre-save hook
    }

    await user.save();

    // Emit real-time permission sync directly to this specific user & school
    if (req.io) {
      req.io.to(`user:${user._id}`).emit('user_permissions_updated', {
        userId: user._id,
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive,
      });
      req.io.to(`school:${user.schoolCode}`).emit('school_users_updated', {
        schoolCode: user.schoolCode,
        updatedUserId: user._id,
      });
    }

    return res.status(200).json({
      success: true,
      message: `User "${user.name}" updated successfully.`,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 9. DELETE USER FROM SCHOOL
// =========================================================================
export const deleteSchoolUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && req.user.schoolCode !== user.schoolCode) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (user.role === 'SUPER_ADMIN') {
      return res.status(400).json({ success: false, message: 'Cannot delete Super Admin account.' });
    }

    await User.findByIdAndDelete(userId);

    // Emit real-time notification to user & school
    if (req.io) {
      req.io.to(`user:${userId}`).emit('user_account_deleted', { userId });
      req.io.to(`school:${user.schoolCode}`).emit('school_users_updated', {
        schoolCode: user.schoolCode,
        deletedUserId: userId,
      });
    }

    return res.status(200).json({
      success: true,
      message: `User "${user.name}" deleted successfully.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 10. TOGGLE SCHOOL STATUS (ACTIVE <-> SUSPENDED)
// =========================================================================
export const toggleSchoolStatus = async (req, res) => {
  try {
    const { schoolCode } = req.params;
    const cleanCode = schoolCode.toUpperCase().trim();

    const school = await SchoolProfile.findOne({ schoolCode: cleanCode });
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    school.status = school.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await school.save();

    // Emit real-time school license status change
    if (req.io) {
      req.io.to(`school:${cleanCode}`).emit('school_status_updated', {
        schoolCode: cleanCode,
        status: school.status,
      });
      req.io.to('role:SUPER_ADMIN').emit('all_schools_updated');
    }

    return res.status(200).json({
      success: true,
      message: `School [${cleanCode}] is now ${school.status}.`,
      data: school,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 11. DELETE SCHOOL & CASCADE ALL ASSOCIATED TENANT DATA (Developer Only)
// =========================================================================
export const deleteSchool = async (req, res) => {
  try {
    const { schoolCode } = req.params;
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanCode = schoolCode.toUpperCase().trim();

    if (cleanCode === 'SYSTEM') {
      return res.status(400).json({
        success: false,
        message: 'Master Developer SYSTEM context cannot be deleted.',
      });
    }

    const school = await SchoolProfile.findOne({ schoolCode: cleanCode });
    if (!school) {
      return res.status(404).json({ success: false, message: `School [${cleanCode}] not found.` });
    }

    const schoolName = school.schoolName || cleanCode;

    // Disconnect active WhatsApp socket & clear stored session files
    try {
      await disconnectSession(cleanCode, req.io);
    } catch (e) {
      console.warn(`WhatsApp disconnect warning for [${cleanCode}]:`, e.message);
    }

    // Cascade delete across all school-linked collections
    await Promise.allSettled([
      SchoolProfile.deleteOne({ schoolCode: cleanCode }),
      User.deleteMany({ schoolCode: cleanCode, role: { $ne: 'SUPER_ADMIN' } }),
      Student.deleteMany({ schoolCode: cleanCode }),
      Staff.deleteMany({ schoolCode: cleanCode }),
      StudentAttendance.deleteMany({ schoolCode: cleanCode }),
      StaffAttendance.deleteMany({ schoolCode: cleanCode }),
      FeeVoucher.deleteMany({ schoolCode: cleanCode }),
      StaffSalary.deleteMany({ schoolCode: cleanCode }),
      Expense.deleteMany({ schoolCode: cleanCode }),
      ExpenseCategory.deleteMany({ schoolCode: cleanCode }),
      AcademicClass.deleteMany({ schoolCode: cleanCode }),
      AcademicSession.deleteMany({ schoolCode: cleanCode }),
      ClassSubject.deleteMany({ schoolCode: cleanCode }),
      ExamTerm.deleteMany({ schoolCode: cleanCode }),
      StudentExamMarks.deleteMany({ schoolCode: cleanCode }),
      AdmissionInquiry.deleteMany({ schoolCode: cleanCode }),
      ClassWhatsAppGroup.deleteMany({ schoolCode: cleanCode }),
      SchoolWhatsAppSession.deleteMany({ schoolCode: cleanCode }),
    ]);

    // Emit real-time notification to developer hub & school channel
    if (req.io) {
      req.io.to(`school:${cleanCode}`).emit('school_terminated', {
        schoolCode: cleanCode,
        message: `School [${cleanCode}] has been removed by the system administrator.`,
      });
      req.io.to('role:SUPER_ADMIN').emit('all_schools_updated');
    }

    return res.status(200).json({
      success: true,
      message: `School "${schoolName}" [${cleanCode}] and all its associated data (students, staff, fees, attendance, and users) have been permanently deleted.`,
    });
  } catch (error) {
    console.error('Error deleting school:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete school.',
    });
  }
};
