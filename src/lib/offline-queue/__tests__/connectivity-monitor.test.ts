/**
 * Unit tests for ConnectivityMonitor (task 6.1).
 *
 * Covers the injectable, deterministic surface of the monitor:
 * - `checkReachability()` result + `isReachable` update, including failure paths
 * - AbortController-based timeout wiring on a probe (Req 6.1)
 * - `start()`/`stop()` window event (un)subscription and idempotency (Req 6.3)
 * - debounced offline transition reporting (Req 6.3)
 * - online transition reporting only after confirmed reachability (Req 6.1)
 * - reachability retry loop: up to maxAttempts at retryInterval (Req 6.7)
 * - `onConnectivityChange()` subscribe/unsubscribe semantics
 *
 * The browser globals (`window`, `navigator`) are not present in the default
 * (node) vitest environment, so we install controllable fakes per test. The
 * reachability checker is injected to avoid any real network access; timing
 * uses small real delays.
 *
 * Requirements: 6.1, 6.3, 6.4, 6.7.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  ConnectivityMonitorImpl,
  createConnectivityMonitor,
  type ReachabilityChecker,
} from '../connectivity-monitor';

// --- fake browser globals --------------------------------------------------

interface FakeWindow {
  addEventListener: (type: string, cb: () => void) => void;
  removeEventListener: (type: string, cb: () => void) => void;
}

let windowListeners: Map<string, Set<() => void>>;
let onLineValue: boolean;

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function dispatch(type: 'online' | 'offline'): void {
  for (const cb of [...(windowListeners.get(type) ?? [])]) cb();
}

function listenerCount(type: 'online' | 'offline'): number {
  return windowListeners.get(type)?.size ?? 0;
}

/** Real-timer sleep helper for awaiting the monitor's async flows. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  windowListeners = new Map();
  onLineValue = true;

  const fakeWindow: FakeWindow = {
    addEventListener: (type, cb) => {
      let set = windowListeners.get(type);
      if (!set) {
        set = new Set();
        windowListeners.set(type, set);
      }
      set.add(cb);
    },
    removeEventListener: (type, cb) => {
      windowListeners.get(type)?.delete(cb);
    },
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      get onLine() {
        return onLineValue;
      },
    },
  });
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

// --- checkReachability -----------------------------------------------------

describe('ConnectivityMonitor.checkReachability', () => {
  it('returns the checker result and updates isReachable on success', async () => {
    const checker: ReachabilityChecker = vi.fn().mockResolvedValue(true);
    const monitor = new ConnectivityMonitorImpl({ checker });

    await expect(monitor.checkReachability()).resolves.toBe(true);
    expect(monitor.isReachable).toBe(true);
  });

  it('treats a rejecting checker as unreachable (false) without throwing', async () => {
    const checker: ReachabilityChecker = vi.fn().mockRejectedValue(new Error('boom'));
    const monitor = new ConnectivityMonitorImpl({ checker });

    await expect(monitor.checkReachability()).resolves.toBe(false);
    expect(monitor.isReachable).toBe(false);
  });

  it('aborts the probe via AbortController when the timeout elapses', async () => {
    // The checker resolves only when its signal aborts, proving the timeout
    // wiring fires the AbortController (Req 6.1 / 6.4 cancellation path).
    const checker: ReachabilityChecker = (signal) =>
      new Promise<boolean>((resolve) => {
        if (signal.aborted) return resolve(false);
        signal.addEventListener('abort', () => resolve(false));
      });
    const monitor = new ConnectivityMonitorImpl({
      checker,
      reachabilityTimeoutMs: 10,
    });

    await expect(monitor.checkReachability()).resolves.toBe(false);
  });
});

// --- start / stop subscription ---------------------------------------------

describe('ConnectivityMonitor start/stop', () => {
  it('subscribes to online/offline events on start', () => {
    const monitor = new ConnectivityMonitorImpl({
      checker: vi.fn().mockResolvedValue(true),
    });

    monitor.start();

    expect(listenerCount('online')).toBe(1);
    expect(listenerCount('offline')).toBe(1);
  });

  it('is idempotent across repeated start calls', () => {
    const monitor = new ConnectivityMonitorImpl({
      checker: vi.fn().mockResolvedValue(true),
    });

    monitor.start();
    monitor.start();

    expect(listenerCount('online')).toBe(1);
    expect(listenerCount('offline')).toBe(1);
  });

  it('unsubscribes from events on stop and tolerates repeated stop calls', () => {
    const monitor = new ConnectivityMonitorImpl({
      checker: vi.fn().mockResolvedValue(true),
    });

    monitor.start();
    monitor.stop();

    expect(listenerCount('online')).toBe(0);
    expect(listenerCount('offline')).toBe(0);
    expect(() => monitor.stop()).not.toThrow();
  });
});

// --- confirmed connectivity transitions ------------------------------------

describe('ConnectivityMonitor connectivity changes', () => {
  it('reports offline immediately after the debounce window', async () => {
    const checker: ReachabilityChecker = vi.fn().mockResolvedValue(true);
    const monitor = new ConnectivityMonitorImpl({ checker, debounceMs: 5 });
    const seen: boolean[] = [];
    monitor.onConnectivityChange((online) => seen.push(online));

    monitor.start();
    onLineValue = false;
    dispatch('offline');

    await sleep(25);

    expect(seen).toContain(false);
    expect(monitor.isOnline).toBe(false);
    expect(monitor.isReachable).toBe(false);
  });

  it('reports online only after reachability is confirmed', async () => {
    const checker: ReachabilityChecker = vi.fn().mockResolvedValue(true);
    const monitor = new ConnectivityMonitorImpl({
      checker,
      debounceMs: 5,
      verifyTimeoutMs: 50,
      retryIntervalMs: 5,
      maxAttempts: 3,
    });
    const seen: boolean[] = [];
    monitor.onConnectivityChange((online) => seen.push(online));

    monitor.start();
    onLineValue = true;
    dispatch('online');

    await sleep(40);

    expect(checker).toHaveBeenCalledTimes(1);
    expect(seen).toContain(true);
    expect(monitor.isOnline).toBe(true);
    expect(monitor.isReachable).toBe(true);
  });

  it('retries reachability and confirms online after transient failures (Req 6.7)', async () => {
    const checker = vi
      .fn<ReachabilityChecker>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const monitor = new ConnectivityMonitorImpl({
      checker,
      debounceMs: 5,
      verifyTimeoutMs: 50,
      retryIntervalMs: 5,
      maxAttempts: 3,
    });
    const seen: boolean[] = [];
    monitor.onConnectivityChange((online) => seen.push(online));

    monitor.start();
    onLineValue = true;
    dispatch('online');

    await sleep(80);

    expect(checker).toHaveBeenCalledTimes(3);
    expect(seen).toContain(true);
    expect(monitor.isReachable).toBe(true);
  });

  it('does not report online and stops after maxAttempts failures (Req 6.7)', async () => {
    const checker: ReachabilityChecker = vi.fn().mockResolvedValue(false);
    const monitor = new ConnectivityMonitorImpl({
      checker,
      debounceMs: 5,
      verifyTimeoutMs: 50,
      retryIntervalMs: 5,
      maxAttempts: 3,
    });
    const seen: boolean[] = [];
    monitor.onConnectivityChange((online) => seen.push(online));

    monitor.start();
    onLineValue = true;
    dispatch('online');

    await sleep(80);

    expect(checker).toHaveBeenCalledTimes(3);
    expect(seen).not.toContain(true);
    expect(monitor.isReachable).toBe(false);
  });
});

// --- listener registration -------------------------------------------------

describe('ConnectivityMonitor.onConnectivityChange', () => {
  it('returns an unsubscribe function that removes the listener', async () => {
    const checker: ReachabilityChecker = vi.fn().mockResolvedValue(true);
    const monitor = createConnectivityMonitor({ checker, debounceMs: 5 });
    const listener = vi.fn();

    const unsubscribe = monitor.onConnectivityChange(listener);
    unsubscribe();

    monitor.start();
    onLineValue = false;
    dispatch('offline');
    await sleep(25);

    expect(listener).not.toHaveBeenCalled();
  });
});
