/**
 * QueueIntegrityChecker — schema validation, checksum verification, and
 * sequence-contiguity checks for the offline queue.
 *
 * Runs on application startup (before the Sync Engine begins processing) and
 * guards the queue against corrupted or malformed entries blocking
 * synchronization of valid items. It performs three independent integrity
 * checks against the {@link QueueStore}:
 *
 * 1. **Schema validation** (Req 7.1, 7.2): every item is validated against the
 *    Zod {@link QueueItemSchema}. Items that fail validation are moved to the
 *    Dead Letter Store with the validation failure recorded as the reason.
 * 2. **Checksum verification** (Req 7.5, 7.6): every schema-valid item has its
 *    payload checksum re-verified via {@link QueueStore.verifyChecksum}. Items
 *    whose payload no longer matches their stored checksum (corruption /
 *    tampering) are moved to the Dead Letter Store as unreadable.
 * 3. **Sequence contiguity** (Req 7.3): the sequence numbers of the surviving
 *    valid items are checked for gaps. When a gap is detected, items following
 *    the gap are moved to the `held` state until the user acknowledges the gap
 *    via the queue status interface.
 *
 * It also reports whether the total stored size exceeds the 50MB warning
 * threshold (Req 7.4) so the UI can surface a persistent notification.
 *
 * The checker is intentionally side-effecting only against the store (moving
 * invalid/corrupt items to the DLS, holding items behind gaps) and otherwise
 * pure: it returns a structured {@link IntegrityReport} describing everything it
 * observed and changed. Event emission and user notification are the
 * responsibility of the OfflineQueue facade (task 11), which consumes this
 * report.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6.
 */

import { QueueItemSchema } from './schemas';
import { QUEUE_SIZE_WARNING_BYTES } from './utils/constants';
import type { QueueStore } from './queue-store';
import type { QueueItem } from './types';

/**
 * Result of validating a single {@link QueueItem} against the
 * {@link QueueItemSchema}.
 */
export interface ValidationResult {
  /** True when the item conforms to the schema. */
  valid: boolean;
  /**
   * Human-readable description of why validation failed, suitable for recording
   * as the Dead Letter Store reason. Present only when {@link valid} is `false`.
   */
  error?: string;
}

/**
 * A contiguous run of missing sequence numbers detected among the queue items.
 *
 * For the sequence `[1, 2, 4, 5, 7]` the checker reports two gaps:
 * `{ start: 3, end: 3, missing: [3] }` and `{ start: 6, end: 6, missing: [6] }`.
 * For `[1, 2, 5, 6]` it reports a single gap `{ start: 3, end: 4, missing: [3, 4] }`.
 */
export interface SequenceGap {
  /** First missing sequence number in this gap (inclusive). */
  start: number;
  /** Last missing sequence number in this gap (inclusive). */
  end: number;
  /** Every missing sequence number in this gap, ascending. */
  missing: number[];
}

/**
 * Summary of a full integrity sweep produced by {@link QueueIntegrityChecker.validateAll}.
 */
export interface IntegrityReport {
  /** Total number of queue items examined. */
  totalItems: number;
  /** Number of items that passed both schema validation and checksum verification. */
  validatedCount: number;
  /** Ids of items moved to the Dead Letter Store because they failed schema validation. */
  invalidItemsMoved: string[];
  /** Ids of items moved to the Dead Letter Store because their payload checksum did not match. */
  checksumFailures: string[];
  /** Sequence gaps detected among the surviving valid items. */
  gaps: SequenceGap[];
  /** Ids of items moved to the `held` state because they follow a detected gap. */
  heldItemIds: string[];
}

/**
 * Result of comparing the queue's total stored size against the warning
 * threshold (Req 7.4).
 */
export interface StorageSizeReport {
  /** Estimated bytes used by stored data (from `navigator.storage.estimate()`). */
  usageBytes: number;
  /** Number of items currently in the active queue. */
  itemCount: number;
  /** The threshold the usage is compared against ({@link QUEUE_SIZE_WARNING_BYTES}). */
  thresholdBytes: number;
  /** True when {@link usageBytes} exceeds {@link thresholdBytes}. */
  exceedsThreshold: boolean;
}

/**
 * Validates the structural and data integrity of the offline queue.
 *
 * Construct with the shared {@link QueueStore} instance and call
 * {@link validateAll} during application startup, before the Sync Engine runs.
 */
export class QueueIntegrityChecker {
  /** The IndexedDB-backed store the checker reads from and repairs. */
  private readonly store: QueueStore;

  /**
   * @param store - The queue store to validate and repair.
   */
  constructor(store: QueueStore) {
    this.store = store;
  }

