/**
 * Zod schemas for runtime validation of offline queue data.
 *
 * These mirror the TypeScript interfaces in `./types/queue-item.ts` and are
 * used by the QueueIntegrityChecker to validate items on read/startup. Invalid
 * items are moved to the Dead Letter Store.
 *
 * Requirements: 7.1 (validate schema on startup), 7.2 (move invalid items to
 * DLS with reason).
 */

import { z } from 'zod';

/**
 * Validates {@link import('./types/queue-item').QueueItemPayload}.
 * `title` 1–500 chars, `content` up to 50000 chars; `audioBlob`,
 * `transcription`, and `metadata` are optional.
 */
export const QueueItemPayloadSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(50000),
  audioBlob: z.instanceof(ArrayBuffer).optional(),
  transcription: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Validates a fully materialized
 * {@link import('./types/queue-item').QueueItem}.
 */
export const QueueItemSchema = z.object({
  id: z.string().uuid(),
  sequenceNumber: z.number().int().positive(),
  operationType: z.enum(['create', 'update', 'delete']),
  noteId: z.string().min(1),
  payload: QueueItemPayloadSchema,
  payloadChecksum: z.string().min(1),
  state: z.enum(['pending', 'syncing', 'blocked', 'held', 'completed']),
  createdAt: z.number().int().positive(),
  lastAttemptAt: z.number().int().positive().nullable(),
  retryCount: z.number().int().min(0).max(10),
  error: z.string().nullable(),
});

/** Inferred type for a validated payload (structurally matches `QueueItemPayload`). */
export type QueueItemPayloadSchemaType = z.infer<typeof QueueItemPayloadSchema>;

/** Inferred type for a validated queue item (structurally matches `QueueItem`). */
export type QueueItemSchemaType = z.infer<typeof QueueItemSchema>;
