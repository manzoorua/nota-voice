// Feature: device-visibility-test, Property 8: A re-run/retry control is available after any terminal result
//
// Property-based test for Task 4.6.
//
// Property 8: A re-run/retry control is available after any terminal result.
//   For any terminal Visibility_Result (Visible, Not_Visible, or Unknown) on a
//   card, an enabled control is present that re-initiates the
//   Device_Visibility_Test for that same card when activated.
//
// Validates: Requirements 2.5, 7.5
//
// Strategy: Vitest fake timers + RTL renderHook drive the hook deterministically.
// Stub adapters are chosen so the first run lands on each of the three terminal
// statuses (Visible via fresh check-in, Not_Visible via never-seen, Unknown via
// adapter throw). After the card is terminal we activate the re-run control
// (retryTest, and separately runTest) and assert it re-initiates the test for
// that same card — the card returns to `running` and then reaches a fresh
// terminal result — confirming an enabled re-run control is available.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import fc from "fast-check";

import {
  useVisibilityTest,
  type VisibilityTestAdapters,
  type VisibilityTestDevice,
} from "@/hooks/useVisibilityTest";
import { TEST_TIMEOUT_MS } from "@/lib/deviceVisibility";
import type { CloudLivenessReading } from "@/lib/deviceVisibilityAdapters";

// The three terminal statuses we want the first run to land on.
type TerminalBehavior = "visible" | "not-visible" | "unknown";

const TERMINAL = ["Visible", "Not_Visible", "Unknown"] as const;

/**
 * Build a stubbed cloud-liveness adapter that settles (on the fake clock) into
 * the requested terminal status: a fresh check-in -> Visible, a never-seen
 * device -> Not_Visible, and a thrown error -> Unknown. The settle delay is kept
 * well under TEST_TIMEOUT_MS so the natural mechanism result wins, not the cap.
 */
function makeCloudAdapter(
  behavior: TerminalBehavior,
): VisibilityTestAdapters["fetchCloudLiveness"] {
  return () =>
    new Promise<CloudLivenessReading>((resolve, reject) => {
      setTimeout(() => {
        if (behavior === "unknown") {
          reject(new Error("adapter failure"));
        } else if (behavior === "visible") {
          const now = Date.now();
          resolve({ lastSeenAt: new Date(now).toISOString(), serverNowMs: now });
        } else {
          // not-visible: never seen => resolveCloudLiveness => Not_Visible.
          resolve({ lastSeenAt: null, serverNowMs: Date.now() });
        }
      }, 10);
    });
}

const expectedStatusFor = (behavior: TerminalBehavior) =>
  behavior === "visible"
    ? "Visible"
    : behavior === "not-visible"
      ? "Not_Visible"
      : "Unknown";

// Generators ----------------------------------------------------------------

const hexChar = fc.constantFrom(..."0123456789ABCDEF".split(""));

const arbDevice: fc.Arbitrary<VisibilityTestDevice> = fc.record({
  id: fc.uuid(),
  device_serial: fc
    .array(hexChar, { minLength: 12, maxLength: 12 })
    .map((chars) => `PEN-${chars.join("")}`),
});

const arbBehavior = fc.constantFrom<TerminalBehavior>(
  "visible",
  "not-visible",
  "unknown",
);

// Which re-run control to exercise: both retryTest (the dedicated retry path)
// and runTest (run again) must re-initiate from a terminal state.
const arbControl = fc.constantFrom<"retry" | "run">("retry", "run");

describe("useVisibilityTest — Property 8: re-run/retry available after a terminal result", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("re-initiates the test for the same card after any terminal result", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbDevice,
        arbBehavior,
        arbControl,
        async (device, behavior, control) => {
          const adapters: Partial<VisibilityTestAdapters> = {
            fetchCloudLiveness: makeCloudAdapter(behavior),
          };

          const { result, unmount } = renderHook(() =>
            useVisibilityTest({ adapters }),
          );

          // First run -> drive to a terminal result.
          await act(async () => {
            result.current.runTest(device);
          });
          await act(async () => {
            await vi.advanceTimersByTimeAsync(TEST_TIMEOUT_MS);
          });

          const firstState = result.current.getState(device.id);
          const expectedStatus = expectedStatusFor(behavior);

          // Precondition: the card is in a terminal state with the expected
          // status. This is the state from which a re-run control must exist.
          expect(firstState.phase).toBe("done");
          expect(firstState.result).not.toBeNull();
          expect(TERMINAL).toContain(firstState.result!.status);
          expect(firstState.result!.status).toBe(expectedStatus);

          // Activate the re-run control from the terminal state.
          await act(async () => {
            if (control === "retry") {
              result.current.retryTest(device);
            } else {
              result.current.runTest(device);
            }
          });

          // The control re-initiated the test for THIS card: it is running
          // again with the prior result cleared (no stale terminal result).
          const rerunState = result.current.getState(device.id);
          expect(rerunState.phase).toBe("running");
          expect(rerunState.result).toBeNull();

          // And the re-initiated test again reaches a terminal result.
          await act(async () => {
            await vi.advanceTimersByTimeAsync(TEST_TIMEOUT_MS);
          });
          const finalState = result.current.getState(device.id);
          expect(finalState.phase).toBe("done");
          expect(finalState.result).not.toBeNull();
          expect(finalState.result!.status).toBe(expectedStatus);

          unmount();
          vi.clearAllTimers();
        },
      ),
      { numRuns: 100 },
    );
  });
});
