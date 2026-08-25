'use strict';

const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { pathToFileURL } = require('url');
const { createRequire } = require('module');
const { app, ipcMain, protocol, net, webContents } = require('electron');

const { createWhatsAppManager } = require('./whatsapp-manager.cjs');
const { createCampaignManager } = require('./campaign-manager.cjs');
const { applyUserSession, getLocalUserKeyFromUser } = require('./user-session.cjs');
const { computeStatistics } = require('../electron-core/mvc/services/statistics.service.cjs');

const KEYTAR_SERVICE = 'BulkWhatsApp';
const KEYTAR_ACCOUNT = 'RefreshToken';
const LOCAL_MEDIA_DIR = 'local-media';
const EMBED_STORE_NAME = 'bulk-whatsapp-embed';
const EMBED_ENCRYPTION_KEY = 'bulk-whatsapp-embed-encryption-key-v1';

let started = false;
let store = null;
let keytar = null;
let whatsappManager = null;
let campaignManager = null;
let getHostWindow = null;

try {
  if (app.isReady()) {
    console.warn(
      '[bulk-embed] protocol.registerSchemesAsPrivileged skipped: app already ready. local-media may need host registration.'
    );
  } else {
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
  }
} catch (err) {
  console.warn('[bulk-embed] registerSchemesAsPrivileged failed:', err?.message || err);
}

