import express from 'express';
import {
  getSessions,
  createSession,
  setActiveSession,
  deleteSession,
} from '../controllers/sessionController.js';

const router = express.Router();

router.get('/', getSessions);
router.post('/', createSession);
router.patch('/set-active', setActiveSession);
router.delete('/:id', deleteSession);

export default router;
