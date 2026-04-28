import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { HotStreakIndicator } from './HotStreakIndicator';

// ── null level ───────────────────────────────────────────────────────────────

describe('HotStreakIndicator — null level', () => {
  it('renders nothing when level is null (sm)', () => {
    const { container } = render(<HotStreakIndicator level={null} size="sm" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when level is null (lg)', () => {
    const { container } = render(<HotStreakIndicator level={null} size="lg" />);
    expect(container.firstChild).toBeNull();
  });
});

// ── sm variant ───────────────────────────────────────────────────────────────

describe('HotStreakIndicator — sm variant', () => {
  it('renders a role=img element for red_hot', () => {
    render(<HotStreakIndicator level="red_hot" size="sm" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders a role=img element for med_hot', () => {
    render(<HotStreakIndicator level="med_hot" size="sm" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders a role=img element for low_hot', () => {
    render(<HotStreakIndicator level="low_hot" size="sm" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('has the correct aria-label for red_hot', () => {
    render(<HotStreakIndicator level="red_hot" size="sm" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Red hot — boost in last 1 GW');
  });

  it('has the correct aria-label for med_hot', () => {
    render(<HotStreakIndicator level="med_hot" size="sm" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Hot — boost 2 GWs ago');
  });

  it('has the correct aria-label for low_hot', () => {
    render(<HotStreakIndicator level="low_hot" size="sm" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Warm — boost 3 GWs ago');
  });

  it('does not render a pulse ring (sm is dot-only)', () => {
    const { container } = render(<HotStreakIndicator level="red_hot" size="sm" />);
    // sm variant has no element with animate-ping
    expect(container.querySelector('.animate-ping')).toBeNull();
  });

  it('defaults to sm when size is omitted', () => {
    render(<HotStreakIndicator level="red_hot" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img.closest('[class*="animate-ping"]')).toBeNull();
  });

  it('passes extra className to the wrapper span', () => {
    render(<HotStreakIndicator level="red_hot" size="sm" className="test-class" />);
    expect(screen.getByRole('img')).toHaveClass('test-class');
  });
});

// ── lg variant ───────────────────────────────────────────────────────────────

describe('HotStreakIndicator — lg variant', () => {
  it('renders a role=img element for each level', () => {
    const { rerender } = render(<HotStreakIndicator level="red_hot" size="lg" />);
    expect(screen.getByRole('img')).toBeInTheDocument();

    rerender(<HotStreakIndicator level="med_hot" size="lg" />);
    expect(screen.getByRole('img')).toBeInTheDocument();

    rerender(<HotStreakIndicator level="low_hot" size="lg" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders a pulse ring for red_hot', () => {
    const { container } = render(<HotStreakIndicator level="red_hot" size="lg" />);
    expect(container.querySelector('.animate-ping')).not.toBeNull();
  });

  it('does NOT render a pulse ring for med_hot', () => {
    const { container } = render(<HotStreakIndicator level="med_hot" size="lg" />);
    expect(container.querySelector('.animate-ping')).toBeNull();
  });

  it('does NOT render a pulse ring for low_hot', () => {
    const { container } = render(<HotStreakIndicator level="low_hot" size="lg" />);
    expect(container.querySelector('.animate-ping')).toBeNull();
  });

  it('renders text label "Red hot" for red_hot', () => {
    render(<HotStreakIndicator level="red_hot" size="lg" />);
    expect(screen.getByText('Red hot')).toBeInTheDocument();
  });

  it('renders text label "Hot" for med_hot', () => {
    render(<HotStreakIndicator level="med_hot" size="lg" />);
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });

  it('renders text label "Warm" for low_hot', () => {
    render(<HotStreakIndicator level="low_hot" size="lg" />);
    expect(screen.getByText('Warm')).toBeInTheDocument();
  });

  it('has the correct aria-label for each level (lg)', () => {
    const { rerender } = render(<HotStreakIndicator level="red_hot" size="lg" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Red hot — boost in last 1 GW');

    rerender(<HotStreakIndicator level="med_hot" size="lg" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Hot — boost 2 GWs ago');

    rerender(<HotStreakIndicator level="low_hot" size="lg" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Warm — boost 3 GWs ago');
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe('HotStreakIndicator — accessibility', () => {
  it('has no a11y violations when null (sm)', async () => {
    const { container } = render(<HotStreakIndicator level={null} size="sm" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for red_hot sm', async () => {
    const { container } = render(<HotStreakIndicator level="red_hot" size="sm" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for red_hot lg', async () => {
    const { container } = render(<HotStreakIndicator level="red_hot" size="lg" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for med_hot lg', async () => {
    const { container } = render(<HotStreakIndicator level="med_hot" size="lg" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no a11y violations for low_hot lg', async () => {
    const { container } = render(<HotStreakIndicator level="low_hot" size="lg" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
