import { app, BrowserWindow, session, Notification, Menu, Tray, nativeImage, net, protocol, webFrameMain, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import Store from 'electron-store';
import userAgent, { getUserAgentForService, getWhatsAppUserAgent } from './utils/userAgent.js';
import { isMac } from './utils/environment.js';
import { registerIpcHandlers } from './ipc/handlers.js';
import { attachAdBlocker } from './utils/adBlock.js';
import { sshDisconnectAll } from './ssh/sessions.js';
import { stopWindowsSpeech } from './utils/windowsSpeech.js';

/** Frameless custom chrome on Win/Linux; native traffic lights on macOS. */
function windowChromeOptions() {
  if (isMac) {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 18 },
    };
  }
  return { frame: false };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

/**
 * Dev vs installed must be separate apps on Windows.
 * Same AppUserModelId + single-instance lock causes `bun run electron-dev`
 * to focus the installed TextNexus instead of opening a new window.
 * Must run BEFORE requestSingleInstanceLock().
 */
const APP_USER_MODEL_ID = isDev ? 'com.textnexus.app.dev' : 'com.textnexus.app';
if (isDev) {
  try {
    app.setName('TextNexus Dev');
    app.setPath('userData', path.join(app.getPath('appData'), 'TextNexus-Dev'));
  } catch (err) {
    console.warn('[dev] failed to isolate userData:', err?.message || err);
  }
}
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

// Cap V8 heap (lower RAM); throttle hidden / occluded renderers
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=384');
app.commandLine.appendSwitch('enable-features', 'CalculateNativeWinOcclusion');
// Fewer spare renderer processes sitting idle
app.commandLine.appendSwitch('renderer-process-limit', '6');

// Stop Windows Security "Choose a passkey" (Meta / WhatsApp / Instagram) before Chromium starts
app.commandLine.appendSwitch(
  'disable-features',
  [
    'WebAuthentication',
    'WebAuthenticationPasskeysAmbient',
    'WebAuthenticationHybridTransports',
    'WebAuthenticationCable',
    'WebOTP',
  ].join(',')
);

// Required before app ready for Bulk WhatsApp embedded media URLs
try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'local-media',
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
} catch {
  /* already registered */
}

/** Prefer unpacked / resources icons so Linux dock & tray work after asar pack. */
function resolveAppAsset(filename) {
  const candidates = [
    path.join(process.resourcesPath || '', 'icons', filename),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'public', filename),
    path.join(__dirname, '../public', filename),
    path.join(__dirname, '../../public', filename),
  ];
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return path.join(__dirname, '../public', filename);
}

function getAppIconPath() {
  if (process.platform === 'win32') {
    return resolveAppAsset('icon.ico');
  }
  return resolveAppAsset('logo_light.png');
}

function getTrayIconPath() {
  return resolveAppAsset('favicon-32.png');
}

function getAboutIconPath() {
  return resolveAppAsset('logo_light.png');
}

function applyWindowIcon(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const iconPath = getAppIconPath();
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      win.setIcon(img);
    }
  } catch (err) {
    console.warn('[icon] setIcon failed:', err?.message || err);
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
    }
  });
}

// Initialize electron-store
const store = new Store({
  name: 'textnexus-data',
  cwd: app.getPath('userData'),
  encryptionKey: 'textnexus-secure-key-2024',
  defaults: {
    services: [],
    activeTab: '',
    sidebarCollapsed: false,
    isDarkMode: true,
    windowBounds: {
      width: 1400,
      height: 900,
      isMaximized: false,
    },
    sessions: {},
    auth: {},
    userSession: {}
  },
  clearInvalidConfig: true,
  serialize: JSON.stringify,
  deserialize: JSON.parse
});

console.log('📁 Store path:', store.path);
console.log('📋 Initial store data:', store.store);

let mainWindow;
let tray = null;
let isQuitting = false;

/** @type {Map<string, { win: import('electron').BrowserWindow, payload: object }>} */
const popoutWindows = new Map();
const popoutPayloads = new Map();

function loadPopoutWindow(win, serviceId) {
  if (isDev) {
    void win.loadURL(`http://localhost:5173/#/popout/${encodeURIComponent(serviceId)}`);
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: `/popout/${encodeURIComponent(serviceId)}`,
    });
  }
}

