/**
 * StoragePressureManager — graceful degradation under storage pressure.
 *
 * Watches the origin's IndexedDB storage headroom and drives the queue's
 * "compact mode" (audio blobs omitted, text + metadata only) so the app keeps
 * capturing notes even when the device is nearly out of space. It also reclaims
 * space by purging already-synced items oldest-first when quota is exhausted.
 *
 * Requirements implemented:
 * - 9.1: Enter compact mode when available IndexedDB storage drops below 10MB
 *   (see {@link COMPACT_MODE_ENTER_BYTES}). Pressure is checked on demand
 *   (before writes / at startup) via {@link StoragePressureManager.checkPressure}.
 * - 9.2: While compact mode is active the UI shows a persistent indicator; the
 *   manager exposes {@link StoragePressureManager.isCompactMode} and notifies
 *   {@link StoragePressureManager.onModeChange} listeners so the UI can react.
 * - 9.3: Exit compact mode only when available storage rises above 20MB
 *   (see {@link COMPACT_MODE_EXIT_BYTES}). The asymmetric enter/exit thresholds
 *   form a hysteresis band (10MB–20MB) in which the mode never flips, so the
 *   system cannot oscillate (Property 20).
 * - 9.4: {@link StoragePressureManager.purgeOldSyncedItems} removes already
 *   synced (`completed`) items in oldest-first order (by `createdAt`), stopping
 *   once {@link PURGE_TARGET_RECLAIM_BYTES} (2MB) is reclaimed or
 *   {@link PURGE_MAX_ITEMS} (20) items have been purged — whichever comes first
 *   (Property 21).
 *
 * Persistence of the compact-mode flag is injected via an optional callback
 * (the underlying {@link QueueStore} exposes no public metadata setter). Keeping
 * persistence and the store dependency injectable lets this manager be unit
 * tested without a real IndexedDB.
 */

import {
  COMPACT_MODE_ENTER_BYTES,
  COMPACT_MODE_EXIT_BYTES,
  PURGE_MAX_ITEMS,
  PURGE_TARGET_RECLAIM_BYTES,
} from './utils/constants';
import type { QueueFilter, QueueItem } from './types';

/**
 * Storage pressure severity reported by {@link StoragePressureManager.checkPressure}.
 *
 * - `normal`   — ample headroom (or headroom unknown); audio is preserved.
 * - `compact`  — headroom is low; compact mode is active and audio is omitted.
 * - `critical` — headroom is so low that even purging may not save the next
 *   write; the caller should reclaim space and warn the user.
 */
export type StoragePressureLevel = 'normal' | 'compact' | 'critical';

/**
 * Snapshot of the most recent pressure evaluation. Returned by
 * {@link StoragePressureManager.evaluate} and the basis for the level returned
 * by {@link StoragePressureManager.checkPressure}.
 */
export interface StoragePressureReport {
  /** Severity derived from the available headroom and current mode. */
  level: StoragePressureLevel;
  /** Estimated available bytes (`quota - usage`), or `null` when unknown. */
  availableBytes: number | null;
  /** Whether compact mode is active after this evaluation. */
  isCompactMode: boolean;
}

/** Listener notified whenever compact mode is entered or exited (Req 9.2). */
export type CompactModeChangeListener = (isCompactMode: boolean) => void;

/**
 * Best-effort sink that persists the compact-mode flag (e.g. to the IndexedDB
 * `metadata` store). May be sync or async; the manager never blocks a mode
 * transition on it.
 */
export type CompactModePersistence = (isCompactMode: boolean) => void | Promise<void>;

/**
 * The subset of {@link QueueStore} this manager depends on. Declared
 * structurally so a real {@link QueueStore} can be passed directly while tests
 * can supply a lightweight fake with no IndexedDB.
 */
export interface StoragePressureQueueStore {
  getStorageEstimate(): Promise<StorageEstimate>;
  getAll(filter?: QueueFilter): Promise<QueueItem[]>;
  dequeue(id: string): Promise<void>;
}

