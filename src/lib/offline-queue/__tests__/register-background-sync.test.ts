/**
 * Unit tests for the page-side Background Sync registration helpers (task 13.1).
 *
 * Covers:
 * - `isBackgroundSyncSupported()` feature detection across environments
 * - `registerOfflineQueueSync()` success, unsupported, and failure paths
 * - `onOfflineQueueSyncMessage()` subscribe/unsubscribe + message filtering
 *
 * The browser globals (`window`, `navigator`) are not present in the default
 * (node) vitest environment, so we install controllable fakes per test and
 * restore the originals afterwards.
 *
 * Requirements: 6.5, 6.6.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  isBackgroundSyncSupported,
  registerOfflineQueueSync,
  onOfflineQueueSyncMessage,
} from '../register-background-sync';
import { BACKGROUND_SYNC_TAG } from '../utils/constants';

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

/** Listeners registered on the fake `navigator.serviceWorker`. */
let swMessageListeners: Set<(event: MessageEvent) => void>;

function setGlobals(options: {
  hasServiceWorker?: boolean;
  hasSyncManager?: boolean;
  ready?: unknown;
}): void {
  const { hasServiceWorker = true, hasSyncManager = true, ready } = options;

  const serviceWorker = hasServiceWorker
    ? {
        ready: Promise.resolve(ready ?? {}),
        addEventListener: (_type: string, cb: (event: MessageEvent) => void) => {
          swMessageListeners.add(cb);
        },
        removeEventListener: (_type: string, cb: (event: MessageEvent) => void) => {
          swMessageListeners.delete(cb);
        },
      }
    : undefined;

  const navigatorValue: Record<string, unknown> = {};
  if (hasServiceWorker) {
    navigatorValue.serviceWorker = serviceWorker;
  }

  const windowValue: Record<string, unknown> = {};
  if (hasSyncManager) {
    windowValue.SyncManager = function SyncManager() {};
  }

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: navigatorValue,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: windowValue,
  });
}

beforeEach(() => {
  swMessageListeners = new Set();
});

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete (globalThis as { window?: unknown }).window;
  }
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
  } else {
    delete (globalThis as { navigator?: unknown }).navigator;
  }
});

// --- isBackgroundSyncSupported ---------------------------------------------

describe('isBackgroundSyncSupported', () => {
  it('returns true when serviceWorker and SyncManager are both present', () => {
    setGlobals({ hasServiceWorker: true, hasSyncManager: true });
    expect(isBackgroundSyncSupported()).toBe(true);
  });

  it('returns false when SyncManager is missing', () => {
    setGlobals({ hasServiceWorker: true, hasSyncManager: false });
    expect(isBackgroundSyncSupported()).toBe(false);
  });

  it('returns false when serviceWorker is missing', () => {
    setGlobals({ hasServiceWorker: false, hasSyncManager: true });
    expect(isBackgroundSyncSupported()).toBe(false);
  });
});

// --- registerOfflineQueueSync ----------------------------------------------

describe('registerOfflineQueueSync', () => {
  it('registers the BACKGROUND_SYNC_TAG and returns true on success', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    setGlobals({ ready: { sync: { register } } });

    await expect(registerOfflineQueueSync()).resolves.toBe(true);
    expect(register).toHaveBeenCalledWith(BACKGROUND_SYNC_TAG);
  });

  it('returns false when Background Sync is unsupported (Req 6.6 fallback)', async () => {
    setGlobals({ hasSyncManager: false });
    await expect(registerOfflineQueueSync()).resolves.toBe(false);
  });

  it('returns false when the registration has no sync manager', async () => {
    setGlobals({ ready: {} });
    await expect(registerOfflineQueueSync()).resolves.toBe(false);
  });

  it('returns false when sync.register rejects', async () => {
    const register = vi.fn().mockRejectedValue(new Error('denied'));
    setGlobals({ ready: { sync: { register } } });

    await expect(registerOfflineQueueSync()).resolves.toBe(false);
  });
});

// --- onOfflineQueueSyncMessage ---------------------------------------------

describe('onOfflineQueueSyncMessage', () => {
  it('invokes the handler for OFFLINE_QUEUE_SYNC messages', () => {
    setGlobals({});
    const handler = vi.fn();
    onOfflineQueueSyncMessage(handler);

    expect(swMessageListeners.size).toBe(1);
    for (const cb of swMessageListeners) {
      cb({ data: { type: 'OFFLINE_QUEUE_SYNC' } } as MessageEvent);
    }

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'OFFLINE_QUEUE_SYNC' });
  });

  it('ignores unrelated messages', () => {
    setGlobals({});
    const handler = vi.fn();
    onOfflineQueueSyncMessage(handler);

    for (const cb of swMessageListeners) {
      cb({ data: { type: 'SOMETHING_ELSE' } } as MessageEvent);
      cb({ data: undefined } as MessageEvent);
    }

    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes when the returned function is called', () => {
    setGlobals({});
    const handler = vi.fn();
    const unsubscribe = onOfflineQueueSyncMessage(handler);

    expect(swMessageListeners.size).toBe(1);
    unsubscribe();
    expect(swMessageListeners.size).toBe(0);
  });

  it('returns a no-op unsubscribe when service workers are unavailable', () => {
    setGlobals({ hasServiceWorker: false });
    const handler = vi.fn();
    const unsubscribe = onOfflineQueueSyncMessage(handler);

    expect(() => unsubscribe()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
