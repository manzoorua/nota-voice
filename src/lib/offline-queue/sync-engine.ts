/**
 * SyncEngine — FIFO sync orchestration with parallel per-note lanes.
 *
 * The SyncEngine is the heart of the offline queue. It drains the persistent
 * {@link QueueStore} when connectivity is available, transmitting each
 * {@link QueueItem} to the backend through an injectable {@link SyncTransport}.
 * It coordinates the supporting components:
 *
 * - **{@link RetryScheduler}** — classifies failures (retryable vs. not) and
 *   provides the exponential-backoff delay used to re-attempt an item; items are
 *   moved to the Dead Letter Store after {@link MAX_RETRIES} failed attempts.
 * - **{@link CircuitBreaker}** — gates every attempt via `canAttempt()`; when the
 *   breaker is open the engine halts processing and resumes once it recovers.
 * - **{@link ConflictResolver}** — resolves HTTP 409 conflicts (and 404/410 gone
 *   resources) into a concrete action the engine applies.
 * - **{@link ConnectivityMonitor}** — triggers processing on *confirmed*
 *   connectivity restoration and signals the engine to cancel in-flight requests
 *   when the device goes offline.
 *
 * Processing model (Requirements 2.1–2.6):
 * - Items are grouped into **lanes** by `noteId`. Lanes are ordered by their
 *   lowest pending `sequenceNumber` so the overall drain order is FIFO
 *   (Req 2.1, 2.5).
 * - Up to {@link MAX_CONCURRENT_LANES} lanes run concurrently (Req 2.3); because
 *   a lane syncs one item at a time, at most {@link MAX_CONCURRENT_LANES} items
 *   are ever in the `syncing` state simultaneously (Property 6).
 * - Within a lane, items sync strictly in `sequenceNumber` order. A retryable
 *   failure on an item **blocks** that item and its successors in the same lane
 *   while other lanes proceed unimpeded (Req 2.2, 2.6 / Property 5). The block is
 *   lifted once the failed item is resolved (succeeds) or moved to the Dead
 *   Letter Store.
 *
 * Lifecycle: {@link start}/{@link stop}/{@link pause}/{@link resume}.
 *
 * Events: the engine extends {@link EventTarget} and emits the typed events from
 * `./types/events` (`state-change`, `circuit-breaker-change`,
 * `item-dead-lettered`, `conflict-copy-created`) so the React layer/facade can
 * observe item transitions (Req 8.2).
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.4, 3.5, 3.6, 4.1, 4.7, 5.1, 6.1, 6.3, 6.4.
 */

import type { QueueStore } from './queue-store';
import type { RetryScheduler } from './retry-scheduler';
import type { CircuitBreaker } from './circuit-breaker';
import type { ConflictResolver } from './conflict-resolver';
import type { ConnectivityMonitor } from './connectivity-monitor';
import { MAX_CONCURRENT_LANES, MAX_RETRIES } from './utils/constants';
import type {
  ConflictResponse,
  QueueEventDetailMap,
  QueueEventType,
  QueueItem,
  QueueItemState,
  SyncError,
  SyncErrorKind,
  SyncResult,
} from './types';

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/**
 * A normalized description of a single network attempt, returned by a
 * {@link SyncTransport}. Modeled on an HTTP outcome so {@link SyncEngine.syncItem}
 * can map it to a {@link SyncResult} without knowing about the concrete backend.
 */
export interface TransportResponse {
  /**
   * HTTP-style status code describing the outcome. Use `0` for connection-level
   * failures that never produced a response (paired with {@link errorKind}).
   */
  status: number;
  /** Server record's last-modified timestamp (Unix ms), for create-conflict resolution (Req 5.1). */
  serverTimestamp?: number;
  /** Server's current version of the record, when provided (Req 5.x). */
  serverRecord?: Record<string, unknown>;
  /** Retry-After hint in milliseconds (e.g. from a 429 response). */
  retryAfterMs?: number;
  /** Normalized error kind for non-HTTP (connection-level) failures. */
  errorKind?: SyncErrorKind;
  /** Human-readable message describing the outcome. */
  message?: string;
}

