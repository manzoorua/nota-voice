// Feature: device-visibility-test, Property 16: Running a test mutates no device state
//
// Property-based test for Task 4.10.
//
// Property 16: Running a test mutates no device state.
//   For any device and any test outcome, running the Device_Visibility_Test
//   issues no write to stored device-record fields other than the optional
//   test-outcome fields (and writes none at all in the ephemeral-state design)
//   and never alters the device's claim state, leaving the existing unpair
//   action enabled.
//
// Validates: Requirements 8.2, 8.3, 9.4, 9.5
//
// Strategy: Vitest fake timers + RTL renderHook drive the hook deterministically
// across every mechanism (cloud / identify / ble) and every terminal outcome
// (Visible / Not_Visible / Unknown via error / Unknown via timeout). The hook's
// adapter surface is read/queue only — there is NO write adapter — so the test
// asserts two complementary facts that together establish non-mutation:
//   1. The device object handed to the hook is byte-for-byte identical after the
//      test resolves (deep-frozen + deep-equal snapshot), so no device-record
//      field and no claim-state field is altered.
//   2. Every adapter the hook invokes receives only the device *id* (a string),
//      never the device object itself, so no adapter can reach back and mutate a
//      stored device-record field through the hook.
// Because the result state is client-side and ephemeral, the device is never
// written on any path (success or failure), which by construction keeps the
// existing fields and the unpair action intact.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import fc from "fast-check";

import {
  useVisibilityTest,
  type UseVisibilityTestOptions,
  type VisibilityTestAdapters,
  type VisibilityTestDevice,
} from "@/hooks/useVisibilityTest";
import { TEST_TIMEOUT_MS } from "@/lib/deviceVisibility";
import type {
  BleScanResult,
  CloudLivenessReading,
  IdentifyQueueResult,
} from "@/lib/deviceVisibilityAdapters";

type Mechanism = "cloud" | "identify" | "ble";
type Outcome = "visible" | "not-visible" | "error" | "timeout";

const TERMINAL = ["Visible", "Not_Visible", "Unknown"] as const;

// Recursively freeze an object so ANY mutation attempt throws in strict mode.
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    for (const value of Object.values(obj)) deepFreeze(value);
    Object.freeze(obj);
  }
  return obj;
}

// Resolve/settle helpers on the fake clock. `timeout` means "never settle in
// time" so the hard cap wins; `error` rejects; otherwise it settles fast.
function settleDelay(outcome: Outcome): number {
  return outcome === "timeout" ? 2 * TEST_TIMEOUT_MS : 5;
}

/**
 * Build adapter stubs for one mechanism/outcome. Each adapter records the
 * arguments it was called with so the test can assert it only ever received the
 * device id (a string) — never the device object.
 */
function makeAdapters(
  mechanism: Mechanism,
  outcome: Outcome,
  calls: unknown[][],
): { adapters: Partial<VisibilityTestAdapters>; options: UseVisibilityTestOptions } {
  const delay = settleDelay(outcome);

  const fetchCloudLiveness: VisibilityTestAdapters["fetchCloudLiveness"] = (
    ...args
  ) => {
    calls.push(args);
    return new Promise<CloudLivenessReading>((resolve, reject) => {
      setTimeout(() => {
        if (outcome === "error") return reject(new Error("read failed"));
        const now = Date.now();
        if (outcome === "visible") {
          resolve({ lastSeenAt: new Date(now).toISOString(), serverNowMs: now });
        } else {
          // not-visible: never seen
          resolve({ lastSeenAt: null, serverNowMs: now });
        }
      }, delay);
    });
  };

  const queueIdentify: VisibilityTestAdapters["queueIdentify"] = (...args) => {
    calls.push(args);
    return new Promise<IdentifyQueueResult>((resolve, reject) => {
      setTimeout(() => {
        if (outcome === "error") return reject(new Error("queue failed"));
        resolve({ queued: true });
      }, delay);
    });
  };

  const waitForIdentifyAck: NonNullable<
    VisibilityTestAdapters["waitForIdentifyAck"]
  > = (...args) => {
    calls.push(args);
    return new Promise<{ acknowledged: boolean }>((resolve) => {
      setTimeout(
        () => resolve({ acknowledged: outcome === "visible" }),
        outcome === "timeout" ? 2 * TEST_TIMEOUT_MS : delay,
      );
    });
  };

  const scanForSerial: VisibilityTestAdapters["scanForSerial"] = (...args) => {
    calls.push(args);
    return new Promise<BleScanResult>((resolve, reject) => {
      setTimeout(() => {
        if (outcome === "error") return reject(new Error("scan failed"));
        resolve({ found: outcome === "visible" });
      }, delay);
    });
  };

  const adapters: Partial<VisibilityTestAdapters> = {
    fetchCloudLiveness,
    queueIdentify,
    waitForIdentifyAck,
    scanForSerial,
  };

  // Enable identify + BLE so any mechanism is selectable.
  const options: UseVisibilityTestOptions = {
    adapters,
    getAvailability: () => ({ identifyEnabled: true, bleSupported: true }),
  };

  return { adapters, options };
}