function notifyMain(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function openPopoutService(payload) {
  if (!payload?.serviceId) return false;
  const existing = popoutWindows.get(payload.serviceId);
  if (existing?.win && !existing.win.isDestroyed()) {
    existing.win.focus();
    return true;
  }

  popoutPayloads.set(payload.serviceId, payload);

  const child = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: getAppIconPath(),
    title: payload.name || 'TextNexus',
    ...windowChromeOptions(),
    autoHideMenuBar: true,
    backgroundColor: '#000d18',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      webviewTag: true,
      backgroundThrottling: true,
      partition: 'persist:main',
    },
    show: false,
  });

  loadPopoutWindow(child, payload.serviceId);
  child.once('ready-to-show', () => {
    applyWindowIcon(child);
    child.show();
  });

  child.on('closed', () => {
    const still = popoutWindows.get(payload.serviceId);
    if (still?.win === child) {
      popoutWindows.delete(payload.serviceId);
      popoutPayloads.delete(payload.serviceId);
      notifyMain('service-brought-back', payload.serviceId);
    }
  });

  popoutWindows.set(payload.serviceId, { win: child, payload });
  notifyMain('service-popped-out', payload.serviceId);
  return true;
}

function bringBackService(serviceId) {
  if (!serviceId) return false;
  const entry = popoutWindows.get(serviceId);
  popoutWindows.delete(serviceId);
  popoutPayloads.delete(serviceId);
  notifyMain('service-brought-back', serviceId);
  if (entry?.win && !entry.win.isDestroyed()) {
    entry.win.destroy();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.show();
  }
  return true;
}

function getPopoutPayload(serviceId) {
  return popoutPayloads.get(serviceId) || null;
}

// Notification system
class NotificationManager {
  constructor() {
    this.notifications = new Map();
    this.isAppVisible = true;
    this.replyCallbacks = new Map();
    this.serviceIcons = this.initializeServiceIcons();
    this.avatarCacheDir = path.join(app.getPath('temp'), 'textnexus-avatars');
    try {
      fs.mkdirSync(this.avatarCacheDir, { recursive: true });
    } catch {
      /* ignore */
    }

    // Set app user model ID for proper notifications
    if (process.platform === 'win32') {
      app.setAppUserModelId(APP_USER_MODEL_ID);
    }
  }

  initializeServiceIcons() {
    return {
      whatsapp: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
      gmail: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg',
      messenger: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Facebook_Messenger_logo_2020.svg',
      slack: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg',
      telegram: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg',
      discord: 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png',
      default: getAboutIconPath()
    };
  }

  setAppVisibility(visible) {
    this.isAppVisible = visible;
  }

  /**
   * Resolve sender DP to a local file path (Windows toasts need a local image).
   * Prefer data:/http avatar from the chat — never force the app logo when DP exists.
   */
  async resolveAvatarIcon(icon) {
    if (!icon || typeof icon !== 'string') return null;
    const trimmed = icon.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('file:') || path.isAbsolute(trimmed)) {
      return trimmed.startsWith('file:') ? trimmed : pathToFileURL(trimmed).href;
    }

    try {
      if (trimmed.startsWith('data:image')) {
        const match = trimmed.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!match) return null;
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1].replace('svg+xml', 'svg');
        const buf = Buffer.from(match[2], 'base64');
        const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
        const filePath = path.join(this.avatarCacheDir, `${hash}.${ext}`);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, buf);
        }
        return filePath;
      }

      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const hash = crypto.createHash('sha1').update(trimmed).digest('hex').slice(0, 16);
        const filePath = path.join(this.avatarCacheDir, `${hash}.png`);
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
          return filePath;
        }

        const buffer = await new Promise((resolve, reject) => {
          const request = net.request(trimmed);
          const chunks = [];
          request.on('response', (response) => {
            if (response.statusCode && response.statusCode >= 400) {
              reject(new Error(`HTTP ${response.statusCode}`));
              return;
            }
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
          });
          request.on('error', reject);
          request.end();
        });

        if (!buffer || buffer.length < 32) return null;

        // Normalize via nativeImage so Windows always gets a bitmap it can show
        const image = nativeImage.createFromBuffer(buffer);
        if (image.isEmpty()) {
          fs.writeFileSync(filePath, buffer);
        } else {
          const png = image.resize({ width: 96, height: 96, quality: 'best' }).toPNG();
          fs.writeFileSync(filePath, png);
        }
        return filePath;
      }
    } catch (err) {
      console.warn('⚠️ Could not resolve avatar icon:', err?.message || err);
    }
    return null;
  }

  async showNotification(serviceId, serviceName, serviceType, title, body, icon, chatName) {
    // Background / unfocused only — avoid toast spam while user is already in the app
    if (this.isAppVisible) return false;

    try {
      const avatarPath = await this.resolveAvatarIcon(icon);
      const notificationIcon = avatarPath || undefined;
      const openChatName =
        (chatName && String(chatName).trim()) ||
        (title && String(title).trim()) ||
        '';

      // Never surface unread-count style bodies ("3 new messages")
      let displayBody = (body && String(body).trim()) || 'New message';
      if (/^\d+\s*(new\s+)?messages?$/i.test(displayBody) || /^\d+\s+unread/i.test(displayBody)) {
        displayBody = 'New message';
      }

      console.log('📱 Creating notification:', {
        serviceId,
        serviceName,
        serviceType,
        title,
        body: displayBody,
        chatName: openChatName,
        hasAvatar: !!avatarPath,
      });

      if (process.platform === 'win32') {
        app.setAppUserModelId(APP_USER_MODEL_ID);
      }

      const displayTitle = (title && String(title).trim()) || serviceName || 'New message';

      /** @type {Electron.NotificationConstructorOptions} */
      const options = {
        title: displayTitle,
        body: displayBody,
        silent: false,
        urgency: 'critical',
        timeoutType: 'default',
      };
      if (notificationIcon) {
        options.icon = notificationIcon;
      }

      if (process.platform === 'darwin') {
        options.hasReply = true;
        options.replyPlaceholder = 'Type your reply…';
      }

      // Close previous toast for this service so the newest message is obvious
      if (this.notifications.has(serviceId)) {
        try {
          this.notifications.get(serviceId).close();
        } catch {
          /* ignore */
        }
        this.notifications.delete(serviceId);
      }

      const notification = new Notification(options);

      notification.on('click', () => {
        console.log('🖱️ Notification clicked for service:', serviceId, openChatName);
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
          mainWindow.show();
          notificationManager.setAppVisibility(true);
          setTimeout(() => {
            mainWindow.webContents.send('switch-to-service', serviceId, openChatName);
            if (openChatName) {
              mainWindow.webContents.send('open-notification-chat', {
                serviceId,
                chatName: openChatName,
              });
            }
          }, 300);
          if (openChatName) {
            setTimeout(() => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('open-notification-chat', {
                  serviceId,
                  chatName: openChatName,
                });
              }
            }, 1200);
          }
        }
      });

      if (process.platform === 'darwin') {
        notification.on('reply', (_event, reply) => {
          if (mainWindow) {
            mainWindow.webContents.send('send-reply', serviceId, reply);
          }
        });
      }

      notification.show();
      this.notifications.set(serviceId, notification);

      console.log('✅ Notification shown successfully');
      return true;
    } catch (error) {
      console.error('❌ Error showing notification:', error);
      return false;
    }
  }

  clearNotifications(serviceId) {
    if (this.notifications.has(serviceId)) {
      this.notifications.get(serviceId).close();
      this.notifications.delete(serviceId);
    }
  }

  clearAllNotifications() {
    this.notifications.forEach(notification => notification.close());
    this.notifications.clear();
  }
}

