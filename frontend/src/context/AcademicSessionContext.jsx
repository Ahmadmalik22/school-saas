import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AcademicSessionContext = createContext(null);

export function AcademicSessionProvider({ children, schoolCode = 'SCH-101' }) {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(() => {
    return localStorage.getItem('akkhor_current_session') || '2025-2026';
  });
  const [activeSession, setActiveSessionState] = useState('2025-2026');
  const [loading, setLoading] = useState(true);

  // Fetch all sessions from backend
  const refreshSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/sessions', { params: { schoolCode } });
      if (res.data?.success) {
        const sessionList = res.data.data || [];
        setSessions(sessionList);

        const officialActive = res.data.activeSession || '2025-2026';
        setActiveSessionState(officialActive);

        // If stored current session is not in the list, fallback to official active session
        const stored = localStorage.getItem('akkhor_current_session');
        if (stored && sessionList.some((s) => s.sessionName === stored)) {
          setCurrentSession(stored);
        } else {
          setCurrentSession(officialActive);
          localStorage.setItem('akkhor_current_session', officialActive);
        }
      }
    } catch (err) {
      console.error('Error fetching academic sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [schoolCode]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Switch the working session globally across all modules
  const switchSession = (sessionName) => {
    if (!sessionName) return;
    setCurrentSession(sessionName);
    localStorage.setItem('akkhor_current_session', sessionName);
  };

  // Mark session as school's officially active session
  const setOfficialActiveSession = async (sessionName) => {
    try {
      const res = await api.patch('/sessions/set-active', {
        schoolCode,
        sessionName,
      });
      if (res.data?.success) {
        switchSession(sessionName);
        await refreshSessions();
        return { success: true, message: res.data.message };
      }
      return { success: false, message: res.data?.message || 'Failed to update active session.' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Error updating active session.',
      };
    }
  };

  // Create new session
  const createNewSession = async ({
    startMonth,
    startYear,
    endMonth,
    endYear,
    sessionName,
    makeActive = false,
  }) => {
    try {
      const res = await api.post('/sessions', {
        schoolCode,
        startMonth,
        startYear: Number(startYear),
        endMonth,
        endYear: Number(endYear),
        sessionName,
        makeActive,
      });

      if (res.data?.success) {
        const createdName = res.data.data.sessionName;
        if (makeActive) {
          switchSession(createdName);
        }
        await refreshSessions();
        return { success: true, message: res.data.message, data: res.data.data };
      }
      return { success: false, message: res.data?.message || 'Failed to create session.' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Error creating session.',
      };
    }
  };

  // Delete session
  const removeSession = async (id) => {
    try {
      const res = await api.delete(`/sessions/${id}`, { params: { schoolCode } });
      if (res.data?.success) {
        await refreshSessions();
        return { success: true, message: res.data.message };
      }
      return { success: false, message: res.data?.message || 'Failed to delete session.' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Error deleting session.',
      };
    }
  };

  return (
    <AcademicSessionContext.Provider
      value={{
        currentSession,
        activeSession,
        sessions,
        loading,
        switchSession,
        setOfficialActiveSession,
        createNewSession,
        removeSession,
        refreshSessions,
      }}
    >
      {children}
    </AcademicSessionContext.Provider>
  );
}

export function useAcademicSession() {
  const context = useContext(AcademicSessionContext);
  if (!context) {
    throw new Error('useAcademicSession must be used within an AcademicSessionProvider');
  }
  return context;
}

export default AcademicSessionContext;
