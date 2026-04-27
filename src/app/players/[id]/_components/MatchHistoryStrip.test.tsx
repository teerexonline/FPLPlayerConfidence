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
