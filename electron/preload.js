const { contextBridge, ipcRenderer } = require('electron');

const INVOKE = [
  'get-app-version',
  'get-app-name',
  'download-app-update',
  'set-app-badge-count',
  'get-user-agent',
  'get-whatsapp-user-agent',
  'show-notification',
  'clear-notifications',
  'get-notifications-enabled',
  'set-notifications-enabled',
  'get-notifications-after-close',
  'set-notifications-after-close',
  'get-webview-preload-path',
  'reload-service',
  'toggle-service',
  'toggle-service-notifications',
  'store-get',
  'store-set',
  'store-delete',
  'store-clear',
  'window-minimize',
  'window-maximize',
  'window-close',
  'window-is-maximized',
  'window-toggle-fullscreen',
  'window-is-fullscreen',
  'open-new-window',
  'popout-service',
  'bring-back-service',
  'get-popout-payload',
  'ssh-connect',
  'ssh-disconnect',
  'ssh-write',
  'ssh-resize',
  'bulk-wa-status',
  'bulk-wa-install',
  'bulk-wa-launch',
  'lead-gen-status',
  'lead-gen-install',
  'lead-gen-launch',
  'voice-speech-start',
  'voice-speech-stop',
  'voice-speech-status-query',
  'voice-recognize-pcm',
];

