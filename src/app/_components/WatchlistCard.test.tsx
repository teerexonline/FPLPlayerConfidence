import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { WatchlistCard } from './WatchlistCard';
import type { DashboardPlayer } from './types';

// StarButton uses useWatchlist — stub it so tests don't need a full provider.
vi.mock('@/components/watchlist/WatchlistContext', () => ({
  useWatchlist: () => ({ ids: new Set(), isLoading: false, toggle: vi.fn() }),
}));

const makePlayer = (overrides: Partial<DashboardPlayer> = {}): DashboardPlayer => ({
  id: 1,
  webName: 'Haaland',
  teamCode: 43,
  teamShortName: 'MCI',
  position: 'FWD',
  confidence: 80,
  latestDelta: 3,
  latestGameweek: 34,
  recentDeltas: [1, 2, 3],
  status: 'a',
  chanceOfPlaying: null,
  news: '',
  recentAppearances: 3,
  hotStreak: null,
  totalPoints: 100,
  ...overrides,
});

describe('WatchlistCard — empty state', () => {
  it('renders the Watchlist heading', () => {
    render(<WatchlistCard players={[]} />);
    expect(screen.getByRole('heading', { name: /watchlist/i })).toBeInTheDocument();
  });

  it('renders the empty-state message', () => {
    render(<WatchlistCard players={[]} />);
    expect(screen.getByText('No watchlist yet')).toBeInTheDocument();
  });

  it('renders a link to /players', () => {
    render(<WatchlistCard players={[]} />);
    const link = screen.getByRole('link', { name: /browse players/i });
    expect(link).toHaveAttribute('href', '/players');
  });

  it('has role="region" with aria-label "Watchlist"', () => {
    render(<WatchlistCard players={[]} />);
    expect(screen.getByRole('region', { name: /^watchlist$/i })).toBeInTheDocument();
  });

  it('has no accessibility violations when empty', async () => {
    const { container } = render(<WatchlistCard players={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('WatchlistCard — with players', () => {
  it('renders a player row for each watchlisted player', () => {
    const players = [
      makePlayer({ id: 1, webName: 'Haaland' }),
      makePlayer({ id: 2, webName: 'Salah' }),
    ];
    render(<WatchlistCard players={players} />);
    expect(screen.getByText('Haaland')).toBeInTheDocument();
    expect(screen.getByText('Salah')).toBeInTheDocument();
  });

  it('does not render empty state when players are present', () => {
    render(<WatchlistCard players={[makePlayer()]} />);
    expect(screen.queryByText('No watchlist yet')).toBeNull();
  });

  it('renders a link to the player detail page for each player', () => {
    const players = [makePlayer({ id: 42, webName: 'Salah' })];
    render(<WatchlistCard players={players} />);
    const link = screen.getByRole('link', { name: /salah/i });
    expect(link).toHaveAttribute('href', '/players/42');
  });

  it('has no accessibility violations with players', async () => {
    const { container } = render(<WatchlistCard players={[makePlayer()]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
