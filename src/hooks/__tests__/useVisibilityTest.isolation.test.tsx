// Feature: device-visibility-test, Property 5: Per-card isolation
//
// Property 5: For any list of devices and any targeted card, initiating,
// running, resolving, or failing a Device_Visibility_Test on the targeted card
// leaves every other card's test state and displayed result unchanged, and
// keeps every other card's Test_Action activatable.
//
// Validates: Requirements 1.3, 1.5, 2.6

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import fc from "fast-check";
import {
  useVisibilityTest,
  type VisibilityTestAdapters,
  type VisibilityTestDevice,
} from "../useVisibilityTest";

/**
 * The four mechanism behaviors the design's state machine must tolerate:
 * resolves with evidence (Visible), completes without evidence (Not_Visible),
 * never resolves (-> Unknown on timeout), or throws (-> Unknown).
 */
type Behavior = "visible" | "notVisible" | "neverResolve" | "throw";

const HEX = "0123456789ABCDEF".split("");

const serialArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...HEX), { minLength: 12, maxLength: 12 })
  .map((chars) => `PEN-${chars.join("")}`);

/** A list of devices with guaranteed-unique ids (the registry key). */
const devicesArb: fc.Arbitrary<{ id: string; serial: string }[]> = fc
  .uniqueArray(
    fc.record({ id: fc.uuid(), serial: serialArb }),
    { selector: (d) => d.id, minLength: 2, maxLength: 6 },
  );

const behaviorArb: fc.Arbitrary<Behavior> = fc.constantFrom(
  "visible",
  "notVisible",
  "neverResolve",
  "throw",
);

function toDevice(d: { id: string; serial: string }): VisibilityTestDevice {
  return { id: d.id, device_serial: d.serial };
}

/**
 * Build adapters whose cloud-liveness behavior is selected per-device id.
 * Unknown ids default to an immediate `Visible` reading so that "other" cards
 * stay independently activatable. Only the cloud mechanism is exercised
 * (identify + BLE disabled via getAvailability), which keeps the property
 * focused on per-card state isolation.
 */
function makeAdapters(behaviorById: Map<string, Behavior>): VisibilityTestAdapters {
  return {
    fetchCloudLiveness: (deviceId: string) => {
      const behavior = behaviorById.get(deviceId) ?? "visible";
      if (behavior === "throw") {
        return Promise.reject(new Error("synthetic cloud failure"));
      }
      if (behavior === "neverResolve") {
        return new Promise(() => {
          /* never settles -> exercises the hard Test_Timeout path */
        });
      }
      const now = Date.now();
      if (behavior === "notVisible") {
        // Far older than the Liveness_Window -> Not_Visible.
        return Promise.resolve({
          lastSeenAt: new Date(now - 10_000_000).toISOString(),
          serverNowMs: now,
        });
      }
      // Fresh check-in -> Visible.
      return Promise.resolve({
        lastSeenAt: new Date(now).toISOString(),
        serverNowMs: now,
      });
    },
    queueIdentify: () => Promise.resolve({ queued: false }),
    scanForSerial: () => Promise.resolve({ found: false }),
  };
}

/** Drain timers + microtask chains under fake timers so async tests settle. */
async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) {
      await vi.runAllTimersAsync();
    }
  });
}

describe("useVisibilityTest — Property 5: per-card isolation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("running/resolving/failing a test on one card never affects another card", async () => {
    await fc.assert(
      fc.asyncProperty(
        devicesArb,
        fc.nat(),
        behaviorArb,
        async (devices, rawIndex, behavior) => {
          const targetIndex = rawIndex % devices.length;
          const target = devices[targetIndex];
          const others = devices.filter((_, i) => i !== targetIndex);

          const behaviorById = new Map<string, Behavior>([[target.id, behavior]]);
          const adapters = makeAdapters(behaviorById);

          const { result, unmount } = renderHook(() =>
            useVisibilityTest({
              adapters,
              getAvailability: () => ({ identifyEnabled: false, bleSupported: false }),
            }),
          );

          try {
            // Baseline: every card starts idle with no result.
            for (const d of devices) {
              const s = result.current.getState(d.id);
              expect(s.phase).toBe("idle");
              expect(s.result).toBeNull();
            }

            // Initiate the test on the targeted card only.
            act(() => {
              result.current.runTest(toDevice(target));
            });

            // While the target test is initiating/running, every other card is
            // untouched (Requirements 1.3, 2.6).
            for (const d of others) {
              const s = result.current.getState(d.id);
              expect(s.phase).toBe("idle");
              expect(s.result).toBeNull();
            }

            // Drive the target test to its terminal result (resolve or fail).
            await flush();

            // After the target resolves/fails, other cards remain unchanged.
            for (const d of others) {
              const s = result.current.getState(d.id);
              expect(s.phase).toBe("idle");
              expect(s.result).toBeNull();
            }

            // The target itself reached a terminal state (sanity: it did run).
            expect(result.current.getState(target.id).phase).toBe("done");

            // Every other card's Test_Action stays independently activatable
            // (Requirement 1.5): pick one other card, run it, and confirm it
            // progresses to its own terminal result without disturbing the
            // target's already-settled state.
            if (others.length > 0) {
              const other = others[0];
              const targetBefore = result.current.getState(target.id);

              act(() => {
                result.current.runTest(toDevice(other));
              });
              await flush();

              const otherState = result.current.getState(other.id);
              expect(otherState.phase).toBe("done");
              expect(otherState.result).not.toBeNull();

              // Running the other card did not mutate the target's state.
              const targetAfter = result.current.getState(target.id);
              expect(targetAfter.phase).toBe(targetBefore.phase);
              expect(targetAfter.result).toEqual(targetBefore.result);

              // And the remaining (un-run) cards are still idle.
              for (const d of others.slice(1)) {
                const s = result.current.getState(d.id);
                expect(s.phase).toBe("idle");
                expect(s.result).toBeNull();
              }
            }
          } finally {
            unmount();
            vi.clearAllTimers();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
