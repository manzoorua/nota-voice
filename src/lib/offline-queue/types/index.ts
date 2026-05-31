/**
 * Barrel export for offline queue type definitions.
 */

export type {
  QueueItem,
  QueueItemInput,
  QueueItemPayload,
  QueueItemState,
  QueueOperationType,
  DeadLetterItem,
  MetadataEntries,
  CircuitBreakerSnapshot,
  CircuitBreakerState,
  QueueFilter,
  QueueItemSummary,
} from './queue-item';

export type {
  SyncError,
  SyncErrorKind,
  SyncResult,
  ConflictResponse,
  ConflictResolution,
} from './errors';

export type {
  QueueEventType,
  QueueEventDetailMap,
  QueueEvent,
  QueueEventListener,
  QueueCounts,
  StateChangeEventDetail,
  CountsChangeEventDetail,
  CircuitBreakerChangeEventDetail,
  CompactModeChangeEventDetail,
  ItemDeadLetteredEventDetail,
  ConflictCopyCreatedEventDetail,
  IntegrityGapEventDetail,
  StoragePressureEventDetail,
} from './events';
