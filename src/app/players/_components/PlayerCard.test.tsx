import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { PlayerCard } from './PlayerCard';
import { SALAH, PICKFORD, HAALAND } from './__fixtures__/players';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
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

describe('PlayerCard', () => {
  it('renders the player name', () => {
    render(<PlayerCard player={SALAH} />);
    expect(screen.getByText('M. Salah')).toBeInTheDocument();
  });

  it('renders team · position · price meta text', () => {
    render(<PlayerCard player={SALAH} />);
    expect(screen.getByText('LIV · MID · £13.0m')).toBeInTheDocument();
  });

  // Confidence is no longer rendered on list views — it lives on the player
  // detail page only. The list shows xP as the primary metric. These tests
  // assert that the confidence percentage is intentionally absent.
  it('does not render the confidence percentage on the card', () => {
    render(<PlayerCard player={SALAH} />);
    expect(screen.queryByText('80%')).not.toBeInTheDocument();
  });

  it('does not render confidence even at 0% (PICKFORD)', () => {
    render(<PlayerCard player={PICKFORD} />);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('does not render confidence at the neutral 50% level (HAALAND)', () => {
    render(<PlayerCard player={HAALAND} />);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('displays the correct price for each player', () => {
    render(<PlayerCard player={HAALAND} />);
    expect(screen.getByText('MCI · FWD · £14.5m')).toBeInTheDocument();
  });

  it('navigates to the player detail page on click', async () => {
    render(<PlayerCard player={SALAH} />);
    await userEvent.click(screen.getByRole('row'));
    expect(mockPush).toHaveBeenCalledWith(`/players/${SALAH.id.toString()}`);
  });

  it('does not navigate when the star button is clicked', async () => {
    mockPush.mockClear();
    render(<PlayerCard player={SALAH} />);
    // In the unauthenticated mock context the label is "Sign in to add to watchlist".
    const star = screen.getByRole('button', { name: /sign in to add to watchlist/i });
    await userEvent.click(star);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('has role="row" for accessible table semantics', () => {
    render(<PlayerCard player={SALAH} />);
    expect(screen.getByRole('row')).toBeInTheDocument();
  });

  it('has no accessibility violations (axe)', async () => {
    // PlayerCard has role="row" which requires a table/rowgroup ancestor.
    const { container } = render(
      <div role="table" aria-label="Players">
        <div role="rowgroup">
          <PlayerCard player={SALAH} />
        </div>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
