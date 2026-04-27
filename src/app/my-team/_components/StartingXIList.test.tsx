import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { StartingXIList } from './StartingXIList';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => '/my-team'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
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
    pGoal: 0.1,
    pAssist: 0.08,
    status: 'a',
    chanceOfPlaying: null,
    news: '',
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
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(11);
    expect(links[0]).toHaveAttribute('href', '/players/1');
    expect(links[10]).toHaveAttribute('href', '/players/11');
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

  it('renders the formation label derived from actual starters', () => {
    const starters = [
      makePlayer({ playerId: 1, squadPosition: 1, position: 'GK' }),
      makePlayer({ playerId: 2, squadPosition: 2, position: 'DEF' }),
      makePlayer({ playerId: 3, squadPosition: 3, position: 'DEF' }),
      makePlayer({ playerId: 4, squadPosition: 4, position: 'DEF' }),
      makePlayer({ playerId: 5, squadPosition: 5, position: 'DEF' }),
      makePlayer({ playerId: 6, squadPosition: 6, position: 'MID' }),
      makePlayer({ playerId: 7, squadPosition: 7, position: 'MID' }),
      makePlayer({ playerId: 8, squadPosition: 8, position: 'MID' }),
      makePlayer({ playerId: 9, squadPosition: 9, position: 'FWD' }),
      makePlayer({ playerId: 10, squadPosition: 10, position: 'FWD' }),
      makePlayer({ playerId: 11, squadPosition: 11, position: 'FWD' }),
    ];
    render(<StartingXIList starters={starters} />);
    // Formation label text (4 DEF + 3 MID + 3 FWD)
    expect(screen.getByText('4-3-3')).toBeInTheDocument();
    // Section-header label
    expect(screen.getByText('Formation')).toBeInTheDocument();
  });

  it('formation label aria-label describes the formation', () => {
    const starters = [
      makePlayer({ playerId: 1, squadPosition: 1, position: 'GK' }),
      makePlayer({ playerId: 2, squadPosition: 2, position: 'DEF' }),
      makePlayer({ playerId: 3, squadPosition: 3, position: 'DEF' }),
      makePlayer({ playerId: 4, squadPosition: 4, position: 'DEF' }),
      makePlayer({ playerId: 5, squadPosition: 5, position: 'DEF' }),
      makePlayer({ playerId: 6, squadPosition: 6, position: 'MID' }),
      makePlayer({ playerId: 7, squadPosition: 7, position: 'MID' }),
      makePlayer({ playerId: 8, squadPosition: 8, position: 'MID' }),
      makePlayer({ playerId: 9, squadPosition: 9, position: 'MID' }),
      makePlayer({ playerId: 10, squadPosition: 10, position: 'MID' }),
      makePlayer({ playerId: 11, squadPosition: 11, position: 'FWD' }),
    ];
    render(<StartingXIList starters={starters} />);
    // 4-5-1 formation
    expect(screen.getByLabelText('Formation: 4-5-1')).toBeInTheDocument();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<StartingXIList starters={ELEVEN} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