/**
 * Performs the actual network sync of a single queue item. Injected into the
 * {@link SyncEngine} so the engine is fully unit-testable without a real
 * backend. The supplied {@link AbortSignal} fires when the engine cancels the
 * request (e.g. the device went offline mid-flight — Req 6.4); a well-behaved
 * transport passes the signal to the underlying request and rejects/aborts when
 * it fires.
 */
export type SyncTransport = (
  item: QueueItem,
  signal: AbortSignal,
) => Promise<TransportResponse>;

/**
 * Thrown internally when a sync request is aborted because the device went
 * offline (Req 6.4). The engine catches this and retains the item as `pending`
 * without counting a failed attempt.
 */
export class SyncAbortedError extends Error {
  constructor(public readonly itemId: string) {
    super(`Sync aborted for item "${itemId}"`);
    this.name = 'SyncAbortedError';
  }
}

// ---------------------------------------------------------------------------
// Default Supabase transport
// ---------------------------------------------------------------------------

/** Minimal structural view of a Postgrest query result. */
interface PostgrestLikeResult {
  error: { message?: string; code?: string } | null;
  status: number;
  data?: unknown;
}

/** Minimal structural view of the Supabase query builder we rely on. */
interface QueryBuilderLike extends PromiseLike<PostgrestLikeResult> {
  insert(values: Record<string, unknown>): QueryBuilderLike;
  update(values: Record<string, unknown>): QueryBuilderLike;
  delete(): QueryBuilderLike;
  eq(column: string, value: unknown): QueryBuilderLike;
  abortSignal(signal: AbortSignal): QueryBuilderLike;
}

/** Minimal structural view of the Supabase client. */
interface SupabaseLike {
  from(table: string): QueryBuilderLike;
}

/** Maps a Postgres error code to an HTTP-style status when no status is present. */
function inferStatusFromCode(code: string | undefined): number {
  switch (code) {
    case '23505': // unique_violation → treat as a conflict
      return 409;
    case '42501': // insufficient_privilege (RLS) → forbidden
      return 403;
    case 'PGRST116': // no rows returned for single()
    case 'PGRST301': // resource not found
      return 404;
    default:
      return 500; // unknown DB error → retryable server error
  }
}

/**
 * Builds the default {@link SyncTransport} backed by the project's Supabase
 * client. The client is imported lazily (dynamic `import`) so this module stays
 * importable in non-browser environments (the generated client touches
 * `localStorage` at module load). The transport maps Supabase/Postgrest outcomes
 * onto {@link TransportResponse} and surfaces connection-level failures as
 * `network`/`network-timeout` so {@link SyncEngine.syncItem} can classify them.
 *
 * This default targets the `voice_notes` table using the item's `noteId` as the
 * row id. Applications with different persistence shapes should inject their own
 * transport instead.
 */
export function createSupabaseTransport(): SyncTransport {
  return async (item: QueueItem, signal: AbortSignal): Promise<TransportResponse> => {
    const mod = (await import('../../integrations/supabase/client')) as {
      supabase: unknown;
    };
    const supabase = mod.supabase as unknown as SupabaseLike;

    const { noteId, operationType, payload } = item;
    const record: Record<string, unknown> = {
      title: payload.title,
      content: payload.content,
      ...(payload.transcription !== undefined
        ? { transcription: payload.transcription }
        : {}),
      ...(payload.metadata ?? {}),
    };

    try {
      const table = supabase.from('voice_notes');
      let result: PostgrestLikeResult;

      if (operationType === 'create') {
        result = await table.insert({ id: noteId, ...record }).abortSignal(signal);
      } else if (operationType === 'update') {
        result = await table.update(record).eq('id', noteId).abortSignal(signal);
      } else {
        result = await table.delete().eq('id', noteId).abortSignal(signal);
      }

      if (result.error) {
        const status =
          result.status && result.status >= 400
            ? result.status
            : inferStatusFromCode(result.error.code);
        return {
          status,
          message: result.error.message ?? 'Sync failed',
          serverRecord:
            result.data && typeof result.data === 'object'
              ? (result.data as Record<string, unknown>)
              : undefined,
        };
      }

      return { status: result.status && result.status >= 200 ? result.status : 200 };
    } catch (err) {
      // Re-throw aborts so the engine can retain the item as pending (Req 6.4).
      if (signal.aborted) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Network request failed';
      const isTimeout = /timeout|timed out|deadline/i.test(message);
      return {
        status: 0,
        errorKind: isTimeout ? 'network-timeout' : 'network',
        message,
      };
    }
  };
}

