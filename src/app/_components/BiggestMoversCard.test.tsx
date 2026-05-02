import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { BiggestMoversCard } from './BiggestMoversCard';
import type { DashboardPlayer } from './types';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock('@/components/watchlist/WatchlistContext', () => ({
  useWatchlist: () => ({ ids: new Set(), isLoading: false, toggle: vi.fn() }),
}));
vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isPanelOpen: false,
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    signOut: vi.fn(),
  }),
}));

function makePlayer(overrides: Partial<DashboardPlayer> = {}): DashboardPlayer {
  return {
    id: 1,
    webName: 'Salah',
    teamCode: 14,
    teamShortName: 'LIV',
    position: 'MID',
    confidence: 3,
    latestDelta: 2,
    latestGameweek: 33,
    recentDeltas: [1, 2],
    status: 'a',
    chanceOfPlaying: null,
    news: '',
    isStale: false,
    hotStreak: null,
    totalPoints: 100,
    ...overrides,
  };
}

const RISERS: readonly DashboardPlayer[] = [
  makePlayer({ id: 1, webName: 'Salah', latestDelta: 3, confidence: 4 }),
  makePlayer({ id: 2, webName: 'Saka', latestDelta: 2, confidence: 3 }),
];

describe('BiggestMoversCard', () => {
  it('renders the card title', () => {
    render(
      <BiggestMoversCard
        title="Biggest Risers"
        players={RISERS}
        variant="risers"
        ariaLabel="Biggest confidence risers"
        viewAllHref="/players?sort=delta&order=desc&onlyEligible=true"
      />,
    );
    expect(screen.getByRole('heading', { name: /biggest risers/i })).toBeInTheDocument();
  });

  it('renders a list item per player', () => {
    render(
      <BiggestMoversCard
        title="Biggest Risers"
        players={RISERS}
        variant="risers"
        ariaLabel="Biggest confidence risers"
        viewAllHref="/players?sort=delta&order=desc&onlyEligible=true"
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(RISERS.length);
  });

  it('renders rank numbers 1, 2, ...', () => {
    render(
      <BiggestMoversCard
        title="Biggest Risers"
        players={RISERS}
        variant="risers"
        ariaLabel="Biggest confidence risers"
        viewAllHref="/players?sort=delta&order=desc&onlyEligible=true"
      />,
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders player names', () => {
    render(
      <BiggestMoversCard
        title="Biggest Risers"
        players={RISERS}
        variant="risers"
        ariaLabel="Biggest confidence risers"
        viewAllHref="/players?sort=delta&order=desc&onlyEligible=true"
      />,
    );
    expect(screen.getByText('Salah')).toBeInTheDocument();
    expect(screen.getByText('Saka')).toBeInTheDocument();
  });

  it('renders the empty state when no players', () => {
    render(
      <BiggestMoversCard
        title="Biggest Fallers"
        players={[]}
        variant="fallers"
        ariaLabel="Biggest confidence fallers"
        viewAllHref="/players?sort=delta&order=asc&onlyEligible=true"
      />,
    );
    expect(screen.getByText(/no players lost confidence/i)).toBeInTheDocument();
  });

  it('renders the empty state message for risers when no players', () => {
    render(
      <BiggestMoversCard
        title="Biggest Risers"
        players={[]}
        variant="risers"
        ariaLabel="Biggest confidence risers"
        viewAllHref="/players?sort=delta&order=desc&onlyEligible=true"
      />,
    );
    expect(screen.getByText(/no players gained confidence/i)).toBeInTheDocument();
  });

  it('has role="region" with ariaLabel', () => {
    render(
      <BiggestMoversCard
        title="Biggest Risers"
        players={RISERS}
        variant="risers"
        ariaLabel="Biggest confidence risers"
        viewAllHref="/players?sort=delta&order=desc&onlyEligible=true"
      />,
    );
    expect(screen.getByRole('region', { name: /biggest confidence risers/i })).toBeInTheDocument();
  });

  it('renders "View all →" link pointing to the correct href', () => {
    render(
      <BiggestMoversCard
        title="Biggest Risers"
        players={RISERS}
        variant="risers"
        ariaLabel="Biggest confidence risers"
        viewAllHref="/players?sort=delta&order=desc&onlyEligible=true"
      />,
    );
    const link = screen.getByRole('link', { name: /view all/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/players?sort=delta&order=desc&onlyEligible=true');
  });

  it('has no accessibility violations with players (axe)', async () => {
    const { container } = render(
      <BiggestMoversCard
        title="Biggest Risers"
        players={RISERS}
        variant="risers"
        ariaLabel="Biggest confidence risers this gameweek"
        viewAllHref="/players?sort=delta&order=desc&onlyEligible=true"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations when empty (axe)', async () => {
    const { container } = render(
      <BiggestMoversCard
        title="Biggest Fallers"
        players={[]}
        variant="fallers"
        ariaLabel="Biggest confidence fallers this gameweek"
        viewAllHref="/players?sort=delta&order=asc&onlyEligible=true"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
