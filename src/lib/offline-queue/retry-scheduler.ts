/**
 * RetryScheduler — exponential backoff with jitter and error classification.
 *
 * When a sync attempt fails with a retryable error, the scheduler computes the
 * delay before the next attempt using exponential backoff (capped) plus random
 * jitter, and arms a timer. When the timer fires, a caller-supplied `onRetry`
 * callback is invoked so the SyncEngine can re-attempt the item. Failures that
 * are not retryable are identified via {@link RetryScheduler.isRetryable} so the
 * caller can route them straight to the Dead Letter Store.
 *
 * Backoff formula (Requirements 3.1–3.3):
 *   base(N)  = min(RETRY_BASE_DELAY_MS * RETRY_BACKOFF_FACTOR^(N-1), RETRY_MAX_DELAY_MS)
 *   jitter   = uniform random in [0, RETRY_JITTER_FACTOR * base)
 *   delay(N) = base(N) + jitter      // lies in [base, base * 1.3)
 *
 * Error classification (Requirements 3.4, 3.5):
 *   retryable  iff  the error is a network timeout, or it is an HTTP error whose
 *                   status is one of {429, 500, 502, 503, 504}.
 *   every other case (including HTTP 400, 401, 403, 422) is non-retryable.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import type { QueueItem, SyncError } from './types';
import {
  RETRY_BASE_DELAY_MS,
  RETRY_BACKOFF_FACTOR,
  RETRY_MAX_DELAY_MS,
  RETRY_JITTER_FACTOR,
  RETRYABLE_STATUS_CODES,
} from './utils/constants';

/**
 * A record of a scheduled retry. Returned by {@link RetryScheduler.scheduleRetry}
 * so callers can correlate the armed timer with the queue item.
 */
export interface RetrySchedule {
  /** Id of the {@link QueueItem} the retry was scheduled for. */
  itemId: string;
  /** Unix timestamp (ms) at which the next attempt is expected to fire. */
  nextAttemptAt: number;
  /** The attempt number this retry represents (1-based). */
  attemptNumber: number;
  /** Opaque timer handle used to cancel the scheduled retry. */
  timerId: number;
}

/** Optional configuration for the {@link RetryScheduler}. */
export interface RetrySchedulerOptions {
  /**
   * Invoked when a scheduled retry timer fires. The SyncEngine wires this to
   * re-attempt the item. The item passed is the same one given to
   * {@link RetryScheduler.scheduleRetry}.
   */
  onRetry?: (item: QueueItem) => void;
  /**
   * Source of randomness for jitter, returning a value in [0, 1). Injectable for
   * deterministic testing; defaults to {@link Math.random}.
   */
  random?: () => number;
  /**
   * Clock used to compute {@link RetrySchedule.nextAttemptAt}. Injectable for
   * testing; defaults to {@link Date.now}.
   */
  now?: () => number;
}

/**
 * Schedules retries for failed sync attempts using exponential backoff with
 * jitter, and classifies sync errors as retryable or not.
 */
export class RetryScheduler {
  private readonly onRetry?: (item: QueueItem) => void;
  private readonly random: () => number;
  private readonly now: () => number;

  /** Active timers keyed by queue item id, so they can be cancelled. */
  private readonly timers = new Map<string, number>();

  constructor(options: RetrySchedulerOptions = {}) {
    this.onRetry = options.onRetry;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  /**
   * Calculates the delay (in milliseconds) before the given attempt.
   *
   * The base delay grows exponentially and is capped at
   * {@link RETRY_MAX_DELAY_MS}, then random jitter of up to
   * {@link RETRY_JITTER_FACTOR} (30%) of the base is added. The returned value
   * therefore lies in the half-open interval `[base, base * 1.3)`.
   *
   * @param attemptNumber - 1-based attempt number. Values below 1 are treated as 1.
   * @returns The delay in milliseconds, including jitter.
   */
  getDelay(attemptNumber: number): number {
    const n = Math.max(1, Math.floor(attemptNumber));
    const base = Math.min(
      RETRY_BASE_DELAY_MS * Math.pow(RETRY_BACKOFF_FACTOR, n - 1),
      RETRY_MAX_DELAY_MS,
    );
    // Uniform jitter in [0, RETRY_JITTER_FACTOR * base).
    const jitter = base * RETRY_JITTER_FACTOR * this.random();
    return base + jitter;
  }

  /**
   * Classifies a sync error as retryable or not (Requirements 3.4, 3.5).
   *
   * Returns true for network timeouts and for HTTP errors whose status is one of
   * {429, 500, 502, 503, 504}. Every other error — including HTTP 400, 401, 403,
   * and 422 — is non-retryable and should be routed to the Dead Letter Store.
   *
   * @param error - The normalized sync error to classify.
   * @returns True when the error warrants a retry, false otherwise.
   */
  isRetryable(error: SyncError): boolean {
    if (error.kind === 'network-timeout') {
      return true;
    }
    if (error.kind === 'http' && typeof error.status === 'number') {
      return RETRYABLE_STATUS_CODES.includes(error.status);
    }
    return false;
  }

  /**
   * Arms a timer to retry the given item after the calculated backoff delay.
   *
   * The attempt number is derived from the item's current `retryCount`
   * (`retryCount + 1`). Any retry already scheduled for the same item is
   * cancelled first so there is never more than one pending timer per item.
   * When a `retryAfterMs` hint is present on a 429 response it is honoured by
   * using the larger of the hint and the computed backoff delay.
   *
   * @param item - The queue item to retry.
   * @param error - Optional error, used to honour a server `retryAfterMs` hint.
   * @returns The {@link RetrySchedule} describing the armed timer.
   */
  scheduleRetry(item: QueueItem, error?: SyncError): RetrySchedule {
    // Never leave a stale timer for this item.
    this.cancelRetry(item.id);

    const attemptNumber = item.retryCount + 1;
    const backoffDelay = this.getDelay(attemptNumber);
    const delay =
      error?.retryAfterMs != null ? Math.max(error.retryAfterMs, backoffDelay) : backoffDelay;

    const nextAttemptAt = this.now() + delay;

    const timerId = setTimeout(() => {
      this.timers.delete(item.id);
      this.onRetry?.(item);
    }, delay) as unknown as number;

    this.timers.set(item.id, timerId);

    return { itemId: item.id, nextAttemptAt, attemptNumber, timerId };
  }

  /**
   * Cancels any retry currently scheduled for the given item id. Safe to call
   * when no retry is pending (no-op).
   *
   * @param itemId - The id of the queue item whose retry should be cancelled.
   */
  cancelRetry(itemId: string): void {
    const timerId = this.timers.get(itemId);
    if (timerId !== undefined) {
      clearTimeout(timerId as unknown as ReturnType<typeof setTimeout>);
      this.timers.delete(itemId);
    }
  }

  /**
   * Cancels every scheduled retry. Useful when tearing down the sync engine.
   */
  cancelAll(): void {
    for (const itemId of [...this.timers.keys()]) {
      this.cancelRetry(itemId);
    }
  }
}
