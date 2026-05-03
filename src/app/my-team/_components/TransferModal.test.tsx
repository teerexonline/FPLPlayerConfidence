import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TransferModal } from './TransferModal';
import type { SquadPlayerRow } from './types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const PLAYER_OUT: SquadPlayerRow = {
  playerId: 430,
  webName: 'Haaland',
  teamCode: 43,
  teamShortName: 'MCI',
  position: 'FWD',
  squadPosition: 10,
  isCaptain: true,
  isViceCaptain: false,
  confidence: 3,
  nowCost: 70,
  status: 'a',
  chanceOfPlaying: null,
  news: '',
  hotStreak: null,
  nextFixtures: [],
  projectedXp: 8.5,
  isSwappedIn: false,
};

const MOCK_CANDIDATES = [
  {
    playerId: 249,
    webName: 'João Pedro',
    teamShortName: 'BHA',
    teamCode: 36,
    position: 'FWD',
    status: 'a',
    currentConfidence: 1,
  },
  {
    playerId: 100,
    webName: 'Watkins',
    teamShortName: 'AVL',
    teamCode: 7,
    position: 'FWD',
    status: 'a',
    currentConfidence: 2,
  },
  {
    playerId: 200,
    webName: 'Wood',
    teamShortName: 'NEW',
    teamCode: 4,
    position: 'FWD',
    status: 'a',
    currentConfidence: -1,
  },
];

function makeCandidatesResponse(candidates = MOCK_CANDIDATES): Response {
  return new Response(JSON.stringify({ candidates }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(makeCandidatesResponse());
});

describe('TransferModal', () => {
  it('renders the player being transferred out in the header', () => {
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Haaland')).toBeInTheDocument();
    expect(screen.getByText('(FWD)')).toBeInTheDocument();
  });

  it('shows candidates after loading', async () => {
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Watkins')).toBeInTheDocument();
      expect(screen.getByText('João Pedro')).toBeInTheDocument();
    });
  });

  it('filters out squad players from the candidate list', async () => {
    // Watkins (100) is in the squad — should not appear.
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430, 100])}
        stagedInIds={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('João Pedro')).toBeInTheDocument();
    });
    expect(screen.queryByText('Watkins')).not.toBeInTheDocument();
  });

  it('filters out already-staged-in players', async () => {
    // Wood (200) is already staged in from another swap.
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set([200])}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Watkins')).toBeInTheDocument();
    });
    expect(screen.queryByText('Wood')).not.toBeInTheDocument();
  });

  it('calls onSelect with the chosen candidate id', async () => {
    const onSelect = vi.fn();
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set()}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByText('Watkins'));
    await userEvent.click(screen.getByRole('button', { name: /transfer in Watkins/i }));
    expect(onSelect).toHaveBeenCalledWith(100);
  });

  it('calls onClose when the X button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set()}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set()}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('filters candidates by search query (name)', async () => {
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByText('Watkins'));
    await userEvent.type(screen.getByRole('searchbox'), 'wat');
    expect(screen.getByText('Watkins')).toBeInTheDocument();
    expect(screen.queryByText('João Pedro')).not.toBeInTheDocument();
  });

  it('filters candidates by search query (team)', async () => {
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByText('Watkins'));
    await userEvent.type(screen.getByRole('searchbox'), 'bha');
    expect(screen.getByText('João Pedro')).toBeInTheDocument();
    expect(screen.queryByText('Watkins')).not.toBeInTheDocument();
  });

  it('shows "No results" when search has no matches', async () => {
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByText('Watkins'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzzzzz');
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/failed to load candidates/i)).toBeInTheDocument();
    });
  });

  it('fetches candidates for the correct position', async () => {
    render(
      <TransferModal
        playerOut={PLAYER_OUT}
        squadPlayerIds={new Set([430])}
        stagedInIds={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByText('Watkins'));
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/transfer-candidates?position=FWD',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
