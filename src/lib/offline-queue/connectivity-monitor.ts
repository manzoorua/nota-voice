/**
 * ConnectivityMonitor — connectivity detection and reachability checking.
 *
 * Responsible for translating the browser's coarse `online`/`offline` signals
 * into *confirmed* connectivity changes that the Sync Engine can trust. The
 * browser `online` event only means the network interface is up; it does not
 * guarantee the backend is actually reachable. This monitor therefore performs
 * an active reachability probe against the Supabase health endpoint before
 * reporting that the device is online.
 *
 * Requirements implemented:
 * - 6.1: When the browser `online` event fires, verify reachability (within the
 *   2s budget — see {@link REACHABILITY_CHECK_TIMEOUT_MS}) before reporting online.
 * - 6.3: Debounce online/offline transitions by 1s before acting
 *   (see {@link CONNECTIVITY_DEBOUNCE_MS}).
 * - 6.4: Going offline mid-flight aborts any in-progress reachability request
 *   (in-progress fetches are cancelled via AbortController on `stop()` and when
 *   a newer transition supersedes an in-flight verification).
 * - 6.7: If reachability verification fails after an `online` event, retry after
 *   5s for a maximum of 3 attempts before giving up; do not report online.
 *
 * The reachability checker and health endpoint are injectable so the monitor can
 * be unit-tested without performing real network requests.
 */

import {
  CONNECTIVITY_DEBOUNCE_MS,
  NETWORK_TIMEOUT_MS,
  REACHABILITY_CHECK_TIMEOUT_MS,
  REACHABILITY_MAX_ATTEMPTS,
  REACHABILITY_RETRY_INTERVAL_MS,
} from './utils/constants';

/** Opaque timer identifier compatible with both browser and Node timers. */
type TimerId = ReturnType<typeof setTimeout>;

/**
 * Minimal timer abstraction so tests can supply deterministic fake timers.
 * Defaults to the platform's global `setTimeout`/`clearTimeout`.
 */
export interface TimerScheduler {
  setTimeout: (handler: () => void, ms: number) => TimerId;
  clearTimeout: (id: TimerId) => void;
}

/**
 * A reachability checker resolves to `true` when the backend responds, and
 * `false` (or rejects) when it does not. It receives an {@link AbortSignal} that
 * fires when the configured timeout elapses or the check is cancelled.
 */
export type ReachabilityChecker = (signal: AbortSignal) => Promise<boolean>;

/** Public surface of the connectivity monitor (mirrors the design interface). */
export interface ConnectivityMonitor {
  /** Last known value of `navigator.onLine` (interface-level connectivity). */
  readonly isOnline: boolean;
  /** Whether the backend was reachable at the last successful probe. */
  readonly isReachable: boolean;

  /** Begin listening for connectivity transitions. Idempotent. */
  start(): void;
  /** Stop listening and cancel any in-flight probes/timers. Idempotent. */
  stop(): void;
  /** Perform a single reachability probe; updates {@link isReachable}. */
  checkReachability(): Promise<boolean>;

  /**
   * Register a listener notified of *confirmed* connectivity changes.
   * Returns an unsubscribe function.
   */
  onConnectivityChange(callback: (online: boolean) => void): () => void;
}

/** Construction options for {@link ConnectivityMonitorImpl}. */
export interface ConnectivityMonitorOptions {
  /**
   * Custom reachability checker. When omitted, a default checker that performs a
   * lightweight GET against {@link ConnectivityMonitorOptions.healthUrl} is used.
   * Inject this in tests to avoid real network access.
   */
  checker?: ReachabilityChecker;
  /**
   * Fully-qualified URL of the health endpoint to probe. Defaults to the
   * Supabase auth health endpoint derived from `VITE_SUPABASE_URL`.
   */
  healthUrl?: string;
  /** Supabase anon/publishable key sent as `apikey`. Defaults to env value. */
  apiKey?: string;
  /** Timeout for an explicit {@link ConnectivityMonitor.checkReachability} probe. */
  reachabilityTimeoutMs?: number;
  /** Timeout for each probe during post-`online` verification (Req 6.1 budget). */
  verifyTimeoutMs?: number;
  /** Delay between reachability verification attempts (Req 6.7). */
  retryIntervalMs?: number;
  /** Maximum reachability verification attempts (Req 6.7). */
  maxAttempts?: number;
  /** Debounce applied to online/offline transitions (Req 6.3). */
  debounceMs?: number;
  /** Injectable timer scheduler (deterministic tests). */
  scheduler?: TimerScheduler;
}

