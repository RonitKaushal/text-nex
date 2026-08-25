import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { clearInstanceLimitCache } from '../services/instanceStorage'
import { normalizePhone, shouldLogoutOnAuthError } from '../services/userStorageKey'

const AuthContext = createContext()
const REQUIRED_APP_TYPE = 'bulk-whatsapp'
const PLAN_LIKE = new Set(['basic', 'pro', 'free', 'trial', 'free-trial'])

function resolveUserAppType(user) {
  const candidates = [user?.type, user?.appType, user?.activeLicense?.appType]
  for (const raw of candidates) {
    const t = String(raw || '')
      .trim()
      .toLowerCase()
    if (!t || PLAN_LIKE.has(t)) continue
    return t
  }
  return null
}

/** Reject only clear mismatches. Missing type = legacy API — allow after successful login. */
function assertBulkWhatsAppUser(user) {
  const type = resolveUserAppType(user)
  if (!type) return
  if (type !== REQUIRED_APP_TYPE) {
    const label =
      type === 'text-next' ? 'Text Next' : type === 'lead-gen' ? 'Lead Gen' : type
    const err = new Error(
      `This license key is for ${label}. Use a Bulk WhatsApp license key.`
    )
    err.code = 'LICENSE_APP_MISMATCH'
    throw err
  }
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Storage abstraction for Electron vs Web
const storage = {
  setAuth: async (token, user, refreshToken, phoneFallback) => {
    if (window.electronAPI) {
      try {
        await window.electronAPI.saveToken(token);
        await window.electronAPI.saveUser(user, phoneFallback, { loadSessions: false });
        if (refreshToken) await window.electronAPI.saveSecureToken(refreshToken);
      } catch (err) {
        // Packaged embed host may lag / fail IPC — keep session in localStorage so login still works
        console.warn('[auth] electron save failed, using localStorage:', err?.message || err);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      }
    } else {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    }
  },
  getToken: async () => {
    if (window.electronAPI) {
      try {
        const t = await window.electronAPI.getToken();
        if (t) return t;
      } catch (_) {
        /* fall through */
      }
    }
    return localStorage.getItem('token');
  },
  getUser: async () => {
    if (window.electronAPI) {
      try {
        const u = await window.electronAPI.getUser();
        if (u) return u;
      } catch (_) {
        /* fall through */
      }
    }
    const userStr = localStorage.getItem('user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },
  clearAuth: async () => {
    if (window.electronAPI) {
      await window.electronAPI.clearToken();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  const logout = useCallback(async () => {
    await storage.clearAuth();
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
    clearInstanceLimitCache();
    if (!window.location.hash.includes('/login')) {
      window.location.hash = '/login';
    }
  }, []);

  const updateUser = useCallback(async (newUserData) => {
    try {
      const storedUser = await storage.getUser();
      const mergedPhone =
        normalizePhone(newUserData?.phone) ||
        normalizePhone(storedUser?.phone) ||
        storedUser?.phone;
      const updatedUser = {
        ...storedUser,
        ...newUserData,
        ...(mergedPhone ? { phone: mergedPhone } : {}),
      };

      if (
        newUserData?.instances !== undefined &&
        newUserData.instances !== storedUser?.instances
      ) {
        clearInstanceLimitCache()
      }

      setUser((prev) => {
        if (
          prev &&
          prev._id === updatedUser._id &&
          prev.id === updatedUser.id &&
          prev.phone === updatedUser.phone &&
          prev.instances === updatedUser.instances &&
          prev.isActive === updatedUser.isActive &&
          JSON.stringify(prev.activeLicense) === JSON.stringify(updatedUser.activeLicense)
        ) {
          return prev;
        }
        return updatedUser;
      });
      if (window.electronAPI) {
        await window.electronAPI.saveUser(updatedUser, updatedUser?.phone, { loadSessions: false });
      } else {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  }, []);

  const verifyProfile = useCallback(async () => {
    const response = await api.get('/user/profile');
    if (!response.data?.success || !response.data?.user) {
      const err = new Error(response.data?.message || 'User not found');
      err.response = { status: 404, data: { message: 'User not found' } };
      throw err;
    }
    assertBulkWhatsAppUser(response.data.user);
    await updateUser(response.data.user);
    return response.data.user;
  }, [updateUser]);

  // Initialize authentication state — only stay logged in if profile loads
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = await storage.getToken();

        if (!storedToken) {
          await storage.clearAuth();
          return;
        }

        setToken(storedToken);

        try {
          await verifyProfile();
          const storedUser = await storage.getUser();
          setUser(storedUser);
          setIsAuthenticated(true);
        } catch (apiError) {
          console.log('Auth verify failed:', apiError?.response?.data?.message || apiError.message);
          if (shouldLogoutOnAuthError(apiError) || apiError?.code === 'LICENSE_APP_MISMATCH') {
            await logout();
          } else if (!apiError?.response) {
            // Network blip: keep cached session like TextNexus
            const storedUser = await storage.getUser();
            if (storedUser) {
              setUser(storedUser);
              setIsAuthenticated(true);
            } else {
              await logout();
            }
          } else {
            await logout();
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        await logout();
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [logout, verifyProfile]);

  // Refresh profile while app is open (soft — do not bounce on license/network/type soft fails)
  useEffect(() => {
    if (!token || !isAuthenticated) return;

    let cancelled = false
    const refreshProfile = async () => {
      try {
        await verifyProfile()
      } catch (e) {
        if (cancelled) return;
        // Hard auth only — never kick out for LICENSE_APP_MISMATCH on background refresh
        // (stale profile type / race after login). User can still use the session.
        if (shouldLogoutOnAuthError(e)) {
          await logout();
        }
      }
    }

    // Defer first refresh so login navigation is not racing profile assert
    const start = window.setTimeout(() => {
      void refreshProfile();
    }, 2500);
    const interval = setInterval(refreshProfile, 30_000);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
      clearInterval(interval);
    };
  }, [token, isAuthenticated, logout, verifyProfile]);

  useEffect(() => {
    const onForceLogout = () => {
      logout();
    };
    window.addEventListener('auth:logout', onForceLogout)
    return () => window.removeEventListener('auth:logout', onForceLogout)
  }, [logout])

  const login = async (licenseKey, phone) => {
    try {
      const response = await api.post('/user/login-license', {
        licenseKey,
        phone,
        deviceType: 'software',
        appType: 'bulk-whatsapp',
      });

      if (response.data.success) {
        const { token: newToken, user: userData, refreshToken } = response.data;
        const normalizedPhone = String(phone || userData?.phone || '').replace(/\D/g, '');
        const userWithPhone = {
          ...userData,
          phone: normalizedPhone || userData?.phone,
          // Login already requested appType=bulk-whatsapp — fill if API omits type
          type: resolveUserAppType(userData) || REQUIRED_APP_TYPE,
        };
        assertBulkWhatsAppUser(userWithPhone);

        // Persist token BEFORE flipping React auth state (avoids race → false 401 logout)
        await storage.setAuth(newToken, userWithPhone, refreshToken, phone);

        setToken(newToken);
        setUser(userWithPhone);
        setIsAuthenticated(true);

        // Defer Baileys restore so login UI stays responsive
        window.setTimeout(() => {
          void window.electronAPI?.reloadWhatsAppSessions?.();
        }, 3500);

        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      token,
      loading,
      isInitialized,
      login,
      logout,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}
