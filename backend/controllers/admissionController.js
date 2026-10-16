import { Student } from '../models/Student.js';
import { AdmissionInquiry } from '../models/AdmissionInquiry.js';
import { AcademicClass } from '../models/AcademicClass.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import * as xlsx from 'xlsx';

// =========================================================================
// SUB-MODULE 1: ADMIT STUDENT (Single Full Admission Form with Photo)
// =========================================================================
export const admitStudent = async (req, res) => {
  try {
    const {
      schoolCode,
      admissionNumber,
      admissionDate,
      academicSession,
      className,
      section,
      rollNumber,
      fullName,
      gender,
      dob,
      bFormOrCnic,
      bloodGroup,
      religion,
      address,
      city,
      fatherName,
      fatherCnic,
      fatherPhone,
      fatherOccupation,
      motherName,
      guardianEmail,
      emergencyContact,
      previousSchool,
      previousClass,
      leavingCertificateNumber,
      monthlyFee,
      admissionFee,
      annualCharges,
      monthlyDiscount,
      discountReason,
    } = req.body;

    // 1. Mandatory Validations
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }
    if (!admissionNumber || !fullName || !className || !section || !rollNumber) {
      return res.status(400).json({
        success: false,
        message: 'Admission number, full name, class, section, and roll number are required.',
      });
    }
    if (!fatherName || !fatherPhone || !address || !dob || !gender) {
      return res.status(400).json({
        success: false,
        message: 'Father name, phone, address, date of birth, and gender are required.',
      });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();

    // 2. Check for Duplicate Admission Number in this school
    const existingAdmission = await Student.findOne({
      schoolCode: cleanSchoolCode,
      admissionNumber: admissionNumber.trim(),
    });

    if (existingAdmission) {
      return res.status(400).json({
        success: false,
        message: `Student with Admission No. "${admissionNumber}" already exists in this school.`,
      });
    }

    // 3. Check for Duplicate Roll Number in the same Class & Section
    const existingRoll = await Student.findOne({
      schoolCode: cleanSchoolCode,
      className: className.trim(),
      section: section.trim().toUpperCase(),
      rollNumber: rollNumber.trim(),
    });

    if (existingRoll) {
      return res.status(400).json({
        success: false,
        message: `Roll No. "${rollNumber}" is already assigned to another student in ${className} (${section.toUpperCase()}).`,
      });
    }

    // 4. Handle Student Photo Upload to Cloudinary (Auto-WebP 300x300 passport crop)
    let photoData = { url: null, publicId: null };
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: `schools/${cleanSchoolCode}/students`,
        width: 300,
        height: 300,
        crop: 'fill',
        gravity: 'face', // Auto focus on student face
      });
      photoData = {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
      };
    }

    // 5. Create New Student Record
    const newStudent = await Student.create({
      schoolCode: cleanSchoolCode,
      admissionNumber: admissionNumber.trim(),
      admissionDate: admissionDate || Date.now(),
      academicSession: academicSession || '2025-2026',
      className: className.trim(),
      section: section.trim().toUpperCase(),
      rollNumber: rollNumber.trim(),
      fullName: fullName.trim(),
      gender: gender.toUpperCase(),
      dob,
      bFormOrCnic: bFormOrCnic?.trim(),
      bloodGroup: bloodGroup || 'Unknown',
      religion: religion?.trim() || 'Islam',
      address: address.trim(),
      city: city?.trim() || 'Lahore',
      fatherName: fatherName.trim(),
      fatherCnic: fatherCnic?.trim(),
      fatherPhone: fatherPhone.trim(),
      fatherOccupation: fatherOccupation?.trim(),
      motherName: motherName?.trim(),
      guardianEmail: guardianEmail?.trim().toLowerCase(),
      emergencyContact: emergencyContact?.trim(),
      photo: photoData,
      previousSchool: previousSchool?.trim(),
      previousClass: previousClass?.trim(),
      leavingCertificateNumber: leavingCertificateNumber?.trim(),
      monthlyFee: Number(monthlyFee) >= 0 ? Number(monthlyFee) : 2500,
      admissionFee: Number(admissionFee) >= 0 ? Number(admissionFee) : 0,
      annualCharges: Number(annualCharges) >= 0 ? Number(annualCharges) : 0,
      monthlyDiscount: Number(monthlyDiscount) >= 0 ? Number(monthlyDiscount) : 0,
      discountReason: discountReason?.trim(),
      netMonthlyFee: Math.max(
        0,
        (Number(monthlyFee) >= 0 ? Number(monthlyFee) : 2500) -
          (Number(monthlyDiscount) >= 0 ? Number(monthlyDiscount) : 0)
      ),
      status: 'ACTIVE',
    });

    return res.status(201).json({
      success: true,
      message: `Student "${newStudent.fullName}" successfully admitted with Roll No. ${newStudent.rollNumber}!`,
      data: newStudent,
    });
  } catch (error) {
    console.error('Error in admitStudent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to admit student.',
      error: error.message,
    });
  }
};

