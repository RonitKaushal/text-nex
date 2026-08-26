import { STORAGE_KEYS } from '../constants';

export function getStoredUsername(): string {
  try {
    return String(localStorage.getItem(STORAGE_KEYS.USERNAME) || '').trim();
  } catch {
    return '';
  }
}

export function setStoredUsername(name: string): void {
  const cleaned = String(name || '').trim();
  if (!cleaned) return;
  try {
    localStorage.setItem(STORAGE_KEYS.USERNAME, cleaned);
  } catch {
    /* ignore */
  }
}

export function clearStoredUsername(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.USERNAME);
  } catch {
    /* ignore */
  }
}
