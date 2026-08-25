/** SHA-256 password hashing with random salt (Web Crypto — renderer safe). */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function sha256(data: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
}

/**
 * Hash a password. Stored format: `saltHex:hashHex`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const payload = new Uint8Array(salt.length + encoder.encode(password).length);
  payload.set(salt, 0);
  payload.set(encoder.encode(password), salt.length);
  const digest = await sha256(payload);
  return `${toHex(salt.buffer)}:${toHex(digest)}`;
}

/**
 * Verify password against stored `saltHex:hashHex` value.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = fromHex(saltHex);
  const encoder = new TextEncoder();
  const encoded = encoder.encode(password);
  const payload = new Uint8Array(salt.length + encoded.length);
  payload.set(salt, 0);
  payload.set(encoded, salt.length);
  const digest = await sha256(payload);
  return toHex(digest) === hashHex;
}

/** True if value looks like our salted hash (not legacy plaintext). */
export function isHashedPassword(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 2 && parts[0].length === 32 && parts[1].length === 64;
}