  /**
   * Performs a full integrity sweep of the queue (Req 7.1, 7.2, 7.3, 7.5, 7.6).
   *
   * For every item, in order:
   * 1. Validate against {@link QueueItemSchema}. Invalid items are moved to the
   *    Dead Letter Store with the validation failure as the reason (Req 7.2) and
   *    excluded from the remaining checks.
   * 2. Verify the payload checksum. Items whose payload no longer matches their
   *    stored checksum are moved to the Dead Letter Store as unreadable
   *    (Req 7.6) and excluded from the remaining checks.
   *
   * The surviving valid items are then checked for sequence-number contiguity
   * (Req 7.3). When one or more gaps are found, every valid item positioned
   * after the earliest gap is moved to the `held` state so it is not synced
   * until the user acknowledges the gap. Items that are already `held` or
   * `completed` are left untouched.
   *
   * @returns An {@link IntegrityReport} summarizing what was examined and changed.
   */
  async validateAll(): Promise<IntegrityReport> {
    const items = await this.store.getAll();
    const totalItems = items.length;

    const invalidItemsMoved: string[] = [];
    const checksumFailures: string[] = [];
    const validItems: QueueItem[] = [];

    // 1 & 2. Schema validation, then checksum verification (Req 7.1/7.2, 7.5/7.6).
    for (const item of items) {
      const validation = this.validateItem(item);
      if (!validation.valid) {
        await this.store.moveToDLS(
          item.id,
          `Schema validation failed: ${validation.error ?? 'unknown error'}`,
        );
        invalidItemsMoved.push(item.id);
        continue;
      }

      if (!this.store.verifyChecksum(item)) {
        await this.store.moveToDLS(
          item.id,
          'Payload checksum mismatch: queue entry was unreadable',
        );
        checksumFailures.push(item.id);
        continue;
      }

      validItems.push(item);
    }

    // 3. Sequence contiguity among the survivors (Req 7.3).
    const gaps = this.checkSequenceContiguity(validItems);
    const heldItemIds = gaps.length > 0 ? await this.holdItemsFollowingGap(validItems, gaps) : [];

    return {
      totalItems,
      validatedCount: validItems.length,
      invalidItemsMoved,
      checksumFailures,
      gaps,
      heldItemIds,
    };
  }

  /**
   * Validates a single item against the {@link QueueItemSchema} (Req 7.1).
   *
   * Items read back from IndexedDB are statically typed as {@link QueueItem} but
   * may be malformed at runtime (corruption, schema drift); `safeParse` performs
   * the real runtime check. On failure the returned `error` concatenates each
   * Zod issue as `path: message`, providing an actionable reason to record on
   * the Dead Letter Store entry.
   *
   * @param item - The item to validate.
   * @returns `{ valid: true }` when the item conforms, otherwise
   *   `{ valid: false, error }` describing the violations.
   */
  validateItem(item: QueueItem): ValidationResult {
    const result = QueueItemSchema.safeParse(item);
    if (result.success) {
      return { valid: true };
    }

    const error = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return { valid: false, error };
  }

  /**
   * Identifies gaps in the sequence numbers of the supplied items (Req 7.3).
   *
   * Sequence numbers are sorted ascending and de-duplicated, then each adjacent
   * pair is examined: any missing values strictly between two present numbers
   * form a {@link SequenceGap}. Only interior gaps are reported — a queue whose
   * lowest sequence number is greater than 1 is not itself treated as a gap,
   * since completed/purged items legitimately leave the queue starting above 1.
   *
   * Example: `[1, 2, 4, 5, 7]` → `[{ 3, 3, [3] }, { 6, 6, [6] }]`.
   *
   * @param items - The items whose sequence numbers to inspect (any order).
   * @returns The detected gaps, ordered by ascending `start`. Empty when the
   *   sequence numbers are contiguous (or fewer than two items are supplied).
   */
  checkSequenceContiguity(items: QueueItem[]): SequenceGap[] {
    if (items.length < 2) {
      return [];
    }

    const sorted = Array.from(new Set(items.map((item) => item.sequenceNumber))).sort(
      (a, b) => a - b,
    );

    const gaps: SequenceGap[] = [];
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (next > current + 1) {
        const start = current + 1;
        const end = next - 1;
        const missing: number[] = [];
        for (let n = start; n <= end; n += 1) {
          missing.push(n);
        }
        gaps.push({ start, end, missing });
      }
    }

    return gaps;
  }

  /**
   * Reports whether the queue's total stored size exceeds the warning threshold
   * (Req 7.4).
   *
   * Uses {@link QueueStore.getStorageEstimate} for the byte usage and
   * {@link QueueStore.getQueueSize} for the item count. When the Storage API is
   * unavailable (e.g. the test environment) the estimate's `usage` defaults to
   * 0, so `exceedsThreshold` is `false` — i.e. "unknown size" is treated as "no
   * pressure".
   *
   * @returns A {@link StorageSizeReport} with the usage, item count, threshold,
   *   and whether the threshold is exceeded.
   */
  async checkStorageSize(): Promise<StorageSizeReport> {
    const [estimate, itemCount] = await Promise.all([
      this.store.getStorageEstimate(),
      this.store.getQueueSize(),
    ]);

    const usageBytes = estimate.usage ?? 0;

    return {
      usageBytes,
      itemCount,
      thresholdBytes: QUEUE_SIZE_WARNING_BYTES,
      exceedsThreshold: usageBytes > QUEUE_SIZE_WARNING_BYTES,
    };
  }

  /**
   * Moves every valid item positioned after the earliest detected gap to the
   * `held` state (Req 7.3).
   *
   * The earliest missing sequence number (the smallest gap `start`) marks the
   * boundary: any item whose sequence number is greater follows the gap and is
   * held pending user acknowledgment. Items already `held` are skipped (nothing
   * to change) and `completed` items are left alone, since a finished sync has
   * nothing to hold.
   *
   * @param validItems - The schema- and checksum-valid items.
   * @param gaps - The gaps reported by {@link checkSequenceContiguity}; assumed
   *   non-empty and ordered by ascending `start`.
   * @returns The ids of the items moved to `held`.
   */
  private async holdItemsFollowingGap(
    validItems: QueueItem[],
    gaps: SequenceGap[],
  ): Promise<string[]> {
    const earliestMissing = gaps[0].start;
    const heldItemIds: string[] = [];

    for (const item of validItems) {
      if (
        item.sequenceNumber > earliestMissing &&
        item.state !== 'held' &&
        item.state !== 'completed'
      ) {
        await this.store.updateState(item.id, 'held');
        heldItemIds.push(item.id);
      }
    }

    return heldItemIds;
  }
}
