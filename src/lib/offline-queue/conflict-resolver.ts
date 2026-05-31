/**
 * Conflict detection and resolution for the offline queue sync pipeline.
 *
 * When a sync attempt collides with server-side state, the backend responds
 * with an HTTP 409 (conflict) or 404/410 (resource gone). The
 * {@link ConflictResolver} inspects the offending {@link QueueItem} and the
 * server's {@link ConflictResponse} and produces a {@link ConflictResolution}
 * that tells the SyncEngine how to proceed without losing data from either
 * source.
 *
 * Resolution rules (Requirement 5):
 * - **Create conflict (HTTP 409, operationType `create`)** — compare the local
 *   creation timestamp with the server record's last-modified timestamp; the
 *   newer version wins (`keep-local` when local is newer, `keep-server` when the
 *   server is newer). (Req 5.1, 5.2, 5.3)
 * - **Update conflict (HTTP 409, operationType `update`)** — always preserve
 *   both versions by creating a conflict copy labeled with the origin source,
 *   original timestamp, and note identifier. (Req 5.4, 5.5)
 * - **Gone resource (HTTP 404/410)** — the referenced server resource no longer
 *   exists, so the item is moved to the Dead Letter Store. (Req 5.6)
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import type {
  ConflictResolution,
  ConflictResponse,
} from './types/errors';
import type { QueueItem } from './types/queue-item';
import { generateUuid } from './utils/uuid';

/** HTTP status indicating the local change conflicts with current server state. */
const HTTP_CONFLICT = 409;
/** HTTP status indicating the referenced resource was not found. */
const HTTP_NOT_FOUND = 404;
/** HTTP status indicating the referenced resource is permanently gone. */
const HTTP_GONE = 410;

/** Reason recorded when an item is dead-lettered because its resource is gone. */
export const RESOURCE_GONE_REASON =
  'Referenced server resource no longer exists';

/**
 * A label describing a conflict copy, preserving the provenance required by
 * Requirement 5.4 so the user can manually reconcile the two versions.
 */
export interface ConflictCopyLabel {
  /** Which side of the conflict this copy preserves. */
  originSource: 'local' | 'server';
  /** The original timestamp (Unix ms) of the preserved version. */
  originalTimestamp: number;
  /** The note identifier the conflict relates to. */
  noteId: string;
  /** Human-readable label suitable for display in the UI. */
  label: string;
}

/**
 * Builds a conflict-copy label that captures the origin source, original
 * timestamp, and note identifier (Requirement 5.4). The SyncEngine attaches
 * this metadata when it materializes the conflict copy and surfaces it to the
 * user for manual reconciliation (Requirement 5.5).
 *
 * @param item - The local queue item involved in the conflict.
 * @param originSource - Whether this copy preserves the local or server version.
 * @returns A structured label describing the conflict copy.
 */
export function buildConflictCopyLabel(
  item: QueueItem,
  originSource: 'local' | 'server',
): ConflictCopyLabel {
  const isoTimestamp = new Date(item.createdAt).toISOString();
  return {
    originSource,
    originalTimestamp: item.createdAt,
    noteId: item.noteId,
    label: `Conflict copy (${originSource}) — note ${item.noteId} @ ${isoTimestamp}`,
  };
}

/**
 * Resolves conflicts between locally queued operations and server-side state.
 *
 * The resolver is pure with respect to its inputs: given the same
 * {@link QueueItem} and {@link ConflictResponse} it always produces the same
 * {@link ConflictResolution}. It performs no I/O itself; persisting the chosen
 * resolution (creating the copy, dead-lettering, etc.) is the SyncEngine's
 * responsibility. The method is asynchronous to satisfy the
 * `resolve(...): Promise<ConflictResolution>` contract in the design and to
 * leave room for future asynchronous resolution strategies.
 */
export class ConflictResolver {
  /**
   * Determines how to resolve a conflicting sync attempt.
   *
   * @param item - The local queue item that failed to sync.
   * @param serverResponse - The server's conflict response (status 409/404/410).
   * @returns The resolution the SyncEngine should apply.
   */
  async resolve(
    item: QueueItem,
    serverResponse: ConflictResponse,
  ): Promise<ConflictResolution> {
    const { status } = serverResponse;

    // Req 5.6 / Property 13: a referenced resource that is gone (404/410) can
    // never be reconciled, so the item is moved to the Dead Letter Store.
    if (status === HTTP_NOT_FOUND || status === HTTP_GONE) {
      return { action: 'dead-letter', reason: RESOURCE_GONE_REASON };
    }

    // Req 5.1–5.4 / Properties 11, 12: an HTTP 409 means the local change
    // conflicts with current server state.
    if (status === HTTP_CONFLICT) {
      return this.resolveConflict(item, serverResponse);
    }

    // Defensive: the resolver is only invoked for conflict-class responses.
    // Any other status reaching here is unexpected, so the item is
    // dead-lettered with a descriptive reason rather than silently retried.
    return {
      action: 'dead-letter',
      reason: `Unhandled conflict response status ${status}`,
    };
  }

  /**
   * Resolves an HTTP 409 conflict according to the operation type.
   *
   * Creates use timestamp comparison (newer wins); every other mutation type
   * (update, delete) preserves both versions via a conflict copy.
   */
  private resolveConflict(
    item: QueueItem,
    serverResponse: ConflictResponse,
  ): ConflictResolution {
    if (item.operationType === 'create') {
      return this.resolveCreateConflict(item, serverResponse);
    }

    // Req 5.4 / Property 12: update (and any non-create mutation) conflicts
    // always preserve both versions by creating a labeled conflict copy.
    return { action: 'create-conflict-copy', copyId: generateUuid() };
  }

  /**
   * Resolves a create conflict by comparing the local creation timestamp with
   * the server record's last-modified timestamp — the newer version wins
   * (Req 5.1, 5.2, 5.3 / Property 11).
   *
   * Tie-breaking and missing-data behavior: when the timestamps are equal, or
   * when the server did not supply a timestamp to compare against, the resolver
   * defers to the server (`keep-server`). This is the conservative choice — the
   * local version is only retained when it can be proven strictly newer than
   * the server's.
   */
  private resolveCreateConflict(
    item: QueueItem,
    serverResponse: ConflictResponse,
  ): ConflictResolution {
    const localTimestamp = item.createdAt;
    const serverTimestamp = serverResponse.serverTimestamp;

    if (serverTimestamp === undefined) {
      return { action: 'keep-server' };
    }

    // Req 5.2: local strictly newer than server → retain local on the server.
    if (localTimestamp > serverTimestamp) {
      return { action: 'keep-local' };
    }

    // Req 5.3: server newer (or equal) than local → retain the server version
    // and discard the local item.
    return { action: 'keep-server' };
  }
}

/**
 * A shared, stateless {@link ConflictResolver} instance. The resolver holds no
 * mutable state, so a single instance can be reused across the sync pipeline.
 */
export const conflictResolver = new ConflictResolver();
