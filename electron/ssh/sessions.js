import { createRequire } from 'module';
import { BrowserWindow } from 'electron';

const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

/** @typedef {{ host: string, port?: number, username: string, password?: string, privateKey?: string, passphrase?: string }} SshConnectConfig */

/** @type {Map<string, { client: import('ssh2').Client, stream: import('ssh2').ClientChannel | null }>} */
const sessions = new Map();

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

/**
 * @param {string} sessionId
 * @param {SshConnectConfig} config
 */
export function sshConnect(sessionId, config) {
  return new Promise((resolve) => {
    if (!sessionId || !config?.host || !config?.username) {
      resolve({ ok: false, error: 'Host and username are required' });
      return;
    }

    sshDisconnect(sessionId, { silent: true });

    const client = new Client();
    const port = Number(config.port) > 0 ? Number(config.port) : 22;

    const fail = (error) => {
      try {
        client.end();
      } catch {
        /* ignore */
      }
      sessions.delete(sessionId);
      broadcast('ssh-status', { sessionId, status: 'error', error: String(error || 'Connection failed') });
      resolve({ ok: false, error: String(error || 'Connection failed') });
    };

    client
      .on('ready', () => {
        broadcast('ssh-status', { sessionId, status: 'connected' });
        client.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            fail(err.message || err);
            return;
          }

          sessions.set(sessionId, { client, stream });

          stream.on('data', (data) => {
            broadcast('ssh-data', {
              sessionId,
              data: Buffer.from(data).toString('utf8'),
            });
          });

          stream.stderr?.on?.('data', (data) => {
            broadcast('ssh-data', {
              sessionId,
              data: Buffer.from(data).toString('utf8'),
            });
          });

          stream.on('close', () => {
            broadcast('ssh-status', { sessionId, status: 'closed' });
            try {
              client.end();
            } catch {
              /* ignore */
            }
            sessions.delete(sessionId);
          });

          resolve({ ok: true });
        });
      })
      .on('error', (err) => {
        fail(err?.message || err);
      })
      .on('close', () => {
        if (sessions.has(sessionId)) {
          sessions.delete(sessionId);
          broadcast('ssh-status', { sessionId, status: 'closed' });
        }
      });

    broadcast('ssh-status', { sessionId, status: 'connecting' });

    /** @type {import('ssh2').ConnectConfig} */
    const connectOpts = {
      host: String(config.host).trim(),
      port,
      username: String(config.username).trim(),
      readyTimeout: 20000,
      tryKeyboard: true,
    };

    if (config.privateKey && String(config.privateKey).trim()) {
      connectOpts.privateKey = String(config.privateKey);
      if (config.passphrase) connectOpts.passphrase = String(config.passphrase);
    } else if (config.password != null) {
      connectOpts.password = String(config.password);
    }

    try {
      client.connect(connectOpts);
    } catch (err) {
      fail(err?.message || err);
    }
  });
}

/** @param {string} sessionId @param {{ silent?: boolean }} [opts] */
export function sshDisconnect(sessionId, opts = {}) {
  const silent = !!opts.silent;
  const entry = sessions.get(sessionId);
  if (!entry) return true;
  try {
    entry.stream?.close?.();
  } catch {
    /* ignore */
  }
  try {
    entry.client.end();
  } catch {
    /* ignore */
  }
  sessions.delete(sessionId);
  if (!silent) {
    broadcast('ssh-status', { sessionId, status: 'closed' });
  }
  return true;
}

/** @param {string} sessionId @param {string} data */
export function sshWrite(sessionId, data) {
  const entry = sessions.get(sessionId);
  if (!entry?.stream) return false;
  try {
    entry.stream.write(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} sessionId
 * @param {{ cols: number, rows: number }} size
 */
export function sshResize(sessionId, size) {
  const entry = sessions.get(sessionId);
  if (!entry?.stream) return false;
  const cols = Math.max(20, Number(size?.cols) || 80);
  const rows = Math.max(10, Number(size?.rows) || 24);
  try {
    entry.stream.setWindow(rows, cols, 0, 0);
    return true;
  } catch {
    return false;
  }
}

export function sshDisconnectAll() {
  for (const id of [...sessions.keys()]) {
    sshDisconnect(id);
  }
}
