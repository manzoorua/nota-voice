/**
 * QueueStatusProvider — React context bridge for the offline queue subsystem.
 *
 * This provider owns (or accepts) an {@link OfflineQueue} instance, drives its
 * lifecycle, subscribes to its typed events, and mirrors the relevant slices of
 * its state into React state so the UI can render queue status reactively.
 *
 * Design reference: design.md "React Integration" — {@link QueueStatusContextValue}.
 *
 * Responsibilities:
 * - Construct a default {@link OfflineQueue} or accept an injected instance via
 *   the `queue` prop (for testing or for a shared app-wide singleton).
 * - Call {@link OfflineQueue.initialize} on mount and {@link OfflineQueue.shutdown}
 *   on unmount (the latter gated by `manageLifecycle`, default `true`).
 * - Subscribe to every queue event (`state-change`, `counts-change`,
 *   `circuit-breaker-change`, `compact-mode-change`, `item-dead-lettered`,
 *   `conflict-copy-created`, `integrity-gap`) and update React state.
 * - Reflect counts, circuit-breaker state, compact mode, online status, and the
 *   displayed item list, updating within 500ms of any state change (Req 8.1).
 * - Expose `retryItem`, `discardItem`, and `acknowledgeGap` actions that delegate
 *   to the queue and refresh derived state (Req 8.4, 8.6, 7.3).
 *
 * This module imports only from the (React-free) queue core, so non-React
 * consumers of the queue never pull React in transitively. It deliberately
 * lives in its own `react/` barrel rather than the top-level module index.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { OfflineQueue, type OfflineQueueOptions } from '../offline-queue';
import type {
  CircuitBreakerState,
  QueueCounts,
  QueueItemSummary,
} from '../types';

/**
 * The value exposed by {@link QueueStatusContext} and returned by the
 * `useOfflineQueue` hook. Mirrors the `QueueStatusContextValue` defined in
 * design.md's "React Integration" section.
 */
export interface QueueStatusContextValue {
  /** Per-state counts surfaced to the UI (Req 8.1). */
  counts: QueueCounts;
  /** Current circuit-breaker state (Req 4.6). */
  circuitBreakerState: CircuitBreakerState;
  /** Whether the queue is in compact storage mode (Req 9.2). */
  isCompactMode: boolean;
  /** Whether the device is currently online (per the queue's connectivity monitor). */
  isOnline: boolean;
  /** Items to display: active queue items followed by Dead Letter Store items (Req 8.3). */
  items: QueueItemSummary[];

  /** Manually retry a Dead Letter Store item (Req 8.4). */
  retryItem(id: string): Promise<void>;
  /** Permanently discard a Dead Letter Store item (Req 8.6). */
  discardItem(id: string): Promise<void>;
  /** Acknowledge a detected sequence gap, releasing held items (Req 7.3). */
  acknowledgeGap(): void;
}

/**
 * Context holding the live {@link QueueStatusContextValue}. `null` when no
 * provider is mounted — the `useOfflineQueue` hook treats that as an error.
 */
export const QueueStatusContext = createContext<QueueStatusContextValue | null>(
  null,
);
QueueStatusContext.displayName = 'QueueStatusContext';

/** Props for {@link QueueStatusProvider}. */
export interface QueueStatusProviderProps {
  children: ReactNode;
  /**
   * An existing {@link OfflineQueue} to use. When omitted, the provider
   * constructs one from {@link queueOptions}. Read once on mount; later changes
   * to this prop are ignored (the instance is stable for the provider's life).
   */
  queue?: OfflineQueue;
  /** Options used to construct the default {@link OfflineQueue} when `queue` is not supplied. */
  queueOptions?: OfflineQueueOptions;
  /**
   * When `true` (default), the provider calls {@link OfflineQueue.shutdown} on
   * unmount. Set to `false` when injecting a shared singleton whose lifecycle is
   * managed elsewhere. The provider always calls {@link OfflineQueue.initialize}
   * on mount (it is idempotent), regardless of this flag.
   */
  manageLifecycle?: boolean;
}

const EMPTY_COUNTS: QueueCounts = {
  pending: 0,
  syncing: 0,
  failed: 0,
  completed: 0,
};

/**
 * Provides offline-queue status and actions to descendants via React context.
 *
 * @example
 * ```tsx
 * <QueueStatusProvider>
 *   <App />
 * </QueueStatusProvider>
 * ```
 */
