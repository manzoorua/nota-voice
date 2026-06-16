import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  resolveCloudLiveness,
  normalizeSerial,
  LIVENESS_WINDOW_MS,
  type VisibilityResult,
} from "../deviceVisibility";

/**
 * Property-based tests for the Device Visibility Test pure logic layer
 * (spec: device-visibility-test, task 1.6).
 *
 * Covers the result-producer guarantees of `resolveCloudLiveness`:
 *   - Property 3:  every produced result carries a bounded, non-empty explanation
 *   - Property 14: a Visible result carries the canonical full serial
 *   - Property 15: a Not_Visible result is not presented as a confirmed serial match
 *
 * fast-check + Vitest, numRuns: 100. Time is injected via `serverNowMs` so the
 * liveness-window boundary is exercised deterministically.
 */

const MAX_EXPLANATION_LEN = 200;
const CANONICAL_SERIAL_RE = /^PEN-[0-9A-F]{12}$/;

/** Epoch-ms range covering ~1970..~2106, kept positive and finite. */
const epochMsArb = fc.integer({ min: 0, max: 4_000_000_000_000 });

/** A valid serial body: exactly 12 lowercase hex chars. */
const hexBodyArb = fc
  .array(fc.constantFrom(..."0123456789abcdef".split("")), {
    minLength: 12,
    maxLength: 12,
  })
  .map((chars) => chars.join(""));

/**
 * A serial input that is guaranteed to normalize to a canonical serial. It
 * varies case and the optional `PEN-` prefix to mirror real-world inputs while
 * remaining a valid serial.
 */
const validSerialArb: fc.Arbitrary<string> = fc
  .record({
    body: hexBodyArb,
    upper: fc.boolean(),
    withPrefix: fc.boolean(),
    prefixUpper: fc.boolean(),
  })
  .map(({ body, upper, withPrefix, prefixUpper }) => {
    const casedBody = upper ? body.toUpperCase() : body.toLowerCase();
    if (!withPrefix) return casedBody;
    const prefix = prefixUpper ? "PEN-" : "pen-";
    return `${prefix}${casedBody}`;
  });

/** An arbitrary, possibly-invalid serial string (covers garbage inputs too). */
const anySerialArb: fc.Arbitrary<string> = fc.oneof(
  validSerialArb,
  fc.string(),
  fc.constant(""),
  fc.constant("PEN-"),
  fc.constant("PEN-XYZ"),
);

/** `last_seen_at` input: present ISO 8601 string, null, or an unparseable string. */
const lastSeenArb: fc.Arbitrary<string | null> = fc.oneof(
  epochMsArb.map((ms) => new Date(ms).toISOString()),
  fc.constant(null),
  fc.constant("not-a-timestamp"),
);

/** Liveness window in ms; includes 0 to cover the strict boundary case. */
const windowArb = fc.integer({ min: 0, max: LIVENESS_WINDOW_MS * 4 });

function assertBoundedExplanation(result: VisibilityResult): void {
  expect(typeof result.explanation).toBe("string");
  expect(result.explanation.trim().length).toBeGreaterThan(0);
  expect(result.explanation.length).toBeLessThanOrEqual(MAX_EXPLANATION_LEN);
}

describe("deviceVisibility result producer properties", () => {
  // Feature: device-visibility-test, Property 3: Every produced result carries a bounded, non-empty explanation
  it("Property 3: every resolveCloudLiveness result has a non-empty explanation of <= 200 chars", () => {
    fc.assert(
      fc.property(
        lastSeenArb,
        epochMsArb,
        anySerialArb,
        windowArb,
        (lastSeenAt, serverNowMs, serial, windowMs) => {
          const result = resolveCloudLiveness(
            lastSeenAt,
            serverNowMs,
            serial,
            windowMs,
          );
          assertBoundedExplanation(result);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: device-visibility-test, Property 14: A Visible result carries the canonical full serial
  it("Property 14: a Visible result carries the canonical PEN-<12 uppercase hex> serial", () => {
    fc.assert(
      fc.property(
        epochMsArb,
        fc.integer({ min: 0, max: LIVENESS_WINDOW_MS }),
        validSerialArb,
        windowArb,
        (lastSeenMs, ageWithinWindow, serial, windowMs) => {
          // Construct a server time so the check-in age is within the window,
          // forcing a Visible outcome.
          const clampedAge = Math.min(ageWithinWindow, windowMs);
          const lastSeenAt = new Date(lastSeenMs).toISOString();
          const serverNowMs = lastSeenMs + clampedAge;

          const result = resolveCloudLiveness(
            lastSeenAt,
            serverNowMs,
            serial,
            windowMs,
          );

          expect(result.status).toBe("Visible");
          expect(result.serial).toBeDefined();
          expect(result.serial).toMatch(CANONICAL_SERIAL_RE);
          // The carried serial is exactly the canonical form of the input.
          expect(result.serial).toBe(normalizeSerial(serial));
          assertBoundedExplanation(result);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: device-visibility-test, Property 15: A Not_Visible result is not presented as a confirmed serial match
  it("Property 15: a Not_Visible result never carries a confirmed serial match", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Stale check-in: age strictly greater than the window -> Not_Visible.
          fc.record({
            lastSeenMs: epochMsArb,
            extraAge: fc.integer({ min: 1, max: LIVENESS_WINDOW_MS * 4 }),
            windowMs: windowArb,
            serial: anySerialArb,
          }),
          // Never seen: absent last_seen_at -> Not_Visible.
          fc.record({
            lastSeenMs: fc.constant<null>(null),
            extraAge: fc.constant(0),
            windowMs: windowArb,
            serial: anySerialArb,
          }),
        ),
        (gen) => {
          const lastSeenAt =
            gen.lastSeenMs === null
              ? null
              : new Date(gen.lastSeenMs).toISOString();
          const serverNowMs =
            gen.lastSeenMs === null
              ? 1_000_000
              : gen.lastSeenMs + gen.windowMs + gen.extraAge;

          const result = resolveCloudLiveness(
            lastSeenAt,
            serverNowMs,
            gen.serial,
            gen.windowMs,
          );

          expect(result.status).toBe("Not_Visible");
          // A Not_Visible result must not present a confirmed serial match.
          expect(result.serial).toBeUndefined();
          assertBoundedExplanation(result);
        },
      ),
      { numRuns: 100 },
    );
  });
});
