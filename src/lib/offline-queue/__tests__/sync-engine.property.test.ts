import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import fc from 'fast-check';
import { SyncEngine } from '../sync-engine';
import type { SyncTransport, TransportResponse } from '../sync-engine';
import { QueueStore } from '../queue-store';
import { RetryScheduler } from '../retry-scheduler';
import { CircuitBreaker } from '../circuit-breaker';
import { ConflictResolver } from '../conflict-resolver';
import type { ConnectivityMonitor } from '../connectivity-monitor';
import { MAX_CONCURRENT_LANES } from '../utils/constants';
import type { QueueItem, QueueItemInput, QueueItemState } from '../types/queue-item';
import type { StateChangeEventDetail } from '../types/events';

/**
 * Property-based tests for SyncEngine (offline-queue-robustness spec task 10.2).
 *
 * Property 5:  Lane isolation — a failing noteId blocks only its own lane.
 * Property 6:  Maximum concurrent lanes — never more than MAX_CONCURRENT_LANES
 *              items are in the `syncing` state at once.
 * Property 17: Queue state counts reflect the actual item distribution.
 * Property 18: State-change events carry correct, legal transition data.
 * Property 19: Manual re-attempt resets a blocked item to `pending`.
 *
 * The engine is exercised against a real {@link QueueStore} (backed by a fresh
 * `fake-indexeddb` factory per run) with the real RetryScheduler / CircuitBreaker
 * / ConflictResolver, and a mocked {@link SyncTransport} so per-item outcomes are
 * fully controllable and deterministic. The {@link ConnectivityMonitor} is faked
 * with `isOnline = false` so `start()` does not kick off an un-awaited drain — we
 * instead drive a single, fully-awaited `processQueue()` per scenario.
 */

// ---------------------------------------------------------------------------
// Test doubles & helpers
// ---------------------------------------------------------------------------

/** Controllable ConnectivityMonitor fake. `isOnline` starts false so `start()`
 *  does not auto-drain; tests can fire confirmed transitions via {@link emit}. */
class FakeConnectivityMonitor implements ConnectivityMonitor {
  isOnline = false;
  isReachable = false;
  private readonly listeners = new Set<(online: boolean) => void>();

