 import { app, BrowserWindow, ipcMain, shell, Menu, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import updater from 'electron-updater';
import Store from 'electron-store';
import keytar from 'keytar';

const require = createRequire(import.meta.url);
const { createWhatsAppManager } = require('./whatsapp-manager.cjs');
const { createCampaignManager } = require('./campaign-manager.cjs');
const { computeStatistics } = require('../electron-core/mvc/services/statistics.service.cjs');
const { applyUserSession, getLocalUserKeyFromUser } = require('./user-session.cjs');
const { getAppIcon } = require('./app-icons.cjs');

const { autoUpdater } = updater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

const LOCAL_MEDIA_DIR = 'local-media';

function getLocalMediaDir() {
  const dir = process.env.LOCAL_MEDIA_PATH || path.join(app.getPath('userData'), LOCAL_MEDIA_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

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

function registerLocalMediaProtocol() {
  const mediaDir = getLocalMediaDir();
  const userData = app.getPath('userData');
  const legacyDir = path.join(userData, 'template-media');
  const globalDir = path.join(userData, 'local-media');

  protocol.handle('local-media', (request) => {
    try {
      const fileName = path.basename(
        decodeURIComponent(request.url.replace(/^local-media:\/\//, ''))
      );
      const candidates = [path.join(mediaDir, fileName), path.join(globalDir, fileName), path.join(legacyDir, fileName)];
      try {
        const usersDir = path.join(userData, 'users');
        if (fs.existsSync(usersDir)) {
          for (const entry of fs.readdirSync(usersDir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              candidates.push(path.join(usersDir, entry.name, 'local-media', fileName));
            }
          }
        }
      } catch (_) {}
      const filePath = candidates.find((p) => fs.existsSync(p));
      if (!filePath) {
        return new Response('Not found', { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).href);
    } catch (error) {
      console.error('local-media protocol error:', error);
      return new Response('Error', { status: 500 });
    }
  });
}

if (process.platform === 'win32') {
  app.setAppUserModelId('Bulk WhatsApp');
}

// Initialize electron store with encryption
const store = new Store({
  name: 'secure-config',
  encryptionKey: 'your-secure-encryption-key', // In production, this should be more secure or handled via safeStorage
  accessPropertiesByDotNotation: false
});

let mainWindow;
let whatsappManager;
let campaignManager;

function getAuthUserId() {
  return getLocalUserKeyFromUser(store.get('auth_user'));
}

function persistInstanceToStore(instanceId, data) {
  const userId = getAuthUserId();
  if (!userId) return;
  const key = `instances.${userId}`;
  const instances = store.get(key) || [];
  const idx = instances.findIndex((i) => i._id === instanceId);
  if (idx < 0) return;
  instances[idx] = {
    ...instances[idx],
    ...data,
    whatsapp: { ...(instances[idx].whatsapp || {}), ...(data.whatsapp || {}) },
    updatedAt: new Date().toISOString(),
  };
  store.set(key, instances);
}

function initWhatsAppManager() {
  whatsappManager = createWhatsAppManager({
    app,
    store,
    getMainWindow: () => mainWindow,
    getAuthUserId,
    onInstancePersist: persistInstanceToStore,
  });
}

function initCampaignManager() {
  campaignManager = createCampaignManager({
    store,
    app,
    getMainWindow: () => mainWindow,
    getAuthUserId,
    syncInstancesFromDisk: (s, userKey, override) =>
      whatsappManager?.syncInstancesFromDisk?.(s, userKey, override),
    ensureSession: (instanceData) => whatsappManager?.ensureSession?.(instanceData),
    hasSavedSession: (instanceId) =>
      whatsappManager?.hasSavedSession?.(instanceId) || false,
    prepareAndLoadSessions: (opts) => whatsappManager?.prepareAndLoadSessions?.(opts),
  });
}

async function restoreWhatsAppSessions() {
  const user = store.get('auth_user');
  const userId = getAuthUserId();
  if (!userId || !whatsappManager) return;
  await whatsappManager.prepareAndLoadSessions({ store, userKey: userId, user });
}

function createWindow() {
  // Get stored window state or use defaults
  const windowState = store.get('window_state') || {
    width: 1280,
    height: 800
  };

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    minWidth: 1200,
    minHeight: 700,
    x: windowState.x,
    y: windowState.y,
    title: 'Bulk WhatsApp',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
      webSecurity: true,
      devTools: isDev
    },
    icon: getAppIcon(256),
  });

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle('Bulk WhatsApp');
  });

  // Save window state when closed
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('window_state', bounds);
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3001');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    Menu.setApplicationMenu(null);
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault();
      }
    });
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Check for updates
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }
}

