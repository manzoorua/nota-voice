/**
 * Public barrel export for the offline queue subsystem.
 *
 * Consumers (the React integration layer, the service worker glue, application
 * code) should import from `@/lib/offline-queue` rather than reaching into
 * individual module files. The {@link OfflineQueue} facade is the primary entry
 * point; the underlying components and their types are re-exported for advanced
 * use and testing.
 */

// --- Facade -----------------------------------------------------------------
export { OfflineQueue } from './offline-queue';
export type { OfflineQueueOptions, QueueStatus } from './offline-queue';

// --- Core components --------------------------------------------------------
export { QueueStore } from './queue-store';
export type { MetadataRecord } from './queue-store';

export { RetryScheduler } from './retry-scheduler';
export type { RetrySchedule, RetrySchedulerOptions } from './retry-scheduler';

export { CircuitBreaker } from './circuit-breaker';
export type {
  CircuitBreakerOptions,
  CircuitBreakerPersistence,
  CircuitBreakerStateChangeListener,
} from './circuit-breaker';

export { ConflictResolver, conflictResolver, buildConflictCopyLabel } from './conflict-resolver';
export type { ConflictCopyLabel } from './conflict-resolver';

export { QueueIntegrityChecker } from './queue-integrity-checker';
export type {
  IntegrityReport,
  SequenceGap,
  StorageSizeReport,
  ValidationResult,
} from './queue-integrity-checker';

export { StoragePressureManager, defaultEstimateItemBytes } from './storage-pressure-manager';
export type {
  StoragePressureLevel,
  StoragePressureReport,
  StoragePressureManagerOptions,
  CompactModeChangeListener,
  CompactModePersistence,
  StoragePressureQueueStore,
} from './storage-pressure-manager';

export {
  ConnectivityMonitorImpl,
  createConnectivityMonitor,
} from './connectivity-monitor';
export type {
  ConnectivityMonitor,
  ConnectivityMonitorOptions,
  ReachabilityChecker,
  TimerScheduler,
} from './connectivity-monitor';

export {
  SyncEngine,
  SyncAbortedError,
  createSupabaseTransport,
} from './sync-engine';
export type {
  SyncEngineDependencies,
  SyncTransport,
  TransportResponse,
} from './sync-engine';

// --- Background Sync registration (page-side) -------------------------------
export {
  isBackgroundSyncSupported,
  registerOfflineQueueSync,
  onOfflineQueueSyncMessage,
  OFFLINE_QUEUE_SYNC_MESSAGE_TYPE,
} from './register-background-sync';
export type { OfflineQueueSyncMessage } from './register-background-sync';

// --- Schemas ----------------------------------------------------------------
export { QueueItemSchema, QueueItemPayloadSchema } from './schemas';
export type { QueueItemSchemaType, QueueItemPayloadSchemaType } from './schemas';

// --- Utilities & constants --------------------------------------------------
export * from './utils';

// --- Types ------------------------------------------------------------------
export type * from './types';