const notificationManager = new NotificationManager();

/** Ctrl+Tab switcher — shared by main window + webview guests */
let serviceSwitcherArmed = false;
let serviceSwitcherCtrlDown = false;
let serviceSwitcherHooked = false;
let serviceSwitcherReleaseTimer = null;

const VK_CONTROL = 0x11;
const VK_LCONTROL = 0xa2;
const VK_RCONTROL = 0xa3;
const WM_KEYUP = 0x0101;
const WM_SYSKEYUP = 0x0105;

const sendServiceSwitcher = (payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('service-switcher', payload);
  }
};

const focusHostForSwitcher = () => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!mainWindow.isFocused()) mainWindow.focus();
    // Pull focus out of guest webviews so Ctrl keyup reaches the host
    mainWindow.webContents.focus();
  } catch {
    /* ignore */
  }
};

const commitServiceSwitcherFromMain = () => {
  if (serviceSwitcherReleaseTimer) {
    clearTimeout(serviceSwitcherReleaseTimer);
    serviceSwitcherReleaseTimer = null;
  }
  if (!serviceSwitcherArmed) return;
  serviceSwitcherArmed = false;
  serviceSwitcherCtrlDown = false;
  sendServiceSwitcher({ action: 'release' });
};

const armServiceSwitcherHook = () => {
  if (serviceSwitcherHooked || process.platform !== 'win32') return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    // OS-level Ctrl keyup — webviews often swallow before-input-event for modifiers
    const onCtrlUp = (wParam) => {
      let vk = 0;
      try {
        if (Buffer.isBuffer(wParam)) vk = wParam.readUInt32LE(0) & 0xffff;
        else if (typeof wParam === 'bigint') vk = Number(wParam & 0xffffn);
        else if (typeof wParam === 'number') vk = wParam & 0xffff;
        else if (wParam != null) vk = Number(wParam) & 0xffff;
      } catch {
        vk = 0;
      }
      if (vk === VK_CONTROL || vk === VK_LCONTROL || vk === VK_RCONTROL) {
        serviceSwitcherCtrlDown = false;
        if (serviceSwitcherArmed) {
          commitServiceSwitcherFromMain();
        }
      }
    };
    mainWindow.hookWindowMessage(WM_KEYUP, (...args) => {
      onCtrlUp(args[0]);
      return false;
    });
    mainWindow.hookWindowMessage(WM_SYSKEYUP, (...args) => {
      onCtrlUp(args[0]);
      return false;
    });
    serviceSwitcherHooked = true;
  } catch (err) {
    console.warn('[switcher] hookWindowMessage failed:', err?.message || err);
  }
};

