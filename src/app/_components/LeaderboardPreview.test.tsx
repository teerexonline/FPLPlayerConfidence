import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { LeaderboardPreview } from './LeaderboardPreview';
import type { DashboardLeaderboard, DashboardPlayer } from './types';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

function makePlayer(id: number, position: DashboardPlayer['position']): DashboardPlayer {
  return {
    id,
    webName: `Player${id.toString()}`,
    teamCode: 14,
    teamShortName: 'LIV',
    position,
    confidence: id,
    latestDelta: 1,
    latestGameweek: 33,
    recentDeltas: [1],
    status: 'a',
    chanceOfPlaying: null,
    news: '',
    recentAppearances: 3,
  };
}

const LEADERBOARD: DashboardLeaderboard = {
  all: [makePlayer(1, 'MID'), makePlayer(2, 'FWD')],
  GK: [makePlayer(3, 'GK')],
  DEF: [makePlayer(4, 'DEF')],
  MID: [makePlayer(1, 'MID')],
  FWD: [makePlayer(2, 'FWD')],
};

const EMPTY_LEADERBOARD: DashboardLeaderboard = {
  all: [],
  GK: [],
  DEF: [],
  MID: [],
  FWD: [],
};

describe('LeaderboardPreview', () => {
  it('renders the Confidence Leaderboard heading', () => {
    render(<LeaderboardPreview leaderboard={LEADERBOARD} />);
    expect(screen.getByRole('heading', { name: /confidence leaderboard/i })).toBeInTheDocument();
  });

  it('renders tab buttons for all positions', () => {
    render(<LeaderboardPreview leaderboard={LEADERBOARD} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['All', 'GK', 'DEF', 'MID', 'FWD']);
  });

  it('marks the initial tab as selected', () => {
    render(<LeaderboardPreview leaderboard={LEADERBOARD} initialTab="gk" />);
    expect(screen.getByRole('tab', { name: 'GK' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false');
  });

  it('falls back to "all" tab for an invalid initialTab', () => {
    render(<LeaderboardPreview leaderboard={LEADERBOARD} initialTab="xyz" />);
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switching tabs updates displayed players', async () => {
    const user = userEvent.setup();
    render(<LeaderboardPreview leaderboard={LEADERBOARD} />);

    // "All" tab shows players 1 and 2
    expect(screen.getByText('Player1')).toBeInTheDocument();
    expect(screen.getByText('Player2')).toBeInTheDocument();

    // Switch to GK tab
    await user.click(screen.getByRole('tab', { name: 'GK' }));
    expect(screen.getByText('Player3')).toBeInTheDocument();
    expect(screen.queryByText('Player1')).not.toBeInTheDocument();
  });

  it('calls router.replace with the correct URL on tab switch', async () => {
    const user = userEvent.setup();
    render(<LeaderboardPreview leaderboard={LEADERBOARD} />);
    await user.click(screen.getByRole('tab', { name: 'DEF' }));
    expect(mockReplace).toHaveBeenCalledWith('/?leaderboard=def', { scroll: false });
  });

  it('calls router.replace with "/" when switching back to all', async () => {
    const user = userEvent.setup();
    render(<LeaderboardPreview leaderboard={LEADERBOARD} initialTab="gk" />);
    await user.click(screen.getByRole('tab', { name: 'All' }));
    expect(mockReplace).toHaveBeenCalledWith('/', { scroll: false });
  });

  it('renders the empty state message when no players for the tab', () => {
    render(<LeaderboardPreview leaderboard={EMPTY_LEADERBOARD} />);
    expect(screen.getByText(/no players with confidence data/i)).toBeInTheDocument();
  });

  it('renders "View all →" link to /players', () => {
    render(<LeaderboardPreview leaderboard={LEADERBOARD} />);
    const link = screen.getByRole('link', { name: /view all/i });
    expect(link).toHaveAttribute('href', '/players');
  });

  it('rows are keyboard-accessible (tabIndex=0, aria-label)', () => {
    render(<LeaderboardPreview leaderboard={LEADERBOARD} />);
    const rows = screen.getAllByRole('row').filter((el) => el.getAttribute('tabindex') === '0');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row).toHaveAttribute('aria-label');
    });
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<LeaderboardPreview leaderboard={LEADERBOARD} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations when empty (axe)', async () => {
    const { container } = render(<LeaderboardPreview leaderboard={EMPTY_LEADERBOARD} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
