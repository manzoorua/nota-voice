/**
 * Page-side Background Sync registration helpers for the offline queue.
 *
 * The Background Sync API lets the browser wake the service worker to resume
 * queue processing even when the application is not in the foreground. The
 * service worker itself cannot drive the page's {@link OfflineQueue} /
 * `SyncEngine` (those live on the page), so the agreed pattern is:
 *
 *   1. The page registers a one-off sync under the {@link BACKGROUND_SYNC_TAG}
 *      tag (typically when an item is enqueued while offline).
 *   2. When the browser fires the corresponding `sync` event, the service
 *      worker (`public/sw.js`) posts a `{ type: 'OFFLINE_QUEUE_SYNC' }` message
 *      to any open clients.
 *   3. The page listens for that message (via {@link onOfflineQueueSyncMessage})
 *      and runs `OfflineQueue.processQueue()`.
 *
 * Requirements implemented:
 * - 6.5: If the Background Sync API is available, register a sync event to
 *   trigger queue processing when the application is not in the foreground.
 * - 6.6: If the Background Sync API is not available, defer queue processing to
 *   the next foreground session where the device is online — callers treat a
 *   `false` return from {@link registerOfflineQueueSync} as "fall back to
 *   foreground sync".
 *
 * This module is plain TypeScript (no React) and is therefore safe to re-export
 * from the top-level `@/lib/offline-queue` barrel.
 */

import { BACKGROUND_SYNC_TAG } from './utils/constants';

/**
 * Minimal shape of the `SyncManager` exposed by a `ServiceWorkerRegistration`
 * when the Background Sync API is available. The standard TypeScript DOM lib
 * does not yet declare this API, so we model only the surface we use.
 */
interface BackgroundSyncManager {
  register(tag: string): Promise<void>;
}

/** A `ServiceWorkerRegistration` that may expose the Background Sync manager. */
type RegistrationWithSync = ServiceWorkerRegistration & {
  sync?: BackgroundSyncManager;
};

/** The message payload the service worker posts when a sync event fires. */
export interface OfflineQueueSyncMessage {
  type: 'OFFLINE_QUEUE_SYNC';
}

/** The literal `type` value used in {@link OfflineQueueSyncMessage}. */
export const OFFLINE_QUEUE_SYNC_MESSAGE_TYPE = 'OFFLINE_QUEUE_SYNC' as const;

/**
 * Feature-detect Background Sync support.
 *
 * Returns `true` only when both the Service Worker API (`serviceWorker` on
 * `navigator`) and the Background Sync API (`SyncManager` on `window`) are
 * present. Guards against non-browser environments where `navigator`/`window`
 * are undefined.
 *
 * Requirement 6.5.
 */
export function isBackgroundSyncSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'SyncManager' in window
  );
}

/**
 * Register the offline-queue Background Sync tag with the active service worker.
 *
 * Resolves to `true` when the sync was registered successfully. Resolves to
 * `false` when Background Sync is unsupported or registration fails — in which
 * case the caller should defer processing to the next foreground session per
 * Requirement 6.6.
 *
 * Requirements 6.5, 6.6.
 */
export async function registerOfflineQueueSync(): Promise<boolean> {
  if (!isBackgroundSyncSupported()) {
    // Req 6.6: unsupported → caller falls back to foreground sync.
    return false;
  }

  try {
    const registration =
      (await navigator.serviceWorker.ready) as RegistrationWithSync;

    if (!registration.sync) {
      // SyncManager detected on `window` but not exposed on this registration.
      return false;
    }

    await registration.sync.register(BACKGROUND_SYNC_TAG);
    return true;
  } catch {
    // Registration can reject (e.g. permission denied, no active SW). Treat as
    // unsupported so the caller defers to the next foreground session.
    return false;
  }
}

/**
 * Subscribe to service-worker messages and invoke `handler` whenever a
 * `{ type: 'OFFLINE_QUEUE_SYNC' }` message arrives.
 *
 * Returns an unsubscribe function. The page wires this to
 * `OfflineQueue.processQueue()` so the service worker's sync ping resumes
 * processing on the page side.
 *
 * Safe to call in non-browser environments: when `navigator.serviceWorker` is
 * unavailable it returns a no-op unsubscribe function.
 *
 * Requirement 6.5.
 */
export function onOfflineQueueSyncMessage(
  handler: (message: OfflineQueueSyncMessage) => void,
): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {
      /* no-op: service workers unavailable in this environment */
    };
  }

  const listener = (event: MessageEvent): void => {
    const data = event.data as Partial<OfflineQueueSyncMessage> | undefined;
    if (data && data.type === OFFLINE_QUEUE_SYNC_MESSAGE_TYPE) {
      handler({ type: OFFLINE_QUEUE_SYNC_MESSAGE_TYPE });
    }
  };

  navigator.serviceWorker.addEventListener('message', listener);

  return () => {
    navigator.serviceWorker.removeEventListener('message', listener);
  };
}
