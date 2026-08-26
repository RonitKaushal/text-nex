/**
 * Harden a session for Google / Gmail login (UA + Client Hints, no Electron markers).
 */
import { getGoogleChromeIdentity } from './userAgent.js';

const GOOGLE_URL_FILTER = {
  urls: [
    '*://*.google.com/*',
    '*://*.google.co.in/*',
    '*://*.googleusercontent.com/*',
    '*://*.gstatic.com/*',
    '*://*.googleapis.com/*',
    '*://*.gmail.com/*',
    '*://accounts.youtube.com/*',
  ],
};

const GOOGLE_PARTITION_HINTS = [
  'gmail',
  'google-meet',
  'google-calendar',
  'google-drive',
  'google-docs',
  'google-sheets',
  'google-slides',
  'gemini',
];

export function isGoogleServiceType(serviceType) {
  const t = String(serviceType || '').toLowerCase();
  return GOOGLE_PARTITION_HINTS.includes(t) || t.startsWith('google');
}

export function isGooglePartition(partition) {
  const p = String(partition || '').toLowerCase();
  return GOOGLE_PARTITION_HINTS.some((hint) => p.includes(hint));
}

const hardened = new WeakSet();

export function hardenGoogleSession(partitionSession) {
  if (!partitionSession || hardened.has(partitionSession)) return;
  hardened.add(partitionSession);

  try {
    const id = getGoogleChromeIdentity();
    partitionSession.setUserAgent(id.ua);

    partitionSession.webRequest.onBeforeSendHeaders(
      GOOGLE_URL_FILTER,
      (details, callback) => {
        const headers = { ...(details.requestHeaders || {}) };
        headers['User-Agent'] = id.ua;
        delete headers['Sec-CH-UA-Full-Version-List'];
        delete headers['Sec-CH-UA-Full-Version'];
        delete headers['Sec-CH-UA-Arch'];
        delete headers['Sec-CH-UA-Bitness'];
        delete headers['Sec-CH-UA-Model'];
        headers['Sec-CH-UA'] = id.secChUa;
        headers['Sec-CH-UA-Mobile'] = '?0';
        headers['Sec-CH-UA-Platform'] = id.secChUaPlatform;
        headers['Sec-CH-UA-Platform-Version'] = '\"15.0.0\"';
        callback({ cancel: false, requestHeaders: headers });
      }
    );
    console.log('[google] hardened session UA for Chrome', id.major);
  } catch (e) {
    console.warn('[google] failed to harden session:', e?.message || e);
  }
}
