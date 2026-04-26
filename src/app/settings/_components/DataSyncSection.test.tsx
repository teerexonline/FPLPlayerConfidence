import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { DataSyncSection, formatTimeAgo } from './DataSyncSection';

// Server action mock
vi.mock('../actions', () => ({
  triggerSync: vi.fn(),
}));

import { triggerSync } from '../actions';
const mockTriggerSync = vi.mocked(triggerSync);

// ── formatTimeAgo unit tests ─────────────────────────────────────────────────

describe('formatTimeAgo', () => {
  it('returns "just now" for < 1 minute ago', () => {
    const ts = Date.now() - 30_000;
    expect(formatTimeAgo(ts)).toBe('just now');
  });

  it('returns "1 minute ago" for exactly 1 minute', () => {
    const ts = Date.now() - 60_000;
    expect(formatTimeAgo(ts)).toBe('1 minute ago');
  });

  it('returns "5 minutes ago" for 5 minutes', () => {
    const ts = Date.now() - 5 * 60_000;
    expect(formatTimeAgo(ts)).toBe('5 minutes ago');
  });

  it('returns "1 hour ago" for exactly 1 hour', () => {
    const ts = Date.now() - 60 * 60_000;
    expect(formatTimeAgo(ts)).toBe('1 hour ago');
  });

  it('returns "2 hours ago" for 2 hours', () => {
    const ts = Date.now() - 2 * 60 * 60_000;
    expect(formatTimeAgo(ts)).toBe('2 hours ago');
  });

  it('returns "1 day ago" for 24+ hours', () => {
    const ts = Date.now() - 24 * 60 * 60_000;
    expect(formatTimeAgo(ts)).toBe('1 day ago');
  });
});

// ── DataSyncSection component tests ─────────────────────────────────────────

describe('DataSyncSection', () => {
  beforeEach(() => {
    mockTriggerSync.mockReset();
  });

  it('shows "Never synced" when initialLastSync is null', () => {
    render(<DataSyncSection initialLastSync={null} />);
    expect(screen.getByText('Never synced')).toBeInTheDocument();
  });

  it('shows the relative time for a provided timestamp', () => {
    const ts = Date.now() - 5 * 60_000; // 5 minutes ago
    render(<DataSyncSection initialLastSync={ts} />);
    expect(screen.getByText(/5 minutes ago/)).toBeInTheDocument();
  });

  it('renders the Refresh data button', () => {
    render(<DataSyncSection initialLastSync={null} />);
    expect(screen.getByRole('button', { name: /refresh data/i })).toBeInTheDocument();
  });

  it('shows "Syncing…" and disables button while loading', async () => {
    // Never resolves during this test
    mockTriggerSync.mockImplementation(() => new Promise(() => undefined));
    render(<DataSyncSection initialLastSync={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /refresh data/i }));

    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('Syncing…');
    expect(btn).toBeDisabled();
  });

  it('shows "Synced ✓" on success and updates timestamp', async () => {
    const syncedAt = Date.now();
    mockTriggerSync.mockResolvedValue({
      ok: true,
      syncedAt,
      result: { playersProcessed: 10, playersSkipped: 0, snapshotsWritten: 50, errors: [] },
    });
    render(<DataSyncSection initialLastSync={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /refresh data/i }));

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Synced ✓');
    });
    // Timestamp should now show "just now"
    expect(screen.getByText(/just now/)).toBeInTheDocument();
  });

  it('shows an inline error message on failure', async () => {
    mockTriggerSync.mockResolvedValue({ ok: false, error: 'FPL API unreachable' });
    render(<DataSyncSection initialLastSync={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /refresh data/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('FPL API unreachable');
    });
    // Button should return to normal
    expect(screen.getByRole('button')).toHaveTextContent('Refresh data');
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('has no accessibility violations in initial state (axe)', async () => {
    const { container } = render(<DataSyncSection initialLastSync={null} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
