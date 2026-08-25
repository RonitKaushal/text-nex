import type { UserProfile } from '../types';

/**
 * True when the user's license must block messaging services.
 * Uses API flag plus local date / status checks (API often omits top-level licenseExpired).
 */
export function isLicenseExpired(
  profile: (UserProfile & { licenseExpired?: boolean }) | null | undefined
): boolean {
  if (!profile) return false;

  if (profile.licenseExpired === true) return true;

  const license = profile.activeLicense;
  if (!license) return false;

  if (license.isExpired === true) return true;
  if (String(license.status || '').toLowerCase() === 'expired') return true;
  if (String(license.status || '').toLowerCase() === 'inactive') return true;

  if (license.expireAt) {
    const ts = new Date(license.expireAt).getTime();
    if (!Number.isNaN(ts) && ts <= Date.now()) return true;
  }

  return false;
}

/** Milliseconds until expireAt (negative if already past). */
export function msUntilLicenseExpiry(
  profile: UserProfile | null | undefined
): number | null {
  const expireAt = profile?.activeLicense?.expireAt;
  if (!expireAt) return null;
  const ts = new Date(expireAt).getTime();
  if (Number.isNaN(ts)) return null;
  return ts - Date.now();
}
