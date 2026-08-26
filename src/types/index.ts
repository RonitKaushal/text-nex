/** Shared domain types for ArcticSwitch */

export type ServiceIconType = string;

export interface ServiceTab {
  id: string;
  name: string;
  type: 'whatsapp' | 'telegram' | 'ssh' | string;
  iconType: ServiceIconType;
  partition: string;
  workspaceId: string;
  /** Custom page URL (overrides serviceConfig url) */
  url?: string;
  /** Custom icon as data URL / absolute URL */
  customIcon?: string;
  /** Service renderer kind */
  kind?: 'webview' | 'ssh' | 'bulk-wa' | 'lead-gen';
  ssh?: SshHostConfig;
  isLocked?: boolean;
  /** @deprecated plaintext — migrated to lockPasswordHash */
  lockPassword?: string;
  /** Salted SHA-256 hash (`saltHex:hashHex`) */
  lockPasswordHash?: string;
}

export interface SshHostConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  /** Reference to saved keychain entry */
  keyId?: string;
}

export interface SshKeychainEntry {
  id: string;
  label: string;
  privateKey: string;
  publicKey?: string;
  passphrase?: string;
  createdAt: number;
}

export interface ServiceCategoryDef {
  key: string;
  label: string;
  /** Optional custom icon (data URL). If missing, default icon is used. */
  iconSrc?: string;
}

export interface CatalogService {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
  color: string;
  /** data URL or imported asset path */
  iconSrc?: string;
  builtIn?: boolean;
}

export interface AddServiceOptions {
  url?: string;
  customIcon?: string;
  kind?: 'webview' | 'ssh' | 'bulk-wa' | 'lead-gen';
  ssh?: SshHostConfig;
}

export interface UpdateServicePayload {
  name?: string;
  customIcon?: string;
  url?: string;
}

export interface Workspace {
  id: string;
  name: string;
  services: ServiceTab[];
  createdAt: number;
}

export interface LicenseInfo {
  id: string;
  key: string;
  /** Plan tier for Pro gate (basic | pro) */
  type: string;
  plan?: string;
  appType?: string;
  status: string;
  activateAt: string;
  expireAt: string;
  valid: number;
  isExpired: boolean;
  createdAt?: string;
}

export interface DeviceInfo {
  deviceId: string;
  deviceType: string;
  ip: string;
  lastActive: string;
}

