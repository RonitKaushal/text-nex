import { app, shell, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';

/**
 * Download a remote installer to the user's Downloads folder and open it.
 * Emits progress to all BrowserWindows via channel `app-update-progress`.
 */
export async function downloadAndInstallUpdate({ downloadUrl, version }) {
  if (!downloadUrl || !/^https?:\/\//i.test(downloadUrl)) {
    throw new Error('Invalid download URL');
  }

  const downloadsDir = app.getPath('downloads');
  const urlObj = new URL(downloadUrl);
  const rawName = path.basename(urlObj.pathname) || `ArcticSwitch-${version || 'update'}.exe`;
  const safeName = rawName.replace(/[^\w.\-() ]+/g, '_');
  const destPath = path.join(downloadsDir, safeName);

  const send = (payload) => {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.send('app-update-progress', payload);
      } catch {
        /* ignore */
      }
    }
  };

  send({ status: 'starting', percent: 0, version, destPath });

  await downloadFile(downloadUrl, destPath, (percent, received, total) => {
    send({ status: 'downloading', percent, received, total, version, destPath });
  });

  send({ status: 'opening', percent: 100, version, destPath });

  const openResult = await shell.openPath(destPath);
  if (openResult) {
    // openPath returns empty string on success, error message otherwise
    throw new Error(openResult || 'Failed to open installer');
  }

  send({ status: 'done', percent: 100, version, destPath });
  return { ok: true, destPath, version };
}

function downloadFile(fileUrl, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const doRequest = (url, redirectsLeft = 5) => {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(
        url,
        {
          headers: {
            'User-Agent': `ArcticSwitch/${app.getVersion()}`,
            Accept: '*/*',
          },
        },
        (res) => {
          // Follow redirects
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            if (redirectsLeft <= 0) {
              reject(new Error('Too many redirects'));
              return;
            }
            const next = new URL(res.headers.location, url).toString();
            res.resume();
            doRequest(next, redirectsLeft - 1);
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`Download failed (HTTP ${res.statusCode})`));
            res.resume();
            return;
          }

          const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
          let received = 0;
          const file = fs.createWriteStream(destPath);

          res.on('data', (chunk) => {
            received += chunk.length;
            if (total > 0 && typeof onProgress === 'function') {
              const percent = Math.min(100, Math.round((received / total) * 100));
              onProgress(percent, received, total);
            }
          });

          res.pipe(file);

          file.on('finish', () => {
            file.close(() => {
              if (typeof onProgress === 'function') onProgress(100, received, total || received);
              resolve(destPath);
            });
          });

          file.on('error', (err) => {
            try {
              fs.unlinkSync(destPath);
            } catch {
              /* ignore */
            }
            reject(err);
          });
        }
      );

      req.on('error', (err) => {
        try {
          fs.unlinkSync(destPath);
        } catch {
          /* ignore */
        }
        reject(err);
      });

      req.setTimeout(10 * 60 * 1000, () => {
        req.destroy(new Error('Download timed out'));
      });
    };

    doRequest(fileUrl);
  });
}
