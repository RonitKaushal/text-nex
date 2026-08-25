export const APP_NAME = 'TextNexus';
export const APP_VERSION = '6.1.0';

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'https://api.textnexus.in/api'
).trim();

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'textnexus_auth_token',
  USER_EMAIL: 'textnexus_user_email',
  USER_PHONE: 'textnexus_user_phone',
  AUTH_BACKUP: 'textnexus_auth_backup',
  AUTH_FALLBACK: 'textnexus_auth_fallback',
  SESSION_DATA: 'textnexus_session_data',
  WORKSPACES: 'workspaces',
  ACTIVE_TAB: 'activeTab',
  ACTIVE_WORKSPACE: 'activeWorkspace',
  SIDEBAR_COLLAPSED: 'sidebarCollapsed',
  IS_DARK_MODE: 'isDarkMode',
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  NOTIFICATIONS_AFTER_CLOSE: 'notificationsAfterClose',
  DISABLED_SERVICES: 'disabledServices',
} as const;

export const MESSAGES = {
  LOADING_APP: 'Starting TextNexus',
  VERIFYING_LICENSE: 'Verifying your license',
  NETWORK_ISSUE_TITLE: 'Can’t reach the server',
  NETWORK_ISSUE_BODY:
    'TextNexus couldn’t verify your license right now. Check your internet connection, then try again.',
  LICENSE_EXPIRED_TITLE: 'License Expired',
  LICENSE_EXPIRED_BODY:
    'Your license has expired. Please renew your license to continue using TextNexus services. All services have been disabled until renewal.',
  WELCOME_TITLE: 'Welcome to TextNexus',
  LOGIN_SUCCESS: 'Login successful!',
  LOGIN_FAILED: 'Login failed. Invalid credentials.',
} as const;

export const COLORS = {
  PRIMARY: '#8b7cf6',
  /** Soft fill for light mode hover / selected states. */
  PRIMARY_SOFT: '#f0edff',
  /** Soft border for light mode focus / selected states. */
  PRIMARY_SOFT_BORDER: '#ddd6fe',
  PRIMARY_GRADIENT:
    'linear-gradient(135deg, #a99bf8 0%, #8b7cf6 55%, #6f5ee0 100%)',
  WHATSAPP: '#25D366',
  /** Solid black dark theme. */
  APP_BG_BASE: '#000000',
  APP_BG_GLOW: '#111111',
  APP_BG_DEEP: '#000000',
  APP_BG_PANEL: '#0f0f0f',
  APP_BG_ELEVATED: '#1a1a1a',
  APP_BORDER: '#2a2a2a',
  APP_ICON_BTN: 'rgba(255, 255, 255, 0.08)',
} as const;

/** App UI font — Gilroy with sensible system fallbacks. */
export const FONT_FAMILY =
  "'Gilroy', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Monospace stacks for terminals, code, and shortcuts. */
export const FONT_FAMILY_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Full-app dark background — black. */
export const APP_BG_GRADIENT =
  'radial-gradient(ellipse 120% 80% at 40% 0%, #111111 0%, #000000 50%, #000000 100%)';

/** Sidebar / header strip — black. */
export const APP_SIDEBAR_BG = '#000000';

/** Top chrome height — logo strip, workspace header, and app title bar must match. */
export const APP_TOP_BAR_HEIGHT = 52;

export const DEFAULT_WINDOW = {
  WIDTH: 1400,
  HEIGHT: 900,
  MIN_WIDTH: 1200,
  MIN_HEIGHT: 800,
} as const;

/** Max workspaces a user can create. */
export const MAX_WORKSPACES = 10;
