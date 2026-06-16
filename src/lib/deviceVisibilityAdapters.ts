// Feature: device-visibility-test
//
// I/O adapters for the Device_Visibility_Test (design.md §"Components and
// Interfaces" / 3. I/O Adapters). These are thin side-effecting functions that
// gather the raw data the pure decision layer (`deviceVisibility.ts`) reasons
// about. They perform NO writes to the `devices` table — the cloud-liveness
// path is read-only (Requirements 3.1, 3.5, 9.4, 9.5).
//
// Each adapter is bounded by its own per-mechanism response bound which is
// always <= TEST_TIMEOUT_MS, so a single adapter can never exceed the overall
// hard test cap (A4; design.md §"Error Handling"). The orchestration hook
// (`useVisibilityTest`) still wraps every call in the hard `Test_Timeout`.

import { supabase } from "@/integrations/supabase/client";
import { serialMatches, TEST_TIMEOUT_MS } from "@/lib/deviceVisibility";

/**
 * Per-mechanism response bounds (A4). Each is intentionally <= TEST_TIMEOUT_MS
 * so an adapter resolves/rejects well before the orchestrator's hard cap.
 */
export const CLOUD_RESPONSE_BOUND_MS = 10_000;
export const IDENTIFY_RESPONSE_BOUND_MS = 10_000;
export const BLE_RESPONSE_BOUND_MS = 15_000;

// Compile-time guard: bounds must never exceed the overall test timeout.
// (Evaluated at module load; throws early if the invariant is ever broken.)
if (
  CLOUD_RESPONSE_BOUND_MS > TEST_TIMEOUT_MS ||
  IDENTIFY_RESPONSE_BOUND_MS > TEST_TIMEOUT_MS ||
  BLE_RESPONSE_BOUND_MS > TEST_TIMEOUT_MS
) {
  throw new Error(
    "deviceVisibilityAdapters: a response bound exceeds TEST_TIMEOUT_MS",
  );
}

export interface CloudLivenessReading {
  /** Most recent check-in timestamp for the device, or null when never seen. */
  lastSeenAt: string | null;
  /** Authoritative server time (ms since epoch) used to age `lastSeenAt`. */
  serverNowMs: number;
}

export interface IdentifyQueueResult {
  queued: boolean;
}

export interface BleScanResult {
  found: boolean;
  /** True only when the Web Bluetooth permission was denied/cancelled. */
  permissionDenied?: boolean;
}

/**
 * Runs `run()` but rejects if it has not settled within `ms`. The underlying
 * work may continue in the background (used for calls that cannot be aborted,
 * e.g. edge-function invocation); the caller treats the rejection as a bound
 * breach which the orchestrator maps to an Unknown result.
 */
function withResponseBound<T>(ms: number, run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Response bound exceeded"));
    }, ms);
    run().then(
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
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** Maps a Web Bluetooth rejection to "permission denied" where applicable. */
function isPermissionError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === "NotAllowedError" || name === "SecurityError";
}

/**
 * Reads the authoritative server time from the standard HTTP `Date` response
 * header of the Supabase REST endpoint, falling back to the client clock if the
 * header is unavailable. Bounded by the caller's abort signal.
 */
async function fetchServerNowMs(signal: AbortSignal): Promise<number> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        method: "HEAD",
        headers: { apikey: key },
        signal,
      });
      const dateHeader = res.headers.get("date");
      if (dateHeader) {
        const parsed = Date.parse(dateHeader);
        if (!Number.isNaN(parsed)) return parsed;
      }
    } catch {
      // Fall through to the client clock — never let server-time fetch failure
      // by itself fail the liveness read.
    }
  }
  return Date.now();
}

/** Reads `last_seen_at` for one device; RLS scopes the read to the owner. */
async function readDeviceLastSeen(
  deviceId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("devices")
    .select("last_seen_at")
    .eq("id", deviceId)
    .abortSignal(signal)
    .maybeSingle();

  if (error) {
    throw new Error(`Cloud liveness read failed: ${error.message}`);
  }
  if (!data) {
    // No row visible to the authenticated user (does not exist or not owned).
    throw new Error("Device not found or not accessible");
  }
  return data.last_seen_at ?? null;
}

/**
 * Cloud_Liveness_Check adapter (Requirements 3.1, 3.5). Reads `last_seen_at`
 * and the server time for a SINGLE owned device via Supabase. Read-only: it
 * issues no writes and leaves all device-record fields unchanged. Resolves with
 * the raw data for the pure layer to decide on; rejects on read failure or when
 * the response bound elapses (the orchestrator maps either to Unknown).
 */
