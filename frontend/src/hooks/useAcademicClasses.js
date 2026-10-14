import { useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAcademicClassesContext } from '../context/AcademicClassesContext';

/**
 * Reusable hook to access academic classes and their respective sections dynamically.
 * Connected to AcademicClassesProvider for real-time live updates across all tabs & windows.
 */
export function useAcademicClasses(schoolCode) {
  // Try using the centralized real-time context first
  try {
    const context = useAcademicClassesContext();
    if (context) {
      return context;
    }
  } catch {
    // If rendered outside provider (e.g. standalone test), fallback to local fetcher
  }

  // Fallback standalone local state
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchClasses = useCallback(async () => {
    if (!schoolCode) return;
    setLoading(true);
    try {
      const res = await api.get('/classes', { params: { schoolCode } });
      if (res.data?.success) {
        setClasses(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load academic classes in fallback hook:', err);
    } finally {
      setLoading(false);
    }
  }, [schoolCode]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const classNames = classes
    .filter((c) => c.isActive !== false)
    .map((c) => c.name);

  const getSectionsForClass = (className) => {
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
  };

  return {
    classes,
    classNames,
    getSectionsForClass,
    loading,
    refreshClasses: fetchClasses,
    broadcastChange: () => {},
  };
}
