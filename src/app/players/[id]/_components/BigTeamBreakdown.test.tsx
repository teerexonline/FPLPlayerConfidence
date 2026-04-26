import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'jest-axe';
import { BigTeamBreakdown } from './BigTeamBreakdown';
import type { SnapshotPoint } from './types';

function makeSnap(gameweek: number, delta: number, reason: string): SnapshotPoint {
  return {
    gameweek,
    confidenceAfter: delta,
    delta,
    reason,
    fatigueApplied: false,
    motmCounter: 0,
  };
}

const MIXED: SnapshotPoint[] = [
  makeSnap(1, 3, 'MOTM vs big team'),
  makeSnap(2, -1, 'Blank vs big team'),
  makeSnap(3, 1, 'Clean sheet vs non-big team'),
  makeSnap(4, -2, 'Blank vs non-big team'),
  makeSnap(5, 2, 'MOTM vs non-big team'),
];

describe('BigTeamBreakdown', () => {
  it('renders two stat blocks', () => {
    render(<BigTeamBreakdown snapshots={MIXED} />);
    expect(screen.getByText('vs Big Teams')).toBeInTheDocument();
    expect(screen.getByText('vs Others')).toBeInTheDocument();
  });

  it('computes correct big team average', () => {
    // big team: GW1 (+3), GW2 (-1) → avg = +1.0
    render(<BigTeamBreakdown snapshots={MIXED} />);
    expect(screen.getByText('+1.0')).toBeInTheDocument();
  });

  it('computes correct non-big team average', () => {
    // others: GW3 (+1), GW4 (-2), GW5 (+2) → avg = +0.3
    render(<BigTeamBreakdown snapshots={MIXED} />);
    expect(screen.getByText('+0.3')).toBeInTheDocument();
  });

  it('shows correct match count for big team', () => {
    render(<BigTeamBreakdown snapshots={MIXED} />);
    expect(screen.getByText('2 matches')).toBeInTheDocument();
  });

  it('shows correct match count for others', () => {
    render(<BigTeamBreakdown snapshots={MIXED} />);
    expect(screen.getByText('3 matches')).toBeInTheDocument();
  });

  it('shows dash and "No matches" for empty big team bucket', () => {
    // Filter using the same logic as the component (not raw string contains)
    const nonBigOnly = MIXED.filter((s) => /non-big team/i.test(s.reason));
    render(<BigTeamBreakdown snapshots={nonBigOnly} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('uses negative color class for negative average', () => {
    const negOnly = [makeSnap(1, -2, 'Blank vs big team'), makeSnap(2, -3, 'Blank vs big team')];
    const { container } = render(<BigTeamBreakdown snapshots={negOnly} />);
    const negEl = container.querySelector('[data-sign="negative"]');
    expect(negEl).not.toBeNull();
  });

  it('renders section with aria-label', () => {
    render(<BigTeamBreakdown snapshots={MIXED} />);
    expect(screen.getByRole('region', { name: /big team breakdown/i })).toBeInTheDocument();
  });

  it('shows singular "match" for count = 1', () => {
    render(<BigTeamBreakdown snapshots={[makeSnap(1, 2, 'MOTM vs big team')]} />);
    expect(screen.getByText('1 match')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<BigTeamBreakdown snapshots={MIXED} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
