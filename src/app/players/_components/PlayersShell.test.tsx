import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayersShell } from './PlayersShell';
import { SMOKE_PLAYERS } from './__fixtures__/players';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/players'),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getVirtualItems: vi.fn(() => []),
    getTotalSize: vi.fn(() => 0),
    scrollToIndex: vi.fn(),
  })),
}));

describe('PlayersShell', () => {
  it('renders without throwing', () => {
    render(<PlayersShell players={SMOKE_PLAYERS} />);
  });

  it('renders mobile player cards for each player', () => {
    render(<PlayersShell players={SMOKE_PLAYERS} />);
    expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
  });

  it('renders the search input via PlayersFilters', async () => {
    render(<PlayersShell players={SMOKE_PLAYERS} />);
    expect(await screen.findByRole('searchbox', { name: /search players/i })).toBeInTheDocument();
  });
});
