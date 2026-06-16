import { describe, it, expect } from "vitest";
import fc from "fast-check";

// Temporary smoke test verifying the property-based testing framework
// (Vitest + fast-check) is wired up and runs once via `npm test`.
describe("PBT framework smoke", () => {
  it("runs fast-check properties under vitest", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
      { numRuns: 100 },
    );
  });
});
