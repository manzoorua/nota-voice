// Feature: device-visibility-test, Property 4: Errors and inconclusive paths map to Unknown
//
// Property 4 (design.md §"Correctness Properties"):
//   For any mechanism that throws, fails to respond, has its permission
//   denied/cancelled, or cannot reach a conclusion, the test resolves to
//   `Unknown` with an explanation describing the cause (e.g. "could not be
//   completed", "could not be sent", "did not respond", "permission not
//   granted", "cloud reachability could not be determined", "must be claimed").
//
// Validates: Requirements 2.7, 3.6, 4.3, 4.5, 5.6, 6.2, 6.3, 6.5, 7.3
//
// Strategy: drive the `useVisibilityTest` orchestration hook with injected stub
// adapters that throw, deny permission, never respond, or return inconclusive
// results, across every error/inconclusive branch of the state machine. Fake
// timers make the hard `Test_Timeout` and per-mechanism never-respond paths
// deterministic; React Testing Library's `renderHook` exercises the real hook.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import fc from "fast-check";
import {
  useVisibilityTest,
  type UseVisibilityTestOptions,
  type VisibilityTestAdapters,
  type VisibilityTestDevice,
} from "@/hooks/useVisibilityTest";
import {
  TEST_TIMEOUT_MS,
  type Mechanism,
} from "@/lib/deviceVisibility";

const MAX_EXPLANATION_LEN = 200;

/** A promise that never settles — models a mechanism that never responds. */
function never<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

/** A serial generator producing canonical `PEN-`<12 hex> values. */
const serialArb = fc
  .stringMatching(/^[0-9A-Fa-f]{12}$/)
  .map((hex) => `PEN-${hex}`);

/**
 * Each scenario describes one error/inconclusive branch and the adapter/option
 * shape that triggers it. `expectCause` is a lowercase substring that must
 * appear in the produced explanation so we assert the cause is described.
 */
interface Scenario {
  name: string;
  /** Mechanism to force; omit to let selection yield "no applicable mechanism". */
  mechanism?: Mechanism;
  adapters: Partial<VisibilityTestAdapters>;
  options?: Partial<UseVisibilityTestOptions>;
  expectCause: string;
}

function buildScenarios(): Scenario[] {
  return [
    // ---- Cloud_Liveness_Check (Requirements 3.6, 6.2, 7.3, 2.7) ----
    {
      name: "cloud: backend read throws",
      mechanism: "cloud",
      adapters: { fetchCloudLiveness: () => Promise.reject(new Error("boom")) },
      expectCause: "could not be completed",
    },
    {
      name: "cloud: backend never responds (hard timeout)",
      mechanism: "cloud",
      adapters: { fetchCloudLiveness: () => never() },
      expectCause: "cloud reachability could not be determined",
    },

    // ---- Identify_Ping (Requirements 4.3, 4.5) ----
    {
      name: "identify: queue throws",
      mechanism: "identify",
      adapters: { queueIdentify: () => Promise.reject(new Error("nope")) },
      expectCause: "could not be sent",
    },
    {
      name: "identify: queue rejected (not queued)",
      mechanism: "identify",
      adapters: { queueIdentify: () => Promise.resolve({ queued: false }) },
      expectCause: "could not be sent",
    },
    {
      name: "identify: queue never responds (timeout)",
      mechanism: "identify",
      adapters: { queueIdentify: () => never() },
      expectCause: "could not be sent",
    },
    {
      name: "identify: queued but no ack waiter available",
      mechanism: "identify",
      adapters: { queueIdentify: () => Promise.resolve({ queued: true }) },
      expectCause: "did not respond",
    },
    {
      name: "identify: ack waiter throws",
      mechanism: "identify",
      adapters: {
        queueIdentify: () => Promise.resolve({ queued: true }),
        waitForIdentifyAck: () => Promise.reject(new Error("ack fail")),
      },
      expectCause: "did not respond",
    },
    {
      name: "identify: pen does not acknowledge",
      mechanism: "identify",
      adapters: {
        queueIdentify: () => Promise.resolve({ queued: true }),
        waitForIdentifyAck: () => Promise.resolve({ acknowledged: false }),
      },
      expectCause: "did not respond",
    },
    {
      name: "identify: ack never arrives (timeout)",
      mechanism: "identify",
      adapters: {
        queueIdentify: () => Promise.resolve({ queued: true }),
        waitForIdentifyAck: () => never(),
      },
      expectCause: "did not respond",
    },

    // ---- BLE_Scan (Requirements 5.6, 7.3) ----
    {
      name: "ble: scan throws",
      mechanism: "ble",
      adapters: { scanForSerial: () => Promise.reject(new Error("ble boom")) },
      expectCause: "could not be completed",
    },
    {
      name: "ble: scan never responds (timeout)",
      mechanism: "ble",
      adapters: { scanForSerial: () => never() },
      expectCause: "timed out",
    },
    {
      name: "ble: permission denied/cancelled",
      mechanism: "ble",
      adapters: {
        scanForSerial: () =>
          Promise.resolve({ found: false, permissionDenied: true }),
      },
      expectCause: "permission was not granted",
    },

    // ---- No applicable mechanism (Requirements 6.3, 6.5) ----
    {
      name: "setup-mode device with no available mechanism",
      // No explicit mechanism: selection must yield none for a setup device
      // without Web Bluetooth.
      adapters: {},
      options: {
        deviceStateOf: () => "setup",
        getAvailability: () => ({ identifyEnabled: false, bleSupported: false }),
      },
      expectCause: "must be claimed",
    },
  ];
}

const SCENARIOS = buildScenarios();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("useVisibilityTest — Property 4: errors/inconclusive map to Unknown", () => {
  it("resolves every error/inconclusive branch to Unknown with a bounded, cause-describing explanation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...SCENARIOS),
        serialArb,
        fc.string({ minLength: 1, maxLength: 12 }),
        async (scenario, serial, idSuffix) => {
          const device: VisibilityTestDevice = {
            id: `dev-${idSuffix}`,
            device_serial: serial,
          };

          const { result, unmount } = renderHook(() =>
            useVisibilityTest({
              adapters: scenario.adapters,
              ...scenario.options,
            }),
          );

          try {
            await act(async () => {
              result.current.runTest(device, scenario.mechanism);
            });

            // Advance past the hard Test_Timeout so never-responding mechanisms
            // resolve, while flushing microtasks for the immediate paths.
            await act(async () => {
              await vi.advanceTimersByTimeAsync(TEST_TIMEOUT_MS + 1_000);
            });

            const state = result.current.getState(device.id);

            // The machine must reach a terminal, non-running state.
            expect(state.phase).toBe("done");
            expect(state.result).not.toBeNull();

            const res = state.result!;
            // Property 4 core: the outcome is Unknown.
            expect(res.status).toBe("Unknown");

            // Explanation is non-empty, bounded, and describes the cause.
            expect(res.explanation.length).toBeGreaterThan(0);
            expect(res.explanation.length).toBeLessThanOrEqual(
              MAX_EXPLANATION_LEN,
            );
            expect(res.explanation.toLowerCase()).toContain(
              scenario.expectCause,
            );

            // An Unknown result never presents a confirmed serial match.
            expect(res.serial).toBeUndefined();
          } finally {
            unmount();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
