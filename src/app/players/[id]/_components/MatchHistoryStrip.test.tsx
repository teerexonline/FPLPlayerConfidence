import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'jest-axe';
import { MatchHistoryStrip } from './MatchHistoryStrip';
import { parseDgwReason } from './types';
import type { SnapshotPoint } from './types';

const SAMPLE_SNAPSHOTS: SnapshotPoint[] = [
  {
    gameweek: 1,
    confidenceAfter: 1,
    delta: 1,
    rawDelta: 1,
    eventMagnitude: 1,
    reason: 'Clean sheet vs FDR 2 opponent',
    fatigueApplied: false,
    motmCounter: 0,
    defConCounter: 0,
    saveConCounter: 0,
  },
  {
    gameweek: 2,
    confidenceAfter: 3,
    delta: 2,
    rawDelta: 2,
    eventMagnitude: 2,
    reason: 'MOTM vs FDR 3 opponent',
    fatigueApplied: false,
    motmCounter: 1,
    defConCounter: 0,
    saveConCounter: 0,
  },
  {
    gameweek: 3,
    confidenceAfter: 1,
    delta: -2,
    rawDelta: -2,
    eventMagnitude: -2,
    reason: 'Blank vs FDR 3 opponent',
    fatigueApplied: false,
    motmCounter: 0,
    defConCounter: 0,
    saveConCounter: 0,
  },
];

