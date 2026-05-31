/**
 * QueueStore — IndexedDB adapter for the offline queue system.
 *
 * This module owns the IndexedDB database `NotaVoiceOfflineDB` (version 2) and
 * is the single persistence layer for the offline queue. IndexedDB is the
 * source of truth: all queue state lives here and the in-memory layers are
 * read-through caches that rebuild on startup (design: "IndexedDB as single
 * source of truth").
 *
 * This file establishes the database connection handling and schema. Queue
 * operations (enqueue/dequeue/peek/query), Dead Letter Store operations, and
 * metadata/integrity helpers are layered onto this same class by subsequent
 * tasks (2.2, 2.3, 2.4).
 *
 * Schema (design: Data Models / IndexedDB Schema):
 *
 * | Store        | keyPath | Indexes                                          |
 * |--------------|---------|--------------------------------------------------|
 * | `queue`      | `id`    | `sequenceNumber` (unique), `noteId`, `state`, `createdAt` |
 * | `deadLetter` | `id`    | `movedAt`, `noteId`, `reason`                    |
 * | `metadata`   | `key`   | —                                                |
 *
 * Requirements: 1.1 (persist within 500ms), 1.2 (restore on restart), 1.5
 * (recover/recreate schema on corruption).
 */

import {
  DB_NAME,
  DB_VERSION,
  MAX_QUEUE_SIZE,
  STORE_QUEUE,
  STORE_DEAD_LETTER,
  STORE_METADATA,
} from './utils/constants';
import {
  computeChecksum,
  generateUuid,
  // The util exports a free function `verifyChecksum(payload, checksum)`. The
  // QueueStore method below is also called `verifyChecksum` but takes a whole
  // QueueItem, so the util is aliased to avoid the name clash.
  verifyChecksum as verifyPayloadChecksum,
} from './utils';
import type {
  DeadLetterItem,
  QueueFilter,
  QueueItem,
  QueueItemInput,
  QueueItemState,
} from './types';

/**
 * Shape of a record in the `metadata` object store. Entries are stored as
 * key-value pairs keyed by {@link STORE_METADATA}'s keyPath (`key`). The
 * logical keys correspond to the fields of
 * {@link import('./types/queue-item').MetadataEntries}
 * (`lastSequenceNumber`, `circuitBreakerState`, `compactMode`).
 */
export interface MetadataRecord {
  key: string;
  value: unknown;
}

/**
 * Resolves the platform IndexedDB factory.
 *
 * Works in browsers (`window.indexedDB`) and in Node test environments where
 * `fake-indexeddb/auto` installs `indexedDB` onto `globalThis`.
 *
 * @returns The {@link IDBFactory}, or `undefined` when IndexedDB is unavailable.
 */
function getIndexedDB(): IDBFactory | undefined {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  return idb ?? undefined;
}

/**
 * Wraps an {@link IDBRequest} in a Promise that resolves with its result or
 * rejects with its error. Shared helper for the operation methods added by
 * later tasks.
 *
 * @typeParam T - The request result type.
 * @param request - The IndexedDB request to await.
 */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * Creates the version-2 object stores and their indexes, idempotently, and
 * seeds initial metadata. Runs inside the `versionchange` transaction during
 * `onupgradeneeded`.
 *
 * Upgrade handling:
 * - Fresh install (`oldVersion === 0`): all three stores are created.
 * - Upgrade from the v1 schema (`oldVersion === 1`): v1 used a single `notes`
 *   store. The new stores are created alongside it; the legacy `notes` store is
 *   left intact so previously captured offline notes are not lost during the
 *   transition (Requirement 1 — never lose offline work). A dedicated data
 *   migration step can later relocate any unsynced legacy notes into `queue`.
 *
 * Each store is guarded by an `objectStoreNames.contains` check so re-running an
 * upgrade (e.g. after a partial/aborted upgrade) never throws.
 *
 * @param db - The database being upgraded.
 * @param tx - The active `versionchange` transaction (used to seed metadata).
 * @param oldVersion - The version being upgraded from (0 for a fresh database).
 */
