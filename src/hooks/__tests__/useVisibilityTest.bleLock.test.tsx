// Feature: device-visibility-test, Property 12: BLE scan is a global singleton
//
// Property-based test for Task 4.8.
//
// Property 12: BLE scan is a global singleton.
//   For any in-progress BLE_Scan on any card, a new BLE_Scan request for any
//   card is rejected with an "already running" indication, and at most one BLE
//   scan is active at any time.
//
// Validates: Requirements 5.7
//
// Strategy: Vitest fake timers + RTL renderHook drive the hook deterministically.
// We force the `ble` mechanism on every card (and provide a getAvailability that
// reports bleSupported=true so the BLE path is selectable regardless of the
// jsdom environment). The injected scan adapter never settles on its own — it
// only finishes when its AbortSignal fires — so the first scan stays in flight
// while we attempt concurrent scans on the other cards. The adapter also tracks
// how many scans are simultaneously active to assert the singleton invariant.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import fc from "fast-check";

import {
  useVisibilityTest,
  type VisibilityTestAdapters,
  type VisibilityTestDevice,
} from "@/hooks/useVisibilityTest";
import { TEST_TIMEOUT_MS } from "@/lib/deviceVisibility";
import type { BleScanResult } from "@/lib/deviceVisibilityAdapters";

/**
 * A controllable BLE scan adapter. Each invocation increments an "active"
 * counter (tracking the maximum simultaneous concurrency) and returns a promise
 * that never resolves on its own — it only rejects when its AbortSignal fires
 * (timeout or cancel). This lets a scan stay "in flight" deterministically.
 */
function makeScanController() {
  let active = 0;
  let maxActive = 0;
  let callCount = 0;

  const scanForSerial: VisibilityTestAdapters["scanForSerial"] = (
    _serial: string,
    signal: AbortSignal,
  ): Promise<BleScanResult> => {
    callCount += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    return new Promise<BleScanResult>((_resolve, reject) => {
      const onAbort = () => {
        active -= 1;
        reject(new Error("scan aborted"));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
      // Otherwise never settles on its own — stays in flight.
    });
  };

  return {
    scanForSerial,
    get callCount() {
      return callCount;
    },
    get maxActive() {
      return maxActive;
    },
  };
}

// Generators ----------------------------------------------------------------

const hexChar = fc.constantFrom(..."0123456789ABCDEF".split(""));

const arbSerial = fc
  .array(hexChar, { minLength: 12, maxLength: 12 })
  .map((chars) => `PEN-${chars.join("")}`);

/** Two to five distinct device cards (unique ids so each is its own card). */
const arbDevices: fc.Arbitrary<VisibilityTestDevice[]> = fc
  .uniqueArray(fc.uuid(), { minLength: 2, maxLength: 5 })
  .chain((ids) =>
    fc.tuple(...ids.map(() => arbSerial)).map((serials) =>
      ids.map((id, i) => ({ id, device_serial: serials[i] })),
    ),
  );

// Flush pending microtasks so synchronously-produced results are applied.
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("useVisibilityTest — Property 12: BLE scan is a global singleton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("rejects concurrent BLE scans with an 'already running' Unknown result and keeps at most one active", async () => {
    await fc.assert(
      fc.asyncProperty(arbDevices, async (devices) => {
        const scan = makeScanController();
        const { result, unmount } = renderHook(() =>
          useVisibilityTest({
            adapters: { scanForSerial: scan.scanForSerial },
            getAvailability: () => ({
              identifyEnabled: false,
              bleSupported: true,
            }),
          }),
        );

        // Start a BLE scan on the first card. It stays in flight (the adapter
        // never settles on its own), so the global BLE lock is held.
        await act(async () => {
          result.current.runTest(devices[0], "ble");
        });
        expect(result.current.getState(devices[0].id).phase).toBe("running");

        // Every concurrent BLE scan on a *different* card is rejected with an
        // "already running" Unknown result (Requirement 5.7).
        for (let i = 1; i < devices.length; i += 1) {
          await act(async () => {
            result.current.runTest(devices[i], "ble");
          });
          await flush();

          const state = result.current.getState(devices[i].id);
          expect(state.phase).toBe("done");
          expect(state.result).not.toBeNull();
          expect(state.result!.status).toBe("Unknown");
          expect(state.result!.explanation.toLowerCase()).toContain(
            "already running",
          );
        }

        // The rejected scans never reached the actual scan adapter: only the
        // first card's scan was ever started.
        expect(scan.callCount).toBe(1);
        // At most one BLE scan is active at any time.
        expect(scan.maxActive).toBeLessThanOrEqual(1);
        // The first card is still running (its scan remains in flight).
        expect(result.current.getState(devices[0].id).phase).toBe("running");

        // Release the lock by letting the in-flight scan hit the hard timeout.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(TEST_TIMEOUT_MS);
        });
        expect(result.current.getState(devices[0].id).phase).toBe("done");

        // With the lock released, a fresh BLE scan is permitted again — the
        // adapter is invoked a second time and concurrency still never exceeds 1.
        await act(async () => {
          result.current.runTest(devices[0], "ble");
        });
        expect(result.current.getState(devices[0].id).phase).toBe("running");
        expect(scan.callCount).toBe(2);
        expect(scan.maxActive).toBeLessThanOrEqual(1);

        unmount();
        vi.clearAllTimers();
      }),
      { numRuns: 100 },
    );
  });
});
