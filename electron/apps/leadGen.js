/**
 * Embed Lead Gen (Express + React) inside ArcticSwitch — Pro plan only.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { app, net } from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_PORT = Number(process.env.LEAD_GEN_PORT) || 39678;

let hostStarted = false;
let hostPort = null;
let hostError = null;
let starting = null;

function getLeadGenRoot() {
  const packaged = path.join(process.resourcesPath || '', 'lead-gen-app');
  if (fs.existsSync(path.join(packaged, 'server.js'))) {
    return packaged;
  }
  const repo = path.resolve(__dirname, '../../lead-gen-app');
  return repo;
}

function getLeadGenPaths() {
  const root = getLeadGenRoot();
  const serverJs = path.join(root, 'server.js');
  const indexHtml = path.join(root, 'frontend', 'dist', 'index.html');
  const ready = fs.existsSync(serverJs) && fs.existsSync(indexHtml);
  return {
    root,
    serverJs,
    indexHtml,
    ready,
    error: ready
      ? null
      : 'Lead Gen UI not built. Run: cd lead-gen-app/frontend && npm run build',
  };
}

function ensureLeadGenDataDir() {
  try {
    const dir = path.join(app.getPath('userData'), 'lead-gen');
    fs.mkdirSync(dir, { recursive: true });
    process.env.LEAD_GEN_DATA = dir;
  } catch (_) {
    /* keep default under lead-gen-app/db */
  }
}

async function probeLocal(port) {
  try {
    const res = await net.fetch(`http://127.0.0.1:${port}/`, { method: 'GET' });
    return res.ok || res.status === 200 || res.status === 304;
  } catch {
    return false;
  }
}

/**
 * Start Lead Gen Express host (idempotent).
 */
export async function ensureLeadGenHost() {
  if (hostStarted && hostPort) {
    return { ok: true, already: true, port: hostPort, url: `http://127.0.0.1:${hostPort}` };
  }
  if (starting) return starting;

  starting = (async () => {
    const paths = getLeadGenPaths();
    if (!paths.ready) {
      hostError = paths.error;
      return { ok: false, error: paths.error };
    }

    if (await probeLocal(DEFAULT_PORT)) {
      hostStarted = true;
      hostPort = DEFAULT_PORT;
      hostError = null;
      return { ok: true, already: true, port: hostPort, url: `http://127.0.0.1:${hostPort}` };
    }

    try {
      ensureLeadGenDataDir();
      const href = pathToFileURL(paths.serverJs).href;
      const mod = await import(href);
      if (typeof mod.startServer !== 'function') {
        hostError = 'lead-gen-app/server.js missing startServer()';
        return { ok: false, error: hostError };
      }
      const port = await mod.startServer();
      hostStarted = true;
      hostPort = Number(port) || DEFAULT_PORT;
      hostError = null;
      console.log('[lead-gen] embed host at http://127.0.0.1:' + hostPort);
      return { ok: true, port: hostPort, url: `http://127.0.0.1:${hostPort}` };
    } catch (e) {
      // Port already in use — try probing again
      if (await probeLocal(DEFAULT_PORT)) {
        hostStarted = true;
        hostPort = DEFAULT_PORT;
        hostError = null;
        return { ok: true, already: true, port: hostPort, url: `http://127.0.0.1:${hostPort}` };
      }
      hostError = e?.message || String(e);
      console.error('[lead-gen] embed host failed:', e);
      return { ok: false, error: hostError };
    } finally {
      starting = null;
    }
  })();

  return starting;
}

export function leadGenStatus() {
  const paths = getLeadGenPaths();
  const url =
    hostStarted && hostPort
      ? `http://127.0.0.1:${hostPort}`
      : paths.ready
        ? `http://127.0.0.1:${DEFAULT_PORT}`
        : null;
  return {
    installed: paths.ready && hostStarted,
    ready: paths.ready,
    hostStarted,
    port: hostPort,
    url: hostStarted ? url : null,
    error: hostError || paths.error,
    dir: paths.root,
  };
}

export async function leadGenInstall() {
  const paths = getLeadGenPaths();
  if (!paths.ready) {
    return { ok: false, error: paths.error };
  }
  const host = await ensureLeadGenHost();
  if (!host.ok) return host;
  return {
    ok: true,
    already: host.already,
    url: host.url,
    port: host.port,
  };
}

export async function leadGenLaunch() {
  return leadGenInstall();
}