function upgradeSchema(
  db: IDBDatabase,
  tx: IDBTransaction | null,
  oldVersion: number,
): void {
  // `queue`: active queue items, keyed by UUID id.
  if (!db.objectStoreNames.contains(STORE_QUEUE)) {
    const queue = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
    // Unique sequence number drives strict FIFO ordering (Req 2.1, 2.4).
    queue.createIndex('sequenceNumber', 'sequenceNumber', { unique: true });
    // Groups items into per-note processing lanes (Req 2.2, 2.3).
    queue.createIndex('noteId', 'noteId', { unique: false });
    // Filter by lifecycle state for status counts (Req 8.1).
    queue.createIndex('state', 'state', { unique: false });
    // Creation-timestamp ordering / purge-oldest-first (Req 1.2, 9.4).
    queue.createIndex('createdAt', 'createdAt', { unique: false });
  }

  // `deadLetter`: permanently failed items moved out of the active queue.
  if (!db.objectStoreNames.contains(STORE_DEAD_LETTER)) {
    const deadLetter = db.createObjectStore(STORE_DEAD_LETTER, { keyPath: 'id' });
    deadLetter.createIndex('movedAt', 'movedAt', { unique: false });
    deadLetter.createIndex('noteId', 'noteId', { unique: false });
    deadLetter.createIndex('reason', 'reason', { unique: false });
  }

  // `metadata`: key-value store for sequence counter, circuit breaker snapshot,
  // and compact-mode flag.
  if (!db.objectStoreNames.contains(STORE_METADATA)) {
    db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
    // Seed the sequence counter so the first assigned sequence number is 1
    // (Req 2.4). Seeding happens within the versionchange transaction.
    if (tx) {
      const seed: MetadataRecord = { key: 'lastSequenceNumber', value: 0 };
      tx.objectStore(STORE_METADATA).put(seed);
    }
  }

  // Note: the legacy v1 `notes` store (oldVersion === 1) is intentionally left
  // untouched here to preserve any unsynced offline notes.
  void oldVersion;
}

/**
 * IndexedDB-backed store for the offline queue.
 *
 * Instantiate once and call {@link QueueStore.openDatabase} (or any operation
 * method, which opens lazily) before use. The class memoizes the open
 * connection and de-duplicates concurrent open calls.
 */
export class QueueStore {
  /** The open database connection, or null before {@link openDatabase}. */
  private db: IDBDatabase | null = null;

  /** In-flight open promise, used to de-duplicate concurrent open calls. */
  private openPromise: Promise<IDBDatabase> | null = null;

  /**
   * Opens (creating or upgrading as needed) the `NotaVoiceOfflineDB` database
   * at version {@link DB_VERSION} and ensures the v2 schema exists.
   *
   * Safe to call repeatedly: the first call performs the open, subsequent calls
   * return the cached connection or join the in-flight open.
   *
   * @returns The open {@link IDBDatabase} connection.
   * @throws If IndexedDB is unavailable or the open request fails.
   */
  openDatabase(): Promise<IDBDatabase> {
    if (this.db) {
      return Promise.resolve(this.db);
    }
    if (this.openPromise) {
      return this.openPromise;
    }

    this.openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const idb = getIndexedDB();
      if (!idb) {
        reject(new Error('IndexedDB is not available in this environment'));
        return;
      }

      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        upgradeSchema(db, request.transaction, event.oldVersion);
      };

