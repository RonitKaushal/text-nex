/**
 * Snapchat guest preload — do NOT expose electronAPI / isElectron.
 * Spoofs a normal Chrome desktop environment so Snapchat Web accepts the session.
 */
(() => {
  try {
    const chromeObj = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
      },
      runtime: {
        OnInstalledReason: {
          CHROME_UPDATE: 'chrome_update',
          INSTALL: 'install',
          SHARED_MODULE_UPDATE: 'shared_module_update',
          UPDATE: 'update',
        },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
        PlatformOs: {
          ANDROID: 'android',
          CROS: 'cros',
          LINUX: 'linux',
          MAC: 'mac',
          OPENBSD: 'openbsd',
          WIN: 'win',
        },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        RequestUpdateCheckStatus: {
          NO_UPDATE: 'no_update',
          THROTTLED: 'throttled',
          UPDATE_AVAILABLE: 'update_available',
        },
      },
      csi: () => ({}),
      loadTimes: () => ({}),
    };

    if (!window.chrome) {
      try {
        Object.defineProperty(window, 'chrome', { value: chromeObj, writable: true, configurable: true });
      } catch {
        window.chrome = chromeObj;
      }
    }

    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true,
      });
    } catch {
      /* ignore */
    }

    // Hide common Electron leaks
    try {
      delete window.electron;
      delete window.electronAPI;
      delete window.textNexusNotify;
    } catch {
      /* ignore */
    }

    try {
      if (navigator.plugins && navigator.plugins.length === 0) {
        Object.defineProperty(navigator, 'plugins', {
          get: () => [{ name: 'Chrome PDF Plugin' }, { name: 'Chrome PDF Viewer' }, { name: 'Native Client' }],
        });
      }
    } catch {
      /* ignore */
    }

    try {
      const originalQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions);
      if (originalQuery) {
        window.navigator.permissions.query = (params) => {
          if (params && (params.name === 'notifications' || params.name === 'camera' || params.name === 'microphone')) {
            return Promise.resolve({ state: 'granted', onchange: null });
          }
          return originalQuery(params);
        };
      }
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.warn('[snapchat-preload] spoof failed', e);
  }

  try {
    require('./passkey-frame-preload.js');
  } catch (_) {}
})();