// =========================================================================
// SUB-MODULE 2: ADMIT BULK (Excel / CSV File Upload)
// =========================================================================
export const admitBulkExcel = async (req, res) => {
  try {
    const { schoolCode, academicSession } = req.body;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel file (.xlsx or .csv).' });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();

    // 1. Parse Excel buffer from memory (zero temporary files)
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

    if (!sheetData || sheetData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded Excel sheet is empty. Please add student rows.',
      });
    }

    const validStudents = [];
    const skippedRows = [];

    // 2. Fetch existing admission numbers and rolls to detect duplicates rapidly
    const existingStudents = await Student.find(
      { schoolCode: cleanSchoolCode },
      { admissionNumber: 1, className: 1, section: 1, rollNumber: 1 }
    ).lean();

    const existingAdmissionSet = new Set(existingStudents.map((s) => s.admissionNumber));
    const existingRollKeySet = new Set(
      existingStudents.map((s) => `${s.className?.toLowerCase()}_${s.section?.toLowerCase()}_${s.rollNumber}`)
    );

    // Auto-generate admission number counter
    const currentYear = new Date().getFullYear();
    let maxSeq = 1000;
    existingStudents.forEach((s) => {
      const match = s.admissionNumber?.match(new RegExp(`^ADM-${currentYear}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    });

    // 3. Process each row
    for (let index = 0; index < sheetData.length; index++) {
      const row = sheetData[index];
      const rowNumber = index + 2; // Row 1 is header in Excel

      // Support common column variations
      let admNo = String(row['Admission No'] || row['Admission No (Optional)'] || row['AdmissionNo'] || row['AdmissionNumber'] || row['admissionNumber'] || '').trim();
      const name = String(row['Full Name'] || row['Student Name'] || row['Name'] || '').trim();
      const cls = String(row['Class'] || row['className'] || '').trim();
      const sec = String(row['Section'] || row['section'] || 'A').trim().toUpperCase();
      const roll = String(row['Roll No'] || row['RollNumber'] || row['rollNumber'] || '').trim();
      const gender = String(row['Gender'] || 'MALE').trim().toUpperCase();
      const fName = String(row['Father Name'] || row['FatherName'] || '').trim();
      const fPhone = String(row['Father Phone'] || row['Phone'] || row['Contact'] || '').trim();
      const fCnic = String(row['Father CNIC'] || row['FatherCNIC'] || row['fatherCnic'] || row['Father National ID'] || '').trim();
      const bForm = String(row['B-Form'] || row['BForm'] || row['bFormOrCnic'] || row['Student CNIC'] || row['B-Form / CNIC'] || '').trim();
      const addr = String(row['Address'] || 'City Area').trim();
      const city = String(row['City'] || 'Lahore').trim();
      const blood = String(row['Blood Group'] || row['bloodGroup'] || 'Unknown').trim();
      const religion = String(row['Religion'] || row['religion'] || 'Islam').trim();
      const emergency = String(row['Emergency Contact'] || row['Emergency Phone'] || fPhone).trim();
      const rawDob = row['DOB'] || row['DOB (YYYY-MM-DD)'] || row['Date of Birth'];
      const rawAdmDate = row['Admission Date'] || row['Admission Date (YYYY-MM-DD)'] || row['admissionDate'];

      // Specific field validation (Admission No is OPTIONAL: auto-generated if left blank)
      const missingFields = [];
      if (!name) missingFields.push('Student Name');
      if (!cls) missingFields.push('Class');
      if (!roll) missingFields.push('Roll No');
      if (!fName) missingFields.push('Father Name');
      if (!fPhone) missingFields.push('Father Phone');

      if (missingFields.length > 0) {
        skippedRows.push({
          row: rowNumber,
          name: name || 'Empty Name',
          roll: roll || '—',
          className: cls || '—',
          section: sec || '—',
          reason: `Missing required field(s): ${missingFields.join(', ')}`,
        });
        continue;
      }

      // If admission number is blank, auto-assign sequential number
      if (!admNo) {
        maxSeq++;
        admNo = `ADM-${currentYear}-${String(maxSeq).padStart(4, '0')}`;
      } else if (existingAdmissionSet.has(admNo)) {
        // If provided manually, check for duplicate
        skippedRows.push({
          row: rowNumber,
          name,
          roll: roll || '—',
          className: cls || '—',
          section: sec || '—',
          reason: `Admission No. "${admNo}" pehle se mojood hai (Duplicate Admission No).`,
        });
        continue;
      }

      const rollKey = `${cls.toLowerCase()}_${sec.toLowerCase()}_${roll}`;
      if (existingRollKeySet.has(rollKey)) {
        skippedRows.push({
          row: rowNumber,
          name,
          roll,
          className: cls,
          section: sec,
          reason: `Roll No. "${roll}" is class (${cls} - Sec ${sec}) mein pehle se mojood hai (Duplicate Roll No).`,
        });
        continue;
      }

      // Format Date of Birth safely
      let parsedDob = new Date('2016-01-01');
      if (rawDob) {
        const d = new Date(rawDob);
        if (!isNaN(d.getTime())) parsedDob = d;
      }

      // Format Admission Date safely
      let parsedAdmDate = new Date();
      if (rawAdmDate) {
        const ad = new Date(rawAdmDate);
        if (!isNaN(ad.getTime())) parsedAdmDate = ad;
      }

      const mFee = Number(row['Monthly Fee'] || row['Tuition Fee'] || row['monthlyFee']) >= 0 ? Number(row['Monthly Fee'] || row['Tuition Fee'] || row['monthlyFee']) : 2500;
      const aFee = Number(row['Admission Fee'] || row['admissionFee']) >= 0 ? Number(row['Admission Fee'] || row['admissionFee']) : 0;
      const mDisc = Number(row['Discount'] || row['monthlyDiscount']) >= 0 ? Number(row['Discount'] || row['monthlyDiscount']) : 0;
      const discReason = String(row['Discount Reason'] || row['discountReason'] || '').trim();
      const annualCharges = Number(row['Annual Charges'] || row['annualCharges']) >= 0 ? Number(row['Annual Charges'] || row['annualCharges']) : 0;

      validStudents.push({
        _excelRow: rowNumber,
        schoolCode: cleanSchoolCode,
        admissionNumber: admNo,
        admissionDate: parsedAdmDate,
        academicSession: academicSession || '2025-2026',
        fullName: name,
        className: cls,
        section: sec,
        rollNumber: roll,
        gender: ['MALE', 'FEMALE', 'OTHER'].includes(gender) ? gender : 'MALE',
        dob: parsedDob,
        bFormOrCnic: bForm,
        bloodGroup: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].includes(blood) ? blood : 'Unknown',
        religion,
        address: addr,
        city,
        fatherName: fName,
        fatherCnic: fCnic,
        fatherPhone: fPhone,
        emergencyContact: emergency,
        monthlyFee: mFee,
        admissionFee: aFee,
        annualCharges,
        monthlyDiscount: mDisc,
        discountReason: discReason,
        netMonthlyFee: Math.max(0, mFee - mDisc),
        photo: { url: null, publicId: null },
        status: 'ACTIVE',
      });

      // Add to set to prevent intra-sheet duplicates
      existingAdmissionSet.add(admNo);
      existingRollKeySet.add(rollKey);
    }

    // 4. Batch Insert Valid Rows with resilient error handling
    let insertedCount = 0;
    if (validStudents.length > 0) {
      try {
        const inserted = await Student.insertMany(validStudents, { ordered: false });
        insertedCount = inserted.length;
      } catch (insertError) {
        // If ordered: false fails on duplicates, MongoDB still inserts non-conflicting docs
        if (insertError.writeErrors && Array.isArray(insertError.writeErrors)) {
          insertedCount = insertError.result?.nInserted ?? (validStudents.length - insertError.writeErrors.length);
          insertError.writeErrors.forEach((we) => {
            const failedDoc = validStudents[we.index];
            let reasonMsg = we.errmsg || 'Duplicate key or validation error.';
            if (we.code === 11000) {
              reasonMsg = 'Duplicate Roll Number or Admission Number already registered in database.';
            }
            skippedRows.push({
              row: failedDoc ? (failedDoc._excelRow || 'N/A') : 'N/A',
              name: failedDoc?.fullName || 'Unknown',
              roll: failedDoc?.rollNumber || '—',
              className: failedDoc?.className || '—',
              section: failedDoc?.section || '—',
              reason: reasonMsg,
            });
          });
        } else {
          throw insertError;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk Import Completed: ${insertedCount} students admitted successfully.${skippedRows.length > 0 ? ` (${skippedRows.length} rows skipped)` : ''}`,
      stats: {
        totalRows: sheetData.length,
        admittedCount: insertedCount,
        skippedCount: skippedRows.length,
      },
      skippedRows,
    });
  } catch (error) {
    console.error('Error in admitBulkExcel:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process bulk Excel admission.',
      error: error.message,
    });
  }
};

