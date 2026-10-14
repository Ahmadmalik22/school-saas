import express from 'express';
import {
  getExamTerms,
  saveExamTerm,
  deleteExamTerm,
  getClassSubjects,
  saveClassSubjects,
  copySubjectsFromClass,
  getMarksEntrySheet,
  saveBatchMarks,
  getConsolidatedReportCards,
  getSingleTermReportCards,
} from '../controllers/examController.js';

const router = express.Router();

// Exam Terms
router.get('/terms', getExamTerms);
router.post('/terms', saveExamTerm);
router.delete('/terms/:id', deleteExamTerm);

// Class Subjects & 1-Click Duplicate
router.get('/subjects', getClassSubjects);
router.post('/subjects', saveClassSubjects);
router.post('/subjects/copy', copySubjectsFromClass);

// Marks Entry Matrix & Batch Save
router.get('/marks-sheet', getMarksEntrySheet);
router.post('/marks-sheet', saveBatchMarks);

// Report Cards (Consolidated & Single Term)
router.get('/report-cards/consolidated', getConsolidatedReportCards);
router.get('/report-cards/single-term', getSingleTermReportCards);
router.get('/report-cards', getConsolidatedReportCards);

export default router;
