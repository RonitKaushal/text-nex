import { jwtDecode } from 'jwt-decode';

/**
 * @typedef {Object} User
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} token
 */
 
// Enhanced cookie management for both dev and production
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production' || !window.location.hostname.includes('localhost');
  const hostname = window.location.hostname;
  
  return {
    expires: 30, // 30 days
    path: '/',
    secure: isProduction && hostname !== 'localhost', // Only secure in production
    sameSite: 'lax',
    // Don't set domain for localhost or file:// protocol
    ...(hostname !== 'localhost' && !hostname.includes('127.0.0.1') && hostname !== '' && {
      domain: hostname.startsWith('.') ? hostname : `.${hostname}`
    })
  };
};

// Enhanced storage keys for better organization
const STORAGE_KEYS = {
  AUTH_TOKEN: 'textnexus_auth_token',
  USER_EMAIL: 'textnexus_user_email', 
  USER_PHONE: 'textnexus_user_phone',
  AUTH_BACKUP: 'textnexus_auth_backup',
  AUTH_FALLBACK: 'textnexus_auth_fallback',
  SESSION_DATA: 'textnexus_session_data'
};

const auth = {
  // Check if user is authenticated with multiple fallbacks
  async isAuthenticated() {
    try {
      // Method 1: Check electron-store first (for Electron apps)
      if (window.electronAPI?.store) {
        try {
          const electronAuth = await window.electronAPI.store.get('auth');
          if (electronAuth && electronAuth.token && electronAuth.token.trim()) {
            console.log('🔐 Auth check - token found in electron-store');
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, electronAuth.token);
            if (electronAuth.email) localStorage.setItem(STORAGE_KEYS.USER_EMAIL, electronAuth.email);
            if (electronAuth.phone) localStorage.setItem(STORAGE_KEYS.USER_PHONE, electronAuth.phone);
            return true;
          }
        } catch (error) {
          console.warn('⚠️ Electron store auth check failed:', error);
        }
      }

      // Method 2: Check localStorage
      const localToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (localToken && localToken.trim()) {
        console.log('🔐 Auth check - token found in localStorage');
        return true;
      }

      // Method 3: Check sessionStorage
      const sessionToken = sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (sessionToken && sessionToken.trim()) {
        console.log('🔐 Auth check - token found in sessionStorage');
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, sessionToken);
        return true;
      }

      // Method 4: Check backup storage
      const backupData = localStorage.getItem(STORAGE_KEYS.AUTH_BACKUP);
      if (backupData) {
        try {
          const parsed = JSON.parse(backupData);
          const isRecent = (Date.now() - parsed.timestamp) < (30 * 24 * 60 * 60 * 1000); // 30 days
          
          if (isRecent && parsed.token && parsed.token.trim()) {
            console.log('🔐 Auth check - token found in backup');
            // Restore authentication
            this.setUser({
              token: parsed.token,
              email: parsed.email,
              phone: parsed.phone
            });
            return true;
          }
        } catch (error) {
          console.warn('⚠️ Could not parse auth backup:', error);
        }
      }

      console.log('❌ No valid authentication found');
      return false;
    } catch (error) {
      console.error('❌ Error checking authentication:', error);
      return false;
    }
  },

  // Get current user info with fallbacks
  async getCurrentUser() {
    try {
      // Try electron-store first (for Electron apps)
      if (window.electronAPI?.store) {
        try {
          const electronAuth = await window.electronAPI.store.get('auth');
          if (electronAuth && electronAuth.token && electronAuth.token.trim()) {
            console.log('👤 Current user found in electron-store');
            return {
              email: electronAuth.email,
              phone: electronAuth.phone,
              token: electronAuth.token
            };
          }
        } catch (error) {
          console.warn('⚠️ Electron store getCurrentUser failed:', error);
        }
      }

      // Try localStorage
      const localToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const localEmail = localStorage.getItem(STORAGE_KEYS.USER_EMAIL);
      const localPhone = localStorage.getItem(STORAGE_KEYS.USER_PHONE);
      
      if (localToken && localToken.trim()) {
        console.log('👤 Current user found in localStorage');
        return { 
          email: localEmail, 
          phone: localPhone, 
          token: localToken 
        };
      }

      // Try sessionStorage
      const sessionToken = sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const sessionEmail = sessionStorage.getItem(STORAGE_KEYS.USER_EMAIL);
      const sessionPhone = sessionStorage.getItem(STORAGE_KEYS.USER_PHONE);
      
      if (sessionToken && sessionToken.trim()) {
        console.log('👤 Current user found in sessionStorage');
        return { 
          email: sessionEmail, 
          phone: sessionPhone, 
          token: sessionToken 
        };
      }

      // Try backup
      const backupData = localStorage.getItem(STORAGE_KEYS.AUTH_BACKUP);
      if (backupData) {
        try {
          const parsed = JSON.parse(backupData);
          const isRecent = (Date.now() - parsed.timestamp) < (30 * 24 * 60 * 60 * 1000);
          
          if (isRecent && parsed.token && parsed.token.trim()) {
            console.log('👤 Current user found in backup');
            return {
              email: parsed.email,
              phone: parsed.phone,
              token: parsed.token
            };
          }
        } catch (error) {
          console.warn('⚠️ Could not parse user backup:', error);
        }
      }
      
      console.log('❌ No current user found');
      return null;
    } catch (error) {
      console.error('❌ Error getting current user:', error);
      return null;
    }
  },

  // Enhanced cookie getter
  getCookie(name) {
    try {
      if (typeof document === 'undefined') return null;
      
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        const cookieValue = parts.pop().split(';').shift();
        return cookieValue ? decodeURIComponent(cookieValue) : null;
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting cookie:', error);
      return null;
    }
  },

  // Enhanced cookie setter
  setCookie(name, value, options = {}) {
    try {
      if (typeof document === 'undefined') return false;
      
      const opts = { ...getCookieOptions(), ...options };
      let cookieString = `${name}=${encodeURIComponent(value)}`;
      
      if (opts.expires) {
        const date = new Date();
        date.setTime(date.getTime() + (opts.expires * 24 * 60 * 60 * 1000));
        cookieString += `; expires=${date.toUTCString()}`;
      }
      
      if (opts.path) cookieString += `; path=${opts.path}`;
      if (opts.domain) cookieString += `; domain=${opts.domain}`;
      if (opts.secure) cookieString += `; secure`;
      if (opts.sameSite) cookieString += `; samesite=${opts.sameSite}`;
      
      document.cookie = cookieString;
      
      // Verify cookie was set
      setTimeout(() => {
        const verification = this.getCookie(name);
        if (!verification) {
          console.warn(`⚠️ Cookie ${name} was not set properly`);
        } else {
          console.log(`✅ Cookie ${name} set successfully`);
        }
      }, 100);
      
      return true;
    } catch (error) {
      console.error('❌ Error setting cookie:', error);
      return false;
    }
  },

  // Set user session with comprehensive storage
  async setUser(userData) {
    try {
      console.log('💾 Setting user session:', { 
        email: userData.email, 
        phone: userData.phone, 
        hasToken: !!userData.token 
      });
      
      if (!userData.token || !userData.token.trim()) {
        console.error('❌ No token provided to setUser');
        return false;
      }

      const timestamp = Date.now();
      
      // Method 1: Store in electron-store first (for Electron apps)
      if (window.electronAPI?.store) {
        try {
          const authData = {
            token: userData.token,
            email: userData.email,
            phone: userData.phone,
            timestamp: timestamp,
            userAgent: navigator.userAgent,
            url: window.location.href
          };
          await window.electronAPI.store.set('auth', authData);
          console.log('✅ Auth data stored in electron-store');
        } catch (electronStoreError) {
          console.warn('⚠️ Electron store failed:', electronStoreError);
        }
      }
      
      // Method 2: localStorage storage
      try {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, userData.token);
        if (userData.email) localStorage.setItem(STORAGE_KEYS.USER_EMAIL, userData.email);
        if (userData.phone) localStorage.setItem(STORAGE_KEYS.USER_PHONE, userData.phone);
        console.log('✅ Auth data stored in localStorage');
      } catch (localStorageError) {
        console.warn('⚠️ localStorage failed:', localStorageError);
      }

      // Method 3: sessionStorage storage
      try {
        sessionStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, userData.token);
        if (userData.email) sessionStorage.setItem(STORAGE_KEYS.USER_EMAIL, userData.email);
        if (userData.phone) sessionStorage.setItem(STORAGE_KEYS.USER_PHONE, userData.phone);
        console.log('✅ Auth data stored in sessionStorage');
      } catch (sessionStorageError) {
        console.warn('⚠️ sessionStorage failed:', sessionStorageError);
      }

      // Method 4: Backup storage
      try {
        const backupData = {
          token: userData.token,
          email: userData.email,
          phone: userData.phone,
          timestamp: timestamp,
          userAgent: navigator.userAgent,
          url: window.location.href
        };
        localStorage.setItem(STORAGE_KEYS.AUTH_BACKUP, JSON.stringify(backupData));
        console.log('✅ Auth backup created');
      } catch (backupError) {
        console.warn('⚠️ Backup storage failed:', backupError);
      }

      // Method 6: Session data for debugging
      try {
        const sessionData = {
          loginTime: timestamp,
          userAgent: navigator.userAgent,
          url: window.location.href
        };
        localStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(sessionData));
      } catch (sessionError) {
        console.warn('⚠️ Session data storage failed:', sessionError);
      }

      // Final verification after delay
      setTimeout(async () => {
        const verification = await this.isAuthenticated();
        console.log('🔍 Final auth verification:', verification);
        
        if (!verification) {
          console.error('❌ Authentication verification failed after setUser');
          // Try one more time with different approach
          this.emergencyAuthRestore(userData);
        } else {
          console.log('✅ User session set successfully');
        }
      }, 500);
      
      return true;
    } catch (error) {
      console.error('❌ Error setting user session:', error);
      return false;
    }
  },

  // Emergency auth restore for production builds
  emergencyAuthRestore(userData) {
    try {
      console.log('🚨 Emergency auth restore initiated');
      
      // Force localStorage
      Object.keys(STORAGE_KEYS).forEach(key => {
        try {
          if (key.includes('TOKEN')) localStorage.setItem(STORAGE_KEYS[key], userData.token);
          if (key.includes('EMAIL') && userData.email) localStorage.setItem(STORAGE_KEYS[key], userData.email);
          if (key.includes('PHONE') && userData.phone) localStorage.setItem(STORAGE_KEYS[key], userData.phone);
        } catch (e) {
          console.warn(`Failed to set ${key}:`, e);
        }
      });
      
      console.log('🚨 Emergency auth restore completed');
    } catch (error) {
      console.error('❌ Emergency auth restore failed:', error);
    }
  },

  // Clear user session completely
  async logout() {
    try {
      console.log('🚪 Logging out user');
      
      // Clear electron-store first (for Electron apps)
      if (window.electronAPI?.store) {
        try {
          await window.electronAPI.store.delete('auth');
          console.log('✅ Auth data cleared from electron-store');
        } catch (electronStoreError) {
          console.warn('⚠️ Electron store clear failed:', electronStoreError);
        }
      }
      
      // Clear localStorage
      Object.values(STORAGE_KEYS).forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove ${key} from localStorage:`, e);
        }
      });
      
      // Clear sessionStorage
      Object.values(STORAGE_KEYS).forEach(key => {
        try {
          sessionStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove ${key} from sessionStorage:`, e);
        }
      });
      
      // Clear any additional auth-related items
      try {
        const allLocalStorageKeys = Object.keys(localStorage);
        allLocalStorageKeys.forEach(key => {
          if (key.includes('textnexus') || key.includes('auth') || key.includes('token')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn('Failed to clear additional localStorage items:', e);
      }
      
      console.log('✅ Logout completed');
      return true;
    } catch (error) {
      console.error('❌ Error during logout:', error);
      return false;
    }
  },

  // Get auth token with fallbacks
  async getToken() {
    try {
      // Try electron-store first (for Electron apps)
      if (window.electronAPI?.store) {
        try {
          const electronAuth = await window.electronAPI.store.get('auth');
          if (electronAuth && electronAuth.token && electronAuth.token.trim()) {
            return electronAuth.token;
          }
        } catch (error) {
          console.warn('⚠️ Electron store getToken failed:', error);
        }
      }
      
      // Try localStorage
      const localToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (localToken && localToken.trim()) return localToken;
      
      // Try sessionStorage
      const sessionToken = sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (sessionToken && sessionToken.trim()) return sessionToken;
      
      // Try backup
      const backupData = localStorage.getItem(STORAGE_KEYS.AUTH_BACKUP);
      if (backupData) {
        try {
          const parsed = JSON.parse(backupData);
          if (parsed.token && parsed.token.trim()) return parsed.token;
        } catch (e) {
          console.warn('Failed to parse backup token:', e);
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting token:', error);
      return null;
    }
  },

  async verifySession() {
    try {
      const token = await this.getToken();
      if (!token || !token.trim()) {
        return null;
      }

      const decoded = jwtDecode(token);
      if (!decoded || typeof decoded !== 'object') {
        return null;
      }

      const payload = decoded;
      const exp = payload.exp;

      // JWT time expiry: still return payload so callers can keep the app
      // session and handle license UI — do not treat as hard logout.
      const jwtExpired =
        typeof exp === 'number' && Date.now() / 1000 > exp;

      return {
        id: payload.id,
        licenseExpiry: payload.licenseExpiry,
        jwtExpired,
      };
    } catch (error) {
      console.warn('⚠️ Session verification failed:', error);
      return null;
    }
  },

  // Enhanced authentication check for production
  async isAuthenticatedEnhanced() {
    return await this.isAuthenticated();
  },

  // Enhanced getCurrentUser for production
  async getCurrentUserEnhanced() {
    return await this.getCurrentUser();
  },

  // Debug function to check auth state
  async debugAuthState() {
    console.log('🔍 Auth Debug State:');
    
    // Check electron-store
    if (window.electronAPI?.store) {
      try {
        const electronAuth = await window.electronAPI.store.get('auth');
        console.log('electron-store:', electronAuth);
      } catch (error) {
        console.log('electron-store: Error -', error);
      }
    } else {
      console.log('electron-store: Not available');
    }
    
    console.log('localStorage:', {
      auth_token: localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
      user_email: localStorage.getItem(STORAGE_KEYS.USER_EMAIL),
      user_phone: localStorage.getItem(STORAGE_KEYS.USER_PHONE)
    });
    console.log('sessionStorage:', {
      auth_token: sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
      user_email: sessionStorage.getItem(STORAGE_KEYS.USER_EMAIL),
      user_phone: sessionStorage.getItem(STORAGE_KEYS.USER_PHONE)
    });
    console.log('isAuthenticated:', await this.isAuthenticated());
    console.log('getCurrentUser:', await this.getCurrentUser());
  }
};

export default auth;