// IPC Handlers for Secure Storage
ipcMain.handle('auth:save-token', async (event, token) => {
  try {
    store.set('auth_token', token);
    return { success: true };
  } catch (error) {
    console.error('Failed to save token:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:get-token', async () => {
  try {
    return store.get('auth_token');
  } catch (error) {
    console.error('Failed to get token:', error);
    return null;
  }
});

ipcMain.handle('auth:save-user', async (event, payload) => {
  try {
    const user = payload?.user ?? payload;
    const phoneFallback = payload?.phoneFallback || user?.phone;
    const loadSessions = payload?.loadSessions === true;
    const previousKey = store.get('last_phone_key') || getAuthUserId();
    const session = applyUserSession({ app, store, user, phoneFallback });
    const normalized = session?.user || user;
    const newKey = session?.phoneKey || getLocalUserKeyFromUser(normalized);
    store.set('auth_user', normalized);
    if (newKey) {
      store.set('last_phone_key', newKey);
    }
    if (whatsappManager && previousKey && newKey && previousKey !== newKey) {
      await whatsappManager.detachMemorySessions();
    }
    if (whatsappManager && loadSessions) {
      await whatsappManager.prepareAndLoadSessions({
        store,
        userKey: newKey || getAuthUserId(),
        user: normalized,
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to save user:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:get-user', async () => {
  try {
    return store.get('auth_user');
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
});

ipcMain.handle('auth:clear-token', async () => {
  try {
    const lastPhoneKey = getAuthUserId();
    if (lastPhoneKey) {
      store.set('last_phone_key', lastPhoneKey);
    }
    if (whatsappManager) {
      await whatsappManager.detachMemorySessions();
    }
    store.delete('auth_token');
    store.delete('auth_user');
    await keytar.deletePassword('ButtonApp', 'RefreshToken');
    return { success: true };
  } catch (error) {
    console.error('Failed to clear auth:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sessions:reload', async () => {
  try {
    await restoreWhatsAppSessions();
    return { success: true };
  } catch (error) {
    console.error('sessions:reload error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('auth:save-secure-token', async (event, token) => {
  try {
    await keytar.setPassword('ButtonApp', 'RefreshToken', token);
    return { success: true };
  } catch (error) {
    console.error('Failed to save secure token:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:get-secure-token', async () => {
  try {
    return await keytar.getPassword('ButtonApp', 'RefreshToken');
  } catch (error) {
    console.error('Failed to get secure token:', error);
    return null;
  }
});

// Messages Storage Handlers
ipcMain.handle('messages:save', async (event, { userId, message }) => {
  try {
    if (!userId || !message) throw new Error('UserId and message are required');
    
    // Structure: messages.{userId}.{instanceId} = [Array of messages]
    const key = `messages.${userId}.${message.instance_id}`;
    
    // Get existing messages
    const existingMessages = store.get(key) || [];
    
    // Add new message to the beginning (or end, depending on preference)
    existingMessages.unshift(message);
    
    // Limit to last 1000 messages per instance to avoid bloating
    if (existingMessages.length > 1000) {
      existingMessages.length = 1000;
    }
    
    store.set(key, existingMessages);
    return { success: true };
  } catch (error) {
    console.error('Failed to save message:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('messages:get', async (event, { userId, instanceId, page = 1, limit = 20, search }) => {
  try {
    if (!userId || !instanceId) throw new Error('UserId and instanceId are required');
    
    const key = `messages.${userId}.${instanceId}`;
    let messages = store.get(key) || [];
    
    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      messages = messages.filter(msg => 
        (msg.from && msg.from.toLowerCase().includes(searchLower)) ||
        (msg.pushName && msg.pushName.toLowerCase().includes(searchLower)) ||
        (msg.message && msg.message.toLowerCase().includes(searchLower))
      );
    }
    
    // Pagination
    const total = messages.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMessages = messages.slice(startIndex, endIndex);
    
    return {
      success: true,
      data: paginatedMessages,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    };
  } catch (error) {
    console.error('Failed to get messages:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('messages:clear', async (event, { userId, instanceId }) => {
  try {
    if (!userId || !instanceId) throw new Error('UserId and instanceId are required');
    
    const key = `messages.${userId}.${instanceId}`;
    store.delete(key);
    
    return { success: true };
  } catch (error) {
    console.error('Failed to clear messages:', error);
    return { success: false, error: error.message };
  }
});

// Local instance storage (device-specific)
ipcMain.handle('instances:get', async (event, { userId }) => {
  try {
    if (!userId) throw new Error('UserId is required');
    let instances = store.get(`instances.${userId}`) || [];
    if (whatsappManager) {
      instances = whatsappManager.syncInstancesFromDisk(store, userId, instances);
    }
    return { success: true, instances };
  } catch (error) {
    console.error('Failed to get instances:', error);
    return { success: false, error: error.message, instances: [] };
  }
});

ipcMain.handle('instances:save', async (event, { userId, instances }) => {
  try {
    if (!userId) throw new Error('UserId is required');
    const key = `instances.${userId}`;
    store.set(key, Array.isArray(instances) ? instances : []);
    return { success: true };
  } catch (error) {
    console.error('Failed to save instances:', error);
    return { success: false, error: error.message };
  }
});

// Local campaign storage
ipcMain.handle('campaigns:get', async (event, { userId }) => {
  try {
    if (!userId) throw new Error('UserId is required');
    return { success: true, campaigns: store.get(`campaigns.${userId}`) || [] };
  } catch (error) {
    console.error('Failed to get campaigns:', error);
    return { success: false, error: error.message, campaigns: [] };
  }
});

ipcMain.handle('campaigns:save', async (event, { userId, campaigns }) => {
  try {
    if (!userId) throw new Error('UserId is required');
    store.set(`campaigns.${userId}`, Array.isArray(campaigns) ? campaigns : []);
    return { success: true };
  } catch (error) {
    console.error('Failed to save campaigns:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('campaign:send', async (event, { userId, campaignId }) => {
  try {
    if (!campaignManager) throw new Error('Campaign manager not ready');
    return await campaignManager.sendCampaign({ userId, campaignId });
  } catch (error) {
    console.error('campaign:send error:', error);
    return { status: false, message: error.message };
  }
});

ipcMain.handle('campaign:pause', async (event, { campaignId }) => {
  try {
    if (!campaignManager) throw new Error('Campaign manager not ready');
    return campaignManager.pauseCampaign({ campaignId });
  } catch (error) {
    return { status: false, message: error.message };
  }
});

ipcMain.handle('campaign:resume', async (event, { campaignId }) => {
  try {
    if (!campaignManager) throw new Error('Campaign manager not ready');
    return campaignManager.resumeCampaign({ campaignId });
  } catch (error) {
    return { status: false, message: error.message };
  }
});

ipcMain.handle('campaign:stop', async (event, { campaignId }) => {
  try {
    if (!campaignManager) throw new Error('Campaign manager not ready');
    return campaignManager.stopCampaign({ campaignId });
  } catch (error) {
    return { status: false, message: error.message };
  }
});

ipcMain.handle('dashboard:statistics', async (event, { userId }) => {
  try {
    const key = userId || getAuthUserId();
    if (!key) return { status: false, message: 'User not found' };
    return computeStatistics(store, key);
  } catch (error) {
    console.error('dashboard:statistics error:', error);
    return { status: false, message: error.message };
  }
});

// Local template storage
ipcMain.handle('templates:get', async (event, { userId }) => {
  try {
    if (!userId) throw new Error('UserId is required');
    return { success: true, templates: store.get(`templates.${userId}`) || [] };
  } catch (error) {
    console.error('Failed to get templates:', error);
    return { success: false, error: error.message, templates: [] };
  }
});

ipcMain.handle('templates:save', async (event, { userId, templates }) => {
  try {
    if (!userId) throw new Error('UserId is required');
    store.set(`templates.${userId}`, Array.isArray(templates) ? templates : []);
    return { success: true };
  } catch (error) {
    console.error('Failed to save templates:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('template:upload-media', async (event, { fileName, mimeType, data }) => {
  try {
    if (!fileName || !data?.length) throw new Error('Invalid media payload');

    const dir = getLocalMediaDir();
    const ext = path.extname(fileName) || '';
    const savedName = `${Date.now()}_${randomUUID()}${ext}`;
    const savedPath = path.join(dir, savedName);
    fs.writeFileSync(savedPath, Buffer.from(data));

    const url = `local-media://${savedName}`;
    return {
      status: true,
      message: 'Media saved locally',
      data: { url, fileName: savedName, mimeType, size: data.length },
    };
  } catch (error) {
    console.error('template:upload-media error:', error);
    return { status: false, message: error.message };
  }
});

// Local WhatsApp (Baileys sessions in userData/sessions)
ipcMain.handle('whatsapp:qr', async (event, { instance }) => {
  try {
    if (!whatsappManager) throw new Error('WhatsApp manager not ready');
    return await whatsappManager.generateQR(instance);
  } catch (error) {
    console.error('whatsapp:qr error:', error);
    return { status: false, message: error.message };
  }
});

ipcMain.handle('whatsapp:pairing', async (event, { instance, phoneNumber }) => {
  try {
    if (!whatsappManager) throw new Error('WhatsApp manager not ready');
    return await whatsappManager.generatePairingCode(instance, phoneNumber);
  } catch (error) {
    console.error('whatsapp:pairing error:', error);
    return { status: false, message: error.message };
  }
});

ipcMain.handle('whatsapp:logout', async (event, { instance }) => {
  try {
    if (!whatsappManager) throw new Error('WhatsApp manager not ready');
    const result = await whatsappManager.logout(instance);
    if (result.status) persistInstanceToStore(instance._id, result.instance || { whatsapp: { status: 'disconnected' } });
    return result;
  } catch (error) {
    console.error('whatsapp:logout error:', error);
    return { status: false, message: error.message };
  }
});

ipcMain.handle('whatsapp:delete-session', async (event, { instance }) => {
  try {
    if (!whatsappManager) throw new Error('WhatsApp manager not ready');
    return await whatsappManager.deleteSession(instance);
  } catch (error) {
    console.error('whatsapp:delete-session error:', error);
    return { status: false, message: error.message };
  }
});

ipcMain.handle('whatsapp:session-path', async () => {
  return { path: whatsappManager?.getSessionPath?.() || null };
});

ipcMain.handle('whatsapp:business-catalog', async (event, { instanceId }) => {
  try {
    if (!whatsappManager) throw new Error('WhatsApp manager not ready');
    return await whatsappManager.fetchBusinessCatalog(instanceId);
  } catch (error) {
    console.error('whatsapp:business-catalog error:', error);
    return { status: false, message: error.message };
  }
});

// Auto-updater events
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-not-available', () => {
  mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('error', (err) => {
  mainWindow.webContents.send('update-error', err.message);
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('check-for-updates', () => {
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }
});

// App lifecycle
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const appIcon = getAppIcon(256);
    if (appIcon && process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(appIcon);
    }
    registerLocalMediaProtocol();
    const storedUser = store.get('auth_user');
    const userData = app.getPath('userData');
    process.env.USER_DATA_PATH = userData;
    process.env.LOCAL_MEDIA_GLOBAL_PATH = path.join(userData, 'local-media');
    if (storedUser) {
      applyUserSession({ app, store, user: storedUser });
    } else {
      process.env.LOCAL_MEDIA_PATH = getLocalMediaDir();
      process.env.LOCAL_MEDIA_LEGACY_PATH = path.join(userData, 'template-media');
    }
    initWhatsAppManager();
    initCampaignManager();
    createWindow();
    // Defer Baileys restore so the window can paint first (avoids Not Responding)
    if (storedUser) {
      setTimeout(() => {
        restoreWhatsAppSessions().catch((err) => {
          console.warn('deferred session restore failed:', err?.message || err);
        });
      }, 4000);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
