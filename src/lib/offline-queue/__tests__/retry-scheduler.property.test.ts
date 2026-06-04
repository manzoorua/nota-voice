import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { RetryScheduler } from '../retry-scheduler';
import type { SyncError } from '../types';
import {
  RETRY_BASE_DELAY_MS,
  RETRY_BACKOFF_FACTOR,
  RETRY_MAX_DELAY_MS,
  RETRY_JITTER_FACTOR,
  RETRYABLE_STATUS_CODES,
  NON_RETRYABLE_STATUS_CODES,
} from '../utils/constants';

/**
 * Property-based tests for RetryScheduler (offline-queue-robustness spec task 3.2).
 * Properties 7 (exponential backoff), 8 (error classification partition),
 * 9 (max-retry exhaustion classification).
 */

describe('RetryScheduler properties', () => {
  // Property 7: Exponential backoff delay calculation
  it('Property 7: getDelay lies in [base, base*(1+jitter)] and is capped', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        (attempt, rand) => {
          const sched = new RetryScheduler({ random: () => rand });
          const base = Math.min(
            RETRY_BASE_DELAY_MS * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1),
            RETRY_MAX_DELAY_MS,
          );
          const delay = sched.getDelay(attempt);
          // delay = base + base*jitterFactor*rand, in [base, base*(1+0.3))
          expect(delay).toBeGreaterThanOrEqual(base);
          expect(delay).toBeLessThanOrEqual(base * (1 + RETRY_JITTER_FACTOR));
          // Never exceeds the capped base * (1 + jitter).
          expect(delay).toBeLessThanOrEqual(RETRY_MAX_DELAY_MS * (1 + RETRY_JITTER_FACTOR));
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 7 (cont): base is monotonically non-decreasing and capped at max.
  it('Property 7: base delay is non-decreasing in attempt and capped at RETRY_MAX_DELAY_MS', () => {
    const sched = new RetryScheduler({ random: () => 0 }); // zero jitter -> pure base
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 19 }), (n) => {
        const d1 = sched.getDelay(n);
        const d2 = sched.getDelay(n + 1);
        expect(d2).toBeGreaterThanOrEqual(d1);
        expect(d1).toBeLessThanOrEqual(RETRY_MAX_DELAY_MS);
      }),
      { numRuns: 100 },
    );
  });

  // Property 8: Error classification partitions all errors
  it('Property 8: retryable iff network-timeout or HTTP status in the retryable set', () => {
    const sched = new RetryScheduler();
    // Generator over the full SyncError space.
    const errorArb: fc.Arbitrary<SyncError> = fc.oneof(
      fc.record({
        kind: fc.constant<'network-timeout'>('network-timeout'),
        message: fc.string(),
      }),
      fc.record({
        kind: fc.constant<'network'>('network'),
        message: fc.string(),
      }),
      fc.record({
        kind: fc.constant<'unknown'>('unknown'),
        message: fc.string(),
      }),
      fc.record({
        kind: fc.constant<'http'>('http'),
        status: fc.integer({ min: 100, max: 599 }),
        message: fc.string(),
      }),
    );
    fc.assert(
      fc.property(errorArb, (error) => {
        const got = sched.isRetryable(error);
        let expected: boolean;
        if (error.kind === 'network-timeout') {
          expected = true;
        } else if (error.kind === 'http' && typeof error.status === 'number') {
          expected = RETRYABLE_STATUS_CODES.includes(error.status);
        } else {
          expected = false;
        }
        expect(got).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  // Property 8 (cont): the documented retryable/non-retryable status sets are disjoint
  // and classified as specified — a total partition with no overlap.
  it('Property 8: retryable and non-retryable status sets never overlap', () => {
    const sched = new RetryScheduler();
    fc.assert(
      fc.property(
        fc.constantFrom(...RETRYABLE_STATUS_CODES, ...NON_RETRYABLE_STATUS_CODES),
        (status) => {
          const err: SyncError = { kind: 'http', status, message: 'x' };
          const retryable = sched.isRetryable(err);
          if (RETRYABLE_STATUS_CODES.includes(status)) {
            expect(retryable).toBe(true);
            expect(NON_RETRYABLE_STATUS_CODES.includes(status)).toBe(false);
          } else {
            expect(retryable).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 9: Max-retry exhaustion — a non-retryable error is never rescheduled
  // as retryable (the SyncEngine routes those straight to the DLS). We assert the
  // classification half of the exhaustion rule deterministically.
  it('Property 9: non-retryable HTTP statuses are classified non-retryable (DLS-bound)', () => {
    const sched = new RetryScheduler();
    fc.assert(
      fc.property(fc.constantFrom(...NON_RETRYABLE_STATUS_CODES), (status) => {
        expect(sched.isRetryable({ kind: 'http', status, message: 'x' })).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