// ---------------------------------------------------------------------------
// SyncEngine
// ---------------------------------------------------------------------------

/** Collaborators and options required to construct a {@link SyncEngine}. */
export interface SyncEngineDependencies {
  store: QueueStore;
  retryScheduler: RetryScheduler;
  circuitBreaker: CircuitBreaker;
  conflictResolver: ConflictResolver;
  connectivityMonitor: ConnectivityMonitor;
  /**
   * Performs the actual network sync. Defaults to {@link createSupabaseTransport}.
   * The default does not import the Supabase client until first invoked, so
   * constructing the engine with the default transport remains side-effect-free.
   */
  transport?: SyncTransport;
  /** Injectable clock for deterministic tests. Defaults to {@link Date.now}. */
  now?: () => number;
}

/** Outcome of attempting a single item within a lane. */
type ItemOutcome = 'resolved' | 'blocked';

/**
 * Drives FIFO synchronization of the offline queue with parallel per-note lanes.
 */
export class SyncEngine extends EventTarget {
  private readonly store: QueueStore;
  private readonly retryScheduler: RetryScheduler;
  private readonly breaker: CircuitBreaker;
  private readonly resolver: ConflictResolver;
  private readonly monitor: ConnectivityMonitor;
  private readonly transport: SyncTransport;
  private readonly now: () => number;

  /** Whether a {@link processQueue} run is currently in flight. */
  private processing = false;
  /** True between {@link start} and {@link stop}. */
  private running = false;
  /** True while {@link pause}d. */
  private paused = false;
  /** Set when a processing run is requested while one is already in flight. */
  private rerunRequested = false;

  /** The item currently syncing in each active lane (keyed by noteId). */
  private readonly lanes = new Map<string, QueueItem>();
  /** In-flight requests, aborted on offline/pause/stop. */
  private readonly activeControllers = new Set<AbortController>();
  /** Engine-owned retry timers keyed by item id. */
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Unsubscribe handles wired in {@link start}. */
  private connectivityUnsub: (() => void) | null = null;
  private circuitUnsub: (() => void) | null = null;

  constructor(deps: SyncEngineDependencies) {
    super();
    this.store = deps.store;
    this.retryScheduler = deps.retryScheduler;
    this.breaker = deps.circuitBreaker;
    this.resolver = deps.conflictResolver;
    this.monitor = deps.connectivityMonitor;
    this.transport = deps.transport ?? createSupabaseTransport();
    this.now = deps.now ?? (() => Date.now());
  }

  // -------------------------------------------------------------------------
  // Public read-only state (mirrors the design SyncEngine interface)
  // -------------------------------------------------------------------------

  /** Whether the engine is currently draining the queue. */
  get isProcessing(): boolean {
    return this.processing;
  }

  /**
   * The item currently syncing in each active lane, keyed by `noteId`. Exposed
   * read-only for status reporting; callers must not mutate the returned map.
   */
  get activeLanes(): Map<string, QueueItem> {
    return this.lanes;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Begin processing. Subscribes to connectivity and circuit-breaker changes,
   * starts the connectivity monitor, and kicks off an initial drain when the
   * device is online (Req 6.2). Idempotent.
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.paused = false;

    // Resume / start processing once connectivity is *confirmed* restored
    // (Req 6.1); cancel in-flight work and retain items when offline (Req 6.4).
    this.connectivityUnsub = this.monitor.onConnectivityChange((online) => {
      if (online) {
        void this.processQueue();
      } else {
        this.handleOffline();
      }
    });

    // Surface breaker transitions to observers (Req 4.6) and resume draining
    // when the breaker recovers (closed/half-open) (Req 4.4).
    this.circuitUnsub = this.breaker.onStateChange((state) => {
      this.emit('circuit-breaker-change', { state });
      if (state === 'closed' || state === 'half-open') {
        void this.processQueue();
      }
    });

    this.monitor.start();

    // Begin processing immediately when already online (Req 6.2).
    if (this.monitor.isOnline) {
      void this.processQueue();
    }
  }

