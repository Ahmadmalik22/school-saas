import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';

const AcademicClassesContext = createContext(null);

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const SYNC_CHANNEL_NAME = 'school_saas_academic_classes_sync';
const SYNC_STORAGE_KEY = 'school_saas_classes_updated_at';

export function AcademicClassesProvider({ schoolCode, children }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  // Broadcast change to other open browser tabs / windows
  const broadcastChange = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
        bc.postMessage({ type: 'CLASSES_UPDATED', schoolCode, timestamp: Date.now() });
        bc.close();
      }
      localStorage.setItem(SYNC_STORAGE_KEY, Date.now().toString());
      window.dispatchEvent(new CustomEvent('app:classes-updated', { detail: { schoolCode } }));
    } catch (err) {
      console.warn('Cross-tab broadcast warning:', err);
    }
  }, [schoolCode]);

  // Fetch classes from backend API
  const fetchClasses = useCallback(
    async (showSpinner = false) => {
      if (!schoolCode) return;
      if (showSpinner) setLoading(true);

      try {
        const res = await api.get('/classes', { params: { schoolCode } });
        if (res.data?.success) {
          setClasses(res.data.data || []);
          setLastUpdated(Date.now());
        }
      } catch (err) {
        console.error('Failed to load academic classes in real-time context:', err);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [schoolCode]
  );

  // Manual refresh that also notifies all other tabs
  const refreshClasses = useCallback(async () => {
    await fetchClasses(false);
    broadcastChange();
  }, [fetchClasses, broadcastChange]);

  // 1. Initial Load & SchoolCode Change
  useEffect(() => {
    fetchClasses(true);
  }, [fetchClasses]);

  // 2. Real-time Multi-Device Sync via WebSockets (Socket.io)
  useEffect(() => {
    if (!schoolCode) return;

    let socket;
    try {
      socket = io(SOCKET_SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => {
        socket.emit('join_school', schoolCode);
      });

      socket.on('classes_updated', (event) => {
        if (!event?.schoolCode || event.schoolCode.toUpperCase() === schoolCode.toUpperCase()) {
          // Immediately re-fetch classes in background with 0ms visual freeze
          fetchClasses(false);
        }
      });
    } catch (err) {
      console.warn('Socket.io connection error:', err);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [schoolCode, fetchClasses]);

  // 3. Real-time Multi-Tab Sync via BroadcastChannel (0ms delay across tabs)
  useEffect(() => {
    let bc;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
        bc.onmessage = (event) => {
          if (event.data?.type === 'CLASSES_UPDATED') {
            fetchClasses(false);
          }
        };
      }
    } catch (err) {
      console.warn('BroadcastChannel error:', err);
    }

    // Fallback: localStorage storage event
    const handleStorage = (e) => {
      if (e.key === SYNC_STORAGE_KEY) {
        fetchClasses(false);
      }
    };
    window.addEventListener('storage', handleStorage);

    // Intra-window custom event
    const handleLocalCustom = (e) => {
      if (e.detail?.schoolCode === schoolCode) {
        fetchClasses(false);
      }
    };
    window.addEventListener('app:classes-updated', handleLocalCustom);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('app:classes-updated', handleLocalCustom);
    };
  }, [fetchClasses, schoolCode]);

  // Derived: Active Class Names
  const classNames = useMemo(() => {
    return classes
      .filter((c) => c.isActive !== false)
      .map((c) => c.name);
  }, [classes]);

  // Dynamic Helper: Get Sections for any selected Class
  const getSectionsForClass = useCallback(
    (className) => {
      if (!className || className === 'ALL') {
        const allSections = new Set();
        classes.forEach((c) => {
          (c.sections || []).forEach((s) => allSections.add(s.name));
        });
        return allSections.size > 0 ? Array.from(allSections) : ['A', 'B', 'C'];
      }

      const target = classes.find(
        (c) => c.name.toLowerCase() === className.toLowerCase()
      );

      if (target && target.sections && target.sections.length > 0) {
        return target.sections.map((s) => s.name);
      }

      return ['A'];
    },
    [classes]
  );

  const value = useMemo(
    () => ({
      classes,
      classNames,
      loading,
      getSectionsForClass,
      refreshClasses,
      broadcastChange,
      lastUpdated,
    }),
    [classes, classNames, loading, getSectionsForClass, refreshClasses, broadcastChange, lastUpdated]
  );

  return (
    <AcademicClassesContext.Provider value={value}>
      {children}
    </AcademicClassesContext.Provider>
  );
}

export function useAcademicClassesContext() {
  const context = useContext(AcademicClassesContext);
  if (!context) {
    throw new Error('useAcademicClassesContext must be used within an AcademicClassesProvider');
  }
  return context;
}

export const useAcademicClasses = useAcademicClassesContext;
export default AcademicClassesContext;
