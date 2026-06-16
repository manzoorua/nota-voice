import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatLastSeen } from "./lastSeen";

// Feature: device-visibility-test, Property 18: Last-seen display is a faithful, pure derivation of last_seen_at

const NEVER_SEEN = "Never seen";

/** ISO 8601 UTC timestamp at second precision, e.g. "2024-06-01T12:34:56Z". */
const UTC_ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** The input instant truncated to whole seconds (matches the absolute rendering). */
function instantToSeconds(ms: number): number {
  return Math.trunc(ms / 1000) * 1000;
}

describe("formatLastSeen — Property 18: faithful, pure derivation of last_seen_at", () => {
  // Validates: Requirements 10.1, 10.2, 10.3, 10.5
  it("yields a relative string and an absolute UTC ISO 8601 instant when last_seen_at is present", () => {
    fc.assert(
      fc.property(
        // A valid check-in instant within a wide, realistic range...
        fc.date({
          min: new Date("1970-01-01T00:00:00Z"),
          max: new Date("2100-01-01T00:00:00Z"),
          noInvalidDate: true,
        }),
        // ...and an independent reference "now" in epoch ms.
        fc.integer({ min: 0, max: 4_102_444_800_000 }),
        (seenDate, nowMs) => {
          const lastSeenAt = seenDate.toISOString();
          const view = formatLastSeen(lastSeenAt, nowMs);

          // Present input is never treated as "never seen".
          expect(view.neverSeen).toBe(false);

          // A non-empty relative elapsed-time string is produced (Requirement 10.2).
          expect(typeof view.relative).toBe("string");
          expect(view.relative.length).toBeGreaterThan(0);
          expect(view.relative).not.toBe(NEVER_SEEN);

          // An absolute UTC ISO 8601 timestamp is produced (Requirement 10.3).
          expect(view.absolute).not.toBeNull();
          expect(view.absolute as string).toMatch(UTC_ISO_SECONDS);

          // The absolute value equals the input instant (to second precision,
          // which is the rendering's granularity) (Requirements 10.1, 10.5).
          expect(new Date(view.absolute as string).getTime()).toBe(
            instantToSeconds(seenDate.getTime()),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Validates: Requirement 10.4
  it("yields the Never_Seen_Indicator with no absolute value when last_seen_at is null/absent", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<null | undefined>(null, undefined),
        fc.integer({ min: 0, max: 4_102_444_800_000 }),
        (absent, nowMs) => {
          const view = formatLastSeen(absent, nowMs);

          expect(view.neverSeen).toBe(true);
          expect(view.relative).toBe(NEVER_SEEN);
          expect(view.absolute).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Validates: Requirements 10.1–10.5 (purity) — output depends only on inputs.
  it("is pure: identical inputs always produce identical output", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc
            .date({
              min: new Date("1970-01-01T00:00:00Z"),
              max: new Date("2100-01-01T00:00:00Z"),
              noInvalidDate: true,
            })
            .map((d) => d.toISOString() as string | null),
          fc.constant<null>(null),
        ),
        fc.integer({ min: 0, max: 4_102_444_800_000 }),
        (lastSeenAt, nowMs) => {
          const a = formatLastSeen(lastSeenAt, nowMs);
          const b = formatLastSeen(lastSeenAt, nowMs);
          expect(a).toEqual(b);
        },
      ),
      { numRuns: 100 },
    );
  });
});