/** Reads an environment value in a Vite/Vitest-compatible way. */
function readEnv(key: string): string | undefined {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    return env?.[key];
  } catch {
    return undefined;
  }
}

/** Builds the default Supabase health-endpoint URL from configuration. */
function resolveDefaultHealthUrl(): string {
  const base =
    readEnv('VITE_SUPABASE_URL') ?? 'https://ihnvrzwjxexdminrqivs.supabase.co';
  return `${base.replace(/\/+$/, '')}/auth/v1/health`;
}

/** Default timer scheduler backed by the global timers. */
const defaultScheduler: TimerScheduler = {
  setTimeout: (handler, ms) => setTimeout(handler, ms),
  clearTimeout: (id) => clearTimeout(id),
};

/**
 * Concrete {@link ConnectivityMonitor} implementation.
 */
export class ConnectivityMonitorImpl implements ConnectivityMonitor {
  private readonly checker: ReachabilityChecker;
  private readonly healthUrl: string;
  private readonly apiKey: string | undefined;
  private readonly reachabilityTimeoutMs: number;
  private readonly verifyTimeoutMs: number;
  private readonly retryIntervalMs: number;
  private readonly maxAttempts: number;
  private readonly debounceMs: number;
  private readonly scheduler: TimerScheduler;

  private started = false;
  private _isOnline = true;
  private _isReachable = false;
  /** Last value reported to listeners; `null` means nothing reported yet. */
  private lastNotified: boolean | null = null;

  private readonly listeners = new Set<(online: boolean) => void>();
  private readonly pendingTimers = new Set<TimerId>();
  private readonly activeControllers = new Set<AbortController>();
  private debounceTimer: TimerId | null = null;
  /**
   * Monotonic token used to invalidate in-flight verification loops when a newer
   * transition arrives or the monitor stops (supports Req 6.4 cancellation).
   */
  private verifyGeneration = 0;

  private readonly boundHandler: () => void;

  constructor(options: ConnectivityMonitorOptions = {}) {
    this.healthUrl = options.healthUrl ?? resolveDefaultHealthUrl();
    this.apiKey = options.apiKey ?? readEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
    this.reachabilityTimeoutMs = options.reachabilityTimeoutMs ?? NETWORK_TIMEOUT_MS;
    this.verifyTimeoutMs = options.verifyTimeoutMs ?? REACHABILITY_CHECK_TIMEOUT_MS;
    this.retryIntervalMs = options.retryIntervalMs ?? REACHABILITY_RETRY_INTERVAL_MS;
    this.maxAttempts = options.maxAttempts ?? REACHABILITY_MAX_ATTEMPTS;
    this.debounceMs = options.debounceMs ?? CONNECTIVITY_DEBOUNCE_MS;
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.checker = options.checker ?? this.createDefaultChecker();

    this.boundHandler = () => this.handleNavigatorChange();
    this._isOnline = this.readNavigatorOnline();
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  get isReachable(): boolean {
    return this._isReachable;
  }

  /**
   * Subscribe to `window` online/offline events. Safe to call multiple times;
   * subsequent calls are no-ops while already started.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    this._isOnline = this.readNavigatorOnline();

    if (
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('online', this.boundHandler);
      window.addEventListener('offline', this.boundHandler);
    }
  }

  /**
   * Unsubscribe from events and cancel all pending timers and in-flight probes.
   * Safe to call multiple times.
   */
  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function'
    ) {
      window.removeEventListener('online', this.boundHandler);
      window.removeEventListener('offline', this.boundHandler);
    }

