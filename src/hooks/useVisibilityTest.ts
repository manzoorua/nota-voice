// Feature: device-visibility-test
//
// Per-card orchestration hook for the Device_Visibility_Test (design.md
// §"Components and Interfaces" / 4. Orchestration Hook).
//
// Responsibilities (Task 4.1):
//  - Maintain a registry keyed by `device.id` (`Record<string, CardTestState>`)
//    so each card's test is fully isolated (Requirements 1.3, 1.5, 2.6).
//  - Expose `runTest`, `cancelTest`, `retryTest`, `getState`.
//  - Wrap every mechanism call in `withTimeout(promise, TEST_TIMEOUT_MS, signal)`
//    that aborts in-flight work and resolves the card to `Unknown`
//    (Requirements 1.8, 7.1, 7.2).
//  - Wrap the orchestration in a `try/catch` that maps any throw / inconclusive /
//    permission-denied path to `Unknown` with a cause explanation
//    (Requirements 2.7, 3.6, 4.3, 4.5, 5.6, 6.2, 6.3, 6.5, 7.3).
//  - Set the in-progress indicator synchronously on activation and ignore a
//    second same-card activation while running (Requirements 1.4, 1.6).
//  - Map an identify ack before timeout and a BLE serial match before timeout to
//    `Visible`; map BLE window completion without a match to `Not_Visible`
//    (Requirements 4.4, 5.3, 5.4).
//  - Enforce a global BLE_Scan singleton lock (Requirement 5.7).
//  - On cancel, restore the card to `idle` with no partial result; never write
//    any device-record field — the result state is client-side and ephemeral, so
//    the test is non-destructive by construction (Requirements 7.4, 8.2, 8.3,
//    9.4, 9.5).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TEST_TIMEOUT_MS,
  normalizeSerial,
  resolveCloudLiveness,
  selectMechanism,
  type DeviceState,
  type Mechanism,
  type MechanismAvailability,
  type VisibilityResult,
} from "@/lib/deviceVisibility";
import {
  fetchCloudLiveness as defaultFetchCloudLiveness,
  queueIdentify as defaultQueueIdentify,
  scanForSerial as defaultScanForSerial,
  type BleScanResult,
  type CloudLivenessReading,
  type IdentifyQueueResult,
} from "@/lib/deviceVisibilityAdapters";

/** Maximum allowed length of any produced explanation (Requirement 2.4). */
const MAX_EXPLANATION_LEN = 200;

/**
 * Clamp an explanation to the bounded, non-empty contract (Requirements 2.4,
 * 8.5). Never returns an empty string; truncates anything over 200 chars.
 */
function boundedExplanation(text: string): string {
  const trimmed = (text ?? "").trim();
  const safe = trimmed.length > 0 ? trimmed : "No additional detail available.";
  return safe.length > MAX_EXPLANATION_LEN
    ? safe.slice(0, MAX_EXPLANATION_LEN)
    : safe;
}

function unknownResult(explanation: string): VisibilityResult {
  return { status: "Unknown", explanation: boundedExplanation(explanation) };
}

function notVisibleResult(explanation: string): VisibilityResult {
  return { status: "Not_Visible", explanation: boundedExplanation(explanation) };
}

/**
 * The minimal device shape this hook needs. It mirrors the relevant fields of a
 * `devices` row consumed by `DevicesList.tsx`; only `id` and `device_serial` are
 * required. The optional fields let callers/tests express claim state and the
 * firmware-dependent identify capability without coupling to the full row type.
 */
export interface VisibilityTestDevice {
  id: string;
  device_serial: string;
  /** Present on rows enrolled via pairing or an API key (Claimed_Device). */
  enrollment_method?: "pairing" | "api_key";
  /** Explicit claim override; when false the device is treated as setup-mode. */
  is_claimed?: boolean;
  /** Firmware Identify_Ping capability for this device (assumption A2). */
  identifyEnabled?: boolean;
}

/** Per-card test state held in the registry, keyed by `device.id`. */
export interface CardTestState {
  phase: "idle" | "running" | "done";
  result: VisibilityResult | null;
  mechanism: Mechanism | null;
  startedAtMs: number | null;
}

