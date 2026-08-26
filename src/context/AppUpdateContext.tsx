import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { message, notification } from 'antd';
import { appUpdateApi, type AppReleaseInfo, type UpdateCheckResult } from '../api/appUpdateApi';
import { APP_VERSION } from '../constants';

type DownloadProgress = {
  status: 'idle' | 'starting' | 'downloading' | 'opening' | 'done' | 'error';
  percent: number;
  destPath?: string;
  error?: string;
};

interface AppUpdateContextValue {
  checking: boolean;
  downloading: boolean;
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  release: AppReleaseInfo | null;
  progress: DownloadProgress;
  checkForUpdate: (opts?: { silent?: boolean }) => Promise<UpdateCheckResult | null>;
  downloadUpdate: () => Promise<void>;
}

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

const STARTUP_NOTIFIED_KEY = 'textnexus_update_notified_version';

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(APP_VERSION);
  const [latestVersion, setLatestVersion] = useState(APP_VERSION);
  const [release, setRelease] = useState<AppReleaseInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress>({
    status: 'idle',
    percent: 0,
  });
  const startupDone = useRef(false);

  const applyResult = useCallback((result: UpdateCheckResult) => {
    setUpdateAvailable(!!result.updateAvailable);
    setCurrentVersion(result.currentVersion || APP_VERSION);
    setLatestVersion(result.latestVersion || result.currentVersion || APP_VERSION);
    setRelease(result.release);
  }, []);

  const checkForUpdate = useCallback(
    async (opts?: { silent?: boolean }) => {
      setChecking(true);
      try {
        const result = await appUpdateApi.check();
        applyResult(result);
        return result;
      } catch (e) {
        if (!opts?.silent) {
          const err = e as { message?: string };
          message.error(err?.message || 'Could not check for updates');
        }
        return null;
      } finally {
        setChecking(false);
      }
    },
    [applyResult]
  );

  const downloadUpdate = useCallback(async () => {
    if (!release?.downloadUrl) {
      message.warning('No download URL available. Publish a release from admin panel first.');
      return;
    }

    if (!window.electronAPI?.downloadAppUpdate) {
      // Browser / no Electron — open URL in new tab
      window.open(release.downloadUrl, '_blank');
      return;
    }

    setDownloading(true);
    setProgress({ status: 'starting', percent: 0 });
    try {
      const result = await window.electronAPI.downloadAppUpdate({
        downloadUrl: release.downloadUrl,
        version: release.version,
      });
      if (!result?.ok) {
        throw new Error(result?.error || 'Download failed');
      }
      message.success(
        'Installer downloaded and opened. Complete the setup, then restart ArcticSwitch.'
      );
      setProgress({ status: 'done', percent: 100, destPath: result.destPath });
    } catch (e) {
      const err = e as { message?: string };
      setProgress({ status: 'error', percent: 0, error: err?.message });
      message.error(err?.message || 'Update download failed');
    } finally {
      setDownloading(false);
    }
  }, [release]);

  // Listen for download progress from main process
  useEffect(() => {
    if (!window.electronAPI?.onAppUpdateProgress) return undefined;
    return window.electronAPI.onAppUpdateProgress((data) => {
      setProgress({
        status: (data?.status as DownloadProgress['status']) || 'downloading',
        percent: data?.percent ?? 0,
        destPath: data?.destPath,
      });
      if (data?.status === 'downloading' || data?.status === 'starting') {
        setDownloading(true);
      }
      if (data?.status === 'done' || data?.status === 'error') {
        setDownloading(false);
      }
    });
  }, []);

  // Startup check — notify once per new version
  useEffect(() => {
    if (startupDone.current) return;
    startupDone.current = true;

    let cancelled = false;
    (async () => {
      const result = await checkForUpdate({ silent: true });
      if (cancelled || !result?.updateAvailable || !result.release) return;

      const ver = result.release.version;
      try {
        const already = localStorage.getItem(STARTUP_NOTIFIED_KEY);
        if (already === ver) return;
        localStorage.setItem(STARTUP_NOTIFIED_KEY, ver);
      } catch {
        /* ignore */
      }

      notification.info({
        key: 'app-update-available',
        message: `Update available — v${ver}`,
        description:
          result.release.title ||
          'A new ArcticSwitch version is ready. Open Profile to see changes and download.',
        duration: 10,
        placement: 'topRight',
        btn: undefined,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [checkForUpdate]);

  // Occasional background re-check (every 6 hours)
  useEffect(() => {
    const id = window.setInterval(() => {
      void checkForUpdate({ silent: true });
    }, 6 * 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [checkForUpdate]);

  const value = useMemo<AppUpdateContextValue>(
    () => ({
      checking,
      downloading,
      updateAvailable,
      currentVersion,
      latestVersion,
      release,
      progress,
      checkForUpdate,
      downloadUpdate,
    }),
    [
      checking,
      downloading,
      updateAvailable,
      currentVersion,
      latestVersion,
      release,
      progress,
      checkForUpdate,
      downloadUpdate,
    ]
  );

  return (
    <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>
  );
}

export function useAppUpdate() {
  const ctx = useContext(AppUpdateContext);
  if (!ctx) throw new Error('useAppUpdate must be used within AppUpdateProvider');
  return ctx;
}
