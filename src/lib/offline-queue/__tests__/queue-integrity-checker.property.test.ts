import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import fc from 'fast-check';
import { QueueIntegrityChecker } from '../queue-integrity-checker';
import { QueueStore } from '../queue-store';
import type { QueueItem, QueueItemState, QueueOperationType } from '../types/queue-item';

/**
 * Property-based tests for QueueIntegrityChecker (offline-queue-robustness spec task 7.2).
 * Property 14: schema validation correctly identifies invalid items.
 * Property 15: sequence contiguity gap detection.
 *
 * validateItem and checkSequenceContiguity are pure; the checker only needs a
 * QueueStore reference for its async DB methods, which these properties do not
 * exercise. A single store instance is shared (fake-indexeddb).
 */

const STATES: QueueItemState[] = ['pending', 'syncing', 'blocked', 'held', 'completed'];
const OPS: QueueOperationType[] = ['create', 'update', 'delete'];

function validItem(seq: number): QueueItem {
  return {
    id: '123e4567-e89b-4456-a456-' + String(seq).padStart(12, '0'),
    sequenceNumber: seq,
    operationType: 'create',
    noteId: 'note-' + seq,
    payload: { title: 't', content: 'c' },
    payloadChecksum: 'deadbeef',
    state: 'pending',
    createdAt: 1_700_000_000_000,
    lastAttemptAt: null,
    retryCount: 0,
    error: null,
  };
}

describe('QueueIntegrityChecker properties', () => {
  const store = new QueueStore();
  const checker = new QueueIntegrityChecker(store);

  // Property 14: schema validation identifies invalid items.
  it('Property 14: a well-formed item validates; a corrupted field invalidates it', () => {
    const arbValidItem = fc
      .record({
        seq: fc.integer({ min: 1, max: 1_000_000 }),
        op: fc.constantFrom(...OPS),
        noteId: fc.string({ minLength: 1, maxLength: 40 }),
        state: fc.constantFrom(...STATES),
        retryCount: fc.integer({ min: 0, max: 10 }),
      })
      .map(({ seq, op, noteId, state, retryCount }): QueueItem => {
        const it = validItem(seq);
        it.operationType = op;
        it.noteId = noteId;
        it.state = state;
        it.retryCount = retryCount;
        return it;
      });

    fc.assert(
      fc.property(arbValidItem, (item) => {
        // Well-formed item validates.
        expect(checker.validateItem(item).valid).toBe(true);

        // Corrupt exactly one field and assert it no longer validates.
        const mutation = fc.sample(fc.integer({ min: 0, max: 4 }), 1)[0];
        const bad: Record<string, unknown> = { ...item };
        switch (mutation) {
          case 0: delete bad.id; break;
          case 1: bad.sequenceNumber = 'not-a-number'; break;
          case 2: bad.operationType = 'frobnicate'; break;
          case 3: bad.state = 'banana'; break;
          case 4: bad.payload = null; break;
        }
        expect(checker.validateItem(bad as unknown as QueueItem).valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // Reference gap finder: interior missing integers among the present set.
  function expectedGaps(seqs: number[]): number[] {
    const sorted = Array.from(new Set(seqs)).sort((a, b) => a - b);
    const missing: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let n = sorted[i] + 1; n < sorted[i + 1]; n++) missing.push(n);
    }
    return missing;
  }

  // Property 15: sequence contiguity gap detection.
  it('Property 15: checkSequenceContiguity reports exactly the interior missing numbers', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 200 }), { minLength: 0, maxLength: 40 }),
        (seqs) => {
          const items = seqs.map((s) => validItem(s));
          const gaps = checker.checkSequenceContiguity(items);
          const flatMissing = gaps.flatMap((g) => g.missing);
          expect(flatMissing).toEqual(expectedGaps(seqs));
          // Each reported gap is internally consistent.
          for (const g of gaps) {
            expect(g.start).toBeLessThanOrEqual(g.end);
            expect(g.missing[0]).toBe(g.start);
            expect(g.missing[g.missing.length - 1]).toBe(g.end);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 15 (cont): contiguous runs and <2 items produce no gaps.
  it('Property 15: contiguous sequences and tiny inputs have no gaps', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 50 }), (start, len) => {
        const items = Array.from({ length: len }, (_, i) => validItem(start + i));
        expect(checker.checkSequenceContiguity(items)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});
