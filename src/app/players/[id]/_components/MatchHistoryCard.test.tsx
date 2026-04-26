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
    reason: 'MOTM vs non-big team',
    fatigueApplied: false,
    motmCounter: 1,
    ...overrides,
  };
}

describe('MatchHistoryCard', () => {
  it('renders the GW number', () => {
    render(<MatchHistoryCard snapshot={makeSnapshot({ gameweek: 17 })} />);
    expect(screen.getByText('GW17')).toBeInTheDocument();
  });

  it('renders a BIG badge for big team matches', () => {
    render(<MatchHistoryCard snapshot={makeSnapshot({ reason: 'MOTM vs big team' })} />);
    expect(screen.getByText('BIG')).toBeInTheDocument();
  });

  it('does not render BIG badge for non-big team matches', () => {
    render(<MatchHistoryCard snapshot={makeSnapshot({ reason: 'Blank vs non-big team' })} />);
    expect(screen.queryByText('BIG')).not.toBeInTheDocument();
  });

  it('shows MOTM label for motm reasons', () => {
    render(<MatchHistoryCard snapshot={makeSnapshot({ reason: 'MOTM vs non-big team' })} />);
    expect(screen.getByText('MOTM')).toBeInTheDocument();
  });

  it('shows Clean Sheet label for clean sheet reasons', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({ reason: 'Clean sheet vs non-big team', delta: 1 })}
      />,
    );
    expect(screen.getByText('Clean Sheet')).toBeInTheDocument();
  });

  it('shows Blank label for blank reasons', () => {
    render(
      <MatchHistoryCard snapshot={makeSnapshot({ reason: 'Blank vs non-big team', delta: -2 })} />,
    );
    expect(screen.getByText('Blank')).toBeInTheDocument();
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
        snapshot={makeSnapshot({ delta: -2, reason: 'Blank vs non-big team', confidenceAfter: -1 })}
      />,
    );
    const deltaEl = container.querySelector('[data-sign="negative"]');
    // Unicode minus U+2212
    expect(deltaEl?.textContent).toMatch(/−2/);
  });

  it('formats zero delta as 0', () => {
    const { container } = render(
      <MatchHistoryCard
        snapshot={makeSnapshot({
          delta: 0,
          reason: 'Assist vs non-big team (MOTM) + Clean sheet vs non-big team',
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
        snapshot={makeSnapshot({ fatigueApplied: true, reason: 'MOTM vs non-big team', delta: -2 })}
      />,
    );
    expect(screen.getByText(/fatigue/i)).toBeInTheDocument();
  });

  it('shows fatigue annotation from compound reason string', () => {
    render(
      <MatchHistoryCard
        snapshot={makeSnapshot({
          reason: 'Assist vs non-big team (MOTM) + Clean sheet vs non-big team + Fatigue −2',
          fatigueApplied: true,
          delta: -2,
        })}
      />,
    );
    expect(screen.getByText(/fatigue/i)).toBeInTheDocument();
  });

  it('has role=listitem', () => {
    const { container } = render(<MatchHistoryCard snapshot={makeSnapshot()} />);
    expect(container.firstChild).toHaveAttribute('role', 'listitem');
  });

  it('has no axe violations when rendered inside a list', async () => {
    // role=listitem requires a list parent — wrap as it is in MatchHistoryStrip
    const { container } = render(
      <ul role="list">
        <MatchHistoryCard snapshot={makeSnapshot()} />
      </ul>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
