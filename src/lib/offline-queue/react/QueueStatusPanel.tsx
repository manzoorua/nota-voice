/**
 * QueueStatusPanel — user-facing view of the offline queue (task 12.2).
 *
 * Renders the live queue status published by {@link QueueStatusProvider} via the
 * {@link useOfflineQueue} hook: per-state counts, a circuit-breaker "sync paused"
 * banner, a compact-mode indicator, an offline indicator, and the list of queue
 * items (active items followed by Dead Letter Store items). Dead Letter Store
 * items expose Retry and Discard actions; Discard is gated behind an
 * {@link AlertDialog} confirmation that states the action is permanent.
 *
 * This component is intentionally self-contained: it is NOT wired into the live
 * application here (that is task 12.3). It can be dropped anywhere beneath a
 * {@link QueueStatusProvider}.
 *
 * Requirements: 4.6 (sync-paused banner), 8.1 (counts), 8.3 (item list),
 * 8.6 (discard confirmation), 9.2 (compact-mode indicator), 9.5 (storage toast).
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  CloudOff,
  HardDriveDownload,
  PauseCircle,
  RotateCw,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import type { QueueItemState, QueueItemSummary, QueueOperationType } from '../types';
import { useOfflineQueue } from './useOfflineQueue';

/** Props for {@link QueueStatusPanel}. */
export interface QueueStatusPanelProps {
  /** Optional extra class names for the root card. */
  className?: string;
}

/** Human-readable labels for each operation type. */
const OPERATION_LABELS: Record<QueueOperationType, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
};

/** Human-readable labels for each queue item state. */
const STATE_LABELS: Record<QueueItemState, string> = {
  pending: 'Pending',
  syncing: 'Syncing',
  blocked: 'Blocked',
  held: 'Held',
  completed: 'Completed',
};

/** Maps an item state to a Badge variant for visual differentiation. */
function stateBadgeVariant(
  state: QueueItemState,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (state) {
    case 'syncing':
      return 'default';
    case 'completed':
      return 'secondary';
    case 'blocked':
    case 'held':
      return 'outline';
    case 'pending':
    default:
      return 'outline';
  }
}

/** Formats a Unix-ms timestamp for display, guarding against invalid values. */
function formatTimestamp(createdAt: number): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) {
    return 'Unknown time';
  }
  try {
    return format(new Date(createdAt), 'PP p');
  } catch {
    return 'Unknown time';
  }
}

/** A single labelled count tile (Req 8.1). */
function CountTile({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border bg-muted/30 p-3">
      <span className="text-2xl font-semibold tabular-nums" aria-hidden="true">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="sr-only">{`${value} ${label}`}</span>
    </div>
  );
}

/**
 * A single queue item row. Dead Letter Store rows render Retry and Discard
 * actions (Req 8.3, 8.4, 8.6).
 */
