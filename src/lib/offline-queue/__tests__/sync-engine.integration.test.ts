import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { SyncEngine } from '../sync-engine';
import type { SyncTransport, TransportResponse } from '../sync-engine';
import { QueueStore } from '../queue-store';
import { RetryScheduler } from '../retry-scheduler';
import { CircuitBreaker } from '../circuit-breaker';
import { ConflictResolver } from '../conflict-resolver';
import type { ConnectivityMonitor } from '../connectivity-monitor';
import type { QueueItem, QueueItemInput } from '../types/queue-item';

/**
 * Integration tests for SyncEngine (offline-queue-robustness spec task 10.3).
 *
 * These exercise the engine end-to-end against a real {@link QueueStore}
 * (fake-indexeddb), the real RetryScheduler / CircuitBreaker / ConflictResolver,
 * and a mocked transport standing in for the Supabase backend:
 *  - full enqueue → sync → complete lifecycle (with a recorded backend call log);
 *  - database-corruption recovery via {@link QueueStore.rebuildDatabase};
 *  - the online → reachability → queue-processing pipeline driven by a fake
 *    {@link ConnectivityMonitor}.
 */

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

/** A ConnectivityMonitor whose confirmed transitions tests drive explicitly. */
class FakeConnectivityMonitor implements ConnectivityMonitor {
  isOnline: boolean;
  isReachable: boolean;
  private readonly listeners = new Set<(online: boolean) => void>();

  constructor(initialOnline = false) {
    this.isOnline = initialOnline;
    this.isReachable = initialOnline;
  }
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
  /** Simulate a *confirmed* connectivity change (post-reachability check). */
  emit(online: boolean): void {
    this.isOnline = online;
    this.isReachable = online;
    for (const cb of [...this.listeners]) cb(online);
  }
}

/**
 * A mock Supabase-style backend. Records every call and resolves each item per a
 * configurable responder. Defaults to success (HTTP 200).
 */
class MockBackend {
  readonly calls: Array<{ noteId: string; operationType: string }> = [];
  responder: (item: QueueItem) => TransportResponse = () => ({ status: 200 });

  readonly transport: SyncTransport = async (item: QueueItem): Promise<TransportResponse> => {
    this.calls.push({ noteId: item.noteId, operationType: item.operationType });
    return this.responder(item);
  };
}

function freshStore(): QueueStore {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  return new QueueStore();
}

function buildEngine(transport: SyncTransport, monitor: ConnectivityMonitor) {
  const store = freshStore();
  const now = () => 5_000;
  const engine = new SyncEngine({
    store,
    retryScheduler: new RetryScheduler({ random: () => 0, now }),
    circuitBreaker: new CircuitBreaker({ now }),
    conflictResolver: new ConflictResolver(),
    connectivityMonitor: monitor,
    transport,
    now,
  });
  return { store, engine };
}

function input(noteId: string, n: number): QueueItemInput {
  return {
    operationType: 'create',
    noteId,
    payload: { title: `t-${noteId}-${n}`, content: `c-${noteId}-${n}` },
  };
}

/** Polls until `fn()` is truthy or the budget elapses. */
async function waitFor(fn: () => boolean | Promise<boolean>, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('waitFor timed out');
}

// ---------------------------------------------------------------------------
// 1. Full enqueue → sync → complete lifecycle
// ---------------------------------------------------------------------------