describe('MatchHistoryStrip', () => {
  it('renders all cards', () => {
    render(<MatchHistoryStrip snapshots={SAMPLE_SNAPSHOTS} />);
    expect(screen.getByText('GW1')).toBeInTheDocument();
    expect(screen.getByText('GW2')).toBeInTheDocument();
    expect(screen.getByText('GW3')).toBeInTheDocument();
  });

  it('shows match count badge', () => {
    render(<MatchHistoryStrip snapshots={SAMPLE_SNAPSHOTS} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders section with aria-label', () => {
    render(<MatchHistoryStrip snapshots={SAMPLE_SNAPSHOTS} />);
    expect(screen.getByRole('region', { name: /match history/i })).toBeInTheDocument();
  });

  it('renders list with aria-label', () => {
    render(<MatchHistoryStrip snapshots={SAMPLE_SNAPSHOTS} />);
    expect(screen.getByRole('list', { name: /match cards/i })).toBeInTheDocument();
  });

  it('renders empty state when no snapshots', () => {
    render(<MatchHistoryStrip snapshots={[]} />);
    expect(screen.getByText(/no match history/i)).toBeInTheDocument();
  });

  it('does not show count badge in empty state', () => {
    render(<MatchHistoryStrip snapshots={[]} />);
    // Count badge only appears when count > 0
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<MatchHistoryStrip snapshots={SAMPLE_SNAPSHOTS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations in empty state', async () => {
    const { container } = render(<MatchHistoryStrip snapshots={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders a DGW snapshot as a DGW card with DGW badge', () => {
    const dgwSnapshot: SnapshotPoint = {
      gameweek: 26,
      confidenceAfter: 0,
      delta: -2,
      rawDelta: -2,
      eventMagnitude: -1,
      reason: 'DGW: Blank vs FDR 3 opponent (-1) + Blank vs FDR 2 opponent (-1)',
      fatigueApplied: false,
      motmCounter: 0,
      defConCounter: 0,
      saveConCounter: 0,
    };
    render(<MatchHistoryStrip snapshots={[dgwSnapshot]} />);
    expect(screen.getByText('DGW')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
  });

  it('renders a DGW snapshot with fatigue clause correctly', () => {
    const dgwSnapshot: SnapshotPoint = {
      gameweek: 26,
      confidenceAfter: 3,
      delta: -1,
      rawDelta: -1,
      eventMagnitude: 2,
      reason: 'DGW: MOTM vs FDR 3 opponent + Fatigue −2 (+0) + Blank vs FDR 2 opponent (-1)',
      fatigueApplied: true,
      motmCounter: 0,
      defConCounter: 0,
      saveConCounter: 0,
    };
    render(<MatchHistoryStrip snapshots={[dgwSnapshot]} />);
    expect(screen.getByText('DGW')).toBeInTheDocument();
  });
});

// ── DGW streak computation ────────────────────────────────────────────────────

function makeSnap(overrides: Partial<SnapshotPoint>): SnapshotPoint {
  return {
    gameweek: 1,
    confidenceAfter: 0,
    delta: 0,
    rawDelta: 0,
    eventMagnitude: 0,
    reason: 'MOTM vs FDR 3 opponent',
    fatigueApplied: false,
    motmCounter: 0,
    defConCounter: 0,
    saveConCounter: 0,
    ...overrides,
  };
}

describe('MatchHistoryStrip — DGW streak computation', () => {
  it('shows flame on DGW sub-match A (boost) and sub-match B (matchesSince=1), both mild', () => {
    // DGW: part A delta=3 (mild boost, matchOrder=1), part B delta=-1 (matchOrder=2, matchesSince=1)
    // GW28 (matchOrder=0, delta=1) provides no boost — streak starts on DGW sub-match A.
    const snapshots: SnapshotPoint[] = [
      makeSnap({ gameweek: 28, delta: 1 }),
      {
        gameweek: 29,
        confidenceAfter: 2,
        delta: 2,
        rawDelta: 2,
        eventMagnitude: 3,
        reason: 'DGW: MOTM vs FDR 3 opponent (+3) + Blank vs FDR 2 opponent (-1)',
        fatigueApplied: false,
        motmCounter: 1,
        defConCounter: 0,
        saveConCounter: 0,
      },
    ];
    render(<MatchHistoryStrip snapshots={snapshots} />);
    // Sub-match A is the boost match (matchesSinceBoost=0 → this match)
    // Sub-match B is one step after (matchesSinceBoost=1 → 1 match ago)
    expect(
      screen.getByRole('img', { name: 'Hot streak: +3 boost in GW29 (this match)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Hot streak: +3 boost in GW29 (1 match ago)' }),
    ).toBeInTheDocument();
  });

  it('shows flame on the GW after a DGW boost (matchesSince=2, still in window)', () => {
    // DGW GW29: sub-match A (matchOrder=0, delta=3 → mild boost), sub-match B (matchOrder=1)
    // GW30: matchOrder=2 → matchesSinceBoost=2 → still in the 3-match window
    const snapshots: SnapshotPoint[] = [
      {
        gameweek: 29,
        confidenceAfter: 2,
        delta: 2,
        rawDelta: 2,
        eventMagnitude: 3,
        reason: 'DGW: MOTM vs FDR 3 opponent (+3) + Blank vs FDR 2 opponent (-1)',
        fatigueApplied: false,
        motmCounter: 1,
        defConCounter: 0,
        saveConCounter: 0,
      },
      makeSnap({ gameweek: 30, delta: -1 }),
    ];
    render(<MatchHistoryStrip snapshots={snapshots} />);
    // DGW sub-match A: matchesSinceBoost=0 → (this match)
    // DGW sub-match B: matchesSinceBoost=1 → (1 match ago)
    // GW30: matchesSinceBoost=2 → (2 matches ago)
    expect(
      screen.getByRole('img', { name: 'Hot streak: +3 boost in GW29 (this match)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Hot streak: +3 boost in GW29 (1 match ago)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Hot streak: +3 boost in GW29 (2 matches ago)' }),
    ).toBeInTheDocument();
  });

  it('shows no flame three matches after a DGW boost (streak expired at matchesSince=3)', () => {
    const snapshots: SnapshotPoint[] = [
      {
        gameweek: 29,
        confidenceAfter: 2,
        delta: 2,
        rawDelta: 2,
        eventMagnitude: 3,
        reason: 'DGW: MOTM vs FDR 3 opponent (+3) + Blank vs FDR 2 opponent (-1)',
        fatigueApplied: false,
        motmCounter: 1,
        defConCounter: 0,
        saveConCounter: 0,
      },
      makeSnap({ gameweek: 30, delta: -1 }), // matchOrder 2 → matchesSince=2 → in window
      makeSnap({ gameweek: 31, delta: 0 }), // matchOrder 3 → matchesSince=3 → expired
    ];
    render(<MatchHistoryStrip snapshots={snapshots} />);
    // DGW sub-match A/B and GW30 all show GW29 boost (each with their own recency suffix)
    expect(
      screen.getByRole('img', { name: 'Hot streak: +3 boost in GW29 (this match)' }),
    ).toBeInTheDocument();
    // GW31 has no flame — matchesSinceBoost=3 is outside the 3-match window
    expect(screen.queryByRole('img', { name: /boost in GW31/i })).toBeNull();
  });
});

// ── parseDgwReason unit tests ─────────────────────────────────────────────────

describe('parseDgwReason', () => {
  it('returns null for non-DGW reasons', () => {
    expect(parseDgwReason('Blank vs FDR 3 opponent')).toBeNull();
    expect(parseDgwReason('MOTM vs FDR 5 opponent')).toBeNull();
  });

  it('parses a simple two-blank DGW', () => {
    const result = parseDgwReason(
      'DGW: Blank vs FDR 3 opponent (-1) + Blank vs FDR 2 opponent (-1)',
    );
    expect(result).toHaveLength(2);
    expect(result?.[0]).toEqual({ reason: 'Blank vs FDR 3 opponent', delta: -1 });
    expect(result?.[1]).toEqual({ reason: 'Blank vs FDR 2 opponent', delta: -1 });
  });

  it('parses DGW with fatigue embedded in first entry reason', () => {
    const result = parseDgwReason(
      'DGW: MOTM vs FDR 3 opponent + Fatigue −2 (+0) + Blank vs FDR 2 opponent (-1)',
    );
    expect(result).toHaveLength(2);
    expect(result?.[0]).toEqual({ reason: 'MOTM vs FDR 3 opponent + Fatigue −2', delta: 0 });
    expect(result?.[1]).toEqual({ reason: 'Blank vs FDR 2 opponent', delta: -1 });
  });

  it('parses DGW with GK assist (MOTM) embedded in reason', () => {
    const result = parseDgwReason(
      'DGW: DefCon vs FDR 3 opponent (+0) + Assist vs FDR 2 opponent (MOTM) + Fatigue −2 (-2)',
    );
    expect(result).toHaveLength(2);
    expect(result?.[0]).toEqual({ reason: 'DefCon vs FDR 3 opponent', delta: 0 });
    expect(result?.[1]).toEqual({
      reason: 'Assist vs FDR 2 opponent (MOTM) + Fatigue −2',
      delta: -2,
    });
  });

  it('parses positive net DGW', () => {
    const result = parseDgwReason(
      'DGW: MOTM vs FDR 3 opponent (+2) + Blank vs FDR 2 opponent (-1)',
    );
    expect(result).toHaveLength(2);
    expect(result?.[0]).toEqual({ reason: 'MOTM vs FDR 3 opponent', delta: 2 });
    expect(result?.[1]).toEqual({ reason: 'Blank vs FDR 2 opponent', delta: -1 });
  });
});
