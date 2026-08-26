import { ipcMain, app, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './channels.js';
import userAgent, { getUserAgentForService, getWhatsAppUserAgent } from '../utils/userAgent.js';
import {
  sshConnect,
  sshDisconnect,
  sshWrite,
  sshResize,
} from '../ssh/sessions.js';
import {
  bulkWhatsAppStatus,
  bulkWhatsAppInstall,
  bulkWhatsAppLaunch,
} from '../apps/bulkWhatsApp.js';
import {
  leadGenStatus,
  leadGenInstall,
  leadGenLaunch,
} from '../apps/leadGen.js';
import { downloadAndInstallUpdate } from '../apps/appUpdate.js';

/**
 * Register core IPC handlers (extracted from main for maintainability).
 * Preserves existing store backup / verify behavior.
 * @param {{ getMainWindow: Function, store: object, notificationManager: object, popout?: { open: Function, bringBack: Function, getPayload: Function }, getWebviewPreloadPath?: Function }} deps
 */
export function registerIpcHandlers({ getMainWindow, store, notificationManager, popout, getWebviewPreloadPath }) {
  // Bulk WhatsApp embed host is started from app.whenReady / first Install call
  ipcMain.handle(IPC_CHANNELS.GET_USER_AGENT, (_event, serviceType) => {
    if (serviceType) return getUserAgentForService(serviceType);
    return userAgent();
  });

  ipcMain.handle(IPC_CHANNELS.GET_WHATSAPP_USER_AGENT, () => getWhatsAppUserAgent());
  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => app.getVersion());
  ipcMain.handle(IPC_CHANNELS.GET_APP_NAME, () => app.getName());

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_APP_UPDATE, async (_event, payload) => {
    try {
      const downloadUrl = payload?.downloadUrl;
      const version = payload?.version;
      if (!downloadUrl) {
        return { ok: false, error: 'Missing download URL' };
      }
      const result = await downloadAndInstallUpdate({ downloadUrl, version });
      return result;
    } catch (error) {
      console.error('[app-update] download failed:', error);
      return {
        ok: false,
        error: error?.message || 'Download failed',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SET_APP_BADGE_COUNT, (_event, count) => {
    try {
      const n = Math.max(0, Math.floor(Number(count) || 0));
      if (typeof app.setBadgeCount === 'function') {
        app.setBadgeCount(n);
      }
      return true;
    } catch {
      return false;
    }
  });

  // Guest webviews report unread counts → forward to all renderer windows
  ipcMain.on('guest-unread', (_event, data) => {
    try {
      const payload = {
        serviceId: data?.serviceId,
        count: Math.max(0, Math.floor(Number(data?.count) || 0)),
      };
      if (!payload.serviceId) return;
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('service-unread', payload);
        }
      }
    } catch (e) {
      console.warn('[unread] forward failed:', e?.message || e);
    }
  });

  // Per-chat unread inbox (WhatsApp + soft scrapers) → renderer
  ipcMain.on('guest-unread-inbox', (_event, data) => {
    try {
      const serviceId = data?.serviceId;
      if (!serviceId) return;
      const raw = Array.isArray(data?.chats) ? data.chats : [];
      const chats = raw
        .map((c) => ({
          name: String(c?.name || '').trim(),
          unread: Math.max(0, Math.floor(Number(c?.unread) || 0)),
          preview: String(c?.preview || '').trim().slice(0, 160),
          icon: String(c?.icon || '').slice(0, 8192),
        }))
        .filter((c) => c.name && c.unread > 0)
        .slice(0, 40);
      const payload = { serviceId, chats };
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('service-unread-inbox', payload);
        }
      }
    } catch (e) {
      console.warn('[unread-inbox] forward failed:', e?.message || e);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHOW_NOTIFICATION, async (_event, data) => {
    try {
      if (store.get('notificationsEnabled') === false) {
        return false;
      }
      const { serviceId, serviceName, serviceType, title, body, icon, chatName } =
        data || {};
      if (process.platform === 'win32') {
        app.setAppUserModelId(
          process.env.NODE_ENV === 'development'
            ? 'com.arcticswitch.app.dev'
            : 'com.arcticswitch.app'
        );
      }
      return await notificationManager.showNotification(
        serviceId,
        serviceName,
        serviceType || 'default',
        title,
        body,
        icon,
        chatName
      );
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_NOTIFICATIONS_ENABLED, () => {
    return store.get('notificationsEnabled') !== false;
  });

  ipcMain.handle(IPC_CHANNELS.SET_NOTIFICATIONS_ENABLED, (_event, enabled) => {
    store.set('notificationsEnabled', !!enabled);
    if (!enabled) {
      notificationManager.clearAllNotifications();
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_NOTIFICATIONS_AFTER_CLOSE, () => {
    return store.get('notificationsAfterClose') !== false;
  });

  ipcMain.handle(IPC_CHANNELS.SET_NOTIFICATIONS_AFTER_CLOSE, (_event, enabled) => {
    store.set('notificationsAfterClose', !!enabled);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_WEBVIEW_PRELOAD_PATH, (_event, serviceType) => {
    if (typeof getWebviewPreloadPath === 'function') {
      return getWebviewPreloadPath(serviceType);
    }
    return '';
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_NOTIFICATIONS, (_event, serviceId) => {
    if (serviceId) notificationManager.clearNotifications(serviceId);
    else notificationManager.clearAllNotifications();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.RELOAD_SERVICE, (_event, serviceId) => {
    const win = getMainWindow();
    if (win) win.webContents.send(IPC_CHANNELS.RELOAD_SERVICE, serviceId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TOGGLE_SERVICE, (_event, serviceId, enabled) => {
    const win = getMainWindow();
    if (win) win.webContents.send(IPC_CHANNELS.TOGGLE_SERVICE, serviceId, enabled);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TOGGLE_SERVICE_NOTIFICATIONS, (_event, serviceId, enabled) => {
    const win = getMainWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TOGGLE_SERVICE_NOTIFICATIONS, serviceId, enabled);
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.STORE_GET, (_event, key) => {
    try {
      return store.get(key);
    } catch {
      try {
        return store.get(`backup-${key}`);
      } catch {
        return undefined;
      }
    }
  });

  ipcMain.handle(IPC_CHANNELS.STORE_SET, (_event, key, value) => {
    try {
      try {
        const currentValue = store.get(key);
        if (currentValue !== undefined && currentValue !== null) {
          store.set(`backup-${key}`, currentValue);
        }
      } catch {
        /* ignore backup errors */
      }
      store.set(key, value);
      const savedValue = store.get(key);
      if (JSON.stringify(savedValue) !== JSON.stringify(value)) {
        throw new Error('Data verification failed');
      }
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.STORE_DELETE, (_event, key) => {
    try {
      store.delete(key);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.STORE_CLEAR, () => {
    try {
      store.clear();
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    if (win && !win.isDestroyed()) win.minimize();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    if (!win || win.isDestroyed()) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    if (!win || win.isDestroyed()) return false;
    // Let BrowserWindow 'close' handler decide hide-to-tray vs quit
    win.close();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    return !!(win && !win.isDestroyed() && win.isMaximized());
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_FULLSCREEN, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    if (!win || win.isDestroyed()) return false;
    const next = !win.isFullScreen();
    win.setFullScreen(next);
    // isFullScreen() can lag on Windows — notify after the transition settles
    const emit = () => {
      if (win.isDestroyed()) return;
      const actual = win.isFullScreen();
      win.webContents.send(IPC_CHANNELS.WINDOW_FULLSCREEN_CHANGED, actual);
    };
    setTimeout(emit, 0);
    setTimeout(emit, 120);
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_FULLSCREEN, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    return !!(win && !win.isDestroyed() && win.isFullScreen());
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_NEW_WINDOW, (_event, url) => {
    if (!url || typeof url !== 'string') return false;
    try {
      const child = new BrowserWindow({
        width: 1100,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: false,
          webviewTag: true,
        },
      });
      void child.loadURL(url);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.POPOUT_SERVICE, (_event, payload) => {
    if (!popout?.open) return false;
    return popout.open(payload);
  });

  ipcMain.handle(IPC_CHANNELS.BRING_BACK_SERVICE, (_event, serviceId) => {
    if (!popout?.bringBack) return false;
    return popout.bringBack(serviceId);
  });

  ipcMain.handle(IPC_CHANNELS.GET_POPOUT_PAYLOAD, (_event, serviceId) => {
    if (!popout?.getPayload) return null;
    return popout.getPayload(serviceId);
  });

  ipcMain.handle(IPC_CHANNELS.SSH_CONNECT, async (_event, sessionId, config) => {
    return sshConnect(String(sessionId || ''), config || {});
  });

  ipcMain.handle(IPC_CHANNELS.SSH_DISCONNECT, (_event, sessionId) => {
    return sshDisconnect(String(sessionId || ''));
  });

  ipcMain.handle(IPC_CHANNELS.SSH_WRITE, (_event, sessionId, data) => {
    return sshWrite(String(sessionId || ''), typeof data === 'string' ? data : '');
  });

  ipcMain.handle(IPC_CHANNELS.SSH_RESIZE, (_event, sessionId, size) => {
    return sshResize(String(sessionId || ''), size || {});
  });

  ipcMain.handle(IPC_CHANNELS.BULK_WA_STATUS, () => bulkWhatsAppStatus());
  ipcMain.handle(IPC_CHANNELS.BULK_WA_INSTALL, () => bulkWhatsAppInstall(getMainWindow));
  ipcMain.handle(IPC_CHANNELS.BULK_WA_LAUNCH, () => bulkWhatsAppLaunch(getMainWindow));

  ipcMain.handle(IPC_CHANNELS.LEAD_GEN_STATUS, () => leadGenStatus());
  ipcMain.handle(IPC_CHANNELS.LEAD_GEN_INSTALL, () => leadGenInstall());
  ipcMain.handle(IPC_CHANNELS.LEAD_GEN_LAUNCH, () => leadGenLaunch());
}
