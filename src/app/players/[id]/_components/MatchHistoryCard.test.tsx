import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'jest-axe';
import { MatchHistoryCard } from './MatchHistoryCard';
import type { SnapshotPoint } from './types';

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

  it('renders a fresh-streak (red_hot) flame on the boost GW', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ gameweek: 31, delta: 5 })}
        hotStreakLevel="red_hot"
      />,
    );
    expect(screen.getByRole('img', { name: 'Fresh streak · GW31' })).toBeInTheDocument();
  });

  it('renders a recent-streak (med_hot) flame on the GW after the boost', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ gameweek: 32, delta: -1 })}
        hotStreakLevel="med_hot"
      />,
    );
    expect(screen.getByRole('img', { name: 'Recent streak · GW32' })).toBeInTheDocument();
  });

  it('renders a fading-streak (low_hot) flame two GWs after the boost', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ gameweek: 33, delta: 1 })}
        hotStreakLevel="low_hot"
      />,
    );
    expect(screen.getByRole('img', { name: 'Fading streak · GW33' })).toBeInTheDocument();
  });

  it('renders no streak flame when hotStreakLevel is null', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ gameweek: 34, delta: 2 })}
        hotStreakLevel={null}
      />,
    );
    expect(screen.queryByRole('img', { name: /streak/i })).toBeNull();
  });

  it('renders no streak flame when hotStreakLevel is not provided (cold card)', () => {
    render(<MatchHistoryCard snapshot={makeSnapshot({ delta: 5 })} />);
    expect(screen.queryByRole('img', { name: /streak/i })).toBeNull();
  });

  it('sets data-boost="true" when hotStreakLevel is red_hot', () => {
    const { container } = render(
      <MatchHistoryCard snapshot={makeSnapshot({ delta: 5 })} hotStreakLevel="red_hot" />,
    );
    expect(container.firstChild).toHaveAttribute('data-boost', 'true');
  });

  it('does not set data-boost when hotStreakLevel is med_hot', () => {
    const { container } = render(
      <MatchHistoryCard snapshot={makeSnapshot({ delta: -1 })} hotStreakLevel="med_hot" />,
    );
    expect(container.firstChild).not.toHaveAttribute('data-boost');
  });

  it('does not set data-boost when hotStreakLevel is null (even for high delta)', () => {
    const { container } = render(<MatchHistoryCard snapshot={makeSnapshot({ delta: 5 })} />);
    expect(container.firstChild).not.toHaveAttribute('data-boost');
  });

  it('renders both streak flame and BIG badge together', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ gameweek: 31, reason: 'MOTM vs BIG opponent', delta: 5 })}
        hotStreakLevel="red_hot"
      />,
    );
    expect(screen.getByRole('img', { name: 'Fresh streak · GW31' })).toBeInTheDocument();
    expect(screen.getByText('BIG')).toBeInTheDocument();
  });

  it('has no axe violations on a streak-match card', async () => {
    const { container } = render(
      <ul role="list">
        <MatchHistoryCard
          snapshot={makeSnapshot({ gameweek: 31, delta: 5 })}
          hotStreakLevel="red_hot"
        />
      </ul>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
