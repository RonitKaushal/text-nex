import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AxiosError } from 'axios';
import auth from '../utils/auth';
import { userApi, clearProfileCache } from '../api/userApi';
import {
  connectUserSocket,
  disconnectUserSocket,
} from '../services/socket';
import { isLicenseExpired } from '../utils/licenseStatus';
import type { LicenseError, UserProfile } from '../types';

const PROFILE_CACHE_KEY = 'textnexus_user_profile';

interface AuthContextValue {
  isAuthenticated: boolean;
  isCheckingLicense: boolean;
  licenseExpired: boolean;
  licenseError: LicenseError;
  userProfile: UserProfile | null;
  checkAuth: () => Promise<void>;
  checkLicenseStatus: () => Promise<void>;
  /** Refresh profile without blocking the whole app behind the license splash. */
  refreshProfile: (force?: boolean) => Promise<UserProfile | null>;
  handleLoginSuccess: () => Promise<void>;
  /** Clear session and return to the login screen. */
  logout: () => Promise<void>;
  setLicenseExpired: (value: boolean) => void;
  renewLicense: (licenseKey: string) => Promise<{
    success: boolean;
    message?: string;
    licenseExpiry?: string;
  }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function setGlobalLicenseFlag(expired: boolean) {
  window.licenseExpired = expired;
}

async function loadCachedProfile(): Promise<UserProfile | null> {
  try {
    if (window.electronAPI?.store) {
      const stored = await window.electronAPI.store.get('userProfile');
      if (stored && typeof stored === 'object' && (stored as UserProfile).id) {
        return stored as UserProfile;
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

async function saveCachedProfile(profile: UserProfile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
  try {
    if (window.electronAPI?.store) {
      await window.electronAPI.store.set('userProfile', profile);
    }
  } catch {
    /* ignore */
  }
}

async function clearCachedProfile() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    /* ignore */
  }
  try {
    if (window.electronAPI?.store) {
      await window.electronAPI.store.delete('userProfile');
    }
  } catch {
    /* ignore */
  }
}

function isUserNotFound(error: unknown): boolean {
  const axiosError = error as AxiosError<{ message?: string }>;
  const status = axiosError?.response?.status;
  const msg = String(axiosError?.response?.data?.message || '').toLowerCase();
  return status === 404 || msg.includes('user not found');
}

function isAuthHardFailure(error: unknown): boolean {
  const axiosError = error as AxiosError<{ message?: string; code?: string }>;
  const status = axiosError?.response?.status;
  const msg = String(axiosError?.response?.data?.message || '').toLowerCase();

  // Deleted / missing account → Login (not License Expired)
  if (isUserNotFound(error)) return true;

  if (status !== 401 && status !== 403) return false;
  // License expiry must NOT force re-login
  if (msg.includes('license') || msg.includes('expired') || msg.includes('renew')) {
    return false;
  }
  if (msg.includes('invalid token') || msg.includes('unauthorized') || msg.includes('jwt')) {
    return true;
  }
  // Soft: keep session; AuthContext will mark license expired from cache/profile
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [licenseExpired, setLicenseExpiredState] = useState(false);
  const [isCheckingLicense, setIsCheckingLicense] = useState(true);
  const [licenseError, setLicenseError] = useState<LicenseError>('none');

  const setLicenseExpired = useCallback((value: boolean) => {
    setLicenseExpiredState(value);
    setGlobalLicenseFlag(value);
  }, []);

  const applyProfilePayload = useCallback(
    (payload: UserProfile & { licenseExpired?: boolean }) => {
      setUserProfile(payload);
      setLicenseExpired(isLicenseExpired(payload));
      void saveCachedProfile(payload);
    },
    [setLicenseExpired]
  );

  const applyCachedAsExpired = useCallback(
    async (cached?: UserProfile | null) => {
      const profile = cached ?? (await loadCachedProfile());
      if (profile) {
        applyProfilePayload({ ...profile, licenseExpired: true });
      } else {
        setLicenseExpired(true);
      }
    },
    [applyProfilePayload, setLicenseExpired]
  );

  const forceLogoutToLogin = useCallback(async () => {
    disconnectUserSocket();
    clearProfileCache();
    await clearCachedProfile();
    await auth.logout();
    setUserProfile(null);
    setIsAuthenticated(false);
    setLicenseExpired(false);
    setLicenseError('none');
  }, [setLicenseExpired]);

  const refreshProfile = useCallback(
    async (force = false) => {
      const response = await userApi.getProfile({ force });
      const payload =
        response.data?.user || (response.data as unknown as UserProfile);
      if (!payload || !(payload as UserProfile).id) {
        throw new Error(
          (response.data as { message?: string })?.message || 'Failed to load profile'
        );
      }
      applyProfilePayload(payload as UserProfile & { licenseExpired?: boolean });
      return payload as UserProfile;
    },
    [applyProfilePayload]
  );

  const checkLicenseStatus = useCallback(async () => {
    setIsCheckingLicense(true);
    setLicenseError('none');
    try {
      const user = await auth.getCurrentUser();
      if (!user?.token) {
        setIsAuthenticated(false);
        setIsCheckingLicense(false);
        return;
      }

      // Token present ⇒ stay on app chrome (never bounce to Login for license)
      setIsAuthenticated(true);

      const response = await userApi.getProfile({ force: false });
      const payload = response.data?.user || (response.data as unknown as UserProfile);

      if (!payload || !(payload as UserProfile).id) {
        await forceLogoutToLogin();
        setIsCheckingLicense(false);
        return;
      }

      applyProfilePayload(payload as UserProfile & { licenseExpired?: boolean });
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      if (!axiosError?.response) {
        setLicenseError('network');
        const cached = await loadCachedProfile();
        if (cached) {
          applyProfilePayload(cached);
        }
      } else if (isAuthHardFailure(error)) {
        await forceLogoutToLogin();
      } else {
        // 401/403 from expired license (or soft auth) — keep session, block services
        setLicenseError('none');
        await applyCachedAsExpired();
      }
    } finally {
      setIsCheckingLicense(false);
    }
  }, [applyProfilePayload, applyCachedAsExpired, forceLogoutToLogin]);

  const checkAuth = useCallback(async () => {
    const authenticated = await auth.isAuthenticated();

    if (!authenticated) {
      disconnectUserSocket();
      clearProfileCache();
      await clearCachedProfile();
      setUserProfile(null);
      setIsAuthenticated(false);
      setLicenseExpired(false);
      setIsCheckingLicense(false);
      setLicenseError('none');
      return;
    }

    // Have a stored token → always enter the app. JWT/license issues are handled
    // inside checkLicenseStatus (expired UI), not by showing Login.
    setIsAuthenticated(true);
    setLicenseError('none');

    // Soft JWT check — never logout here; license UI is handled below
    await auth.verifySession();

    await checkLicenseStatus();
  }, [checkLicenseStatus, setLicenseExpired]);

  const handleLoginSuccess = useCallback(async () => {
    clearProfileCache();
    setIsAuthenticated(true);
    setLicenseError('none');
    setLicenseExpired(false);
    await checkLicenseStatus();
  }, [checkLicenseStatus, setLicenseExpired]);

  const renewLicense = useCallback(
    async (licenseKey: string) => {
      const response = await userApi.renewLicense(licenseKey);
      if (response.data?.success) {
        setLicenseExpired(false);
        try {
          await refreshProfile(true);
        } catch {
          /* renew succeeded; profile refresh can retry later */
        }
      }
      return {
        success: !!response.data?.success,
        message: response.data?.message,
        licenseExpiry: response.data?.licenseExpiry,
      };
    },
    [refreshProfile, setLicenseExpired]
  );

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  /** Silent profile pull — does NOT flash the license splash loader. */
  const silentRefreshLicense = useCallback(async (force = false) => {
    try {
      const user = await auth.getCurrentUser();
      if (!user?.token) return;

      const response = await userApi.getProfile({ force });
      const payload =
        response.data?.user || (response.data as unknown as UserProfile);

      if (!payload || !(payload as UserProfile).id) {
        await forceLogoutToLogin();
        return;
      }

      applyProfilePayload(payload as UserProfile & { licenseExpired?: boolean });
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      if (!axiosError?.response) {
        // Keep last known state on network blip
        return;
      }
      if (isAuthHardFailure(error)) {
        await forceLogoutToLogin();
        return;
      }
      // Soft 401/403 (often expired license) → block services immediately
      await applyCachedAsExpired();
    }
  }, [applyProfilePayload, applyCachedAsExpired, forceLogoutToLogin]);

  // Realtime local expiry: the moment expireAt passes, flip UI (no reload)
  useEffect(() => {
    if (!isAuthenticated || !userProfile || licenseExpired) return;

    const tick = () => {
      if (isLicenseExpired(userProfile)) {
        setLicenseExpired(true);
        void saveCachedProfile({ ...userProfile, licenseExpired: true });
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, userProfile, licenseExpired, setLicenseExpired]);

  // Socket.IO: live license/profile updates (replaces 60s profile API polling)
  useEffect(() => {
    if (!isAuthenticated || isCheckingLicense) return;

    let cancelled = false;
    let socketCleanup: (() => void) | undefined;
    let debounce: number | undefined;

    (async () => {
      const token = await auth.getToken();
      if (!token || cancelled) return;

      const socket = connectUserSocket(token);
      if (!socket || cancelled) return;

      const onLicenseUpdated = () => {
        if (debounce) window.clearTimeout(debounce);
        debounce = window.setTimeout(() => {
          void silentRefreshLicense(true);
        }, 400);
      };

      let firstConnect = true;
      const onConnect = () => {
        // Skip the initial connect — AuthContext already loaded profile at login.
        // Only re-sync after reconnect (events may have been missed offline).
        if (firstConnect) {
          firstConnect = false;
          return;
        }
        onLicenseUpdated();
      };

      socket.on('user:license-updated', onLicenseUpdated);
      socket.on('connect', onConnect);

      socketCleanup = () => {
        if (debounce) window.clearTimeout(debounce);
        socket.off('user:license-updated', onLicenseUpdated);
        socket.off('connect', onConnect);
      };
    })();

    // Rare safety net only — realtime socket is the primary path
    const safetyId = window.setInterval(() => {
      void silentRefreshLicense(false);
    }, 5 * 60_000);

    const onFocus = () => {
      void silentRefreshLicense(false);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void silentRefreshLicense(false);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      socketCleanup?.();
      window.clearInterval(safetyId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, isCheckingLicense, silentRefreshLicense]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isCheckingLicense,
      licenseExpired,
      licenseError,
      userProfile,
      checkAuth,
      checkLicenseStatus,
      refreshProfile,
      handleLoginSuccess,
      logout: forceLogoutToLogin,
      setLicenseExpired,
      renewLicense,
    }),
    [
      isAuthenticated,
      isCheckingLicense,
      licenseExpired,
      licenseError,
      userProfile,
      checkAuth,
      checkLicenseStatus,
      refreshProfile,
      handleLoginSuccess,
      forceLogoutToLogin,
      setLicenseExpired,
      renewLicense,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
