import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { MyTeamHero } from './MyTeamHero';

// useTransform returns a MotionValue<string> which jsdom can't render as a React child.
// Mock it to return the mapped plain value so <motion.span>{displayText}</motion.span> works.
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    useTransform: <I, O>(v: { get(): I }, fn: (v: I) => O): O => fn(v.get()),
    animate: vi.fn().mockResolvedValue(undefined),
    useReducedMotion: vi.fn().mockReturnValue(true),
  };
});

const BASE_PROPS = {
  defencePercent: 65,
  midfieldPercent: 60,
  attackPercent: 55,
  defenceXp: 18,
  midfieldXp: 22,
  attackXp: 17,
};

describe('MyTeamHero', () => {
  it('renders the projected team xP as the hero number', () => {
    render(<MyTeamHero percent={72.5} projectedTeamXp={58} gameweek={36} {...BASE_PROPS} />);
    const hero = screen.getByLabelText(/Projected 58 expected points/i);
    expect(hero).toBeInTheDocument();
  });

  it('renders the projected-points caption label including the gameweek', () => {
    render(<MyTeamHero percent={60} projectedTeamXp={42} gameweek={36} {...BASE_PROPS} />);
    expect(screen.getByText(/Projected GW36 Points/i)).toBeInTheDocument();
  });

  it('renders all three positional line labels with xP totals', () => {
    render(<MyTeamHero percent={60} projectedTeamXp={57} gameweek={36} {...BASE_PROPS} />);
    expect(screen.getByText(/Defence/i)).toBeInTheDocument();
    expect(screen.getByText(/Midfield/i)).toBeInTheDocument();
    expect(screen.getByText(/Attack/i)).toBeInTheDocument();
    // BASE_PROPS uses defenceXp=18, midfieldXp=22, attackXp=17 → all rendered
    // as their integer xP values.
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
  });

  it('does not render any "Team Confidence" copy on My Team', () => {
    render(<MyTeamHero percent={72.5} projectedTeamXp={58} gameweek={36} {...BASE_PROPS} />);
    expect(screen.queryByText(/Team Confidence/i)).not.toBeInTheDocument();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(
      <MyTeamHero percent={72.5} projectedTeamXp={58} gameweek={36} {...BASE_PROPS} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
