import { Staff } from '../models/Staff.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

// =========================================================================
// SUB-MODULE 1: ADD STAFF MEMBER (Registration with Photo)
// =========================================================================
export const addStaff = async (req, res) => {
  try {
    const {
      schoolCode,
      employeeId,
      joiningDate,
      role,
      department,
      fullName,
      gender,
      dob,
      cnic,
      phone,
      email,
      emergencyContact,
      address,
      city,
      qualification,
      experienceYears,
      basicSalary,
      bankAccountNumber,
      hasPortalAccess,
    } = req.body;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    if (!employeeId || !fullName || !role || !cnic || !phone || !qualification) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, Name, Role, CNIC, Phone, and Qualification are required.',
      });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();

    // Check duplicate Employee ID in this school
    const existingEmp = await Staff.findOne({
      schoolCode: cleanSchoolCode,
      employeeId: employeeId.trim(),
    });

    if (existingEmp) {
      return res.status(400).json({
        success: false,
        message: `Employee ID "${employeeId}" already exists in this school.`,
      });
    }

    // Check duplicate CNIC in this school
    const existingCnic = await Staff.findOne({
      schoolCode: cleanSchoolCode,
      cnic: cnic.trim(),
    });

    if (existingCnic) {
      return res.status(400).json({
        success: false,
        message: `Staff member with CNIC "${cnic}" already registered.`,
      });
    }

    // Photo Upload to Cloudinary (WebP 300x300 passport crop)
    let photoData = { url: null, publicId: null };
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: `schools/${cleanSchoolCode}/staff`,
        width: 300,
        height: 300,
        crop: 'fill',
        gravity: 'face',
      });
      photoData = {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
      };
    }

    const newStaff = await Staff.create({
      schoolCode: cleanSchoolCode,
      employeeId: employeeId.trim(),
      joiningDate: joiningDate || Date.now(),
      role: role || 'Teacher',
      department: department || 'Science',
      fullName: fullName.trim(),
      gender: gender || 'MALE',
      dob,
      cnic: cnic.trim(),
      phone: phone.trim(),
      email: email?.trim().toLowerCase(),
      emergencyContact: emergencyContact?.trim(),
      address: address?.trim() || 'Address not specified',
      city: city?.trim() || 'Lahore',
      qualification: qualification.trim(),
      experienceYears: Number(experienceYears) || 0,
      basicSalary: Number(basicSalary) || 25000,
      bankAccountNumber: bankAccountNumber?.trim(),
      photo: photoData,
      status: 'ACTIVE',
      hasPortalAccess: Boolean(hasPortalAccess),
    });

    return res.status(201).json({
      success: true,
      message: `${role} "${newStaff.fullName}" registered successfully with ID ${newStaff.employeeId}!`,
      data: newStaff,
    });
  } catch (error) {
    console.error('Error in addStaff:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add staff member.',
      error: error.message,
    });
  }
};

// =========================================================================
// SUB-MODULE 2: STAFF DIRECTORY (Search, Filter & Pagination)
// =========================================================================
export const getStaffList = async (req, res) => {
  try {
    const {
      schoolCode,
      role,
      department,
      status,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();
    const query = { schoolCode: cleanSchoolCode };

    if (role && role !== 'ALL') {
      query.role = role;
    }

    if (department && department !== 'ALL') {
      query.department = department;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { employeeId: searchRegex },
        { cnic: searchRegex },
        { phone: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const [totalStaff, staffMembers] = await Promise.all([
      Staff.countDocuments(query),
      Staff.find(query)
        .sort({ role: 1, fullName: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const totalPages = Math.ceil(totalStaff / limitNum);

    return res.status(200).json({
      success: true,
      data: staffMembers,
      pagination: {
        totalStaff,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('Error in getStaffList:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch staff members.',
      error: error.message,
    });
  }
};

// View Single Staff Profile
export const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findById(id);

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    return res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error('Error in getStaffById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch staff details.',
      error: error.message,
    });
  }
};

// Edit / Update Staff Info
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    // If new photo was uploaded, replace and delete old from Cloudinary
    if (req.file) {
      if (staff.photo?.publicId) {
        await deleteFromCloudinary(staff.photo.publicId);
      }

      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: `schools/${staff.schoolCode}/staff`,
        width: 300,
        height: 300,
        crop: 'fill',
        gravity: 'face',
      });

      updateData.photo = {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
      };
    }

    const updated = await Staff.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: `${updated.fullName}'s profile updated successfully.`,
      data: updated,
    });
  } catch (error) {
    console.error('Error in updateStaff:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update staff member.',
      error: error.message,
    });
  }
};

// Toggle Staff Status (ACTIVE <-> ON_LEAVE <-> RESIGNED)
export const updateStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const updated = await Staff.findByIdAndUpdate(id, { status }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Staff status changed to ${status}.`,
      data: updated,
    });
  } catch (error) {
    console.error('Error in updateStaffStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update staff status.',
      error: error.message,
    });
  }
};

// Delete Staff Member (with Cloudinary cleanup)
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findById(id);

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    // Clean up photo on Cloudinary to protect free storage quota
    if (staff.photo?.publicId) {
      await deleteFromCloudinary(staff.photo.publicId);
    }

    await Staff.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Staff member "${staff.fullName}" (ID: ${staff.employeeId}) deleted successfully.`,
    });
  } catch (error) {
    console.error('Error in deleteStaff:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete staff member.',
      error: error.message,
    });
  }
};
