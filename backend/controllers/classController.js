import { AcademicClass } from '../models/AcademicClass.js';
import { Student } from '../models/Student.js';

// Helper to broadcast real-time updates via Socket.io
const emitClassesUpdated = (req, schoolCode, action = 'UPDATED', details = {}) => {
  if (req?.io && schoolCode) {
    const clean = schoolCode.trim().toUpperCase();
    const eventData = {
      action,
      schoolCode: clean,
      details,
      timestamp: Date.now(),
    };
    req.io.to(`school:${clean}`).emit('classes_updated', eventData);
    req.io.emit('classes_updated', eventData);
  }
};

// =========================================================================
// SUB-MODULE 1: MANAGE CLASSES
// =========================================================================

/**
 * 1. Get All Classes for School (with student enrollment counts)
 */
export const getClasses = async (req, res) => {
  try {
    const { schoolCode } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();

    // 1. Fetch classes sorted by numericOrder (1, 2, 3...)
    const classes = await AcademicClass.find({ schoolCode: cleanSchoolCode })
      .sort({ numericOrder: 1, name: 1 })
      .lean();

    // 2. Count active students per class and section
    const studentCounts = await Student.aggregate([
      {
        $match: {
          schoolCode: cleanSchoolCode,
          status: 'ACTIVE',
        },
      },
      {
        $group: {
          _id: {
            className: '$className',
            section: '$section',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const enrollmentMap = new Map();
    studentCounts.forEach((item) => {
      const key = `${item._id.className}_${item._id.section}`.toUpperCase();
      enrollmentMap.set(key, item.count);
    });

    // 3. Attach student counts
    const enrichedClasses = classes.map((cls) => {
      let classTotalStudents = 0;

      const enrichedSections = (cls.sections || []).map((sec) => {
        const key = `${cls.name}_${sec.name}`.toUpperCase();
        const enrolled = enrollmentMap.get(key) || 0;
        classTotalStudents += enrolled;
        return {
          ...sec,
          enrolledCount: enrolled,
        };
      });

      return {
        ...cls,
        sections: enrichedSections,
        totalEnrolled: classTotalStudents,
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedClasses.length,
      data: enrichedClasses,
    });
  } catch (error) {
    console.error('Error in getClasses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch classes.',
      error: error.message,
    });
  }
};

/**
 * 2. Create New Class (Simple & Fast)
 */
export const createClass = async (req, res) => {
  try {
    const { schoolCode, name, numericOrder } = req.body;

    if (!schoolCode || !name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Class name is required (e.g. Class 1, Nursery).',
      });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();
    const cleanClassName = name.trim();

    // Check duplicate class name
    const existing = await AcademicClass.findOne({
      schoolCode: cleanSchoolCode,
      name: { $regex: new RegExp(`^${cleanClassName}$`, 'i') },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Class "${cleanClassName}" already exists.`,
      });
    }

    // Auto calculate order if not specified
    let finalOrder = Number(numericOrder);
    if (!finalOrder || isNaN(finalOrder)) {
      const count = await AcademicClass.countDocuments({ schoolCode: cleanSchoolCode });
      finalOrder = count + 1;
    }

    // Automatically create default Section A
    const newClass = await AcademicClass.create({
      schoolCode: cleanSchoolCode,
      name: cleanClassName,
      numericOrder: finalOrder,
      sections: [{ name: 'A', capacity: 40 }],
      isActive: true,
    });

    emitClassesUpdated(req, cleanSchoolCode, 'CREATE_CLASS', { classId: newClass._id, name: newClass.name });

    return res.status(201).json({
      success: true,
      message: `Class "${newClass.name}" created successfully!`,
      data: newClass,
    });
  } catch (error) {
    console.error('Error in createClass:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create class.',
      error: error.message,
    });
  }
};

/**
 * 3. Update Class
 */
export const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, numericOrder, isActive } = req.body;

    const academicClass = await AcademicClass.findById(id);
    if (!academicClass) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    const oldName = academicClass.name;
    const newName = name ? name.trim() : oldName;

    // Check duplicate if name is changing
    if (name && newName.toLowerCase() !== oldName.toLowerCase()) {
      const duplicate = await AcademicClass.findOne({
        _id: { $ne: id },
        schoolCode: academicClass.schoolCode,
        name: { $regex: new RegExp(`^${newName}$`, 'i') },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Another class named "${newName}" already exists.`,
        });
      }
    }

    academicClass.name = newName;
    if (numericOrder !== undefined && numericOrder !== '') {
      academicClass.numericOrder = Number(numericOrder);
    }
    if (isActive !== undefined) {
      academicClass.isActive = Boolean(isActive);
    }

    await academicClass.save();

    // If class name changed, update enrolled students
    if (newName !== oldName) {
      await Student.updateMany(
        { schoolCode: academicClass.schoolCode, className: oldName },
        { $set: { className: newName } }
      );
    }

    emitClassesUpdated(req, academicClass.schoolCode, 'UPDATE_CLASS', { classId: academicClass._id, name: academicClass.name });

    return res.status(200).json({
      success: true,
      message: `Class updated successfully.`,
      data: academicClass,
    });
  } catch (error) {
    console.error('Error in updateClass:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update class.',
      error: error.message,
    });
  }
};

/**
 * 4. Delete Class
 */
export const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const academicClass = await AcademicClass.findById(id);

    if (!academicClass) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    // Safety check: Prevent deletion if active students are in this class
    const studentCount = await Student.countDocuments({
      schoolCode: academicClass.schoolCode,
      className: academicClass.name,
      status: 'ACTIVE',
    });

    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete "${academicClass.name}". ${studentCount} active students are currently enrolled in it.`,
      });
    }

    await AcademicClass.findByIdAndDelete(id);

    emitClassesUpdated(req, academicClass.schoolCode, 'DELETE_CLASS', { classId: id, name: academicClass.name });

    return res.status(200).json({
      success: true,
      message: `Class "${academicClass.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error('Error in deleteClass:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete class.',
      error: error.message,
    });
  }
};

