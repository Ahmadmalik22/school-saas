import { Student } from '../models/Student.js';
import { deleteFromCloudinary, uploadToCloudinary } from '../config/cloudinary.js';

// =========================================================================
// SUB-MODULE 1: STUDENT INFORMATION (Search, Filter, Pagination)
// =========================================================================

// 1. Get Students with Class/Section Filters & Server-Side Pagination
export const getStudents = async (req, res) => {
  try {
    const {
      schoolCode,
      className,
      section,
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

    if (className && className !== 'ALL') {
      query.className = className;
    }

    if (section && section !== 'ALL') {
      query.section = section.toUpperCase();
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { rollNumber: searchRegex },
        { admissionNumber: searchRegex },
        { fatherName: searchRegex },
        { fatherPhone: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    // Execute query and total count in parallel
    const [totalStudents, students] = await Promise.all([
      Student.countDocuments(query),
      Student.find(query)
        .sort({ className: 1, section: 1, rollNumber: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const totalPages = Math.ceil(totalStudents / limitNum);

    return res.status(200).json({
      success: true,
      data: students,
      pagination: {
        totalStudents,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('Error in getStudents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch students.',
      error: error.message,
    });
  }
};

// 2. View Single Student Profile (Full details)
export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error('Error in getStudentById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch student profile.',
      error: error.message,
    });
  }
};

// 3. Edit / Update Student Information
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // If new photo was uploaded, replace on Cloudinary
    if (req.file) {
      // 1. Delete previous photo from Cloudinary if it existed (preserves free tier quota!)
      if (student.photo?.publicId) {
        await deleteFromCloudinary(student.photo.publicId);
      }

      // 2. Upload new photo
      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: `schools/${student.schoolCode}/students`,
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

    // Check duplicate roll number if roll or class/section is changed
    const targetClass = updateData.className || student.className;
    const targetSection = (updateData.section || student.section).toUpperCase();
    const targetRoll = updateData.rollNumber || student.rollNumber;

    if (
      targetClass !== student.className ||
      targetSection !== student.section ||
      targetRoll !== student.rollNumber
    ) {
      const existing = await Student.findOne({
        _id: { $ne: id },
        schoolCode: student.schoolCode,
        className: targetClass,
        section: targetSection,
        rollNumber: targetRoll,
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Roll No "${targetRoll}" is already assigned to another student in ${targetClass} (${targetSection}).`,
        });
      }
    }

    const updatedStudent = await Student.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: `Student "${updatedStudent.fullName}" updated successfully.`,
      data: updatedStudent,
    });
  } catch (error) {
    console.error('Error in updateStudent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update student.',
      error: error.message,
    });
  }
};

// 4. Toggle Status (e.g. ACTIVE <-> INACTIVE <-> STRUCK_OFF)
export const updateStudentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['ACTIVE', 'INACTIVE', 'STRUCK_OFF', 'PASSED_OUT'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid student status.' });
    }

    const updated = await Student.findByIdAndUpdate(id, { status }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Student status changed to ${status}.`,
      data: updated,
    });
  } catch (error) {
    console.error('Error in updateStudentStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update student status.',
      error: error.message,
    });
  }
};

// 5. Delete Student (with Cloudinary photo cleanup)
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Delete photo from Cloudinary so free tier storage is never wasted!
    if (student.photo?.publicId) {
      await deleteFromCloudinary(student.photo.publicId);
    }

    await Student.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Student "${student.fullName}" (Roll: ${student.rollNumber}) deleted successfully.`,
    });
  } catch (error) {
    console.error('Error in deleteStudent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete student.',
      error: error.message,
    });
  }
};

// =========================================================================
// SUB-MODULE 2: STUDENT PROMOTIONS (Bulk Class Promotion after Exams)
// =========================================================================

// Promote an entire batch/class to next class and session in 1 click
export const promoteStudents = async (req, res) => {
  try {
    const {
      schoolCode,
      studentIds,
      targetClass,
      targetSection,
      targetSession,
    } = req.body;

    if (!schoolCode || !targetClass || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one student and provide the target class.',
      });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();
    const finalSection = (targetSection || 'A').toUpperCase();
    const finalSession = targetSession || '2026-2027';

    // Bulk update selected students
    const result = await Student.updateMany(
      {
        _id: { $in: studentIds },
        schoolCode: cleanSchoolCode,
      },
      {
        $set: {
          className: targetClass.trim(),
          currentClass: targetClass.trim(),
          section: finalSection,
          academicSession: finalSession,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: `Successfully promoted ${result.modifiedCount} students to ${targetClass} (${finalSection}) for Session ${finalSession}!`,
      promotedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error in promoteStudents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to promote students.',
      error: error.message,
    });
  }
};