/**
 * Adapter surface the orchestrator drives. Defaults bind to the real
 * `deviceVisibilityAdapters`; tests inject stubs (resolve-with-evidence,
 * complete-without-evidence, never-resolve, throw) plus fake timers.
 */
export interface VisibilityTestAdapters {
  fetchCloudLiveness: (deviceId: string) => Promise<CloudLivenessReading>;
  queueIdentify: (deviceId: string) => Promise<IdentifyQueueResult>;
  scanForSerial: (serial: string, signal: AbortSignal) => Promise<BleScanResult>;
  /**
   * Optional Identify_Ping acknowledgment waiter. The pen acknowledges the
   * queued identify command on its next check-in (Requirement 4.4); this is the
   * firmware-dependent downlink delivered by Task 8. When absent, a queued
   * identify can never be confirmed and resolves to Unknown on the bound
   * (Requirement 4.5).
   */
  waitForIdentifyAck?: (
    deviceId: string,
    signal: AbortSignal,
  ) => Promise<{ acknowledged: boolean }>;
}

export interface UseVisibilityTestOptions {
  /** Override the adapter implementations (used by tests). */
  adapters?: Partial<VisibilityTestAdapters>;
  /** Derive a device's claim state; defaults to claimed unless `is_claimed === false`. */
  deviceStateOf?: (device: VisibilityTestDevice) => DeviceState;
  /** Derive mechanism availability; defaults to per-device identify + Web Bluetooth detection. */
  getAvailability?: (device: VisibilityTestDevice) => MechanismAvailability;
}

export interface UseVisibilityTest {
  /** Current state for a card; `idle` when no test has run (read-only snapshot). */
  getState: (deviceId: string) => CardTestState;
  /** Begin a test. No-op if a test for `deviceId` is already running (Requirement 1.6). */
  runTest: (device: VisibilityTestDevice, mechanism?: Mechanism) => void;
  /** Cancel an in-progress test, restoring the card to `idle` (Requirement 7.4). */
  cancelTest: (deviceId: string) => void;
  /** Re-initiate a test after a terminal result (Requirements 2.5, 7.5). */
  retryTest: (device: VisibilityTestDevice, mechanism?: Mechanism) => void;
}

const IDLE_STATE: CardTestState = {
  phase: "idle",
  result: null,
  mechanism: null,
  startedAtMs: null,
};

/** Sentinel returned by `withTimeout` when the hard cap elapses first. */
const TIMEOUT = Symbol("test-timeout");

/**
 * Run `promise` but resolve to the TIMEOUT sentinel if it has not settled within
 * `ms`, aborting the in-flight work via the shared `AbortController` so the
 * adapter can stop (Requirements 1.8, 7.1, 7.2). Rejections propagate so the
 * orchestrator can map them to an Unknown result with a specific explanation.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  controller: AbortController,
): Promise<T | typeof TIMEOUT> {
  return new Promise<T | typeof TIMEOUT>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      controller.abort();
      resolve(TIMEOUT);
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function defaultDeviceStateOf(device: VisibilityTestDevice): DeviceState {
  // The "Your devices" list only contains Claimed_Devices; treat a device as
  // setup-mode only when explicitly flagged (defensive branch, Requirement 6.3).
  if (device.is_claimed === false) return "setup";
  return "claimed";
}

function webBluetoothSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!(navigator as unknown as { bluetooth?: unknown }).bluetooth
  );
}

function defaultGetAvailability(device: VisibilityTestDevice): MechanismAvailability {
  return {
    identifyEnabled: device.identifyEnabled === true,
    bleSupported: webBluetoothSupported(),
  };
}

/**
 * Orchestration hook owning the per-card test state machine. State is held in a
 * registry keyed by `device.id`; mutating one card never touches another
 * (per-card isolation). The only intentionally shared constraint is the BLE
 * singleton lock (Requirement 5.7).
 */