const handleServiceSwitcherInput = (event, input) => {
  const isControlKey =
    input.key === 'Control' ||
    input.code === 'ControlLeft' ||
    input.code === 'ControlRight' ||
    input.key === 'Meta' ||
    input.code === 'MetaLeft' ||
    input.code === 'MetaRight';

  if (input.type === 'keyDown' && isControlKey) {
    serviceSwitcherCtrlDown = true;
  }

  // Hold Ctrl, press Tab → open/cycle (Windows Alt+Tab style)
  if (input.type === 'keyDown' && input.key === 'Tab' && input.control && !input.alt && !input.meta) {
    event.preventDefault();
    serviceSwitcherArmed = true;
    serviceSwitcherCtrlDown = true;
    if (serviceSwitcherReleaseTimer) {
      clearTimeout(serviceSwitcherReleaseTimer);
      serviceSwitcherReleaseTimer = null;
    }
    armServiceSwitcherHook();
    focusHostForSwitcher();
    sendServiceSwitcher({
      action: 'cycle',
      direction: input.shift ? -1 : 1,
    });
    // After UI paints, steal focus again (webview often steals it back)
    setTimeout(focusHostForSwitcher, 0);
    setTimeout(focusHostForSwitcher, 50);
    return true;
  }

  // Ctrl+K / Cmd+K → global search (works even when focus is in a webview)
  if (
    input.type === 'keyDown' &&
    (input.key === 'k' || input.key === 'K') &&
    (input.control || input.meta) &&
    !input.alt
  ) {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        if (!mainWindow.isFocused()) mainWindow.focus();
        mainWindow.webContents.focus();
      } catch {
        /* ignore */
      }
      mainWindow.webContents.send('global-search', { action: 'toggle' });
    }
    return true;
  }

  // Release Ctrl → open highlighted service
  if (input.type === 'keyUp' && serviceSwitcherArmed) {
    if (isControlKey) {
      event.preventDefault();
      serviceSwitcherCtrlDown = false;
      commitServiceSwitcherFromMain();
      return true;
    }
    // Both keys released (Tab up, Ctrl already up)
    if (input.key === 'Tab' && !input.control && !input.meta) {
      event.preventDefault();
      commitServiceSwitcherFromMain();
      return true;
    }
  }

  if (input.type === 'keyUp' && isControlKey) {
    serviceSwitcherCtrlDown = false;
  }

  if (input.type === 'keyDown' && input.key === 'Escape' && serviceSwitcherArmed) {
    event.preventDefault();
    serviceSwitcherArmed = false;
    serviceSwitcherCtrlDown = false;
    if (serviceSwitcherReleaseTimer) {
      clearTimeout(serviceSwitcherReleaseTimer);
      serviceSwitcherReleaseTimer = null;
    }
    sendServiceSwitcher({ action: 'cancel' });
    return true;
  }

  if (input.type === 'keyDown' && input.key === 'Enter' && serviceSwitcherArmed) {
    event.preventDefault();
    commitServiceSwitcherFromMain();
    return true;
  }

  return false;
};

/** Injected into every frame — kills navigator.credentials before Meta can open Windows passkey UI */
const BLOCK_PASSKEYS_JS = `(() => {
  try {
    Object.defineProperty(navigator, 'credentials', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  } catch (_) {}
  try {
    const reject = async () => {
      throw new DOMException(
        'The user agent does not support public key credentials.',
        'NotSupportedError'
      );
    };
    if (typeof CredentialsContainer !== 'undefined' && CredentialsContainer.prototype) {
      for (const method of Object.getOwnPropertyNames(CredentialsContainer.prototype)) {
        if (method === 'constructor') continue;
        try {
          Object.defineProperty(CredentialsContainer.prototype, method, {
            value: reject,
            configurable: true,
            writable: true,
          });
        } catch (_) {}
      }
    }
    if (navigator.credentials) {
      try { navigator.credentials.get = reject; } catch (_) {}
      try { navigator.credentials.create = reject; } catch (_) {}
      try { navigator.credentials.store = reject; } catch (_) {}
    }
  } catch (_) {}
  try {
    if (typeof PublicKeyCredential !== 'undefined') {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => false;
      if (PublicKeyCredential.isConditionalMediationAvailable) {
        PublicKeyCredential.isConditionalMediationAvailable = async () => false;
      }
    }
  } catch (_) {}
})();`;

function injectPasskeyBlockIntoFrame(contents, frameProcessId, frameRoutingId) {
  try {
    const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
    if (frame && !frame.detached) {
      frame.executeJavaScript(BLOCK_PASSKEYS_JS).catch(() => {});
    }
  } catch (_) {}
  try {
    contents.executeJavaScript(BLOCK_PASSKEYS_JS).catch(() => {});
  } catch (_) {}
}

