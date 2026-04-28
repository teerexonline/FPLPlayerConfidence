import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'jest-axe';
import { FdrBreakdown } from './BigTeamBreakdown';
import type { SnapshotPoint } from './types';

function makeSnap(gameweek: number, delta: number, reason: string): SnapshotPoint {
  return {
    gameweek,
    confidenceAfter: delta,
    delta,
    reason,
    fatigueApplied: false,
    motmCounter: 0,
    defConCounter: 0,
    saveConCounter: 0,
  };
}

const MIXED: SnapshotPoint[] = [
  makeSnap(1, 3, 'MOTM vs FDR 5 opponent'), // tough
  makeSnap(2, -1, 'Blank vs FDR 4 opponent'), // tough
  makeSnap(3, 1, 'Clean sheet vs FDR 3 opponent'), // neutral
  makeSnap(4, -2, 'Blank vs FDR 3 opponent'), // neutral
  makeSnap(5, 2, 'MOTM vs FDR 2 opponent'), // favorable
  makeSnap(6, 1, 'Performance vs FDR 1 opponent'), // favorable
];

describe('FdrBreakdown', () => {
  it('renders three tier blocks', () => {
    render(<FdrBreakdown snapshots={MIXED} />);
    expect(screen.getByText('Favorable')).toBeInTheDocument();
    expect(screen.getByText('Neutral')).toBeInTheDocument();
    expect(screen.getByText('Tough')).toBeInTheDocument();
  });

  it('renders FDR range labels', () => {
    render(<FdrBreakdown snapshots={MIXED} />);
    expect(screen.getByText('FDR 1–2')).toBeInTheDocument();
    expect(screen.getByText('FDR 3')).toBeInTheDocument();
    expect(screen.getByText('FDR 4–5 · BIG')).toBeInTheDocument();
  });

  it('computes correct tough average — GW1 (+3), GW2 (−1) → +1.0', () => {
    render(<FdrBreakdown snapshots={MIXED} />);
    expect(screen.getByText('+1.0')).toBeInTheDocument();
  });

  it('computes correct neutral average — GW3 (+1), GW4 (−2) → −0.5', () => {
    render(<FdrBreakdown snapshots={MIXED} />);
    expect(screen.getByText('−0.5')).toBeInTheDocument();
  });

  it('computes correct favorable average — GW5 (+2), GW6 (+1) → +1.5', () => {
    render(<FdrBreakdown snapshots={MIXED} />);
    expect(screen.getByText('+1.5')).toBeInTheDocument();
  });

  it('shows correct match counts', () => {
    render(<FdrBreakdown snapshots={MIXED} />);
    const twos = screen.getAllByText('2 matches');
    expect(twos).toHaveLength(3); // tough: 2, neutral: 2, favorable: 2
  });

  it('shows dash and "No matches" for an empty bucket', () => {
    const toughOnly = MIXED.filter((s) => s.reason.includes('FDR 5') || s.reason.includes('FDR 4'));
    render(<FdrBreakdown snapshots={toughOnly} />);
    // Neutral and Favorable buckets are empty
    const empties = screen.getAllByText('No matches');
    expect(empties.length).toBeGreaterThanOrEqual(2);
  });

  it('excludes snapshots with no parsable FDR token', () => {
    const withUnparsable = [...MIXED, makeSnap(99, 2, 'DGW: legacy format')];
    render(<FdrBreakdown snapshots={withUnparsable} />);
    // The unparsable snap is excluded — total counts still sum to MIXED.length (6)
    const allMatchTexts = screen.getAllByText(/\d+ match/);
    const totalMatches = allMatchTexts.reduce((sum, el) => {
      const n = parseInt(el.textContent, 10);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
    expect(totalMatches).toBe(6);
  });

  it('parses FDR from DGW compound reason — uses first match FDR', () => {
    const dgwSnap = makeSnap(
      10,
      2,
      'DGW: MOTM vs FDR 5 opponent (+2) + Blank vs FDR 3 opponent (-1)',
    );
    render(<FdrBreakdown snapshots={[dgwSnap]} />);
    // FDR 5 → Tough bucket should have 1 match; neutral/favorable should show "No matches"
    expect(screen.getByText('1 match')).toBeInTheDocument();
    const empties = screen.getAllByText('No matches');
    expect(empties).toHaveLength(2);
  });

  it('uses negative color class for negative average', () => {
    const negOnly = [
      makeSnap(1, -2, 'Blank vs FDR 5 opponent'),
      makeSnap(2, -3, 'Blank vs FDR 4 opponent'),
    ];
    const { container } = render(<FdrBreakdown snapshots={negOnly} />);
    const negEl = container.querySelector('[data-sign="negative"]');
    expect(negEl).not.toBeNull();
  });

  it('shows singular "match" for count = 1', () => {
    render(<FdrBreakdown snapshots={[makeSnap(1, 2, 'MOTM vs FDR 5 opponent')]} />);
    expect(screen.getByText('1 match')).toBeInTheDocument();
  });

  it('renders section with aria-label', () => {
    render(<FdrBreakdown snapshots={MIXED} />);
    expect(screen.getByRole('region', { name: /fdr performance breakdown/i })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<FdrBreakdown snapshots={MIXED} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ── Big team ("BIG") reason strings ──────────────────────────────────────

  it('classifies "vs BIG opponent" reason into the Tough bucket', () => {
    const bigSnap = makeSnap(1, 5, 'MOTM vs BIG opponent');
    render(<FdrBreakdown snapshots={[bigSnap]} />);
    // Tough bucket has 1 match; neutral and favorable are empty
    expect(screen.getByText('1 match')).toBeInTheDocument();
    const empties = screen.getAllByText('No matches');
    expect(empties).toHaveLength(2);
  });

  it('mixes BIG and FDR 4-5 reasons into the same Tough bucket', () => {
    const snaps = [
      makeSnap(1, 5, 'MOTM vs BIG opponent'),
      makeSnap(2, -1, 'Blank vs FDR 4 opponent'),
      makeSnap(3, 3, 'MOTM vs FDR 5 opponent'),
    ];
    render(<FdrBreakdown snapshots={snaps} />);
    expect(screen.getByText('3 matches')).toBeInTheDocument();
  });

  it('BIG reasons in a DGW compound string classify into Tough', () => {
    const dgwBig = makeSnap(10, 3, 'DGW: MOTM vs BIG opponent (+5) + Blank vs FDR 3 opponent (-1)');
    render(<FdrBreakdown snapshots={[dgwBig]} />);
    expect(screen.getByText('1 match')).toBeInTheDocument();
    const empties = screen.getAllByText('No matches');
    expect(empties).toHaveLength(2);
  });
});