function safeInvoke(channel, ...args) {
  if (!INVOKE.includes(channel)) {
    return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => safeInvoke('get-app-version'),
  getAppName: () => safeInvoke('get-app-name'),
  downloadAppUpdate: (payload) => safeInvoke('download-app-update', payload),
  setAppBadgeCount: (count) => safeInvoke('set-app-badge-count', count),
  onAppUpdateProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('app-update-progress', handler);
    return () => ipcRenderer.removeListener('app-update-progress', handler);
  },
  onServiceUnread: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('service-unread', handler);
    return () => ipcRenderer.removeListener('service-unread', handler);
  },
  getUserAgent: (serviceType) => safeInvoke('get-user-agent', serviceType),
  getWhatsAppUserAgent: () => safeInvoke('get-whatsapp-user-agent'),
  platform: process.platform,
  isElectron: true,
  showNotification: (data) => safeInvoke('show-notification', data),
  clearNotifications: (serviceId) => safeInvoke('clear-notifications', serviceId),
  getNotificationsEnabled: () => safeInvoke('get-notifications-enabled'),
  setNotificationsEnabled: (enabled) => safeInvoke('set-notifications-enabled', enabled),
  getNotificationsAfterClose: () => safeInvoke('get-notifications-after-close'),
  setNotificationsAfterClose: (enabled) =>
    safeInvoke('set-notifications-after-close', enabled),
  getWebviewPreloadPath: (serviceType) => safeInvoke('get-webview-preload-path', serviceType),
  reloadService: (serviceId) => safeInvoke('reload-service', serviceId),
  toggleService: (serviceId, enabled) => safeInvoke('toggle-service', serviceId, enabled),
  toggleServiceNotifications: (serviceId, enabled) =>
    safeInvoke('toggle-service-notifications', serviceId, enabled),
  windowMinimize: () => safeInvoke('window-minimize'),
  windowMaximize: () => safeInvoke('window-maximize'),
  windowClose: () => safeInvoke('window-close'),
  windowIsMaximized: () => safeInvoke('window-is-maximized'),
  windowToggleFullscreen: () => safeInvoke('window-toggle-fullscreen'),
  windowIsFullscreen: () => safeInvoke('window-is-fullscreen'),
  openNewWindow: (url) => safeInvoke('open-new-window', url),
  popoutService: (payload) => safeInvoke('popout-service', payload),
  bringBackService: (serviceId) => safeInvoke('bring-back-service', serviceId),
  getPopoutPayload: (serviceId) => safeInvoke('get-popout-payload', serviceId),
  sshConnect: (sessionId, config) => safeInvoke('ssh-connect', sessionId, config),
  sshDisconnect: (sessionId) => safeInvoke('ssh-disconnect', sessionId),
  sshWrite: (sessionId, data) => safeInvoke('ssh-write', sessionId, data),
  sshResize: (sessionId, size) => safeInvoke('ssh-resize', sessionId, size),
  bulkWhatsAppStatus: () => safeInvoke('bulk-wa-status'),
  bulkWhatsAppInstall: () => safeInvoke('bulk-wa-install'),
  bulkWhatsAppLaunch: () => safeInvoke('bulk-wa-launch'),
  leadGenStatus: () => safeInvoke('lead-gen-status'),
  leadGenInstall: () => safeInvoke('lead-gen-install'),
  leadGenLaunch: () => safeInvoke('lead-gen-launch'),
  voiceSpeechStart: (options) => safeInvoke('voice-speech-start', options),
  voiceSpeechStop: () => safeInvoke('voice-speech-stop'),
  voiceSpeechStatus: () => safeInvoke('voice-speech-status-query'),
  voiceRecognizePcm: (payload) => safeInvoke('voice-recognize-pcm', payload),
  onVoiceSpeechResult: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('voice-speech-result', handler);
    return () => ipcRenderer.removeListener('voice-speech-result', handler);
  },
  onVoiceSpeechStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('voice-speech-status', handler);
    return () => ipcRenderer.removeListener('voice-speech-status', handler);
  },
  onSshData: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('ssh-data', handler);
    return () => ipcRenderer.removeListener('ssh-data', handler);
  },
  onSshStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('ssh-status', handler);
    return () => ipcRenderer.removeListener('ssh-status', handler);
  },
  onWindowMaximizedChanged: (callback) => {
    const handler = (_event, maximized) => callback(maximized);
    ipcRenderer.on('window-maximized-changed', handler);
    return () => ipcRenderer.removeListener('window-maximized-changed', handler);
  },
  onWindowFullscreenChanged: (callback) => {
    const handler = (_event, fullscreen) => callback(fullscreen);
    ipcRenderer.on('window-fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('window-fullscreen-changed', handler);
  },
  onServicePoppedOut: (callback) => {
    const handler = (_event, serviceId) => callback(serviceId);
    ipcRenderer.on('service-popped-out', handler);
    return () => ipcRenderer.removeListener('service-popped-out', handler);
  },
  onServiceBroughtBack: (callback) => {
    const handler = (_event, serviceId) => callback(serviceId);
    ipcRenderer.on('service-brought-back', handler);
    return () => ipcRenderer.removeListener('service-brought-back', handler);
  },
  onSwitchToService: (callback) => ipcRenderer.on('switch-to-service', callback),
  onServiceSwitcher: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('service-switcher', handler);
    return () => ipcRenderer.removeListener('service-switcher', handler);
  },
  onGlobalSearch: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('global-search', handler);
    return () => ipcRenderer.removeListener('global-search', handler);
  },
  onOpenNotificationChat: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('open-notification-chat', handler);
    return () => ipcRenderer.removeListener('open-notification-chat', handler);
  },
  onReloadService: (callback) => ipcRenderer.on('reload-service', callback),
  onToggleService: (callback) => ipcRenderer.on('toggle-service', callback),
  onToggleServiceNotifications: (callback) =>
    ipcRenderer.on('toggle-service-notifications', callback),
  onSendReply: (callback) => ipcRenderer.on('send-reply', callback),
  onOpenInAppTab: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('open-in-app-tab', handler);
    return () => ipcRenderer.removeListener('open-in-app-tab', handler);
  },
  store: {
    get: (key) => safeInvoke('store-get', key),
    set: (key, value) => safeInvoke('store-set', key, value),
    delete: (key) => safeInvoke('store-delete', key),
    clear: () => safeInvoke('store-clear'),
  },
});
