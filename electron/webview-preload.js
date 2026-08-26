/**
 * Guest webview preload — exposes a minimal bridge so messaging sites
 * (WhatsApp, Instagram, Messenger, …) can raise OS notifications.
 */
const { ipcRenderer } = require('electron');

// Block Windows / Meta passkey prompts in this guest page
try {
  require('./passkey-frame-preload.js');
} catch (_) {}

const api = {
  showNotification: (data) => ipcRenderer.invoke('show-notification', data),
  clearNotifications: (serviceId) => ipcRenderer.invoke('clear-notifications', serviceId),
  getNotificationsEnabled: () => ipcRenderer.invoke('get-notifications-enabled'),
  reportUnread: (data) => ipcRenderer.send('guest-unread', data),
  reportUnreadInbox: (data) => ipcRenderer.send('guest-unread-inbox', data),
  platform: process.platform,
  isElectron: true,
};

try {
  // Guest pages often run with contextIsolation=false (see GenericWebView webpreferences)
  // so assign directly; also support contextBridge if isolation is on.
  const { contextBridge } = require('electron');
  if (contextBridge && process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', api);
    contextBridge.exposeInMainWorld('textNexusNotify', api);
  } else {
    window.electronAPI = api;
    window.textNexusNotify = api;
  }
} catch {
  window.electronAPI = api;
  window.textNexusNotify = api;
}
