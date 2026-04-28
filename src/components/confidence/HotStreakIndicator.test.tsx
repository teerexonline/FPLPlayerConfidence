import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { HotStreakIndicator } from './HotStreakIndicator';
import type { HotStreakLevel } from '@/lib/confidence/hotStreak';

// ── null level ───────────────────────────────────────────────────────────────

describe('HotStreakIndicator — null level', () => {
  it('renders nothing when level is null (sm)', () => {
    const { container } = render(<HotStreakIndicator level={null} size="sm" currentGW={20} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when level is null (lg)', () => {
    const { container } = render(<HotStreakIndicator level={null} size="lg" currentGW={20} />);
    expect(container.firstChild).toBeNull();
  });
});

// ── sm variant ───────────────────────────────────────────────────────────────

describe('HotStreakIndicator — sm variant', () => {
  it('renders a role=img element for red_hot', () => {
    render(<HotStreakIndicator level="red_hot" size="sm" currentGW={20} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders a role=img element for med_hot', () => {
    render(<HotStreakIndicator level="med_hot" size="sm" currentGW={20} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders a role=img element for low_hot', () => {
    render(<HotStreakIndicator level="low_hot" size="sm" currentGW={20} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('has aria-label "Fresh streak · GW20" for red_hot at GW20', () => {
    render(<HotStreakIndicator level="red_hot" size="sm" currentGW={20} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Fresh streak · GW20');
  });

  it('has aria-label "Recent streak · GW21" for med_hot at GW21', () => {
    render(<HotStreakIndicator level="med_hot" size="sm" currentGW={21} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Recent streak · GW21');
  });

  it('has aria-label "Fading streak · GW22" for low_hot at GW22', () => {
    render(<HotStreakIndicator level="low_hot" size="sm" currentGW={22} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Fading streak · GW22');
  });

  it('has tooltip title "Fresh streak · GW20" for red_hot', () => {
    render(<HotStreakIndicator level="red_hot" size="sm" currentGW={20} />);
    expect(screen.getByRole('img')).toHaveAttribute('title', 'Fresh streak · GW20');
  });

  it('has tooltip title "Recent streak · GW21" for med_hot at GW21', () => {
    render(<HotStreakIndicator level="med_hot" size="sm" currentGW={21} />);
    expect(screen.getByRole('img')).toHaveAttribute('title', 'Recent streak · GW21');
  });

  it('has tooltip title "Fading streak · GW22" for low_hot at GW22', () => {
    render(<HotStreakIndicator level="low_hot" size="sm" currentGW={22} />);
    expect(screen.getByRole('img')).toHaveAttribute('title', 'Fading streak · GW22');
  });

  it('does not animate the icon in sm variant', () => {
    const { container } = render(<HotStreakIndicator level="red_hot" size="sm" currentGW={20} />);
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('defaults to sm when size is omitted', () => {
    render(<HotStreakIndicator level="red_hot" currentGW={20} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img.querySelector('.animate-pulse')).toBeNull();
  });

  it('passes extra className to the wrapper span', () => {
    render(<HotStreakIndicator level="red_hot" size="sm" currentGW={20} className="test-class" />);
    expect(screen.getByRole('img')).toHaveClass('test-class');
  });
});

// ── lg variant ───────────────────────────────────────────────────────────────

describe('HotStreakIndicator — lg variant', () => {
  it('renders a role=img element for each level', () => {
    const { rerender } = render(<HotStreakIndicator level="red_hot" size="lg" currentGW={20} />);
    expect(screen.getByRole('img')).toBeInTheDocument();

    rerender(<HotStreakIndicator level="med_hot" size="lg" currentGW={20} />);
    expect(screen.getByRole('img')).toBeInTheDocument();

    rerender(<HotStreakIndicator level="low_hot" size="lg" currentGW={20} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('animates the flame icon for red_hot (lg)', () => {
    const { container } = render(<HotStreakIndicator level="red_hot" size="lg" currentGW={20} />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('does NOT animate the flame for med_hot (lg)', () => {
    const { container } = render(<HotStreakIndicator level="med_hot" size="lg" currentGW={20} />);
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('does NOT animate the flame for low_hot (lg)', () => {
    const { container } = render(<HotStreakIndicator level="low_hot" size="lg" currentGW={20} />);
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('renders level text "Fresh" for red_hot', () => {
    render(<HotStreakIndicator level="red_hot" size="lg" currentGW={20} />);
    expect(screen.getByText('Fresh')).toBeInTheDocument();
  });

  it('renders level text "Recent" for med_hot', () => {
    render(<HotStreakIndicator level="med_hot" size="lg" currentGW={20} />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('renders level text "Fading" for low_hot', () => {
    render(<HotStreakIndicator level="low_hot" size="lg" currentGW={20} />);
    expect(screen.getByText('Fading')).toBeInTheDocument();
  });

  // ── GW label tests ────────────────────────────────────────────────────────

  it('shows "GW20" label when state is fresh and currentGW=20', () => {
    render(<HotStreakIndicator level="red_hot" size="lg" currentGW={20} />);
    expect(screen.getByText('GW20')).toBeInTheDocument();
  });

  it('shows "GW21" label when state is recent and currentGW=21', () => {
    render(<HotStreakIndicator level="med_hot" size="lg" currentGW={21} />);
    expect(screen.getByText('GW21')).toBeInTheDocument();
  });

  it('shows "GW22" label when state is fading and currentGW=22', () => {
    render(<HotStreakIndicator level="low_hot" size="lg" currentGW={22} />);
    expect(screen.getByText('GW22')).toBeInTheDocument();
  });

  it('updates GW label when currentGW changes', () => {
    const { rerender } = render(<HotStreakIndicator level="red_hot" size="lg" currentGW={19} />);
    expect(screen.getByText('GW19')).toBeInTheDocument();

    rerender(<HotStreakIndicator level="red_hot" size="lg" currentGW={20} />);
    expect(screen.getByText('GW20')).toBeInTheDocument();
    expect(screen.queryByText('GW19')).toBeNull();
  });

  it('has the correct aria-label for each level (lg)', () => {
    const { rerender } = render(<HotStreakIndicator level="red_hot" size="lg" currentGW={20} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Fresh streak · GW20');

    rerender(<HotStreakIndicator level="med_hot" size="lg" currentGW={21} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Recent streak · GW21');

    rerender(<HotStreakIndicator level="low_hot" size="lg" currentGW={22} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Fading streak · GW22');
  });
});

// ── Color class / temperature decay ──────────────────────────────────────────

describe('HotStreakIndicator — color classes (temperature decay)', () => {
  function flameClass(level: HotStreakLevel): string {
    const { container } = render(<HotStreakIndicator level={level} size="sm" currentGW={1} />);
    return container.querySelector('svg')?.getAttribute('class') ?? '';
  }

  it('red_hot flame carries the warm red-pink color (#f43f5e)', () => {
    expect(flameClass('red_hot')).toContain('#f43f5e');
  });

  it('med_hot flame carries the mid orange color (#fb923c)', () => {
    expect(flameClass('med_hot')).toContain('#fb923c');
  });

  it('low_hot flame carries the cool slate color (#94a3b8)', () => {
    expect(flameClass('low_hot')).toContain('#94a3b8');
  });

  it('all three levels produce visually distinct color classes', () => {
    const fresh = flameClass('red_hot');
    const recent = flameClass('med_hot');
    const fading = flameClass('low_hot');
    expect(fresh).not.toEqual(recent);
    expect(recent).not.toEqual(fading);
    expect(fresh).not.toEqual(fading);
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe('HotStreakIndicator — accessibility', () => {
  it('has no a11y violations when null (sm)', async () => {
    const { container } = render(<HotStreakIndicator level={null} size="sm" currentGW={20} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for red_hot sm', async () => {
    const { container } = render(<HotStreakIndicator level="red_hot" size="sm" currentGW={20} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for red_hot lg', async () => {
    const { container } = render(<HotStreakIndicator level="red_hot" size="lg" currentGW={20} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for med_hot lg', async () => {
    const { container } = render(<HotStreakIndicator level="med_hot" size="lg" currentGW={20} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for low_hot lg', async () => {
    const { container } = render(<HotStreakIndicator level="low_hot" size="lg" currentGW={20} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
