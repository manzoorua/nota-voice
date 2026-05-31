/**
 * Unit tests for QueueStore database initialization and schema migration (task 2.1).
 *
 * These verify the version-2 schema is created correctly (object stores,
 * indexes, key paths), that opening is idempotent, that the sequence counter is
 * seeded, and that an upgrade from the legacy v1 `notes` schema preserves the
 * legacy store while adding the new stores.
 *
 * IndexedDB is provided by `fake-indexeddb/auto`, which installs a spec-compliant
 * in-memory implementation onto `globalThis` for the Node test environment.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import { QueueStore, promisifyRequest } from '../queue-store';
import {
  DB_NAME,
  DB_VERSION,
  STORE_QUEUE,
  STORE_DEAD_LETTER,
  STORE_METADATA,
} from '../utils/constants';

/** Reset the IndexedDB backing store before each test for isolation. */
beforeEach(() => {
  // A fresh factory discards all previously created databases.
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('QueueStore.openDatabase', () => {
  it('opens the database at version 2', async () => {
    const store = new QueueStore();
    const db = await store.openDatabase();

    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);

    store.close();
  });

  it('creates the queue, deadLetter, and metadata object stores', async () => {
    const store = new QueueStore();
    const db = await store.openDatabase();

    const names = Array.from(db.objectStoreNames);
    expect(names).toContain(STORE_QUEUE);
    expect(names).toContain(STORE_DEAD_LETTER);
    expect(names).toContain(STORE_METADATA);

    store.close();
  });

  it('defines the queue store keyPath and indexes per the design', async () => {
    const store = new QueueStore();
    const db = await store.openDatabase();

    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const queue = tx.objectStore(STORE_QUEUE);

    expect(queue.keyPath).toBe('id');

    const seq = queue.index('sequenceNumber');
    expect(seq.keyPath).toBe('sequenceNumber');
    expect(seq.unique).toBe(true);

    expect(queue.index('noteId').keyPath).toBe('noteId');
    expect(queue.index('noteId').unique).toBe(false);
    expect(queue.index('state').keyPath).toBe('state');
    expect(queue.index('createdAt').keyPath).toBe('createdAt');

    store.close();
  });

  it('defines the deadLetter store keyPath and indexes', async () => {
    const store = new QueueStore();
    const db = await store.openDatabase();

    const tx = db.transaction(STORE_DEAD_LETTER, 'readonly');
    const dls = tx.objectStore(STORE_DEAD_LETTER);

    expect(dls.keyPath).toBe('id');
    expect(dls.index('movedAt').keyPath).toBe('movedAt');
    expect(dls.index('noteId').keyPath).toBe('noteId');
    expect(dls.index('reason').keyPath).toBe('reason');

    store.close();
  });

  it('defines the metadata store keyed by "key" and seeds the sequence counter', async () => {
    const store = new QueueStore();
    const db = await store.openDatabase();

    const tx = db.transaction(STORE_METADATA, 'readonly');
    const metadata = tx.objectStore(STORE_METADATA);
    expect(metadata.keyPath).toBe('key');

    const seed = await promisifyRequest(metadata.get('lastSequenceNumber'));
    expect(seed).toEqual({ key: 'lastSequenceNumber', value: 0 });

    store.close();
  });

  it('is idempotent — repeated calls return the same connection', async () => {
    const store = new QueueStore();
    const first = await store.openDatabase();
    const second = await store.openDatabase();

    expect(second).toBe(first);

    store.close();
  });

  it('de-duplicates concurrent open calls', async () => {
    const store = new QueueStore();
    const [a, b] = await Promise.all([store.openDatabase(), store.openDatabase()]);

    expect(a).toBe(b);

    store.close();
  });

  it('upgrades from the legacy v1 schema while preserving the notes store', async () => {
    // Simulate an existing v1 database with the legacy `notes` store and a row.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const notes = db.createObjectStore('notes', { keyPath: 'id' });
        notes.createIndex('createdAt', 'createdAt');
        notes.createIndex('synced', 'synced');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('notes', 'readwrite');
        tx.objectStore('notes').put({
          id: 'legacy-1',
          title: 'Legacy note',
          content: 'created under v1',
          createdAt: '2024-01-01T00:00:00.000Z',
          synced: false,
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const store = new QueueStore();
    const db = await store.openDatabase();

    expect(db.version).toBe(DB_VERSION);

    // New v2 stores exist.
    const names = Array.from(db.objectStoreNames);
    expect(names).toContain(STORE_QUEUE);
    expect(names).toContain(STORE_DEAD_LETTER);
    expect(names).toContain(STORE_METADATA);

    // Legacy data is preserved across the upgrade.
    expect(names).toContain('notes');
    const legacy = await promisifyRequest(
      db.transaction('notes', 'readonly').objectStore('notes').get('legacy-1'),
    );
    expect(legacy).toMatchObject({ id: 'legacy-1', synced: false });

    store.close();
  });

  it('reopens after close()', async () => {
    const store = new QueueStore();
    const first = await store.openDatabase();
    store.close();

    const second = await store.openDatabase();
    expect(second.name).toBe(DB_NAME);
    // A new connection object is returned after closing.
    expect(second).not.toBe(first);

    store.close();
  });
});