function attachPasskeyBlocker(contents) {
  if (!contents || contents.isDestroyed?.()) return;
  if (contents.__tnPasskeyBlockerAttached) return;
  contents.__tnPasskeyBlockerAttached = true;

  const run = (_event, ...args) => {
    // did-frame-navigate: (e, url, code, status, isMainFrame, frameProcessId, frameRoutingId)
    // did-frame-finish-load: (e, isMainFrame, frameProcessId, frameRoutingId)
    let frameProcessId;
    let frameRoutingId;
    if (typeof args[4] === 'number' && typeof args[5] === 'number') {
      frameProcessId = args[4];
      frameRoutingId = args[5];
    } else if (typeof args[1] === 'number' && typeof args[2] === 'number') {
      frameProcessId = args[1];
      frameRoutingId = args[2];
    }
    if (frameProcessId != null && frameRoutingId != null) {
      injectPasskeyBlockIntoFrame(contents, frameProcessId, frameRoutingId);
    } else {
      try {
        contents.executeJavaScript(BLOCK_PASSKEYS_JS).catch(() => {});
      } catch (_) {}
    }
  };

  contents.on('did-frame-navigate', run);
  contents.on('did-frame-finish-load', run);
  contents.on('dom-ready', () => {
    try {
      contents.executeJavaScript(BLOCK_PASSKEYS_JS).catch(() => {});
    } catch (_) {}
  });
}

function isPasskeyNetworkUrl(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return false;
  return (
    u.includes('/pk/') ||
    u.includes('/passkey') ||
    u.includes('passkey') ||
    u.includes('webauthn') ||
    u.includes('publickeycredential') ||
    u.includes('public_key_credential') ||
    u.includes('checkpoint/pk') ||
    u.includes('webauthn_login') ||
    u.includes('credential_manager')
  );
}

// Disable security warnings in development
if (isDev) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

function clampWindowBounds(bounds) {
  const width = Math.max(800, Math.round(bounds.width || 1400));
  const height = Math.max(600, Math.round(bounds.height || 900));
  const hasPos = typeof bounds.x === 'number' && typeof bounds.y === 'number';
  if (!hasPos) {
    return { width, height, isMaximized: !!bounds.isMaximized };
  }

  const area = screen.getDisplayMatching({
    x: bounds.x,
    y: bounds.y,
    width,
    height,
  }).workArea;

  const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - 100);
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - 100);

  return {
    x,
    y,
    width: Math.min(width, area.width),
    height: Math.min(height, area.height),
    isMaximized: !!bounds.isMaximized,
  };
}

function saveMainWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const isMaximized = mainWindow.isMaximized();
  const bounds =
    typeof mainWindow.getNormalBounds === 'function'
      ? mainWindow.getNormalBounds()
      : mainWindow.getBounds();
  store.set('windowBounds', {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized,
  });
}

