import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ConflictResolver, RESOURCE_GONE_REASON } from '../conflict-resolver';
import type { QueueItem, QueueOperationType } from '../types/queue-item';
import type { ConflictResponse } from '../types/errors';

/**
 * Property-based tests for ConflictResolver (offline-queue-robustness spec task 5.2).
 * Properties 11 (create: newer wins), 12 (update: always conflict copy),
 * 13 (gone resources -> dead-letter).
 */

function makeItem(operationType: QueueOperationType, createdAt: number, noteId = 'note-1'): QueueItem {
  return {
    id: 'id-' + createdAt,
    sequenceNumber: 1,
    operationType,
    noteId,
    payload: { title: 't', content: 'c' },
    payloadChecksum: '00000000',
    state: 'pending',
    createdAt,
    lastAttemptAt: null,
    retryCount: 0,
    error: null,
  };
}

describe('ConflictResolver properties', () => {
  const resolver = new ConflictResolver();

  // Property 11: Create conflicts — newer timestamp wins.
  it('Property 11: create conflict keeps whichever timestamp is newer', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 2_000_000_000_000 }),
        fc.integer({ min: 0, max: 2_000_000_000_000 }),
        async (localTs, serverTs) => {
          const item = makeItem('create', localTs);
          const response: ConflictResponse = { status: 409, serverTimestamp: serverTs };
          const res = await resolver.resolve(item, response);
          if (localTs > serverTs) {
            expect(res.action).toBe('keep-local');
          } else {
            // server newer OR equal -> keep-server (conservative tie-break)
            expect(res.action).toBe('keep-server');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 11 (cont): a create conflict with no server timestamp defers to server.
  it('Property 11: create conflict with missing server timestamp keeps server', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 2_000_000_000_000 }), async (localTs) => {
        const res = await resolver.resolve(makeItem('create', localTs), { status: 409 });
        expect(res.action).toBe('keep-server');
      }),
      { numRuns: 100 },
    );
  });

  // Property 12: Update (and any non-create) conflicts always create a conflict copy.
  it('Property 12: non-create 409 conflicts always create a conflict copy with an id', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<QueueOperationType>('update', 'delete'),
        fc.integer({ min: 0, max: 2_000_000_000_000 }),
        fc.option(fc.integer({ min: 0, max: 2_000_000_000_000 }), { nil: undefined }),
        async (op, localTs, serverTs) => {
          const response: ConflictResponse = { status: 409, serverTimestamp: serverTs };
          const res = await resolver.resolve(makeItem(op, localTs), response);
          expect(res.action).toBe('create-conflict-copy');
          if (res.action === 'create-conflict-copy') {
            expect(typeof res.copyId).toBe('string');
            expect(res.copyId.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 13: Gone resources (404/410) move to the Dead Letter Store.
  it('Property 13: 404/410 for any operation resolves to dead-letter (resource gone)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<QueueOperationType>('create', 'update', 'delete'),
        fc.constantFrom(404, 410),
        fc.integer({ min: 0, max: 2_000_000_000_000 }),
        async (op, status, localTs) => {
          const res = await resolver.resolve(makeItem(op, localTs), { status });
          expect(res.action).toBe('dead-letter');
          if (res.action === 'dead-letter') {
            expect(res.reason).toBe(RESOURCE_GONE_REASON);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