function getBulkUserDataRoot() {
  const root = path.join(app.getPath('userData'), 'bulk-whatsapp');
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function setBulkEnvPaths(phoneKey) {
  const bulkUserData = getBulkUserDataRoot();
  process.env.USER_DATA_PATH = bulkUserData;
  process.env.LOCAL_MEDIA_GLOBAL_PATH = path.join(bulkUserData, 'local-media');
  process.env.LOCAL_MEDIA_LEGACY_PATH = path.join(bulkUserData, 'template-media');
  fs.mkdirSync(process.env.LOCAL_MEDIA_GLOBAL_PATH, { recursive: true });

  if (phoneKey) {
    const sessions = path.join(bulkUserData, 'users', phoneKey, 'sessions');
    const media = path.join(bulkUserData, 'users', phoneKey, 'local-media');
    fs.mkdirSync(sessions, { recursive: true });
    fs.mkdirSync(media, { recursive: true });
    process.env.LOCAL_SESSION_PATH = sessions;
    process.env.LOCAL_MEDIA_PATH = media;
  } else {
    process.env.LOCAL_SESSION_PATH = path.join(bulkUserData, 'sessions');
    process.env.LOCAL_MEDIA_PATH = path.join(bulkUserData, 'local-media');
    fs.mkdirSync(process.env.LOCAL_SESSION_PATH, { recursive: true });
    fs.mkdirSync(process.env.LOCAL_MEDIA_PATH, { recursive: true });
  }
}

function getLocalMediaDir() {
  const dir = process.env.LOCAL_MEDIA_PATH || path.join(getBulkUserDataRoot(), LOCAL_MEDIA_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function registerLocalMediaProtocol() {
  try {
    if (typeof protocol.isProtocolHandled === 'function' && protocol.isProtocolHandled('local-media')) {
      return;
    }
  } catch (_) {
    /* continue and try handle */
  }

  try {
    const mediaDir = getLocalMediaDir();
    const bulkUserData = getBulkUserDataRoot();
    const legacyDir = path.join(bulkUserData, 'template-media');
    const globalDir = path.join(bulkUserData, 'local-media');

    protocol.handle('local-media', (request) => {
      try {
        const fileName = path.basename(
          decodeURIComponent(request.url.replace(/^local-media:\/\//, ''))
        );
        const candidates = [
          path.join(mediaDir, fileName),
          path.join(globalDir, fileName),
          path.join(legacyDir, fileName),
        ];
        try {
          const usersDir = path.join(bulkUserData, 'users');
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
        console.error('[bulk-embed] local-media protocol error:', error);
        return new Response('Error', { status: 500 });
      }
    });
  } catch (err) {
    console.warn('[bulk-embed] protocol.handle(local-media) failed:', err?.message || err);
  }
}

function broadcastSend(channel, data) {
  const host = typeof getHostWindow === 'function' ? getHostWindow() : null;
  const sent = new Set();

  const trySend = (wc) => {
    if (!wc || typeof wc.send !== 'function') return;
    try {
      if (wc.isDestroyed?.()) return;
    } catch (_) {
      return;
    }
    if (sent.has(wc)) return;
    sent.add(wc);
    try {
      wc.send(channel, data);
    } catch (_) {}
  };

  if (host?.webContents) {
    trySend(host.webContents);
  }

  try {
    for (const wc of webContents.getAllWebContents()) {
      trySend(wc);
    }
  } catch (_) {}
}

function getMainWindow() {
  const host = typeof getHostWindow === 'function' ? getHostWindow() : null;
  if (host && typeof host.isDestroyed === 'function' && host.isDestroyed()) {
    return {
      isDestroyed: () => true,
      webContents: { send: broadcastSend },
    };
  }
  return {
    isDestroyed: () => (host && typeof host.isDestroyed === 'function' ? host.isDestroyed() : false),
    webContents: { send: broadcastSend },
  };
}

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
    getMainWindow,
    getAuthUserId,
    onInstancePersist: persistInstanceToStore,
  });
}

function initCampaignManager() {
  campaignManager = createCampaignManager({
    store,
    app,
    getMainWindow,
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

async function saveSecureToken(token) {
  if (keytar) {
    try {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, token);
      return { success: true };
    } catch (error) {
      console.warn('[bulk-embed] keytar setPassword failed, using electron-store:', error?.message || error);
    }
  }
  store.set('secure_refresh_token', token);
  return { success: true };
}

async function getSecureToken() {
  if (keytar) {
    try {
      const fromKeytar = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
      if (fromKeytar != null) return fromKeytar;
    } catch (error) {
      console.warn('[bulk-embed] keytar getPassword failed, using electron-store:', error?.message || error);
    }
  }
  return store.get('secure_refresh_token') || null;
}

async function clearSecureToken() {
  if (keytar) {
    try {
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    } catch (error) {
      console.warn('[bulk-embed] keytar deletePassword failed:', error?.message || error);
    }
  }
  store.delete('secure_refresh_token');
}

function applyEmbedUserSession(user, phoneFallback) {
  // Set bulk-whatsapp root BEFORE applyUserSession so session path stays under bulk-whatsapp/
  const previewKey =
    getLocalUserKeyFromUser(
      typeof user === 'object' && user
        ? { ...user, phone: user.phone || phoneFallback }
        : user
    ) || null;
  setBulkEnvPaths(previewKey);

  const session = applyUserSession({ app, store, user, phoneFallback });
  const phoneKey = session?.phoneKey || getLocalUserKeyFromUser(session?.user || user);
  setBulkEnvPaths(phoneKey || null);
  if (process.env.LOCAL_SESSION_PATH !== applyEmbedUserSession._lastPath) {
    applyEmbedUserSession._lastPath = process.env.LOCAL_SESSION_PATH;
    console.log('[bulk-embed] session path:', process.env.LOCAL_SESSION_PATH);
  }
  return session;
}

function createJsonFileStore(filePath) {
  const data = {};
  const load = () => {
    try {
      if (fs.existsSync(filePath)) {
        Object.assign(data, JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}'));
      }
    } catch (_) {
      /* keep empty */
    }
  };
  const save = () => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
    } catch (err) {
      console.warn('[bulk-embed] JSON store save failed:', err?.message || err);
    }
  };
  load();
  return {
    get(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined;
    },
    set(key, value) {
      data[key] = value;
      save();
    },
    delete(key) {
      delete data[key];
      save();
    },
  };
}

function safeHandle(channel, handler) {
  try {
    ipcMain.removeHandler(channel);
  } catch (_) {
    /* none */
  }
  ipcMain.handle(channel, handler);
}

function registerAuthIpcHandlers() {
  safeHandle('auth:save-token', async (event, token) => {
    try {
      store.set('auth_token', token);
      return { success: true };
    } catch (error) {
      console.error('[bulk-embed] Failed to save token:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle('auth:get-token', async () => {
    try {
      return store.get('auth_token');
    } catch (error) {
      console.error('[bulk-embed] Failed to get token:', error);
      return null;
    }
  });

  safeHandle('auth:save-user', async (event, payload) => {
    try {
      const user = payload?.user ?? payload;
      const phoneFallback = payload?.phoneFallback || user?.phone;
      const loadSessions = payload?.loadSessions === true;
      const previousKey = store.get('last_phone_key') || getAuthUserId();
      const session = applyEmbedUserSession(user, phoneFallback);
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
      console.error('[bulk-embed] Failed to save user:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle('auth:get-user', async () => {
    try {
      return store.get('auth_user');
    } catch (error) {
      console.error('[bulk-embed] Failed to get user:', error);
      return null;
    }
  });

  safeHandle('auth:clear-token', async () => {
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
      await clearSecureToken();
      return { success: true };
    } catch (error) {
      console.error('[bulk-embed] Failed to clear auth:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle('auth:save-secure-token', async (event, token) => {
    try {
      return await saveSecureToken(token);
    } catch (error) {
      console.error('[bulk-embed] Failed to save secure token:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle('auth:get-secure-token', async () => {
    try {
      return await getSecureToken();
    } catch (error) {
      console.error('[bulk-embed] Failed to get secure token:', error);
      return null;
    }
  });
}

function registerIpcHandlers() {
  registerAuthIpcHandlers();

  safeHandle('sessions:reload', async () => {
    try {
      await restoreWhatsAppSessions();
      return { success: true };
    } catch (error) {
      console.error('[bulk-embed] sessions:reload error:', error);
      return { success: false, message: error.message };
    }
  });

  safeHandle('messages:save', async (event, { userId, message }) => {
    try {
      if (!userId || !message) throw new Error('UserId and message are required');
      const key = `messages.${userId}.${message.instance_id}`;
      const existingMessages = store.get(key) || [];
      existingMessages.unshift(message);
      if (existingMessages.length > 1000) {
        existingMessages.length = 1000;
      }
      store.set(key, existingMessages);
      return { success: true };
    } catch (error) {
      console.error('[bulk-embed] Failed to save message:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle('messages:get', async (event, { userId, instanceId, page = 1, limit = 20, search }) => {
    try {
      if (!userId || !instanceId) throw new Error('UserId and instanceId are required');
      const key = `messages.${userId}.${instanceId}`;
      let messages = store.get(key) || [];
      if (search) {
        const searchLower = search.toLowerCase();
        messages = messages.filter(
          (msg) =>
            (msg.from && msg.from.toLowerCase().includes(searchLower)) ||
            (msg.pushName && msg.pushName.toLowerCase().includes(searchLower)) ||
            (msg.message && msg.message.toLowerCase().includes(searchLower))
        );
      }
      const total = messages.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedMessages = messages.slice(startIndex, endIndex);
      return {
        success: true,
        data: paginatedMessages,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      };
    } catch (error) {
      console.error('[bulk-embed] Failed to get messages:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle('messages:clear', async (event, { userId, instanceId }) => {
    try {
      if (!userId || !instanceId) throw new Error('UserId and instanceId are required');
      store.delete(`messages.${userId}.${instanceId}`);
      return { success: true };
    } catch (error) {
      console.error('[bulk-embed] Failed to clear messages:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle('instances:get', async (event, { userId }) => {
    try {
      if (!userId) throw new Error('UserId is required');
      // Do NOT re-apply user session on every list read — that spammed path resets and UI refreshes.
      let instances = store.get(`instances.${userId}`) || [];
      if (whatsappManager) {
        instances = whatsappManager.syncInstancesFromDisk(store, userId, instances);
      }
      return { success: true, instances };
    } catch (error) {
      console.error('[bulk-embed] Failed to get instances:', error);
      return { success: false, error: error.message, instances: [] };
    }
  });

  safeHandle('instances:save', async (event, { userId, instances }) => {
    try {
      if (!userId) throw new Error('UserId is required');
      store.set(`instances.${userId}`, Array.isArray(instances) ? instances : []);
      return { success: true };
    } catch (error) {
      console.error('[bulk-embed] Failed to save instances:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle('campaigns:get', async (event, { userId }) => {
    try {
      if (!userId) throw new Error('UserId is required');
      return { success: true, campaigns: store.get(`campaigns.${userId}`) || [] };
    } catch (error) {
      console.error('[bulk-embed] Failed to get campaigns:', error);
      return { success: false, error: error.message, campaigns: [] };
    }
  });

  safeHandle('campaigns:save', async (event, { userId, campaigns }) => {
    try {
      if (!userId) throw new Error('UserId is required');
      store.set(`campaigns.${userId}`, Array.isArray(campaigns) ? campaigns : []);
      return { success: true };
    } catch (error) {
      console.error('[bulk-embed] Failed to save campaigns:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle('campaign:send', async (event, { userId, campaignId }) => {
    try {
      if (!campaignManager) throw new Error('Campaign manager not ready');
      return await campaignManager.sendCampaign({ userId, campaignId });
    } catch (error) {
      console.error('[bulk-embed] campaign:send error:', error);
      return { status: false, message: error.message };
    }
  });

  safeHandle('campaign:pause', async (event, { campaignId }) => {
    try {
      if (!campaignManager) throw new Error('Campaign manager not ready');
      return campaignManager.pauseCampaign({ campaignId });
    } catch (error) {
      return { status: false, message: error.message };
    }
  });

  safeHandle('campaign:resume', async (event, { campaignId }) => {
    try {
      if (!campaignManager) throw new Error('Campaign manager not ready');
      return campaignManager.resumeCampaign({ campaignId });
    } catch (error) {
      return { status: false, message: error.message };
    }
  });

  safeHandle('campaign:stop', async (event, { campaignId }) => {
    try {
      if (!campaignManager) throw new Error('Campaign manager not ready');
      return campaignManager.stopCampaign({ campaignId });
    } catch (error) {
      return { status: false, message: error.message };
    }
  });

  safeHandle('dashboard:statistics', async (event, { userId }) => {
    try {
      const key = userId || getAuthUserId();
      if (!key) return { status: false, message: 'User not found' };
      return computeStatistics(store, key);
    } catch (error) {
      console.error('[bulk-embed] dashboard:statistics error:', error);
      return { status: false, message: error.message };
    }
  });

  safeHandle('templates:get', async (event, { userId }) => {
    try {
      if (!userId) throw new Error('UserId is required');
      return { success: true, templates: store.get(`templates.${userId}`) || [] };
    } catch (error) {
      console.error('[bulk-embed] Failed to get templates:', error);
      return { success: false, error: error.message, templates: [] };
    }
  });

  safeHandle('templates:save', async (event, { userId, templates }) => {
    try {
      if (!userId) throw new Error('UserId is required');
      store.set(`templates.${userId}`, Array.isArray(templates) ? templates : []);
      return { success: true };
    } catch (error) {
      console.error('[bulk-embed] Failed to save templates:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle('template:upload-media', async (event, { fileName, mimeType, data }) => {
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
      console.error('[bulk-embed] template:upload-media error:', error);
      return { status: false, message: error.message };
    }
  });

  safeHandle('whatsapp:qr', async (event, { instance }) => {
    try {
      if (!whatsappManager) throw new Error('WhatsApp manager not ready');
      return await whatsappManager.generateQR(instance);
    } catch (error) {
      console.error('[bulk-embed] whatsapp:qr error:', error);
      return { status: false, message: error.message };
    }
  });

  safeHandle('whatsapp:pairing', async (event, { instance, phoneNumber }) => {
    try {
      if (!whatsappManager) throw new Error('WhatsApp manager not ready');
      return await whatsappManager.generatePairingCode(instance, phoneNumber);
    } catch (error) {
      console.error('[bulk-embed] whatsapp:pairing error:', error);
      return { status: false, message: error.message };
    }
  });

  safeHandle('whatsapp:logout', async (event, { instance }) => {
    try {
      if (!whatsappManager) throw new Error('WhatsApp manager not ready');
      const result = await whatsappManager.logout(instance);
      if (result.status) {
        persistInstanceToStore(instance._id, result.instance || { whatsapp: { status: 'disconnected' } });
      }
      return result;
    } catch (error) {
      console.error('[bulk-embed] whatsapp:logout error:', error);
      return { status: false, message: error.message };
    }
  });

  safeHandle('whatsapp:delete-session', async (event, { instance }) => {
    try {
      if (!whatsappManager) throw new Error('WhatsApp manager not ready');
      return await whatsappManager.deleteSession(instance);
    } catch (error) {
      console.error('[bulk-embed] whatsapp:delete-session error:', error);
      return { status: false, message: error.message };
    }
  });

  safeHandle('whatsapp:session-path', async () => {
    return { path: whatsappManager?.getSessionPath?.() || null };
  });

  safeHandle('whatsapp:business-catalog', async (event, { instanceId }) => {
    try {
      if (!whatsappManager) throw new Error('WhatsApp manager not ready');
      return await whatsappManager.fetchBusinessCatalog(instanceId);
    } catch (error) {
      console.error('[bulk-embed] whatsapp:business-catalog error:', error);
      return { status: false, message: error.message };
    }
  });

  // No-op updater hooks (standalone app owns autoUpdater)
  ipcMain.on('restart-app', () => {
    console.warn('[bulk-embed] restart-app ignored in embed host');
  });

  ipcMain.on('check-for-updates', () => {
    console.warn('[bulk-embed] check-for-updates ignored in embed host');
  });
}

/**
 * Start Bulk WhatsApp IPC/host services inside a host Electron app (e.g. TextNexus).
 * Does not create a BrowserWindow or take over app lifecycle.
 *
 * @param {{ getHostWindow: () => (Electron.BrowserWindow|null|undefined), bulkRoot: string, ElectronStore?: any }} opts
 */
async function startBulkEmbedHost({ getHostWindow: getHostWindowFn, bulkRoot, ElectronStore } = {}) {
  if (started) {
    if (typeof getHostWindowFn === 'function') {
      getHostWindow = getHostWindowFn;
    }
    return { alreadyStarted: true };
  }

  if (!bulkRoot) {
    throw new Error('startBulkEmbedHost requires bulkRoot (path to bulk-whatsapp/frontend)');
  }
  if (typeof getHostWindowFn !== 'function') {
    throw new Error('startBulkEmbedHost requires getHostWindow()');
  }

  getHostWindow = getHostWindowFn;

  // Always have a store so auth IPC can register even if electron-store is missing in packaged builds
  const fallbackPath = path.join(app.getPath('userData'), 'bulk-whatsapp', 'embed-store.json');
  store = createJsonFileStore(fallbackPath);

  const tryLoadStore = () => {
    if (ElectronStore) {
      const Store = ElectronStore.default || ElectronStore;
      return new Store({
        name: EMBED_STORE_NAME,
        encryptionKey: EMBED_ENCRYPTION_KEY,
        accessPropertiesByDotNotation: false,
      });
    }
    const candidates = [
      path.join(bulkRoot, 'package.json'),
      path.join(bulkRoot, 'electron-core', 'package.json'),
      path.join(bulkRoot, 'electron-core', 'runtime', 'package.json'),
    ];
    for (const pkg of candidates) {
      try {
        const req = createRequire(pkg);
        const StoreMod = req('electron-store');
        const Store = StoreMod?.default || StoreMod;
        return new Store({
          name: EMBED_STORE_NAME,
          encryptionKey: EMBED_ENCRYPTION_KEY,
          accessPropertiesByDotNotation: false,
        });
      } catch (_) {
        /* try next */
      }
    }
    try {
      const StoreMod = require('electron-store');
      const Store = StoreMod?.default || StoreMod;
      return new Store({
        name: EMBED_STORE_NAME,
        encryptionKey: EMBED_ENCRYPTION_KEY,
        accessPropertiesByDotNotation: false,
      });
    } catch (_) {
      return null;
    }
  };

  try {
    const upgraded = tryLoadStore();
    if (upgraded) {
      // migrate fallback keys into electron-store once
      for (const key of ['auth_token', 'auth_user', 'last_phone_key', 'secure_refresh_token']) {
        const val = store.get(key);
        if (val != null && upgraded.get(key) == null) {
          upgraded.set(key, val);
        }
      }
      store = upgraded;
      console.log('[bulk-embed] using electron-store');
    } else {
      console.warn('[bulk-embed] electron-store unavailable — using JSON file store');
    }
  } catch (err) {
    console.warn('[bulk-embed] electron-store init failed, keeping JSON store:', err?.message || err);
  }

  // Auth IPC first — login must work even if WhatsApp managers fail to load
  registerAuthIpcHandlers();
  console.log('[bulk-embed] auth IPC registered');

  try {
    const reqFromBulk = createRequire(path.join(bulkRoot, 'electron-core', 'package.json'));
    try {
      const keytarMod = reqFromBulk('keytar');
      keytar = keytarMod?.default || keytarMod;
    } catch {
      try {
        const keytarMod = require('keytar');
        keytar = keytarMod?.default || keytarMod;
      } catch (err) {
        console.warn('[bulk-embed] keytar unavailable, secure tokens use store:', err?.message || err);
        keytar = null;
      }
    }
  } catch {
    keytar = null;
  }

  try {
    registerLocalMediaProtocol();
  } catch (err) {
    console.warn('[bulk-embed] local-media protocol failed:', err?.message || err);
  }

  setBulkEnvPaths(null);

  const storedUser = store.get('auth_user');
  if (storedUser) {
    try {
      applyEmbedUserSession(storedUser);
    } catch (err) {
      console.warn('[bulk-embed] restore session paths failed:', err?.message || err);
    }
  }

  try {
    initWhatsAppManager();
    initCampaignManager();
    registerIpcHandlers();
  } catch (err) {
    console.error('[bulk-embed] WhatsApp/campaign init failed (auth still works):', err);
    // Auth already registered; register remaining non-auth handlers best-effort
    try {
      registerIpcHandlers();
    } catch (e2) {
      console.error('[bulk-embed] full IPC register failed:', e2?.message || e2);
    }
  }

  started = true;

  if (storedUser) {
    setTimeout(() => {
      restoreWhatsAppSessions().catch((err) => {
        console.warn('[bulk-embed] deferred session restore failed:', err?.message || err);
      });
    }, 4000);
  }

  return { alreadyStarted: false };
}

module.exports = {
  startBulkEmbedHost,
  isStarted: () => started,
};
