import { formatDistance } from "date-fns";

/**
 * Human-readable derivation of a Pen's most recent check-in (`last_seen_at`).
 *
 * This view is a pure, passive presentation of `last_seen_at` and is intentionally
 * independent of any `VisibilityResult` — running, resolving, or failing a
 * Device_Visibility_Test must never change it (Requirements 10.7, 10.8).
 */
export interface LastSeenView {
  /**
   * Relative elapsed-time string (e.g. "2 minutes ago"), or the
   * Never_Seen_Indicator value "Never seen" when `last_seen_at` is null/absent.
   * (Requirements 10.2, 10.4)
   */
  relative: string;
  /**
   * Absolute UTC ISO 8601 timestamp (e.g. "2024-06-01T12:34:56Z"), present only
   * when `last_seen_at` is present; `null` otherwise. (Requirement 10.3)
   */
  absolute: string | null;
  /** True when the Pen has no recorded check-in. (Requirement 10.4) */
  neverSeen: boolean;
}

/** Value shown when a Pen has never checked in. (Requirement 10.4) */
const NEVER_SEEN = "Never seen";

/**
 * Format a Pen's `last_seen_at` for the Last_Seen_Display on its Device_Card.
 *
 * Pure and deterministic: the relative string is computed against the injected
 * `nowMs` rather than the wall clock, so the result depends only on its inputs
 * (Requirements 10.1–10.5, Property 18). It does not depend on, read, or produce
 * any `VisibilityResult`.
 *
 * @param lastSeenAt The Pen's `last_seen_at` timestamp (ISO string) or null/absent.
 * @param nowMs      The reference "now" in epoch milliseconds.
 */
export function formatLastSeen(
  lastSeenAt: string | null | undefined,
  nowMs: number,
): LastSeenView {
  // No recorded check-in -> "Never seen" with no absolute value (Requirement 10.4).
  if (lastSeenAt == null) {
    return { relative: NEVER_SEEN, absolute: null, neverSeen: true };
  }

  const seenDate = new Date(lastSeenAt);

  // Defensive: an unparseable timestamp is treated the same as "never seen"
  // so the display can never render an invalid value.
  if (Number.isNaN(seenDate.getTime())) {
    return { relative: NEVER_SEEN, absolute: null, neverSeen: true };
  }

  // Relative elapsed time since the most recent check-in, measured against the
  // injected reference time to keep the derivation pure (Requirement 10.2).
  const relative = formatDistance(seenDate, new Date(nowMs), { addSuffix: true });

  // Absolute rendering as a UTC ISO 8601 timestamp, normalized to second
  // precision (e.g. "2024-06-01T12:34:56Z") (Requirement 10.3).
  const absolute = seenDate.toISOString().replace(/\.\d{3}Z$/, "Z");

  return { relative, absolute, neverSeen: false };
}
