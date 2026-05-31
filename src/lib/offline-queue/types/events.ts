/**
 * Typed event definitions emitted by the offline queue.
 *
 * The queue uses the `EventTarget` pattern to decouple its internals from React
 * rendering. Each event type below carries a strongly-typed `detail` payload.
 *
 * Requirements: 8.2 (state transition events with item id, previous state, new
 * state, within 500ms), 8.1 (count updates), 4.6 (circuit breaker indicator),
 * 9.2 (compact mode indicator).
 */

import type { CircuitBreakerState, QueueItemState } from './queue-item';

/** Names of the events emitted by the queue. */
export type QueueEventType =
  | 'state-change'
  | 'counts-change'
  | 'circuit-breaker-change'
  | 'compact-mode-change'
  | 'item-dead-lettered'
  | 'conflict-copy-created'
  | 'integrity-gap'
  | 'storage-pressure';

/**
 * Emitted when a single queue item transitions between states (Requirement 8.2).
 */
export interface StateChangeEventDetail {
  itemId: string;
  previousState: QueueItemState;
  newState: QueueItemState;
  /** Unix timestamp (ms) of the transition. */
  at: number;
}

/** Aggregate counts per state, surfaced to the UI (Requirement 8.1). */
export interface QueueCounts {
  pending: number;
  syncing: number;
  failed: number;
  completed: number;
}

/** Emitted whenever the aggregate counts change. */
export interface CountsChangeEventDetail {
  counts: QueueCounts;
}

/** Emitted when the circuit breaker changes state (Requirements 4.6). */
export interface CircuitBreakerChangeEventDetail {
  state: CircuitBreakerState;
}

/** Emitted when compact storage mode is entered or exited (Requirement 9.2). */
export interface CompactModeChangeEventDetail {
  isCompactMode: boolean;
}

/** Emitted when an item is moved to the Dead Letter Store. */
export interface ItemDeadLetteredEventDetail {
  itemId: string;
  noteId: string;
  reason: string;
}

/** Emitted when a conflict copy is created (Requirement 5.5). */
export interface ConflictCopyCreatedEventDetail {
  originalItemId: string;
  copyId: string;
  noteId: string;
  noteTitle: string;
}

/** Emitted when the integrity checker detects a sequence gap (Requirement 7.3). */
export interface IntegrityGapEventDetail {
  /** Missing sequence numbers that were detected. */
  missingSequenceNumbers: number[];
  /** Ids of items moved to `held` state behind the gap. */
  heldItemIds: string[];
}

/** Emitted when storage pressure status changes (Requirement 9). */
export interface StoragePressureEventDetail {
  level: 'normal' | 'compact' | 'critical';
  /** Estimated available bytes, when known. */
  availableBytes?: number;
}

/**
 * Map from event name to its `detail` payload. Used to build strongly-typed
 * custom events and listener signatures.
 */
export interface QueueEventDetailMap {
  'state-change': StateChangeEventDetail;
  'counts-change': CountsChangeEventDetail;
  'circuit-breaker-change': CircuitBreakerChangeEventDetail;
  'compact-mode-change': CompactModeChangeEventDetail;
  'item-dead-lettered': ItemDeadLetteredEventDetail;
  'conflict-copy-created': ConflictCopyCreatedEventDetail;
  'integrity-gap': IntegrityGapEventDetail;
  'storage-pressure': StoragePressureEventDetail;
}

/** A typed `CustomEvent` for a given queue event name. */
export type QueueEvent<T extends QueueEventType> = CustomEvent<QueueEventDetailMap[T]>;

/** A typed listener for a given queue event name. */
export type QueueEventListener<T extends QueueEventType> = (event: QueueEvent<T>) => void;
