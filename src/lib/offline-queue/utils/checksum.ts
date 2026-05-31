/**
 * CRC32 checksum computation for QueueItem payload integrity verification.
 *
 * The offline queue stores a checksum for each QueueItem payload at write time
 * and verifies it at read time before sync processing. A mismatch indicates the
 * stored payload was corrupted and the item must be moved to the Dead Letter Store.
 *
 * This is a self-contained, dependency-free implementation of the standard
 * CRC-32 (IEEE 802.3, polynomial 0xEDB88320) algorithm so the queue does not
 * rely on any external package for integrity checking.
 *
 * Validates: Requirements 7.5, 7.6
 */

/**
 * Precomputed CRC32 lookup table (256 entries). Built once on module load.
 */
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * Computes the CRC32 of a UTF-8 encoded string and returns the raw unsigned
 * 32-bit integer value.
 *
 * Uses TextEncoder when available (browser/modern Node) so multi-byte Unicode
 * characters are hashed consistently regardless of platform. Falls back to a
 * manual UTF-8 encoding when TextEncoder is unavailable.
 *
 * @param input - The string to checksum (typically a JSON-serialized payload).
 * @returns The CRC32 value as an unsigned 32-bit integer (0 to 4294967295).
 */
export function crc32(input: string): number {
  const bytes = encodeUtf8(input);
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Computes a checksum string for a payload value.
 *
 * The payload is JSON-serialized with stable key ordering so that two logically
 * equal payloads always produce the same checksum, then hashed with CRC32. The
 * result is returned as a zero-padded 8-character lowercase hexadecimal string
 * (e.g. "1a2b3c4d") suitable for storage on the QueueItem and later comparison.
 *
 * @param payload - The payload object (or any JSON-serializable value) to checksum.
 * @returns An 8-character hexadecimal checksum string.
 */
export function computeChecksum(payload: unknown): string {
  const serialized = stableStringify(payload);
  return crc32(serialized).toString(16).padStart(8, '0');
}

/**
 * Verifies that a payload still matches a previously computed checksum.
 *
 * @param payload - The payload to verify.
 * @param expectedChecksum - The checksum produced by {@link computeChecksum} at write time.
 * @returns True when the recomputed checksum matches the expected value, false otherwise.
 */
export function verifyChecksum(payload: unknown, expectedChecksum: string): boolean {
  return computeChecksum(payload) === expectedChecksum;
}

/**
 * Deterministically serializes a value to JSON with object keys sorted
 * recursively. This guarantees a stable representation so checksums are
 * insensitive to key insertion order while remaining sensitive to any change
 * in keys or values.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object' && !isBinaryLike(value)) {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * ArrayBuffer / typed-array payload fields (e.g. audio blobs) are not plain
 * objects and JSON.stringify would turn them into "{}". They are left untouched
 * here so the surrounding object structure still serializes consistently.
 */
function isBinaryLike(value: object): boolean {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

/**
 * Encodes a string to a UTF-8 byte array. Prefers the platform TextEncoder and
 * falls back to a manual implementation for environments where it is missing.
 */
function encodeUtf8(input: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(input);
  }

  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let codePoint = input.charCodeAt(i);

    // Combine surrogate pairs into a single code point.
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}
