import type { UserProfile } from '../types';

const PRO_TYPE_RE = /\b(pro|premium|business|enterprise)\b/i;

/**
 * Pro plan unlocks Bulk WhatsApp + Lead Gen.
 * Prefer profile.plan / activeLicense.plan from backend; also match type strings.
 * In development, unlocks for local testing.
 */
export function isProPlan(
  profile: (UserProfile & { plan?: string; licensePlan?: string }) | null | undefined
): boolean {
  if (import.meta.env?.DEV) return true;
  if (!profile) return false;
  const candidates = [
    profile.plan,
    (profile as { licensePlan?: string }).licensePlan,
    (profile.activeLicense as { plan?: string } | undefined)?.plan,
    profile.activeLicense?.type,
  ];
  return candidates.some((v) => typeof v === 'string' && PRO_TYPE_RE.test(v));
}

/** Services that require Pro plan */
export const PRO_SERVICE_IDS = new Set(['bulk-whatsapp', 'lead-gen']);

export function isProServiceId(serviceIdOrType: string): boolean {
  return PRO_SERVICE_IDS.has(serviceIdOrType);
}