  /**
   * Stop processing entirely: cancel in-flight requests and pending retries,
   * unsubscribe listeners, and stop the connectivity monitor. Idempotent.
   */
  stop(): void {
    this.running = false;
    this.paused = false;

    this.connectivityUnsub?.();
    this.connectivityUnsub = null;
    this.circuitUnsub?.();
    this.circuitUnsub = null;

    this.abortActiveRequests();
    this.cancelAllRetries();
    this.lanes.clear();

    this.monitor.stop();
  }

  /**
   * Pause processing without tearing down subscriptions. In-flight requests are
   * aborted and their items retained as `pending`. New work will not start until
   * {@link resume} is called.
   */
  pause(): void {
    if (this.paused) {
      return;
    }
    this.paused = true;
    this.abortActiveRequests();
  }

  /** Resume processing after a {@link pause} and immediately attempt a drain. */
  resume(): void {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    void this.processQueue();
  }

  // -------------------------------------------------------------------------
  // Queue processing
  // -------------------------------------------------------------------------

  /**
   * Drain the queue once. Groups pending items into per-note lanes and processes
   * up to {@link MAX_CONCURRENT_LANES} concurrently, repeating while new work
   * becomes available (e.g. a successful item unblocks its lane). Concurrent
   * calls coalesce: if a run is already in flight, a re-run is requested and the
   * call returns immediately.
   */
  async processQueue(): Promise<void> {
    if (!this.canProcess()) {
      return;
    }
    if (this.processing) {
      this.rerunRequested = true;
      return;
    }

    this.processing = true;
    try {
      do {
        this.rerunRequested = false;
        const laneIds = await this.computeLaneOrder();
        if (laneIds.length === 0) {
          break;
        }
        await this.runLanes(laneIds);
      } while (this.rerunRequested && this.canProcess());
    } finally {
      this.processing = false;
      this.lanes.clear();
    }
  }

  /**
   * Sync a single item, returning a {@link SyncResult}. Wraps the injected
   * transport with an {@link AbortController} (so the request can be cancelled
   * when going offline — Req 6.4) and maps the transport outcome onto the
   * result union. Throws {@link SyncAbortedError} when the request is aborted.
   */
  async syncItem(item: QueueItem): Promise<SyncResult> {
    const controller = new AbortController();
    this.activeControllers.add(controller);
    try {
      let response: TransportResponse;
      try {
        response = await this.transport(item, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) {
          throw new SyncAbortedError(item.id);
        }
        // An unexpected throw is treated as a connection-level failure.
        const message = err instanceof Error ? err.message : 'Network request failed';
        response = { status: 0, errorKind: 'network', message };
      }
      return this.mapResponse(response);
    } finally {
      this.activeControllers.delete(controller);
    }
  }

  /**
   * Re-attempt an item whose backoff delay has elapsed. Flips the item back to
   * `pending` (it was `blocked` during the wait) and triggers a drain. Safe to
   * call externally (e.g. as the {@link RetryScheduler} `onRetry` callback) and
   * idempotent.
   */
  async reattemptItem(item: QueueItem): Promise<void> {
    this.retryTimers.delete(item.id);
    const current = await this.findItem(item.id);
    if (!current || current.state === 'completed') {
      return;
    }
    if (current.state === 'blocked') {
      await this.transitionState(current, 'pending');
    }
    void this.processQueue();
  }

  // -------------------------------------------------------------------------
  // Lane orchestration
  // -------------------------------------------------------------------------

  /**
   * Returns the note ids that have at least one `pending` item, ordered by each
   * lane's lowest pending `sequenceNumber` so the overall drain is FIFO
   * (Req 2.1, 2.5).
   */
  private async computeLaneOrder(): Promise<string[]> {
    const items = await this.store.getAll({ state: 'pending' });
    const lowestByNote = new Map<string, number>();
    for (const item of items) {
      const existing = lowestByNote.get(item.noteId);
      if (existing === undefined || item.sequenceNumber < existing) {
        lowestByNote.set(item.noteId, item.sequenceNumber);
      }
    }
    return [...lowestByNote.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([noteId]) => noteId);
  }

  /**
   * Runs the given lanes through a worker pool of size
   * {@link MAX_CONCURRENT_LANES}, guaranteeing at most that many items are in
   * the `syncing` state at once (Property 6).
   */
  private async runLanes(laneIds: string[]): Promise<void> {
    let next = 0;
    const worker = async (): Promise<void> => {
      while (this.canProcess()) {
        const index = next;
        next += 1;
        if (index >= laneIds.length) {
          return;
        }
        await this.processLane(laneIds[index]);
      }
    };

    const poolSize = Math.min(MAX_CONCURRENT_LANES, laneIds.length);
    const workers: Promise<void>[] = [];
    for (let i = 0; i < poolSize; i += 1) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }

