// Feature: device-visibility-test, Property 1: Every test resolves to a terminal result within the timeout
//
// Property-based test for Task 4.2.
//
// Property 1: Every test resolves to a terminal result within the timeout.
//   For any device and any mechanism behavior (resolves with evidence,
//   completes without evidence, never resolves, or throws) and any resolution
//   timing, the per-card test state machine reaches exactly one terminal
//   Visibility_Result (Visible, Not_Visible, or Unknown) no later than
//   Test_Timeout after initiation, and never remains stuck in `running`.
//
// Validates: Requirements 1.7, 1.8, 2.1, 2.2, 2.3, 6.1, 7.1, 7.2
//
// Strategy: Vitest fake timers + RTL renderHook drive the hook deterministically.
// Stub adapters model the four mechanism behaviors. After advancing exactly
// TEST_TIMEOUT_MS the machine must always be terminal — directly exercising the
// "no later than Test_Timeout" guarantee.

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

type Behavior = "evidence" | "no-evidence" | "never" | "throw";

const TERMINAL = ["Visible", "Not_Visible", "Unknown"] as const;

/**
 * Build a stubbed cloud-liveness adapter that models one of the four mechanism
 * behaviors, settling (or not) after `delayMs` on the fake clock.
 */
function makeCloudAdapter(
  behavior: Behavior,
  delayMs: number,
): VisibilityTestAdapters["fetchCloudLiveness"] {
  return () =>
    new Promise<CloudLivenessReading>((resolve, reject) => {
      if (behavior === "never") return; // intentionally never settles
      setTimeout(() => {
        if (behavior === "throw") {
          reject(new Error("adapter failure"));
        } else if (behavior === "evidence") {
          // A fresh check-in (age 0) => resolveCloudLiveness => Visible.
          const now = Date.now();
          resolve({ lastSeenAt: new Date(now).toISOString(), serverNowMs: now });
        } else {
          // no-evidence: never seen => resolveCloudLiveness => Not_Visible.
          resolve({ lastSeenAt: null, serverNowMs: Date.now() });
        }
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

const arbBehavior = fc.constantFrom<Behavior>(
  "evidence",
  "no-evidence",
  "never",
  "throw",
);

// Resolution timing spanning well before and well after the hard cap.
const arbDelay = fc.integer({ min: 0, max: 2 * TEST_TIMEOUT_MS });

describe("useVisibilityTest — Property 1: guaranteed termination", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("always reaches exactly one terminal result no later than Test_Timeout", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbDevice,
        arbBehavior,
        arbDelay,
        async (device, behavior, delayMs) => {
          const adapters: Partial<VisibilityTestAdapters> = {
            fetchCloudLiveness: makeCloudAdapter(behavior, delayMs),
          };

          const { result, unmount } = renderHook(() =>
            useVisibilityTest({ adapters }),
          );

          // Initiate the test (default mechanism is cloud for a claimed device).
          await act(async () => {
            result.current.runTest(device);
          });

          // Before advancing, the indicator is in-progress (set synchronously).
          expect(result.current.getState(device.id).phase).toBe("running");

          // Advance exactly the hard cap. Every path — early settle, late
          // settle, never-settle, throw — must be terminal by this point.
          await act(async () => {
            await vi.advanceTimersByTimeAsync(TEST_TIMEOUT_MS);
          });

          const state = result.current.getState(device.id);

          // Never stuck in running; exactly one terminal result is present.
          expect(state.phase).toBe("done");
          expect(state.result).not.toBeNull();
          expect(TERMINAL).toContain(state.result!.status);

          // Result-mapping checks, guarding against the exact-boundary race
          // (delay === TEST_TIMEOUT_MS) where ordering is implementation-defined.
          const resolvesBefore = delayMs < TEST_TIMEOUT_MS;
          const resolvesAfter = delayMs > TEST_TIMEOUT_MS;
          const status = state.result!.status;

          if (behavior === "never") {
            expect(status).toBe("Unknown");
          } else if (resolvesBefore) {
            if (behavior === "evidence") expect(status).toBe("Visible");
            else if (behavior === "no-evidence") expect(status).toBe("Not_Visible");
            else expect(status).toBe("Unknown"); // throw
          } else if (resolvesAfter) {
            // Adapter settles after the cap => the hard timeout wins => Unknown.
            expect(status).toBe("Unknown");
          }

          unmount();
          vi.clearAllTimers();
        },
      ),
      { numRuns: 100 },
    );
  });
});
