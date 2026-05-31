import { describe, it, expect } from 'vitest';
import {
  crc32,
  computeChecksum,
  verifyChecksum,
  generateUuid,
  isUuid,
  MAX_QUEUE_SIZE,
  MAX_RETRIES,
  MAX_CONCURRENT_LANES,
  RETRY_BASE_DELAY_MS,
  RETRY_BACKOFF_FACTOR,
  RETRY_MAX_DELAY_MS,
  RETRY_JITTER_FACTOR,
  CB_FAILURE_THRESHOLD,
  CB_FAILURE_WINDOW_MS,
  CB_INITIAL_COOLDOWN_MS,
  CB_MAX_COOLDOWN_MS,
  MAX_ITEM_PAYLOAD_BYTES,
  COMPACT_MODE_ENTER_BYTES,
  COMPACT_MODE_EXIT_BYTES,
  PURGE_MAX_ITEMS,
  PURGE_TARGET_RECLAIM_BYTES,
  QUEUE_SIZE_WARNING_BYTES,
  DB_NAME,
  DB_VERSION,
} from '../utils';

describe('crc32', () => {
  it('matches the well-known CRC32 of "123456789" (0xCBF43926)', () => {
    expect(crc32('123456789')).toBe(0xcbf43926);
  });

  it('returns 0 for the empty string', () => {
    expect(crc32('')).toBe(0);
  });

  it('is deterministic for the same input', () => {
    expect(crc32('the quick brown fox')).toBe(crc32('the quick brown fox'));
  });

  it('differs for different inputs', () => {
    expect(crc32('abc')).not.toBe(crc32('abd'));
  });

  it('always returns an unsigned 32-bit integer', () => {
    const value = crc32('\u00e9\u00e8\u00ea some unicode \u{1f600}');
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('computeChecksum / verifyChecksum', () => {
  it('produces an 8-character lowercase hex string', () => {
    const checksum = computeChecksum({ title: 'Note', content: 'Body' });
    expect(checksum).toMatch(/^[0-9a-f]{8}$/);
  });

  it('round-trips: a computed checksum verifies against its payload', () => {
    const payload = { title: 'Hello', content: 'World', metadata: { tag: 1 } };
    const checksum = computeChecksum(payload);
    expect(verifyChecksum(payload, checksum)).toBe(true);
  });

  it('is insensitive to object key order', () => {
    const a = computeChecksum({ title: 'A', content: 'B' });
    const b = computeChecksum({ content: 'B', title: 'A' });
    expect(a).toBe(b);
  });

  it('detects a modified payload', () => {
    const checksum = computeChecksum({ title: 'A', content: 'B' });
    expect(verifyChecksum({ title: 'A', content: 'B!' }, checksum)).toBe(false);
  });

  it('accepts a plain string payload', () => {
    const checksum = computeChecksum('raw-string-payload');
    expect(verifyChecksum('raw-string-payload', checksum)).toBe(true);
  });
});

describe('generateUuid / isUuid', () => {
  it('generates a valid RFC 4122 v4 UUID', () => {
    const id = generateUuid();
    expect(isUuid(id)).toBe(true);
  });

  it('sets the version nibble to 4 and a valid variant', () => {
    const id = generateUuid();
    expect(id[14]).toBe('4');
    expect(['8', '9', 'a', 'b']).toContain(id[19].toLowerCase());
  });

  it('generates unique values across many calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      set.add(generateUuid());
    }
    expect(set.size).toBe(1000);
  });

  it('rejects malformed UUID strings', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    // A v1-style UUID (version nibble 1) should be rejected by the v4 check.
    expect(isUuid('f47ac10b-58cc-1372-a567-0e02b2c3d479')).toBe(false);
  });
});

describe('constants', () => {
  it('match the values derived from requirements and design', () => {
    expect(MAX_QUEUE_SIZE).toBe(1000);
    expect(MAX_RETRIES).toBe(5);
    expect(MAX_CONCURRENT_LANES).toBe(3);

    expect(RETRY_BASE_DELAY_MS).toBe(1000);
    expect(RETRY_BACKOFF_FACTOR).toBe(2);
    expect(RETRY_MAX_DELAY_MS).toBe(60000);
    expect(RETRY_JITTER_FACTOR).toBe(0.3);

    expect(CB_FAILURE_THRESHOLD).toBe(5);
    expect(CB_FAILURE_WINDOW_MS).toBe(60000);
    expect(CB_INITIAL_COOLDOWN_MS).toBe(30000);
    expect(CB_MAX_COOLDOWN_MS).toBe(300000);

    expect(MAX_ITEM_PAYLOAD_BYTES).toBe(5 * 1024 * 1024);
    expect(COMPACT_MODE_ENTER_BYTES).toBe(10 * 1024 * 1024);
    expect(COMPACT_MODE_EXIT_BYTES).toBe(20 * 1024 * 1024);
    expect(PURGE_MAX_ITEMS).toBe(20);
    expect(PURGE_TARGET_RECLAIM_BYTES).toBe(2 * 1024 * 1024);
    expect(QUEUE_SIZE_WARNING_BYTES).toBe(50 * 1024 * 1024);

    expect(DB_NAME).toBe('NotaVoiceOfflineDB');
    expect(DB_VERSION).toBe(2);
  });

  it('uses hysteresis: compact-mode exit threshold exceeds enter threshold', () => {
    expect(COMPACT_MODE_EXIT_BYTES).toBeGreaterThan(COMPACT_MODE_ENTER_BYTES);
  });
});
