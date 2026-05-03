import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { NextFixturesStrip } from './NextFixturesStrip';
import type { NextFixture } from './types';

const aFixture = (overrides: Partial<NextFixture> = {}): NextFixture => ({
  gameweek: 36,
  opponentTeamShortName: 'LIV',
  isHome: true,
  fdr: 3,
  kickoffTime: '2026-05-10T14:00:00Z',
  ...overrides,
});

describe('NextFixturesStrip', () => {
  it('renders a placeholder when there are no fixtures', () => {
    render(<NextFixturesStrip fixtures={[]} />);
    expect(screen.getByLabelText(/no upcoming fixtures/i)).toBeInTheDocument();
  });

  it('renders one column per gameweek with opponent code', () => {
    render(
      <NextFixturesStrip
        fixtures={[
          aFixture({ gameweek: 36, opponentTeamShortName: 'LIV', isHome: true, fdr: 2 }),
          aFixture({ gameweek: 37, opponentTeamShortName: 'MUN', isHome: false, fdr: 4 }),
          aFixture({ gameweek: 38, opponentTeamShortName: 'BOU', isHome: true, fdr: 1 }),
        ]}
      />,
    );
    // One <li> column per gameweek; pills inside are spans.
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('LIV')).toBeInTheDocument();
    expect(screen.getByText('MUN')).toBeInTheDocument();
    expect(screen.getByText('BOU')).toBeInTheDocument();
  });

  it('stacks DGW fixtures in a single column', () => {
    render(
      <NextFixturesStrip
        fixtures={[
          aFixture({ gameweek: 36, opponentTeamShortName: 'BRE', isHome: true, fdr: 3 }),
          aFixture({ gameweek: 36, opponentTeamShortName: 'CRY', isHome: true, fdr: 3 }),
          aFixture({ gameweek: 37, opponentTeamShortName: 'BOU', isHome: false, fdr: 4 }),
        ]}
      />,
    );
    // Two columns: GW36 (DGW, 2 pills) + GW37 (1 pill).
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('BRE')).toBeInTheDocument();
    expect(screen.getByText('CRY')).toBeInTheDocument();
    expect(screen.getByText('BOU')).toBeInTheDocument();
  });

  it('marks home vs away in the visible label', () => {
    render(
      <NextFixturesStrip
        fixtures={[
          aFixture({ opponentTeamShortName: 'LIV', isHome: true }),
          aFixture({ opponentTeamShortName: 'MUN', isHome: false }),
        ]}
      />,
    );
    expect(screen.getByText('(H)')).toBeInTheDocument();
    expect(screen.getByText('(A)')).toBeInTheDocument();
  });

  it('exposes a descriptive aria-label on each pill', () => {
    render(
      <NextFixturesStrip
        fixtures={[
          aFixture({
            gameweek: 36,
            opponentTeamShortName: 'LIV',
            isHome: false,
            fdr: 5,
          }),
        ]}
      />,
    );
    expect(screen.getByLabelText(/GW36: away vs LIV, very hard/i)).toBeInTheDocument();
  });

  it('is axe-clean', async () => {
    const { container } = render(
      <NextFixturesStrip
        fixtures={[
          aFixture({ opponentTeamShortName: 'LIV', isHome: true, fdr: 2 }),
          aFixture({ opponentTeamShortName: 'MUN', isHome: false, fdr: 4 }),
        ]}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