function createWindow() {
  // Restore last size/position so reopen matches how the user left the app
  const savedBounds = clampWindowBounds(
    store.get('windowBounds', { width: 1400, height: 900, isMaximized: false })
  );

  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    ...(typeof savedBounds.x === 'number' && typeof savedBounds.y === 'number'
      ? { x: savedBounds.x, y: savedBounds.y }
      : {}),
    minWidth: 800,
    minHeight: 600,
    icon: getAppIconPath(),
    title: 'TextNexus',
    ...windowChromeOptions(),
    autoHideMenuBar: true,
    menuBarVisible: false,
        webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // webSecurity disabled: required for third-party messaging webviews (WhatsApp etc.)
      webSecurity: false,
      webviewTag: true,
      allowRunningInsecureContent: true,
      experimentalFeatures: false,
      backgroundThrottling: true,
      partition: 'persist:main'
    },
    show: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173', {
      userAgent: userAgent()
    });
    // Dock DevTools inside the same window (no separate floating window)
    mainWindow.webContents.once('did-finish-load', () => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools({ mode: 'right' });
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Hide menu bar completely
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);
  applyWindowIcon(mainWindow);

  // Webview guests: passkey blocker + background throttle (cuts idle RAM for Bulk/Lead/etc.)
  mainWindow.webContents.on('did-attach-webview', (_event, guestContents) => {
    attachPasskeyBlocker(guestContents);
    try {
      if (typeof guestContents.setBackgroundThrottling === 'function') {
        guestContents.setBackgroundThrottling(true);
      }
    } catch {
      /* ignore */
    }
  });

  mainWindow.once('ready-to-show', () => {
    applyWindowIcon(mainWindow);
    if (savedBounds.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
    
    // Focus the window to ensure proper initialization
    if (isDev) {
      mainWindow.focus();
    }
    
    // Enable session persistence for cookies
    const session = mainWindow.webContents.session;
    session.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (
        permission === 'publickey-credentials-get' ||
        permission === 'publickey-credentials-create'
      ) {
        callback(false);
        return;
      }
      const allowedPermissions = [
        'notifications', 'microphone', 'camera', 'media', 'mediaKeySystem',
        'display-capture', 'geolocation', 'midi', 'midiSysex',
        'clipboard-read', 'clipboard-write', 'clipboard-sanitized-write',
        'fullscreen', 'pointerLock', 'speaker-selection',
      ];
      callback(allowedPermissions.includes(permission));
    });
    if (typeof session.setPermissionCheckHandler === 'function') {
      session.setPermissionCheckHandler((_wc, permission) => {
        if (
          permission === 'publickey-credentials-get' ||
          permission === 'publickey-credentials-create'
        ) {
          return false;
        }
        return [
          'notifications', 'microphone', 'camera', 'media', 'mediaKeySystem',
          'display-capture', 'fullscreen', 'pointerLock', 'speaker-selection',
          'clipboard-read', 'clipboard-write', 'clipboard-sanitized-write',
        ].includes(permission);
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Close X: either quit, or hide to tray so messaging notifications keep working
  mainWindow.on('close', (event) => {
    saveMainWindowState();

    const keepAlive =
      !isQuitting &&
      store.get('notificationsEnabled') !== false &&
      store.get('notificationsAfterClose') !== false;

    if (keepAlive) {
      event.preventDefault();
      mainWindow.hide();
      notificationManager.setAppVisibility(false);
      console.log('🌙 Window hidden to tray — background notifications active');
    }
  });

  const sendMaximized = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximized-changed', mainWindow.isMaximized());
    }
  };
  mainWindow.on('maximize', () => {
    sendMaximized();
    saveMainWindowState();
  });
  mainWindow.on('unmaximize', () => {
    sendMaximized();
    saveMainWindowState();
  });

  const sendFullscreen = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-fullscreen-changed', mainWindow.isFullScreen());
    }
  };
  mainWindow.on('enter-full-screen', sendFullscreen);
  mainWindow.on('leave-full-screen', sendFullscreen);

  // F11 fullscreen + Ctrl+Tab service switcher (works even when focus is in a webview)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
      return;
    }
    handleServiceSwitcherInput(event, input);
  });

  // Ready for OS-level Ctrl keyup while switcher is open (Windows)
  armServiceSwitcherHook();

  // Handle window focus/blur for notifications
  mainWindow.on('focus', () => {
    console.log('🔍 Window focused - disabling notifications');
    notificationManager.setAppVisibility(true);
    notificationManager.clearAllNotifications();
  });

  mainWindow.on('blur', () => {
    console.log('👁️ Window blurred - enabling notifications');
    notificationManager.setAppVisibility(false);
  });

  mainWindow.on('show', () => {
    console.log('👀 Window shown - disabling notifications');
    notificationManager.setAppVisibility(true);
    notificationManager.clearAllNotifications();
  });
 
  // Save window size/position (normal bounds even when maximized)
  let saveTimeout;
  const scheduleSaveWindowBounds = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveMainWindowState();
      console.log('💾 Window bounds saved:', store.get('windowBounds'));
    }, 300);
  };

  mainWindow.on('resize', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    scheduleSaveWindowBounds();
  });

  mainWindow.on('move', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    scheduleSaveWindowBounds();
  });

  // Handle window resize to ensure webview scales properly
  mainWindow.on('resize', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.executeJavaScript(`
      const webviews = document.querySelectorAll('webview');
      webviews.forEach(webview => {
        webview.style.width = '100%';
        webview.style.height = '100%';
      });
    `).catch(() => {
      // Ignore errors if webview doesn't exist yet
    });
  });
}

