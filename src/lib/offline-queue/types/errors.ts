/**
 * Error and conflict types for the offline queue sync pipeline.
 *
 * These describe the inputs and outputs of error classification
 * (RetryScheduler) and conflict resolution (ConflictResolver).
 *
 * Requirements: 3.4/3.5 (error classification), 5.1–5.6 (conflict resolution).
 */

/**
 * The kind of failure encountered during a sync attempt. Used by the
 * RetryScheduler to classify retryable vs. non-retryable errors.
 *
 * - `http`            — the server responded with a status code (see `status`)
 * - `network-timeout` — the request exceeded the timeout (>10s)
 * - `network`         — a connection-level failure (refused, DNS, offline)
 * - `unknown`         — an unclassified error
 */
export type SyncErrorKind = 'http' | 'network-timeout' | 'network' | 'unknown';

/**
 * A normalized error produced by a sync attempt. The RetryScheduler decides
 * retryability from `kind` and `status` (Requirements 3.4, 3.5).
 */
export interface SyncError {
  kind: SyncErrorKind;
  /** HTTP status code when `kind === 'http'`. */
  status?: number;
  /** Human-readable message. */
  message: string;
  /** Optional Retry-After hint in milliseconds (e.g. derived from a 429 header). */
  retryAfterMs?: number;
}

/**
 * The server's response when a sync attempt conflicts with existing state
 * (HTTP 409) or references a missing resource (HTTP 404/410).
 */
export interface ConflictResponse {
  /** HTTP status that triggered conflict handling (e.g. 409, 404, 410). */
  status: number;
  /** Last-modified timestamp (Unix ms) of the server record, when available. */
  serverTimestamp?: number;
  /** The server's current version of the record, when provided. */
  serverRecord?: Record<string, unknown>;
}

/**
 * The decision produced by the ConflictResolver.
 *
 * - `keep-local`          — the local version wins; retain it on the server
 * - `keep-server`         — the server version wins; discard the local item
 * - `create-conflict-copy`— preserve both by creating a labeled copy
 * - `dead-letter`         — move the item to the Dead Letter Store
 */
export type ConflictResolution =
  | { action: 'keep-local' }
  | { action: 'keep-server' }
  | { action: 'create-conflict-copy'; copyId: string }
  | { action: 'dead-letter'; reason: string };

/** Outcome of a single sync attempt, returned by `SyncEngine.syncItem`. */
export type SyncResult =
  | { status: 'success' }
  | { status: 'retry'; error: SyncError }
  | { status: 'conflict'; response: ConflictResponse }
  | { status: 'dead-letter'; reason: string };
