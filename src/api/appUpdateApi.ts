import api from '../services/api';
import { APP_VERSION } from '../constants';

export type AppReleaseInfo = {
  id?: string;
  appId?: string;
  version: string;
  downloadUrl: string;
  title?: string;
  changelog?: string;
  changes?: string[];
  forceUpdate?: boolean;
  publishedAt?: string;
};

export type UpdateCheckResult = {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  release: AppReleaseInfo | null;
};

export const appUpdateApi = {
  check: async (currentVersion?: string): Promise<UpdateCheckResult> => {
    let version = currentVersion || APP_VERSION;
    try {
      if (window.electronAPI?.getAppVersion) {
        version = (await window.electronAPI.getAppVersion()) || version;
      }
    } catch {
      /* use fallback */
    }

    const { data } = await api.get('/app/update', {
      params: { app: 'text-next', current: version },
    });

    return {
      updateAvailable: !!data?.updateAvailable,
      currentVersion: data?.currentVersion || version,
      latestVersion: data?.latestVersion || version,
      release: data?.release || null,
    };
  },
};