function createTray() {
  if (tray) return;

  const trayPath = getTrayIconPath();
  const trayImage = nativeImage.createFromPath(trayPath);
  const fallback = nativeImage.createFromPath(getAboutIconPath());
  tray = new Tray(trayImage.isEmpty() ? fallback : trayImage);
  tray.setToolTip('TextNexus');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show TextNexus',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  // Bulk WhatsApp / Lead Gen hosts start lazily on first open (saves RAM at boot)

  // Popups: allow call/media windows; route other links into in-app tabs
  const CALL_POPUP_HOSTS = [
    'instagram.com',
    'cdninstagram.com',
    'facebook.com',
    'fbcdn.net',
    'fbsbx.com',
    'messenger.com',
    'meta.com',
    'whatsapp.com',
    'whatsapp.net',
    'web.whatsapp.com',
    'meet.google.com',
    'docs.google.com',
    'drive.google.com',
    'google.com',
    'accounts.google.com',
    'teams.microsoft.com',
    'office.com',
    'microsoft365.com',
    'excel.office.com',
    'word.office.com',
    'onenote.office.com',
    'live.com',
    'microsoft.com',
    'login.microsoftonline.com',
  ];

  const isCallOrMediaPopup = (url, features = '') => {
    const u = String(url || '');
    const f = String(features || '');
    if (!u || u === 'about:blank' || u.startsWith('about:blank')) return true;
    if (/call|rtc|video|voice|live|rooms|meet\.google/i.test(u + f)) return true;
    try {
      const host = new URL(u).hostname.toLowerCase();
      return CALL_POPUP_HOSTS.some(
        (h) => host === h || host.endsWith(`.${h}`)
      );
    } catch {
      return false;
    }
  };

  app.on('web-contents-created', (_event, contents) => {
    // Kill Meta/Windows passkey prompts inside every guest frame
    attachPasskeyBlocker(contents);

    // Ctrl+Tab must work while focus is inside WhatsApp/Instagram webviews
    contents.on('before-input-event', (event, input) => {
      try {
        if (contents.getType() !== 'webview') return;
      } catch {
        return;
      }
      handleServiceSwitcherInput(event, input);
    });

    contents.setWindowOpenHandler(({ url, features }) => {
      try {
        if (contents.getType() === 'webview' && isCallOrMediaPopup(url, features)) {
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              autoHideMenuBar: true,
              backgroundColor: '#000000',
              width: 960,
              height: 720,
              webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
              },
            },
          };
        }

        if (url && url !== 'about:blank' && contents.getType() === 'webview') {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('open-in-app-tab', {
              url,
              guestId: contents.id,
            });
          }
        }
      } catch (err) {
        console.warn('setWindowOpenHandler error:', err);
      }
      return { action: 'deny' };
    });
  });

  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  if (typeof app.setAboutPanelOptions === 'function') {
    app.setAboutPanelOptions({
      applicationName: isDev ? 'TextNexus Dev' : 'TextNexus',
      applicationVersion: app.getVersion(),
      copyright: 'TextNexus',
      iconPath: getAboutIconPath()
    });
  }

  createTray();

  // Configure session for WhatsApp Web compatibility (do NOT rewrite Facebook/IG headers —
  // that breaks Instagram / Messenger WebRTC signaling)
  const whatsappFilter = {
    urls: ['*://web.whatsapp.com/*', '*://*.whatsapp.com/*', '*://*.whatsapp.net/*']
  };
  
  // Configure for all sessions (default and partitioned)
  const passkeyFramePreload = path.join(__dirname, 'passkey-frame-preload.js');
  const sessionsWithPasskeyBlock = new WeakSet();

  const configureSession = (ses) => {
    attachAdBlocker(ses);

    // Block WebAuthn / passkeys in every frame (incl. accounts.meta.com iframes)
    if (!sessionsWithPasskeyBlock.has(ses)) {
      sessionsWithPasskeyBlock.add(ses);
      try {
        if (typeof ses.registerPreloadScript === 'function') {
          ses.registerPreloadScript({
            type: 'frame',
            id: 'textnexus-block-passkeys',
            filePath: passkeyFramePreload,
          });
        } else if (typeof ses.setPreloads === 'function') {
          const existing = typeof ses.getPreloads === 'function' ? ses.getPreloads() : [];
          if (!existing.includes(passkeyFramePreload)) {
            ses.setPreloads([...existing, passkeyFramePreload]);
          }
        }
      } catch (err) {
        console.warn('Could not register passkey block preload:', err?.message || err);
      }
    }

    const whatsappUserAgent = getWhatsAppUserAgent();

    // Cancel Meta / LinkedIn-style passkey network calls that spawn Windows Security UI
    try {
      ses.webRequest.onBeforeRequest(
        {
          urls: [
            '*://accounts.meta.com/*',
            '*://*.facebook.com/*',
            '*://*.instagram.com/*',
            '*://*.whatsapp.com/*',
            '*://web.whatsapp.com/*',
            '*://*.messenger.com/*',
          ],
        },
        (details, callback) => {
          if (isPasskeyNetworkUrl(details.url)) {
            callback({ cancel: true });
            return;
          }
          callback({});
        }
      );
    } catch (err) {
      console.warn('Passkey URL block failed:', err?.message || err);
    }
    
    ses.webRequest.onBeforeSendHeaders(whatsappFilter, (details, callback) => {
      // Only touch WhatsApp document navigations
      if (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') {
        details.requestHeaders['User-Agent'] = whatsappUserAgent;
        details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
      }
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
  
    // Remove frame restrictions for WhatsApp Web
    ses.webRequest.onHeadersReceived(whatsappFilter, (details, callback) => {
      if (details.responseHeaders) {
        delete details.responseHeaders['x-frame-options'];
        delete details.responseHeaders['X-Frame-Options'];
        delete details.responseHeaders['content-security-policy'];
        delete details.responseHeaders['Content-Security-Policy'];
        delete details.responseHeaders['content-security-policy-report-only'];
        delete details.responseHeaders['Content-Security-Policy-Report-Only'];
        
        // Add headers to prevent download prompts
        if (details.responseHeaders) {
          details.responseHeaders['Cache-Control'] = ['no-cache, no-store, must-revalidate'];
          details.responseHeaders['Pragma'] = ['no-cache'];
          details.responseHeaders['Expires'] = ['0'];
        }
      }
      callback({ cancel: false, responseHeaders: details.responseHeaders });
    });

    // Mic / camera / media — required for Instagram & Messenger calls
    const allowedPermissions = [
      'notifications',
      'microphone',
      'camera',
      'media',
      'mediaKeySystem',
      'display-capture',
      'geolocation',
      'midi',
      'midiSysex',
      'clipboard-read',
      'clipboard-write',
      'clipboard-sanitized-write',
      'fullscreen',
      'pointerLock',
      'idle-detection',
      'speaker-selection',
    ];

    ses.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (
        permission === 'publickey-credentials-get' ||
        permission === 'publickey-credentials-create'
      ) {
        callback(false);
        return;
      }
      const granted = allowedPermissions.includes(permission);
      if (!granted) {
        console.log('Permission denied:', permission);
      }
      callback(granted);
    });

    if (typeof ses.setPermissionCheckHandler === 'function') {
      ses.setPermissionCheckHandler((_webContents, permission) => {
        if (
          permission === 'publickey-credentials-get' ||
          permission === 'publickey-credentials-create'
        ) {
          return false;
        }
        return allowedPermissions.includes(permission);
      });
    }

    if (typeof ses.setDevicePermissionHandler === 'function') {
      ses.setDevicePermissionHandler((details) => {
        if (details.deviceType === 'hid' || details.deviceType === 'serial') {
          return false;
        }
        // media / audioInput / videoInput / etc.
        return true;
      });
    }

    // Disable web security for WhatsApp Web
    ses.webRequest.onBeforeRequest(whatsappFilter, (details, callback) => {
      // Redirect any download page requests back to web interface
      if (details.url.includes('whatsapp.com/download') || 
          details.url.includes('whatsapp.com/desktop')) {
        callback({ 
          cancel: false, 
          redirectURL: 'https://web.whatsapp.com/' 
        });
      } else {
        callback({ cancel: false });
      }
    });
  
    // Additional session configuration
    ses.webRequest.onCompleted(whatsappFilter, (details) => {
      // Log successful loads for debugging
      if (details.statusCode === 200) {
        console.log('WhatsApp Web loaded successfully:', details.url);
      }
    });
  };

  // Configure default session
  configureSession(session.defaultSession);
  attachAdBlocker(session.defaultSession);

  // Configure partitioned sessions when they are created
  session.defaultSession.on('will-create-partition', (event, partition) => {
    console.log('Creating partition:', partition);
  });

  // Listen for partition creation and configure them
  const originalFromPartition = session.fromPartition;
  session.fromPartition = function(partition, options) {
    const partitionSession = originalFromPartition.call(this, partition, options);
    attachAdBlocker(partitionSession);
    if (partition.includes('whatsapp') || partition.includes('persist:')) {
      console.log('Configuring partition:', partition);
      configureSession(partitionSession);
    }
    if (String(partition).includes('snapchat')) {
      try {
        const snapUa = getUserAgentForService('snapchat');
        partitionSession.setUserAgent(snapUa);
        partitionSession.webRequest.onBeforeSendHeaders(
          { urls: ['*://*.snapchat.com/*', '*://*.snap.com/*', '*://*.sc-cdn.net/*'] },
          (details, callback) => {
            const headers = { ...(details.requestHeaders || {}) };
            headers['User-Agent'] = snapUa;
            // Drop Electron-ish client hints if present
            delete headers['Sec-CH-UA-Full-Version-List'];
            headers['Sec-CH-UA'] = '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"';
            headers['Sec-CH-UA-Mobile'] = '?0';
            headers['Sec-CH-UA-Platform'] = '"Windows"';
            callback({ cancel: false, requestHeaders: headers });
          }
        );
      } catch (e) {
        console.warn('Failed to harden Snapchat session:', e?.message || e);
      }
    }
    return partitionSession;
  };

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  saveMainWindowState();
  try {
    stopWindowsSpeech();
  } catch {
    /* ignore */
  }
  try {
    sshDisconnectAll();
  } catch {
    /* ignore */
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle certificate errors (WhatsApp Web only — required for embedded webviews)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('https://web.whatsapp.com')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

registerIpcHandlers({
  getMainWindow: () => mainWindow,
  store,
  notificationManager,
  getWebviewPreloadPath: (serviceType) => {
    if (serviceType === 'snapchat') {
      return path.join(__dirname, 'snapchat-preload.js');
    }
    return path.join(__dirname, 'webview-preload.js');
  },
  popout: {
    open: openPopoutService,
    bringBack: bringBackService,
    getPayload: getPopoutPayload,
  },
});

store.onDidChange('services', (newValue, oldValue) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 Services changed in store:', oldValue?.length || 0, '->', newValue?.length || 0);
  }
});
