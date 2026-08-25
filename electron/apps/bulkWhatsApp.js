/**
 * Embed Bulk WhatsApp UI inside TextNexus (no separate exe window).
 */
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import Store from 'electron-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let hostStarted = false;
let hostError = null;

function getBulkFrontendRoot() {
  const packaged = path.join(process.resourcesPath || '', 'bulk-whatsapp');
  if (fs.existsSync(path.join(packaged, 'dist', 'index.html'))) {
    return packaged;
  }
  const repo = path.resolve(__dirname, '../../bulk-whatsapp/frontend');
  if (fs.existsSync(path.join(repo, 'dist', 'index.html'))) {
    return repo;
  }
  return repo;
}

export function getBulkEmbedPaths() {
  const root = getBulkFrontendRoot();
  const indexHtml = path.join(root, 'dist', 'index.html');
  const preload = path.join(root, 'electron', 'preload.cjs');
  const ready = fs.existsSync(indexHtml) && fs.existsSync(preload);
  let url = null;
  if (ready) {
    // Bust webview cache when dist rebuilds
    let ver = '6';
    try {
      ver = String(fs.statSync(indexHtml).mtimeMs | 0);
    } catch {
      /* ignore */
    }
    url = `${pathToFileURL(indexHtml).href}?v=${ver}`;
  }
  return {
    ready,
    root,
    indexHtml,
    preload,
    url,
    preloadPath: ready ? preload : null,
    error: ready
      ? null
      : 'Bulk WhatsApp UI not built. Run: cd bulk-whatsapp/frontend && npm run build',
  };
}

/**
 * Start Baileys / campaign IPC host inside TextNexus main process.
 * @param {() => import('electron').BrowserWindow | null} getMainWindow
 */
export async function ensureBulkWhatsAppHost(getMainWindow) {
  if (hostStarted) {
    return { ok: true, already: true };
  }
  const paths = getBulkEmbedPaths();
  if (!paths.ready) {
    hostError = paths.error;
    return { ok: false, error: paths.error };
  }

  try {
    const embedHostPath = path.join(paths.root, 'electron', 'embedHost.cjs');
    if (!fs.existsSync(embedHostPath)) {
      hostError = 'embedHost.cjs missing';
      return { ok: false, error: hostError };
    }
    const host = require(embedHostPath);
    await host.startBulkEmbedHost({
      getHostWindow: getMainWindow,
      bulkRoot: paths.root,
      // Resolve electron-store from TextNexus asar — packaged embed path cannot
      ElectronStore: Store,
    });
    hostStarted = true;
    hostError = null;
    return { ok: true };
  } catch (e) {
    hostError = e?.message || String(e);
    console.error('[bulk-whatsapp] embed host failed:', e);
    return { ok: false, error: hostError };
  }
}

export function bulkWhatsAppStatus() {
  const paths = getBulkEmbedPaths();
  return {
    installed: paths.ready && hostStarted,
    ready: paths.ready,
    hostStarted,
    path: paths.indexHtml,
    url: paths.url,
    preload: paths.preloadPath,
    error: hostError || paths.error,
    dir: paths.root,
  };
}

/** @deprecated external exe install — kept for API compat; now ensures embed host */
export async function bulkWhatsAppInstall(getMainWindow) {
  const paths = getBulkEmbedPaths();
  if (!paths.ready) {
    return { ok: false, error: paths.error };
  }
  const host = await ensureBulkWhatsAppHost(getMainWindow);
  if (!host.ok) return host;
  return { ok: true, already: host.already, path: paths.indexHtml, hostStarted: true };
}

/** @deprecated external exe launch — embed is in-panel; just ensure host */
export async function bulkWhatsAppLaunch(getMainWindow) {
  return bulkWhatsAppInstall(getMainWindow);
}

export function bulkWhatsAppEmbedInfo(getMainWindow) {
  const paths = getBulkEmbedPaths();
  return {
    ok: paths.ready,
    url: paths.url,
    preload: paths.preloadPath,
    hostStarted,
    error: hostError || paths.error,
  };
}

void app;
