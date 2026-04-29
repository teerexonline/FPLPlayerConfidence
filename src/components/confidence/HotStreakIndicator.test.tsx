import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { HotStreakIndicator } from './HotStreakIndicator';
import type { HotStreakInfo, HotStreakLevel } from '@/lib/confidence/hotStreak';

function makeStreak(overrides: Partial<HotStreakInfo> = {}): HotStreakInfo {
  return {
    level: 'hot',
    boostDelta: 5,
    boostGw: 33,
    matchesSinceBoost: 0,
    ...overrides,
  };
}

// ── null hotStreak ────────────────────────────────────────────────────────────

describe('HotStreakIndicator — null hotStreak', () => {
  it('renders nothing when hotStreak is null (sm)', () => {
    const { container } = render(<HotStreakIndicator hotStreak={null} size="sm" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when hotStreak is null (lg)', () => {
    const { container } = render(<HotStreakIndicator hotStreak={null} size="lg" />);
    expect(container.firstChild).toBeNull();
  });
});

// ── sm variant ───────────────────────────────────────────────────────────────

describe('HotStreakIndicator — sm variant', () => {
  it('renders a role=img element for hot', () => {
    render(<HotStreakIndicator hotStreak={makeStreak({ level: 'hot' })} size="sm" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders a role=img element for warm', () => {
    render(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'warm', boostDelta: 4 })} size="sm" />,
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders a role=img element for mild', () => {
    render(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'mild', boostDelta: 3 })} size="sm" />,
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('tooltip includes boost delta and GW when boostGw is provided', () => {
    render(<HotStreakIndicator hotStreak={makeStreak({ boostDelta: 5, boostGw: 33 })} size="sm" />);
    expect(screen.getByRole('img')).toHaveAttribute('title', 'Hot streak: +5 boost in GW33');
  });

  it('tooltip omits GW when boostGw is null', () => {
    render(
      <HotStreakIndicator hotStreak={makeStreak({ boostDelta: 5, boostGw: null })} size="sm" />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('title', 'Hot streak: +5 boost');
  });

  it('aria-label matches tooltip text', () => {
    render(<HotStreakIndicator hotStreak={makeStreak({ boostDelta: 4, boostGw: 20 })} size="sm" />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toBe(img.getAttribute('title'));
  });

  it('does not animate the icon in sm variant', () => {
    const { container } = render(<HotStreakIndicator hotStreak={makeStreak()} size="sm" />);
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('defaults to sm when size is omitted', () => {
    render(<HotStreakIndicator hotStreak={makeStreak()} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img.querySelector('.animate-pulse')).toBeNull();
  });

  it('passes extra className to the wrapper span', () => {
    render(<HotStreakIndicator hotStreak={makeStreak()} size="sm" className="test-class" />);
    expect(screen.getByRole('img')).toHaveClass('test-class');
  });

  it('warm level tooltip references +4 boost', () => {
    render(
      <HotStreakIndicator
        hotStreak={makeStreak({ level: 'warm', boostDelta: 4, boostGw: 21 })}
        size="sm"
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('title', 'Hot streak: +4 boost in GW21');
  });

  it('mild level tooltip references +3 boost', () => {
    render(
      <HotStreakIndicator
        hotStreak={makeStreak({ level: 'mild', boostDelta: 3, boostGw: 22 })}
        size="sm"
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('title', 'Hot streak: +3 boost in GW22');
  });
});

// ── lg variant ───────────────────────────────────────────────────────────────

describe('HotStreakIndicator — lg variant', () => {
  it('renders a role=img element for each level', () => {
    const { rerender } = render(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'hot' })} size="lg" />,
    );
    expect(screen.getByRole('img')).toBeInTheDocument();

    rerender(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'warm', boostDelta: 4 })} size="lg" />,
    );
    expect(screen.getByRole('img')).toBeInTheDocument();

    rerender(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'mild', boostDelta: 3 })} size="lg" />,
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('animates the flame icon for hot (lg)', () => {
    const { container } = render(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'hot' })} size="lg" />,
    );
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('does NOT animate the flame for warm (lg)', () => {
    const { container } = render(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'warm', boostDelta: 4 })} size="lg" />,
    );
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('does NOT animate the flame for mild (lg)', () => {
    const { container } = render(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'mild', boostDelta: 3 })} size="lg" />,
    );
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('renders level text "Hot" for hot', () => {
    render(<HotStreakIndicator hotStreak={makeStreak({ level: 'hot' })} size="lg" />);
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });

  it('renders level text "Warm" for warm', () => {
    render(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'warm', boostDelta: 4 })} size="lg" />,
    );
    expect(screen.getByText('Warm')).toBeInTheDocument();
  });

  it('renders level text "Mild" for mild', () => {
    render(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'mild', boostDelta: 3 })} size="lg" />,
    );
    expect(screen.getByText('Mild')).toBeInTheDocument();
  });

  it('shows boost GW sublabel when boostGw is provided', () => {
    render(<HotStreakIndicator hotStreak={makeStreak({ boostGw: 33 })} size="lg" />);
    expect(screen.getByText('GW33')).toBeInTheDocument();
  });

  it('does not show GW sublabel when boostGw is null', () => {
    render(<HotStreakIndicator hotStreak={makeStreak({ boostGw: null })} size="lg" />);
    expect(screen.queryByText(/^GW\d+$/)).toBeNull();
  });

  it('updates GW sublabel when boostGw changes', () => {
    const { rerender } = render(
      <HotStreakIndicator hotStreak={makeStreak({ boostGw: 19 })} size="lg" />,
    );
    expect(screen.getByText('GW19')).toBeInTheDocument();

    rerender(<HotStreakIndicator hotStreak={makeStreak({ boostGw: 20 })} size="lg" />);
    expect(screen.getByText('GW20')).toBeInTheDocument();
    expect(screen.queryByText('GW19')).toBeNull();
  });

  it('aria-label includes the boost context (lg)', () => {
    render(<HotStreakIndicator hotStreak={makeStreak({ boostDelta: 5, boostGw: 33 })} size="lg" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Hot streak: +5 boost in GW33');
  });
});

