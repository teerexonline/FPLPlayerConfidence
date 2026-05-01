import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { axe } from 'jest-axe';
import { PlayerDetailInteractive } from './PlayerDetailInteractive';
import type { SnapshotPoint } from './types';

// ── Polyfills ────────────────────────────────────────────────────────────────

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {
      /* no-op */
    }
    unobserve() {
      /* no-op */
    }
    disconnect() {
      /* no-op */
    }
  };
});

// ── Mock heavy animation deps ─────────────────────────────────────────────────

vi.mock('@/components/confidence/ConfidenceSlider', () => ({
  ConfidenceSlider: ({ value }: { value: number }) => (
    <div data-testid="confidence-slider" data-value={value} />
  ),
}));

vi.mock('@/components/confidence/ConfidenceNumber', () => ({
  ConfidenceNumber: ({ value, animated }: { value: number; animated: boolean; size: string }) => (
    <span data-testid="confidence-number" data-value={value} data-animated={String(animated)} />
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.useRealTimers();
});

function makeSnap(
  gameweek: number,
  confidenceAfter: number,
  delta: number,
  reason = `MOTM vs FDR 3 opponent`,
): SnapshotPoint {
  return {
    gameweek,
    confidenceAfter,
    delta,
    rawDelta: delta,
    eventMagnitude: delta,
    reason,
    fatigueApplied: false,
    motmCounter: 0,
    defConCounter: 0,
    saveConCounter: 0,
  };
}

const SNAPS: SnapshotPoint[] = [
  makeSnap(1, 2, 2, 'MOTM vs FDR 2 opponent'),
  makeSnap(10, -1, -3, 'Blank vs FDR 4 opponent'),
  makeSnap(20, 3, 4, 'Clean sheet vs FDR 1 opponent'),
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PlayerDetailInteractive', () => {
  it('defaults to the latest snapshot — hero shows latest GW reason', () => {
    render(<PlayerDetailInteractive snapshots={SNAPS} latestGameweek={20} />);
    // GW20 reason: formatReason("Clean sheet vs FDR 1 opponent", 4, 20) → "GW20 · +4 · Clean sheet vs FDR 1 opponent"
    expect(screen.getByText(/GW20/)).toBeInTheDocument();
    expect(screen.getByText(/Clean sheet/)).toBeInTheDocument();
  });

  it('latest card is marked aria-current on initial render', () => {
    render(<PlayerDetailInteractive snapshots={SNAPS} latestGameweek={20} />);
    const selected = document.querySelector('[aria-current="true"]');
    expect(selected).not.toBeNull();
    expect(selected?.textContent).toContain('GW20');
  });

  it('clicking GW1 card updates the hero to show GW1 data', () => {
    render(<PlayerDetailInteractive snapshots={SNAPS} latestGameweek={20} />);

    const gw1Card = document.querySelector('[data-gameweek="1"]');
    expect(gw1Card).not.toBeNull();
    if (!gw1Card) return;
    fireEvent.click(gw1Card);

    // Hero reason text updates
    expect(screen.getByText(/GW1/)).toBeInTheDocument();
    expect(screen.getByText(/MOTM vs FDR 2 opponent/i)).toBeInTheDocument();
  });

  it('clicking GW1 card makes it aria-current and removes aria-current from previous', () => {
    render(<PlayerDetailInteractive snapshots={SNAPS} latestGameweek={20} />);

    const card1 = document.querySelector('[data-gameweek="1"]');
    if (!card1) throw new Error('GW1 card not found');
    fireEvent.click(card1);

    const selected = document.querySelectorAll('[aria-current="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0]?.getAttribute('data-gameweek')).toBe('1');
  });

  it('clicking a middle card selects it and updates the hero', () => {
    render(<PlayerDetailInteractive snapshots={SNAPS} latestGameweek={20} />);

    const card10 = document.querySelector('[data-gameweek="10"]');
    if (!card10) throw new Error('GW10 card not found');
    fireEvent.click(card10);

    expect(screen.getByText(/GW10/)).toBeInTheDocument();
    expect(screen.getByText(/Blank vs FDR 4 opponent/i)).toBeInTheDocument();
  });

  it('ConfidenceNumber receives animated=true on initial mount', () => {
    vi.useFakeTimers();
    render(<PlayerDetailInteractive snapshots={SNAPS} latestGameweek={20} />);

    const num = screen.getByTestId('confidence-number');
    expect(num.getAttribute('data-animated')).toBe('true');
  });

  it('ConfidenceNumber receives animated=false after 900ms mount timer', () => {
    vi.useFakeTimers();
    render(<PlayerDetailInteractive snapshots={SNAPS} latestGameweek={20} />);

    vi.advanceTimersByTime(901);
    vi.useRealTimers();

    const num = screen.getByTestId('confidence-number');
    expect(num.getAttribute('data-animated')).toBe('false');
  });

  it('ConfidenceNumber snaps (animated=false) on card click after mount', () => {
    vi.useFakeTimers();
    render(<PlayerDetailInteractive snapshots={SNAPS} latestGameweek={20} />);
    vi.advanceTimersByTime(901);
    vi.useRealTimers();

    const card = document.querySelector('[data-gameweek="1"]');
    if (!card) throw new Error('GW1 card not found');
    fireEvent.click(card);

    const num = screen.getByTestId('confidence-number');
    expect(num.getAttribute('data-animated')).toBe('false');
  });

  it('renders with empty snapshots without crashing', () => {
    expect(() =>
      render(<PlayerDetailInteractive snapshots={[]} latestGameweek={0} />),
    ).not.toThrow();
  });

  it('has no axe violations', async () => {
    const { container } = render(<PlayerDetailInteractive snapshots={SNAPS} latestGameweek={20} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
