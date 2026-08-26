/**
 * Google / Gmail guest preload — look like normal Chrome so accounts.google.com
 * does not show "This browser or app may not be secure".
 * Exposes only textNexusNotify (no electronAPI / isElectron flags).
 */
(() => {
  try {
    const ua = String(navigator.userAgent || '');
    const majorMatch = ua.match(/Chrome\/(\d+)/i);
    const major = majorMatch ? majorMatch[1] : '134';

    const chromeObj = {
      app: {
        isInstalled: false,
        InstallState: {
          DISABLED: 'disabled',
          INSTALLED: 'installed',
          NOT_INSTALLED: 'not_installed',
        },
        RunningState: {
          CANNOT_RUN: 'cannot_run',
          READY_TO_RUN: 'ready_to_run',
          RUNNING: 'running',
        },
      },
      runtime: {
        OnInstalledReason: {
          CHROME_UPDATE: 'chrome_update',
          INSTALL: 'install',
          SHARED_MODULE_UPDATE: 'shared_module_update',
          UPDATE: 'update',
        },
        OnRestartRequiredReason: {
          APP_UPDATE: 'app_update',
          OS_UPDATE: 'os_update',
          PERIODIC: 'periodic',
        },
        PlatformOs: {
          ANDROID: 'android',
          CROS: 'cros',
          LINUX: 'linux',
          MAC: 'mac',
          OPENBSD: 'openbsd',
          WIN: 'win',
        },
        PlatformArch: {
          ARM: 'arm',
          ARM64: 'arm64',
          MIPS: 'mips',
          MIPS64: 'mips64',
          X86_32: 'x86-32',
          X86_64: 'x86-64',
        },
        PlatformNaclArch: {
          ARM: 'arm',
          MIPS: 'mips',
          MIPS64: 'mips64',
          X86_32: 'x86-32',
          X86_64: 'x86-64',
        },
        RequestUpdateCheckStatus: {
          NO_UPDATE: 'no_update',
          THROTTLED: 'throttled',
          UPDATE_AVAILABLE: 'update_available',
        },
        id: undefined,
        connect: undefined,
        sendMessage: undefined,
      },
      csi: () => ({}),
      loadTimes: () => ({}),
    };

    if (!window.chrome) {
      try {
        Object.defineProperty(window, 'chrome', {
          value: chromeObj,
          writable: true,
          configurable: true,
        });
      } catch {
        window.chrome = chromeObj;
      }
    }

    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true,
      });
    } catch {
      /* ignore */
    }

    try {
      delete window.electron;
      delete window.electronAPI;
      delete window.require;
      delete window.module;
      delete window.exports;
      delete window.global;
      delete window.__dirname;
      delete window.__filename;
    } catch {
      /* ignore */
    }

    // Client Hints API — Google checks this vs UA string
    try {
      const brands = [
        { brand: 'Google Chrome', version: major },
        { brand: 'Chromium', version: major },
        { brand: 'Not=A?Brand', version: '24' },
      ];
      const platform = /Mac/i.test(ua)
        ? 'macOS'
        : /Linux/i.test(ua)
          ? 'Linux'
          : 'Windows';
      const uaData = {
        brands,
        mobile: false,
        platform,
        getHighEntropyValues: async (hints) => {
          const out = {
            brands,
            mobile: false,
            platform,
            architecture: 'x86',
            bitness: '64',
            model: '',
            platformVersion: platform === 'Windows' ? '15.0.0' : '14.0.0',
            uaFullVersion: `${major}.0.0.0`,
            fullVersionList: brands.map((b) => ({
              brand: b.brand,
              version: `${b.version}.0.0.0`,
            })),
          };
          if (Array.isArray(hints)) {
            const filtered = {};
            for (const h of hints) {
              if (h in out) filtered[h] = out[h];
            }
            return filtered;
          }
          return out;
        },
        toJSON: () => ({ brands, mobile: false, platform }),
      };
      Object.defineProperty(navigator, 'userAgentData', {
        get: () => uaData,
        configurable: true,
      });
    } catch {
      /* ignore */
    }

    try {
      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.',
        configurable: true,
      });
    } catch {
      /* ignore */
    }

    try {
      if (navigator.plugins && navigator.plugins.length === 0) {
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', filename: 'internal-nacl-plugin' },
          ],
        });
      }
    } catch {
      /* ignore */
    }

    try {
      const originalQuery = window.navigator.permissions?.query?.bind(
        window.navigator.permissions
      );
      if (originalQuery) {
        window.navigator.permissions.query = (params) => {
          if (
            params &&
            (params.name === 'notifications' ||
              params.name === 'camera' ||
              params.name === 'microphone')
          ) {
            return Promise.resolve({ state: 'prompt', onchange: null });
          }
          return originalQuery(params);
        };
      }
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.warn('[google-preload] spoof failed', e);
  }

  // Minimal notify bridge only — do not set electronAPI / isElectron
  try {
    const { ipcRenderer, contextBridge } = require('electron');
    const api = {
      showNotification: (data) => ipcRenderer.invoke('show-notification', data),
      clearNotifications: (serviceId) =>
        ipcRenderer.invoke('clear-notifications', serviceId),
      getNotificationsEnabled: () => ipcRenderer.invoke('get-notifications-enabled'),
      reportUnread: (data) => ipcRenderer.send('guest-unread', data),
      reportUnreadInbox: (data) => ipcRenderer.send('guest-unread-inbox', data),
    };
    if (contextBridge && process.contextIsolated) {
      contextBridge.exposeInMainWorld('textNexusNotify', api);
    } else {
      window.textNexusNotify = api;
    }
  } catch (e) {
    console.warn('[google-preload] notify bridge failed', e?.message || e);
  }

  // Do NOT load passkey-frame-preload here — Google treats broken WebAuthn as an insecure browser.
})();
