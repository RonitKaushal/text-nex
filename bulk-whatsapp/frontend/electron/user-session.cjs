const path = require('path');
const fs = require('fs');

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits || null;
}

function getLocalUserKeyFromUser(user) {
  return normalizePhone(user?.phone) || (user?._id || user?.id ? String(user._id || user.id) : null);
}

function migrateStorageToPhoneKey(store, phoneKey, mongoId) {
  if (!phoneKey || !mongoId || phoneKey === String(mongoId)) return;
  const prefixes = ['instances', 'campaigns', 'templates'];
  for (const prefix of prefixes) {
    const oldKey = `${prefix}.${mongoId}`;
    const newKey = `${prefix}.${phoneKey}`;
    const existing = store.get(oldKey);
    if (existing && (!store.get(newKey) || (Array.isArray(store.get(newKey)) && store.get(newKey).length === 0))) {
      store.set(newKey, existing);
    }
  }
  const oldMsgPrefix = `messages.${mongoId}`;
  const storeData = store.store || {};
  Object.keys(storeData).forEach((key) => {
    if (key.startsWith(`${oldMsgPrefix}.`)) {
      const suffix = key.slice(oldMsgPrefix.length);
      const newKey = `messages.${phoneKey}${suffix}`;
      if (!store.get(newKey)) {
        store.set(newKey, store.get(key));
      }
    }
  });
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(from, to);
    } else if (!fs.existsSync(to)) {
      fs.copyFileSync(from, to);
    }
  }
}

function consolidateSessionsToTarget(targetRoot, searchRoots) {
  if (!targetRoot) return;
  fs.mkdirSync(targetRoot, { recursive: true });
  const targetResolved = path.resolve(targetRoot);

  for (const root of searchRoots || []) {
    if (!root || !fs.existsSync(root)) continue;
    if (path.resolve(root) === targetResolved) continue;
    // Never copy from another user's folder (users/{phone}/sessions).
    if (root.includes(`${path.sep}users${path.sep}`)) continue;

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const srcDir = path.join(root, entry.name);
      if (!fs.existsSync(path.join(srcDir, 'creds.json'))) continue;
      const destDir = path.join(targetRoot, entry.name);
      if (!fs.existsSync(destDir)) {
        try {
          copyDirRecursive(srcDir, destDir);
        } catch (e) {
          console.warn('Session consolidate failed for', entry.name, e?.message || e);
        }
      }
    }
  }
}

function migrateGlobalSessionsToUser(userData, phoneKey) {
  if (!phoneKey) return;
  const globalSessions = path.join(userData, 'sessions');
  const userSessions = path.join(userData, 'users', phoneKey, 'sessions');
  fs.mkdirSync(userSessions, { recursive: true });
  if (!fs.existsSync(globalSessions)) return;
  for (const entry of fs.readdirSync(globalSessions, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dest = path.join(userSessions, entry.name);
    if (!fs.existsSync(dest)) {
      try {
        copyDirRecursive(path.join(globalSessions, entry.name), dest);
      } catch (_) {}
    }
  }
}

function migrateGlobalMediaToUser(userData, phoneKey) {
  if (!phoneKey) return;
  const globalMedia = path.join(userData, 'local-media');
  const userMedia = path.join(userData, 'users', phoneKey, 'local-media');
  if (!fs.existsSync(globalMedia)) return;
  fs.mkdirSync(userMedia, { recursive: true });
  for (const file of fs.readdirSync(globalMedia)) {
    const src = path.join(globalMedia, file);
    if (!fs.statSync(src).isFile()) continue;
    const dest = path.join(userMedia, file);
    if (!fs.existsSync(dest)) {
      try {
        fs.copyFileSync(src, dest);
      } catch (_) {}
    }
  }
}

function ensureUserDirectories(app, phoneKey) {
  if (!phoneKey) return null;
  // Embed host sets USER_DATA_PATH to .../bulk-whatsapp — never clobber that with app.getPath('userData')
  const userData = process.env.USER_DATA_PATH || app.getPath('userData');
  const base = path.join(userData, 'users', phoneKey);
  const sessions = path.join(base, 'sessions');
  const media = path.join(base, 'local-media');
  fs.mkdirSync(sessions, { recursive: true });
  fs.mkdirSync(media, { recursive: true });
  migrateGlobalSessionsToUser(userData, phoneKey);
  migrateGlobalMediaToUser(userData, phoneKey);

  // Repair: older embed builds wrote sessions under textnexus-app/users/... instead of bulk-whatsapp/users/...
  try {
    const appRoot = app.getPath('userData');
    const misplaced = path.join(appRoot, 'users', phoneKey, 'sessions');
    if (path.resolve(misplaced) !== path.resolve(sessions) && fs.existsSync(misplaced)) {
      for (const entry of fs.readdirSync(misplaced, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const src = path.join(misplaced, entry.name);
        const dest = path.join(sessions, entry.name);
        const srcCreds = path.join(src, 'creds.json');
        const destCreds = path.join(dest, 'creds.json');
        if (fs.existsSync(srcCreds) && !fs.existsSync(destCreds)) {
          copyDirRecursive(src, dest);
          console.log('[user-session] migrated session from misplaced path:', entry.name);
        }
      }
    }
  } catch (e) {
    console.warn('[user-session] misplaced session migrate failed:', e?.message || e);
  }

  process.env.USER_DATA_PATH = userData;
  process.env.LOCAL_MEDIA_GLOBAL_PATH = path.join(userData, 'local-media');
  process.env.LOCAL_SESSION_PATH = sessions;
  process.env.LOCAL_MEDIA_PATH = media;
  process.env.LOCAL_MEDIA_LEGACY_PATH = path.join(userData, 'template-media');
  return { base, sessions, media };
}

function normalizeUserRecord(user, phoneFallback) {
  if (!user || typeof user !== 'object') return user;
  const phone = normalizePhone(user.phone) || normalizePhone(phoneFallback);
  return phone ? { ...user, phone } : user;
}

function applyUserSession({ app, store, user, phoneFallback }) {
  const normalized = normalizeUserRecord(user, phoneFallback);
  const phoneKey = getLocalUserKeyFromUser(normalized);
  if (!phoneKey) return null;
  const mongoId = normalized?._id || normalized?.id;
  if (mongoId) migrateStorageToPhoneKey(store, phoneKey, mongoId);
  const dirs = ensureUserDirectories(app, phoneKey);
  return { phoneKey, user: normalized, ...dirs };
}

module.exports = {
  normalizePhone,
  normalizeUserRecord,
  getLocalUserKeyFromUser,
  applyUserSession,
  ensureUserDirectories,
  consolidateSessionsToTarget,
  copyDirRecursive,
};