  start(): void {
    /* no-op */
  }
  stop(): void {
    /* no-op */
  }
  async checkReachability(): Promise<boolean> {
    return this.isReachable;
  }
  onConnectivityChange(cb: (online: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  /** Fire a confirmed connectivity change to all listeners. */
  emit(online: boolean): void {
    this.isOnline = online;
    this.isReachable = online;
    for (const cb of [...this.listeners]) cb(online);
  }
}

function freshStore(): QueueStore {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  return new QueueStore();
}

interface EngineBundle {
  store: QueueStore;
  engine: SyncEngine;
  monitor: FakeConnectivityMonitor;
  breaker: CircuitBreaker;
}

function makeEngine(transport: SyncTransport, now: () => number = () => 1_000): EngineBundle {
  const store = freshStore();
  const retryScheduler = new RetryScheduler({ random: () => 0, now });
  const breaker = new CircuitBreaker({ now });
  const conflictResolver = new ConflictResolver();
  const monitor = new FakeConnectivityMonitor();
  const engine = new SyncEngine({
    store,
    retryScheduler,
    circuitBreaker: breaker,
    conflictResolver,
    connectivityMonitor: monitor,
    transport,
    now,
  });
  return { store, engine, monitor, breaker };
}

function input(noteId: string, n: number): QueueItemInput {
  return {
    operationType: 'create',
    noteId,
    payload: { title: `t-${noteId}-${n}`, content: `c-${noteId}-${n}` },
  };
}

/** Tally queue items by state. */
async function countByState(store: QueueStore): Promise<Record<QueueItemState, number>> {
  const all = await store.getAll();
  const counts: Record<QueueItemState, number> = {
    pending: 0,
    syncing: 0,
    blocked: 0,
    held: 0,
    completed: 0,
  };
  for (const item of all) counts[item.state] += 1;
  return counts;
}

// A note specification: how many items, and whether its transport should fail.
interface NoteSpec {
  failing: boolean;
  itemCount: number;
}

const arbNotes = fc.array(
  fc.record({
    failing: fc.boolean(),
    itemCount: fc.integer({ min: 1, max: 3 }),
  }),
  { minLength: 1, maxLength: 5 },
);

// ---------------------------------------------------------------------------
// Property 5: lane isolation
// ---------------------------------------------------------------------------

describe('SyncEngine — Property 5: lane isolation', () => {
  it('a failing noteId blocks only its own lane; other lanes fully complete', async () => {
    await fc.assert(
      fc.asyncProperty(arbNotes, async (specs: NoteSpec[]) => {
        const failing = new Set<string>();
        specs.forEach((s, i) => {
          if (s.failing) failing.add(`note-${i}`);
        });

        // 429 (rate limited) is retryable but is NOT a connectivity failure, so
        // it never trips the circuit breaker — keeping lanes independent.
        const transport: SyncTransport = async (item: QueueItem): Promise<TransportResponse> =>
          failing.has(item.noteId)
            ? { status: 429, message: 'rate limited' }
            : { status: 200 };

        const { store, engine } = makeEngine(transport);
        try {
          for (let i = 0; i < specs.length; i += 1) {
            for (let n = 0; n < specs[i].itemCount; n += 1) {
              await store.enqueue(input(`note-${i}`, n));
            }
          }

          engine.start(); // monitor.isOnline === false → no auto-drain
          await engine.processQueue();

          for (let i = 0; i < specs.length; i += 1) {
            const noteId = `note-${i}`;
            const items = await store.getByNoteId(noteId);
            const completed = items.filter((it) => it.state === 'completed').length;
            if (failing.has(noteId)) {
              // A failing lane completes nothing: its head is blocked and its
              // successors are blocked behind it.
              expect(completed).toBe(0);
              expect(items.every((it) => it.state === 'blocked')).toBe(true);
            } else {
              // A healthy lane drains entirely.
              expect(completed).toBe(specs[i].itemCount);
            }
          }
        } finally {
          engine.stop();
        }
      }),
      { numRuns: 40 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: maximum concurrent lanes
// ---------------------------------------------------------------------------

describe('SyncEngine — Property 6: maximum concurrent lanes', () => {
  it('never exceeds MAX_CONCURRENT_LANES items syncing simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), async (laneCount: number) => {
        let inFlight = 0;
        let maxInFlight = 0;

        const transport: SyncTransport = async (): Promise<TransportResponse> => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((r) => setTimeout(r, 10));
          inFlight -= 1;
          return { status: 200 };
        };

        const { store, engine } = makeEngine(transport);
        try {
          // One item per note → laneCount independent lanes.
          for (let i = 0; i < laneCount; i += 1) {
            await store.enqueue(input(`note-${i}`, 0));
          }

          engine.start();
          await engine.processQueue();

          expect(maxInFlight).toBeLessThanOrEqual(MAX_CONCURRENT_LANES);
          // Everything still syncs to completion.
          const counts = await countByState(store);
          expect(counts.completed).toBe(laneCount);
        } finally {
          engine.stop();
        }
      }),
      { numRuns: 30 },
    );
  });

  it('reaches exactly MAX_CONCURRENT_LANES when enough lanes are ready (barrier example)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    let inFlight = 0;
    let maxInFlight = 0;

    const transport: SyncTransport = async (): Promise<TransportResponse> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (inFlight >= MAX_CONCURRENT_LANES) release();
      await gate; // hold until the pool is saturated
      inFlight -= 1;
      return { status: 200 };
    };

    const { store, engine } = makeEngine(transport);
    try {
      const lanes = MAX_CONCURRENT_LANES + 3;
      for (let i = 0; i < lanes; i += 1) {
        await store.enqueue(input(`note-${i}`, 0));
      }
      engine.start();
      await engine.processQueue();
      expect(maxInFlight).toBe(MAX_CONCURRENT_LANES);
    } finally {
      engine.stop();
    }
  });
});

// ---------------------------------------------------------------------------
// Property 17: state counts reflect distribution
// ---------------------------------------------------------------------------

describe('SyncEngine — Property 17: state counts reflect distribution', () => {
  it('an all-success drain leaves every item completed and nothing syncing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 5 }),
        async (itemCounts: number[]) => {
          const transport: SyncTransport = async (): Promise<TransportResponse> => ({
            status: 200,
          });
          const { store, engine } = makeEngine(transport);
          try {
            let total = 0;
            for (let i = 0; i < itemCounts.length; i += 1) {
              for (let n = 0; n < itemCounts[i]; n += 1) {
                await store.enqueue(input(`note-${i}`, n));
                total += 1;
              }
            }

            engine.start();
            await engine.processQueue();

            const counts = await countByState(store);
            const sum =
              counts.pending + counts.syncing + counts.blocked + counts.held + counts.completed;
            expect(sum).toBe(total); // every item accounted for
            expect(counts.completed).toBe(total);
            expect(counts.syncing).toBe(0); // lanes cleared once the drain settles
            expect(engine.isProcessing).toBe(false);
            expect(engine.activeLanes.size).toBe(0);
          } finally {
            engine.stop();
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it('a mixed drain partitions completed (healthy lanes) vs blocked (failing lanes), none syncing', async () => {
    await fc.assert(
      fc.asyncProperty(arbNotes, async (specs: NoteSpec[]) => {
        const failing = new Set<string>();
        specs.forEach((s, i) => {
          if (s.failing) failing.add(`note-${i}`);
        });
        const transport: SyncTransport = async (item: QueueItem): Promise<TransportResponse> =>
          failing.has(item.noteId) ? { status: 429, message: 'rate limited' } : { status: 200 };

        const { store, engine } = makeEngine(transport);
        try {
          let healthyItems = 0;
          let failingItems = 0;
          for (let i = 0; i < specs.length; i += 1) {
            for (let n = 0; n < specs[i].itemCount; n += 1) {
              await store.enqueue(input(`note-${i}`, n));
            }
            if (failing.has(`note-${i}`)) failingItems += specs[i].itemCount;
            else healthyItems += specs[i].itemCount;
          }

          engine.start();
          await engine.processQueue();

          const counts = await countByState(store);
          expect(counts.syncing).toBe(0);
          expect(counts.completed).toBe(healthyItems);
          expect(counts.blocked).toBe(failingItems);
        } finally {
          engine.stop();
        }
      }),
      { numRuns: 40 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 18: state-change events carry correct data
// ---------------------------------------------------------------------------

const LEGAL_TRANSITIONS: Record<QueueItemState, QueueItemState[]> = {
  pending: ['syncing', 'blocked'],
  syncing: ['completed', 'blocked', 'pending'],
  blocked: ['pending'],
  held: ['pending'],
  completed: [],
};

describe('SyncEngine — Property 18: state-change events', () => {
  it('events carry a legal transition, a real itemId, and the injected timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(arbNotes, async (specs: NoteSpec[]) => {
        const FIXED_NOW = 777_777;
        const failing = new Set<string>();
        specs.forEach((s, i) => {
          if (s.failing) failing.add(`note-${i}`);
        });
        const transport: SyncTransport = async (item: QueueItem): Promise<TransportResponse> =>
          failing.has(item.noteId) ? { status: 429, message: 'rate limited' } : { status: 200 };

        const { store, engine } = makeEngine(transport, () => FIXED_NOW);
        const events: StateChangeEventDetail[] = [];
        const unsub = engine.on('state-change', (d) => events.push(d));
        try {
          const enqueuedIds = new Set<string>();
          for (let i = 0; i < specs.length; i += 1) {
            for (let n = 0; n < specs[i].itemCount; n += 1) {
              const it = await store.enqueue(input(`note-${i}`, n));
              enqueuedIds.add(it.id);
            }
          }

          engine.start();
          await engine.processQueue();

          // At least one transition happened (every item goes pending→syncing).
          expect(events.length).toBeGreaterThan(0);
          // Track the latest emitted state per item to compare against the store.
          const latestEmitted = new Map<string, QueueItemState>();
          for (const e of events) {
            expect(enqueuedIds.has(e.itemId)).toBe(true);
            expect(e.previousState).not.toBe(e.newState); // only real changes emit
            expect(LEGAL_TRANSITIONS[e.previousState]).toContain(e.newState);
            expect(e.at).toBe(FIXED_NOW); // injected clock
            latestEmitted.set(e.itemId, e.newState);
          }

          // The last emitted state for each item matches its persisted state.
          const all = await store.getAll();
          for (const item of all) {
            const last = latestEmitted.get(item.id);
            if (last !== undefined) {
              expect(item.state).toBe(last);
            }
          }
        } finally {
          unsub();
          engine.stop();
        }
      }),
      { numRuns: 40 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 19: manual re-attempt resets a blocked item to pending
// ---------------------------------------------------------------------------

describe('SyncEngine — Property 19: manual re-attempt', () => {
  it('reattemptItem flips a blocked item back to pending; completed items are untouched', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 4 }),
        async (itemCount: number, blockedIdxRaw: number) => {
          // Transport is irrelevant here: the engine is never started, so
          // processQueue is a no-op and reattemptItem only mutates state.
          const transport: SyncTransport = async (): Promise<TransportResponse> => ({
            status: 200,
          });
          const { store, engine } = makeEngine(transport);
          try {
            const items: QueueItem[] = [];
            for (let n = 0; n < itemCount; n += 1) {
              items.push(await store.enqueue(input('note-A', n)));
            }
            const idx = blockedIdxRaw % itemCount;
            const target = items[idx];

            // Force the chosen item into a blocked state, as the engine would
            // after a retryable failure.
            await store.updateState(target.id, 'blocked', { retryCount: 2 });

            await engine.reattemptItem(target);

            const after = (await store.getAll()).find((it) => it.id === target.id)!;
            expect(after.state).toBe('pending');

            // A completed item is never resurrected by reattemptItem.
            const other = items.find((it) => it.id !== target.id);
            if (other) {
              await store.updateState(other.id, 'completed');
              await engine.reattemptItem(other);
              const otherAfter = (await store.getAll()).find((it) => it.id === other.id)!;
              expect(otherAfter.state).toBe('completed');
            }
          } finally {
            engine.stop();
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