      request.onsuccess = () => {
        const db = request.result;

        // If another tab triggers a newer-version upgrade, close this
        // connection so it does not block the upgrade (and clear the cache).
        db.onversionchange = () => {
          db.close();
          if (this.db === db) {
            this.db = null;
          }
        };

        // Drop the cached handle if the connection closes unexpectedly so the
        // next call reopens cleanly (supports recovery — Req 1.5).
        db.onclose = () => {
          if (this.db === db) {
            this.db = null;
          }
        };

        this.db = db;
        resolve(db);
      };

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to open NotaVoiceOfflineDB'));
      };

      // Another open connection at a lower version is preventing the upgrade.
      request.onblocked = () => {
        reject(
          new Error(
            'Opening NotaVoiceOfflineDB is blocked by another open connection',
          ),
        );
      };
    });

    // Clear the in-flight marker once settled so a failed open can be retried.
    this.openPromise.then(
      () => {
        this.openPromise = null;
      },
      () => {
        this.openPromise = null;
      },
    );

    return this.openPromise;
  }

  /**
   * Returns the open connection, opening it first if necessary. Operation
   * methods added by later tasks should call this rather than touching
   * {@link db} directly.
   */
  protected getDatabase(): Promise<IDBDatabase> {
    return this.db ? Promise.resolve(this.db) : this.openDatabase();
  }

  /**
   * Inserts a new item into the queue.
   *
   * The store owns assignment of the fields not supplied by the caller:
   * - `sequenceNumber` — the next monotonically increasing value, read from and
   *   written back to the metadata `lastSequenceNumber` counter **atomically
   *   within the same transaction** so concurrent enqueues can never observe or
   *   assign the same value (guarantees Property 4: no gaps, no duplicates,
   *   exactly +1 each time). (Req 2.4)
   * - `id` — a freshly generated UUID v4. (Req 1.3)
   * - `payloadChecksum` — CRC32 of the payload computed at write time. (Req 7.5)
   * - `state` — initialized to `'pending'`.
   * - `createdAt` — the current time. (Req 1.3)
   * - `lastAttemptAt` — `null` (never attempted yet). (Req 1.3)
   * - `retryCount` — `0`. (Req 1.3)
   * - `error` — `null`.
   *
   * The capacity check and the write occur in a single `readwrite` transaction
   * spanning the `queue` and `metadata` stores so that the size invariant and
   * sequence assignment are consistent under concurrency. When the queue
   * already holds {@link MAX_QUEUE_SIZE} items the transaction is aborted and
   * the returned promise rejects without persisting anything. (Req 1.7)
   *
   * @param input - The caller-supplied operation to enqueue.
   * @returns The fully materialized {@link QueueItem} as persisted.
   * @throws If the queue is full (Req 1.7) or the write fails.
   */
  async enqueue(input: QueueItemInput): Promise<QueueItem> {
    const db = await this.getDatabase();

    return new Promise<QueueItem>((resolve, reject) => {
      const tx = db.transaction([STORE_QUEUE, STORE_METADATA], 'readwrite');
      const queueStore = tx.objectStore(STORE_QUEUE);
      const metadataStore = tx.objectStore(STORE_METADATA);

      let item: QueueItem | null = null;
      let rejection: Error | null = null;

      // 1. Enforce the maximum queue size (Req 1.7). Use count() inside the
      //    same transaction so the check and the insert are atomic.
      const countRequest = queueStore.count();
      countRequest.onsuccess = () => {
        if (countRequest.result >= MAX_QUEUE_SIZE) {
          rejection = new Error(
            `Offline queue is full (maximum ${MAX_QUEUE_SIZE} items); new operation rejected`,
          );
          tx.abort();
          return;
        }

        // 2. Atomically read, increment, and write back the sequence counter.
        const counterRequest = metadataStore.get('lastSequenceNumber');
        counterRequest.onsuccess = () => {
          const record = counterRequest.result as MetadataRecord | undefined;
          const previous =
            record && typeof record.value === 'number' ? record.value : 0;
          const sequenceNumber = previous + 1;

          metadataStore.put({ key: 'lastSequenceNumber', value: sequenceNumber });

          // 3. Build and persist the fully materialized item.
          const now = Date.now();
          item = {
            id: generateUuid(),
            sequenceNumber,
            operationType: input.operationType,
            noteId: input.noteId,
            payload: input.payload,
            payloadChecksum: computeChecksum(input.payload),
            state: 'pending',
            createdAt: now,
            lastAttemptAt: null,
            retryCount: 0,
            error: null,
          };

          queueStore.add(item);
        };
      };

      tx.oncomplete = () => {
        if (item) {
          resolve(item);
        } else {
          reject(rejection ?? new Error('Enqueue completed without persisting an item'));
        }
      };
      tx.onabort = () => {
        reject(rejection ?? tx.error ?? new Error('Enqueue transaction aborted'));
      };
      tx.onerror = () => {
        reject(rejection ?? tx.error ?? new Error('Enqueue transaction failed'));
      };
    });
  }

  /**
   * Removes an item from the `queue` store by id. No-op if the id is absent.
   *
   * @param id - The {@link QueueItem.id} to remove.
   */
  async dequeue(id: string): Promise<void> {
    const db = await this.getDatabase();
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    await promisifyRequest(store.delete(id));
    await this.awaitTransaction(tx);
  }

  /**
   * Returns the next item to process: the lowest-`sequenceNumber` item in the
   * `pending` state, optionally restricted to a single note lane. (Req 2.1)
   *
   * Iterates the `sequenceNumber` index in ascending order so the first
   * matching `pending` item encountered is the FIFO head.
   *
   * @param noteId - When provided, only items for this note are considered.
   * @returns The next pending {@link QueueItem}, or `null` when none match.
   */
  async peek(noteId?: string): Promise<QueueItem | null> {
    const db = await this.getDatabase();

    return new Promise<QueueItem | null>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const index = tx.objectStore(STORE_QUEUE).index('sequenceNumber');
      const cursorRequest = index.openCursor(null, 'next');

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve(null);
          return;
        }
        const candidate = cursor.value as QueueItem;
        if (
          candidate.state === 'pending' &&
          (noteId === undefined || candidate.noteId === noteId)
        ) {
          resolve(candidate);
          return;
        }
        cursor.continue();
      };

      cursorRequest.onerror = () => {
        reject(cursorRequest.error ?? new Error('peek cursor failed'));
      };
    });
  }

  /**
   * Returns all queue items sorted by ascending `sequenceNumber` (FIFO order),
   * optionally filtered by `state` and/or `noteId`. (Req 1.2, 2.1)
   *
   * @param filter - Optional `state` and/or `noteId` constraints.
   * @returns Matching {@link QueueItem}s in ascending sequence-number order.
   */
  async getAll(filter?: QueueFilter): Promise<QueueItem[]> {
    const db = await this.getDatabase();
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const index = tx.objectStore(STORE_QUEUE).index('sequenceNumber');
    const items = (await promisifyRequest(index.getAll())) as QueueItem[];

    if (!filter) {
      return items;
    }
    return items.filter((item) => {
      if (filter.state !== undefined && item.state !== filter.state) {
        return false;
      }
      if (filter.noteId !== undefined && item.noteId !== filter.noteId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Returns all items for a specific note, sorted by ascending
   * `sequenceNumber`. Items in a note lane are processed in this order. (Req 2.1)
   *
   * @param noteId - The note identifier whose items to return.
   * @returns The note's {@link QueueItem}s in ascending sequence-number order.
   */
  async getByNoteId(noteId: string): Promise<QueueItem[]> {
    const db = await this.getDatabase();
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const index = tx.objectStore(STORE_QUEUE).index('noteId');
    const items = (await promisifyRequest(
      index.getAll(IDBKeyRange.only(noteId)),
    )) as QueueItem[];
    items.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    return items;
  }

  /**
   * Updates the lifecycle `state` of an item, optionally patching additional
   * fields (e.g. `lastAttemptAt`, `retryCount`, `error`) in the same write.
   *
   * The existing record is read, merged with the new state and any supplied
   * metadata, and written back within a single `readwrite` transaction. The
   * immutable identity fields (`id` and `sequenceNumber`) cannot be changed via
   * this method — any such values in `metadata` are ignored.
   *
   * @param id - The {@link QueueItem.id} to update.
   * @param state - The new lifecycle state.
   * @param metadata - Optional partial fields to merge into the item.
   * @throws If no item with the given id exists.
   */
  async updateState(
    id: string,
    state: QueueItemState,
    metadata?: Partial<QueueItem>,
  ): Promise<void> {
    const db = await this.getDatabase();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      let failure: Error | null = null;

      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result as QueueItem | undefined;
        if (!existing) {
          failure = new Error(`Cannot update state: no queue item with id "${id}"`);
          tx.abort();
          return;
        }

        const updated: QueueItem = {
          ...existing,
          ...metadata,
          // Identity fields are immutable and always win over `metadata`.
          id: existing.id,
          sequenceNumber: existing.sequenceNumber,
          state,
        };
        store.put(updated);
      };
      getRequest.onerror = () => {
        failure = getRequest.error ?? new Error('updateState read failed');
      };

      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('updateState aborted'));
      tx.onerror = () => reject(failure ?? tx.error ?? new Error('updateState failed'));
    });
  }

  // -------------------------------------------------------------------------
  // Dead Letter Store operations (Req 3.5, 3.6, 8.4, 8.6)
  // -------------------------------------------------------------------------

  /**
   * Moves an item out of the active `queue` and into the `deadLetter` store.
   *
   * Invoked when an item has permanently failed: it exhausted its retries
   * (Req 3.6), hit a non-retryable error (Req 3.5), references a gone resource,
   * or failed integrity validation. The original item is snapshotted into a
   * {@link DeadLetterItem} so it can later be inspected, restored, or discarded.
   *
   * The read of the original item, the write into `deadLetter`, and the delete
   * from `queue` all happen in a **single `readwrite` transaction spanning both
   * stores** so the move is atomic — the item can never exist in both stores or
   * vanish from both.
   *
   * @param id - The {@link QueueItem.id} to move.
   * @param reason - Human-readable explanation recorded on the dead-letter entry.
   * @throws If no item with the given id exists in the `queue`.
   */
  async moveToDLS(id: string, reason: string): Promise<void> {
    const db = await this.getDatabase();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_QUEUE, STORE_DEAD_LETTER], 'readwrite');
      const queueStore = tx.objectStore(STORE_QUEUE);
      const deadLetterStore = tx.objectStore(STORE_DEAD_LETTER);
      let failure: Error | null = null;

      const getRequest = queueStore.get(id);
      getRequest.onsuccess = () => {
        const original = getRequest.result as QueueItem | undefined;
        if (!original) {
          failure = new Error(
            `Cannot move to Dead Letter Store: no queue item with id "${id}"`,
          );
          tx.abort();
          return;
        }

        const deadLetterItem: DeadLetterItem = {
          id: original.id,
          originalItem: original,
          reason,
          movedAt: Date.now(),
          noteId: original.noteId,
        };

        deadLetterStore.put(deadLetterItem);
        queueStore.delete(id);
      };
      getRequest.onerror = () => {
        failure = getRequest.error ?? new Error('moveToDLS read failed');
      };

      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('moveToDLS aborted'));
      tx.onerror = () => reject(failure ?? tx.error ?? new Error('moveToDLS failed'));
    });
  }

  /**
   * Returns all dead-letter items sorted by `movedAt` ascending (oldest first).
   *
   * Reads via the `movedAt` index so results arrive in chronological move
   * order, matching how the UI surfaces failed items. (Req 8.3, 8.6)
   *
   * @returns All {@link DeadLetterItem}s, oldest-moved first.
   */
  async getDLSItems(): Promise<DeadLetterItem[]> {
    const db = await this.getDatabase();
    const tx = db.transaction(STORE_DEAD_LETTER, 'readonly');
    const index = tx.objectStore(STORE_DEAD_LETTER).index('movedAt');
    const items = (await promisifyRequest(index.getAll())) as DeadLetterItem[];
    // The `movedAt` index already yields ascending order; sort defensively to
    // guarantee the contract even if two items share a timestamp.
    items.sort((a, b) => a.movedAt - b.movedAt);
    return items;
  }

  /**
   * Restores a dead-letter item back into the active `queue` for another sync
   * attempt, then removes it from the `deadLetter` store. (Req 8.4)
   *
   * The restored {@link QueueItem} is the original snapshot with its retry
   * bookkeeping reset so it re-enters the pipeline as if freshly queued:
   * - `retryCount` → `0`
   * - `state` → `'pending'`
   * - `error` → `null`
   *
   * The identity fields (`id`, `sequenceNumber`) and the payload are preserved,
   * so the item keeps its original FIFO position. The put into `queue` and the
   * delete from `deadLetter` happen in a **single `readwrite` transaction
   * spanning both stores** for atomicity.
   *
   * @param id - The {@link DeadLetterItem.id} to restore.
   * @throws If no dead-letter item with the given id exists.
   */
  async restoreFromDLS(id: string): Promise<void> {
    const db = await this.getDatabase();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_QUEUE, STORE_DEAD_LETTER], 'readwrite');
      const queueStore = tx.objectStore(STORE_QUEUE);
      const deadLetterStore = tx.objectStore(STORE_DEAD_LETTER);
      let failure: Error | null = null;

      const getRequest = deadLetterStore.get(id);
      getRequest.onsuccess = () => {
        const entry = getRequest.result as DeadLetterItem | undefined;
        if (!entry) {
          failure = new Error(
            `Cannot restore from Dead Letter Store: no item with id "${id}"`,
          );
          tx.abort();
          return;
        }

        const restored: QueueItem = {
          ...entry.originalItem,
          retryCount: 0,
          state: 'pending',
          error: null,
        };

        queueStore.put(restored);
        deadLetterStore.delete(id);
      };
      getRequest.onerror = () => {
        failure = getRequest.error ?? new Error('restoreFromDLS read failed');
      };

      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(failure ?? tx.error ?? new Error('restoreFromDLS aborted'));
      tx.onerror = () =>
        reject(failure ?? tx.error ?? new Error('restoreFromDLS failed'));
    });
  }

  /**
   * Permanently removes an item from the `deadLetter` store. (Req 8.6)
   *
   * Backs the user-confirmed "discard" action. No-op if the id is absent.
   *
   * @param id - The {@link DeadLetterItem.id} to delete.
   */
  async deleteDLSItem(id: string): Promise<void> {
    const db = await this.getDatabase();
    const tx = db.transaction(STORE_DEAD_LETTER, 'readwrite');
    const store = tx.objectStore(STORE_DEAD_LETTER);
    await promisifyRequest(store.delete(id));
    await this.awaitTransaction(tx);
  }

  // -------------------------------------------------------------------------
  // Metadata & integrity helpers (Req 2.4, 7.4, 7.5, 7.6, 1.5, 1.6)
  // -------------------------------------------------------------------------

  /**
   * Atomically reserves and returns the next sequence number.
   *
   * Reads the metadata `lastSequenceNumber` counter, increments it, writes it
   * back, and returns the new value — all within a **single `readwrite`
   * transaction** so concurrent callers can never observe or assign the same
   * value. (Req 2.4)
   *
   * This mirrors the counter semantics used inline by {@link enqueue}: the
   * counter is seeded at 0 (in {@link upgradeSchema}), so the first reserved
   * number is 1 and each subsequent call returns exactly one more than the
   * previous. {@link enqueue} already assigns sequence numbers itself; this is a
   * standalone helper for callers/tests that need to reserve a number without
   * persisting a full item. Note that mixing this with {@link enqueue} consumes
   * from the same shared counter, so a reserved number will not also be used by
   * a later enqueue.
   *
   * @returns The newly reserved, monotonically increasing sequence number.
   */
  async getNextSequenceNumber(): Promise<number> {
    const db = await this.getDatabase();

    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_METADATA, 'readwrite');
      const metadataStore = tx.objectStore(STORE_METADATA);
      let next: number | null = null;

      const counterRequest = metadataStore.get('lastSequenceNumber');
      counterRequest.onsuccess = () => {
        const record = counterRequest.result as MetadataRecord | undefined;
        const previous =
          record && typeof record.value === 'number' ? record.value : 0;
        next = previous + 1;
        metadataStore.put({ key: 'lastSequenceNumber', value: next });
      };
      // Read failures surface via tx.onerror/onabort below.

      tx.oncomplete = () => {
        if (next !== null) {
          resolve(next);
        } else {
          reject(
            new Error('getNextSequenceNumber completed without reading the counter'),
          );
        }
      };
      tx.onabort = () =>
        reject(tx.error ?? new Error('getNextSequenceNumber aborted'));
      tx.onerror = () =>
        reject(tx.error ?? new Error('getNextSequenceNumber failed'));
    });
  }

  /**
   * Returns the number of items currently in the active `queue` store.
   *
   * Used for the size invariant (Req 1.7) and status reporting (Req 8.1).
   *
   * @returns The count of {@link QueueItem}s in the queue.
   */
  async getQueueSize(): Promise<number> {
    const db = await this.getDatabase();
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    return promisifyRequest(tx.objectStore(STORE_QUEUE).count());
  }

  /**
   * Returns an estimate of the origin's storage usage and quota.
   *
   * Wraps `navigator.storage.estimate()`. The Storage API is not available in
   * every environment (notably the Node/`fake-indexeddb` test environment, and
   * some older browsers), so when it is missing — or the underlying call throws
   * — a safe default of `{ usage: 0, quota: 0 }` is returned rather than
   * propagating an error. Callers (storage-pressure management, Req 7.4/9.x)
   * treat the default as "unknown / no pressure".
   *
   * @returns The {@link StorageEstimate}, or a zeroed default when unavailable.
   */
  async getStorageEstimate(): Promise<StorageEstimate> {
    const fallback: StorageEstimate = { usage: 0, quota: 0 };

    const storage = (
      globalThis as {
        navigator?: { storage?: { estimate?: () => Promise<StorageEstimate> } };
      }
    ).navigator?.storage;

    if (!storage || typeof storage.estimate !== 'function') {
      return fallback;
    }

    try {
      const estimate = await storage.estimate();
      return {
        usage: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
      };
    } catch {
      // A failing/unsupported estimate must not break queue operations.
      return fallback;
    }
  }

  /**
   * Recomputes the CRC32 of an item's payload and compares it against the
   * `payloadChecksum` stored at write time. (Req 7.5, 7.6)
   *
   * A `false` result means the persisted payload no longer matches its
   * checksum (corruption / tampering); the integrity checker moves such items
   * to the Dead Letter Store.
   *
   * @param item - The queue item to verify.
   * @returns True when the payload matches its stored checksum.
   */
  verifyChecksum(item: QueueItem): boolean {
    return verifyPayloadChecksum(item.payload, item.payloadChecksum);
  }

  /**
   * Tears down and recreates the database, then re-persists a set of recovered
   * items. Backs corruption recovery (Req 1.5) and the "recreate empty schema"
   * fallback when nothing could be recovered (Req 1.6 — call with an empty
   * array).
   *
   * Steps:
   * 1. Close the current connection so the delete is not blocked by it.
   * 2. Delete the `NotaVoiceOfflineDB` database entirely.
   * 3. Reopen — `onupgradeneeded` recreates the v2 schema from scratch and
   *    reseeds the metadata counter to 0.
   * 4. Re-persist the recovered items into `queue` and restore the
   *    `lastSequenceNumber` counter to the maximum `sequenceNumber` among the
   *    recovered items (0 when none), all in a single `readwrite` transaction.
   *    This keeps subsequent {@link enqueue}/{@link getNextSequenceNumber} calls
   *    monotonic: the next assigned number is `max + 1`.
   *
   * @param recoveredItems - Items salvaged from the corrupted database (may be empty).
   * @throws If IndexedDB is unavailable, the delete is blocked, or a write fails.
   */
  async rebuildDatabase(recoveredItems: QueueItem[]): Promise<void> {
    const idb = getIndexedDB();
    if (!idb) {
      throw new Error('IndexedDB is not available in this environment');
    }

    // 1. Release our connection so deleteDatabase is not blocked by it.
    this.close();

    // 2. Delete the database entirely.
    await new Promise<void>((resolve, reject) => {
      const request = idb.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error('Failed to delete NotaVoiceOfflineDB'));
      request.onblocked = () =>
        reject(
          new Error(
            'Deleting NotaVoiceOfflineDB is blocked by another open connection',
          ),
        );
    });

    // 3. Reopen — recreates the v2 schema and reseeds metadata.
    const db = await this.openDatabase();

    // 4. Re-persist recovered items and restore the sequence counter atomically.
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_QUEUE, STORE_METADATA], 'readwrite');
      const queueStore = tx.objectStore(STORE_QUEUE);
      const metadataStore = tx.objectStore(STORE_METADATA);

      for (const item of recoveredItems) {
        queueStore.put(item);
      }

      // Restore the counter to the highest recovered sequence number so future
      // assignments continue monotonically from there (0 when nothing recovered).
      const maxSequence = recoveredItems.reduce(
        (max, item) => (item.sequenceNumber > max ? item.sequenceNumber : max),
        0,
      );
      metadataStore.put({ key: 'lastSequenceNumber', value: maxSequence });

      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(tx.error ?? new Error('rebuildDatabase transaction aborted'));
      tx.onerror = () =>
        reject(tx.error ?? new Error('rebuildDatabase transaction failed'));
    });
  }

  /**
   * Resolves when the given transaction completes, or rejects if it
   * aborts/errors. Used for write transactions whose result is the side effect
   * rather than a request value.
   */
  private awaitTransaction(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
      tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'));
    });
  }

  /**
   * Closes the database connection and clears the cached handle. The next
   * operation will reopen it. Primarily useful for tests and teardown.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
