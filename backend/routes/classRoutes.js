import express from 'express';
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getAllSections,
  addSectionToClass,
  updateSection,
  deleteSection,
  seedDefaultClasses,
} from '../controllers/classController.js';

const router = express.Router();

// Quick Seed Standard Default Classes (Nursery to Class 10)
router.post('/seed-defaults', seedDefaultClasses);

// ==========================================
// SUB-MODULE 1: MANAGE CLASSES
// ==========================================
// Get all classes for school (with section & enrollment counts)
router.get('/', getClasses);

// Create new class
router.post('/', createClass);

// Update class details (name, numeric order, tuition fee, status)
router.put('/:id', updateClass);

// Delete class (with safeguard against enrolled students)
router.delete('/:id', deleteClass);

// ==========================================
// SUB-MODULE 2: MANAGE SECTIONS
// ==========================================
// Get flattened sections list across all classes
router.get('/sections/all', getAllSections);

// Add new section to a specific class
router.post('/:classId/sections', addSectionToClass);

// Update section capacity, name, or room number
router.put('/:classId/sections/:sectionId', updateSection);

// Delete section from class (with safeguard)
router.delete('/:classId/sections/:sectionId', deleteSection);

export default router;
