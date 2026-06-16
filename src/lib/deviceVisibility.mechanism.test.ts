import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  selectMechanism,
  type DeviceState,
  type Mechanism,
  type MechanismAvailability,
} from "./deviceVisibility";

/**
 * Property-based test for the pure mechanism-selection decision logic.
 *
 * Feature: device-visibility-test, Property 9: Mechanism selection is correct for state and availability
 *
 * Validates: Requirements 4.1, 4.6, 5.1, 5.5, 6.1, 6.3, 6.4, 6.5
 *
 * Mechanism selection table (design.md):
 *
 * | Device state      | Identify enabled | Web Bluetooth | Default mechanism | Also offered      |
 * |-------------------|------------------|---------------|-------------------|-------------------|
 * | Claimed_Device    | yes              | any           | cloud             | identify, ble?    |
 * | Claimed_Device    | no               | any           | cloud             | ble?              |
 * | Setup_Mode_Device | n/a              | supported     | ble               | —                 |
 * | Setup_Mode_Device | n/a              | unsupported   | (none) -> Unknown | —                 |
 */

const stateArb: fc.Arbitrary<DeviceState> = fc.constantFrom("claimed", "setup");
const availArb: fc.Arbitrary<MechanismAvailability> = fc.record({
  identifyEnabled: fc.boolean(),
  bleSupported: fc.boolean(),
});

describe("Feature: device-visibility-test, Property 9: Mechanism selection is correct for state and availability", () => {
  it("chooses the correct default and offered set for every state/availability combination", () => {
    fc.assert(
      fc.property(stateArb, availArb, (state, avail) => {
        const { defaultMechanism, offered } = selectMechanism(state, avail);

        // The offered set must never contain duplicates.
        expect(new Set(offered).size).toBe(offered.length);

        // Every offered mechanism is a valid Mechanism value.
        const validMechanisms: Mechanism[] = ["cloud", "identify", "ble"];
        for (const m of offered) {
          expect(validMechanisms).toContain(m);
        }

        if (state === "claimed") {
          // Cloud_Liveness_Check is always the default for claimed devices (Req 6.1)
          // and is always offered.
          expect(defaultMechanism).toBe("cloud");
          expect(offered).toContain("cloud");

          // Identify_Ping offered iff enabled (Req 4.1, 4.6).
          expect(offered.includes("identify")).toBe(avail.identifyEnabled);

          // BLE_Scan offered iff Web Bluetooth supported (Req 5.1, 5.5).
          expect(offered.includes("ble")).toBe(avail.bleSupported);
        } else {
          // Setup-mode device.
          if (avail.bleSupported) {
            // BLE_Scan is the default and the only offered mechanism (Req 6.4, 5.1).
            expect(defaultMechanism).toBe("ble");
            expect(offered).toEqual(["ble"]);
          } else {
            // No applicable mechanism -> resolves to Unknown (Req 6.3, 6.5).
            expect(defaultMechanism).toBeNull();
            expect(offered).toEqual([]);
          }

          // Cloud and identify are never offered for setup-mode devices.
          expect(offered.includes("cloud")).toBe(false);
          expect(offered.includes("identify")).toBe(false);
        }

        // The default mechanism, when present, is always part of the offered set.
        if (defaultMechanism !== null) {
          expect(offered).toContain(defaultMechanism);
        }
      }),
      { numRuns: 100 },
    );
  });
});
