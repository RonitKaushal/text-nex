const electronCore = require('../electron-core/index.cjs');
const { applyUserSession } = require('./user-session.cjs');

function createCampaignManager({
  store,
  app,
  getMainWindow,
  getAuthUserId,
  syncInstancesFromDisk,
  ensureSession,
  hasSavedSession,
  prepareAndLoadSessions,
}) {
  if (app) {
    electronCore.configurePaths(app);
  }

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

  const Message = runtimeRequire('./models/message.model');
  let CampaignProcessor = runtimeRequire('./utils/sendmessage.util');
  const socketModule = runtimeRequire('./utils/socket.io');
  const instanceRegistry = runtimeRequire('./utils/instanceRegistry');
  const sessions = runtimeRequire('./utils/sessions');
  const { MESSAGE_STATUS, RECIPIENT_STATUS } = runtimeRequire('./utils/enums');
  const WhatsAppInstance = runtimeRequire('./utils/whatsapp.instance');

  globalThis.CAMPAIGN_STATES = globalThis.CAMPAIGN_STATES || {};

  const origUpdateOne = Message.updateOne.bind(Message);
  const origFindById = Message.findById.bind(Message);
  const origGetIO = socketModule.getIO.bind(socketModule);

  let activeUserId = null;
  let activePatches = false;

  function getCampaigns(userId) {
    return store.get(`campaigns.${userId}`) || [];
  }

  function saveCampaigns(userId, campaigns) {
    store.set(`campaigns.${userId}`, campaigns);
  }

  function getCampaign(userId, campaignId) {
    return getCampaigns(userId).find((c) => c._id === campaignId) || null;
  }

  function updateCampaignInStore(userId, campaignId, updater) {
    const list = getCampaigns(userId);
    const idx = list.findIndex((c) => c._id === campaignId);
    if (idx < 0) return null;
    list[idx] = typeof updater === 'function' ? updater(list[idx]) : { ...list[idx], ...updater };
    saveCampaigns(userId, list);
    return list[idx];
  }

  function applyMongoUpdate(campaign, update) {
    const setNested = (obj, p, value) => {
      const parts = p.split('.');
      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        const idx = Number(key);
        if (Number.isInteger(idx) && String(idx) === key) {
          if (!cur[idx]) cur[idx] = {};
          cur = cur[idx];
        } else {
          if (cur[key] == null) cur[key] = {};
          cur = cur[key];
        }
      }
      const last = parts[parts.length - 1];
      const lastIdx = Number(last);
      if (Number.isInteger(lastIdx) && String(lastIdx) === last) cur[lastIdx] = value;
      else cur[last] = value;
    };

    const getNested = (obj, p) =>
      p.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

    if (update.$set) {
      for (const [key, val] of Object.entries(update.$set)) setNested(campaign, key, val);
    }
    if (update.$inc) {
      for (const [key, val] of Object.entries(update.$inc)) {
        setNested(campaign, key, (Number(getNested(campaign, key)) || 0) + Number(val));
      }
    }
    if (update.status) campaign.status = update.status;
    campaign.updatedAt = new Date().toISOString();
    return campaign;
  }

  function emitToRenderer(userId, eventName, data) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('campaign:event', { userId, eventName, data });
    }
  }

  function patchForLocal(userId) {
    activeUserId = userId;
    activePatches = true;

    Message.updateOne = async (filter, update) => {
      const id = filter?._id?.toString();
      if (!id || activeUserId !== userId) return origUpdateOne(filter, update);
      const camp = getCampaign(userId, id);
      if (!camp) return origUpdateOne(filter, update);
      applyMongoUpdate(camp, update);
      updateCampaignInStore(userId, id, camp);
      return { acknowledged: true, modifiedCount: 1 };
    };

    Message.findById = (id) => {
      const camp = getCampaign(userId, id?.toString());
      if (camp && activeUserId === userId) {
        return { lean: async () => JSON.parse(JSON.stringify(camp)) };
      }
      return origFindById(id);
    };

    socketModule.getIO = () => ({
      to: (room) => ({
        emit: (eventName, data) => emitToRenderer(userId, eventName, data),
      }),
    });
  }

  function unpatch() {
    if (!activePatches) return;
    Message.updateOne = origUpdateOne;
    Message.findById = origFindById;
    socketModule.getIO = origGetIO;
    activeUserId = null;
    activePatches = false;
  }

  function isConnectedStatus(status) {
    return String(status || '').toLowerCase() === 'connected';
  }

  function collectStoreInstances(userId) {
    const authKey = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
    const storeKeys = [...new Set([userId, authKey].filter(Boolean).map(String))];
    const byId = new Map();
    for (const key of storeKeys) {
      if (typeof syncInstancesFromDisk === 'function') {
        try {
          syncInstancesFromDisk(store, key);
        } catch (e) {
          console.warn('[campaign] syncInstancesFromDisk failed', key, e?.message || e);
        }
      }
      const list = store.get(`instances.${key}`) || [];
      if (!Array.isArray(list)) continue;
      for (const inst of list) {
        const id = String(inst?._id || '');
        if (id) byId.set(id, { ...inst, _id: id, userId: inst.userId || key });
      }
    }
    return Array.from(byId.values());
  }

  function resolveConnectedInstances(userId, instanceIds) {
    const ids = Array.isArray(instanceIds) ? instanceIds.filter(Boolean).map(String) : [];
    const storeInstances = collectStoreInstances(userId);

    // If campaign has no instanceIds, fall back to every connected device for this user
    const targetIds =
      ids.length > 0
        ? ids
        : storeInstances
            .filter((i) => isConnectedStatus(i?.whatsapp?.status))
            .map((i) => String(i._id));

    return targetIds
      .map((idStr) => {
        if (!idStr) return null;

        const live = sessions.get(idStr);
        const liveOk = !!(live && (live.connected || live.sock));
        const fromStore = storeInstances.find((i) => String(i?._id) === idStr);
        const reg = instanceRegistry.getInstance(idStr) || {};
        const diskOk =
          typeof hasSavedSession === 'function' ? !!hasSavedSession(idStr) : false;
        const statusOk =
          isConnectedStatus(reg?.whatsapp?.status) ||
          isConnectedStatus(fromStore?.whatsapp?.status) ||
          diskOk;

        if (!liveOk && !statusOk) return null;

        const base = fromStore || reg || { _id: idStr };
        const doc = {
          ...base,
          ...reg,
          _id: idStr,
          userId: reg.userId || fromStore?.userId || userId,
          whatsapp: {
            ...(fromStore?.whatsapp || {}),
            ...(reg.whatsapp || {}),
            status: 'connected',
          },
        };
        instanceRegistry.registerInstance(idStr, doc);
        return doc;
      })
      .filter(Boolean);
  }

  async function hydrateInstances(userId, instanceIds, storeInstances) {
    const ids = Array.isArray(instanceIds) ? instanceIds.map(String) : [];
    for (const idStr of ids) {
      const fromStore = storeInstances.find((i) => String(i?._id) === idStr);
      const diskOk =
        typeof hasSavedSession === 'function' ? !!hasSavedSession(idStr) : false;
      const statusOk =
        isConnectedStatus(fromStore?.whatsapp?.status) ||
        isConnectedStatus(instanceRegistry.getInstance(idStr)?.whatsapp?.status) ||
        diskOk;
      if (!statusOk && !sessions.get(idStr)) continue;

      const instanceData = {
        ...(fromStore || {}),
        _id: idStr,
        userId: fromStore?.userId || userId,
        whatsapp: {
          ...(fromStore?.whatsapp || {}),
          status: 'connected',
        },
      };
      instanceRegistry.registerInstance(idStr, instanceData);

      try {
        if (typeof ensureSession === 'function') {
          await ensureSession(instanceData);
        } else if (!sessions.get(idStr)) {
          const session = new WhatsAppInstance(idStr);
          Object.setPrototypeOf(session, WhatsAppInstance.prototype);
          await session.create();
          await session.init();
          sessions.set(idStr, session);
        }
      } catch (e) {
        console.warn('[campaign] hydrate session failed', idStr, e?.message || e);
      }
    }
  }

  async function waitForLiveSession(idStr, timeoutMs = 60000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const live = sessions.get(idStr);
      // Must be fully open — sock alone is not enough (connecting state)
      if (live?.connected && live?.sock) return live;
      await new Promise((r) => setTimeout(r, 500));
    }
    const live = sessions.get(idStr);
    return live?.connected && live?.sock ? live : null;
  }

  async function ensureLiveInstances(userId, docs) {
    const authUser = store.get('auth_user');
    if (typeof prepareAndLoadSessions === 'function') {
      try {
        await prepareAndLoadSessions({ store, userKey: userId, user: authUser });
      } catch (e) {
        console.warn('[campaign] prepareAndLoadSessions failed', e?.message || e);
      }
    }

    const liveDocs = [];
    for (const doc of docs || []) {
      const idStr = String(doc?._id || '');
      if (!idStr) continue;

      let live = sessions.get(idStr);
      const alreadyUp = !!(live?.connected && live?.sock);
      const connecting = !!(live && (live._loading || live.sock || live.restart));

      // Only create/load when nothing is in memory — never kill reconnect loops
      if (!alreadyUp && !connecting && typeof ensureSession === 'function') {
        try {
          await ensureSession({
            ...doc,
            _id: idStr,
            userId: doc.userId || userId,
            whatsapp: { ...(doc.whatsapp || {}), status: 'connected' },
          });
        } catch (e) {
          console.warn('[campaign] ensureSession failed', idStr, e?.message || e);
        }
      }

      live = await waitForLiveSession(idStr, 60000);
      if (live?.connected && live?.sock) {
        liveDocs.push({
          ...doc,
          _id: idStr,
          userId: doc.userId || userId,
          whatsapp: { ...(doc.whatsapp || {}), status: 'connected' },
        });
      } else {
        console.warn('[campaign] instance not fully connected after wait', idStr, {
          hasSession: !!sessions.get(idStr),
          connected: !!sessions.get(idStr)?.connected,
          hasSock: !!sessions.get(idStr)?.sock,
        });
      }
    }
    return liveDocs;
  }

  function resolveTemplate(campaign, userId) {
    const t = campaign?.templateId;
    if (t && typeof t === 'object' && (t.messageType || t.template)) {
      return t;
    }
    const templateId = typeof t === 'string' ? t : t?._id;
    if (!templateId) return null;
    const authKey = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
    for (const key of [...new Set([userId, authKey].filter(Boolean).map(String))]) {
      const list = store.get(`templates.${key}`) || [];
      const found = list.find((x) => String(x?._id) === String(templateId));
      if (found) return found;
    }
    return null;
  }

  async function sendCampaign({ userId, campaignId }) {
    const authUser = store.get('auth_user');
    if (authUser && app) {
      applyUserSession({ app, store, user: authUser });
      console.log('[campaign] using session path:', process.env.LOCAL_SESSION_PATH);
    }
    // Do NOT reload whatsapp.instance here — it breaks live Baileys sockets.
    reloadBackendModule('./utils/resolveMedia.util');
    CampaignProcessor = reloadBackendModule('./utils/sendmessage.util');

    for (const instance of sessions.values()) {
      if (instance && typeof instance === 'object') {
        Object.setPrototypeOf(instance, WhatsAppInstance.prototype);
      }
    }

    const resolvedUserId = userId || (typeof getAuthUserId === 'function' ? getAuthUserId() : null);
    const campaign =
      getCampaign(resolvedUserId, campaignId) ||
      getCampaign(userId, campaignId) ||
      (typeof getAuthUserId === 'function'
        ? getCampaign(getAuthUserId(), campaignId)
        : null);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status === MESSAGE_STATUS.STOP) throw new Error('Campaign has been stopped');
    if (campaign.status === MESSAGE_STATUS.COMPLETED) throw new Error('Campaign already completed');

    const uid = resolvedUserId || userId || (typeof getAuthUserId === 'function' ? getAuthUserId() : null);
    const resolvedTemplate = resolveTemplate(campaign, uid);
    if (!resolvedTemplate) {
      throw new Error('Campaign template not found. Recreate the campaign with a valid template.');
    }
    campaign.templateId = resolvedTemplate;

    const storeInstances = collectStoreInstances(uid);
    let targetIds = (campaign.instanceIds || []).map(String).filter(Boolean);
    if (!targetIds.length) {
      targetIds = storeInstances
        .filter((i) => isConnectedStatus(i?.whatsapp?.status))
        .map((i) => String(i._id));
      if (targetIds.length) {
        updateCampaignInStore(uid, campaignId, { instanceIds: targetIds });
        campaign.instanceIds = targetIds;
      }
    }

    let connectedInstanceDocs = resolveConnectedInstances(uid, targetIds);

    if (!connectedInstanceDocs.length && targetIds.length) {
      await hydrateInstances(uid, targetIds, storeInstances);
      connectedInstanceDocs = resolveConnectedInstances(uid, targetIds);
    }

    if (!connectedInstanceDocs.length) {
      const liveDocs = [];
      for (const [idStr, live] of sessions.entries()) {
        if (!(live && (live.connected || live.sock))) continue;
        if (targetIds.length && !targetIds.includes(idStr)) continue;
        const reg = instanceRegistry.getInstance(idStr) || {};
        liveDocs.push({
          ...reg,
          _id: idStr,
          userId: reg.userId || uid,
          whatsapp: { ...(reg.whatsapp || {}), status: 'connected' },
        });
      }
      connectedInstanceDocs = liveDocs;
    }

    // Critical: only start when Baileys session is actually live
    connectedInstanceDocs = await ensureLiveInstances(uid, connectedInstanceDocs);

    if (!connectedInstanceDocs.length) {
      console.error('[campaign] No live WhatsApp sessions', {
        userId: uid,
        campaignId,
        instanceIds: targetIds,
        sessionIds: [...sessions.keys()],
        storeIds: storeInstances.map((i) => ({
          id: i._id,
          status: i?.whatsapp?.status,
        })),
      });
      throw new Error(
        'WhatsApp device is not connected live. Open Devices → reconnect with QR and wait until status is Connected (green). Do not start send while it is reconnecting.'
      );
    }

    const pendingRecipients = (campaign.recipients || []).filter(
      (rec) => rec.status === RECIPIENT_STATUS.PENDING
    );

    if (!pendingRecipients.length) {
      updateCampaignInStore(uid, campaignId, { status: MESSAGE_STATUS.COMPLETED });
      return { status: true, message: 'No pending recipients found' };
    }

    globalThis.CAMPAIGN_STATES[campaignId] = { isPaused: false, isStopped: false };
    updateCampaignInStore(uid, campaignId, {
      status: MESSAGE_STATUS.PROCESSING,
      templateId: resolvedTemplate,
    });

    patchForLocal(uid);

    setImmediate(async () => {
      try {
        await CampaignProcessor.processCampaign(
          campaignId,
          pendingRecipients,
          connectedInstanceDocs,
          { ...campaign, templateId: resolvedTemplate },
          uid
        );
      } catch (error) {
        console.error(`Local campaign ${campaignId} failed:`, error);
        updateCampaignInStore(uid, campaignId, { status: MESSAGE_STATUS.FAILED });
        delete globalThis.CAMPAIGN_STATES[campaignId];
        emitToRenderer(uid, 'campaign.complete', {
          campaignId,
          status: MESSAGE_STATUS.FAILED,
        });
      } finally {
        unpatch();
      }
    });

    return {
      status: true,
      message: 'Campaign started successfully',
      campaignId,
      totalRecipients: pendingRecipients.length,
      connectedInstances: connectedInstanceDocs.length,
    };
  }

  function pauseCampaign({ campaignId }) {
    globalThis.CAMPAIGN_STATES[campaignId] = { isPaused: true, isStopped: false };
    const userId = getAuthUserId();
    if (userId) updateCampaignInStore(userId, campaignId, { status: MESSAGE_STATUS.PAUSED });
    return { status: true, message: 'Campaign paused instantly' };
  }

  function resumeCampaign({ campaignId }) {
    globalThis.CAMPAIGN_STATES[campaignId] = { isPaused: false, isStopped: false };
    const userId = getAuthUserId();
    if (userId) updateCampaignInStore(userId, campaignId, { status: MESSAGE_STATUS.PROCESSING });
    return { status: true, message: 'Campaign resumed instantly' };
  }

  function stopCampaign({ campaignId }) {
    globalThis.CAMPAIGN_STATES[campaignId] = { isPaused: false, isStopped: true };
    const userId = getAuthUserId();
    if (userId) updateCampaignInStore(userId, campaignId, { status: MESSAGE_STATUS.STOP });
    return { status: true, message: 'Campaign stopped successfully' };
  }

  return {
    sendCampaign,
    pauseCampaign,
    resumeCampaign,
    stopCampaign,
  };
}

module.exports = { createCampaignManager };
