import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { PositionalBreakdown } from './PositionalBreakdown';

const BASE = {
  defencePercent: 65,
  midfieldPercent: 60,
  attackPercent: 55,
  defenceCount: 5,
  midfieldCount: 4,
  attackCount: 2,
};

describe('PositionalBreakdown', () => {
  it('renders three cards: Defence, Midfield, Attack', () => {
    render(<PositionalBreakdown {...BASE} />);
    expect(screen.getByText('Defence')).toBeInTheDocument();
    expect(screen.getByText('Midfield')).toBeInTheDocument();
    expect(screen.getByText('Attack')).toBeInTheDocument();
  });

  it('renders the correct percentage values', () => {
    render(<PositionalBreakdown {...BASE} />);
    expect(screen.getByText('65.0%')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
    expect(screen.getByText('55.0%')).toBeInTheDocument();
  });

  it('shows positive data-sign for percentages above 50', () => {
    render(<PositionalBreakdown {...BASE} />);
    const positiveValues = screen.getAllByText(/65\.0%|60\.0%/);
    positiveValues.forEach((el) => {
      expect(el).toHaveAttribute('data-sign', 'positive');
    });
  });

  it('shows negative data-sign for percentages below 50', () => {
    render(<PositionalBreakdown {...BASE} attackPercent={45} />);
    const negativeEl = screen.getByText('45.0%');
    expect(negativeEl).toHaveAttribute('data-sign', 'negative');
  });

  it('shows neutral data-sign at exactly 50%', () => {
    render(<PositionalBreakdown {...BASE} defencePercent={50} />);
    const neutralEl = screen.getByText('50.0%');
    expect(neutralEl).toHaveAttribute('data-sign', 'neutral');
  });

  it('renders the player count for each line', () => {
    render(<PositionalBreakdown {...BASE} />);
    expect(screen.getByText('5 players')).toBeInTheDocument();
    expect(screen.getByText('4 players')).toBeInTheDocument();
    expect(screen.getByText('2 players')).toBeInTheDocument();
  });

  it('handles 0 players in a line gracefully (singular player label)', () => {
    render(<PositionalBreakdown {...BASE} attackCount={1} />);
    expect(screen.getByText('1 player')).toBeInTheDocument();
  });

  it('handles 0% (fully negative squad) without crashing', () => {
    render(
      <PositionalBreakdown
        defencePercent={0}
        midfieldPercent={0}
        attackPercent={0}
        defenceCount={5}
        midfieldCount={4}
        attackCount={2}
      />,
    );
    expect(screen.getAllByText('0.0%')).toHaveLength(3);
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<PositionalBreakdown {...BASE} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
