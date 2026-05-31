/**
 * Core data models for the offline queue system.
 *
 * These types describe the persistent shape of queued operations as stored in
 * IndexedDB (database `NotaVoiceOfflineDB`, version 2). They are the single
 * source of truth for queue item structure and are mirrored by the Zod schemas
 * in `../schemas.ts` for runtime validation.
 *
 * Requirements: 1.3 (queue item fields), 7.1/7.2 (schema validation), 8.2 (events).
 */

/**
 * Lifecycle state of a {@link QueueItem}.
 *
 * - `pending`   — waiting to be synced
 * - `syncing`   — currently being transmitted to the backend
 * - `blocked`   — a predecessor on the same `noteId` failed; this item is held
 *                 behind it until the chain is resolved
 * - `held`      — held by the integrity checker (e.g. following a sequence gap)
 *                 pending user acknowledgment
 * - `completed` — successfully synced to the backend
 */
export type QueueItemState = 'pending' | 'syncing' | 'blocked' | 'held' | 'completed';

/** The kind of mutation a queue item represents. */
export type QueueOperationType = 'create' | 'update' | 'delete';

/**
 * Circuit breaker state, persisted to the metadata store for crash resilience.
 * Declared here because {@link MetadataEntries} references it.
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * The operation data carried by a queue item. Capped at ~5MB once serialized
 * (Requirement 1.3). `audioBlob` is omitted while the queue is in compact mode
 * under storage pressure (Requirement 9.1).
 */
export interface QueueItemPayload {
  title: string;
  content: string;
  /** Raw audio data. Omitted in compact storage mode. */
  audioBlob?: ArrayBuffer;
  transcription?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The caller-supplied shape passed to `QueueStore.enqueue`. The store assigns
 * the remaining {@link QueueItem} fields (`id`, `sequenceNumber`,
 * `payloadChecksum`, `state`, timestamps, `retryCount`, `error`).
 */
export interface QueueItemInput {
  operationType: QueueOperationType;
  /** Groups items into FIFO processing lanes. */
  noteId: string;
  payload: QueueItemPayload;
}

/**
 * A fully materialized queue entry as persisted in the `queue` object store.
 * Requirement 1.3 mandates operation type, payload (max 5MB), creation
 * timestamp, retry count (0–10), last attempt timestamp, and a unique id.
 */
export interface QueueItem {
  /** UUID v4. */
  id: string;
  /** Monotonically increasing, assigned at insertion time (starts at 1). */
  sequenceNumber: number;
  operationType: QueueOperationType;
  /** Groups items into processing lanes. */
  noteId: string;
  /** Operation data (max 5MB). */
  payload: QueueItemPayload;
  /** CRC32 of the JSON-serialized payload, computed at write time. */
  payloadChecksum: string;
  state: QueueItemState;
  /** Unix timestamp (ms) at creation. */
  createdAt: number;
  /** Unix timestamp (ms) of the last sync attempt, or null if never attempted. */
  lastAttemptAt: number | null;
  /** Number of sync attempts so far (0–10). */
  retryCount: number;
  /** Last error message, or null. */
  error: string | null;
}

/**
 * An item that has permanently failed and been moved out of the active queue
 * into the `deadLetter` object store.
 */
export interface DeadLetterItem {
  /** Same id as the original {@link QueueItem}. */
  id: string;
  /** Full snapshot of the failed item. */
  originalItem: QueueItem;
  /** Why it was moved (validation failure, max retries, non-retryable error, etc.). */
  reason: string;
  /** Unix timestamp (ms) when it was moved. */
  movedAt: number;
  /** Denormalized for filtering. */
  noteId: string;
}

/**
 * Persisted snapshot of the circuit breaker, stored under
 * `MetadataEntries['circuitBreakerState']` for crash resilience.
 */
export interface CircuitBreakerSnapshot {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureAt: number | null;
  cooldownMs: number;
  openedAt: number | null;
}

/**
 * Key-value entries stored in the `metadata` object store. The interface keys
 * correspond to the `key` values used in the store.
 */
export interface MetadataEntries {
  lastSequenceNumber: number;
  circuitBreakerState: CircuitBreakerSnapshot;
  compactMode: boolean;
}

/** Filter accepted by `QueueStore.getAll`. */
export interface QueueFilter {
  state?: QueueItemState;
  noteId?: string;
}

/**
 * Lightweight projection of a {@link QueueItem} for display in the UI
 * (Requirement 8.3): operation type, note excerpt, timestamp, state, retries.
 */
export interface QueueItemSummary {
  id: string;
  operationType: QueueOperationType;
  noteId: string;
  /** First 50 characters of the note title/content. */
  excerpt: string;
  createdAt: number;
  state: QueueItemState;
  retryCount: number;
  /**
   * `true` when this summary represents a Dead Letter Store entry (a permanently
   * failed item) rather than an active queue item. The UI uses this to surface
   * retry/discard actions (Req 8.4, 8.6). Defaults to `false`/omitted for active
   * items. DLS entries cannot be identified by {@link state} alone because the
   * snapshot retains whatever state the item held when it was moved.
   */
  isDeadLetter?: boolean;
}