// ── Color class / magnitude ───────────────────────────────────────────────────

describe('HotStreakIndicator — color classes (magnitude)', () => {
  function flameClass(level: HotStreakLevel, boostDelta: number): string {
    const { container } = render(
      <HotStreakIndicator hotStreak={makeStreak({ level, boostDelta, boostGw: 1 })} size="sm" />,
    );
    return container.querySelector('svg')?.getAttribute('class') ?? '';
  }

  it('hot flame carries the warm red-pink color (#f43f5e)', () => {
    expect(flameClass('hot', 5)).toContain('#f43f5e');
  });

  it('warm flame carries the mid orange color (#fb923c)', () => {
    expect(flameClass('warm', 4)).toContain('#fb923c');
  });

  it('mild flame carries the cool slate color (#94a3b8)', () => {
    expect(flameClass('mild', 3)).toContain('#94a3b8');
  });

  it('all three levels produce visually distinct color classes', () => {
    const hot = flameClass('hot', 5);
    const warm = flameClass('warm', 4);
    const mild = flameClass('mild', 3);
    expect(hot).not.toEqual(warm);
    expect(warm).not.toEqual(mild);
    expect(hot).not.toEqual(mild);
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe('HotStreakIndicator — accessibility', () => {
  it('has no a11y violations when null (sm)', async () => {
    const { container } = render(<HotStreakIndicator hotStreak={null} size="sm" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for hot sm', async () => {
    const { container } = render(<HotStreakIndicator hotStreak={makeStreak()} size="sm" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for hot lg', async () => {
    const { container } = render(<HotStreakIndicator hotStreak={makeStreak()} size="lg" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for warm lg', async () => {
    const { container } = render(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'warm', boostDelta: 4 })} size="lg" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for mild lg', async () => {
    const { container } = render(
      <HotStreakIndicator hotStreak={makeStreak({ level: 'mild', boostDelta: 3 })} size="lg" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
