/**
 * OfflineQueue — the public facade for the offline queue subsystem.
 *
 * This class wires together the independently-developed core components into a
 * single, cohesive surface that the React integration layer (task 12) consumes:
 *
 * - {@link QueueStore}            — IndexedDB persistence (single source of truth)
 * - {@link SyncEngine}            — FIFO sync orchestration with per-note lanes
 * - {@link RetryScheduler}        — exponential backoff + error classification
 * - {@link CircuitBreaker}        — halts sync when the backend is unreachable
 * - {@link ConflictResolver}      — resolves 409/404/410 responses
 * - {@link QueueIntegrityChecker} — startup schema/checksum/sequence validation
 * - {@link StoragePressureManager}— compact mode + purge under storage pressure
 * - {@link ConnectivityMonitor}   — confirmed online/offline transitions
 *
 * Collaborators are injectable through the constructor options so the facade is
 * unit-testable, but sensible defaults construct the real components wired to a
 * single shared {@link QueueStore}. The circuit breaker persists its snapshot
 * and the storage-pressure manager persists its compact-mode flag into the
 * store's `metadata` object store for crash resilience; both are hydrated back
 * during {@link OfflineQueue.initialize}.
 *
 * The facade extends {@link EventTarget} and re-emits the SyncEngine's typed
 * events (`state-change`, `circuit-breaker-change`, `item-dead-lettered`,
 * `conflict-copy-created`) plus its own `counts-change`, `compact-mode-change`,
 * and `integrity-gap` events, so the React layer can subscribe via {@link on}.
 *
 * Requirements: 1.1, 1.2, 6.2, 7.1, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1.
 */

import { QueueStore } from './queue-store';
import { RetryScheduler } from './retry-scheduler';
import { CircuitBreaker } from './circuit-breaker';
import { ConflictResolver, conflictResolver } from './conflict-resolver';
import { QueueIntegrityChecker } from './queue-integrity-checker';
import { StoragePressureManager } from './storage-pressure-manager';
import {
  createConnectivityMonitor,
  type ConnectivityMonitor,
} from './connectivity-monitor';
import { SyncEngine, type SyncTransport } from './sync-engine';
import { MAX_DISPLAYED_ITEMS, NOTE_EXCERPT_LENGTH } from './utils/constants';
import type {
  CircuitBreakerSnapshot,
  CircuitBreakerState,
  DeadLetterItem,
  QueueCounts,
  QueueEventDetailMap,
  QueueEventType,
  QueueItem,
  QueueItemInput,
  QueueItemSummary,
} from './types';

/** Metadata-store key under which the circuit-breaker snapshot is persisted. */
const META_CIRCUIT_BREAKER = 'circuitBreakerState';
/** Metadata-store key under which the compact-mode flag is persisted. */
const META_COMPACT_MODE = 'compactMode';

/**
 * Aggregate status snapshot surfaced to the UI (Req 8.1). `failed` counts items
 * resident in the Dead Letter Store; `pending` aggregates every not-yet-synced
 * active state (`pending`, `blocked`, `held`).
 */
export interface QueueStatus {
  counts: QueueCounts;
  circuitBreakerState: CircuitBreakerState;
  isCompactMode: boolean;
  isOnline: boolean;
}

/**
 * Constructor options for {@link OfflineQueue}. Every collaborator is optional;
 * omitted ones are constructed with production defaults wired to the shared
 * {@link QueueStore}. Injecting collaborators (or a custom {@link transport} /
 * {@link now}) enables deterministic unit testing.
 */
