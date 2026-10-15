import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';
import { SYSTEM_MODULES, ALL_SUBMODULE_KEYS } from '../constants/moduleCatalog';

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? 'https://school-saas-g12p.onrender.com'
        : 'http://localhost:5000'));

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('school_saas_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('school_saas_token') || null);
  const [activeSchoolCode, setActiveSchoolCode] = useState(() => {
    try {
      const saved = localStorage.getItem('school_saas_user');
      return saved ? JSON.parse(saved).schoolCode : 'SCH-101';
    } catch {
      return 'SCH-101';
    }
  });

  const [activeSchoolName, setActiveSchoolName] = useState(() => {
    try {
      const savedProfile = localStorage.getItem('school_saas_profile');
      if (savedProfile) {
        const p = JSON.parse(savedProfile);
        if (p.schoolName) return p.schoolName;
      }
      const saved = localStorage.getItem('school_saas_user');
      return saved ? JSON.parse(saved).schoolName : 'ISLAMABAD MODEL COLLEGE FOR BOYS';
    } catch {
      return 'ISLAMABAD MODEL COLLEGE FOR BOYS';
    }
  });

  const [schoolProfile, setSchoolProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('school_saas_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const socketRef = useRef(null);

  // Helper to fetch official school profile & branding by schoolCode
  const fetchSchoolProfile = useCallback(async (code) => {
    if (!code || code === 'SYSTEM') return null;
    try {
      const res = await api.get(`/school-profile?schoolCode=${code}`);
      if (res.data?.success && res.data.data) {
        const prof = res.data.data;
        setSchoolProfile(prof);
        localStorage.setItem('school_saas_profile', JSON.stringify(prof));
        if (prof.schoolName) {
          setActiveSchoolName(prof.schoolName);
        }
        return prof;
      }
    } catch (err) {
      console.warn('Could not fetch school profile branding:', err.message);
    }
    return null;
  }, []);

  // Sync document title with current school branding
  useEffect(() => {
    const brandName = schoolProfile?.schoolName || activeSchoolName || 'School Portal';
    document.title = `${brandName} | Management Portal`;
  }, [schoolProfile?.schoolName, activeSchoolName]);

  // 1. Verify and refresh session on initial load
  useEffect(() => {
    const verifySession = async () => {
      const savedToken = localStorage.getItem('school_saas_token');
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.data?.success && res.data.user) {
          const freshUser = res.data.user;
          setUser(freshUser);
          localStorage.setItem('school_saas_user', JSON.stringify(freshUser));
          const code = freshUser.schoolCode || 'SCH-101';
          setActiveSchoolCode(code);

          if (res.data.schoolProfile) {
            setSchoolProfile(res.data.schoolProfile);
            localStorage.setItem('school_saas_profile', JSON.stringify(res.data.schoolProfile));
            if (res.data.schoolProfile.schoolName) {
              setActiveSchoolName(res.data.schoolProfile.schoolName);
            }
          } else {
            fetchSchoolProfile(code);
          }
        }
      } catch (err) {
        console.warn('Session verification failed, please log in:', err.message);
        localStorage.removeItem('school_saas_token');
        localStorage.removeItem('school_saas_user');
        localStorage.removeItem('school_saas_profile');
        setUser(null);
        setToken(null);
        setSchoolProfile(null);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [fetchSchoolProfile]);

  // 2. Real-time Socket.io Sync for Permissions & School Tenant License
  useEffect(() => {
    if (!user || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ Socket connected for real-time permissions & school updates');
      // Join school room
      if (user.schoolCode) {
        socket.emit('join_school', user.schoolCode);
      }
      // Join personal user room
      if (user.id || user._id) {
        socket.emit('join_user', user.id || user._id);
      }
      // If super admin, join developer channel
      if (user.role === 'SUPER_ADMIN') {
        socket.emit('join_developer');
      }
    });

    // Event A: Real-time Granular Permissions Update
    socket.on('user_permissions_updated', (data) => {
      console.log('🔔 Real-time sub-module permissions updated event received:', data);
      const myId = user.id || user._id;
      if (data.userId === myId) {
        setUser((prev) => {
          const updated = {
            ...prev,
            role: data.role || prev.role,
            permissions: data.permissions || prev.permissions,
            isActive: data.isActive !== undefined ? data.isActive : prev.isActive,
          };
          localStorage.setItem('school_saas_user', JSON.stringify(updated));
          return updated;
        });

        // Show brief floating toast
        setNotification({
          type: 'success',
          message: '⚡ Your sub-module access permissions have been updated in real-time!',
        });
        setTimeout(() => setNotification(null), 4000);
      }
    });

    // Event B: Real-time School License Status Changed (ACTIVE <-> SUSPENDED)
    socket.on('school_status_updated', (data) => {
      console.log('🔔 Real-time school status updated:', data);
      if (data.schoolCode === user.schoolCode && user.role !== 'SUPER_ADMIN') {
        if (data.status === 'SUSPENDED') {
          alert(`⚠️ Alert: School license for [${data.schoolCode}] has been SUSPENDED by system developer.`);
          window.location.reload();
        }
      }
    });

    // Event C: User Account Deleted
    socket.on('user_account_deleted', (data) => {
      const myId = user.id || user._id;
      if (data.userId === myId) {
        alert('Your user account has been removed by the administrator.');
        logout();
      }
    });

    // Event D: Real-time School Profile & Branding Updated
    socket.on('school_profile_updated', (updatedProfile) => {
      console.log('🔔 Real-time school profile & branding updated:', updatedProfile);
      if (updatedProfile && updatedProfile.schoolCode === activeSchoolCode) {
        setSchoolProfile(updatedProfile);
        if (updatedProfile.schoolName) {
          setActiveSchoolName(updatedProfile.schoolName);
        }
        localStorage.setItem('school_saas_profile', JSON.stringify(updatedProfile));
        setNotification({
          type: 'success',
          message: `🏫 School identity & branding updated: ${updatedProfile.schoolName}`,
        });
        setTimeout(() => setNotification(null), 4000);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id, user?.schoolCode, user?.role, token, activeSchoolCode]);

  // Login Handler
  const login = async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    if (res.data?.success && res.data.token) {
      const { token: newToken, user: newUser, schoolProfile: newProfile } = res.data;
      setToken(newToken);
      setUser(newUser);
      setActiveSchoolCode(newUser.schoolCode);
      setActiveSchoolName(newProfile?.schoolName || newUser.schoolName);

      localStorage.setItem('school_saas_token', newToken);
      localStorage.setItem('school_saas_user', JSON.stringify(newUser));

      if (newProfile) {
        setSchoolProfile(newProfile);
        localStorage.setItem('school_saas_profile', JSON.stringify(newProfile));
      } else {
        fetchSchoolProfile(newUser.schoolCode);
      }

      return { success: true, user: newUser };
    }
    throw new Error(res.data?.message || 'Login failed.');
  };

  // Logout Handler
  const logout = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    localStorage.removeItem('school_saas_token');
    localStorage.removeItem('school_saas_user');
    localStorage.removeItem('school_saas_profile');
    setUser(null);
    setToken(null);
    setSchoolProfile(null);
    window.location.href = '/login';
  }, []);

  // Developer or Admin switch school context
  const switchSchoolContext = useCallback(
    (schoolCode, schoolName) => {
      setActiveSchoolCode(schoolCode);
      if (schoolName) setActiveSchoolName(schoolName);
      fetchSchoolProfile(schoolCode);
    },
    [fetchSchoolProfile]
  );

  // Directly update local schoolProfile (e.g. after editing profile form)
  const updateSchoolProfileLocal = useCallback((updated) => {
    setSchoolProfile((prev) => {
      const next = { ...prev, ...updated };
      localStorage.setItem('school_saas_profile', JSON.stringify(next));
      if (next.schoolName) setActiveSchoolName(next.schoolName);
      return next;
    });
  }, []);

  /**
   * Check if logged-in user has permission for a specific sub-module.
   * Super Admins (Developers) & Admins (Principals) have full access.
   * Other users check user.permissions array.
   */
  const hasPermission = useCallback(
    (submoduleKey) => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
      if (!Array.isArray(user.permissions)) return false;
      return user.permissions.includes(submoduleKey);
    },
    [user]
  );

  /**
   * Check if logged-in user has access to at least ONE submodule inside a parent module.
   * Used to show/hide the entire parent accordion in the sidebar.
   */
  const hasModule = useCallback(
    (parentModuleId) => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;

      const mod = SYSTEM_MODULES.find((m) => m.id === parentModuleId);
      if (!mod) return false;

      // If user has rights for ANY of the submodules in this parent module
      return mod.submodules.some((s) => hasPermission(s.id));
    },
    [user, hasPermission]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        schoolCode: activeSchoolCode,
        schoolName: schoolProfile?.schoolName || activeSchoolName,
        schoolProfile,
        schoolLogo: schoolProfile?.logoUrl || null,
        principalSignature: schoolProfile?.principalSignatureUrl || null,
        schoolTagline: schoolProfile?.tagline || '',
        schoolAddress: schoolProfile?.address || '',
        schoolAffiliation: schoolProfile?.affiliation || '',
        fetchSchoolProfile,
        updateSchoolProfileLocal,
        setSchoolCode: setActiveSchoolCode,
        switchSchoolContext,
        isAuthenticated: !!user && !!token,
        isSuperAdmin: user?.role === 'SUPER_ADMIN',
        isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
        role: user?.role || 'GUEST',
        permissions: user?.permissions || [],
        hasPermission,
        hasModule,
        login,
        logout,
        loading,
        socket: socketRef.current,
      }}
    >
      {/* Real-time Toast Banner */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 border border-amber-500/50 text-amber-300 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <span>{notification.message}</span>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
export default AuthContext;
