import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeAll } from 'vitest';
import { axe } from 'jest-axe';
import { ConfidenceChart } from './ConfidenceChart';
import type { SnapshotPoint } from '@/app/players/[id]/_components/types';

// Recharts uses ResizeObserver internally — polyfill for jsdom
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

function makeSnap(
  gameweek: number,
  confidenceAfter: number,
  delta: number,
  reason = 'MOTM vs non-big team',
): SnapshotPoint {
  return { gameweek, confidenceAfter, delta, reason, fatigueApplied: false, motmCounter: 0 };
}

const SNAPSHOTS: SnapshotPoint[] = [
  makeSnap(1, 2, 2),
  makeSnap(2, 3, 1),
  makeSnap(3, 1, -2, 'Blank vs non-big team'),
  makeSnap(4, 3, 2),
  makeSnap(5, 5, 2),
];

describe('ConfidenceChart', () => {
  it('renders with aria-label', () => {
    render(<ConfidenceChart snapshots={SNAPSHOTS} currentConfidence={5} />);
    expect(screen.getByRole('region', { name: /confidence over time/i })).toBeInTheDocument();
  });

  it('renders section header text', () => {
    render(<ConfidenceChart snapshots={SNAPSHOTS} currentConfidence={5} />);
    expect(screen.getByText(/confidence over time/i)).toBeInTheDocument();
  });

  it('renders empty state when no snapshots', () => {
    render(<ConfidenceChart snapshots={[]} currentConfidence={0} />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it('renders the chart wrapper for non-empty snapshots', () => {
    // ResponsiveContainer needs real layout to render SVG; in jsdom we check the wrapper exists
    const { container } = render(<ConfidenceChart snapshots={SNAPSHOTS} currentConfidence={3} />);
    // The recharts ResponsiveContainer div is present even without layout
    expect(container.querySelector('.recharts-responsive-container')).not.toBeNull();
  });

  it('does not render chart wrapper for empty snapshots', () => {
    const { container } = render(<ConfidenceChart snapshots={[]} currentConfidence={0} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeNull();
  });

  it('renders without error for positive currentConfidence', () => {
    const { container } = render(<ConfidenceChart snapshots={SNAPSHOTS} currentConfidence={3} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders without error for negative currentConfidence', () => {
    const negSnaps = [makeSnap(1, -2, -2, 'Blank vs big team')];
    const { container } = render(<ConfidenceChart snapshots={negSnaps} currentConfidence={-2} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders without error for neutral currentConfidence', () => {
    const neutralSnaps = [makeSnap(1, 0, 0)];
    const { container } = render(
      <ConfidenceChart snapshots={neutralSnaps} currentConfidence={0} />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ConfidenceChart snapshots={SNAPSHOTS} currentConfidence={5} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations in empty state', async () => {
    const { container } = render(<ConfidenceChart snapshots={[]} currentConfidence={0} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
