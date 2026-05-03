import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { StartingXIList } from './StartingXIList';

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
import type { SquadPlayerRow } from './types';

function makePlayer(overrides: Partial<SquadPlayerRow> = {}): SquadPlayerRow {
  return {
    playerId: 1,
    webName: 'Salah',
    teamCode: 14,
    teamShortName: 'LIV',
    position: 'MID',
    squadPosition: 1,
    isCaptain: false,
    isViceCaptain: false,
    confidence: 3,
    nowCost: 70,
    status: 'a',
    chanceOfPlaying: null,
    news: '',
    hotStreak: null,
    nextFixtures: [],
    projectedXp: null,
    isSwappedIn: false,
    ...overrides,
  };
}

const ELEVEN: readonly SquadPlayerRow[] = Array.from({ length: 11 }, (_, i) =>
  makePlayer({ playerId: i + 1, webName: `Player${(i + 1).toString()}`, squadPosition: i + 1 }),
);

describe('StartingXIList', () => {
  it('renders the "Starting XI" section heading', () => {
    render(<StartingXIList starters={ELEVEN} />);
    expect(screen.getByRole('region', { name: /Starting XI/i })).toBeInTheDocument();
  });

  it('renders 11 list items', () => {
    render(<StartingXIList starters={ELEVEN} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(11);
  });

  it('renders a link for each player pointing to /players/:id', () => {
    render(<StartingXIList starters={ELEVEN} />);
    // Each row renders two links (jersey + name) both pointing to the same player URL.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(22);
    expect(links[0]).toHaveAttribute('href', '/players/1');
    expect(links[links.length - 1]).toHaveAttribute('href', '/players/11');
  });

  it('renders the captain badge with aria-label "Captain"', () => {
    render(
      <StartingXIList starters={ELEVEN.map((p, i) => (i === 0 ? { ...p, isCaptain: true } : p))} />,
    );
    expect(screen.getByLabelText('Captain')).toBeInTheDocument();
  });

  it('renders the vice captain badge with aria-label "Vice captain"', () => {
    render(
      <StartingXIList
        starters={ELEVEN.map((p, i) => (i === 1 ? { ...p, isViceCaptain: true } : p))}
      />,
    );
    expect(screen.getByLabelText('Vice captain')).toBeInTheDocument();
  });

  it('does not render captain or vice captain badges when neither flag is set', () => {
    render(<StartingXIList starters={ELEVEN} />);
    expect(screen.queryByLabelText('Captain')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Vice captain')).not.toBeInTheDocument();
  });

  it('renders the captain note below the list', () => {
    render(<StartingXIList starters={ELEVEN} />);
    expect(screen.getByText(/Captain shown for context only/i)).toBeInTheDocument();
  });

  it('renders player web names', () => {
    render(
      <StartingXIList
        starters={[makePlayer({ playerId: 99, webName: 'Haaland', squadPosition: 9 })]}
      />,
    );
    expect(screen.getByText('Haaland')).toBeInTheDocument();
  });

  it('renders team short name and position in sub-label', () => {
    render(
      <StartingXIList
        starters={[
          makePlayer({ playerId: 10, teamShortName: 'MCI', position: 'FWD', squadPosition: 10 }),
        ]}
      />,
    );
    expect(screen.getByText('MCI · FWD')).toBeInTheDocument();
  });

  // ── GW scrubber interaction ─────────────────────────────────────────────────

  it('flame appears when hotStreak changes from null to a HotStreakInfo', () => {
    const { rerender } = render(
      <StartingXIList
        starters={[makePlayer({ playerId: 1, squadPosition: 1, hotStreak: null })]}
      />,
    );
    expect(screen.queryByRole('img', { name: /streak/i })).toBeNull();

    rerender(
      <StartingXIList
        starters={[
          makePlayer({
            playerId: 1,
            squadPosition: 1,
            hotStreak: {
              level: 'hot',
              boostDelta: 5,
              boostGw: 3,
              matchesSinceBoost: 0,
              intensity: 'high',
            },
          }),
        ]}
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Hot streak: +5 boost in GW3 (this match)' }),
    ).toBeInTheDocument();
  });

  it('hot streak indicator shows boost GW from HotStreakInfo', () => {
    const starters = [
      makePlayer({
        playerId: 1,
        squadPosition: 1,
        hotStreak: {
          level: 'hot',
          boostDelta: 5,
          boostGw: 21,
          matchesSinceBoost: 0,
          intensity: 'high',
        },
      }),
    ];
    render(<StartingXIList starters={starters} />);
    expect(
      screen.getByRole('img', { name: 'Hot streak: +5 boost in GW21 (this match)' }),
    ).toBeInTheDocument();
  });

  it('hot streak indicator updates when hotStreak prop changes to different boost GW', () => {
    const { rerender } = render(
      <StartingXIList
        starters={[
          makePlayer({
            playerId: 1,
            squadPosition: 1,
            hotStreak: {
              level: 'warm',
              boostDelta: 4,
              boostGw: 20,
              matchesSinceBoost: 0,
              intensity: 'high',
            },
          }),
        ]}
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Hot streak: +4 boost in GW20 (this match)' }),
    ).toBeInTheDocument();

    rerender(
      <StartingXIList
        starters={[
          makePlayer({
            playerId: 1,
            squadPosition: 1,
            hotStreak: {
              level: 'hot',
              boostDelta: 5,
              boostGw: 21,
              matchesSinceBoost: 0,
              intensity: 'high',
            },
          }),
        ]}
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Hot streak: +5 boost in GW21 (this match)' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Hot streak: +4 boost in GW20 (this match)' }),
    ).toBeNull();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<StartingXIList starters={ELEVEN} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
