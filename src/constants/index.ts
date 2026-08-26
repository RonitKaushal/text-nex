export const APP_NAME = 'ArcticSwitch';
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
  USERNAME: 'arcticswitch_username',
} as const;

export const MESSAGES = {
  LOADING_APP: 'Starting ArcticSwitch',
  VERIFYING_LICENSE: 'Verifying your license',
  NETWORK_ISSUE_TITLE: 'Can’t reach the server',
  NETWORK_ISSUE_BODY:
    'ArcticSwitch couldn’t verify your license right now. Check your internet connection, then try again.',
  LICENSE_EXPIRED_TITLE: 'License Expired',
  LICENSE_EXPIRED_BODY:
    'Your license has expired. Please renew your license to continue using ArcticSwitch services. All services have been disabled until renewal.',
  WELCOME_TITLE: 'Welcome to ArcticSwitch',
  LOGIN_SUCCESS: 'Login successful!',
  LOGIN_FAILED: 'Login failed. Invalid credentials.',
} as const;

export const COLORS = {
  /** Accent — white on dark chrome (use accentColor() when light mode matters). */
  PRIMARY: '#ffffff',
  /** Soft fill for hover / selected states. */
  PRIMARY_SOFT: 'rgba(255, 255, 255, 0.12)',
  /** Soft border for focus / selected states. */
  PRIMARY_SOFT_BORDER: 'rgba(255, 255, 255, 0.28)',
  PRIMARY_GRADIENT: 'linear-gradient(135deg, #ffffff 0%, #d9d9d9 55%, #b0b0b0 100%)',
  /** Kept for legacy imports — monochrome only. */
  WHATSAPP: '#ffffff',
  /** Solid black dark theme. */
  APP_BG_BASE: '#000000',
  APP_BG_GLOW: '#111111',
  APP_BG_DEEP: '#000000',
  APP_BG_PANEL: '#0f0f0f',
  APP_BG_ELEVATED: '#1a1a1a',
  APP_BORDER: '#2a2a2a',
  APP_ICON_BTN: 'rgba(255, 255, 255, 0.08)',
} as const;

/** Primary accent that stays readable in dark and light chrome. */
export const accentColor = (isDarkMode: boolean) => (isDarkMode ? '#ffffff' : '#111111');

/** Soft accent fill for dark/light chrome. */
export const accentSoft = (isDarkMode: boolean) =>
  isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)';

/** Soft accent border for dark/light chrome. */
export const accentSoftBorder = (isDarkMode: boolean) =>
  isDarkMode ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.18)';

/** Primary button fill — solid B/W, no colored gradients. */
export const accentButtonBg = (isDarkMode: boolean) => (isDarkMode ? '#ffffff' : '#111111');

/** Text on primary buttons. */
export const accentButtonFg = (isDarkMode: boolean) => (isDarkMode ? '#111111' : '#ffffff');


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
