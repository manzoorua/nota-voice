/**
 * Configuration constants for the offline queue system.
 *
 * All values are derived directly from the requirements and design documents.
 * Each constant is annotated with the requirement(s) it implements so the
 * traceability between configuration and acceptance criteria stays explicit.
 */

// ---------------------------------------------------------------------------
// IndexedDB database (design: Data Models)
// ---------------------------------------------------------------------------

/** Name of the IndexedDB database backing the offline queue. */
export const DB_NAME = 'NotaVoiceOfflineDB';

/** Schema version. v2 upgrades from the existing v1 single-store schema. */
export const DB_VERSION = 2;

/** Object store names within the database. */
export const STORE_QUEUE = 'queue';
export const STORE_DEAD_LETTER = 'deadLetter';
export const STORE_METADATA = 'metadata';

// ---------------------------------------------------------------------------
// Queue capacity and item limits (Req 1.3, 1.7)
// ---------------------------------------------------------------------------

/** Maximum number of QueueItems the queue may hold; new items rejected at the limit. (Req 1.7) */
export const MAX_QUEUE_SIZE = 1000;

/** Maximum serialized payload size for a single QueueItem: 5MB. (Req 1.3) */
export const MAX_ITEM_PAYLOAD_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Retry scheduling — exponential backoff with jitter (Req 3.1–3.3, 3.6)
// ---------------------------------------------------------------------------

/** Maximum retry attempts before an item is moved to the Dead Letter Store. (Req 3.6) */
export const MAX_RETRIES = 5;

/** Base delay for the first retry attempt (N=1): 1000ms. (Req 3.1) */
export const RETRY_BASE_DELAY_MS = 1000;

/** Exponential growth factor: delay(N) = BASE * FACTOR^(N-1). (Req 3.1) */
export const RETRY_BACKOFF_FACTOR = 2;

/** Upper bound on the calculated backoff delay before jitter: 60000ms. (Req 3.2) */
export const RETRY_MAX_DELAY_MS = 60000;

/** Maximum jitter as a fraction of the capped delay (0–30%). (Req 3.3) */
export const RETRY_JITTER_FACTOR = 0.3;

/** HTTP status codes classified as retryable. (Req 3.4) */
export const RETRYABLE_STATUS_CODES: readonly number[] = [429, 500, 502, 503, 504];

/** HTTP status codes classified as non-retryable (move straight to DLS). (Req 3.5) */
export const NON_RETRYABLE_STATUS_CODES: readonly number[] = [400, 401, 403, 422];

// ---------------------------------------------------------------------------
// Concurrency / processing lanes (Req 2.3)
// ---------------------------------------------------------------------------

/** Maximum number of note lanes processed concurrently. (Req 2.3) */
export const MAX_CONCURRENT_LANES = 3;

// ---------------------------------------------------------------------------
// Circuit breaker (Req 4.1–4.5)
// ---------------------------------------------------------------------------

/** Consecutive failures within the window that trip the breaker open. (Req 4.1) */
export const CB_FAILURE_THRESHOLD = 5;

/** Rolling window in which failures are counted toward the threshold: 60000ms. (Req 4.1) */
export const CB_FAILURE_WINDOW_MS = 60000;

/** Initial cooldown after the breaker opens before a probe is allowed: 30000ms. (Req 4.3, 4.5) */
export const CB_INITIAL_COOLDOWN_MS = 30000;

/** Maximum cooldown after repeated probe failures (doubling, capped): 300000ms. (Req 4.5) */
export const CB_MAX_COOLDOWN_MS = 300000;

/** Timeout for the single half-open probe request: 10000ms. (Req 4.3) */
export const CB_PROBE_TIMEOUT_MS = 10000;

/** Factor by which the cooldown is multiplied on each successive probe failure. (Req 4.5) */
export const CB_COOLDOWN_BACKOFF_FACTOR = 2;

// ---------------------------------------------------------------------------
// Connectivity / reachability (Req 4.1, 6.1, 6.4, 6.7)
// ---------------------------------------------------------------------------

/** Network request timeout that counts as a failure: 10000ms (>10s). (Req 4.1) */
export const NETWORK_TIMEOUT_MS = 10000;

/** Debounce applied to online/offline transitions before acting: 1000ms. (Req 6.3) */
export const CONNECTIVITY_DEBOUNCE_MS = 1000;

/** Time allotted to verify reachability after an online event: 2000ms. (Req 6.1) */
export const REACHABILITY_CHECK_TIMEOUT_MS = 2000;

/** Interval between reachability verification retries: 5000ms. (Req 6.7) */
export const REACHABILITY_RETRY_INTERVAL_MS = 5000;

/** Maximum reachability verification attempts before giving up. (Req 6.7) */
export const REACHABILITY_MAX_ATTEMPTS = 3;

/** Maximum time to cancel an in-progress request after going offline: 5000ms. (Req 6.4) */
export const SYNC_CANCEL_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Storage pressure & graceful degradation (Req 9.1–9.4)
// ---------------------------------------------------------------------------

/** Enter compact mode when available storage drops below 10MB. (Req 9.1) */
export const COMPACT_MODE_ENTER_BYTES = 10 * 1024 * 1024;

/** Exit compact mode only when available storage rises above 20MB (hysteresis). (Req 9.3) */
export const COMPACT_MODE_EXIT_BYTES = 20 * 1024 * 1024;

/** Maximum number of synced items to purge in a single reclamation pass. (Req 9.4) */
export const PURGE_MAX_ITEMS = 20;

/** Target amount of space to reclaim when purging synced items: 2MB. (Req 9.4) */
export const PURGE_TARGET_RECLAIM_BYTES = 2 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Queue integrity & visibility (Req 7.4, 8.1, 8.3)
// ---------------------------------------------------------------------------

/** Queue total size that triggers a persistent "queue large" notification: 50MB. (Req 7.4) */
export const QUEUE_SIZE_WARNING_BYTES = 50 * 1024 * 1024;

/** Time budget for startup schema validation before the engine starts: 5000ms. (Req 7.1) */
export const INTEGRITY_CHECK_TIMEOUT_MS = 5000;

/** Maximum number of items surfaced in the queue status list. (Req 8.3) */
export const MAX_DISPLAYED_ITEMS = 100;

/** Number of characters of note content shown as an excerpt in the UI. (Req 8.3) */
export const NOTE_EXCERPT_LENGTH = 50;

/** Maximum latency for reflecting state-change counts/events to the UI: 500ms. (Req 8.1, 8.2) */
export const STATE_CHANGE_NOTIFY_MS = 500;

// ---------------------------------------------------------------------------
// Persistence timing (Req 1.1, 1.2)
// ---------------------------------------------------------------------------

/** Maximum time to persist a new QueueItem to IndexedDB after creation: 500ms. (Req 1.1) */
export const PERSIST_LATENCY_MS = 500;

/** Maximum time to restore unsynced items on startup: 2000ms. (Req 1.2) */
export const RESTORE_LATENCY_MS = 2000;

/** Background Sync registration tag used to resume processing out of foreground. (Req 6.5) */
export const BACKGROUND_SYNC_TAG = 'offline-queue-sync';