    // Invalidate any running verification loop and tear down timers/requests.
    this.verifyGeneration++;
    this.clearDebounceTimer();
    for (const timer of this.pendingTimers) {
      this.scheduler.clearTimeout(timer);
    }
    this.pendingTimers.clear();
    this.abortActiveRequests();
  }

  /**
   * Perform a single reachability probe against the health endpoint using the
   * configured {@link reachabilityTimeoutMs}. Updates {@link isReachable}.
   *
   * @returns `true` when the backend responded, `false` on timeout/error.
   */
  async checkReachability(): Promise<boolean> {
    const reachable = await this.ping(this.reachabilityTimeoutMs);
    this._isReachable = reachable;
    return reachable;
  }

  /**
   * Register a listener for confirmed connectivity changes. The listener is
   * invoked with `true` only after reachability has been confirmed following an
   * `online` event, and with `false` once an `offline` transition settles.
   *
   * @returns A function that removes the listener.
   */
  onConnectivityChange(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // --- internal helpers ----------------------------------------------------

  /** Debounces raw online/offline events before acting (Req 6.3). */
  private handleNavigatorChange(): void {
    this.clearDebounceTimer();
    this.debounceTimer = this.scheduler.setTimeout(() => {
      this.debounceTimer = null;
      void this.processTransition();
    }, this.debounceMs);
  }

  /**
   * Processes a settled connectivity transition. Offline transitions are
   * reported immediately; online transitions are reported only after a
   * reachability probe (with retries) confirms the backend is reachable.
   */
  private async processTransition(): Promise<void> {
    // A new generation cancels any verification loop already in progress and
    // aborts its in-flight request (Req 6.4).
    const generation = ++this.verifyGeneration;
    this.abortActiveRequests();

    const online = this.readNavigatorOnline();
    this._isOnline = online;

    if (!online) {
      this._isReachable = false;
      this.notify(false);
      return;
    }

    const reachable = await this.verifyReachabilityWithRetries(generation);

    // If a newer transition superseded us while awaiting, drop the result.
    if (generation !== this.verifyGeneration) return;

    // Only report online once reachability is confirmed (Req 6.1, 6.7).
    if (reachable) {
      this.notify(true);
    }
  }

  /**
   * Probes reachability up to {@link maxAttempts} times, waiting
   * {@link retryIntervalMs} between failed attempts (Req 6.7). Returns as soon as
   * a probe succeeds. Bails out early if its generation is superseded.
   */
  private async verifyReachabilityWithRetries(generation: number): Promise<boolean> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      if (generation !== this.verifyGeneration) return false;

      const reachable = await this.ping(this.verifyTimeoutMs);
      if (generation !== this.verifyGeneration) return false;

      this._isReachable = reachable;
      if (reachable) return true;

      if (attempt < this.maxAttempts) {
        await this.delay(this.retryIntervalMs);
        if (generation !== this.verifyGeneration) return false;
      }
    }
    return false;
  }

  /**
   * Executes a single probe with an AbortController-based timeout. Resolves to
   * `false` on timeout, abort, or any error so callers can treat the backend as
   * unreachable.
   */
  private async ping(timeoutMs: number): Promise<boolean> {
    const controller = new AbortController();
    this.activeControllers.add(controller);

    const timer = this.scheduler.setTimeout(() => {
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    this.pendingTimers.add(timer);

    try {
      return await this.checker(controller.signal);
    } catch {
      return false;
    } finally {
      this.scheduler.clearTimeout(timer);
      this.pendingTimers.delete(timer);
      this.activeControllers.delete(controller);
    }
  }

  /** Resolves after `ms`, tracking the timer so `stop()` can cancel it. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = this.scheduler.setTimeout(() => {
        this.pendingTimers.delete(timer);
        resolve();
      }, ms);
      this.pendingTimers.add(timer);
    });
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer !== null) {
      this.scheduler.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private abortActiveRequests(): void {
    for (const controller of this.activeControllers) {
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    }
    this.activeControllers.clear();
  }

  /** Notifies listeners of a confirmed change, de-duplicating repeats. */
  private notify(online: boolean): void {
    if (this.lastNotified === online) return;
    this.lastNotified = online;
    for (const listener of [...this.listeners]) {
      try {
        listener(online);
      } catch {
        // A misbehaving listener must not break connectivity processing.
      }
    }
  }

  /** Reads `navigator.onLine`, assuming online when the API is unavailable. */
  private readNavigatorOnline(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  /**
   * Builds the default reachability checker: a lightweight GET to the Supabase
   * health endpoint. Any HTTP response with status < 500 is treated as
   * "reachable" (the server answered); 5xx and network/timeout errors are not.
   */
  private createDefaultChecker(): ReachabilityChecker {
    const url = this.healthUrl;
    const apiKey = this.apiKey;

    return async (signal: AbortSignal): Promise<boolean> => {
      const fetchFn = (globalThis as { fetch?: typeof fetch }).fetch;
      if (typeof fetchFn !== 'function') return false;

      const headers: Record<string, string> = {};
      if (apiKey) {
        headers.apikey = apiKey;
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetchFn(url, {
        method: 'GET',
        headers,
        signal,
        cache: 'no-store',
      });

      return response.status < 500;
    };
  }
}

/**
 * Factory for a {@link ConnectivityMonitor}. Prefer this over `new` at call
 * sites so the concrete class can evolve without churn.
 */
export function createConnectivityMonitor(
  options?: ConnectivityMonitorOptions,
): ConnectivityMonitor {
  return new ConnectivityMonitorImpl(options);
}
