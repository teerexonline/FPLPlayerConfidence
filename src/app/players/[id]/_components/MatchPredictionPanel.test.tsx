import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { MatchPredictionPanel } from './MatchPredictionPanel';

describe('MatchPredictionPanel', () => {
  it('renders "not yet scheduled" when pGoal is null', () => {
    render(
      <MatchPredictionPanel pGoal={null} pAssist={null} nextFixtureFdr={null} position="MID" />,
    );
    expect(screen.getByText('Next fixture not yet scheduled.')).toBeInTheDocument();
  });

  it('renders P(Goal) and P(Assist) when data is available', () => {
    render(<MatchPredictionPanel pGoal={0.25} pAssist={0.12} nextFixtureFdr={3} position="MID" />);
    expect(screen.getByText('P(Goal)')).toBeInTheDocument();
    expect(screen.getByText('P(Assist)')).toBeInTheDocument();
  });

  it('renders 25% for pGoal=0.25', () => {
    render(<MatchPredictionPanel pGoal={0.25} pAssist={0.12} nextFixtureFdr={3} position="MID" />);
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('renders 12% for pAssist=0.12', () => {
    render(<MatchPredictionPanel pGoal={0.25} pAssist={0.12} nextFixtureFdr={3} position="MID" />);
    expect(screen.getByText('12%')).toBeInTheDocument();
  });

  it('renders difficulty when nextFixtureFdr is provided', () => {
    render(<MatchPredictionPanel pGoal={0.25} pAssist={0.12} nextFixtureFdr={4} position="MID" />);
    expect(screen.getByText('Difficulty 4/5')).toBeInTheDocument();
  });

  it('does not render difficulty section when nextFixtureFdr is null', () => {
    render(
      <MatchPredictionPanel pGoal={0.25} pAssist={0.12} nextFixtureFdr={null} position="MID" />,
    );
    expect(screen.queryByText(/Difficulty/)).not.toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    render(<MatchPredictionPanel pGoal={0.25} pAssist={0.12} nextFixtureFdr={3} position="MID" />);
    expect(screen.getByText(/ICT framework/)).toBeInTheDocument();
  });

  it('renders a warning indicator for FWD position in G mode', () => {
    const { container } = render(
      <MatchPredictionPanel pGoal={0.3} pAssist={0.1} nextFixtureFdr={3} position="FWD" />,
    );
    // FWD caveat stub — will be expanded in Phase 6
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <MatchPredictionPanel pGoal={0.25} pAssist={0.12} nextFixtureFdr={3} position="MID" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('panel heading is "Next match prediction"', () => {
    render(<MatchPredictionPanel pGoal={0.25} pAssist={0.12} nextFixtureFdr={3} position="MID" />);
    expect(screen.getByRole('region', { name: /next match prediction/i })).toBeInTheDocument();
  });
});
