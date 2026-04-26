import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { MyTeamHero } from './MyTeamHero';

const BASE_PROPS = {
  defencePercent: 65,
  midfieldPercent: 60,
  attackPercent: 55,
};

describe('MyTeamHero', () => {
  it('renders the team confidence percentage', () => {
    render(<MyTeamHero percent={72.5} {...BASE_PROPS} />);
    const hero = screen.getByLabelText(/Team Confidence/i);
    expect(hero).toBeInTheDocument();
  });

  it('applies positive sign when percent > 50', () => {
    render(<MyTeamHero percent={75} {...BASE_PROPS} />);
    const hero = screen.getByLabelText(/Team Confidence/i);
    expect(hero).toHaveAttribute('data-sign', 'positive');
  });

  it('applies negative sign when percent < 50', () => {
    render(<MyTeamHero percent={35} {...BASE_PROPS} />);
    const hero = screen.getByLabelText(/Team Confidence/i);
    expect(hero).toHaveAttribute('data-sign', 'negative');
  });

  it('applies neutral sign at exactly 50%', () => {
    render(<MyTeamHero percent={50} {...BASE_PROPS} />);
    const hero = screen.getByLabelText(/Team Confidence/i);
    expect(hero).toHaveAttribute('data-sign', 'neutral');
  });

  it('renders the "Team Confidence" caption label', () => {
    render(<MyTeamHero percent={60} {...BASE_PROPS} />);
    expect(screen.getByText(/Team Confidence/i)).toBeInTheDocument();
  });

  it('renders all three positional line labels', () => {
    render(<MyTeamHero percent={60} defencePercent={70} midfieldPercent={55} attackPercent={45} />);
    expect(screen.getByText(/Defence/i)).toBeInTheDocument();
    expect(screen.getByText(/Midfield/i)).toBeInTheDocument();
    expect(screen.getByText(/Attack/i)).toBeInTheDocument();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<MyTeamHero percent={72.5} {...BASE_PROPS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
