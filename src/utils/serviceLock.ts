import type { ServiceTab } from '../types';
import { hashPassword, isHashedPassword, verifyPassword } from './passwordHash';

/** Verify against hashed lock, or legacy plaintext (then caller should migrate). */
export async function verifyServiceLockPassword(
  service: ServiceTab,
  password: string
): Promise<{ ok: boolean; needsMigration: boolean }> {
  if (service.lockPasswordHash && isHashedPassword(service.lockPasswordHash)) {
    const ok = await verifyPassword(password, service.lockPasswordHash);
    return { ok, needsMigration: false };
  }

  // Legacy plaintext storage
  if (service.lockPassword && service.lockPassword === password) {
    return { ok: true, needsMigration: true };
  }

  return { ok: false, needsMigration: false };
}

export async function createLockHash(password: string): Promise<string> {
  return hashPassword(password);
}
