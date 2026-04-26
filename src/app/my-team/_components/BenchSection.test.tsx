import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { BenchSection } from './BenchSection';
import type { SquadPlayerRow } from './types';

function makeBenchPlayer(overrides: Partial<SquadPlayerRow> = {}): SquadPlayerRow {
  return {
    playerId: 12,
    webName: 'Flekken',
    teamCode: 54,
    teamShortName: 'BRE',
    position: 'GK',
    squadPosition: 12,
    isCaptain: false,
    isViceCaptain: false,
    confidence: 0,
    status: 'a',
    chanceOfPlaying: null,
    news: '',
    ...overrides,
  };
}

const FOUR: readonly SquadPlayerRow[] = Array.from({ length: 4 }, (_, i) =>
  makeBenchPlayer({ playerId: 12 + i, webName: `Sub${(i + 1).toString()}`, squadPosition: 12 + i }),
);

describe('BenchSection', () => {
  it('renders the "Bench" section heading', () => {
    render(<BenchSection bench={FOUR} />);
    expect(screen.getByRole('region', { name: /^Bench$/i })).toBeInTheDocument();
  });

  it('renders 4 list items', () => {
    render(<BenchSection bench={FOUR} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders a link for each bench player pointing to /players/:id', () => {
    render(<BenchSection bench={FOUR} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveAttribute('href', '/players/12');
    expect(links[3]).toHaveAttribute('href', '/players/15');
  });

  it('prefixes each accessible name with "Bench:"', () => {
    render(
      <BenchSection
        bench={[makeBenchPlayer({ playerId: 12, webName: 'Flekken', squadPosition: 12 })]}
      />,
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-label')).toMatch(/^Bench:/);
  });

  it('renders bench player web name', () => {
    render(
      <BenchSection
        bench={[makeBenchPlayer({ playerId: 13, webName: 'Isak', squadPosition: 13 })]}
      />,
    );
    expect(screen.getByText('Isak')).toBeInTheDocument();
  });

  it('renders team short name and position', () => {
    render(
      <BenchSection
        bench={[
          makeBenchPlayer({
            playerId: 14,
            teamShortName: 'NEW',
            position: 'FWD',
            squadPosition: 14,
          }),
        ]}
      />,
    );
    expect(screen.getByText('NEW · FWD')).toBeInTheDocument();
  });

  it('renders the bench exclusion note', () => {
    render(<BenchSection bench={FOUR} />);
    expect(screen.getByText(/Bench is excluded from Team Confidence/i)).toBeInTheDocument();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<BenchSection bench={FOUR} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