describe('SyncEngine integration — enqueue → sync → complete', () => {
  it('drains a multi-note queue: every item is sent to the backend exactly once and marked completed', async () => {
    const backend = new MockBackend();
    const monitor = new FakeConnectivityMonitor(false);
    const { store, engine } = buildEngine(backend.transport, monitor);
    try {
      await store.enqueue(input('note-A', 0));
      await store.enqueue(input('note-A', 1));
      await store.enqueue(input('note-B', 0));

      engine.start();
      await engine.processQueue();

      const all = await store.getAll();
      expect(all).toHaveLength(3);
      expect(all.every((i) => i.state === 'completed')).toBe(true);
      // Exactly one backend call per enqueued item.
      expect(backend.calls).toHaveLength(3);
    } finally {
      engine.stop();
    }
  });

  it('emits a state-change to completed and clears active lanes once drained', async () => {
    const backend = new MockBackend();
    const monitor = new FakeConnectivityMonitor(false);
    const { store, engine } = buildEngine(backend.transport, monitor);
    const completedIds: string[] = [];
    const unsub = engine.on('state-change', (d) => {
      if (d.newState === 'completed') completedIds.push(d.itemId);
    });
    try {
      const a = await store.enqueue(input('note-A', 0));
      const b = await store.enqueue(input('note-B', 0));

      engine.start();
      await engine.processQueue();

      expect(completedIds.sort()).toEqual([a.id, b.id].sort());
      expect(engine.activeLanes.size).toBe(0);
      expect(engine.isProcessing).toBe(false);
    } finally {
      unsub();
      engine.stop();
    }
  });

  it('routes a non-retryable failure (HTTP 400) to the Dead Letter Store and emits item-dead-lettered', async () => {
    const backend = new MockBackend();
    backend.responder = () => ({ status: 400, message: 'bad request' });
    const monitor = new FakeConnectivityMonitor(false);
    const { store, engine } = buildEngine(backend.transport, monitor);
    const deadLettered: string[] = [];
    const unsub = engine.on('item-dead-lettered', (d) => deadLettered.push(d.itemId));
    try {
      const item = await store.enqueue(input('note-A', 0));

      engine.start();
      await engine.processQueue();

      // Removed from the active queue, present in the DLS.
      const remaining = await store.getAll();
      expect(remaining.find((i) => i.id === item.id)).toBeUndefined();
      const dls = await store.getDLSItems();
      expect(dls.map((d) => d.id)).toContain(item.id);
      expect(deadLettered).toContain(item.id);
    } finally {
      unsub();
      engine.stop();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Database corruption recovery
// ---------------------------------------------------------------------------

describe('SyncEngine integration — database corruption recovery', () => {
  it('rebuildDatabase salvages recovered items, preserves FIFO, and the engine then drains them', async () => {
    const backend = new MockBackend();
    const monitor = new FakeConnectivityMonitor(false);
    const { store, engine } = buildEngine(backend.transport, monitor);
    try {
      // Seed and snapshot the items, then simulate a corruption-recovery rebuild.
      await store.enqueue(input('note-A', 0));
      await store.enqueue(input('note-B', 0));
      const recovered = await store.getAll();
      expect(recovered).toHaveLength(2);

      await store.rebuildDatabase(recovered);

      // Items survive the rebuild in their original sequence order.
      const afterRebuild = await store.getAll();
      expect(afterRebuild.map((i) => i.sequenceNumber)).toEqual(
        recovered.map((i) => i.sequenceNumber),
      );

      // The sequence counter resumes at max+1: a new enqueue continues monotonically.
      const fresh = await store.enqueue(input('note-C', 0));
      const maxRecovered = Math.max(...recovered.map((i) => i.sequenceNumber));
      expect(fresh.sequenceNumber).toBe(maxRecovered + 1);

      // The engine drains the rebuilt + new items normally.
      engine.start();
      await engine.processQueue();
      const all = await store.getAll();
      expect(all.every((i) => i.state === 'completed')).toBe(true);
      expect(backend.calls).toHaveLength(3);
    } finally {
      engine.stop();
    }
  });

  it('rebuildDatabase with an empty recovery set yields a clean, empty, usable queue', async () => {
    const backend = new MockBackend();
    const monitor = new FakeConnectivityMonitor(false);
    const { store, engine } = buildEngine(backend.transport, monitor);
    try {
      await store.enqueue(input('note-A', 0));
      await store.rebuildDatabase([]); // nothing salvageable

      expect(await store.getQueueSize()).toBe(0);

      // The rebuilt schema is fully usable: enqueue restarts sequencing at 1.
      const fresh = await store.enqueue(input('note-Z', 0));
      expect(fresh.sequenceNumber).toBe(1);

      engine.start();
      await engine.processQueue();
      const all = await store.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].state).toBe('completed');
    } finally {
      engine.stop();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Online event → reachability → queue processing pipeline
// ---------------------------------------------------------------------------

describe('SyncEngine integration — connectivity pipeline', () => {
  it('does not process while offline, then drains once a confirmed online event fires', async () => {
    const backend = new MockBackend();
    const monitor = new FakeConnectivityMonitor(false); // start offline
    const { store, engine } = buildEngine(backend.transport, monitor);
    try {
      await store.enqueue(input('note-A', 0));
      await store.enqueue(input('note-B', 0));

      // start() while offline must not drain (monitor.isOnline === false).
      engine.start();
      await new Promise((r) => setTimeout(r, 20));
      expect(backend.calls).toHaveLength(0);
      const stillPending = await store.getAll();
      expect(stillPending.every((i) => i.state === 'pending')).toBe(true);

      // A confirmed online transition triggers processing.
      monitor.emit(true);
      await waitFor(async () => (await store.getAll()).every((i) => i.state === 'completed'));

      expect(backend.calls).toHaveLength(2);
    } finally {
      engine.stop();
    }
  });

  it('aborts in-flight work and retains items as pending when going offline mid-sync', async () => {
    const monitor = new FakeConnectivityMonitor(true); // start online
    let resolveTransport: (v: TransportResponse) => void = () => {};
    let sawRequest = false;
    const transport: SyncTransport = (_item, signal) =>
      new Promise<TransportResponse>((resolve, reject) => {
        sawRequest = true;
        resolveTransport = resolve;
        // A well-behaved transport rejects when the engine aborts (offline).
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });

    const { store, engine } = buildEngine(transport, monitor);
    try {
      await store.enqueue(input('note-A', 0));

      engine.start(); // online → kicks off a drain; transport hangs
      await waitFor(async () => sawRequest);

      // Go offline mid-flight: the engine aborts the in-flight request.
      monitor.emit(false);

      // The item is retained as pending (no failure recorded for an abort).
      await waitFor(async () => {
        const all = await store.getAll();
        return all.length === 1 && all[0].state === 'pending';
      });
      const all = await store.getAll();
      expect(all[0].state).toBe('pending');
      expect(all[0].retryCount).toBe(0); // abort did not count as a failed attempt

      // Avoid leaking a dangling promise.
      resolveTransport({ status: 200 });
    } finally {
      engine.stop();
    }
  });
});
