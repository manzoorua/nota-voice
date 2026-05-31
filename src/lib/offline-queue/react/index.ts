/**
 * React integration barrel for the offline queue subsystem.
 *
 * This barrel is intentionally separate from the top-level `@/lib/offline-queue`
 * index so that non-React consumers (the queue core, the service worker glue)
 * never pull React in transitively. Import the provider and hook from
 * `@/lib/offline-queue/react`.
 */

export {
  QueueStatusProvider,
  QueueStatusContext,
} from './QueueStatusProvider';
export type {
  QueueStatusContextValue,
  QueueStatusProviderProps,
} from './QueueStatusProvider';

export { useOfflineQueue } from './useOfflineQueue';

export { QueueStatusPanel } from './QueueStatusPanel';
export type { QueueStatusPanelProps } from './QueueStatusPanel';
