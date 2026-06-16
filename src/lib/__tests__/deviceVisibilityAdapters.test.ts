// Feature: device-visibility-test
//
// Integration tests for the Cloud_Liveness_Check adapter `fetchCloudLiveness`
// (design.md §"Components and Interfaces" / 3. I/O Adapters; Testing Strategy
// §"Integration Tests" 3.1 / 3.5).
//
// These exercise the adapter against a mocked Supabase client to confirm:
//   - It reads `last_seen_at` + server time for the target OWNED device,
//     scoped to the authenticated user via RLS (Requirements 3.1, 3.5).
//   - An RLS-empty result (no row visible to the user) surfaces as a rejection
//     (Requirements 3.5, 3.6).
//   - A read error surfaces as a rejection (Requirement 3.6).
//   - The adapter is read-only: it issues NO writes on any path
//     (Requirements 9.4, 9.5).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the Supabase client. The query builder records the read chain
// (`from -> select -> eq -> abortSignal -> maybeSingle`) and exposes write
// spies (`insert`/`update`/`upsert`/`delete`) so the tests can assert that the
// cloud-liveness read never mutates the `devices` table.
// ---------------------------------------------------------------------------
const mockState = vi.hoisted(() => ({
  // The result the read chain's `.maybeSingle()` resolves to.
  maybeSingleResult: { data: null as unknown, error: null as unknown },
  calls: {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    abortSignal: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder: Record<string, unknown> = {};
  builder.select = (...args: unknown[]) => {
    mockState.calls.select(...args);
    return builder;
  };
  builder.eq = (...args: unknown[]) => {
    mockState.calls.eq(...args);
    return builder;
  };
  builder.abortSignal = (...args: unknown[]) => {
    mockState.calls.abortSignal(...args);
    return builder;
  };
  builder.maybeSingle = (...args: unknown[]) => {
    mockState.calls.maybeSingle(...args);
    return Promise.resolve(mockState.maybeSingleResult);
  };
  // Write methods — present so we can assert they are NEVER invoked.
  builder.insert = (...args: unknown[]) => {
    mockState.calls.insert(...args);
    return builder;
  };
  builder.update = (...args: unknown[]) => {
    mockState.calls.update(...args);
    return builder;
  };
  builder.upsert = (...args: unknown[]) => {
    mockState.calls.upsert(...args);
    return builder;
  };
  builder.delete = (...args: unknown[]) => {
    mockState.calls.delete(...args);
    return builder;
  };

  return {
    supabase: {
      from: (...args: unknown[]) => {
        mockState.calls.from(...args);
        return builder;
      },
    },
  };
});

import { fetchCloudLiveness } from "../deviceVisibilityAdapters";

// Deterministic, network-free server time. The adapter reads the HTTP `Date`
// header of a HEAD request; we stub `fetch` so no real network call is made.
const SERVER_DATE = "Mon, 01 Jan 2024 00:00:00 GMT";
const SERVER_DATE_MS = Date.parse(SERVER_DATE);

beforeEach(() => {
  Object.values(mockState.calls).forEach((spy) => spy.mockClear());
  mockState.maybeSingleResult = { data: null, error: null };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      headers: { get: (name: string) => (name === "date" ? SERVER_DATE : null) },
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function assertNoWrites() {
  expect(mockState.calls.insert).not.toHaveBeenCalled();
  expect(mockState.calls.update).not.toHaveBeenCalled();
  expect(mockState.calls.upsert).not.toHaveBeenCalled();
  expect(mockState.calls.delete).not.toHaveBeenCalled();
}

describe("fetchCloudLiveness — cloud-liveness adapter integration", () => {
  // Requirements 3.1, 3.5: reads last_seen_at + server time for the target
  // owned device, scoped to the authenticated user (RLS), with no writes.
  it("reads last_seen_at and server time for the target owned device (no writes)", async () => {
    const lastSeen = "2024-01-01T00:00:00.000Z";
    mockState.maybeSingleResult = {
      data: { last_seen_at: lastSeen },
      error: null,
    };

    const reading = await fetchCloudLiveness("device-123");

    expect(reading.lastSeenAt).toBe(lastSeen);
    expect(typeof reading.serverNowMs).toBe("number");
    expect(reading.serverNowMs).toBe(SERVER_DATE_MS);

    // Read targets the devices table, selects last_seen_at, scoped by id (RLS
    // restricts the row set to the authenticated owner server-side).
    expect(mockState.calls.from).toHaveBeenCalledWith("devices");
    expect(mockState.calls.select).toHaveBeenCalledWith("last_seen_at");
    expect(mockState.calls.eq).toHaveBeenCalledWith("id", "device-123");
    expect(mockState.calls.maybeSingle).toHaveBeenCalledTimes(1);

    assertNoWrites();
  });

  // Requirement 3.5 / 3.6: when RLS hides the row (a device the user does not
  // own, or that does not exist), the read returns no row and the adapter
  // rejects rather than fabricating a reading. No writes occur.
  it("rejects when no row is visible (RLS-empty result) and performs no writes", async () => {
    mockState.maybeSingleResult = { data: null, error: null };

    await expect(fetchCloudLiveness("foreign-device")).rejects.toThrow(
      /not found or not accessible/i,
    );

    expect(mockState.calls.maybeSingle).toHaveBeenCalledTimes(1);
    assertNoWrites();
  });

  // Requirement 3.6: a backend read failure surfaces as a rejection (the
  // orchestrator maps it to Unknown), leaving stored data unchanged.
  it("rejects when the read errors and performs no writes", async () => {
    mockState.maybeSingleResult = {
      data: null,
      error: { message: "permission denied for table devices" },
    };

    await expect(fetchCloudLiveness("device-123")).rejects.toThrow(
      /cloud liveness read failed/i,
    );

    expect(mockState.calls.maybeSingle).toHaveBeenCalledTimes(1);
    assertNoWrites();
  });

  // Requirement 3.4 (data shape): a present row with null last_seen_at (never
  // seen) reads through as null rather than rejecting.
  it("returns null lastSeenAt for an owned device that has never checked in", async () => {
    mockState.maybeSingleResult = {
      data: { last_seen_at: null },
      error: null,
    };

    const reading = await fetchCloudLiveness("device-123");

    expect(reading.lastSeenAt).toBeNull();
    expect(reading.serverNowMs).toBe(SERVER_DATE_MS);
    assertNoWrites();
  });
});
