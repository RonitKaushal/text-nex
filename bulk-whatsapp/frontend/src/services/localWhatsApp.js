/** Local WhatsApp operations — Electron IPC or phone local HTTP server */

const PHONE_LOCAL_URL = 'http://127.0.0.1:17890';

export function isElectronWhatsApp() {
  return !!(typeof window !== 'undefined' && window.electronAPI?.whatsappQR);
}

async function phoneRequest(path, body) {
  const res = await fetch(`${PHONE_LOCAL_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function requestQR(instance) {
  if (window.electronAPI?.whatsappQR) {
    return window.electronAPI.whatsappQR({ instance });
  }
  return phoneRequest('/qr', { instance });
}

export async function requestPairingCode(instance, phoneNumber) {
  if (window.electronAPI?.whatsappPairing) {
    return window.electronAPI.whatsappPairing({ instance, phoneNumber });
  }
  return phoneRequest('/pairing', { instance, phoneNumber });
}

export async function logoutInstance(instance) {
  if (window.electronAPI?.whatsappLogout) {
    return window.electronAPI.whatsappLogout({ instance });
  }
  return phoneRequest('/logout', { instance });
}

export async function deleteSession(instance) {
  if (window.electronAPI?.whatsappDeleteSession) {
    return window.electronAPI.whatsappDeleteSession({ instance });
  }
  return phoneRequest('/delete-session', { instance });
}

export async function fetchBusinessCatalog(instanceId) {
  if (window.electronAPI?.whatsappBusinessCatalog) {
    return window.electronAPI.whatsappBusinessCatalog({ instanceId });
  }
  return { status: false, message: 'Desktop app required for catalog' };
}

export function subscribeWhatsAppEvents(callback) {
  if (window.electronAPI?.onWhatsAppEvent) {
    return window.electronAPI.onWhatsAppEvent(callback);
  }
  return () => {};
}

export function mapWhatsAppEventToSocket(eventName, data, handlers) {
  if (eventName === 'instance.qr' && data?.qr) {
    handlers.onQR?.(data);
  }
  if (eventName === 'instance.update' && data?.instanceId) {
    handlers.onInstanceUpdate?.(data);
  }
}