// =========================================================================
// SUB-MODULE 3: ADMISSION INQUIRIES (Save, List & 1-Click Convert to Admit)
// =========================================================================

// Create new visitor/parent inquiry
export const createInquiry = async (req, res) => {
  try {
    const {
      schoolCode,
      studentName,
      gender,
      dob,
      targetClass,
      targetSection,
      previousSchool,
      parentName,
      parentPhone,
      parentEmail,
      address,
      inquirySource,
      followUpDate,
      remarks,
    } = req.body;

    if (!schoolCode || !studentName || !targetClass || !parentName || !parentPhone) {
      return res.status(400).json({
        success: false,
        message: 'School code, student name, class, parent name, and phone are required.',
      });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();

    // Auto-generate inquiry number (e.g., INQ-2026-0001)
    const count = await AdmissionInquiry.countDocuments({ schoolCode: cleanSchoolCode });
    const currentYear = new Date().getFullYear();
    const inquiryNumber = `INQ-${currentYear}-${String(count + 1).padStart(4, '0')}`;

    const newInquiry = await AdmissionInquiry.create({
      schoolCode: cleanSchoolCode,
      inquiryNumber,
      studentName: studentName.trim(),
      gender: gender || 'MALE',
      dob,
      targetClass: targetClass.trim(),
      targetSection: targetSection?.trim() || 'A',
      previousSchool: previousSchool?.trim(),
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
      parentEmail: parentEmail?.trim(),
      address: address?.trim(),
      inquirySource: inquirySource || 'Walk-in',
      followUpDate,
      remarks: remarks?.trim(),
      status: 'OPEN',
    });

    return res.status(201).json({
      success: true,
      message: `Inquiry #${inquiryNumber} recorded successfully!`,
      data: newInquiry,
    });
  } catch (error) {
    console.error('Error in createInquiry:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record inquiry.',
      error: error.message,
    });
  }
};