  /**
   * Processes a single note lane in strict `sequenceNumber` order. Stops at the
   * first item that is gated — either blocked behind a failed predecessor
   * (Req 2.2) or awaiting a retry/integrity hold — so other lanes are never held
   * up (Req 2.6).
   */
  private async processLane(noteId: string): Promise<void> {
    while (this.canProcess()) {
      const items = await this.store.getByNoteId(noteId);
      const head = items.find((item) => item.state !== 'completed');

      // Lane fully drained, or its head is gated (blocked/held/syncing) — stop.
      if (!head || head.state !== 'pending') {
        return;
      }

      const outcome = await this.processItem(head);
      if (outcome === 'blocked') {
        return;
      }
      // 'resolved' — loop to pick up the next item in the lane.
    }
  }

  /**
   * Attempts a single item: enforces the circuit breaker, performs the sync, and
   * applies the outcome (success / retry / conflict / dead-letter). Returns
   * `blocked` when the lane should halt (CB open, retry scheduled, or offline)
   * and `resolved` when the lane may continue.
   */
  private async processItem(item: QueueItem): Promise<ItemOutcome> {
    // Req 4.1/4.2: respect the breaker. In half-open this consumes the single
    // probe slot; concurrent lanes that lose the race get `false` and halt.
    if (!this.breaker.canAttempt()) {
      return 'blocked';
    }

    await this.transitionState(item, 'syncing', { lastAttemptAt: this.now() });
    this.lanes.set(item.noteId, item);

    let result: SyncResult;
    try {
      result = await this.syncItem(item);
    } catch (err) {
      this.lanes.delete(item.noteId);
      if (err instanceof SyncAbortedError) {
        // Offline mid-sync: retain as pending, no failure recorded (Req 6.4).
        await this.transitionState(item, 'pending');
        return 'blocked';
      }
      throw err;
    }
    this.lanes.delete(item.noteId);

    switch (result.status) {
      case 'success':
        return this.handleSuccess(item);
      case 'conflict':
        return this.handleConflict(item, result.response);
      case 'dead-letter':
        return this.handleDeadLetter(item, result.reason);
      case 'retry':
        return this.handleRetry(item, result.error);
      default:
        return 'resolved';
    }
  }

  // -------------------------------------------------------------------------
  // Outcome handlers
  // -------------------------------------------------------------------------

  /** Marks an item completed, resets retry bookkeeping, and unblocks its lane. */
  private async handleSuccess(item: QueueItem): Promise<ItemOutcome> {
    this.breaker.recordSuccess(); // Req 4.7
    this.cancelRetry(item.id);
    await this.transitionState(item, 'completed', {
      retryCount: 0,
      error: null,
      lastAttemptAt: this.now(),
    });
    await this.unblockLane(item.noteId);
    return 'resolved';
  }

  /**
   * Applies the {@link ConflictResolver} decision for an HTTP 409/404/410
   * response (Req 5.1–5.6). The server responded, so the connection is healthy.
   */
  private async handleConflict(
    item: QueueItem,
    response: ConflictResponse,
  ): Promise<ItemOutcome> {
    const resolution = await this.resolver.resolve(item, response);
    this.cancelRetry(item.id);

    switch (resolution.action) {
      case 'keep-local': {
        // Local version is retained on the server → treat as synced (Req 5.2).
        this.breaker.recordSuccess();
        await this.transitionState(item, 'completed', {
          retryCount: 0,
          error: null,
          lastAttemptAt: this.now(),
        });
        break;
      }
      case 'keep-server': {
        // Server version wins → discard the local item (Req 5.3).
        this.breaker.recordSuccess();
        await this.store.dequeue(item.id);
        break;
      }
      case 'create-conflict-copy': {
        // Preserve both; surface the copy for manual reconciliation (Req 5.4, 5.5).
        this.breaker.recordSuccess();
        this.emit('conflict-copy-created', {
          originalItemId: item.id,
          copyId: resolution.copyId,
          noteId: item.noteId,
          noteTitle: item.payload.title,
        });
        await this.store.dequeue(item.id);
        break;
      }
      case 'dead-letter': {
        // Gone resource (404/410) → move to the Dead Letter Store (Req 5.6).
        await this.store.moveToDLS(item.id, resolution.reason);
        this.emit('item-dead-lettered', {
          itemId: item.id,
          noteId: item.noteId,
          reason: resolution.reason,
        });
        break;
      }
    }

    await this.unblockLane(item.noteId);
    return 'resolved';
  }

