/**
 * useOfflineQueue — hook for consuming the offline queue status context.
 *
 * Returns the live {@link QueueStatusContextValue} (counts, circuit-breaker
 * state, compact mode, online status, items, and the retry/discard/acknowledge
 * actions) published by the nearest {@link QueueStatusProvider}.
 *
 * Throws a clear error when used outside a provider so misuse fails loudly
 * during development rather than silently rendering stale defaults.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6.
 */

import { useContext } from 'react';

import {
  QueueStatusContext,
  type QueueStatusContextValue,
} from './QueueStatusProvider';

/**
 * Consume the offline queue status context.
 *
 * @returns The current {@link QueueStatusContextValue}.
 * @throws Error when called outside of a {@link QueueStatusProvider}.
 *
 * @example
 * ```tsx
 * function QueueBadge() {
 *   const { counts } = useOfflineQueue();
 *   return <span>{counts.pending} pending</span>;
 * }
 * ```
 */
export function useOfflineQueue(): QueueStatusContextValue {
  const context = useContext(QueueStatusContext);
  if (context === null) {
    throw new Error(
      'useOfflineQueue must be used within a <QueueStatusProvider>. ' +
        'Wrap your component tree with QueueStatusProvider before calling this hook.',
    );
  }
  return context;
}
