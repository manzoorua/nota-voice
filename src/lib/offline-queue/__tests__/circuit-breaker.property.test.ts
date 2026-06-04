import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CircuitBreaker } from '../circuit-breaker';
import {
  CB_FAILURE_THRESHOLD,
  CB_FAILURE_WINDOW_MS,
  CB_INITIAL_COOLDOWN_MS,
  CB_MAX_COOLDOWN_MS,
  CB_COOLDOWN_BACKOFF_FACTOR,
} from '../utils/constants';

/**
 * Property-based tests for CircuitBreaker (offline-queue-robustness spec task 4.2).
 * Property 10: state-machine transitions (closed -> open -> half-open -> closed/open),
 * driven with an injectable clock so they are fully deterministic.
 */

describe('CircuitBreaker properties', () => {
  // Property 10a: threshold failures within the window trip closed -> open,
  // and while open canAttempt() is false.
  it('Property 10: THRESHOLD consecutive failures in-window open the breaker', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (t0) => {
        let now = t0;
        const cb = new CircuitBreaker({ now: () => now });
        // Fire exactly THRESHOLD failures, each 1ms apart (well within window).
        for (let i = 0; i < CB_FAILURE_THRESHOLD; i++) {
          cb.recordFailure();
          now += 1;
        }
        expect(cb.state).toBe('open');
        expect(cb.canAttempt()).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // Property 10b: fewer than THRESHOLD failures keep it closed.
  it('Property 10: fewer than THRESHOLD failures keep the breaker closed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: CB_FAILURE_THRESHOLD - 1 }), (k) => {
        let now = 1000;
        const cb = new CircuitBreaker({ now: () => now });
        for (let i = 0; i < k; i++) {
          cb.recordFailure();
          now += 1;
        }
        expect(cb.state).toBe('closed');
        expect(cb.canAttempt()).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Property 10c: failures spread BEYOND the window never accumulate to the
  // threshold, so the breaker stays closed.
  it('Property 10: failures spaced beyond the window never trip open', () => {
    fc.assert(
      fc.property(fc.integer({ min: 6, max: 30 }), (count) => {
        let now = 0;
        const cb = new CircuitBreaker({ now: () => now });
        for (let i = 0; i < count; i++) {
          cb.recordFailure();
          // Advance more than the full window between each failure.
          now += CB_FAILURE_WINDOW_MS + 1;
        }
        expect(cb.state).toBe('closed');
      }),
      { numRuns: 100 },
    );
  });

  // Property 10d: after the cooldown elapses, open -> half-open allows exactly
  // one probe; a success in half-open closes the breaker.
  it('Property 10: open -> half-open permits one probe; success closes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (t0) => {
        let now = t0;
        const cb = new CircuitBreaker({ now: () => now });
        for (let i = 0; i < CB_FAILURE_THRESHOLD; i++) {
          cb.recordFailure();
          now += 1;
        }
        expect(cb.state).toBe('open');
        // Advance past the initial cooldown.
        now += CB_INITIAL_COOLDOWN_MS + 1;
        expect(cb.state).toBe('half-open');
        // Exactly one probe permitted.
        expect(cb.canAttempt()).toBe(true);
        expect(cb.canAttempt()).toBe(false);
        // Probe success closes.
        cb.recordSuccess();
        expect(cb.state).toBe('closed');
        expect(cb.canAttempt()).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Property 10e: a failure in half-open reopens with the cooldown doubled,
  // capped at CB_MAX_COOLDOWN_MS.
  it('Property 10: half-open failure reopens with doubled cooldown, capped', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (cycles) => {
        let now = 0;
        const cb = new CircuitBreaker({ now: () => now });
        // Trip open initially.
        for (let i = 0; i < CB_FAILURE_THRESHOLD; i++) {
          cb.recordFailure();
          now += 1;
        }
        let expectedCooldown = CB_INITIAL_COOLDOWN_MS;
        for (let c = 0; c < cycles; c++) {
          // Wait out the current cooldown to reach half-open.
          now += cb.cooldownMs + 1;
          expect(cb.state).toBe('half-open');
          expect(cb.canAttempt()).toBe(true);
          // Probe fails -> reopen with doubled (capped) cooldown.
          cb.recordFailure();
          expectedCooldown = Math.min(
            expectedCooldown * CB_COOLDOWN_BACKOFF_FACTOR,
            CB_MAX_COOLDOWN_MS,
          );
          expect(cb.state).toBe('open');
          expect(cb.cooldownMs).toBe(expectedCooldown);
          expect(cb.cooldownMs).toBeLessThanOrEqual(CB_MAX_COOLDOWN_MS);
        }
      }),
      { numRuns: 100 },
    );
  });
});
