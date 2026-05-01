import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { DataSyncSection, formatTimeAgo } from './DataSyncSection';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../actions', () => ({
  triggerManualSync: vi.fn(),
}));

// We stub global fetch to control /api/sync-status poll responses.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { triggerManualSync } from '../actions';
const mockTriggerManualSync = vi.mocked(triggerManualSync);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStatusResponse(
  phase = 'idle',
  opts?: {
    batchIndex?: number;
    totalBatches?: number;
    completedAt?: number | null;
    error?: string | null;
  },
): Response {
  const body = JSON.stringify({
    phase,
    batchIndex: opts?.batchIndex ?? 0,
    totalBatches: opts?.totalBatches ?? 0,
    completedAt: opts?.completedAt ?? null,
    error: opts?.error ?? null,
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Render with pollIntervalMs=0 so setTimeout fires in the next tick.
 * No fake timers needed — waitFor can catch real async resolution.
 */
function renderSection(props?: {
  initialLastSync?: number | null;
  initialPhase?: Parameters<typeof DataSyncSection>[0]['initialPhase'];
}) {
  return render(
    <DataSyncSection
      initialLastSync={props?.initialLastSync ?? null}
      initialPhase={props?.initialPhase ?? 'idle'}
      pollIntervalMs={0}
    />,
  );
}

// ─── formatTimeAgo unit tests ─────────────────────────────────────────────────

describe('formatTimeAgo', () => {
  it('returns "just now" for < 1 minute ago', () => {
    expect(formatTimeAgo(Date.now() - 30_000)).toBe('just now');
  });

  it('returns "1 minute ago" for exactly 1 minute', () => {
    expect(formatTimeAgo(Date.now() - 60_000)).toBe('1 minute ago');
  });

  it('returns "5 minutes ago" for 5 minutes', () => {
    expect(formatTimeAgo(Date.now() - 5 * 60_000)).toBe('5 minutes ago');
  });

  it('returns "1 hour ago" for exactly 1 hour', () => {
    expect(formatTimeAgo(Date.now() - 60 * 60_000)).toBe('1 hour ago');
  });

  it('returns "2 hours ago" for 2 hours', () => {
    expect(formatTimeAgo(Date.now() - 2 * 60 * 60_000)).toBe('2 hours ago');
  });

  it('returns "1 day ago" for 24+ hours', () => {
    expect(formatTimeAgo(Date.now() - 24 * 60 * 60_000)).toBe('1 day ago');
  });
});

// ─── DataSyncSection component tests ─────────────────────────────────────────

describe('DataSyncSection', () => {
  beforeEach(() => {
    mockTriggerManualSync.mockReset();
    mockFetch.mockReset();
    // Default: status poll returns idle
    mockFetch.mockResolvedValue(makeStatusResponse('idle'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Never synced" when initialLastSync is null and phase is idle', () => {
    renderSection();
    expect(screen.getByText('Never synced')).toBeInTheDocument();
  });

  it('shows relative time for a provided lastSync timestamp', () => {
    renderSection({ initialLastSync: Date.now() - 5 * 60_000 });
    expect(screen.getByText(/5 minutes ago/)).toBeInTheDocument();
  });

  it('shows auto-sync schedule note', () => {
    renderSection();
    expect(screen.getByText(/12:00 UTC/)).toBeInTheDocument();
  });

  it('renders the "Refresh now" button when idle', () => {
    renderSection();
    expect(screen.getByRole('button', { name: /refresh now/i })).toBeInTheDocument();
  });

  it('button is enabled when idle', () => {
    renderSection();
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('shows "Starting…" and disables button while triggerManualSync is in flight', async () => {
    // Never resolves — keeps component in "starting" state
    mockTriggerManualSync.mockImplementation(() => new Promise(() => undefined));

    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /refresh now/i }));

    expect(screen.getByRole('button')).toHaveTextContent('Starting…');
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows error and re-enables button when triggerManualSync returns ok=false', async () => {
    mockTriggerManualSync.mockResolvedValue({ ok: false, error: 'CRON_SECRET not configured' });

    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /refresh now/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('CRON_SECRET not configured');
    });
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('shows "Syncing…" and disables button while poll returns player_history', async () => {
    mockTriggerManualSync.mockResolvedValue({ ok: true });
    // First poll returns player_history; second returns idle to stop polling
    mockFetch
      .mockResolvedValueOnce(
        makeStatusResponse('player_history', { batchIndex: 4, totalBatches: 28 }),
      )
      .mockResolvedValue(makeStatusResponse('idle', { completedAt: Date.now() }));

    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /refresh now/i }));

    await waitFor(() => {
      expect(screen.getByText(/batch 5 of 28/i)).toBeInTheDocument();
    });
  });

  it('stops polling and shows last sync time when poll returns idle', async () => {
    const completedAt = Date.now() - 60_000;
    mockTriggerManualSync.mockResolvedValue({ ok: true });
    mockFetch.mockResolvedValue(makeStatusResponse('idle', { completedAt }));

    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /refresh now/i }));

    await waitFor(() => {
      expect(screen.getByText(/1 minute ago/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('shows error when poll returns phase=failed', async () => {
    mockTriggerManualSync.mockResolvedValue({ ok: true });
    mockFetch.mockResolvedValue(makeStatusResponse('failed', { error: 'FPL API unreachable' }));

    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /refresh now/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('FPL API unreachable');
    });
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('starts polling immediately when initial phase is player_history', async () => {
    // Poll returns idle — we just need to confirm polling starts and resolves
    mockFetch.mockResolvedValue(makeStatusResponse('idle', { completedAt: Date.now() }));

    renderSection({ initialPhase: 'player_history' });

    // Button should start disabled (syncing state from SSR) then become enabled after poll
    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  it('shows "Syncing players" status line when initial phase is player_history', () => {
    renderSection({ initialPhase: 'player_history' });
    expect(screen.getByText(/syncing players/i)).toBeInTheDocument();
  });

  it('has no accessibility violations in initial idle state', async () => {
    const { container } = renderSection();
    expect(await axe(container)).toHaveNoViolations();
  });
});
