/**
 * Real-time Event Broadcaster & Subscriber
 * Enables instant, zero-delay cross-component and cross-tab synchronization.
 * When an attendance scan, fee collection, or admission occurs in any tab/screen,
 * this utility immediately triggers a live data refresh on the Executive Dashboard.
 */

const EVENT_NAME = 'school_saas_realtime_event';
const STORAGE_KEY = 'school_saas_realtime_trigger';

/**
 * Trigger a real-time data change event
 * @param {'attendance' | 'fee' | 'expense' | 'student' | 'general'} eventType
 * @param {object} payload
 */
export function broadcastDataChange(eventType = 'general', payload = {}) {
  const eventData = {
    eventType,
    payload,
    timestamp: Date.now(),
  };

  // 1. Dispatch custom event for current window/tab
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: eventData }));
    }
  } catch (err) {
    console.warn('CustomEvent dispatch error:', err);
  }

  // 2. Dispatch localStorage event for other open tabs
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eventData));
    }
  } catch (err) {
    console.warn('LocalStorage broadcast error:', err);
  }
}

/**
 * Subscribe to real-time data changes
 * @param {(data: { eventType: string, payload: any, timestamp: number }) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToDataChanges(callback) {
  if (typeof window === 'undefined') return () => {};

  // Handler for same tab
  const handleCustomEvent = (e) => {
    if (e.detail && typeof callback === 'function') {
      callback(e.detail);
    }
  };

  // Handler for cross tab (storage event)
  const handleStorageEvent = (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (typeof callback === 'function') {
          callback(parsed);
        }
      } catch (err) {
        console.warn('Error parsing storage event data:', err);
      }
    }
  };

  window.addEventListener(EVENT_NAME, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  // Return unsubscribe cleanup
  return () => {
    window.removeEventListener(EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}