export async function fetchCloudLiveness(
  deviceId: string,
): Promise<CloudLivenessReading> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    CLOUD_RESPONSE_BOUND_MS,
  );
  try {
    const [lastSeenAt, serverNowMs] = await Promise.all([
      readDeviceLastSeen(deviceId, controller.signal),
      fetchServerNowMs(controller.signal),
    ]);
    return { lastSeenAt, serverNowMs };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Identify_Ping adapter (Requirement 4.2). Queues an identify command for the
 * owned device via the `device-identify-queue` edge function and reports
 * whether it was accepted for delivery. Bounded; rejects on failure or bound
 * breach so the orchestrator can report Unknown / "could not be sent".
 */
export async function queueIdentify(
  deviceId: string,
): Promise<IdentifyQueueResult> {
  return withResponseBound(IDENTIFY_RESPONSE_BOUND_MS, async () => {
    const { data, error } = await supabase.functions.invoke(
      "device-identify-queue",
      { body: { deviceId } },
    );
    if (error) {
      throw new Error(`Identify queue failed: ${error.message}`);
    }
    return { queued: (data as { queued?: boolean } | null)?.queued === true };
  });
}

/**
 * BLE_Scan adapter (Requirements 5.2, 5.3, 5.4, 5.6). Uses Web Bluetooth to
 * look for a pen advertising a Serial that matches `serial` (case-insensitive,
 * full `PEN-`<12 hex> equality via `serialMatches`).
 *
 * Resolution:
 *  - `{ found: true }`               — a matching advertisement was detected.
 *  - `{ found: false }`              — no match within the BLE response bound,
 *                                      or the external `signal` aborted
 *                                      (timeout / cancel) — caller maps the
 *                                      no-match case to Not_Visible.
 *  - `{ found: false, permissionDenied: true }` — the permission prompt was
 *                                      denied or cancelled (Requirement 5.6).
 *
 * The internal bound (BLE_RESPONSE_BOUND_MS) keeps the scan strictly within the
 * overall Test_Timeout, and the abort `signal` lets the orchestrator cancel.
 */
export async function scanForSerial(
  serial: string,
  signal: AbortSignal,
): Promise<BleScanResult> {
  // `navigator.bluetooth` is not part of the standard DOM lib typings.
  const bluetooth = (navigator as unknown as { bluetooth?: BluetoothLike })
    .bluetooth;

  if (!bluetooth) {
    // UI gates this, but never throw if called without support.
    return { found: false };
  }
  if (signal.aborted) {
    return { found: false };
  }

  if (typeof bluetooth.requestLEScan === "function") {
    return scanViaLEScan(bluetooth, serial, signal);
  }
  return scanViaRequestDevice(bluetooth, serial, signal);
}

/**
 * Preferred path: passive LE advertisement scan. Resolves as soon as a matching
 * serial is advertised, otherwise on the response bound or external abort.
 */
function scanViaLEScan(
  bluetooth: BluetoothLike,
  serial: string,
  signal: AbortSignal,
): Promise<BleScanResult> {
  return new Promise<BleScanResult>((resolve) => {
    let settled = false;
    let scan: { stop: () => void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onAdvertisement = (event: { device?: { name?: string | null }; name?: string | null }) => {
      const advertisedName = event.device?.name ?? event.name ?? null;
      if (advertisedName && serialMatches(serial, advertisedName)) {
        settle({ found: true });
      }
    };
    const onAbort = () => settle({ found: false });

    const settle = (result: BleScanResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        scan?.stop();
      } catch {
        // ignore stop failures
      }
      bluetooth.removeEventListener?.("advertisementreceived", onAdvertisement);
      signal.removeEventListener("abort", onAbort);
      resolve(result);
    };

    signal.addEventListener("abort", onAbort);
    timer = setTimeout(() => settle({ found: false }), BLE_RESPONSE_BOUND_MS);
    bluetooth.addEventListener?.("advertisementreceived", onAdvertisement);

    bluetooth
      .requestLEScan!({ acceptAllAdvertisements: true, keepRepeatedDevices: false })
      .then((startedScan) => {
        if (settled) {
          try {
            startedScan.stop();
          } catch {
            // ignore
          }
          return;
        }
        scan = startedScan;
      })
      .catch((error) => {
        if (isPermissionError(error)) {
          settle({ found: false, permissionDenied: true });
        } else {
          // Treat any other start failure as "no evidence gathered".
          settle({ found: false });
        }
      });
  });
}

/**
 * Fallback path for browsers without `requestLEScan`: use the device chooser.
 * A matching chosen device resolves `{ found: true }`; a denied permission
 * resolves `{ permissionDenied: true }`; a cancelled/empty chooser resolves
 * `{ found: false }`. Raced against the response bound and external abort.
 */
function scanViaRequestDevice(
  bluetooth: BluetoothLike,
  serial: string,
  signal: AbortSignal,
): Promise<BleScanResult> {
  return new Promise<BleScanResult>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (result: BleScanResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const onAbort = () => settle({ found: false });

    signal.addEventListener("abort", onAbort);
    timer = setTimeout(() => settle({ found: false }), BLE_RESPONSE_BOUND_MS);

    bluetooth
      .requestDevice!({ filters: [{ namePrefix: "PEN-" }] })
      .then((device) => {
        const name = device?.name ?? null;
        settle({ found: !!name && serialMatches(serial, name) });
      })
      .catch((error) => {
        if (isPermissionError(error)) {
          settle({ found: false, permissionDenied: true });
        } else {
          // NotFoundError covers both "user cancelled" and "no matching
          // device"; neither yields positive reachability evidence.
          settle({ found: false });
        }
      });
  });
}

/**
 * Minimal structural typing for the subset of the Web Bluetooth API this
 * adapter uses. The standard DOM lib does not ship Web Bluetooth types, so we
 * declare only what we touch rather than depend on `@types/web-bluetooth`.
 */
interface BluetoothLike {
  requestDevice?: (options: {
    filters: Array<{ namePrefix?: string; name?: string }>;
  }) => Promise<{ name?: string | null } | null>;
  requestLEScan?: (options: {
    acceptAllAdvertisements?: boolean;
    keepRepeatedDevices?: boolean;
  }) => Promise<{ stop: () => void }>;
  addEventListener?: (
    type: "advertisementreceived",
    listener: (event: { device?: { name?: string | null }; name?: string | null }) => void,
  ) => void;
  removeEventListener?: (
    type: "advertisementreceived",
    listener: (event: { device?: { name?: string | null }; name?: string | null }) => void,
  ) => void;
}