export function QueueStatusProvider({
  children,
  queue,
  queueOptions,
  manageLifecycle = true,
}: QueueStatusProviderProps): JSX.Element {
  // Construct/accept the queue once; the instance is stable for the provider's
  // lifetime so initialize()/shutdown() pair cleanly with mount/unmount.
  const [activeQueue] = useState<OfflineQueue>(
    () => queue ?? new OfflineQueue(queueOptions),
  );

  const [counts, setCounts] = useState<QueueCounts>(EMPTY_COUNTS);
  const [circuitBreakerState, setCircuitBreakerState] =
    useState<CircuitBreakerState>('closed');
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true,
  );
  const [items, setItems] = useState<QueueItemSummary[]>([]);

  // Guards against state updates after unmount (async refreshes may be in flight).
  const mountedRef = useRef(false);
  // Coalesces bursts of events into a single refresh within the same tick.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Pulls the authoritative snapshot from the queue and mirrors it into React
   * state. Best-effort: a transient read failure must not crash the UI.
   */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [status, nextItems] = await Promise.all([
        activeQueue.getStatus(),
        activeQueue.getItems(),
      ]);
      if (!mountedRef.current) {
        return;
      }
      setCounts(status.counts);
      setCircuitBreakerState(status.circuitBreakerState);
      setIsCompactMode(status.isCompactMode);
      setIsOnline(status.isOnline);
      setItems(nextItems);
    } catch {
      // Swallow: a failed snapshot read should not break rendering. The next
      // event-driven refresh will reconcile.
    }
  }, [activeQueue]);

  /**
   * Schedules a coalesced {@link refresh}. Multiple events fired synchronously
   * collapse into one refresh on the next macrotask — well within the 500ms
   * freshness budget (Req 8.1).
   */
  const scheduleRefresh = useCallback((): void => {
    if (refreshTimerRef.current !== null) {
      return;
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 0);
  }, [refresh]);

  // Subscribe, initialize, and tear down. Runs once because every dependency is
  // stable for the provider's lifetime.
  useEffect(() => {
    mountedRef.current = true;

    const unsubscribers: Array<() => void> = [
      // Counts arrive with the event detail — apply immediately for snappy
      // updates, then refresh to reconcile the item list (Req 8.1).
      activeQueue.on('counts-change', (detail) => {
        if (mountedRef.current) {
          setCounts(detail.counts);
        }
        scheduleRefresh();
      }),
      activeQueue.on('circuit-breaker-change', (detail) => {
        if (mountedRef.current) {
          setCircuitBreakerState(detail.state);
        }
      }),
      activeQueue.on('compact-mode-change', (detail) => {
        if (mountedRef.current) {
          setIsCompactMode(detail.isCompactMode);
        }
      }),
      activeQueue.on('state-change', () => scheduleRefresh()),
      activeQueue.on('item-dead-lettered', () => scheduleRefresh()),
      activeQueue.on('conflict-copy-created', () => scheduleRefresh()),
      activeQueue.on('integrity-gap', () => scheduleRefresh()),
    ];

    // The facade does not emit a connectivity event, so listen to the browser's
    // online/offline transitions and reconcile `isOnline` from getStatus().
    const handleConnectivity = (): void => scheduleRefresh();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleConnectivity);
      window.addEventListener('offline', handleConnectivity);
    }

    // initialize() is idempotent; run it regardless of manageLifecycle so the
    // DB is open before the first snapshot read.
    void activeQueue
      .initialize()
      .then(() => {
        if (mountedRef.current) {
          void refresh();
        }
      })
      .catch(() => {
        // initialize() recovers internally; still attempt a refresh so the UI
        // reflects whatever state is available.
        if (mountedRef.current) {
          void refresh();
        }
      });

    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleConnectivity);
        window.removeEventListener('offline', handleConnectivity);
      }
      if (manageLifecycle) {
        activeQueue.shutdown();
      }
    };
  }, [activeQueue, refresh, scheduleRefresh, manageLifecycle]);

  const retryItem = useCallback(
    async (id: string): Promise<void> => {
      await activeQueue.retryItem(id);
      await refresh();
    },
    [activeQueue, refresh],
  );

  const discardItem = useCallback(
    async (id: string): Promise<void> => {
      await activeQueue.discardItem(id);
      await refresh();
    },
    [activeQueue, refresh],
  );

  const acknowledgeGap = useCallback(async (): Promise<void> => {
    await activeQueue.acknowledgeGap();
    await refresh();
  }, [activeQueue, refresh]);

  const value = useMemo<QueueStatusContextValue>(
    () => ({
      counts,
      circuitBreakerState,
      isCompactMode,
      isOnline,
      items,
      retryItem,
      discardItem,
      acknowledgeGap,
    }),
    [
      counts,
      circuitBreakerState,
      isCompactMode,
      isOnline,
      items,
      retryItem,
      discardItem,
      acknowledgeGap,
    ],
  );

  return (
    <QueueStatusContext.Provider value={value}>
      {children}
    </QueueStatusContext.Provider>
  );
}
