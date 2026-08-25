const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const electronCore = require('../electron-core/index.cjs');
const { applyUserSession, consolidateSessionsToTarget } = require('./user-session.cjs');

function createWhatsAppManager({ app, store, getMainWindow, getAuthUserId, onInstancePersist }) {
  electronCore.configurePaths(app);

  const runtimeRequire = electronCore.getRuntimeRequire();

  function reloadBackendModule(modulePath) {
    try {
      const resolved = runtimeRequire.resolve(modulePath);
      delete runtimeRequire.cache[resolved];
      return runtimeRequire(modulePath);
    } catch {
      return runtimeRequire(modulePath);
    }
  }

  const sessions = runtimeRequire('./utils/sessions');
  const instanceRegistry = runtimeRequire('./utils/instanceRegistry');

  reloadBackendModule('./utils/resolveMedia.util');
  const WhatsAppInstance = reloadBackendModule('./utils/whatsapp.instance');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const loadPromises = new Map();
  let prepareInFlight = null;
  let prepareInFlightKey = null;

  instanceRegistry.setOnUpdate((instanceId, data) => {
    if (onInstancePersist) {
      onInstancePersist(instanceId, data);
    }
  });

  const originalEmit = WhatsAppInstance.prototype.emitToUser;
  WhatsAppInstance.prototype.emitToUser = async function emitToUserLocal(userId, eventName, data) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('whatsapp:event', { userId, eventName, data });
    }
    try {
      await originalEmit.call(this, userId, eventName, data);
    } catch (_) {
      /* socket.io optional in Electron */
    }
  };

  let activeSessionUserKey = null;

  function sessionRoot() {
    return process.env.LOCAL_SESSION_PATH || '';
  }

  /** Only the currently logged-in user's session folder — never other users. */
  function getCurrentUserSessionRoot() {
    return sessionRoot();
  }

  function hasSavedSession(instanceId) {
    const root = getCurrentUserSessionRoot();
    if (!root || !instanceId) return false;
    return fs.existsSync(path.join(root, instanceId.toString(), 'creds.json'));
  }

  function mergeInstancesWithDisk(storedInstances, userKey) {
    const map = new Map();
    for (const inst of storedInstances || []) {
      if (inst?._id) map.set(inst._id.toString(), inst);
    }

    const root = getCurrentUserSessionRoot();
    if (!root || !fs.existsSync(root)) {
      return Array.from(map.values());
    }

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      if (!fs.existsSync(path.join(root, id, 'creds.json'))) continue;

      const existing = map.get(id);
      if (existing) {
        // Keep existing store status — do not force "connected" or bump updatedAt on every read
        // (that caused Devices page to look like it was constantly refreshing).
        map.set(id, {
          ...existing,
          userId: existing.userId || userKey,
        });
      } else {
        map.set(id, {
          _id: id,
          userId: userKey,
          name: `Device ${map.size + 1}`,
          loginType: 'QR',
          whatsapp: { status: 'connected', name: ' ' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return Array.from(map.values());
  }

  function getStoredInstances(store, userKey) {
    if (!userKey) return [];
    return store.get(`instances.${userKey}`) || [];
  }

  async function detachMemorySessions() {
    for (const [id, whatsappInstance] of sessions.entries()) {
      try {
        await whatsappInstance.destroy?.();
      } catch (_) {}
      sessions.delete(id);
    }
    try {
      instanceRegistry.clear?.();
    } catch (_) {}
    loadPromises.clear();
    prepareInFlight = null;
    prepareInFlightKey = null;
    activeSessionUserKey = null;
    console.log('Detached in-memory WhatsApp sessions (disk creds kept)');
  }

  function syncInstancesFromDisk(store, userKey, instancesOverride) {
    let instances = instancesOverride ?? getStoredInstances(store, userKey);
    const userData = process.env.USER_DATA_PATH || '';
    const targetRoot = getCurrentUserSessionRoot();
    const legacyGlobal = userData ? path.join(userData, 'sessions') : null;
    if (targetRoot && legacyGlobal) {
      consolidateSessionsToTarget(targetRoot, [legacyGlobal]);
    }
    instances = mergeInstancesWithDisk(instances, userKey);
    const prev = store.get(`instances.${userKey}`) || [];
    const changed =
      prev.length !== instances.length ||
      instances.some((inst) => {
        const p = prev.find((x) => String(x?._id) === String(inst?._id));
        return (
          !p ||
          p?.whatsapp?.status !== inst?.whatsapp?.status ||
          p?.whatsapp?.phone !== inst?.whatsapp?.phone ||
          p?.name !== inst?.name
        );
      });
    if (changed && instances.length > 0) {
      store.set(`instances.${userKey}`, instances);
    }
    return instances;
  }

  async function prepareAndLoadSessions({ store, userKey, user, instances: instancesOverride }) {
    if (!store || !userKey) return;

    if (prepareInFlight && prepareInFlightKey === userKey) {
      return prepareInFlight;
    }

    prepareInFlightKey = userKey;
    prepareInFlight = (async () => {
      if (activeSessionUserKey && activeSessionUserKey !== userKey) {
        await detachMemorySessions();
      }
      activeSessionUserKey = userKey;

      if (user && app) {
        applyUserSession({ app, store, user });
      }

      console.log('[whatsapp] LOCAL_SESSION_PATH=', process.env.LOCAL_SESSION_PATH);

      // Reloading WhatsAppInstance while socks are live breaks sending — only when empty
      if (sessions.size === 0) {
        reloadBackendModule('./utils/whatsapp.instance');
      }

      const instances = syncInstancesFromDisk(store, userKey, instancesOverride);

      console.log('Preparing sessions for user', userKey, '- instances:', instances.length);
      await loadWhatsAppSessions(instances);
    })().finally(() => {
      prepareInFlight = null;
      prepareInFlightKey = null;
    });

    return prepareInFlight;
  }

  async function loadOneSession(instance) {
    if (!instance?._id) return;
    const instanceId = instance._id.toString();

    if (loadPromises.has(instanceId)) {
      return loadPromises.get(instanceId);
    }

    const task = loadOneSessionInner(instance).finally(() => {
      loadPromises.delete(instanceId);
    });
    loadPromises.set(instanceId, task);
    return task;
  }

  async function loadOneSessionInner(instance) {
    const instanceId = instance._id.toString();
    instanceRegistry.registerInstance(instanceId, instance);

    const existing = sessions.get(instanceId);
    if (existing) {
      // Healthy or still bringing sock up — never destroy mid-reconnect
      if (existing.connected && existing.sock) {
        console.log('Session healthy, skipping reconnect:', instanceId);
        return existing;
      }
      if (existing._loading || existing.sock || existing.restart) {
        console.log('Session connecting/reconnecting, waiting:', instanceId);
        return existing;
      }

      console.log('Session dead (no sock), full restart:', instanceId);
      try {
        await existing.destroy();
      } catch (_) {}
      sessions.delete(instanceId);
    }

    console.log('Creating WhatsApp Session:', instanceId);
    const session = new WhatsAppInstance(instanceId);
    session._loading = true;
    try {
      await session.create();
      await session.init();
    } finally {
      session._loading = false;
    }
    sessions.set(instanceId, session);
    return session;
  }

  async function loadWhatsAppSessions(instances) {
    const list = Array.isArray(instances) ? instances : [];
    // Cap auto-load so opening Bulk WA does not spawn dozens of Baileys sockets at once.
    // Remaining instances connect on demand (QR / Connect / campaign).
    const MAX_AUTO_SESSIONS = 2;
    const ranked = list.filter((inst) => {
      if (!inst?._id) return false;
      const status = String(inst?.whatsapp?.status || '').toLowerCase();
      return status === 'connected' || status === 'open';
    });
    const toLoad = ranked.slice(0, MAX_AUTO_SESSIONS);

    console.log(
      'Loading WhatsApp Sessions:',
      toLoad.length,
      ranked.length > MAX_AUTO_SESSIONS
        ? `(capped from ${ranked.length}; others on demand)`
        : ''
    );

    for (const instance of toLoad) {
      try {
        await loadOneSession(instance);
      } catch (e) {
        console.error('Failed to load session', instance._id, e?.message || e);
      }
      // Yield so TextNexus UI stays responsive during restore
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  async function ensureSession(instanceData) {
    if (!instanceData?._id) {
      throw new Error('Instance data is required');
    }
    return loadOneSession(instanceData);
  }

  async function generateQR(instanceData) {
    if (!instanceData?._id) {
      throw new Error('Instance data is required');
    }
    const instanceId = instanceData._id.toString();
    instanceRegistry.registerInstance(instanceId, instanceData);

    let whatsappInstance = sessions.get(instanceId);
    if (!whatsappInstance) {
      whatsappInstance = await loadOneSession(instanceData);
      await sleep(2000);
    }

    if (whatsappInstance.connected) {
      return { status: true, isConnected: true, message: 'Instance already connected' };
    }

    if (whatsappInstance.qrTimestamp || !whatsappInstance.connected) {
      await whatsappInstance.destroy();
      await whatsappInstance.create();
      await whatsappInstance.init();
      await sleep(2000);
    }

    await sleep(1000);
    const qr = whatsappInstance.qr;
    if (qr) {
      return { status: true, message: 'QR code generated', qr, isConnected: false };
    }
    return { status: false, message: 'QR code not generated yet' };
  }

  async function generatePairingCode(instanceData, phoneNumber) {
    const whatsappInstance = await ensureSession(instanceData);
    if (whatsappInstance.connected) {
      return { status: false, message: 'Instance already connected' };
    }
    const code = await whatsappInstance.requestPairingCode(phoneNumber);
    return { status: true, message: 'Pairing code generated', code };
  }

  async function logout(instanceData) {
    const instanceId = instanceData._id?.toString();
    instanceRegistry.registerInstance(instanceId, instanceData);

    let whatsappInstance = sessions.get(instanceId);
    if (!whatsappInstance) {
      whatsappInstance = await loadOneSession(instanceData);
      await sleep(1500);
    }

    const result = await whatsappInstance.logout();
    if (!result) {
      return { status: false, message: 'No active session found to disconnect' };
    }

    instanceRegistry.updateInstance(instanceId, {
      whatsapp: {
        ...(instanceData.whatsapp || {}),
        status: 'disconnected',
        phone: null,
        profile: null,
        name: null,
        qr: '',
      },
    });

    return { status: true, message: 'Instance disconnected successfully' };
  }

  async function deleteSession(instanceData) {
    const instanceId = instanceData._id?.toString();
    const whatsappInstance = sessions.get(instanceId);
    if (whatsappInstance) {
      try {
        await whatsappInstance.logout();
      } catch (_) {}
      sessions.delete(instanceId);
    }
    instanceRegistry.removeInstance(instanceId);
    return { status: true, message: 'Session removed' };
  }

  async function restoreSessions(instances) {
    const authUser = store?.get?.('auth_user');
    const userKey = getAuthUserId?.() || null;
    if (authUser && app && userKey) {
      await prepareAndLoadSessions({ store, userKey, user: authUser, instances });
      return;
    }
    await loadWhatsAppSessions(instances);
  }

  async function fetchBusinessCatalog(instanceId) {
    if (!instanceId) {
      return { status: false, message: 'instanceId is required' };
    }
    const whatsappInstance = sessions.get(instanceId.toString());
    if (!whatsappInstance) {
      return {
        status: false,
        message: 'WhatsApp session not loaded. Connect instance first.',
      };
    }
    if (!whatsappInstance.connected) {
      return { status: false, message: 'Instance is not connected' };
    }
    return whatsappInstance.fetchBusinessCatalogSnapshot();
  }

  return {
    generateQR,
    generatePairingCode,
    logout,
    deleteSession,
    restoreSessions,
    loadWhatsAppSessions,
    prepareAndLoadSessions,
    detachMemorySessions,
    syncInstancesFromDisk,
    ensureSession,
    hasSavedSession,
    fetchBusinessCatalog,
    getSessionPath: () => process.env.LOCAL_SESSION_PATH,
  };
}

module.exports = { createWhatsAppManager };
