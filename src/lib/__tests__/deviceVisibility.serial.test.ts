import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { serialMatches, normalizeSerial } from "../deviceVisibility";

/**
 * Property-based tests for BLE serial matching in the Device Visibility Test feature.
 *
 * Validates that `serialMatches` is exact, case-insensitive equality of the full
 * canonical `PEN-`<12 hex> serial, backed by `normalizeSerial`.
 */

// A single hexadecimal character (lowercase); cases are randomized separately.
const hexChar = fc.constantFrom(
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "a", "b", "c", "d", "e", "f",
);

/** A 12-character hex body (the canonical serial payload). */
const hexBody12 = fc.array(hexChar, { minLength: 12, maxLength: 12 }).map((cs) => cs.join(""));

/** Randomly upper/lower-case each character of a string. */
function randomCase(body: string): fc.Arbitrary<string> {
  return fc
    .array(fc.boolean(), { minLength: body.length, maxLength: body.length })
    .map((flags) =>
      body
        .split("")
        .map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join(""),
    );
}

/**
 * Build an arbitrary textual representation of a given 12-hex body that still
 * normalizes to the same canonical serial: randomized case, optional `PEN-`
 * prefix (in any case), and optional surrounding whitespace.
 */
function representationOf(body: string): fc.Arbitrary<string> {
  return fc.record({
    casedBody: randomCase(body),
    includePrefix: fc.boolean(),
    prefixCased: fc.boolean(),
    lead: fc.constantFrom("", " ", "  ", "\t"),
    trail: fc.constantFrom("", " ", "  ", "\t"),
  }).map(({ casedBody, includePrefix, prefixCased, lead, trail }) => {
    const prefix = includePrefix ? (prefixCased ? "PEN-" : "pen-") : "";
    return `${lead}${prefix}${casedBody}${trail}`;
  });
}

describe("Property 10: Serial matching is exact, case-insensitive equality", () => {
  // Feature: device-visibility-test, Property 10: Serial matching is exact, case-insensitive equality
  it("matches true iff both inputs normalize to the same canonical PEN-<12 hex> value", () => {
    fc.assert(
      fc.property(
        hexBody12.chain((body) =>
          fc.tuple(fc.constant(body), representationOf(body), representationOf(body)),
        ),
        ([body, repA, repB]) => {
          const canonical = `PEN-${body.toUpperCase()}`;
          // Both representations normalize to the same canonical serial...
          expect(normalizeSerial(repA)).toBe(canonical);
          expect(normalizeSerial(repB)).toBe(canonical);
          // ...therefore they match, regardless of case/prefix/whitespace differences.
          expect(serialMatches(repA, repB)).toBe(true);
          // Matching is symmetric.
          expect(serialMatches(repB, repA)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: device-visibility-test, Property 10: Serial matching is exact, case-insensitive equality
  it("any character difference in the serial body yields false", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(hexBody12, hexBody12)
          .filter(([a, b]) => a.toUpperCase() !== b.toUpperCase()),
        ([bodyA, bodyB]) => {
          // Distinct canonical serials never match, in either direction.
          expect(serialMatches(`PEN-${bodyA}`, `PEN-${bodyB}`)).toBe(false);
          expect(serialMatches(`PEN-${bodyB}`, `PEN-${bodyA}`)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: device-visibility-test, Property 10: Serial matching is exact, case-insensitive equality
  it("a non-normalizable serial never matches any input", () => {
    // Strings that cannot normalize to a valid PEN-<12 hex> serial.
    const invalidSerial = fc
      .string()
      .filter((s) => normalizeSerial(s) === null);

    fc.assert(
      fc.property(invalidSerial, hexBody12, (bad, body) => {
        const good = `PEN-${body}`;
        expect(serialMatches(bad, good)).toBe(false);
        expect(serialMatches(good, bad)).toBe(false);
        // Two invalid serials also never match (no canonical value to share).
        expect(serialMatches(bad, bad)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
