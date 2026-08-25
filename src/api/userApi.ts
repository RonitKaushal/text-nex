import api from '../services/api';
import type { AxiosResponse } from 'axios';
import type { UserProfile } from '../types';

export interface ProfileResponse {
  user?: UserProfile & { licenseExpired?: boolean };
  success?: boolean;
  message?: string;
  licenseExpiry?: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  refreshToken?: string;
  user?: {
    email?: string;
    phone?: string;
  };
  message?: string;
}

interface RenewResponse {
  success: boolean;
  message?: string;
  licenseExpiry?: string;
}

/** Share one in-flight request + short TTL so Profile / Auth / webviews don't stampede. */
const PROFILE_TTL_MS = 45_000;
let profileInflight: Promise<AxiosResponse<ProfileResponse>> | null = null;
let profileCache: { at: number; response: AxiosResponse<ProfileResponse> } | null =
  null;

export function clearProfileCache() {
  profileCache = null;
  profileInflight = null;
}

export const userApi = {
  getProfile: (options?: { force?: boolean }) => {
    const force = !!options?.force;

    if (force) {
      profileCache = null;
    }

    if (
      !force &&
      profileCache &&
      Date.now() - profileCache.at < PROFILE_TTL_MS
    ) {
      return Promise.resolve(profileCache.response);
    }

    if (!force && profileInflight) {
      return profileInflight;
    }

    const request = api
      .get<ProfileResponse>('/user/profile')
      .then((response) => {
        profileCache = { at: Date.now(), response };
        return response;
      })
      .finally(() => {
        if (profileInflight === request) {
          profileInflight = null;
        }
      });

    profileInflight = request;
    return request;
  },

  loginWithLicense: (payload: {
    licenseKey: string;
    phone: string;
    deviceType: string;
    appType?: string;
  }) => {
    clearProfileCache();
    return api.post<LoginResponse>('/user/login-license', {
      ...payload,
      appType: payload.appType || 'text-next',
    });
  },

  renewLicense: (licenseKey: string) => {
    clearProfileCache();
    return api.post<RenewResponse>('/user/renew-license', {
      licenseKey,
      appType: 'text-next',
    });
  },
};