export interface OfflineQueueOptions {
  /** Shared IndexedDB store. Defaults to a fresh {@link QueueStore}. */
  store?: QueueStore;
  /** Retry scheduler. Defaults to a fresh {@link RetryScheduler}. */
  retryScheduler?: RetryScheduler;
  /**
   * Circuit breaker. Default persists its snapshot to the store's metadata under
   * `circuitBreakerState` and is hydrated during {@link initialize}.
   */
  circuitBreaker?: CircuitBreaker;
  /** Conflict resolver. Defaults to the shared stateless {@link conflictResolver}. */
  conflictResolver?: ConflictResolver;
  /** Connectivity monitor. Defaults to {@link createConnectivityMonitor}. */
  connectivityMonitor?: ConnectivityMonitor;
  /** Integrity checker. Defaults to a {@link QueueIntegrityChecker} over the store. */
  integrityChecker?: QueueIntegrityChecker;
  /**
   * Storage-pressure manager. Default persists the compact-mode flag to the
   * store's metadata under `compactMode` and is hydrated during {@link initialize}.
   */
  storagePressureManager?: StoragePressureManager;
  /** Sync engine. Defaults to a {@link SyncEngine} wired to all of the above. */
  syncEngine?: SyncEngine;
  /** Transport injected into the default {@link SyncEngine}. */
  transport?: SyncTransport;
  /** Injectable clock for deterministic tests. Defaults to {@link Date.now}. */
  now?: () => number;
}

/**
 * Single entry point coordinating the offline queue subsystem. Construct once,
 * call {@link initialize} on app start, then drive it via {@link enqueue} and
 * the user-action methods, observing changes through {@link on} / {@link getStatus}.
 */
export class OfflineQueue extends EventTarget {
  private readonly store: QueueStore;
  private readonly retryScheduler: RetryScheduler;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly conflictResolver: ConflictResolver;
  private readonly connectivityMonitor: ConnectivityMonitor;
  private readonly integrityChecker: QueueIntegrityChecker;
  private readonly storagePressure: StoragePressureManager;
  private readonly syncEngine: SyncEngine;
  private readonly nowFn: () => number;

  /** Teardown handles for subscriptions wired in {@link initialize}. */
  private readonly unsubscribers: Array<() => void> = [];
  /** In-flight / completed initialization, so {@link initialize} is idempotent. */
  private initPromise: Promise<void> | null = null;

