/**
 * UUID v4 generation for QueueItem identifiers.
 *
 * Each QueueItem requires a unique identifier (design: `id: string // UUID v4`),
 * and the QueueItemSchema validates ids with `z.string().uuid()`. This module
 * produces RFC 4122 version 4 UUIDs.
 *
 * The implementation is self-contained and dependency-free. It prefers the
 * native `crypto.randomUUID()` (available in modern browsers and Node 19+),
 * falls back to `crypto.getRandomValues()` for environments without
 * `randomUUID`, and finally to `Math.random()` only when no Web Crypto API is
 * present (e.g. very old environments). This guarantees the queue can always
 * mint an id without relying on an external package.
 *
 * Validates: Requirements 1.3
 */

/** RFC 4122 version 4 UUID regular expression (lowercase canonical form). */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns the platform Crypto object when available, or undefined.
 *
 * Works in browsers (globalThis.crypto) and Node.js (globalThis.crypto since
 * Node 15+ via the Web Crypto API).
 */
function getCrypto(): Crypto | undefined {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  return c && typeof c === 'object' ? c : undefined;
}

/**
 * Generates a random UUID version 4 string in canonical lowercase form
 * (e.g. "f47ac10b-58cc-4372-a567-0e02b2c3d479").
 *
 * @returns A newly generated RFC 4122 v4 UUID.
 */
export function generateUuid(): string {
  const cryptoObj = getCrypto();

  // Fast path: native randomUUID (modern browsers, Node 19+).
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  // Build from cryptographically secure random bytes when possible.
  const bytes = new Uint8Array(16);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set the version (4) and variant (10xx) bits per RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 256; i++) {
    hex.push((i + 0x100).toString(16).slice(1));
  }

  return (
    hex[bytes[0]] +
    hex[bytes[1]] +
    hex[bytes[2]] +
    hex[bytes[3]] +
    '-' +
    hex[bytes[4]] +
    hex[bytes[5]] +
    '-' +
    hex[bytes[6]] +
    hex[bytes[7]] +
    '-' +
    hex[bytes[8]] +
    hex[bytes[9]] +
    '-' +
    hex[bytes[10]] +
    hex[bytes[11]] +
    hex[bytes[12]] +
    hex[bytes[13]] +
    hex[bytes[14]] +
    hex[bytes[15]]
  );
}

/**
 * Validates whether a string is a well-formed RFC 4122 version 4 UUID.
 *
 * @param value - The candidate string.
 * @returns True when the value matches the canonical v4 UUID format.
 */
export function isUuid(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}
