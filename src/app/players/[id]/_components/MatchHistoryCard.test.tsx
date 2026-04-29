import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'jest-axe';
import { MatchHistoryCard } from './MatchHistoryCard';
import type { SnapshotPoint } from './types';
import type { HotStreakInfo } from '@/lib/confidence/hotStreak';

function makeHotStreak(overrides: Partial<HotStreakInfo> = {}): HotStreakInfo {
  return {
    level: 'hot',
    boostDelta: 5,
    boostGw: 31,
    matchesSinceBoost: 0,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<SnapshotPoint> = {}): SnapshotPoint {
  return {
    gameweek: 12,
    confidenceAfter: 2,
    delta: 2,
    reason: 'MOTM vs FDR 3 opponent',
    fatigueApplied: false,
    motmCounter: 1,
    defConCounter: 0,
    saveConCounter: 0,
    ...overrides,
  };
}

describe('MatchHistoryCard', () => {
  it('renders the GW number', () => {
    render(<MatchHistoryCard snapshot={makeSnapshot({ gameweek: 17 })} />);
    expect(screen.getByText('GW17')).toBeInTheDocument();
  });

  it('shows MOTM label for motm reasons', () => {
    render(<MatchHistoryCard snapshot={makeSnapshot({ reason: 'MOTM vs FDR 3 opponent' })} />);
    expect(screen.getByText('MOTM')).toBeInTheDocument();
  });

  it('shows Clean Sheet label for clean sheet reasons', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ reason: 'Clean sheet vs FDR 2 opponent', delta: 1 })}
      />,
    );
    expect(screen.getByText('Clean Sheet')).toBeInTheDocument();
  });

  it('shows Blank label for blank reasons', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ reason: 'Blank vs FDR 3 opponent', delta: -1 })}
      />,
    );
    expect(screen.getByText('Blank')).toBeInTheDocument();
  });

  it('shows DefCon label for defcon reasons', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ reason: 'DefCon vs FDR 3 opponent', delta: 1 })}
      />,
    );
    expect(screen.getByText('DefCon')).toBeInTheDocument();
  });

  it('shows SaveCon label for savecon reasons', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ reason: 'SaveCon vs FDR 4 opponent', delta: 1 })}
      />,
    );
    expect(screen.getByText('SaveCon')).toBeInTheDocument();
  });

  it('shows Fatigue label for fatigue reasons', () => {
    render(<MatchHistoryCard snapshot={makeSnapshot({ reason: 'Fatigue penalty', delta: -2 })} />);
    expect(screen.getByText('Fatigue')).toBeInTheDocument();
  });

  it('formats positive delta with + sign', () => {
    const { container } = render(<MatchHistoryCard snapshot={makeSnapshot({ delta: 3 })} />);
    const deltaEl = container.querySelector('[data-sign="positive"]');
    expect(deltaEl?.textContent).toBe('+3');
  });

  it('formats negative delta with unicode minus', () => {
    const { container } = render(
      <MatchHistoryCard
        snapshot={makeSnapshot({
          delta: -2,
          reason: 'Blank vs FDR 3 opponent',
          confidenceAfter: -1,
        })}
      />,
    );
    const deltaEl = container.querySelector('[data-sign="negative"]');
    expect(deltaEl?.textContent).toMatch(/−2/);
  });

  it('formats zero delta as 0', () => {
    const { container } = render(
      <MatchHistoryCard
        snapshot={makeSnapshot({
          delta: 0,
          reason: 'MOTM vs FDR 3 opponent + Clean sheet vs FDR 3 opponent',
          confidenceAfter: 5,
        })}
      />,
    );
    const deltaEl = container.querySelector('[data-sign="neutral"]');
    expect(deltaEl?.textContent).toBe('0');
  });

  it('shows fatigue annotation when fatigueApplied is true', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({
          fatigueApplied: true,
          reason: 'MOTM vs FDR 3 opponent + Fatigue −2',
          delta: -2,
        })}
      />,
    );
    expect(screen.getByText(/fatigue/i)).toBeInTheDocument();
  });

  it('shows fatigue annotation from compound reason string', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({
          reason: 'MOTM vs FDR 3 opponent + Clean sheet vs FDR 3 opponent + Fatigue −2',
          fatigueApplied: true,
          delta: -2,
        })}
      />,
    );
    expect(screen.getByText(/fatigue/i)).toBeInTheDocument();
  });

  it('shows BIG badge when reason contains "vs BIG opponent"', () => {
    render(
      <MatchHistoryCard snapshot={makeSnapshot({ reason: 'MOTM vs BIG opponent', delta: 5 })} />,
    );
    expect(screen.getByText('BIG')).toBeInTheDocument();
  });

  it('does not show BIG badge for standard FDR reason strings', () => {
    render(
      <MatchHistoryCard snapshot={makeSnapshot({ reason: 'MOTM vs FDR 5 opponent', delta: 5 })} />,
    );
    expect(screen.queryByText('BIG')).toBeNull();
  });

  it('BIG badge has aria-label for accessibility', () => {
    render(
      <MatchHistoryCard snapshot={makeSnapshot({ reason: 'Blank vs BIG opponent', delta: -1 })} />,
    );
    expect(screen.getByLabelText('big team opponent')).toBeInTheDocument();
  });

  it('has role=listitem', () => {
    const { container } = render(<MatchHistoryCard snapshot={makeSnapshot()} />);
    expect(container.firstChild).toHaveAttribute('role', 'listitem');
  });

  it('has no axe violations when rendered inside a list', async () => {
    const { container } = render(
      <ul role="list">
        <MatchHistoryCard snapshot={makeSnapshot()} />
      </ul>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ── Streak and boost visual emphasis ─────────────────────────────────────

  it('renders a hot flame on the boost match (matchesSinceBoost=0)', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ gameweek: 31, delta: 5 })}
        hotStreak={makeHotStreak({
          level: 'hot',
          boostDelta: 5,
          boostGw: 31,
          matchesSinceBoost: 0,
        })}
      />,
    );
    expect(screen.getByRole('img', { name: 'Hot streak: +5 boost in GW31' })).toBeInTheDocument();
  });

  it('renders a warm flame on a streak-window card (matchesSinceBoost=1)', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ gameweek: 32, delta: -1 })}
        hotStreak={makeHotStreak({
          level: 'warm',
          boostDelta: 4,
          boostGw: 31,
          matchesSinceBoost: 1,
        })}
      />,
    );
    expect(screen.getByRole('img', { name: 'Hot streak: +4 boost in GW31' })).toBeInTheDocument();
  });

  it('renders a mild flame two matches after boost (matchesSinceBoost=2)', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ gameweek: 33, delta: 1 })}
        hotStreak={makeHotStreak({
          level: 'mild',
          boostDelta: 3,
          boostGw: 31,
          matchesSinceBoost: 2,
        })}
      />,
    );
    expect(screen.getByRole('img', { name: 'Hot streak: +3 boost in GW31' })).toBeInTheDocument();
  });

  it('hot flame carries same tooltip regardless of which match in window', () => {
    // All 3 cards of a +5 boost show 'hot' level with identical tooltip
    const streak1 = makeHotStreak({
      level: 'hot',
      boostDelta: 5,
      boostGw: 31,
      matchesSinceBoost: 0,
    });
    const streak2 = makeHotStreak({
      level: 'hot',
      boostDelta: 5,
      boostGw: 31,
      matchesSinceBoost: 1,
    });
    const streak3 = makeHotStreak({
      level: 'hot',
      boostDelta: 5,
      boostGw: 31,
      matchesSinceBoost: 2,
    });
    for (const hotStreak of [streak1, streak2, streak3]) {
      const { unmount } = render(
        <MatchHistoryCard snapshot={makeSnapshot()} hotStreak={hotStreak} />,
      );
      expect(screen.getByRole('img', { name: 'Hot streak: +5 boost in GW31' })).toBeInTheDocument();
      unmount();
    }
  });

  it('renders no streak flame when hotStreak is null', () => {
    render(
      <MatchHistoryCard snapshot={makeSnapshot({ gameweek: 34, delta: 2 })} hotStreak={null} />,
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders no streak flame when hotStreak is not provided (cold card)', () => {
    render(<MatchHistoryCard snapshot={makeSnapshot({ delta: 5 })} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('sets data-boost="true" when matchesSinceBoost is 0 (the boost match itself)', () => {
    const { container } = render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ delta: 5 })}
        hotStreak={makeHotStreak({ matchesSinceBoost: 0 })}
      />,
    );
    expect(container.firstChild).toHaveAttribute('data-boost', 'true');
  });

  it('does not set data-boost when matchesSinceBoost is 1', () => {
    const { container } = render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ delta: -1 })}
        hotStreak={makeHotStreak({ matchesSinceBoost: 1 })}
      />,
    );
    expect(container.firstChild).not.toHaveAttribute('data-boost');
  });

  it('does not set data-boost when hotStreak is null (even for high delta)', () => {
    const { container } = render(<MatchHistoryCard snapshot={makeSnapshot({ delta: 5 })} />);
    expect(container.firstChild).not.toHaveAttribute('data-boost');
  });

  it('renders both streak flame and BIG badge together', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ gameweek: 31, reason: 'MOTM vs BIG opponent', delta: 5 })}
        hotStreak={makeHotStreak({ boostGw: 31 })}
      />,
    );
    expect(screen.getByRole('img', { name: 'Hot streak: +5 boost in GW31' })).toBeInTheDocument();
    expect(screen.getByText('BIG')).toBeInTheDocument();
  });

  it('has no axe violations on a streak-match card', async () => {
    const { container } = render(
      <ul role="list">
        <MatchHistoryCard
          snapshot={makeSnapshot({ gameweek: 31, delta: 5 })}
          hotStreak={makeHotStreak()}
        />
      </ul>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
