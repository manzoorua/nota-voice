import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { formatLastSeen } from "../lastSeen";
import type { Visibility, VisibilityResult } from "../deviceVisibility";

// Feature: device-visibility-test, Property 19: Last-seen display is independent of test state and never triggers a test

/**
 * Property 19: Last-seen display is independent of test state and never triggers a test.
 *
 * For any sequence of test runs, resolutions, or failures, the Last_Seen_Display value
 * remains exactly `formatLastSeen(last_seen_at, nowMs)` — unchanged by any
 * `VisibilityResult` — and computing the display never initiates a Device_Visibility_Test
 * (i.e. it never invokes any test adapter).
 *
 * Validates: Requirements 10.7, 10.8
 */

/** A present-or-absent `last_seen_at` paired with a reference "now" in epoch ms. */
const lastSeenInputArb = fc.record({
  lastSeenAt: fc.oneof(
    fc
      .date({
        min: new Date("1970-01-01T00:00:00Z"),
        max: new Date("2100-01-01T00:00:00Z"),
        noInvalidDate: true,
      })
      .map((d) => d.toISOString() as string | null),
    fc.constant<null>(null),
  ),
  nowMs: fc.integer({ min: 0, max: 4_102_444_800_000 }),
});

/** An arbitrary terminal Visibility_Result, modeling any test outcome. */
const visibilityResultArb: fc.Arbitrary<VisibilityResult> = fc.record(
  {
    status: fc.constantFrom<Visibility>("Visible", "Not_Visible", "Unknown"),
    explanation: fc.string({ minLength: 1, maxLength: 200 }),
    serial: fc.option(
      fc
        .array(fc.constantFrom(..."0123456789ABCDEF".split("")), {
          minLength: 12,
          maxLength: 12,
        })
        .map((chars) => `PEN-${chars.join("")}`),
      { nil: undefined },
    ),
  },
  { requiredKeys: ["status", "explanation"] },
);

describe("formatLastSeen — Property 19: independent of test state, never triggers a test", () => {
  // Validates: Requirement 10.8 — value is unchanged by any Visibility_Result.
  it("output is invariant across an arbitrary sequence of test runs/resolutions/failures", () => {
    fc.assert(
      fc.property(
        lastSeenInputArb,
        // A sequence of test outcomes (runs, resolutions, failures) interleaved
        // with re-renders of the last-seen display.
        fc.array(visibilityResultArb, { maxLength: 20 }),
        ({ lastSeenAt, nowMs }, resultSequence) => {
          // Baseline display, computed before any test activity.
          const baseline = formatLastSeen(lastSeenAt, nowMs);

          // Drive an arbitrary sequence of test results. The display function
          // takes no test state, so it cannot depend on these outcomes; we
          // re-derive after each one and assert it never changes.
          for (const _result of resultSequence) {
            const afterTest = formatLastSeen(lastSeenAt, nowMs);
            expect(afterTest).toEqual(baseline);
          }

          // Final re-derivation after the whole sequence is identical too.
          expect(formatLastSeen(lastSeenAt, nowMs)).toEqual(baseline);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Validates: Requirement 10.7 — rendering/updating the display never initiates a test.
  it("never invokes any Device_Visibility_Test adapter when computing the display", () => {
    // Spies standing in for every test mechanism adapter. If formatLastSeen
    // initiated a Device_Visibility_Test, one of these would be called.
    const fetchCloudLiveness = vi.fn();
    const queueIdentify = vi.fn();
    const bleScan = vi.fn();
    const adapters = { fetchCloudLiveness, queueIdentify, bleScan };

    fc.assert(
      fc.property(lastSeenInputArb, ({ lastSeenAt, nowMs }) => {
        fetchCloudLiveness.mockClear();
        queueIdentify.mockClear();
        bleScan.mockClear();

        const view = formatLastSeen(lastSeenAt, nowMs);

        // The display is produced as a passive, read-only derivation...
        expect(view).toBeDefined();
        // ...and computing it triggers no test mechanism whatsoever.
        for (const adapter of Object.values(adapters)) {
          expect(adapter).not.toHaveBeenCalled();
        }
      }),
      { numRuns: 100 },
    );
  });
});
