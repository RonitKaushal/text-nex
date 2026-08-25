const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const mime = require('mime-types');
const { getMimeType } = require('./common.util');

function filePathFromUrl(source) {
  if (!source || typeof source !== 'string') return null;
  const trimmed = source.trim();

  if (trimmed.startsWith('file://')) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      try {
        let p = decodeURIComponent(new URL(trimmed).pathname);
        if (process.platform === 'win32' && p.startsWith('/')) {
          p = p.slice(1);
        }
        return p;
      } catch {
        return trimmed.replace(/^file:\/\//, '').replace(/^\/([A-Za-z]:)/, '$1');
      }
    }
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }

  return null;
}

function resolveLocalMediaPath(source, mediaRoots = []) {
  if (!source || typeof source !== 'string') return null;
  const trimmed = source.trim();

  const direct = filePathFromUrl(trimmed);
  if (direct && fs.existsSync(direct)) return direct;

  if (trimmed.startsWith('local-media://')) {
    const name = path.basename(decodeURIComponent(trimmed.replace(/^local-media:\/\//, '')));
    for (const root of mediaRoots) {
      if (!root) continue;
      const candidate = path.join(root, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  const baseName = path.basename(trimmed);
  if (baseName && baseName !== trimmed) {
    for (const root of mediaRoots) {
      if (!root) continue;
      const candidate = path.join(root, baseName);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

function parseDataUrl(source) {
  const match = source.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    buffer: Buffer.from(match[2], 'base64'),
    mimeType: match[1],
    fileName: 'media',
  };
}

function getMediaRoots(options = {}) {
  const roots = [];
  if (options.mediaRoot) roots.push(options.mediaRoot);
  if (process.env.LOCAL_MEDIA_PATH) roots.push(process.env.LOCAL_MEDIA_PATH);
  if (process.env.LOCAL_MEDIA_GLOBAL_PATH) roots.push(process.env.LOCAL_MEDIA_GLOBAL_PATH);
  if (process.env.LOCAL_MEDIA_LEGACY_PATH) roots.push(process.env.LOCAL_MEDIA_LEGACY_PATH);
  if (process.env.LOCAL_MEDIA_PATH) {
    roots.push(path.join(path.dirname(process.env.LOCAL_MEDIA_PATH), 'template-media'));
  }
  if (process.env.USER_DATA_PATH) {
    const userData = process.env.USER_DATA_PATH;
    roots.push(path.join(userData, 'local-media'));
    roots.push(path.join(userData, 'template-media'));
    try {
      const usersDir = path.join(userData, 'users');
      if (fs.existsSync(usersDir)) {
        for (const entry of fs.readdirSync(usersDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            roots.push(path.join(usersDir, entry.name, 'local-media'));
          }
        }
      }
    } catch (_) {}
  }
  return [...new Set(roots.filter(Boolean))];
}

async function resolveMediaSource(source, options = {}) {
  if (!source || typeof source !== 'string') {
    throw new Error('Media source is required');
  }

  const trimmed = source.trim();
  const mediaRoots = getMediaRoots(options);

  if (trimmed.startsWith('data:')) {
    const parsed = parseDataUrl(trimmed);
    if (!parsed) throw new Error('Invalid data URL');
    return parsed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      'Remote media URLs are not supported. Upload the file locally on your device.'
    );
  }

  const filePath = resolveLocalMediaPath(trimmed, mediaRoots);
  if (filePath) {
    const buffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const mimeType =
      mime.lookup(filePath) || getMimeType(fileName) || 'application/octet-stream';
    return { buffer, mimeType, fileName };
  }

  throw new Error(`Local media file not found: ${trimmed}`);
}

module.exports = {
  resolveMediaSource,
  resolveLocalMediaPath,
  filePathFromUrl,
};