  constructor(options: OfflineQueueOptions = {}) {
    super();

    const now = options.now;
    this.nowFn = now ?? (() => Date.now());

    // Shared store underpins every collaborator (single source of truth).
    const store = options.store ?? new QueueStore();
    this.store = store;

    this.retryScheduler =
      options.retryScheduler ?? new RetryScheduler(now ? { now } : {});

    // The breaker persists its snapshot to the metadata store for crash
    // resilience (Req 4.x); the snapshot is hydrated back in initialize().
    this.circuitBreaker =
      options.circuitBreaker ??
      new CircuitBreaker({
        persistence: {
          save: (snapshot) => store.setMetadata(META_CIRCUIT_BREAKER, snapshot),
        },
        ...(now ? { now } : {}),
      });

    this.conflictResolver = options.conflictResolver ?? conflictResolver;
    this.connectivityMonitor =
      options.connectivityMonitor ?? createConnectivityMonitor();
    this.integrityChecker =
      options.integrityChecker ?? new QueueIntegrityChecker(store);

    // The manager persists the compact-mode flag to the metadata store; it is
    // hydrated in initialize() (Req 9.1).
    this.storagePressure =
      options.storagePressureManager ??
      new StoragePressureManager(store, {
        persistence: (isCompactMode) =>
          store.setMetadata(META_COMPACT_MODE, isCompactMode),
      });

    this.syncEngine =
      options.syncEngine ??
      new SyncEngine({
        store,
        retryScheduler: this.retryScheduler,
        circuitBreaker: this.circuitBreaker,
        conflictResolver: this.conflictResolver,
        connectivityMonitor: this.connectivityMonitor,
        ...(options.transport ? { transport: options.transport } : {}),
        ...(now ? { now } : {}),
      });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Initializes the subsystem. Idempotent — repeated calls return the same
   * settled promise.
   *
   * Ordering matters (Req 7.1): the integrity sweep must finish before the sync
   * engine starts processing, so a corrupt/malformed item can never be synced.
   *
   * Steps:
   * 1. Open the IndexedDB database.
   * 2. Hydrate the circuit breaker from its persisted snapshot (crash resilience).
   * 3. Hydrate compact mode from its persisted flag (Req 9.1).
   * 4. Run the integrity sweep ({@link QueueIntegrityChecker.validateAll}); emit
   *    an `integrity-gap` event when a sequence gap held items (Req 7.3).
   * 5. Wire event forwarding from the collaborators to this facade.
   * 6. Evaluate storage pressure ({@link StoragePressureManager.checkPressure}).
   * 7. Start the sync engine, which starts the connectivity monitor and begins
   *    processing when already online (Req 6.2).
   * 8. Emit the initial counts.
   */
  initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    // 1. Open the database before any read/write.
    await this.store.openDatabase();

    // 2. Restore the circuit breaker snapshot, if one was persisted.
    const snapshot = await this.store.getMetadata<CircuitBreakerSnapshot>(
      META_CIRCUIT_BREAKER,
    );
    if (snapshot) {
      this.circuitBreaker.restore(snapshot);
    }

    // 3. Restore compact mode before listeners are attached (no spurious event).
    const persistedCompact = await this.store.getMetadata<boolean>(META_COMPACT_MODE);
    if (persistedCompact === true && !this.storagePressure.isCompactMode) {
      this.storagePressure.enterCompactMode();
    } else if (persistedCompact === false && this.storagePressure.isCompactMode) {
      this.storagePressure.exitCompactMode();
    }

    // 4. Validate integrity BEFORE the engine starts (Req 7.1). Surface any
    //    sequence gap so the UI can prompt the user to acknowledge it (Req 7.3).
    const report = await this.integrityChecker.validateAll();
    if (report.gaps.length > 0) {
      this.emit('integrity-gap', {
        missingSequenceNumbers: report.gaps.flatMap((gap) => gap.missing),
        heldItemIds: report.heldItemIds,
      });
    }

    // 5. Forward collaborator events to facade subscribers.
    this.wireEvents();

    // 6. Evaluate storage pressure (applies compact-mode hysteresis) (Req 9.1).
    await this.storagePressure.checkPressure();

    // 7. Start sync (also starts the connectivity monitor and drains if online).
    this.syncEngine.start();

    // 8. Publish the initial counts to the UI.
    await this.emitCountsChange();
  }

  /**
   * Tears down subscriptions and stops the sync engine (which stops the
   * connectivity monitor). Safe to call when not initialized.
   */
  shutdown(): void {
    for (const unsubscribe of this.unsubscribers.splice(0)) {
      unsubscribe();
    }
    this.syncEngine.stop();
    this.initPromise = null;
  }

  // -------------------------------------------------------------------------
  // Enqueue
  // -------------------------------------------------------------------------

  /**
   * Enqueues a new operation (Req 1.1, 9.1, 9.4).
   *
   * Before persisting, storage pressure is evaluated: this applies the
   * compact-mode hysteresis and, when storage is critical, purges the oldest
   * synced items to reclaim space (Req 9.4). When compact mode is active the
   * audio blob is omitted from the persisted payload (Req 9.1). The queue-full
   * rejection from {@link QueueStore.enqueue} propagates to the caller (Req 1.7).
   * On success, counts are refreshed and a sync run is triggered when online
   * (Req 6.2).
   *
   * @param input - The operation to enqueue.
   * @returns The persisted {@link QueueItem}.
   * @throws When the queue is full (Req 1.7) or the write fails.
   */
  async enqueue(input: QueueItemInput): Promise<QueueItem> {
    // Storage pressure first (Req 9.1/9.4).
    const level = await this.storagePressure.checkPressure();
    if (level === 'critical') {
      await this.storagePressure.purgeOldSyncedItems();
    }

    // In compact mode, drop the audio blob so only text + metadata persist (Req 9.1).
    const toEnqueue = this.storagePressure.isCompactMode
      ? this.stripAudio(input)
      : input;

    // Surfaces the queue-full rejection (Req 1.7).
    const item = await this.store.enqueue(toEnqueue);

    void this.emitCountsChange();

    // Trigger a sync run when online (Req 6.2). Coalesces if already processing.
    if (this.connectivityMonitor.isOnline) {
      void this.syncEngine.processQueue();
    }

    return item;
  }