// List inquiries with search & filter
export const getInquiries = async (req, res) => {
  try {
    const { schoolCode, status, search } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();
    const query = { schoolCode: cleanSchoolCode };

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { studentName: searchRegex },
        { parentName: searchRegex },
        { parentPhone: searchRegex },
        { inquiryNumber: searchRegex },
      ];
    }

    const inquiries = await AdmissionInquiry.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: inquiries.length,
      data: inquiries,
    });
  } catch (error) {
    console.error('Error in getInquiries:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inquiries.',
      error: error.message,
    });
  }
};

// 1-Click "Admit" Button: Converts an inquiry into an officially admitted student
export const convertInquiryToAdmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { admissionNumber, rollNumber, className, section, academicSession } = req.body;

    const inquiry = await AdmissionInquiry.findById(id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    }

    if (inquiry.status === 'ADMITTED') {
      return res.status(400).json({
        success: false,
        message: 'This inquiry has already been converted to an admission.',
      });
    }

    if (!admissionNumber || !rollNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide admission number and roll number to finalize admission.',
      });
    }

    const finalClass = className || inquiry.targetClass;
    const finalSection = (section || inquiry.targetSection || 'A').toUpperCase();

    // Check duplicate admission or roll
    const existingAdmission = await Student.findOne({
      schoolCode: inquiry.schoolCode,
      admissionNumber: admissionNumber.trim(),
    });
    if (existingAdmission) {
      return res.status(400).json({
        success: false,
        message: `Admission No. "${admissionNumber}" already exists in this school.`,
      });
    }

    const existingRoll = await Student.findOne({
      schoolCode: inquiry.schoolCode,
      className: finalClass,
      section: finalSection,
      rollNumber: rollNumber.trim(),
    });
    if (existingRoll) {
      return res.status(400).json({
        success: false,
        message: `Roll No. "${rollNumber}" already assigned in ${finalClass} (${finalSection}).`,
      });
    }

    // Create the Student
    const newStudent = await Student.create({
      schoolCode: inquiry.schoolCode,
      admissionNumber: admissionNumber.trim(),
      admissionDate: Date.now(),
      academicSession: academicSession || '2025-2026',
      className: finalClass,
      section: finalSection,
      rollNumber: rollNumber.trim(),
      fullName: inquiry.studentName,
      gender: inquiry.gender || 'MALE',
      dob: inquiry.dob || new Date('2015-01-01'),
      address: inquiry.address || 'Address provided at admission',
      fatherName: inquiry.parentName,
      fatherPhone: inquiry.parentPhone,
      guardianEmail: inquiry.parentEmail,
      previousSchool: inquiry.previousSchool,
      status: 'ACTIVE',
    });

    // Mark Inquiry as ADMITTED and link student
    inquiry.status = 'ADMITTED';
    inquiry.convertedStudentId = newStudent._id;
    inquiry.convertedAt = new Date();
    await inquiry.save();

    return res.status(200).json({
      success: true,
      message: `Inquiry successfully converted! Student "${newStudent.fullName}" is now admitted.`,
      student: newStudent,
      inquiry,
    });
  } catch (error) {
    console.error('Error in convertInquiryToAdmission:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to convert inquiry to admission.',
      error: error.message,
    });
  }
};

