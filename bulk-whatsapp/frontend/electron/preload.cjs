const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth methods
  saveToken: (token) => ipcRenderer.invoke('auth:save-token', token),
  getToken: () => ipcRenderer.invoke('auth:get-token'),
  saveSecureToken: (token) => ipcRenderer.invoke('auth:save-secure-token', token),
  getSecureToken: () => ipcRenderer.invoke('auth:get-secure-token'),
  saveUser: (user, phoneFallback, options) =>
    ipcRenderer.invoke('auth:save-user', { user, phoneFallback, ...options }),
  getUser: () => ipcRenderer.invoke('auth:get-user'),
  clearToken: () => ipcRenderer.invoke('auth:clear-token'),
  
  // Update methods
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, message) => callback(message)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  restartApp: () => ipcRenderer.send('restart-app'),
  
  // Environment info if needed
  platform: process.platform,

  // Message methods
  saveMessage: (data) => ipcRenderer.invoke('messages:save', data),
  getMessages: (data) => ipcRenderer.invoke('messages:get', data),
  clearMessages: (data) => ipcRenderer.invoke('messages:clear', data),

  // Local instance storage
  getInstances: (data) => ipcRenderer.invoke('instances:get', data),
  saveInstances: (data) => ipcRenderer.invoke('instances:save', data),

  // Local campaign storage + runner
  getCampaigns: (data) => ipcRenderer.invoke('campaigns:get', data),
  saveCampaigns: (data) => ipcRenderer.invoke('campaigns:save', data),
  campaignSend: (data) => ipcRenderer.invoke('campaign:send', data),
  campaignPause: (data) => ipcRenderer.invoke('campaign:pause', data),
  campaignResume: (data) => ipcRenderer.invoke('campaign:resume', data),
  campaignStop: (data) => ipcRenderer.invoke('campaign:stop', data),
  onCampaignEvent: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on('campaign:event', handler);
    return () => ipcRenderer.removeListener('campaign:event', handler);
  },

  getDashboardStatistics: (data) => ipcRenderer.invoke('dashboard:statistics', data),

  // Local template storage + media
  getTemplates: (data) => ipcRenderer.invoke('templates:get', data),
  saveTemplates: (data) => ipcRenderer.invoke('templates:save', data),
  uploadTemplateMedia: (data) => ipcRenderer.invoke('template:upload-media', data),

  // Local WhatsApp (sessions on device)
  whatsappQR: (data) => ipcRenderer.invoke('whatsapp:qr', data),
  whatsappPairing: (data) => ipcRenderer.invoke('whatsapp:pairing', data),
  whatsappLogout: (data) => ipcRenderer.invoke('whatsapp:logout', data),
  whatsappDeleteSession: (data) => ipcRenderer.invoke('whatsapp:delete-session', data),
  whatsappBusinessCatalog: (data) => ipcRenderer.invoke('whatsapp:business-catalog', data),
  whatsappSessionPath: () => ipcRenderer.invoke('whatsapp:session-path'),

  reloadWhatsAppSessions: () => ipcRenderer.invoke('sessions:reload'),
  onWhatsAppEvent: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on('whatsapp:event', handler);
    return () => ipcRenderer.removeListener('whatsapp:event', handler);
  }
});
