import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { StoragePressureManager } from '../storage-pressure-manager';
import type { StoragePressureQueueStore } from '../storage-pressure-manager';
import type { QueueItem, QueueFilter } from '../types/queue-item';
import {
  COMPACT_MODE_ENTER_BYTES,
  COMPACT_MODE_EXIT_BYTES,
  PURGE_MAX_ITEMS,
  PURGE_TARGET_RECLAIM_BYTES,
} from '../utils/constants';

/**
 * Property-based tests for StoragePressureManager (offline-queue-robustness spec task 8.2).
 * Property 20: storage pressure hysteresis (enter <10MB, exit only >20MB).
 * Property 21: purge removes oldest synced items first, capped.
 *
 * Uses a fake StoragePressureQueueStore (3 methods) — no IndexedDB needed.
 */

const QUOTA = 1_000_000_000; // 1GB fixed quota; we vary usage to set "available".

// A fake store whose available headroom we control via a mutable usage value,
// and which holds a fixed set of completed items for purge tests.
class FakeStore implements StoragePressureQueueStore {
  usage = 0;
  items: QueueItem[] = [];
  dequeued: string[] = [];

  async getStorageEstimate(): Promise<StorageEstimate> {
    return { quota: QUOTA, usage: this.usage };
  }
  async getAll(filter?: QueueFilter): Promise<QueueItem[]> {
    if (filter?.state) return this.items.filter((i) => i.state === filter.state);
    return [...this.items];
  }
  async dequeue(id: string): Promise<void> {
    this.dequeued.push(id);
    this.items = this.items.filter((i) => i.id !== id);
  }
}

function availToUsage(available: number): number {
  return QUOTA - available;
}

function completedItem(seq: number, createdAt: number): QueueItem {
  return {
    id: 'id-' + seq,
    sequenceNumber: seq,
    operationType: 'create',
    noteId: 'n',
    payload: { title: 't', content: 'c' },
    payloadChecksum: '00000000',
    state: 'completed',
    createdAt,
    lastAttemptAt: null,
    retryCount: 0,
    error: null,
  };
}

describe('StoragePressureManager properties', () => {
  // Property 20: hysteresis — enter <10MB, exit only >20MB, stable in the band.
  it('Property 20: compact mode obeys enter/exit hysteresis and never flaps in-band', async () => {
    // A sequence of available-byte readings spanning the thresholds.
    const availArb = fc.integer({ min: 0, max: 40 * 1024 * 1024 });
    await fc.assert(
      fc.asyncProperty(fc.array(availArb, { minLength: 1, maxLength: 30 }), async (avails) => {
        const store = new FakeStore();
        const mgr = new StoragePressureManager(store);
        let expected = false; // mirror the documented hysteresis
        for (const avail of avails) {
          store.usage = availToUsage(avail);
          await mgr.evaluate();
          if (!expected && avail < COMPACT_MODE_ENTER_BYTES) {
            expected = true;
          } else if (expected && avail > COMPACT_MODE_EXIT_BYTES) {
            expected = false;
          }
          // In the 10–20MB band with no crossing, mode stays as-is.
          expect(mgr.isCompactMode).toBe(expected);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Property 20 (cont): once compact, a reading in (enter, exit] does NOT exit.
  it('Property 20: a reading within the hysteresis band does not exit compact mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: COMPACT_MODE_ENTER_BYTES, max: COMPACT_MODE_EXIT_BYTES }),
        async (bandAvail) => {
          const store = new FakeStore();
          const mgr = new StoragePressureManager(store);
          // Force into compact mode first.
          store.usage = availToUsage(COMPACT_MODE_ENTER_BYTES - 1);
          await mgr.evaluate();
          expect(mgr.isCompactMode).toBe(true);
          // A reading inside the band must keep it compact.
          store.usage = availToUsage(bandAvail);
          await mgr.evaluate();
          expect(mgr.isCompactMode).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 21: purge removes oldest-by-createdAt synced items first, capped.
  it('Property 21: purgeOldSyncedItems removes oldest synced first, within the cap', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 40 }),
        fc.integer({ min: 1, max: 30 }),
        async (createdAts, requested) => {
          const store = new FakeStore();
          // Small per-item bytes so the 2MB reclaim target never short-circuits
          // before the count cap (isolates the ordering + cap behaviour).
          store.items = createdAts.map((ts, i) => completedItem(i + 1, ts));
          const mgr = new StoragePressureManager(store, {
            estimateItemBytes: () => 1, // 1 byte each -> reclaim target irrelevant
          });

          const orderedOldestFirst = [...store.items].sort((a, b) =>
            a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.sequenceNumber - b.sequenceNumber,
          );
          const cap = Math.min(requested, PURGE_MAX_ITEMS);
          const expectedCount = Math.min(cap, orderedOldestFirst.length);

          const purged = await mgr.purgeOldSyncedItems(requested);

          expect(purged).toBe(expectedCount);
          // Never exceeds the hard cap.
          expect(purged).toBeLessThanOrEqual(PURGE_MAX_ITEMS);
          // The dequeued ids are exactly the oldest `expectedCount` items, in order.
          expect(store.dequeued).toEqual(
            orderedOldestFirst.slice(0, expectedCount).map((i) => i.id),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 21 (cont): non-positive maxToPurge purges nothing.
  it('Property 21: a non-positive cap purges nothing', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -5, max: 0 }), async (cap) => {
        const store = new FakeStore();
        store.items = [completedItem(1, 100), completedItem(2, 200)];
        const mgr = new StoragePressureManager(store, { estimateItemBytes: () => 1 });
        expect(await mgr.purgeOldSyncedItems(cap)).toBe(0);
        expect(store.dequeued).toEqual([]);
      }),
      { numRuns: 20 },
    );
  });
});