  /** Moves an item to the Dead Letter Store for a non-retryable failure (Req 3.5). */
  private async handleDeadLetter(item: QueueItem, reason: string): Promise<ItemOutcome> {
    this.cancelRetry(item.id);
    await this.store.moveToDLS(item.id, reason);
    this.emit('item-dead-lettered', {
      itemId: item.id,
      noteId: item.noteId,
      reason,
    });
    await this.unblockLane(item.noteId);
    return 'resolved';
  }

  /**
   * Handles a retryable failure: records a circuit-breaker failure for
   * connectivity/5xx errors (Req 4.1), and either schedules a backoff retry or
   * — once {@link MAX_RETRIES} attempts are exhausted — moves the item to the
   * Dead Letter Store (Req 3.6). On a scheduled retry the item and its lane
   * successors are blocked so the chain stays ordered (Req 2.2, 2.6).
   */
  private async handleRetry(item: QueueItem, error: SyncError): Promise<ItemOutcome> {
    if (this.isConnectivityFailure(error)) {
      this.breaker.recordFailure();
    }

    const attemptedCount = item.retryCount + 1;

    if (attemptedCount >= MAX_RETRIES) {
      // Exhausted all retries → Dead Letter Store (Req 3.6).
      this.cancelRetry(item.id);
      const reason = `Exhausted ${MAX_RETRIES} retries: ${error.message}`;
      await this.store.moveToDLS(item.id, reason);
      this.emit('item-dead-lettered', {
        itemId: item.id,
        noteId: item.noteId,
        reason,
      });
      await this.unblockLane(item.noteId);
      return 'resolved';
    }

    // Block the failed item (so it is not re-attempted before its backoff) and
    // its successors (Req 2.2 / Property 5), then arm the retry.
    await this.transitionState(item, 'blocked', {
      retryCount: attemptedCount,
      error: error.message,
      lastAttemptAt: this.now(),
    });
    await this.blockSuccessors(item.noteId, item.sequenceNumber);
    this.scheduleRetry({ ...item, retryCount: attemptedCount }, error);
    return 'blocked';
  }

  // -------------------------------------------------------------------------
  // Retry timers (backoff delay sourced from the RetryScheduler)
  // -------------------------------------------------------------------------

  /**
   * Arms a backoff timer for the item using the {@link RetryScheduler}'s delay
   * calculation (Req 3.1–3.3). When it fires, {@link reattemptItem} flips the
   * item back to `pending` and re-drains the queue. A server `retryAfterMs` hint
   * (e.g. from a 429) takes precedence when larger than the computed backoff.
   */
  private scheduleRetry(item: QueueItem, error: SyncError): void {
    this.cancelRetry(item.id);

    const backoff = this.retryScheduler.getDelay(item.retryCount);
    const delay =
      error.retryAfterMs != null ? Math.max(error.retryAfterMs, backoff) : backoff;

    const timer = setTimeout(() => {
      this.retryTimers.delete(item.id);
      void this.reattemptItem(item);
    }, delay);
    this.retryTimers.set(item.id, timer);
  }

  /** Cancels a pending retry timer for an item, if any. */
  private cancelRetry(itemId: string): void {
    const timer = this.retryTimers.get(itemId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.retryTimers.delete(itemId);
    }
    // Keep the injected scheduler in sync if it is also tracking this item.
    this.retryScheduler.cancelRetry(itemId);
  }