export interface UserProfile {
  id: string;
  email: string;
  phone: number | string;
  isActive: boolean;
  instances?: number;
  allowBoth?: boolean;
  /** App product: bulk-whatsapp | lead-gen | text-next */
  type?: string;
  /** Subscription: basic | pro */
  plan?: string;
  software?: boolean;
  mobile?: boolean;
  licenseExpired?: boolean;
  activeLicense?: LicenseInfo;
  allLicenses?: LicenseInfo[];
  device?: DeviceInfo;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthUser {
  token: string;
  email?: string;
  phone?: string;
}

export type LicenseError = 'none' | 'network';

export interface ElectronStoreAPI {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<boolean>;
  delete: (key: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getAppName: () => Promise<string>;
  downloadAppUpdate?: (payload: {
    downloadUrl: string;
    version?: string;
  }) => Promise<{ ok: boolean; destPath?: string; version?: string; error?: string }>;
  setAppBadgeCount?: (count: number) => Promise<boolean>;
  onAppUpdateProgress?: (
    callback: (data: {
      status?: string;
      percent?: number;
      destPath?: string;
      version?: string;
      received?: number;
      total?: number;
    }) => void
  ) => () => void;
  onServiceUnread?: (
    callback: (data: { serviceId: string; count: number }) => void
  ) => () => void;
  onServiceUnreadInbox?: (
    callback: (data: {
      serviceId: string;
      chats: Array<{ name: string; unread: number; preview?: string; icon?: string }>;
    }) => void
  ) => () => void;
  getUserAgent: (serviceType?: string) => Promise<string>;
  getWhatsAppUserAgent: () => Promise<string>;
  platform: string;
  isElectron: boolean;
  showNotification: (data: NotificationPayload) => Promise<boolean>;
  clearNotifications: (serviceId: string) => Promise<boolean>;
  getNotificationsEnabled?: () => Promise<boolean>;
  setNotificationsEnabled?: (enabled: boolean) => Promise<boolean>;
  getNotificationsAfterClose?: () => Promise<boolean>;
  setNotificationsAfterClose?: (enabled: boolean) => Promise<boolean>;
  getWebviewPreloadPath?: (serviceType?: string) => Promise<string>;
  reloadService: (serviceId: string) => Promise<boolean>;
  toggleService: (serviceId: string, enabled: boolean) => Promise<boolean>;
  toggleServiceNotifications: (serviceId: string, enabled: boolean) => Promise<boolean>;
  onSwitchToService: (
    callback: (event: unknown, serviceId: string, chatName?: string) => void
  ) => void;
  onServiceSwitcher?: (
    callback: (payload: {
      action: 'cycle' | 'release' | 'cancel';
      direction?: 1 | -1;
    }) => void
  ) => () => void;
  onGlobalSearch?: (
    callback: (payload: { action: 'toggle' | 'open' | 'close' }) => void
  ) => () => void;
  onOpenNotificationChat?: (
    callback: (data: { serviceId: string; chatName: string }) => void
  ) => () => void;
  onReloadService: (callback: (event: unknown, serviceId: string) => void) => void;
  onToggleService: (callback: (event: unknown, serviceId: string, enabled: boolean) => void) => void;
  onToggleServiceNotifications: (callback: (event: unknown, serviceId: string, enabled: boolean) => void) => void;
  onSendReply: (callback: (event: unknown, serviceId: string, reply: string) => void) => void;
  onOpenInAppTab: (callback: (data: { url: string; guestId: number }) => void) => () => void;
  windowMinimize: () => Promise<boolean>;
  windowMaximize: () => Promise<boolean>;
  windowClose: () => Promise<boolean>;
  windowIsMaximized: () => Promise<boolean>;
  windowToggleFullscreen: () => Promise<boolean>;
  windowIsFullscreen: () => Promise<boolean>;
  openNewWindow: (url: string) => Promise<boolean>;
  popoutService: (payload: PopoutServicePayload) => Promise<boolean>;
  bringBackService: (serviceId: string) => Promise<boolean>;
  getPopoutPayload: (serviceId: string) => Promise<PopoutServicePayload | null>;
  onWindowMaximizedChanged: (callback: (maximized: boolean) => void) => () => void;
  onWindowFullscreenChanged: (callback: (fullscreen: boolean) => void) => () => void;
  onServicePoppedOut: (callback: (serviceId: string) => void) => () => void;
  onServiceBroughtBack: (callback: (serviceId: string) => void) => () => void;
  store: ElectronStoreAPI;
  sshConnect?: (
    sessionId: string,
    config: SshHostConfig
  ) => Promise<{ ok: boolean; error?: string }>;
  sshDisconnect?: (sessionId: string) => Promise<boolean>;
  sshWrite?: (sessionId: string, data: string) => Promise<boolean>;
  sshResize?: (
    sessionId: string,
    size: { cols: number; rows: number }
  ) => Promise<boolean>;
  onSshData?: (
    callback: (payload: { sessionId: string; data: string }) => void
  ) => () => void;
  onSshStatus?: (
    callback: (payload: {
      sessionId: string;
      status: 'connecting' | 'connected' | 'error' | 'closed';
      error?: string;
    }) => void
  ) => () => void;
  bulkWhatsAppStatus?: () => Promise<{
    installed: boolean;
    ready?: boolean;
    hostStarted?: boolean;
    path: string | null;
    url?: string | null;
    preload?: string | null;
    error?: string | null;
    dir: string | null;
  }>;
  bulkWhatsAppInstall?: () => Promise<{
    ok: boolean;
    already?: boolean;
    path?: string | null;
    error?: string;
  }>;
  bulkWhatsAppLaunch?: () => Promise<{ ok: boolean; path?: string; error?: string }>;
  leadGenStatus?: () => Promise<{
    installed: boolean;
    ready?: boolean;
    hostStarted?: boolean;
    port?: number | null;
    url?: string | null;
    error?: string | null;
    dir?: string | null;
  }>;
  leadGenInstall?: () => Promise<{
    ok: boolean;
    already?: boolean;
    url?: string;
    port?: number;
    error?: string;
  }>;
  leadGenLaunch?: () => Promise<{ ok: boolean; url?: string; error?: string }>;
}

export interface PopoutServicePayload {
  serviceId: string;
  name: string;
  url: string;
  iconType: string;
  partition: string;
  customIcon?: string;
}

export interface NotificationPayload {
  serviceId: string;
  serviceName?: string;
  serviceType?: string;
  title?: string;
  body?: string;
  icon?: string;
  /** Contact / chat to open when the notification is clicked */
  chatName?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    licenseExpired?: boolean;
  }
}

export {};
