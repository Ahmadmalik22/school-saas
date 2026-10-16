import ExamTerm from '../models/ExamTerm.js';
import ClassSubject from '../models/ClassSubject.js';
import StudentExamMarks from '../models/StudentExamMarks.js';
import Student from '../models/Student.js';
import SchoolProfile from '../models/SchoolProfile.js';

// Default 3 standard Exam Terms (1st Term, Mid Term, Final Term)
const DEFAULT_TERMS = [
  { name: '1st Term', order: 1 },
  { name: 'Mid Term', order: 2 },
  { name: 'Final Term', order: 3 },
];

// Default Curriculum Presets for Pakistani Schools
const DEFAULT_PRIMARY_SUBJECTS = [
  { subjectName: 'English', totalMarks: 100, passingMarks: 40, order: 1 },
  { subjectName: 'Urdu', totalMarks: 100, passingMarks: 40, order: 2 },
  { subjectName: 'Mathematics', totalMarks: 100, passingMarks: 40, order: 3 },
  { subjectName: 'General Science', totalMarks: 100, passingMarks: 40, order: 4 },
  { subjectName: 'Islamiat', totalMarks: 50, passingMarks: 20, order: 5 },
  { subjectName: 'Computer', totalMarks: 50, passingMarks: 20, order: 6 },
];

const DEFAULT_MIDDLE_HIGH_SUBJECTS = [
  { subjectName: 'English', totalMarks: 100, passingMarks: 40, order: 1 },
  { subjectName: 'Urdu', totalMarks: 100, passingMarks: 40, order: 2 },
  { subjectName: 'Mathematics', totalMarks: 100, passingMarks: 40, order: 3 },
  { subjectName: 'General Science', totalMarks: 100, passingMarks: 40, order: 4 },
  { subjectName: 'History & Geography', totalMarks: 100, passingMarks: 40, order: 5 },
  { subjectName: 'Computer', totalMarks: 100, passingMarks: 40, order: 6 },
  { subjectName: 'Islamiat/M.E', totalMarks: 100, passingMarks: 40, order: 7 },
];

/**
 * 1. Get Exam Terms (Auto-seeds if none exist)
 */