/** Construction options for {@link StoragePressureManager}. */
export interface StoragePressureManagerOptions {
  /** Persistence sink for the compact-mode flag (crash resilience). */
  persistence?: CompactModePersistence;
  /**
   * Initial compact-mode value, typically hydrated from the metadata store on
   * startup. Defaults to `false`. Hydrating here does not emit a change event.
   */
  initialCompactMode?: boolean;
  /**
   * Available-bytes threshold at or below which pressure is reported as
   * `critical`. Defaults to {@link PURGE_TARGET_RECLAIM_BYTES} (2MB): below the
   * amount a purge pass targets, space is effectively exhausted.
   */
  criticalBytes?: number;
  /**
   * Estimates the bytes a queue item occupies, used to decide when a purge pass
   * has reclaimed enough space (Req 9.4). Injectable for deterministic tests;
   * defaults to {@link defaultEstimateItemBytes}.
   */
  estimateItemBytes?: (item: QueueItem) => number;
  /** Handler for persistence failures. When omitted, errors are swallowed. */
  onPersistError?: (error: unknown) => void;
}

/**
 * Estimates the serialized byte footprint of a queue item's payload.
 *
 * Audio dominates when present (`audioBlob.byteLength`); text fields are
 * approximated using their UTF-8 byte length (via {@link TextEncoder} when
 * available, otherwise a 2-bytes-per-char fallback). The result is an estimate
 * used only to decide when a purge pass has reclaimed "enough", so absolute
 * precision is unnecessary.
 *
 * @param item - The queue item to size.
 * @returns Approximate bytes occupied by the item's payload.
 */
export function defaultEstimateItemBytes(item: QueueItem): number {
  const { payload } = item;
  let bytes = 0;

  if (payload.audioBlob) {
    bytes += payload.audioBlob.byteLength;
  }

  const textParts = [
    payload.title ?? '',
    payload.content ?? '',
    payload.transcription ?? '',
  ];
  if (payload.metadata !== undefined) {
    try {
      textParts.push(JSON.stringify(payload.metadata));
    } catch {
      /* circular / non-serializable metadata — ignore in the estimate */
    }
  }
  const text = textParts.join('');

  const encoder = (globalThis as { TextEncoder?: typeof TextEncoder }).TextEncoder;
  if (typeof encoder === 'function') {
    bytes += new encoder().encode(text).length;
  } else {
    bytes += text.length * 2;
  }

  return bytes;
}

/**
 * Detects storage pressure, manages compact mode with hysteresis, and purges
 * synced items to reclaim space.
 */
export class StoragePressureManager {
  private readonly store: StoragePressureQueueStore;
  private readonly persistence?: CompactModePersistence;
  private readonly criticalBytes: number;
  private readonly estimateItemBytes: (item: QueueItem) => number;
  private readonly onPersistError?: (error: unknown) => void;

  private compactMode: boolean;
  private readonly listeners = new Set<CompactModeChangeListener>();

  /**
   * @param store - The queue store providing storage estimates and item access.
   *   A real {@link QueueStore} satisfies the required {@link StoragePressureQueueStore}
   *   surface and can be passed directly.
   * @param options - Optional persistence, thresholds, and injectables.
   */
  constructor(
    store: StoragePressureQueueStore,
    options: StoragePressureManagerOptions = {},
  ) {
    this.store = store;
    this.persistence = options.persistence;
    this.criticalBytes = options.criticalBytes ?? PURGE_TARGET_RECLAIM_BYTES;
    this.estimateItemBytes = options.estimateItemBytes ?? defaultEstimateItemBytes;
    this.onPersistError = options.onPersistError;
    this.compactMode = options.initialCompactMode ?? false;
  }

  /** Whether compact storage mode is currently active (Req 9.2). */
  get isCompactMode(): boolean {
    return this.compactMode;
  }

  /**
   * Evaluates current storage pressure and applies the compact-mode hysteresis,
   * returning the resulting severity level (Req 9.1, 9.3; Property 20).
   *
   * Hysteresis:
   * - Enters compact mode when available storage is strictly below
   *   {@link COMPACT_MODE_ENTER_BYTES} (10MB).
   * - Exits compact mode only when available storage is strictly above
   *   {@link COMPACT_MODE_EXIT_BYTES} (20MB).
   * - In the 10MB–20MB band the mode is left unchanged, so it never oscillates.
   *
   * When the available headroom is unknown (the Storage API is unavailable, so
   * {@link StoragePressureQueueStore.getStorageEstimate} reports `quota === 0`),
   * the mode is left unchanged and the level is reported as `normal`.
   *
   * @returns The current {@link StoragePressureLevel}.
   */
  async checkPressure(): Promise<StoragePressureLevel> {
    const report = await this.evaluate();
    return report.level;
  }