// Delete an unwanted or old inquiry to save database space
export const deleteInquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await AdmissionInquiry.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Inquiry record not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Inquiry #${deleted.inquiryNumber} successfully deleted.`,
    });
  } catch (error) {
    console.error('Error in deleteInquiry:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete inquiry.',
      error: error.message,
    });
  }
};

// =========================================================================
// SUB-MODULE 4: PRINT ADMISSION FORM (Filter & Printable Form Data)
// =========================================================================

// Search and filter students for the Print Admission Form sub-module
export const getStudentsForPrint = async (req, res) => {
  try {
    const { schoolCode, className, section, search } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanSchoolCode = schoolCode.trim().toUpperCase();
    const query = { schoolCode: cleanSchoolCode, status: 'ACTIVE' };

    if (className && className !== 'ALL') {
      query.className = className;
    }

    if (section && section !== 'ALL') {
      query.section = section.toUpperCase();
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { admissionNumber: searchRegex },
        { rollNumber: searchRegex },
        { fatherName: searchRegex },
        { fatherPhone: searchRegex },
      ];
    }

    const students = await Student.find(query).sort({ className: 1, section: 1, rollNumber: 1 });

    return res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    console.error('Error in getStudentsForPrint:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch students for print.',
      error: error.message,
    });
  }
};

// Get single student formatted for Print Slip / Official Admission Form
export const getStudentPrintFormById = async (req, res) => {
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
    console.error('Error in getStudentPrintFormById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch student print form.',
      error: error.message,
    });
  }
};
