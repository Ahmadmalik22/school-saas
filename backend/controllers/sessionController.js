import AcademicSession from '../models/AcademicSession.js';
import SchoolProfile from '../models/SchoolProfile.js';

/**
 * 1. Get all Academic Sessions for a School
 * Auto-seeds initial sessions if none exist yet.
 */
export const getSessions = async (req, res) => {
  try {
    const { schoolCode } = req.query;
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const code = schoolCode.toUpperCase().trim();
    let sessions = await AcademicSession.find({ schoolCode: code })
      .sort({ startYear: -1, sessionName: -1 })
      .lean();

    // Auto-seed default sessions if empty AND school genuinely exists in SchoolProfile
    if (!sessions || sessions.length === 0) {
      const schoolExists = await SchoolProfile.exists({ schoolCode: code });
      if (!schoolExists) {
        return res.status(200).json({ success: true, data: [], activeSession: null });
      }

      const defaults = [
        {
          schoolCode: code,
          sessionName: '2025-2026',
          startMonth: 'April',
          startYear: 2025,
          endMonth: 'March',
          endYear: 2026,
          isActive: true,
        },
        {
          schoolCode: code,
          sessionName: '2026-2027',
          startMonth: 'April',
          startYear: 2026,
          endMonth: 'March',
          endYear: 2027,
          isActive: false,
        },
        {
          schoolCode: code,
          sessionName: '2024-2025',
          startMonth: 'April',
          startYear: 2024,
          endMonth: 'March',
          endYear: 2025,
          isActive: false,
          isArchived: true,
        },
      ];

      try {
        await AcademicSession.insertMany(defaults, { ordered: false });
      } catch (e) {
        console.error('Session seeding note:', e.message);
      }

      sessions = await AcademicSession.find({ schoolCode: code })
        .sort({ startYear: -1, sessionName: -1 })
        .lean();
    }

    // Determine current active session
    const activeSession = sessions.find((s) => s.isActive) || sessions[0];

    return res.status(200).json({
      success: true,
      data: sessions,
      activeSession: activeSession ? activeSession.sessionName : '2025-2026',
    });
  } catch (error) {
    console.error('Error in getSessions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Create New Academic Session
 */
export const createSession = async (req, res) => {
  try {
    const {
      schoolCode,
      startMonth = 'April',
      startYear,
      endMonth = 'March',
      endYear,
      sessionName,
      makeActive = false,
    } = req.body;

    if (!schoolCode || !startYear || !endYear) {
      return res.status(400).json({
        success: false,
        message: 'School code, start year, and end year are required.',
      });
    }

    const code = schoolCode.toUpperCase().trim();
    const finalSessionName = (sessionName && sessionName.trim()) || `${startYear}-${endYear}`;

    // Check if session already exists
    const existing = await AcademicSession.findOne({ schoolCode: code, sessionName: finalSessionName });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Academic Session "${finalSessionName}" already exists for this school.`,
      });
    }

    if (makeActive) {
      await AcademicSession.updateMany({ schoolCode: code }, { $set: { isActive: false } });
    }

    const newSession = await AcademicSession.create({
      schoolCode: code,
      sessionName: finalSessionName,
      startMonth: startMonth.trim(),
      startYear: Number(startYear),
      endMonth: endMonth.trim(),
      endYear: Number(endYear),
      isActive: Boolean(makeActive),
    });

    if (makeActive) {
      await SchoolProfile.findOneAndUpdate(
        { schoolCode: code },
        { $set: { activeSession: finalSessionName } }
      );
    }

    return res.status(201).json({
      success: true,
      message: `Academic Session "${finalSessionName}" created successfully!`,
      data: newSession,
    });
  } catch (error) {
    console.error('Error in createSession:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Set Active Academic Session for School
 */
export const setActiveSession = async (req, res) => {
  try {
    const { schoolCode, sessionName } = req.body;
    if (!schoolCode || !sessionName) {
      return res.status(400).json({
        success: false,
        message: 'School code and session name are required.',
      });
    }

    const code = schoolCode.toUpperCase().trim();
    const name = sessionName.trim();

    // Deactivate all sessions
    await AcademicSession.updateMany({ schoolCode: code }, { $set: { isActive: false } });

    // Activate the targeted session
    const updated = await AcademicSession.findOneAndUpdate(
      { schoolCode: code, sessionName: name },
      { $set: { isActive: true } },
      { new: true }
    );

    if (!updated) {
      // If not in AcademicSession table, create it and make active
      const parts = name.split('-');
      const sYear = parts[0] ? Number(parts[0]) : new Date().getFullYear();
      const eYear = parts[1] ? Number(parts[1]) : sYear + 1;

      await AcademicSession.create({
        schoolCode: code,
        sessionName: name,
        startMonth: 'April',
        startYear: sYear,
        endMonth: 'March',
        endYear: eYear,
        isActive: true,
      });
    }

    // Sync with SchoolProfile
    await SchoolProfile.findOneAndUpdate(
      { schoolCode: code },
      { $set: { activeSession: name } },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: `Active academic session updated to "${name}".`,
      activeSession: name,
    });
  } catch (error) {
    console.error('Error in setActiveSession:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Delete / Archive Academic Session
 */
export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolCode } = req.query;

    const session = await AcademicSession.findOne({ _id: id, schoolCode: schoolCode?.toUpperCase() });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Academic session not found.' });
    }

    if (session.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the active session. Please set another session as active first.',
      });
    }

    await AcademicSession.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Academic session "${session.sessionName}" deleted successfully.`,
    });
  } catch (error) {
    console.error('Error in deleteSession:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
