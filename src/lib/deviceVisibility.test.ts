import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  resolveCloudLiveness,
  LIVENESS_WINDOW_MS,
} from "./deviceVisibility";

/**
 * Property-based tests for the pure Cloud_Liveness_Check decision logic.
 *
 * Feature: device-visibility-test, Property 2: Cloud liveness decision is correct
 * for all timestamps
 *
 * Validates: Requirements 3.2, 3.3, 3.4
 */

// Bounds chosen so every generated instant is a valid Date and so
// serverNow - age never underflows below the epoch. Whole-millisecond values
// round-trip exactly through Date(ms).toISOString() -> Date.parse(iso).
const MIN_MS = 0; // 1970-01-01T00:00:00.000Z
const MAX_MS = 4_102_444_800_000; // 2100-01-01T00:00:00.000Z

const serial = "PEN-70041DDBD424";
const canonicalSerial = "PEN-70041DDBD424";

describe("Feature: device-visibility-test, Property 2: Cloud liveness decision is correct for all timestamps", () => {
  it("returns Visible iff last_seen_at is present and age <= window", () => {
    fc.assert(
      fc.property(
        // window to use
        fc.integer({ min: 0, max: 10 * LIVENESS_WINDOW_MS }),
        // server "now"
        fc.integer({ min: MIN_MS + 10 * LIVENESS_WINDOW_MS, max: MAX_MS }),
        // age of the last check-in relative to serverNow (can be negative => future)
        fc.integer({ min: -LIVENESS_WINDOW_MS, max: 10 * LIVENESS_WINDOW_MS }),
        (windowMs, serverNowMs, ageMs) => {
          const lastSeenMs = serverNowMs - ageMs;
          const lastSeenIso = new Date(lastSeenMs).toISOString();

          const result = resolveCloudLiveness(
            lastSeenIso,
            serverNowMs,
            serial,
            windowMs,
          );

          // The function re-derives age from the parsed timestamp; recompute the
          // same way so the assertion matches its arithmetic exactly.
          const expectedAge = serverNowMs - Date.parse(lastSeenIso);

          if (expectedAge <= windowMs) {
            // Visible: status, canonical serial carried, ISO timestamp in text.
            expect(result.status).toBe("Visible");
            expect(result.serial).toBe(canonicalSerial);
            expect(result.explanation).toContain(lastSeenIso);
          } else {
            // Not_Visible: includes the last check-in time as UTC ISO 8601.
            expect(result.status).toBe("Not_Visible");
            expect(result.explanation).toContain(lastSeenIso);
            expect(result.serial).toBeUndefined();
          }

          // Explanation contract holds on every branch (Requirement 2.4).
          expect(result.explanation.length).toBeGreaterThan(0);
          expect(result.explanation.length).toBeLessThanOrEqual(200);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("treats the exact age === window boundary as Visible", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 * LIVENESS_WINDOW_MS }),
        fc.integer({ min: MIN_MS + 10 * LIVENESS_WINDOW_MS, max: MAX_MS }),
        (windowMs, serverNowMs) => {
          // age exactly equal to the window -> still Visible (<= boundary).
          const lastSeenMs = serverNowMs - windowMs;
          const lastSeenIso = new Date(lastSeenMs).toISOString();

          const atBoundary = resolveCloudLiveness(
            lastSeenIso,
            serverNowMs,
            serial,
            windowMs,
          );
          expect(atBoundary.status).toBe("Visible");

          // One millisecond past the window -> Not_Visible.
          const justOverIso = new Date(lastSeenMs - 1).toISOString();
          const overBoundary = resolveCloudLiveness(
            justOverIso,
            serverNowMs,
            serial,
            windowMs,
          );
          expect(overBoundary.status).toBe("Not_Visible");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("reports Not_Visible with a never-seen explanation when last_seen_at is absent", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_MS, max: MAX_MS }),
        fc.integer({ min: 0, max: 10 * LIVENESS_WINDOW_MS }),
        (serverNowMs, windowMs) => {
          const result = resolveCloudLiveness(null, serverNowMs, serial, windowMs);

          expect(result.status).toBe("Not_Visible");
          expect(result.serial).toBeUndefined();
          expect(result.explanation.toLowerCase()).toContain("never been seen");
          expect(result.explanation.length).toBeGreaterThan(0);
          expect(result.explanation.length).toBeLessThanOrEqual(200);
        },
      ),
      { numRuns: 100 },
    );
  });
});