  // -------------------------------------------------------------------------
  // Status & listing
  // -------------------------------------------------------------------------

  /**
   * Returns the current aggregate status (Req 8.1): per-state counts, circuit
   * breaker state, compact-mode flag, and online status.
   */
  async getStatus(): Promise<QueueStatus> {
    const counts = await this.computeCounts();
    return {
      counts,
      circuitBreakerState: this.circuitBreaker.state,
      isCompactMode: this.storagePressure.isCompactMode,
      isOnline: this.connectivityMonitor.isOnline,
    };
  }

  /**
   * Returns the items to display in the queue status UI (Req 8.3): up to
   * {@link MAX_DISPLAYED_ITEMS} active queue items as {@link QueueItemSummary}
   * objects, followed by summaries of the Dead Letter Store items so failed
   * items can be surfaced for retry/discard.
   */
  async getItems(): Promise<QueueItemSummary[]> {
    const [items, dlsItems] = await Promise.all([
      this.store.getAll(),
      this.store.getDLSItems(),
    ]);

    const active = items
      .slice(0, MAX_DISPLAYED_ITEMS)
      .map((item) => this.toSummary(item));
    const failed = dlsItems.map((entry) =>
      this.toSummary(entry.originalItem, true),
    );

    return [...active, ...failed];
  }

  /**
   * Returns the raw Dead Letter Store entries (with their failure reasons) for
   * the UI to render alongside retry/discard actions (Req 8.3, 8.6).
   */
  getDeadLetterItems(): Promise<DeadLetterItem[]> {
    return this.store.getDLSItems();
  }

  // -------------------------------------------------------------------------
  // User actions
  // -------------------------------------------------------------------------

  /**
   * Manually retries a Dead Letter Store item (Req 8.4): restores it to the
   * active queue with `retryCount` reset to zero and triggers a sync run when
   * online. If it fails again after exhausting retries it returns to the Dead
   * Letter Store — handled by the {@link SyncEngine} (Req 8.5).
   *
   * @param id - The Dead Letter Store item id to restore.
   */
  async retryItem(id: string): Promise<void> {
    await this.store.restoreFromDLS(id);
    void this.emitCountsChange();
    if (this.connectivityMonitor.isOnline) {
      void this.syncEngine.processQueue();
    }
  }

  /**
   * Permanently deletes a Dead Letter Store item (Req 8.6). The confirmation
   * prompt is the UI's responsibility (task 12.2).
   *
   * @param id - The Dead Letter Store item id to delete.
   */
  async discardItem(id: string): Promise<void> {
    await this.store.deleteDLSItem(id);
    void this.emitCountsChange();
  }

  /**
   * Acknowledges a detected sequence gap (Req 7.3): releases every `held` item
   * back to `pending` so it can sync, emitting a `state-change` for each, then
   * triggers a sync run when online.
   */
  async acknowledgeGap(): Promise<void> {
    const held = await this.store.getAll({ state: 'held' });
    for (const item of held) {
      await this.store.updateState(item.id, 'pending');
      this.emit('state-change', {
        itemId: item.id,
        previousState: 'held',
        newState: 'pending',
        at: this.nowFn(),
      });
    }

    if (held.length > 0) {
      void this.emitCountsChange();
    }

    if (this.connectivityMonitor.isOnline) {
      void this.syncEngine.processQueue();
    }
  }

  // -------------------------------------------------------------------------
  // Events (EventTarget pattern — mirrors SyncEngine.on/emit)
  // -------------------------------------------------------------------------

