/**
 * Electron runtime entry — local WhatsApp/campaign code lives under source/.
 */
const path = require('path');
const { createRequire } = require('module');

const CORE_ROOT = __dirname;
const SOURCE_ROOT = path.join(CORE_ROOT, 'source');

let runtimeRequire = null;

function getRuntimeRoot() {
  return SOURCE_ROOT;
}

function getRuntimeRequire() {
  if (!runtimeRequire) {
    runtimeRequire = createRequire(path.join(SOURCE_ROOT, 'package.json'));
  }
  return runtimeRequire;
}

function configurePaths(app) {
  const userData = app.getPath('userData');
  process.env.USER_DATA_PATH = process.env.USER_DATA_PATH || userData;
  process.env.LOCAL_MEDIA_GLOBAL_PATH =
    process.env.LOCAL_MEDIA_GLOBAL_PATH || path.join(userData, 'local-media');
  process.env.LOCAL_SESSION_PATH =
    process.env.LOCAL_SESSION_PATH || path.join(userData, 'sessions');
  process.env.LOCAL_MEDIA_PATH =
    process.env.LOCAL_MEDIA_PATH || path.join(userData, 'local-media');
  process.env.LOCAL_MEDIA_LEGACY_PATH =
    process.env.LOCAL_MEDIA_LEGACY_PATH || path.join(userData, 'template-media');
  return { userData, sessionsPath: process.env.LOCAL_SESSION_PATH };
}

module.exports = {
  CORE_ROOT,
  SOURCE_ROOT,
  getRuntimeRoot,
  getRuntimeRequire,
  configurePaths,
};
