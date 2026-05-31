/**
 * @vitest-environment jsdom
 *
 * Unit tests for {@link QueueStatusPanel} (task 12.2).
 *
 * The panel is rendered against a hand-built {@link QueueStatusContextValue} via
 * {@link QueueStatusContext} so the UI is exercised in isolation, without a real
 * OfflineQueue or IndexedDB. This keeps the tests deterministic and fast while
 * still validating the requirement-driven rendering and action wiring.
 *
 * Covers: counts (Req 8.1), sync-paused banner (Req 4.6), compact-mode
 * indicator (Req 9.2), offline indicator, item list (Req 8.3), retry wiring
 * (Req 8.4), and the permanent-discard confirmation flow (Req 8.6).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { QueueStatusContext, type QueueStatusContextValue } from '../QueueStatusProvider';
import { QueueStatusPanel } from '../QueueStatusPanel';
import type { QueueItemSummary } from '../../types';

afterEach(() => {
  cleanup();
});

function makeValue(
  overrides: Partial<QueueStatusContextValue> = {},
): QueueStatusContextValue {
  return {
    counts: { pending: 0, syncing: 0, failed: 0, completed: 0 },
    circuitBreakerState: 'closed',
    isCompactMode: false,
    isOnline: true,
    items: [],
    retryItem: vi.fn().mockResolvedValue(undefined),
    discardItem: vi.fn().mockResolvedValue(undefined),
    acknowledgeGap: vi.fn(),
    ...overrides,
  };
}

function renderPanel(value: QueueStatusContextValue) {
  return render(
    <QueueStatusContext.Provider value={value}>
      <QueueStatusPanel />
    </QueueStatusContext.Provider>,
  );
}

const activeItem: QueueItemSummary = {
  id: 'active-1',
  operationType: 'create',
  noteId: 'note-1',
  excerpt: 'Active note',
  createdAt: Date.UTC(2024, 0, 15, 10, 30),
  state: 'pending',
  retryCount: 0,
  isDeadLetter: false,
};

const dlsItem: QueueItemSummary = {
  id: 'dls-1',
  operationType: 'update',
  noteId: 'note-2',
  excerpt: 'Failed note',
  createdAt: Date.UTC(2024, 0, 16, 9, 0),
  state: 'pending',
  retryCount: 5,
  isDeadLetter: true,
};

describe('QueueStatusPanel', () => {
  it('renders per-state counts (Req 8.1)', () => {
    renderPanel(
      makeValue({ counts: { pending: 3, syncing: 1, failed: 2, completed: 7 } }),
    );

    // Counts are exposed via accessible text combining value + label.
    expect(screen.getByText('3 Pending')).toBeTruthy();
    expect(screen.getByText('1 Syncing')).toBeTruthy();
    expect(screen.getByText('2 Failed')).toBeTruthy();
    expect(screen.getByText('7 Completed')).toBeTruthy();
  });

  it('shows the sync-paused banner only when the circuit breaker is open (Req 4.6)', () => {
    const { rerender } = renderPanel(makeValue({ circuitBreakerState: 'closed' }));
    expect(screen.queryByText('Sync paused')).toBeNull();

    rerender(
      <QueueStatusContext.Provider value={makeValue({ circuitBreakerState: 'open' })}>
        <QueueStatusPanel />
      </QueueStatusContext.Provider>,
    );
    expect(screen.getByText('Sync paused')).toBeTruthy();
  });

  it('shows the compact-mode indicator when compact mode is active (Req 9.2)', () => {
    renderPanel(makeValue({ isCompactMode: true }));
    expect(screen.getByText('Compact storage mode')).toBeTruthy();
  });

  it('shows an offline indicator when not online', () => {
    renderPanel(makeValue({ isOnline: false }));
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('renders queue items with operation type, excerpt, state, and retry count (Req 8.3)', () => {
    renderPanel(makeValue({ items: [activeItem, dlsItem] }));

    expect(screen.getByText('Active note')).toBeTruthy();
    expect(screen.getByText('Failed note')).toBeTruthy();
    // Operation type label for the active item.
    expect(screen.getAllByText('Create').length).toBeGreaterThan(0);
    // Retry count text for the DLS item.
    expect(screen.getByText('5 retries')).toBeTruthy();
  });

  it('renders retry/discard actions only for Dead Letter Store items', () => {
    renderPanel(makeValue({ items: [activeItem, dlsItem] }));

    // Only the DLS item exposes a Retry button.
    expect(screen.getByRole('button', { name: /Retry Failed note/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Retry Active note/i })).toBeNull();
  });

  it('wires Retry to retryItem(id) (Req 8.4)', async () => {
    const value = makeValue({ items: [dlsItem] });
    renderPanel(value);

    fireEvent.click(screen.getByRole('button', { name: /Retry Failed note/i }));

    await waitFor(() => {
      expect(value.retryItem).toHaveBeenCalledWith('dls-1');
    });
  });

  it('discards only after confirming the permanent action (Req 8.6)', async () => {
    const value = makeValue({ items: [dlsItem] });
    renderPanel(value);

    // Opening the dialog must not discard yet.
    fireEvent.click(screen.getByRole('button', { name: /Discard Failed note/i }));
    expect(value.discardItem).not.toHaveBeenCalled();

    // The confirmation states the action is permanent.
    expect(screen.getByText(/permanently delete/i)).toBeTruthy();

    // Confirming triggers the discard.
    fireEvent.click(screen.getByRole('button', { name: /Discard permanently/i }));
    await waitFor(() => {
      expect(value.discardItem).toHaveBeenCalledWith('dls-1');
    });
  });

  it('shows an empty state when there are no items', () => {
    renderPanel(makeValue({ items: [] }));
    expect(screen.getByText(/Everything is synced/i)).toBeTruthy();
  });
});