  /**
   * Subscribe to a typed queue event. Returns an unsubscribe function.
   *
   * @param type - The event name.
   * @param listener - Receives the event's `detail` payload.
   * @returns A function that removes the listener.
   */
  on<T extends QueueEventType>(
    type: T,
    listener: (detail: QueueEventDetailMap[T]) => void,
  ): () => void {
    const handler = (event: Event): void => {
      listener((event as CustomEvent<QueueEventDetailMap[T]>).detail);
    };
    this.addEventListener(type, handler as EventListener);
    return () => this.removeEventListener(type, handler as EventListener);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Forwards the SyncEngine's typed events to facade subscribers and refreshes
   * counts when item states change. Also forwards compact-mode transitions from
   * the storage-pressure manager.
   */
  private wireEvents(): void {
    this.unsubscribers.push(
      this.syncEngine.on('state-change', (detail) => {
        this.emit('state-change', detail);
        void this.emitCountsChange();
      }),
      this.syncEngine.on('circuit-breaker-change', (detail) => {
        this.emit('circuit-breaker-change', detail);
      }),
      this.syncEngine.on('item-dead-lettered', (detail) => {
        this.emit('item-dead-lettered', detail);
        void this.emitCountsChange();
      }),
      this.syncEngine.on('conflict-copy-created', (detail) => {
        this.emit('conflict-copy-created', detail);
        void this.emitCountsChange();
      }),
      this.storagePressure.onModeChange((isCompactMode) => {
        this.emit('compact-mode-change', { isCompactMode });
      }),
    );
  }

  /**
   * Computes the per-state counts surfaced to the UI (Req 8.1). `failed` is the
   * Dead Letter Store size; `pending` aggregates every not-yet-synced active
   * state (`pending`, `blocked`, `held`).
   */
  private async computeCounts(): Promise<QueueCounts> {
    const [items, dlsItems] = await Promise.all([
      this.store.getAll(),
      this.store.getDLSItems(),
    ]);

    let pending = 0;
    let syncing = 0;
    let completed = 0;
    for (const item of items) {
      switch (item.state) {
        case 'pending':
        case 'blocked':
        case 'held':
          pending += 1;
          break;
        case 'syncing':
          syncing += 1;
          break;
        case 'completed':
          completed += 1;
          break;
      }
    }

    return { pending, syncing, failed: dlsItems.length, completed };
  }

  /** Recomputes counts and emits a `counts-change` event (Req 8.1). Best-effort. */
  private async emitCountsChange(): Promise<void> {
    try {
      const counts = await this.computeCounts();
      this.emit('counts-change', { counts });
    } catch {
      // A failed count refresh must not break the operation that triggered it.
    }
  }

  /** Builds a display summary for an item (Req 8.3). */
  private toSummary(item: QueueItem, isDeadLetter = false): QueueItemSummary {
    const source =
      item.payload.title && item.payload.title.trim().length > 0
        ? item.payload.title
        : item.payload.content;
    const excerpt = (source ?? '').slice(0, NOTE_EXCERPT_LENGTH);

    return {
      id: item.id,
      operationType: item.operationType,
      noteId: item.noteId,
      excerpt,
      createdAt: item.createdAt,
      state: item.state,
      retryCount: item.retryCount,
      isDeadLetter,
    };
  }

  /** Returns a copy of the input with the audio blob removed (compact mode, Req 9.1). */
  private stripAudio(input: QueueItemInput): QueueItemInput {
    if (input.payload.audioBlob === undefined) {
      return input;
    }
    const { audioBlob: _omitted, ...rest } = input.payload;
    return { ...input, payload: { ...rest } };
  }

  /** Dispatches a typed queue event (mirrors {@link SyncEngine}'s emit). */
  private emit<T extends QueueEventType>(
    type: T,
    detail: QueueEventDetailMap[T],
  ): void {
    let event: Event;
    try {
      event = new CustomEvent(type, { detail });
    } catch {
      // Environments without CustomEvent: fall back to a plain Event.
      event = new Event(type);
      (event as unknown as { detail: unknown }).detail = detail;
    }
    this.dispatchEvent(event);
  }
}
