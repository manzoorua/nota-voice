// Feature: device-visibility-test, Property 13: Identify acknowledgment before timeout yields Visible
//
// Property-based test for Task 4.9.
//
// Property 13: Identify acknowledgment before timeout yields Visible.
//   For any enabled Identify_Ping, if the pen acknowledges the queued identify
//   command on a check-in occurring before Test_Timeout, the card resolves to
//   Visible.
//
// Validates: Requirements 4.4
//
// Strategy: Vitest fake timers + RTL renderHook drive the hook deterministically.
// We force the `identify` mechanism, inject a `queueIdentify` that resolves
// `{ queued: true }` and a `waitForIdentifyAck` that resolves
// `{ acknowledged: true }` at some delay strictly before Test_Timeout. After
// advancing the fake clock past that ack delay (but within the cap), the card
// must be terminal `Visible` and carry the canonical full serial
// (PEN- + 12 uppercase hex).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import fc from "fast-check";

import {
  useVisibilityTest,
  type VisibilityTestAdapters,
  type VisibilityTestDevice,
} from "@/hooks/useVisibilityTest";
import { TEST_TIMEOUT_MS, normalizeSerial } from "@/lib/deviceVisibility";

const CANONICAL_SERIAL = /^PEN-[0-9A-F]{12}$/;

// Generators ----------------------------------------------------------------

// Mix upper/lower hex so the test also exercises serial canonicalization to
// uppercase on the Visible result (Requirement 8.1, exercised via Property 13's
// Visible mapping).
const hexChar = fc.constantFrom(..."0123456789abcdefABCDEF".split(""));

const arbDevice: fc.Arbitrary<VisibilityTestDevice> = fc.record({
  id: fc.uuid(),
  device_serial: fc
    .array(hexChar, { minLength: 12, maxLength: 12 })
    .map((chars) => `PEN-${chars.join("")}`),
  // Identify_Ping is firmware-enabled for this device (assumption A2).
  identifyEnabled: fc.constant(true),
});

// Ack arrives strictly before the hard cap. Keep a margin from the boundary so
// the deterministic ordering is unambiguous.
const arbAckDelay = fc.integer({ min: 0, max: TEST_TIMEOUT_MS - 1 });

describe("useVisibilityTest — Property 13: identify ack before timeout yields Visible", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("resolves to Visible carrying the canonical serial when the pen acknowledges before the timeout", async () => {
    await fc.assert(
      fc.asyncProperty(arbDevice, arbAckDelay, async (device, ackDelayMs) => {
        const adapters: Partial<VisibilityTestAdapters> = {
          // The identify command is successfully queued for delivery.
          queueIdentify: () => Promise.resolve({ queued: true }),
          // The pen acknowledges on a check-in occurring before Test_Timeout.
          waitForIdentifyAck: () =>
            new Promise<{ acknowledged: boolean }>((resolve) => {
              setTimeout(() => resolve({ acknowledged: true }), ackDelayMs);
            }),
        };

        const { result, unmount } = renderHook(() =>
          useVisibilityTest({ adapters }),
        );

        // Force the identify mechanism for this card.
        await act(async () => {
          result.current.runTest(device, "identify");
        });

        // The in-progress indicator is set synchronously on activation.
        expect(result.current.getState(device.id).phase).toBe("running");

        // Advance just past the ack delay (still within the hard cap) so the
        // acknowledgment settles before the timeout could fire.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(ackDelayMs + 1);
        });

        const state = result.current.getState(device.id);

        // The card resolves to a terminal Visible result.
        expect(state.phase).toBe("done");
        expect(state.result).not.toBeNull();
        expect(state.result!.status).toBe("Visible");

        // A Visible result carries the canonical full serial (PEN- + 12 upper hex).
        expect(state.result!.serial).toBe(normalizeSerial(device.device_serial));
        expect(state.result!.serial).toMatch(CANONICAL_SERIAL);

        unmount();
        vi.clearAllTimers();
      }),
      { numRuns: 100 },
    );
  });
});
