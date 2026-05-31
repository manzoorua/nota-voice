/**
 * Circuit Breaker for sync operations.
 *
 * A fault-tolerance state machine that halts sync attempts after repeated
 * failures and resumes after a cooldown period. It implements the three-state
 * pattern (`closed` -> `open` -> `half-open`) described in the design document
 * and validated by **Property 10: Circuit Breaker state machine transitions**.
 *
 * Behavior (Requirements 4.1-4.7):
 * - 4.1 / 4.7: While `closed`, 5 failures within a 60s window trip the breaker
 *   `open`. A success while `closed` resets the consecutive failure counter.
 * - 4.2: While `open`, {@link canAttempt} returns `false` so the Sync Engine
 *   performs no sync operations.
 * - 4.3: After the cooldown elapses, the breaker moves to `half-open` and allows
 *   exactly one probe request (the probe timeout itself is enforced by the
 *   caller using {@link CircuitBreaker.probeTimeoutMs}).
 * - 4.4: A success while `half-open` closes the breaker and resets the failure
 *   counter to zero.
 * - 4.5: A failure while `half-open` reopens the breaker with the cooldown
 *   doubled (initial 30s) up to a maximum of 5 minutes (300000ms).
 * - 4.6: Transitions are surfaced to listeners via {@link onStateChange} so the
 *   UI can show a "sync paused" indicator.
 *
 * For crash resilience the breaker persists its snapshot through an injected
 * {@link CircuitBreakerPersistence} implementation (typically backed by the
 * IndexedDB metadata store). Persistence is injected rather than imported so
 * this module stays independently testable and free of a hard dependency on the
 * concurrently-developed QueueStore.
 */

import type { CircuitBreakerSnapshot, CircuitBreakerState } from './types';
import {
  CB_COOLDOWN_BACKOFF_FACTOR,
  CB_FAILURE_THRESHOLD,
  CB_FAILURE_WINDOW_MS,
  CB_INITIAL_COOLDOWN_MS,
  CB_MAX_COOLDOWN_MS,
  CB_PROBE_TIMEOUT_MS,
} from './utils/constants';

/** Listener invoked whenever the breaker transitions between states. */
export type CircuitBreakerStateChangeListener = (state: CircuitBreakerState) => void;

/**
 * Persistence sink for the circuit breaker snapshot. Injected via the
 * constructor so the breaker can persist its state (e.g. to the IndexedDB
 * `metadata` store) without depending on a concrete store implementation.
 *
 * `save` may be synchronous or return a promise; the breaker treats persistence
 * as best-effort and never blocks state transitions on it.
 */
export interface CircuitBreakerPersistence {
  save(snapshot: CircuitBreakerSnapshot): void | Promise<void>;
}

/** Construction options for {@link CircuitBreaker}. */
export interface CircuitBreakerOptions {
  /** Optional persistence sink for crash resilience. */
  persistence?: CircuitBreakerPersistence;
  /**
   * Optional snapshot to hydrate from on startup (e.g. read from the metadata
   * store after a crash/restart). When provided, the breaker resumes from this
   * state without emitting a transition event.
   */
  snapshot?: CircuitBreakerSnapshot | null;
  /**
   * Injectable clock, primarily for deterministic testing. Defaults to
   * `Date.now`.
   */
  now?: () => number;
  /**
   * Optional handler for persistence failures. When omitted, persistence errors
   * are swallowed (the breaker continues to operate from in-memory state).
   */
  onPersistError?: (error: unknown) => void;
}

export class CircuitBreaker {
  private currentState: CircuitBreakerState = 'closed';
  /** Count of consecutive failures within the rolling window (Req 4.1). */
  private failureCountValue = 0;
  /** Timestamps (ms) of recent consecutive failures, used for windowing. */
  private failureTimestamps: number[] = [];
  private lastFailureAtValue: number | null = null;
  private cooldownMsValue: number = CB_INITIAL_COOLDOWN_MS;
  /** When the breaker last entered the `open` state (ms), or null. */
  private openedAtValue: number | null = null;
  /** Whether the single half-open probe slot has been handed out. */
  private probeInUse = false;

