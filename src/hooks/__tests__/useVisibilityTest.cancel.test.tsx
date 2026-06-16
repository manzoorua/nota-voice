// Feature: device-visibility-test, Property 17: Cancel restores the pre-test state with no partial result
//
// Property-based test for Task 4.11.
//
// Property 17: Cancel restores the pre-test state with no partial result.
//   For any in-progress test, cancelling it returns the card to its exact
//   pre-test state (`idle`, no result) and retains no partial Visibility_Result.
//
// Validates: Requirements 7.4
//
// Strategy: Vitest fake timers + RTL renderHook drive the hook deterministically.
// A stubbed cloud-liveness adapter settles after `delayMs` on the fake clock so
// we can cancel mid-flight and then let the (now stale) adapter promise resolve.
// After cancel the card must be back to the exact idle snapshot, and the
// late-arriving adapter result must be discarded — never surfacing as a partial
// or terminal Visibility_Result.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import fc from "fast-check";

import {
  useVisibilityTest,
  type CardTestState,
  type VisibilityTestAdapters,
  type VisibilityTestDevice,
} from "@/hooks/useVisibilityTest";
import { TEST_TIMEOUT_MS } from "@/lib/deviceVisibility";
import type { CloudLivenessReading } from "@/lib/deviceVisibilityAdapters";

// The exact pre-test snapshot a card must return to after cancel.
const IDLE_SNAPSHOT: CardTestState = {
  phase: "idle",
  result: null,
  mechanism: null,
  startedAtMs: null,
};

/**
 * Cloud-liveness adapter that resolves with positive evidence (=> would map to
 * Visible) after `delayMs` on the fake clock. Used to verify that a result
 * arriving after a cancel is discarded.
 */
function makeCloudAdapter(
  delayMs: number,
): VisibilityTestAdapters["fetchCloudLiveness"] {
  return () =>
    new Promise<CloudLivenessReading>((resolve) => {
      setTimeout(() => {
        const now = Date.now();
        // Fresh check-in (age 0) => resolveCloudLiveness => Visible.
        resolve({ lastSeenAt: new Date(now).toISOString(), serverNowMs: now });
      }, delayMs);
    });
}

// Generators ----------------------------------------------------------------

const hexChar = fc.constantFrom(..."0123456789ABCDEF".split(""));

const arbDevice: fc.Arbitrary<VisibilityTestDevice> = fc.record({
  id: fc.uuid(),
  device_serial: fc
    .array(hexChar, { minLength: 12, maxLength: 12 })
    .map((chars) => `PEN-${chars.join("")}`),
});

// How long after starting (but before the adapter settles and before the hard
// cap) we cancel the test.
const arbCancelAfter = fc.integer({ min: 0, max: TEST_TIMEOUT_MS - 1 });

describe("useVisibilityTest — Property 17: cancel restores pre-test state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("returns the card to idle and discards any late-arriving result", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbDevice,
        arbCancelAfter,
        async (device, cancelAfterMs) => {
          // The adapter is set to settle after the cancel point but still
          // within the hard cap, so a naive implementation would surface a
          // Visible result after the user already cancelled.
          const settleAfterMs = cancelAfterMs + 1;
          const adapters: Partial<VisibilityTestAdapters> = {
            fetchCloudLiveness: makeCloudAdapter(settleAfterMs),
          };

          const { result, unmount } = renderHook(() =>
            useVisibilityTest({ adapters }),
          );

          // Start the test (default mechanism is cloud for a claimed device).
          await act(async () => {
            result.current.runTest(device);
          });

          // The in-progress indicator is set synchronously on activation.
          expect(result.current.getState(device.id).phase).toBe("running");

          // Advance partway, still before the adapter settles.
          await act(async () => {
            await vi.advanceTimersByTimeAsync(cancelAfterMs);
          });

          // Cancel the in-progress test.
          await act(async () => {
            result.current.cancelTest(device.id);
          });

          // Immediately after cancel the card is back to its exact pre-test
          // state with no partial result (Requirement 7.4).
          expect(result.current.getState(device.id)).toEqual(IDLE_SNAPSHOT);

          // Let the (now stale) adapter promise resolve and run out the full
          // hard cap. The late result must be discarded — the card stays idle.
          await act(async () => {
            await vi.advanceTimersByTimeAsync(TEST_TIMEOUT_MS);
          });

          const finalState = result.current.getState(device.id);
          expect(finalState).toEqual(IDLE_SNAPSHOT);
          // Defensive: no partial/terminal result ever leaked through.
          expect(finalState.result).toBeNull();
          expect(finalState.phase).toBe("idle");

          unmount();
          vi.clearAllTimers();
        },
      ),
      { numRuns: 100 },
    );
  });
});