function QueueItemRow({
  item,
  onRetry,
  onDiscard,
}: {
  item: QueueItemSummary;
  onRetry: (item: QueueItemSummary) => void;
  onDiscard: (item: QueueItemSummary) => void;
}): JSX.Element {
  const label = item.excerpt.trim().length > 0 ? item.excerpt : '(no title)';
  const operationLabel = OPERATION_LABELS[item.operationType] ?? item.operationType;

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{operationLabel}</Badge>
          {item.isDeadLetter ? (
            <Badge variant="destructive">Failed</Badge>
          ) : (
            <Badge variant={stateBadgeVariant(item.state)}>
              {STATE_LABELS[item.state] ?? item.state}
            </Badge>
          )}
        </div>
        <p className="truncate text-sm font-medium" title={label}>
          {label}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{formatTimestamp(item.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {item.retryCount} {item.retryCount === 1 ? 'retry' : 'retries'}
          </span>
        </div>
      </div>

      {item.isDeadLetter ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onRetry(item)}
            aria-label={`Retry ${label}`}
          >
            <RotateCw aria-hidden="true" />
            Retry
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                aria-label={`Discard ${label}`}
              >
                <Trash2 aria-hidden="true" />
                Discard
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this item permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &ldquo;{label}&rdquo; from the failed
                  items list. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDiscard(item)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Discard permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Renders the offline queue status panel.
 *
 * Must be used beneath a {@link QueueStatusProvider}.
 *
 * @example
 * ```tsx
 * <QueueStatusProvider>
 *   <QueueStatusPanel />
 * </QueueStatusProvider>
 * ```
 */
export function QueueStatusPanel({ className }: QueueStatusPanelProps): JSX.Element {
  const {
    counts,
    circuitBreakerState,
    isCompactMode,
    isOnline,
    items,
    retryItem,
    discardItem,
  } = useOfflineQueue();

  // Tracks in-flight per-item actions so buttons can disable to prevent
  // double-submits.
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const setBusy = (id: string, busy: boolean): void => {
    setBusyIds((prev) => {
      if (busy) {
        return { ...prev, [id]: true };
      }
      const { [id]: _omitted, ...rest } = prev;
      return rest;
    });
  };

  const handleRetry = async (item: QueueItemSummary): Promise<void> => {
    setBusy(item.id, true);
    try {
      await retryItem(item.id);
      toast.success('Item queued for retry', {
        description: 'The item was moved back to the queue and will sync when possible.',
      });
    } catch {
      toast.error('Could not retry item', {
        description: 'Something went wrong while restoring the item. Please try again.',
      });
    } finally {
      setBusy(item.id, false);
    }
  };

  const handleDiscard = async (item: QueueItemSummary): Promise<void> => {
    setBusy(item.id, true);
    try {
      await discardItem(item.id);
      toast.success('Item discarded', {
        description: 'The failed item was permanently removed.',
      });
    } catch {
      toast.error('Could not discard item', {
        description: 'Something went wrong while deleting the item. Please try again.',
      });
    } finally {
      setBusy(item.id, false);
    }
  };

  const isSyncPaused = circuitBreakerState === 'open';

  return (
    <Card className={className} aria-label="Offline queue status">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xl">Offline queue</CardTitle>
          {!isOnline ? (
            <Badge variant="outline" className="gap-1">
              <WifiOff aria-hidden="true" className="h-3.5 w-3.5" />
              Offline
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          Operations captured while offline and their sync status.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Circuit-breaker "sync paused" banner (Req 4.6). */}
        {isSyncPaused ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <PauseCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Sync paused</p>
              <p className="text-destructive/90">
                Syncing is temporarily paused due to repeated connection problems. It
                will resume automatically once the connection is stable.
              </p>
            </div>
          </div>
        ) : null}

        {/* Persistent compact-mode indicator (Req 9.2). */}
        {isCompactMode ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400"
          >
            <HardDriveDownload aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Compact storage mode</p>
              <p>
                Storage is low, so audio will not be preserved with new notes until
                space is freed. Text and metadata are still saved.
              </p>
            </div>
          </div>
        ) : null}

        {/* Per-state counts (Req 8.1). */}
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          role="group"
          aria-label="Queue counts by state"
        >
          <CountTile label="Pending" value={counts.pending} />
          <CountTile label="Syncing" value={counts.syncing} />
          <CountTile label="Failed" value={counts.failed} />
          <CountTile label="Completed" value={counts.completed} />
        </div>

        <Separator />

        {/* Item list (Req 8.3). */}
        <section aria-label="Queued items">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <CloudOff aria-hidden="true" className="h-6 w-6" />
              <p>No queued items. Everything is synced.</p>
            </div>
          ) : (
            <ScrollArea className="h-80 pr-3">
              <ul className="divide-y" aria-label="Queue items">
                {items.map((item) => {
                  const busy = busyIds[item.id] === true;
                  return (
                    <div
                      key={`${item.isDeadLetter ? 'dls' : 'active'}-${item.id}`}
                      aria-busy={busy}
                      className={busy ? 'pointer-events-none opacity-60' : undefined}
                    >
                      <QueueItemRow
                        item={item}
                        onRetry={(target) => void handleRetry(target)}
                        onDiscard={(target) => void handleDiscard(target)}
                      />
                    </div>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