// Generators ----------------------------------------------------------------

const hexChar = fc.constantFrom(..."0123456789ABCDEF".split(""));

// A device carrying the full set of stored fields a real `devices` row exposes,
// including claim-state markers (enrollment_method / is_claimed) we must not
// alter (Requirements 8.3, 9.4, 9.5).
const arbDevice: fc.Arbitrary<VisibilityTestDevice & Record<string, unknown>> =
  fc.record({
    id: fc.uuid(),
    device_serial: fc
      .array(hexChar, { minLength: 12, maxLength: 12 })
      .map((chars) => `PEN-${chars.join("")}`),
    enrollment_method: fc.constantFrom("pairing", "api_key"),
    is_claimed: fc.boolean(),
    identifyEnabled: fc.boolean(),
    display_name: fc.string(),
    firmware_version: fc.string(),
    last_seen_at: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
    last_battery_pct: fc.integer({ min: 0, max: 100 }),
    notes_synced_count: fc.integer({ min: 0, max: 9999 }),
    is_revoked: fc.boolean(),
  });

const arbMechanism = fc.constantFrom<Mechanism>("cloud", "identify", "ble");
const arbOutcome = fc.constantFrom<Outcome>(
  "visible",
  "not-visible",
  "error",
  "timeout",
);

describe("useVisibilityTest — Property 16: running a test mutates no device state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("never mutates the device object and never passes it to an adapter, on any mechanism/outcome", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbDevice,
        arbMechanism,
        arbOutcome,
        async (rawDevice, mechanism, outcome) => {
          // Snapshot the pristine device for a post-run deep-equality check, and
          // deep-freeze the live object so any write attempt would throw.
          const snapshot = JSON.parse(JSON.stringify(rawDevice));
          const device = deepFreeze(rawDevice) as VisibilityTestDevice;

          const calls: unknown[][] = [];
          const { options } = makeAdapters(mechanism, outcome, calls);

          const { result, unmount } = renderHook(() =>
            useVisibilityTest(options),
          );

          await act(async () => {
            result.current.runTest(device, mechanism);
          });

          // Drive the machine to a guaranteed terminal state.
          await act(async () => {
            await vi.advanceTimersByTimeAsync(TEST_TIMEOUT_MS + 1);
          });

          const state = result.current.getState(device.id);

          // The test resolved terminally (sanity: the run actually executed).
          expect(state.phase).toBe("done");
          expect(state.result).not.toBeNull();
          expect(TERMINAL).toContain(state.result!.status);

          // (1) Non-mutation: the device object is byte-for-byte unchanged, so no
          // device-record field and no claim-state field was written.
          expect(rawDevice).toEqual(snapshot);
          // Claim-state markers specifically preserved (Requirements 8.3, 9.4).
          expect((rawDevice as Record<string, unknown>).is_claimed).toBe(
            snapshot.is_claimed,
          );
          expect((rawDevice as Record<string, unknown>).enrollment_method).toBe(
            snapshot.enrollment_method,
          );

          // (2) No adapter ever received the device object — only a primitive
          // identifier (the device id for cloud/identify, the serial for BLE)
          // plus an optional AbortSignal — so nothing the hook calls can write a
          // stored device-record field through the hook.
          const allowedFirstArgs = new Set<unknown>([
            device.id,
            device.device_serial,
          ]);
          for (const args of calls) {
            expect(typeof args[0]).toBe("string");
            expect(allowedFirstArgs.has(args[0])).toBe(true);
            for (const arg of args) {
              // The device object itself is never handed to an adapter.
              expect(arg).not.toBe(device);
            }
          }

          unmount();
          vi.clearAllTimers();
        },
      ),
      { numRuns: 100 },
    );
  });
});
