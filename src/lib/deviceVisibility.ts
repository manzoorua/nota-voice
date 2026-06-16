/**
 * Pure decision logic for the Device Visibility Test feature.
 *
 * Every function in this module is side-effect free (no I/O, no clock reads):
 * timestamps and "now" are passed in so the logic is fully deterministic and
 * directly property-testable. See `.kiro/specs/device-visibility-test/design.md`
 * (section "1. Pure Logic Layer").
 */

/** Terminal outcome of a Device_Visibility_Test. */
export type Visibility = "Visible" | "Not_Visible" | "Unknown";

export interface VisibilityResult {
  status: Visibility;
  /** Human-readable basis for the result, non-empty and <= 200 chars (Requirement 2.4). */
  explanation: string;
  /** Full canonical serial echoed back only when Visible (Requirement 8.1). */
  serial?: string;
}

/** Whether a device is claimed/authenticated or still in setup mode. */
export type DeviceState = "claimed" | "setup";

/** The visibility-test mechanisms. */
export type Mechanism = "cloud" | "identify" | "ble";

export interface MechanismAvailability {
  /** Firmware capability for the Identify_Ping downlink (assumption A2). */
  identifyEnabled: boolean;
  /** Whether `navigator.bluetooth` is present for BLE_Scan (assumption A3). */
  bleSupported: boolean;
}

/** Liveness_Window default = 300 s; a check-in within this age reports Visible (A4). */
export const LIVENESS_WINDOW_MS = 300_000;

/** Test_Timeout default = 30 s; the overall hard cap for a single test (A4). */
export const TEST_TIMEOUT_MS = 30_000;

/** Maximum allowed length of any produced explanation (Requirement 2.4). */
const MAX_EXPLANATION_LEN = 200;

/** Pattern for a canonical serial: PEN- followed by exactly 12 hex chars. */
const SERIAL_BODY_RE = /^[0-9A-F]{12}$/;

/**
 * Clamp an explanation to the bounded, non-empty contract (Requirements 2.4, 8.5).
 * Never returns an empty string; truncates anything longer than 200 chars.
 */
function boundedExplanation(text: string): string {
  const trimmed = (text ?? "").trim();
  const safe = trimmed.length > 0 ? trimmed : "No additional detail available.";
  return safe.length > MAX_EXPLANATION_LEN
    ? safe.slice(0, MAX_EXPLANATION_LEN)
    : safe;
}

/**
 * Canonical Serial form: `PEN-` + 12 uppercase hexadecimal characters
 * (Requirement 8.1). Accepts input with or without the `PEN-` prefix and in any
 * case; surrounding whitespace is ignored. Returns null when the input cannot be
 * normalized to a valid serial.
 */
export function normalizeSerial(serial: string): string | null {
  if (typeof serial !== "string") return null;
  let body = serial.trim().toUpperCase();
  if (body.startsWith("PEN-")) {
    body = body.slice(4);
  }
  if (!SERIAL_BODY_RE.test(body)) return null;
  return `PEN-${body}`;
}

/**
 * Case-insensitive, character-for-character equality of two full `PEN-`<12 hex>
 * serials, used for BLE matching (Requirement 5.2). Returns true only when both
 * inputs normalize to the same canonical serial.
 */
export function serialMatches(cardSerial: string, advertisedSerial: string): boolean {
  const a = normalizeSerial(cardSerial);
  const b = normalizeSerial(advertisedSerial);
  return a !== null && b !== null && a === b;
}

/**
 * Parse an ISO 8601 timestamp string to epoch milliseconds, or null when the
 * value is absent or unparseable.
 */
function parseTimestampMs(value: string | null): number | null {
  if (value == null) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Cloud_Liveness_Check decision (Requirement 3). Pure: takes the last check-in
 * timestamp, the server's notion of "now", the device serial, and the window,
 * then returns the result with no I/O.
 *
 * - Visible when `lastSeenAt` is present and its age (serverNow - lastSeenAt) is
 *   <= the window. The Visible result carries the canonical full serial.
 * - Not_Visible when the age exceeds the window, including the last check-in time
 *   formatted as a UTC ISO 8601 timestamp in the explanation (Requirement 3.3).
 * - Not_Visible with a "never seen" explanation when `lastSeenAt` is absent
 *   (Requirement 3.4).
 */
export function resolveCloudLiveness(
  lastSeenAt: string | null,
  serverNowMs: number,
  serial: string,
  windowMs: number = LIVENESS_WINDOW_MS,
): VisibilityResult {
  const lastSeenMs = parseTimestampMs(lastSeenAt);

  // Absent (or unparseable) check-in -> never seen (Requirement 3.4).
  if (lastSeenMs === null) {
    return {
      status: "Not_Visible",
      explanation: boundedExplanation(
        "This pen has never been seen: no cloud check-in has been recorded.",
      ),
    };
  }

  const ageMs = serverNowMs - lastSeenMs;
  const lastSeenIso = new Date(lastSeenMs).toISOString();

  // Within the liveness window -> Visible, carrying the canonical serial
  // (Requirements 3.2, 8.1). Negative age (future timestamp) is also within window.
  if (ageMs <= windowMs) {
    const canonical = normalizeSerial(serial);
    return {
      status: "Visible",
      explanation: boundedExplanation(
        `Pen checked in recently (last check-in ${lastSeenIso}); reported as online.`,
      ),
      serial: canonical ?? undefined,
    };
  }

  // Older than the window -> Not_Visible with the UTC ISO 8601 last check-in
  // time in the explanation (Requirement 3.3).
  return {
    status: "Not_Visible",
    explanation: boundedExplanation(
      `No recent check-in. Last check-in was ${lastSeenIso}.`,
    ),
  };
}

/**
 * Default mechanism + offered set for a device, per the design's mechanism
 * selection table (Requirement 6).
 *
 * - Claimed devices always default to Cloud_Liveness_Check (Requirement 6.1).
 *   Identify_Ping is offered only when enabled (Requirements 4.1, 4.6); BLE_Scan
 *   is offered whenever Web Bluetooth is supported (Requirement 5.1).
 * - Setup-mode devices default to BLE_Scan when supported (Requirement 6.4) and
 *   yield no applicable mechanism otherwise (Requirements 6.3, 6.5).
 */
export function selectMechanism(
  state: DeviceState,
  avail: MechanismAvailability,
): { defaultMechanism: Mechanism | null; offered: Mechanism[] } {
  if (state === "claimed") {
    const offered: Mechanism[] = ["cloud"];
    if (avail.identifyEnabled) offered.push("identify");
    if (avail.bleSupported) offered.push("ble");
    return { defaultMechanism: "cloud", offered };
  }

  // setup-mode device
  if (avail.bleSupported) {
    return { defaultMechanism: "ble", offered: ["ble"] };
  }
  return { defaultMechanism: null, offered: [] };
}
