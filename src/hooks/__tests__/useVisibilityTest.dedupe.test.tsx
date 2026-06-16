import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { act, renderHook } from "@testing-library/react";
import {
  useVisibilityTest,
  type VisibilityTestAdapters,
  type VisibilityTestDevice,
} from "@/hooks/useVisibilityTest";

/**
 * Feature: device-visibility-test, Property 6: Same-card activation while running is ignored
 *
 * For any device with a test already in the `running` phase, additional
 * activations of that same card's Test_Action do not start a second concurrent
 * test (the running test instance is unique for that card).
 *
 * Validates: Requirements 1.6
 *
 * Strategy: drive the hook with a `cloud` mechanism whose adapter never
 * resolves, so the card stays in the `running` phase. The number of times the
 * adapter is invoked is the observable signal for "a test was started": a second
 * concurrent test would call the adapter again. Under fake timers we never
 * advance the clock, so the in-flight test stays running for the whole check.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Drain any pending timeout timers (the never-resolving promise's hard cap)
  // before restoring real timers so nothing leaks between property runs.
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("Feature: device-visibility-test, Property 6: Same-card activation while running is ignored", () => {
  it("ignores repeated runTest calls for a card whose test is already running", () => {
    fc.assert(
      fc.property(
        // A device id (registry key) and the number of extra activations to fire
        // after the test is already running.
        fc.uuid(),
        fc.integer({ min: 1, max: 12 }),
        (deviceId, extraActivations) => {
          // Count adapter invocations. The adapter never resolves, keeping the
          // card pinned in the `running` phase for the duration of the check.
          let cloudCalls = 0;
          const adapters: Partial<VisibilityTestAdapters> = {
            fetchCloudLiveness: (id: string) => {
              cloudCalls += 1;
              return new Promise(() => {
                // intentionally never settles
                void id;
              });
            },
          };

          const { result, unmount } = renderHook(() =>
            useVisibilityTest({ adapters }),
          );

          const device: VisibilityTestDevice = {
            id: deviceId,
            device_serial: "PEN-70041DDBD424",
          };

          try {
            // First activation: starts exactly one test (cloud is the default
            // mechanism for a claimed device).
            act(() => {
              result.current.runTest(device);
            });

            expect(result.current.getState(deviceId).phase).toBe("running");
            expect(cloudCalls).toBe(1);

            const startedAtMs = result.current.getState(deviceId).startedAtMs;

            // Subsequent activations while running must be ignored: no second
            // concurrent test, no restart of the in-flight one.
            for (let i = 0; i < extraActivations; i += 1) {
              act(() => {
                result.current.runTest(device);
              });
            }

            const finalState = result.current.getState(deviceId);
            // Still the single running test instance.
            expect(finalState.phase).toBe("running");
            // The adapter was invoked exactly once across all activations.
            expect(cloudCalls).toBe(1);
            // The running instance was not restarted (same start timestamp).
            expect(finalState.startedAtMs).toBe(startedAtMs);
          } finally {
            act(() => {
              unmount();
            });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