  /**
   * Like {@link checkPressure} but returns the full {@link StoragePressureReport}
   * (level, available bytes, and resulting compact-mode flag).
   */
  async evaluate(): Promise<StoragePressureReport> {
    const estimate = await this.store.getStorageEstimate();
    const quota = estimate.quota ?? 0;
    const usage = estimate.usage ?? 0;

    // quota === 0 means the Storage API is unavailable: headroom is unknown, so
    // do not change mode and report no pressure.
    if (quota <= 0) {
      return {
        level: this.compactMode ? 'compact' : 'normal',
        availableBytes: null,
        isCompactMode: this.compactMode,
      };
    }

    const available = Math.max(0, quota - usage);

    // Apply hysteresis (Req 9.1, 9.3; Property 20).
    if (!this.compactMode && available < COMPACT_MODE_ENTER_BYTES) {
      this.enterCompactMode();
    } else if (this.compactMode && available > COMPACT_MODE_EXIT_BYTES) {
      this.exitCompactMode();
    }

    let level: StoragePressureLevel;
    if (available <= this.criticalBytes) {
      level = 'critical';
    } else if (this.compactMode) {
      level = 'compact';
    } else {
      level = 'normal';
    }

    return { level, availableBytes: available, isCompactMode: this.compactMode };
  }

  /**
   * Enters compact storage mode: sets the flag, persists it, and notifies
   * listeners (Req 9.1, 9.2). Idempotent — a no-op when already compact.
   */
  enterCompactMode(): void {
    if (this.compactMode) {
      return;
    }
    this.compactMode = true;
    this.persist();
    this.emitModeChange();
  }

  /**
   * Exits compact storage mode: clears the flag, persists it, and notifies
   * listeners (Req 9.3). Idempotent — a no-op when already non-compact.
   */
  exitCompactMode(): void {
    if (!this.compactMode) {
      return;
    }
    this.compactMode = false;
    this.persist();
    this.emitModeChange();
  }

  /**
   * Purges already-synced (`completed`) items to reclaim space, oldest first
   * (Req 9.4; Property 21).
   *
   * Items are ordered by ascending `createdAt` and removed one at a time. The
   * pass stops as soon as any of these holds:
   * - the estimated reclaimed space reaches {@link PURGE_TARGET_RECLAIM_BYTES} (2MB),
   * - the number purged reaches the effective cap, or
   * - no synced items remain.
   *
   * The effective cap is `min(maxToPurge, PURGE_MAX_ITEMS)` so a caller can
   * request fewer than the {@link PURGE_MAX_ITEMS} (20) hard limit but never more.
   *
   * @param maxToPurge - Maximum items to purge this pass. Defaults to and is
   *   capped at {@link PURGE_MAX_ITEMS}. Non-positive values purge nothing.
   * @returns The number of items actually purged.
   */
  async purgeOldSyncedItems(maxToPurge: number = PURGE_MAX_ITEMS): Promise<number> {
    const cap = Math.min(maxToPurge, PURGE_MAX_ITEMS);
    if (cap <= 0) {
      return 0;
    }

    const synced = await this.store.getAll({ state: 'completed' });
    // Oldest first by creation time; sequenceNumber breaks ties deterministically.
    synced.sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt - b.createdAt;
      }
      return a.sequenceNumber - b.sequenceNumber;
    });

    let purged = 0;
    let reclaimed = 0;

    for (const item of synced) {
      if (purged >= cap) {
        break;
      }
      await this.store.dequeue(item.id);
      purged += 1;
      reclaimed += this.estimateItemBytes(item);
      if (reclaimed >= PURGE_TARGET_RECLAIM_BYTES) {
        break;
      }
    }

    return purged;
  }

  /**
   * Registers a listener for compact-mode transitions (Req 9.2). The listener
   * receives the new `isCompactMode` value.
   *
   * @returns An unsubscribe function.
   */
  onModeChange(callback: CompactModeChangeListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private emitModeChange(): void {
    const compact = this.compactMode;
    for (const listener of [...this.listeners]) {
      try {
        listener(compact);
      } catch {
        // A misbehaving listener must not break pressure management.
      }
    }
  }

  private persist(): void {
    if (!this.persistence) {
      return;
    }
    try {
      const result = this.persistence(this.compactMode);
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).then(undefined, (err) => this.handlePersistError(err));
      }
    } catch (err) {
      this.handlePersistError(err);
    }
  }

  private handlePersistError(error: unknown): void {
    if (this.onPersistError) {
      this.onPersistError(error);
    }
    // Otherwise swallow: persistence is best-effort for crash resilience.
  }
}
