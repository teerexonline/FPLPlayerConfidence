import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { WatchlistCard } from './WatchlistCard';
import type { DashboardPlayer } from './types';

// StarButton reads from both WatchlistContext and AuthContext.
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
  isStale: false,
  hotStreak: null,
  totalPoints: 100,
  ...overrides,
});

describe('WatchlistCard — anonymous (not authenticated)', () => {
  it('renders the Watchlist heading', () => {
    render(<WatchlistCard players={[]} isAuthenticated={false} />);
    expect(screen.getByRole('heading', { name: /watchlist/i })).toBeInTheDocument();
  });

  it('shows sign-in CTA when not authenticated', () => {
    render(<WatchlistCard players={[]} isAuthenticated={false} />);
    expect(screen.getByText('Save players to watchlist')).toBeInTheDocument();
  });

  it('has role="region" with aria-label "Watchlist"', () => {
    render(<WatchlistCard players={[]} isAuthenticated={false} />);
    expect(screen.getByRole('region', { name: /^watchlist$/i })).toBeInTheDocument();
  });

  it('has no accessibility violations when anonymous', async () => {
    const { container } = render(<WatchlistCard players={[]} isAuthenticated={false} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('WatchlistCard — authenticated, empty watchlist', () => {
  it('shows empty watchlist message when authenticated but no players', () => {
    render(<WatchlistCard players={[]} isAuthenticated={true} />);
    expect(screen.getByText('No watchlist yet')).toBeInTheDocument();
  });

  it('renders a link to /players', () => {
    render(<WatchlistCard players={[]} isAuthenticated={true} />);
    const link = screen.getByRole('link', { name: /browse players/i });
    expect(link).toHaveAttribute('href', '/players');
  });

  it('has no accessibility violations when empty', async () => {
    const { container } = render(<WatchlistCard players={[]} isAuthenticated={true} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('WatchlistCard — with players', () => {
  it('renders a player row for each watchlisted player', () => {
    const players = [
      makePlayer({ id: 1, webName: 'Haaland' }),
      makePlayer({ id: 2, webName: 'Salah' }),
    ];
    render(<WatchlistCard players={players} isAuthenticated={true} />);
    expect(screen.getByText('Haaland')).toBeInTheDocument();
    expect(screen.getByText('Salah')).toBeInTheDocument();
  });

  it('does not render empty state when players are present', () => {
    render(<WatchlistCard players={[makePlayer()]} isAuthenticated={true} />);
    expect(screen.queryByText('No watchlist yet')).toBeNull();
  });

  it('renders a link to the player detail page for each player', () => {
    const players = [makePlayer({ id: 42, webName: 'Salah' })];
    render(<WatchlistCard players={players} isAuthenticated={true} />);
    const link = screen.getByRole('link', { name: /salah/i });
    expect(link).toHaveAttribute('href', '/players/42');
  });

  it('has no accessibility violations with players', async () => {
    const { container } = render(<WatchlistCard players={[makePlayer()]} isAuthenticated={true} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
