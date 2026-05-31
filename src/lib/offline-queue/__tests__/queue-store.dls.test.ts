/**
 * Unit tests for QueueStore Dead Letter Store operations (task 2.3).
 *
 * Covers `moveToDLS`, `getDLSItems`, `restoreFromDLS`, and `deleteDLSItem`,
 * verifying atomic moves between the `queue` and `deadLetter` stores, the
 * dead-letter snapshot shape, ordering by `movedAt`, retry/state/error reset on
 * restore, and rejection when the target id is absent.
 *
 * IndexedDB is provided by `fake-indexeddb/auto` (installed onto `globalThis`).
 *
 * Requirements: 3.5, 3.6, 8.4, 8.6.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import { QueueStore } from '../queue-store';
import type { QueueItem, QueueItemInput, DeadLetterItem } from '../types';

/** Reset the IndexedDB backing store before each test for isolation. */
beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

/** Builds a minimal valid QueueItemInput for a given note. */
function makeInput(noteId: string, title = 'Note'): QueueItemInput {
  return {
    operationType: 'create',
    noteId,
    payload: { title, content: `content for ${noteId}` },
  };
}

describe('QueueStore.moveToDLS', () => {
  it('removes the item from the queue and writes a dead-letter snapshot', async () => {
    const store = new QueueStore();
    const item = await store.enqueue(makeInput('note-a'));

    await store.moveToDLS(item.id, 'max retries exhausted');

    // Gone from the active queue.
    expect(await store.getAll()).toHaveLength(0);

    // Present in the DLS with a full snapshot and metadata.
    const dls = await store.getDLSItems();
    expect(dls).toHaveLength(1);
    const entry = dls[0];
    expect(entry.id).toBe(item.id);
    expect(entry.noteId).toBe('note-a');
    expect(entry.reason).toBe('max retries exhausted');
    expect(entry.originalItem).toEqual(item);
    expect(typeof entry.movedAt).toBe('number');

    store.close();
  });

  it('rejects when the id is not present in the queue', async () => {
    const store = new QueueStore();

    await expect(store.moveToDLS('missing-id', 'whatever')).rejects.toThrow(
      /no queue item with id "missing-id"/,
    );

    store.close();
  });

  it('does not move the item if the queue is otherwise untouched on failure', async () => {
    const store = new QueueStore();
    const item = await store.enqueue(makeInput('note-a'));

    await expect(store.moveToDLS('missing-id', 'reason')).rejects.toThrow();

    // The real item is still in the queue, nothing landed in the DLS.
    expect(await store.getAll()).toHaveLength(1);
    expect(await store.getDLSItems()).toHaveLength(0);
    expect((await store.getAll())[0].id).toBe(item.id);

    store.close();
  });
});

describe('QueueStore.getDLSItems', () => {
  it('returns items sorted by movedAt ascending', async () => {
    // Control Date.now so each move gets a distinct, increasing movedAt; with
    // identical timestamps the relative order of tied items is unspecified.
    // (Spying on Date.now avoids fake timers, which would stall fake-indexeddb.)
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000);
    const store = new QueueStore();
    const a = await store.enqueue(makeInput('note-a'));
    const b = await store.enqueue(makeInput('note-b'));
    const c = await store.enqueue(makeInput('note-c'));

    // Move out of insertion order; movedAt should drive the final ordering.
    nowSpy.mockReturnValue(2_000);
    await store.moveToDLS(b.id, 'first moved');
    nowSpy.mockReturnValue(3_000);
    await store.moveToDLS(a.id, 'second moved');
    nowSpy.mockReturnValue(4_000);
    await store.moveToDLS(c.id, 'third moved');

    const dls = await store.getDLSItems();
    expect(dls.map((d) => d.id)).toEqual([b.id, a.id, c.id]);
    const movedAts = dls.map((d) => d.movedAt);
    expect([...movedAts]).toEqual([...movedAts].sort((x, y) => x - y));

    nowSpy.mockRestore();
    store.close();
  });

  it('returns an empty array when the DLS is empty', async () => {
    const store = new QueueStore();
    expect(await store.getDLSItems()).toEqual([]);
    store.close();
  });
});

describe('QueueStore.restoreFromDLS', () => {
  it('moves the item back to the queue with retry/state/error reset', async () => {
    const store = new QueueStore();
    const item = await store.enqueue(makeInput('note-a'));

    // Simulate a failed item: bump retries, mark failure, then dead-letter it.
    await store.updateState(item.id, 'pending', {
      retryCount: 5,
      error: 'boom',
      lastAttemptAt: Date.now(),
    });
    await store.moveToDLS(item.id, 'max retries exhausted');

    await store.restoreFromDLS(item.id);

    // Removed from the DLS.
    expect(await store.getDLSItems()).toHaveLength(0);

    // Back in the queue with bookkeeping reset and identity/payload preserved.
    const queued = await store.getAll();
    expect(queued).toHaveLength(1);
    const restored: QueueItem = queued[0];
    expect(restored.id).toBe(item.id);
    expect(restored.sequenceNumber).toBe(item.sequenceNumber);
    expect(restored.payload).toEqual(item.payload);
    expect(restored.retryCount).toBe(0);
    expect(restored.state).toBe('pending');
    expect(restored.error).toBeNull();

    store.close();
  });

  it('rejects when the id is not present in the DLS', async () => {
    const store = new QueueStore();

    await expect(store.restoreFromDLS('missing-id')).rejects.toThrow(
      /no item with id "missing-id"/,
    );

    store.close();
  });
});

describe('QueueStore.deleteDLSItem', () => {
  it('permanently removes an item from the DLS', async () => {
    const store = new QueueStore();
    const item = await store.enqueue(makeInput('note-a'));
    await store.moveToDLS(item.id, 'non-retryable error');

    expect(await store.getDLSItems()).toHaveLength(1);

    await store.deleteDLSItem(item.id);

    expect(await store.getDLSItems()).toHaveLength(0);

    store.close();
  });

  it('is a no-op when the id is absent', async () => {
    const store = new QueueStore();
    await expect(store.deleteDLSItem('missing-id')).resolves.toBeUndefined();
    store.close();
  });

  it('leaves other dead-letter items intact', async () => {
    const store = new QueueStore();
    const a = await store.enqueue(makeInput('note-a'));
    const b = await store.enqueue(makeInput('note-b'));
    await store.moveToDLS(a.id, 'reason a');
    await store.moveToDLS(b.id, 'reason b');

    await store.deleteDLSItem(a.id);

    const remaining: DeadLetterItem[] = await store.getDLSItems();
    expect(remaining.map((d) => d.id)).toEqual([b.id]);

    store.close();
  });
});