// =========================================================================
// SUB-MODULE 2: MANAGE SECTIONS
// =========================================================================

/**
 * 5. Get All Sections (Flattened list for simple table display)
 */
export const getAllSections = async (req, res) => {
  try {
    const { schoolCode, classId } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();
    const query = { schoolCode: cleanSchoolCode };
    if (classId && classId !== 'ALL') query._id = classId;

    const classes = await AcademicClass.find(query).sort({ numericOrder: 1, name: 1 }).lean();

    // Count enrolled students per class + section
    const studentCounts = await Student.aggregate([
      {
        $match: {
          schoolCode: cleanSchoolCode,
          status: 'ACTIVE',
        },
      },
      {
        $group: {
          _id: {
            className: '$className',
            section: '$section',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const enrollmentMap = new Map();
    studentCounts.forEach((item) => {
      const key = `${item._id.className}_${item._id.section}`.toUpperCase();
      enrollmentMap.set(key, item.count);
    });

    const flattenedSections = [];

    classes.forEach((cls) => {
      (cls.sections || []).forEach((sec) => {
        const key = `${cls.name}_${sec.name}`.toUpperCase();
        const enrolled = enrollmentMap.get(key) || 0;

        flattenedSections.push({
          sectionId: sec._id,
          classId: cls._id,
          className: cls.name,
          numericOrder: cls.numericOrder,
          sectionName: sec.name,
          capacity: sec.capacity || 40,
          enrolledCount: enrolled,
        });
      });
    });

    return res.status(200).json({
      success: true,
      count: flattenedSections.length,
      data: flattenedSections,
    });
  } catch (error) {
    console.error('Error in getAllSections:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sections.',
      error: error.message,
    });
  }
};

/**
 * 6. Add Section to Class
 */
export const addSectionToClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { name, capacity = 40 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Section name is required (e.g. A, B, Rose).' });
    }

    const cleanSectionName = name.trim().toUpperCase();

    const academicClass = await AcademicClass.findById(classId);
    if (!academicClass) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    // Check duplicate section name inside this class
    const duplicate = academicClass.sections.some(
      (s) => s.name.toUpperCase() === cleanSectionName
    );

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `Section "${cleanSectionName}" already exists in ${academicClass.name}.`,
      });
    }

    academicClass.sections.push({
      name: cleanSectionName,
      capacity: Number(capacity) || 40,
    });

    await academicClass.save();

    emitClassesUpdated(req, academicClass.schoolCode, 'ADD_SECTION', { classId: academicClass._id, sectionName: cleanSectionName });

    return res.status(201).json({
      success: true,
      message: `Section "${cleanSectionName}" added to ${academicClass.name}!`,
      data: academicClass,
    });
  } catch (error) {
    console.error('Error in addSectionToClass:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add section.',
      error: error.message,
    });
  }
};

