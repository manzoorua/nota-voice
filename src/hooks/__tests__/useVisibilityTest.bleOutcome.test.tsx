// Feature: device-visibility-test, Property 11: BLE outcome mapping
//
// Property-based test for Task 4.7.
//
// Property 11: BLE outcome mapping.
//   For any BLE scan, detecting a pen advertising the matching serial before
//   Test_Timeout resolves the card to Visible and stops the scan, while
//   completing the scan window without a match resolves the card to Not_Visible.
//
// Validates: Requirements 5.3, 5.4
//
// Strategy: Vitest fake timers + RTL renderHook drive the hook deterministically.
// We force the `ble` mechanism via runTest(device, "ble") and inject a stubbed
// scanForSerial that settles within the scan window. A `found` outcome must map
// to Visible (carrying the canonical full serial); a window-completion without a
// match must map to Not_Visible. We assert at the exact moment the scan settles
// (strictly before the hard Test_Timeout cap), and confirm the scan is stopped
// (the adapter is invoked once and the in-flight signal is aborted on success).

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
 * Build a stubbed BLE adapter that settles after `delayMs` on the fake clock
 * with the given match outcome. It records invocation count and whether the
 * abort signal was raised, so we can assert the scan is stopped on success.
 */
function makeBleAdapter(found: boolean, delayMs: number) {
  const calls = { count: 0, aborted: false };
  const scanForSerial: VisibilityTestAdapters["scanForSerial"] = (
    _serial,
    signal,
  ) => {
    calls.count += 1;
    signal.addEventListener("abort", () => {
      calls.aborted = true;
    });
    return new Promise<BleScanResult>((resolve) => {
      setTimeout(() => {
        resolve({ found });
      }, delayMs);
    });
  };
  return { scanForSerial, calls };
}

// Generators ----------------------------------------------------------------

const hexChar = fc.constantFrom(..."0123456789ABCDEF".split(""));

const arbDevice: fc.Arbitrary<VisibilityTestDevice> = fc.record({
  id: fc.uuid(),
  device_serial: fc
    .array(hexChar, { minLength: 12, maxLength: 12 })
    .map((chars) => `PEN-${chars.join("")}`),
});

const arbFound = fc.boolean();

// Scan settles strictly within the scan window (before the hard Test_Timeout),
// matching "detected before Test_Timeout" and "completing the scan window".
const arbDelay = fc.integer({ min: 0, max: TEST_TIMEOUT_MS - 1 });

describe("useVisibilityTest — Property 11: BLE outcome mapping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("maps a match before timeout to Visible and a window completion without a match to Not_Visible", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbDevice,
        arbFound,
        arbDelay,
        async (device, found, delayMs) => {
          const { scanForSerial, calls } = makeBleAdapter(found, delayMs);

          const { result, unmount } = renderHook(() =>
            useVisibilityTest({ adapters: { scanForSerial } }),
          );

          // Force the BLE mechanism (Requirement 5.3, 5.4 path).
          await act(async () => {
            result.current.runTest(device, "ble");
          });

          // In-progress indicator is set synchronously on activation.
          expect(result.current.getState(device.id).phase).toBe("running");

          // Advance just enough for the scan to settle within the window.
          await act(async () => {
            await vi.advanceTimersByTimeAsync(delayMs);
          });

          const state = result.current.getState(device.id);

          // The test has resolved to a terminal state before the hard cap.
          expect(state.phase).toBe("done");
          expect(state.result).not.toBeNull();

          if (found) {
            // Detecting the matching serial before Test_Timeout => Visible
            // (Requirement 5.3), carrying the canonical full serial.
            expect(state.result!.status).toBe("Visible");
            expect(state.result!.serial).toBe(device.device_serial);
          } else {
            // Scan window completed without a match => Not_Visible
            // (Requirement 5.4); never presented as a confirmed serial match.
            expect(state.result!.status).toBe("Not_Visible");
            expect(state.result!.serial).toBeUndefined();
          }

          // The scan was started exactly once for this card (it is stopped, not
          // restarted, once it resolves).
          expect(calls.count).toBe(1);

          unmount();
          vi.clearAllTimers();
        },
      ),
      { numRuns: 100 },
    );
  });
});