  /** Cancels every pending retry timer. */
  private cancelAllRetries(): void {
    for (const itemId of [...this.retryTimers.keys()]) {
      this.cancelRetry(itemId);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Maps a {@link TransportResponse} onto a {@link SyncResult}. 2xx is success;
   * 409/404/410 route to the conflict resolver; connection-level failures
   * (timeout/network) are always retryable; remaining HTTP statuses are
   * classified by the {@link RetryScheduler} (Req 3.4, 3.5).
   */
  private mapResponse(response: TransportResponse): SyncResult {
    const { status } = response;

    if (status >= 200 && status < 300) {
      return { status: 'success' };
    }

    if (status === 409 || status === 404 || status === 410) {
      const conflict: ConflictResponse = { status };
      if (response.serverTimestamp !== undefined) {
        conflict.serverTimestamp = response.serverTimestamp;
      }
      if (response.serverRecord !== undefined) {
        conflict.serverRecord = response.serverRecord;
      }
      return { status: 'conflict', response: conflict };
    }

    const error: SyncError =
      response.errorKind === 'network' || response.errorKind === 'network-timeout'
        ? {
            kind: response.errorKind,
            message: response.message ?? 'Network failure',
            ...(response.retryAfterMs !== undefined
              ? { retryAfterMs: response.retryAfterMs }
              : {}),
          }
        : {
            kind: 'http',
            status,
            message: response.message ?? `HTTP ${status}`,
            ...(response.retryAfterMs !== undefined
              ? { retryAfterMs: response.retryAfterMs }
              : {}),
          };

    // Connection-level failures are transient connectivity issues → retry. HTTP
    // statuses defer to the RetryScheduler's classification.
    const retryable =
      error.kind === 'network' || error.kind === 'network-timeout'
        ? true
        : this.retryScheduler.isRetryable(error);

    return retryable
      ? { status: 'retry', error }
      : { status: 'dead-letter', reason: error.message };
  }

  /**
   * Whether an error counts toward the circuit breaker: network timeouts,
   * connection-level failures, and HTTP 5xx responses (Req 4.1). HTTP 429 and
   * 4xx do not (the server responded).
   */
  private isConnectivityFailure(error: SyncError): boolean {
    if (error.kind === 'network' || error.kind === 'network-timeout') {
      return true;
    }
    if (error.kind === 'http' && typeof error.status === 'number') {
      return error.status >= 500 && error.status <= 599;
    }
    return false;
  }

  /** Marks every `pending` successor in a lane as `blocked` (Req 2.2 / Property 5). */
  private async blockSuccessors(noteId: string, afterSequence: number): Promise<void> {
    const items = await this.store.getByNoteId(noteId);
    for (const item of items) {
      if (item.sequenceNumber > afterSequence && item.state === 'pending') {
        await this.transitionState(item, 'blocked');
      }
    }
  }

  /** Returns every `blocked` item in a lane to `pending` once the chain clears. */
  private async unblockLane(noteId: string): Promise<void> {
    const items = await this.store.getByNoteId(noteId);
    for (const item of items) {
      if (item.state === 'blocked') {
        await this.transitionState(item, 'pending');
      }
    }
  }

  /** Looks up the current persisted copy of an item by id. */
  private async findItem(id: string): Promise<QueueItem | null> {
    const items = await this.store.getAll();
    return items.find((item) => item.id === id) ?? null;
  }

  /**
   * Persists a state transition and emits a typed `state-change` event (Req 8.2).
   * Mutates the passed-in `item` so the caller's local copy stays coherent.
   */
  private async transitionState(
    item: QueueItem,
    newState: QueueItemState,
    metadata?: Partial<QueueItem>,
  ): Promise<void> {
    const previousState = item.state;
    await this.store.updateState(item.id, newState, metadata);

    if (metadata) {
      Object.assign(item, metadata);
    }
    item.state = newState;

    if (previousState !== newState) {
      this.emit('state-change', {
        itemId: item.id,
        previousState,
        newState,
        at: this.now(),
      });
    }
  }

  /** Whether processing may proceed right now. */
  private canProcess(): boolean {
    return this.running && !this.paused && this.breaker.state !== 'open';
  }

  /** Aborts all in-flight sync requests (offline / pause / stop). */
  private abortActiveRequests(): void {
    for (const controller of this.activeControllers) {
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    }
    this.activeControllers.clear();
  }

  /** Cancels in-flight requests when the device goes offline (Req 6.4). */
  private handleOffline(): void {
    this.abortActiveRequests();
  }

  /** Emits a typed queue event to listeners registered via {@link on}. */
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

  /**
   * Subscribe to a typed queue event. Returns an unsubscribe function.
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
}