  private readonly listeners = new Set<CircuitBreakerStateChangeListener>();
  private readonly persistence?: CircuitBreakerPersistence;
  private readonly now: () => number;
  private readonly onPersistError?: (error: unknown) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.persistence = options.persistence;
    this.now = options.now ?? (() => Date.now());
    this.onPersistError = options.onPersistError;

    if (options.snapshot) {
      this.restore(options.snapshot);
    }
  }

  // ---------------------------------------------------------------------------
  // Public read-only state
  // ---------------------------------------------------------------------------

  /**
   * The current breaker state. Reading this applies any pending time-based
   * transition (e.g. `open` -> `half-open` once the cooldown has elapsed) so the
   * value always reflects the effective state for the current clock.
   */
  get state(): CircuitBreakerState {
    this.refresh(this.now());
    return this.currentState;
  }

  /** Number of consecutive failures counted toward the open threshold. */
  get failureCount(): number {
    return this.failureCountValue;
  }

  /** Unix timestamp (ms) of the most recent failure, or null. */
  get lastFailureAt(): number | null {
    return this.lastFailureAtValue;
  }

  /** Current cooldown duration (ms) applied the next time the breaker opens. */
  get cooldownMs(): number {
    return this.cooldownMsValue;
  }

  /** Timeout (ms) the caller should apply to the single half-open probe (Req 4.3). */
  get probeTimeoutMs(): number {
    return CB_PROBE_TIMEOUT_MS;
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  /**
   * Record a successful sync.
   * - In `half-open`: the probe succeeded, so close the breaker and reset all
   *   failure tracking (Req 4.4).
   * - In `closed`: reset the consecutive failure counter to zero (Req 4.7).
   * - In `open`: ignored (no sync should have been attempted).
   */
  recordSuccess(): void {
    const now = this.now();
    this.refresh(now);

    if (this.currentState === 'half-open') {
      this.closeBreaker(now);
      return;
    }

    if (this.currentState === 'closed') {
      const hadFailures =
        this.failureCountValue !== 0 ||
        this.failureTimestamps.length !== 0 ||
        this.lastFailureAtValue !== null;
      if (hadFailures) {
        this.failureCountValue = 0;
        this.failureTimestamps = [];
        this.lastFailureAtValue = null;
        this.persist();
      }
    }
  }

  /**
   * Record a failed sync (network timeout, connection refused, or HTTP 5xx).
   * - In `half-open`: the probe failed, so reopen with the cooldown doubled and
   *   capped at {@link CB_MAX_COOLDOWN_MS} (Req 4.5).
   * - In `closed`: increment the windowed failure count; trip `open` once the
   *   threshold is reached within the failure window (Req 4.1).
   * - In `open`: just record the failure timestamp.
   */
  recordFailure(): void {
    const now = this.now();
    this.refresh(now);

    if (this.currentState === 'half-open') {
      this.cooldownMsValue = Math.min(
        this.cooldownMsValue * CB_COOLDOWN_BACKOFF_FACTOR,
        CB_MAX_COOLDOWN_MS,
      );
      this.lastFailureAtValue = now;
      this.transitionTo('open', now);
      return;
    }

    if (this.currentState === 'open') {
      this.lastFailureAtValue = now;
      this.persist();
      return;
    }

    // closed: track failures within the rolling window
    this.failureTimestamps.push(now);
    this.failureTimestamps = this.failureTimestamps.filter(
      (t) => now - t <= CB_FAILURE_WINDOW_MS,
    );
    this.failureCountValue = this.failureTimestamps.length;
    this.lastFailureAtValue = now;

    if (this.failureCountValue >= CB_FAILURE_THRESHOLD) {
      this.cooldownMsValue = CB_INITIAL_COOLDOWN_MS;
      this.transitionTo('open', now);
    } else {
      this.persist();
    }
  }

  /**
   * Whether a sync attempt is currently permitted.
   * - `closed`: always true.
   * - `open`: false (Req 4.2). If the cooldown has elapsed, transitions to
   *   `half-open` first and permits the single probe.
   * - `half-open`: true for exactly one probe, false thereafter until the probe
   *   result is recorded (Req 4.3).
   */
  canAttempt(): boolean {
    const now = this.now();
    this.refresh(now);

    switch (this.currentState) {
      case 'closed':
        return true;
      case 'open':
        return false;
      case 'half-open':
        if (!this.probeInUse) {
          this.probeInUse = true;
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  /** Force the breaker back to a fully reset `closed` state. */
  reset(): void {
    const now = this.now();
    const wasNotClosed = this.currentState !== 'closed';

    this.failureCountValue = 0;
    this.failureTimestamps = [];
    this.lastFailureAtValue = null;
    this.cooldownMsValue = CB_INITIAL_COOLDOWN_MS;
    this.openedAtValue = null;
    this.probeInUse = false;

    if (wasNotClosed) {
      this.currentState = 'closed';
      this.persist();
      this.emitStateChange();
    } else {
      this.persist();
    }
  }

  /**
   * Register a listener for state transitions (Req 4.6).
   * @returns an unsubscribe function.
   */
  onStateChange(callback: CircuitBreakerStateChangeListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // ---------------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------------

  /** Produce a serializable snapshot of the current breaker state. */
  getSnapshot(): CircuitBreakerSnapshot {
    return {
      state: this.currentState,
      failureCount: this.failureCountValue,
      lastFailureAt: this.lastFailureAtValue,
      cooldownMs: this.cooldownMsValue,
      openedAt: this.openedAtValue,
    };
  }

  /**
   * Hydrate the breaker from a persisted snapshot without emitting a transition.
   * Used on startup to resume state after a crash/restart.
   */
  restore(snapshot: CircuitBreakerSnapshot): void {
    this.currentState = snapshot.state;
    this.failureCountValue = snapshot.failureCount;
    this.lastFailureAtValue = snapshot.lastFailureAt;
    this.cooldownMsValue = snapshot.cooldownMs;
    this.openedAtValue = snapshot.openedAt;
    this.probeInUse = false;

    // Rebuild the windowed failure list from the persisted count so that the
    // next failure still trips at the threshold. Exact timestamps are not
    // persisted, so we approximate using the last failure timestamp.
    this.failureTimestamps = [];
    if (snapshot.lastFailureAt !== null && snapshot.failureCount > 0) {
      for (let i = 0; i < snapshot.failureCount; i += 1) {
        this.failureTimestamps.push(snapshot.lastFailureAt);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal state machine
  // ---------------------------------------------------------------------------

  /** Apply the time-based `open` -> `half-open` transition when due (Req 4.3). */
  private refresh(now: number): void {
    if (
      this.currentState === 'open' &&
      this.openedAtValue !== null &&
      now - this.openedAtValue >= this.cooldownMsValue
    ) {
      this.transitionTo('half-open', now);
    }
  }

  /** Reset all failure tracking and close the breaker (Req 4.4). */
  private closeBreaker(now: number): void {
    this.failureCountValue = 0;
    this.failureTimestamps = [];
    this.lastFailureAtValue = null;
    this.cooldownMsValue = CB_INITIAL_COOLDOWN_MS;
    this.openedAtValue = null;
    this.probeInUse = false;
    this.transitionTo('closed', now);
  }

  /** Transition to a new state, persisting and notifying listeners. No-op if unchanged. */
  private transitionTo(newState: CircuitBreakerState, now: number): void {
    if (this.currentState === newState) {
      return;
    }

    this.currentState = newState;
    if (newState === 'open') {
      this.openedAtValue = now;
      this.probeInUse = false;
    } else if (newState === 'half-open') {
      this.probeInUse = false;
    } else if (newState === 'closed') {
      this.openedAtValue = null;
    }

    this.persist();
    this.emitStateChange();
  }

  private emitStateChange(): void {
    const state = this.currentState;
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // Listener errors must not break the state machine.
      }
    }
  }

  private persist(): void {
    if (!this.persistence) {
      return;
    }
    try {
      const result = this.persistence.save(this.getSnapshot());
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).then(undefined, (err) => this.handlePersistError(err));
      }
    } catch (err) {
      this.handlePersistError(err);
    }
  }

  private handlePersistError(error: unknown): void {
    if (this.onPersistError) {
      this.onPersistError(error);
    }
    // Otherwise swallow: persistence is best-effort for crash resilience.
  }
}