export const getExamTerms = async (req, res) => {
  try {
    const { schoolCode, academicSession = '2025-2026' } = req.query;
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    let terms = await ExamTerm.find({ schoolCode, academicSession }).sort({ order: 1 }).lean();

    if (!terms || terms.length === 0) {
      const schoolExists = await SchoolProfile.exists({ schoolCode });
      if (!schoolExists) {
        return res.status(200).json({ success: true, data: [] });
      }

      const seed = DEFAULT_TERMS.map((t) => ({
        schoolCode,
        academicSession,
        name: t.name,
        order: t.order,
        isPublished: true,
      }));

      try {
        terms = await ExamTerm.insertMany(seed, { ordered: false });
      } catch (e) {
        terms = await ExamTerm.find({ schoolCode, academicSession }).sort({ order: 1 }).lean();
      }
    }

    return res.status(200).json({ success: true, data: terms });
  } catch (error) {
    console.error('Error in getExamTerms:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Save / Update Exam Term
 */
export const saveExamTerm = async (req, res) => {
  try {
    const { schoolCode, academicSession = '2025-2026', name, order } = req.body;
    if (!schoolCode || !name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'School code and term name are required.' });
    }

    const term = await ExamTerm.findOneAndUpdate(
      { schoolCode, academicSession, name: name.trim() },
      {
        order: Number(order) || 1,
        isPublished: true,
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, message: `Exam term "${name}" saved.`, data: term });
  } catch (error) {
    console.error('Error in saveExamTerm:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2b. Delete Exam Term
 */
export const deleteExamTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolCode } = req.query;

    const term = await ExamTerm.findOneAndDelete({ _id: id, schoolCode });
    if (!term) {
      return res.status(404).json({ success: false, message: 'Exam term not found.' });
    }

    return res.status(200).json({ success: true, message: `Exam term "${term.name}" deleted successfully.` });
  } catch (error) {
    console.error('Error in deleteExamTerm:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Helper: Fetch subjects or auto-seed defaults if not configured yet
const findOrSeedClassSubjects = async (schoolCode, className) => {
  let subjects = await ClassSubject.find({ schoolCode, className }).sort({ order: 1 }).lean();

  if (!subjects || subjects.length === 0) {
    const isMiddleOrHigh = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'VII', 'VIII', 'IX', 'X'].some(
      (c) => className.includes(c)
    );

    const template = isMiddleOrHigh ? DEFAULT_MIDDLE_HIGH_SUBJECTS : DEFAULT_PRIMARY_SUBJECTS;
    const seed = template.map((s) => ({
      schoolCode,
      className,
      subjectName: s.subjectName,
      totalMarks: s.totalMarks,
      passingMarks: s.passingMarks,
      order: s.order,
    }));

    try {
      await ClassSubject.insertMany(seed, { ordered: false });
      subjects = await ClassSubject.find({ schoolCode, className }).sort({ order: 1 }).lean();
    } catch (e) {
      subjects = await ClassSubject.find({ schoolCode, className }).sort({ order: 1 }).lean();
    }
  }

  return subjects;
};

/**
 * 3. Get Class Subjects (Auto-seeds standard subjects if none exist)
 */
export const getClassSubjects = async (req, res) => {
  try {
    const { schoolCode, className } = req.query;
    if (!schoolCode || !className) {
      return res.status(400).json({ success: false, message: 'School code and class name are required.' });
    }

    const subjects = await findOrSeedClassSubjects(schoolCode, className);
    return res.status(200).json({ success: true, data: subjects });
  } catch (error) {
    console.error('Error in getClassSubjects:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Save / Update Class Subjects
 */
export const saveClassSubjects = async (req, res) => {
  try {
    const { schoolCode, className, subjects } = req.body;
    if (!schoolCode || !className || !Array.isArray(subjects)) {
      return res.status(400).json({ success: false, message: 'School code, class name, and subjects list are required.' });
    }

    // Delete existing subjects and re-insert updated list
    await ClassSubject.deleteMany({ schoolCode, className });

    const docs = subjects.map((s, idx) => ({
      schoolCode,
      className,
      subjectName: s.subjectName.trim(),
      subjectCode: s.subjectCode ? s.subjectCode.trim() : '',
      totalMarks: Number(s.totalMarks) || 100,
      passingMarks: Number(s.passingMarks) || 40,
      order: idx + 1,
    }));

    const saved = await ClassSubject.insertMany(docs);

    return res.status(200).json({
      success: true,
      message: `Subjects for ${className} saved successfully (${saved.length} subjects).`,
      data: saved,
    });
  } catch (error) {
    console.error('Error in saveClassSubjects:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. COPY SUBJECTS FROM ANOTHER CLASS (1-Click Clone / Replicate)
 * Copies all subjects, total marks & pass marks from Source Class to Target Class.
 */
export const copySubjectsFromClass = async (req, res) => {
  try {
    const { schoolCode, sourceClass, targetClass } = req.body;
    if (!schoolCode || !sourceClass || !targetClass) {
      return res.status(400).json({
        success: false,
        message: 'School code, source class, and target class are required.',
      });
    }

    if (sourceClass === targetClass) {
      return res.status(400).json({ success: false, message: 'Source and target classes cannot be the same.' });
    }

    const sourceSubjects = await ClassSubject.find({ schoolCode, className: sourceClass }).sort({ order: 1 });
    if (!sourceSubjects || sourceSubjects.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No subjects configured in source class "${sourceClass}" to copy.`,
      });
    }

    // Remove old target subjects and clone source subjects
    await ClassSubject.deleteMany({ schoolCode, className: targetClass });

    const cloned = sourceSubjects.map((s, idx) => ({
      schoolCode,
      className: targetClass,
      subjectName: s.subjectName,
      subjectCode: s.subjectCode || '',
      totalMarks: s.totalMarks,
      passingMarks: s.passingMarks,
      order: idx + 1,
    }));

    const result = await ClassSubject.insertMany(cloned);

    return res.status(200).json({
      success: true,
      message: `Successfully copied ${result.length} subjects from ${sourceClass} to ${targetClass}!`,
      data: result,
    });
  } catch (error) {
    console.error('Error in copySubjectsFromClass:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Get Marks Entry Sheet (Matrix of Enrolled Students × Class Subjects)
 */
export const getMarksEntrySheet = async (req, res) => {
  try {
    const { schoolCode, termName, className, section, academicSession = '2025-2026' } = req.query;
    if (!schoolCode || !termName || !className || !section) {
      return res.status(400).json({
        success: false,
        message: 'School code, term name, class, and section are required.',
      });
    }

    // 1. Get Class Subjects (Auto-seeds if none exist)
    const subjects = await findOrSeedClassSubjects(schoolCode, className);

    // 2. Get Enrolled Active Students (lightweight projected fields)
    const students = await Student.find({
      schoolCode,
      $or: [{ className }, { currentClass: className }],
      section,
      status: { $ne: 'EXPELLED' },
    })
      .select('_id fullName fatherName rollNumber admissionNumber photo currentClass className section status')
      .sort({ rollNumber: 1 })
      .lean();

    // 3. Get existing marks records for this term
    const existingMarks = await StudentExamMarks.find({
      schoolCode,
      academicSession,
      termName,
      className,
      section,
    }).lean();

    const marksMap = new Map();
    existingMarks.forEach((m) => {
      marksMap.set(String(m.studentId), m);
    });

    // 4. Build student rows with subject marks
    const sheet = students.map((std) => {
      const existing = marksMap.get(String(std._id));

      const subjectMarks = subjects.map((sub) => {
        const found = existing?.subjectMarks?.find((sm) => sm.subjectName === sub.subjectName);
        return {
          subjectName: sub.subjectName,
          totalMarks: sub.totalMarks,
          passingMarks: sub.passingMarks,
          obtainedMarks: found ? found.obtainedMarks : 0,
          isAbsent: found ? found.isAbsent : false,
          remarks: found ? found.remarks : 'Pass',
        };
      });

      return {
        studentId: std._id,
        studentName: std.fullName,
        fatherName: std.fatherName,
        rollNumber: std.rollNumber,
        admissionNumber: std.admissionNumber,
        studentPhoto: std.photo?.url || null,
        subjectMarks,
        totalMaxMarks: existing ? existing.totalMaxMarks : subjects.reduce((sum, s) => sum + s.totalMarks, 0),
        totalObtainedMarks: existing ? existing.totalObtainedMarks : 0,
        percentage: existing ? existing.percentage : 0,
        grade: existing ? existing.grade : '-',
        classRank: existing ? existing.classRank : 1,
        teacherRemarks: existing ? existing.teacherRemarks : 'Promoted',
        isSaved: Boolean(existing),
      };
    });

    return res.status(200).json({
      success: true,
      subjects,
      data: sheet,
      summary: {
        totalStudents: students.length,
        savedCount: existingMarks.length,
      },
    });
  } catch (error) {
    console.error('Error in getMarksEntrySheet:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 7. Save Batch Class Marks (Keyboard/Spreadsheet Fast Save with Auto-Ranking & Grades)
 */
export const saveBatchMarks = async (req, res) => {
  try {
    const { schoolCode, termName, className, section, academicSession = '2025-2026', records } = req.body;
    if (!schoolCode || !termName || !className || !section || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'School code, term name, class, section, and student records are required.',
      });
    }

    // Helper: Compute Grade from percentage
    const computeGrade = (pct) => {
      if (pct >= 80) return 'A+';
      if (pct >= 70) return 'A';
      if (pct >= 60) return 'B';
      if (pct >= 50) return 'C';
      if (pct >= 40) return 'D';
      return 'F';
    };

    // Calculate totals & percentages for each student
    const processed = records.map((r) => {
      let maxMarks = 0;
      let obtainedMarks = 0;
      let failedSubjectCount = 0;

      const subMarks = r.subjectMarks.map((sm) => {
        const tot = Number(sm.totalMarks) || 100;
        const obt = sm.isAbsent ? 0 : Number(sm.obtainedMarks) || 0;
        const pass = Number(sm.passingMarks) || 40;
        const isFail = obt < pass && !sm.isAbsent;

        if (isFail) failedSubjectCount++;
        maxMarks += tot;
        obtainedMarks += obt;

        return {
          subjectName: sm.subjectName,
          totalMarks: tot,
          obtainedMarks: obt,
          passingMarks: pass,
          isAbsent: Boolean(sm.isAbsent),
          remarks: sm.isAbsent ? 'Absent' : isFail ? 'Fail' : 'Pass',
        };
      });

      const percentage = maxMarks > 0 ? Number(((obtainedMarks / maxMarks) * 100).toFixed(2)) : 0;
      const grade = computeGrade(percentage);
      const isPassed = failedSubjectCount === 0;
      const remarks = r.teacherRemarks
        ? r.teacherRemarks
        : isPassed
        ? percentage >= 80
          ? 'Pass with Distinction'
          : 'Promoted'
        : `Needs Improvement (${failedSubjectCount} Failed)`;

      return {
        ...r,
        subjectMarks: subMarks,
        totalMaxMarks: maxMarks,
        totalObtainedMarks: obtainedMarks,
        percentage,
        grade,
        isPassed,
        teacherRemarks: remarks,
      };
    });

    // Auto-calculate Class Ranks (1st, 2nd, 3rd) based on percentage
    const sortedForRank = [...processed].sort((a, b) => b.percentage - a.percentage);
    const rankMap = new Map();
    let currentRank = 1;

    sortedForRank.forEach((item, index) => {
      if (index > 0 && item.percentage < sortedForRank[index - 1].percentage) {
        currentRank = index + 1;
      }
      rankMap.set(String(item.studentId), currentRank);
    });

    // Upsert into StudentExamMarks
    const bulkOps = processed.map((rec) => {
      const rank = rankMap.get(String(rec.studentId)) || 1;
      return {
        updateOne: {
          filter: {
            schoolCode,
            academicSession,
            termName,
            className,
            section,
            studentId: rec.studentId,
          },
          update: {
            $set: {
              schoolCode,
              academicSession,
              termName,
              className,
              section,
              studentId: rec.studentId,
              studentName: rec.studentName,
              fatherName: rec.fatherName || '',
              rollNumber: rec.rollNumber || '',
              admissionNumber: rec.admissionNumber || '',
              studentPhoto: rec.studentPhoto || null,
              subjectMarks: rec.subjectMarks,
              totalMaxMarks: rec.totalMaxMarks,
              totalObtainedMarks: rec.totalObtainedMarks,
              percentage: rec.percentage,
              grade: rec.grade,
              classRank: rank,
              isPassed: rec.isPassed,
              teacherRemarks: rec.teacherRemarks,
            },
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await StudentExamMarks.bulkWrite(bulkOps);
    }

    return res.status(200).json({
      success: true,
      message: `Marks for ${processed.length} students in Class ${className}-${section} saved and ranked successfully!`,
      data: processed,
    });
  } catch (error) {
    console.error('Error in saveBatchMarks:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 8. Get Consolidated Annual Report Cards (EXACT MATCH to user's photo!)
 * Pulls all terms (1st Bimonthly 10%, Mid Term 30%, 2nd Bimonthly 10%, Final Term 50%)
 * and computes overall weighted totals, final grade, rank, and promotion remarks!
 */
export const getConsolidatedReportCards = async (req, res) => {
  try {
    const { schoolCode, className, section, academicSession = '2025-2026', studentId } = req.query;
    if (!schoolCode || !className || !section) {
      return res.status(400).json({
        success: false,
        message: 'School code, class, and section are required.',
      });
    }

    // 1. Get All Exam Terms
    const terms = await ExamTerm.find({ schoolCode, academicSession }).sort({ order: 1 }).lean();

    // 2. Get Class Subjects (Auto-seeds if none exist)
    const subjects = await findOrSeedClassSubjects(schoolCode, className);

    // 3. Get Enrolled Students (Lightweight projection)
    const studentQuery = {
      schoolCode,
      $or: [{ className }, { currentClass: className }],
      section,
      status: { $ne: 'EXPELLED' },
    };
    if (studentId) studentQuery._id = studentId;

    const students = await Student.find(studentQuery)
      .select('_id fullName fatherName rollNumber admissionNumber photo currentClass className section status')
      .sort({ rollNumber: 1 })
      .lean();

    // 4. Get all exam marks across all terms for this class (Utilizes our new compound index!)
    const allMarks = await StudentExamMarks.find({
      schoolCode,
      academicSession,
      className,
      section,
    }).lean();

    // Map: studentId -> termName -> record
    const studentTermMap = new Map();
    allMarks.forEach((m) => {
      const sId = String(m.studentId);
      if (!studentTermMap.has(sId)) studentTermMap.set(sId, new Map());
      studentTermMap.get(sId).set(m.termName, m);
    });

    // 5. Build Consolidated Report Card per student
    const reportCards = students.map((std) => {
      const sId = String(std._id);
      const termDataMap = studentTermMap.get(sId) || new Map();

      // Subject-wise rows across all terms
      let grandTotalMax = 0;
      let grandTotalObtained = 0;

      const subjectRows = subjects.map((sub) => {
        let subjectObtainedSum = 0;
        let subjectMaxSum = 0;

        const termScores = terms.map((t) => {
          const markRec = termDataMap.get(t.name);
          const subScore = markRec?.subjectMarks?.find((sm) => sm.subjectName === sub.subjectName);

          const isAbsent = subScore ? Boolean(subScore.isAbsent) : false;
          const obtained = subScore ? (isAbsent ? 0 : Number(subScore.obtainedMarks) || 0) : 0;
          const max = subScore ? Number(subScore.totalMarks) || sub.totalMarks : sub.totalMarks;

          subjectObtainedSum += obtained;
          subjectMaxSum += max;

          return {
            termName: t.name,
            rawObtained: obtained,
            rawMax: max,
            scoreDisplay: isAbsent ? 'A' : obtained,
          };
        });

        const isPassed = subjectMaxSum > 0 ? (subjectObtainedSum / subjectMaxSum) >= 0.4 : true;
        grandTotalMax += subjectMaxSum;
        grandTotalObtained += subjectObtainedSum;

        return {
          subjectName: sub.subjectName,
          termScores,
          totalObtained: subjectObtainedSum,
          totalMax: subjectMaxSum,
          isPassed,
          remarks: isPassed ? 'Pass' : 'Fail',
        };
      });

      const overallPercentage = grandTotalMax > 0 ? Number(((grandTotalObtained / grandTotalMax) * 100).toFixed(2)) : 0;

      let grade = 'F';
      if (overallPercentage >= 80) grade = 'A+';
      else if (overallPercentage >= 70) grade = 'A';
      else if (overallPercentage >= 60) grade = 'B';
      else if (overallPercentage >= 50) grade = 'C';
      else if (overallPercentage >= 40) grade = 'D';

      return {
        studentId: std._id,
        studentName: std.fullName,
        fatherName: std.fatherName,
        rollNumber: std.rollNumber,
        admissionNumber: std.admissionNumber,
        studentPhoto: std.photo?.url || null,
        className,
        section,
        academicSession,
        terms,
        subjects: subjectRows,
        grandTotalMax,
        grandTotalObtained: Number(grandTotalObtained.toFixed(2)),
        overallPercentage,
        grade,
        classPosition: 1, // Will compute next
        promotionRemarks: overallPercentage >= 40 ? 'Promoted' : 'Detained',
      };
    });

    // Compute Overall Class Rank / Position across consolidated scores
    const sorted = [...reportCards].sort((a, b) => b.overallPercentage - a.overallPercentage);
    const positionMap = new Map();
    let pos = 1;

    sorted.forEach((item, idx) => {
      if (idx > 0 && item.overallPercentage < sorted[idx - 1].overallPercentage) {
        pos = idx + 1;
      }
      positionMap.set(String(item.studentId), pos);
    });

    // Helper for suffix (1st, 2nd, 3rd)
    const getPositionSuffix = (num) => {
      if (num === 1) return '1st';
      if (num === 2) return '2nd';
      if (num === 3) return '3rd';
      return `${num}th`;
    };

    reportCards.forEach((rc) => {
      const p = positionMap.get(String(rc.studentId)) || 1;
      rc.classPosition = getPositionSuffix(p);
    });

    return res.status(200).json({
      success: true,
      data: reportCards,
      terms,
      subjects,
    });
  } catch (error) {
    console.error('Error in getConsolidatedReportCards:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 9. Get Single Term Printable Report Cards
 */
export const getSingleTermReportCards = async (req, res) => {
  try {
    const { schoolCode, termName, className, section, academicSession = '2025-2026', studentId } = req.query;
    if (!schoolCode || !termName || !className || !section) {
      return res.status(400).json({
        success: false,
        message: 'School code, term name, class, and section are required.',
      });
    }

    const subjects = await findOrSeedClassSubjects(schoolCode, className);

    const studentQuery = {
      schoolCode,
      $or: [{ className }, { currentClass: className }],
      section,
      status: { $ne: 'EXPELLED' },
    };
    if (studentId) studentQuery._id = studentId;

    const students = await Student.find(studentQuery)
      .select('_id fullName fatherName rollNumber admissionNumber photo currentClass className section status')
      .sort({ rollNumber: 1 })
      .lean();

    const marksRecords = await StudentExamMarks.find({
      schoolCode,
      academicSession,
      termName,
      className,
      section,
    }).lean();

    const marksMap = new Map();
    marksRecords.forEach((m) => marksMap.set(String(m.studentId), m));

    const getPositionSuffix = (num) => {
      if (num === 1) return '1st';
      if (num === 2) return '2nd';
      if (num === 3) return '3rd';
      return `${num}th`;
    };

    const reportCards = students.map((std) => {
      const existing = marksMap.get(String(std._id));

      const subMarks = subjects.map((sub) => {
        const found = existing?.subjectMarks?.find((sm) => sm.subjectName === sub.subjectName);
        const obt = found ? found.obtainedMarks : 0;
        const pass = found ? found.passingMarks : sub.passingMarks;
        const tot = found ? found.totalMarks : sub.totalMarks;
        const isAbsent = found ? Boolean(found.isAbsent) : false;
        const isPassed = !isAbsent && obt >= pass;

        return {
          subjectName: sub.subjectName,
          totalMarks: tot,
          obtainedMarks: obt,
          passingMarks: pass,
          isAbsent,
          remarks: isAbsent ? 'Absent' : isPassed ? 'Pass' : 'Fail',
        };
      });

      const maxM = existing ? existing.totalMaxMarks : subjects.reduce((s, x) => s + x.totalMarks, 0);
      const obtM = existing ? existing.totalObtainedMarks : 0;
      const pct = existing ? existing.percentage : (maxM > 0 ? Number(((obtM / maxM) * 100).toFixed(2)) : 0);

      return {
        studentId: std._id,
        studentName: std.fullName,
        fatherName: std.fatherName,
        rollNumber: std.rollNumber,
        admissionNumber: std.admissionNumber,
        studentPhoto: std.photo?.url || null,
        className,
        section,
        termName,
        academicSession,
        subjects: subMarks,
        totalMaxMarks: maxM,
        totalObtainedMarks: obtM,
        percentage: pct,
        grade: existing ? existing.grade : (pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 40 ? 'D' : 'F'),
        classPosition: existing ? getPositionSuffix(existing.classRank) : '-',
        teacherRemarks: existing ? existing.teacherRemarks : (pct >= 40 ? 'Promoted' : 'Needs Improvement'),
      };
    });

    return res.status(200).json({
      success: true,
      data: reportCards,
      subjects,
      termName,
    });
  } catch (error) {
    console.error('Error in getSingleTermReportCards:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
