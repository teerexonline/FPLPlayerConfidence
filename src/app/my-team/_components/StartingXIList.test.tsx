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
    status: 'a',
    chanceOfPlaying: null,
    news: '',
    hotStreakLevel: null,
    ...overrides,
  };
}

const ELEVEN: readonly SquadPlayerRow[] = Array.from({ length: 11 }, (_, i) =>
  makePlayer({ playerId: i + 1, webName: `Player${(i + 1).toString()}`, squadPosition: i + 1 }),
);

describe('StartingXIList', () => {
  it('renders the "Starting XI" section heading', () => {
    render(<StartingXIList starters={ELEVEN} currentGW={20} />);
    expect(screen.getByRole('region', { name: /Starting XI/i })).toBeInTheDocument();
  });

  it('renders 11 list items', () => {
    render(<StartingXIList starters={ELEVEN} currentGW={20} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(11);
  });

  it('renders a link for each player pointing to /players/:id', () => {
    render(<StartingXIList starters={ELEVEN} currentGW={20} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(11);
    expect(links[0]).toHaveAttribute('href', '/players/1');
    expect(links[10]).toHaveAttribute('href', '/players/11');
  });

  it('renders the captain badge with aria-label "Captain"', () => {
    render(
      <StartingXIList
        starters={ELEVEN.map((p, i) => (i === 0 ? { ...p, isCaptain: true } : p))}
        currentGW={20}
      />,
    );
    expect(screen.getByLabelText('Captain')).toBeInTheDocument();
  });

  it('renders the vice captain badge with aria-label "Vice captain"', () => {
    render(
      <StartingXIList
        starters={ELEVEN.map((p, i) => (i === 1 ? { ...p, isViceCaptain: true } : p))}
        currentGW={20}
      />,
    );
    expect(screen.getByLabelText('Vice captain')).toBeInTheDocument();
  });

  it('does not render captain or vice captain badges when neither flag is set', () => {
    render(<StartingXIList starters={ELEVEN} currentGW={20} />);
    expect(screen.queryByLabelText('Captain')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Vice captain')).not.toBeInTheDocument();
  });

  it('renders the captain note below the list', () => {
    render(<StartingXIList starters={ELEVEN} currentGW={20} />);
    expect(screen.getByText(/Captain shown for context only/i)).toBeInTheDocument();
  });

  it('renders player web names', () => {
    render(
      <StartingXIList
        starters={[makePlayer({ playerId: 99, webName: 'Haaland', squadPosition: 9 })]}
        currentGW={20}
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
        currentGW={20}
      />,
    );
    expect(screen.getByText('MCI · FWD')).toBeInTheDocument();
  });

  // ── GW scrubber interaction ─────────────────────────────────────────────────

  it('scrubbing from GW34 to GW3 — flame appears when hotStreakLevel changes from null to red_hot', () => {
    // Simulates API returning no flame at GW34 (boost expired) then a fresh
    // flame at GW3 (boost was on GW3 from the viewed GW's perspective).
    const { rerender } = render(
      <StartingXIList
        starters={[makePlayer({ playerId: 1, squadPosition: 1, hotStreakLevel: null })]}
        currentGW={34}
      />,
    );
    expect(screen.queryByRole('img', { name: /streak/i })).toBeNull();

    rerender(
      <StartingXIList
        starters={[makePlayer({ playerId: 1, squadPosition: 1, hotStreakLevel: 'red_hot' })]}
        currentGW={3}
      />,
    );
    expect(screen.getByRole('img', { name: 'Fresh streak · GW3' })).toBeInTheDocument();
  });

  it('hot streak indicator shows GW label matching currentGW prop (GW21)', () => {
    const starters = [makePlayer({ playerId: 1, squadPosition: 1, hotStreakLevel: 'red_hot' })];
    render(<StartingXIList starters={starters} currentGW={21} />);
    expect(screen.getByRole('img', { name: 'Fresh streak · GW21' })).toBeInTheDocument();
  });

  it('hot streak indicator reflects scrubbed GW when currentGW changes', () => {
    const starters = [makePlayer({ playerId: 1, squadPosition: 1, hotStreakLevel: 'med_hot' })];
    const { rerender } = render(<StartingXIList starters={starters} currentGW={20} />);
    expect(screen.getByRole('img', { name: 'Recent streak · GW20' })).toBeInTheDocument();

    rerender(<StartingXIList starters={starters} currentGW={21} />);
    expect(screen.getByRole('img', { name: 'Recent streak · GW21' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Recent streak · GW20' })).toBeNull();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<StartingXIList starters={ELEVEN} currentGW={20} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
