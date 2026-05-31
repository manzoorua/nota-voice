import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crc32, computeChecksum, verifyChecksum, generateUuid, isUuid } from '../utils';

/**
 * Property-based tests for the offline-queue utility primitives.
 *
 * These exercise the deterministic core logic (CRC32 checksums and UUID v4
 * generation) across a wide range of inputs. They complement the example-based
 * unit tests in utils.test.ts.
 */
describe('checksum properties', () => {
  it('crc32 is deterministic across all strings', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(crc32(s)).toBe(crc32(s));
      }),
    );
  });

  it('crc32 always yields an unsigned 32-bit integer', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const value = crc32(s);
        return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
      }),
    );
  });

  it('computeChecksum always produces an 8-char lowercase hex string', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (payload) => {
        return /^[0-9a-f]{8}$/.test(computeChecksum(payload));
      }),
    );
  });

  it('checksum round-trip: a freshly computed checksum always verifies', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (payload) => {
        return verifyChecksum(payload, computeChecksum(payload)) === true;
      }),
    );
  });

  it('checksum is insensitive to object key insertion order', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.jsonValue(), { minKeys: 1, maxKeys: 8 }),
        (record) => {
          const reordered: Record<string, unknown> = {};
          for (const key of Object.keys(record).reverse()) {
            reordered[key] = record[key];
          }
          return computeChecksum(record) === computeChecksum(reordered);
        },
      ),
    );
  });
});

describe('uuid properties', () => {
  it('generateUuid always produces a value accepted by isUuid', () => {
    fc.assert(
      fc.property(fc.integer(), () => {
        return isUuid(generateUuid());
      }),
    );
  });

  it('generated UUIDs are unique within a batch', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 200 }), (n) => {
        const ids = new Set<string>();
        for (let i = 0; i < n; i++) {
          ids.add(generateUuid());
        }
        return ids.size === n;
      }),
    );
  });
});