/**
 * 7. Update Section in Class
 */
export const updateSection = async (req, res) => {
  try {
    const { classId, sectionId } = req.params;
    const { name, capacity } = req.body;

    const academicClass = await AcademicClass.findById(classId);
    if (!academicClass) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    const section = academicClass.sections.id(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    const oldSectionName = section.name;
    const newSectionName = name ? name.trim().toUpperCase() : oldSectionName;

    if (newSectionName !== oldSectionName) {
      const duplicate = academicClass.sections.some(
        (s) => s._id.toString() !== sectionId && s.name.toUpperCase() === newSectionName
      );

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Section "${newSectionName}" already exists in ${academicClass.name}.`,
        });
      }
    }

    section.name = newSectionName;
    if (capacity !== undefined && capacity !== '') {
      section.capacity = Number(capacity) || 40;
    }

    await academicClass.save();

    // If section name changed, update enrolled students
    if (newSectionName !== oldSectionName) {
      await Student.updateMany(
        {
          schoolCode: academicClass.schoolCode,
          className: academicClass.name,
          section: oldSectionName,
        },
        { $set: { section: newSectionName } }
      );
    }

    emitClassesUpdated(req, academicClass.schoolCode, 'UPDATE_SECTION', { classId: academicClass._id, sectionId, sectionName: newSectionName });

    return res.status(200).json({
      success: true,
      message: `Section updated successfully.`,
      data: academicClass,
    });
  } catch (error) {
    console.error('Error in updateSection:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update section.',
      error: error.message,
    });
  }
};

/**
 * 8. Delete Section from Class
 */
export const deleteSection = async (req, res) => {
  try {
    const { classId, sectionId } = req.params;

    const academicClass = await AcademicClass.findById(classId);
    if (!academicClass) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    const section = academicClass.sections.id(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    // Safety: Class must have at least one section
    if (academicClass.sections.length <= 1) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete section "${section.name}". Each class must have at least one section.`,
      });
    }

    // Check if students are enrolled
    const studentCount = await Student.countDocuments({
      schoolCode: academicClass.schoolCode,
      className: academicClass.name,
      section: section.name,
      status: 'ACTIVE',
    });

    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete Section "${section.name}"! There are ${studentCount} active students in this section.`,
      });
    }

    academicClass.sections.pull(sectionId);
    await academicClass.save();

    emitClassesUpdated(req, academicClass.schoolCode, 'DELETE_SECTION', { classId: academicClass._id, sectionId, sectionName: section.name });

    return res.status(200).json({
      success: true,
      message: `Section "${section.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error('Error in deleteSection:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete section.',
      error: error.message,
    });
  }
};

/**
 * 9. Quick Seed Standard Default Classes (Nursery to Class 10)
 */
export const seedDefaultClasses = async (req, res) => {
  try {
    const { schoolCode } = req.body;
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();
    const defaults = [
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

    const existing = await AcademicClass.find({ schoolCode: cleanSchoolCode }).lean();
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

    const toInsert = [];
    defaults.forEach((item) => {
      if (!existingNames.has(item.name.toLowerCase())) {
        toInsert.push({
          schoolCode: cleanSchoolCode,
          name: item.name,
          numericOrder: item.order,
          sections: [{ name: 'A', capacity: 40 }],
          isActive: true,
        });
      }
    });

    if (toInsert.length > 0) {
      await AcademicClass.insertMany(toInsert);
    }

    emitClassesUpdated(req, cleanSchoolCode, 'SEED_CLASSES');

    return res.status(200).json({
      success: true,
      message: `Initialized ${toInsert.length} standard classes successfully!`,
    });
  } catch (error) {
    console.error('Error in seedDefaultClasses:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
