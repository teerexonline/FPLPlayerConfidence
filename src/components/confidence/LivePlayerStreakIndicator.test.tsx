import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LivePlayerStreakIndicator } from './LivePlayerStreakIndicator';
import type { LivePlayerStreakIndicatorProps } from './LivePlayerStreakIndicator';
import type { HotStreakInfo } from '@/lib/confidence/hotStreak';

const HOT_STREAK: HotStreakInfo = {
  level: 'hot',
  boostDelta: 5,
  boostGw: 33,
  matchesSinceBoost: 0,
  intensity: 'high',
};

const BASE: LivePlayerStreakIndicatorProps = {
  hotStreak: HOT_STREAK,
  status: 'a',
  isStale: false,
};

describe('LivePlayerStreakIndicator', () => {
  it('renders the flame when player is available and not stale', () => {
    render(<LivePlayerStreakIndicator {...BASE} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders null when hotStreak is null (player is cold)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} hotStreak={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when status is injured (i)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="i" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when status is doubtful (d)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="d" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when status is suspended (s)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="s" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when status is not available (n)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="n" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when status is unavailable (u)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="u" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when isStale is true (available but stale data)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} isStale={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when both injured and stale (status takes effect first)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="i" isStale={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the flame when status is empty string (treated as available)', () => {
    render(<LivePlayerStreakIndicator {...BASE} status="" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('passes size=lg to HotStreakIndicator — renders text label', () => {
    render(<LivePlayerStreakIndicator {...BASE} size="lg" />);
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });

  it('renders warm flame correctly — tooltip shows +4 boost with recency', () => {
    const warmStreak: HotStreakInfo = {
      level: 'warm',
      boostDelta: 4,
      boostGw: 20,
      matchesSinceBoost: 0,
      intensity: 'high',
    };
    render(<LivePlayerStreakIndicator {...BASE} hotStreak={warmStreak} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'title',
      'Hot streak: +4 boost in GW20 (this match)',
    );
  });

  it('renders mild flame correctly — tooltip shows +3 boost with recency', () => {
    const mildStreak: HotStreakInfo = {
      level: 'mild',
      boostDelta: 3,
      boostGw: 21,
      matchesSinceBoost: 1,
      intensity: 'med',
    };
    render(<LivePlayerStreakIndicator {...BASE} hotStreak={mildStreak} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'title',
      'Hot streak: +3 boost in GW21 (1 match ago)',
    );
  });
});
