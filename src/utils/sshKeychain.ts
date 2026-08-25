import type { SshKeychainEntry } from '../types';

const STORAGE_KEY = 'ssh_keychain';

async function storeGet(key: string): Promise<unknown> {
  if (window.electronAPI?.store) {
    return window.electronAPI.store.get(key);
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function storeSet(key: string, value: unknown): Promise<void> {
  if (window.electronAPI?.store) {
    await window.electronAPI.store.set(key, value);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export async function loadKeychain(): Promise<SshKeychainEntry[]> {
  const data = await storeGet(STORAGE_KEY);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (k): k is SshKeychainEntry =>
      !!k &&
      typeof k === 'object' &&
      typeof (k as SshKeychainEntry).id === 'string' &&
      typeof (k as SshKeychainEntry).privateKey === 'string'
  );
}

export async function saveKeychain(entries: SshKeychainEntry[]): Promise<void> {
  await storeSet(STORAGE_KEY, entries);
}

export async function upsertKeychainEntry(
  entry: Omit<SshKeychainEntry, 'id' | 'createdAt'> & { id?: string }
): Promise<SshKeychainEntry[]> {
  const list = await loadKeychain();
  const id = entry.id || `key-${Date.now()}`;
  const next: SshKeychainEntry = {
    id,
    label: (entry.label || 'Untitled key').trim() || 'Untitled key',
    privateKey: entry.privateKey,
    publicKey: entry.publicKey?.trim() || undefined,
    passphrase: entry.passphrase || undefined,
    createdAt: Date.now(),
  };
  const idx = list.findIndex((k) => k.id === id);
  if (idx >= 0) {
    next.createdAt = list[idx].createdAt;
    list[idx] = next;
  } else {
    list.unshift(next);
  }
  await saveKeychain(list);
  return list;
}

export async function removeKeychainEntry(id: string): Promise<SshKeychainEntry[]> {
  const list = (await loadKeychain()).filter((k) => k.id !== id);
  await saveKeychain(list);
  return list;
}

export function detectKeyType(privateKey: string): string {
  const k = privateKey.trim();
  if (!k) return 'Type unknown';
  if (/BEGIN OPENSSH PRIVATE KEY/i.test(k)) return 'OpenSSH';
  if (/BEGIN RSA PRIVATE KEY/i.test(k)) return 'RSA';
  if (/BEGIN EC PRIVATE KEY/i.test(k) || /BEGIN OPENSSH.*ecdsa/i.test(k)) return 'ECDSA';
  if (/BEGIN.*PRIVATE KEY/i.test(k)) return 'Private key';
  return 'Type unknown';
}