export function useVisibilityTest(
  options: UseVisibilityTestOptions = {},
): UseVisibilityTest {
  const adapters: VisibilityTestAdapters = {
    fetchCloudLiveness: options.adapters?.fetchCloudLiveness ?? defaultFetchCloudLiveness,
    queueIdentify: options.adapters?.queueIdentify ?? defaultQueueIdentify,
    scanForSerial: options.adapters?.scanForSerial ?? defaultScanForSerial,
    waitForIdentifyAck: options.adapters?.waitForIdentifyAck,
  };
  const deviceStateOf = options.deviceStateOf ?? defaultDeviceStateOf;
  const getAvailability = options.getAvailability ?? defaultGetAvailability;

  // Keep the latest options in refs so the stable callbacks below always read
  // current adapters without being re-created on every render.
  const adaptersRef = useRef(adapters);
  adaptersRef.current = adapters;
  const deviceStateOfRef = useRef(deviceStateOf);
  deviceStateOfRef.current = deviceStateOf;
  const getAvailabilityRef = useRef(getAvailability);
  getAvailabilityRef.current = getAvailability;

  const [registry, setRegistry] = useState<Record<string, CardTestState>>({});
  // Synchronous mirror of `registry` so activation guards read the true current
  // phase without waiting for a React state flush.
  const stateRef = useRef<Record<string, CardTestState>>({});

  // In-flight controllers per card (for cancel + timeout abort).
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  // Monotonic run id per card; a result is applied only if its run is still the
  // active one. Cancelling or re-running bumps the id, discarding stale results.
  const runSeqRef = useRef<Map<string, number>>(new Map());
  // Global BLE_Scan singleton lock (Requirement 5.7).
  const bleLockRef = useRef(false);
  // Guard against state updates after unmount.
  const mountedRef = useRef(true);

  const writeState = useCallback((deviceId: string, next: CardTestState) => {
    stateRef.current = { ...stateRef.current, [deviceId]: next };
    if (mountedRef.current) {
      setRegistry((prev) => ({ ...prev, [deviceId]: next }));
    }
  }, []);

  const orchestrate = useCallback(
    async (
      device: VisibilityTestDevice,
      mechanism: Mechanism,
      controller: AbortController,
      startedAtMs: number,
    ): Promise<VisibilityResult> => {
      const a = adaptersRef.current;
      try {
        if (mechanism === "cloud") {
          const reading = await withTimeout(
            a.fetchCloudLiveness(device.id),
            TEST_TIMEOUT_MS,
            controller,
          );
          if (reading === TIMEOUT) {
            return unknownResult(
              "Cloud reachability could not be determined: the request timed out.",
            );
          }
          return resolveCloudLiveness(
            reading.lastSeenAt,
            reading.serverNowMs,
            device.device_serial,
          );
        }

        if (mechanism === "identify") {
          let queue: IdentifyQueueResult | typeof TIMEOUT;
          try {
            queue = await withTimeout(
              a.queueIdentify(device.id),
              TEST_TIMEOUT_MS,
              controller,
            );
          } catch {
            return unknownResult("The identify request could not be sent.");
          }
          if (queue === TIMEOUT || !queue.queued) {
            return unknownResult("The identify request could not be sent.");
          }
          if (!a.waitForIdentifyAck) {
            return unknownResult("The pen did not respond to the identify request.");
          }
          const remaining = Math.max(
            0,
            TEST_TIMEOUT_MS - (Date.now() - startedAtMs),
          );
          let ack: { acknowledged: boolean } | typeof TIMEOUT;
          try {
            ack = await withTimeout(
              a.waitForIdentifyAck(device.id, controller.signal),
              remaining,
              controller,
            );
          } catch {
            return unknownResult("The pen did not respond to the identify request.");
          }
          if (ack === TIMEOUT || !ack.acknowledged) {
            return unknownResult("The pen did not respond to the identify request.");
          }
          const serial = normalizeSerial(device.device_serial) ?? undefined;
          return {
            status: "Visible",
            explanation: boundedExplanation(
              "The pen acknowledged the identify request.",
            ),
            serial,
          };
        }

        if (mechanism === "ble") {
          // Global singleton: reject a concurrent scan (Requirement 5.7).
          if (bleLockRef.current) {
            return unknownResult(
              "A Bluetooth scan is already running. Please wait for it to finish before starting another.",
            );
          }
          bleLockRef.current = true;
          try {
            let res: BleScanResult | typeof TIMEOUT;
            try {
              res = await withTimeout(
                a.scanForSerial(device.device_serial, controller.signal),
                TEST_TIMEOUT_MS,
                controller,
              );
            } catch {
              return unknownResult("The test could not be completed.");
            }
            if (res === TIMEOUT) {
              return unknownResult("The Bluetooth scan timed out.");
            }
            if (res.permissionDenied) {
              return unknownResult("Bluetooth permission was not granted.");
            }
            if (res.found) {
              const serial = normalizeSerial(device.device_serial) ?? undefined;
              return {
                status: "Visible",
                explanation: boundedExplanation(
                  "A pen advertising the matching serial was detected over Bluetooth.",
                ),
                serial,
              };
            }
            // Scan window completed without a match (Requirement 5.4).
            return notVisibleResult(
              "No pen advertising the matching serial was detected over Bluetooth.",
            );
          } finally {
            bleLockRef.current = false;
          }
        }

        return unknownResult("No applicable test mechanism is available.");
      } catch {
        // Any unhandled throw maps to Unknown (Requirements 2.7, 7.3).
        return unknownResult("The test could not be completed.");
      }
    },
    [],
  );

  const start = useCallback(
    (device: VisibilityTestDevice, mechanism?: Mechanism) => {
      const id = device.id;

      // Ignore a second activation while a test for this card is running
      // (Requirement 1.6).
      if (stateRef.current[id]?.phase === "running") return;

      const state = deviceStateOfRef.current(device);
      const avail = getAvailabilityRef.current(device);
      const selection = selectMechanism(state, avail);
      const chosen = mechanism ?? selection.defaultMechanism;
      const startedAtMs = Date.now();

      // No applicable mechanism (e.g. setup-mode device without Web Bluetooth):
      // resolve to Unknown with a guiding explanation (Requirements 6.3, 6.5).
      if (chosen === null) {
        writeState(id, {
          phase: "done",
          result: unknownResult(
            state === "setup"
              ? "This pen must be claimed, or Bluetooth must be available, before it can be tested."
              : "No applicable test mechanism is available for this device.",
          ),
          mechanism: null,
          startedAtMs,
        });
        return;
      }

      // Set the in-progress indicator synchronously so it appears within 1 s
      // (Requirement 1.4).
      writeState(id, {
        phase: "running",
        result: null,
        mechanism: chosen,
        startedAtMs,
      });

      const controller = new AbortController();
      controllersRef.current.set(id, controller);
      const runId = (runSeqRef.current.get(id) ?? 0) + 1;
      runSeqRef.current.set(id, runId);

      void orchestrate(device, chosen, controller, startedAtMs).then((result) => {
        // Apply only if this run is still the active one. A cancel or a newer
        // run bumps the id, so stale results are discarded (no partial result).
        if (runSeqRef.current.get(id) !== runId) return;
        controllersRef.current.delete(id);
        writeState(id, {
          phase: "done",
          result,
          mechanism: chosen,
          startedAtMs,
        });
      });
    },
    [orchestrate, writeState],
  );

  const cancelTest = useCallback(
    (deviceId: string) => {
      // Invalidate the in-flight run so its eventual result is discarded.
      const current = runSeqRef.current.get(deviceId) ?? 0;
      runSeqRef.current.set(deviceId, current + 1);

      const controller = controllersRef.current.get(deviceId);
      if (controller) {
        controller.abort();
        controllersRef.current.delete(deviceId);
      }
      // Restore the card to its exact pre-test state, retaining no partial
      // result (Requirement 7.4). No device-record field is ever written.
      writeState(deviceId, { ...IDLE_STATE });
    },
    [writeState],
  );

  const runTest = useCallback(
    (device: VisibilityTestDevice, mechanism?: Mechanism) => {
      start(device, mechanism);
    },
    [start],
  );

  const retryTest = useCallback(
    (device: VisibilityTestDevice, mechanism?: Mechanism) => {
      // A retry from a terminal state simply re-initiates the test; the running
      // guard naturally no-ops if a test is somehow already in flight.
      start(device, mechanism);
    },
    [start],
  );

  const getState = useCallback(
    (deviceId: string): CardTestState => registry[deviceId] ?? IDLE_STATE,
    [registry],
  );

  // Abort any in-flight work on unmount so no late callback updates state.
  useEffect(() => {
    mountedRef.current = true;
    const controllers = controllersRef.current;
    return () => {
      mountedRef.current = false;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  return { getState, runTest, cancelTest, retryTest };
}

export default useVisibilityTest;
