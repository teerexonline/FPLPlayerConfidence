import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayersTable } from './PlayersTable';
import { makePlayer, SMOKE_PLAYERS } from './__fixtures__/players';

// ── Module mocks ──────────────────────────────────────────────────────────────

// useSearchParams must be mocked because we're outside the Next.js router.
const mockSearchParams = vi.hoisted(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => mockSearchParams),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => '/players'),
}));

// @tanstack/react-virtual relies on DOM layout (getBoundingClientRect). In
// jsdom the container has no real height, so the virtualizer renders 0 rows.
// Patch estimateSize to verify items pass through the filter+sort pipeline
// by checking aria-labels rather than rendered DOM count.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getVirtualItems: vi.fn(() => []),
    getTotalSize: vi.fn(() => 0),
    scrollToIndex: vi.fn(),
  })),
}));

vi.mock('@/components/watchlist/WatchlistContext', () => ({
  useWatchlist: () => ({ ids: new Set(), isLoading: false, toggle: vi.fn() }),
}));

afterEach(() => {
  mockSearchParams.forEach((_, k) => {
    mockSearchParams.delete(k);
  });
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderTable(players = SMOKE_PLAYERS): ReturnType<typeof render> {
  return render(<PlayersTable players={players} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PlayersTable', () => {
  // Mobile card stack (rendered without sm: breakpoint — jsdom has no viewport).
  // In jsdom both the desktop and mobile sections render; mobile cards have role=row
  // and are always present in the DOM. We test via the mobile cards since
  // the virtual desktop rows render 0 items (no DOM layout).

  it('renders a card for each player when no filters are active', () => {
    renderTable();
    // Each PlayerCard renders with role="row". Mobile section has 5.
    const rows = screen.getAllByRole('row');
    // At least 5 player cards (there may also be the header row in the desktop section)
    const playerRows = rows.filter((r) => r.getAttribute('role') === 'row');
    expect(playerRows.length).toBeGreaterThanOrEqual(SMOKE_PLAYERS.length);
  });

  it('shows player names in mobile cards', () => {
    renderTable();
    expect(screen.getAllByText('M. Salah').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('E. Haaland').length).toBeGreaterThanOrEqual(1);
  });

  it('filters by position — MID only keeps Salah and Saka', () => {
    mockSearchParams.set('pos', 'MID');
    renderTable();
    // MID players present
    expect(screen.getAllByText('M. Salah').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('B. Saka').length).toBeGreaterThanOrEqual(1);
    // Non-MID players absent
    expect(screen.queryByText('E. Haaland')).not.toBeInTheDocument();
    expect(screen.queryByText('V. van Dijk')).not.toBeInTheDocument();
    expect(screen.queryByText('J. Pickford')).not.toBeInTheDocument();
  });

  it('filters by search query — name match', () => {
    mockSearchParams.set('search', 'salah');
    renderTable();
    expect(screen.getAllByText('M. Salah').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('E. Haaland')).not.toBeInTheDocument();
  });

  it('filters by search query — team short-name match', () => {
    mockSearchParams.set('search', 'liv');
    renderTable();
    // LIV players: Salah and van Dijk
    expect(screen.getAllByText('M. Salah').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('V. van Dijk').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('E. Haaland')).not.toBeInTheDocument();
  });

  it('shows EmptyFilterState when filter produces 0 results', () => {
    mockSearchParams.set('search', 'zzznomatch');
    renderTable();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/no players match/i)).toBeInTheDocument();
  });

  it('does not show EmptyFilterState for an empty players array', () => {
    renderTable([]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('sorts by price ascending — cheapest first in mobile cards', () => {
    mockSearchParams.set('sort', 'price');
    mockSearchParams.set('order', 'asc');
    renderTable();
    const names = screen
      .getAllByText(/Pickford|van Dijk|Saka|Haaland|Salah/)
      .map((el) => el.textContent);
    const unique = [...new Set(names)];
    // Pickford (£5.5m) and van Dijk (£6.5m) should appear before Salah (£13.0m)
    expect(unique.indexOf('J. Pickford')).toBeLessThan(unique.indexOf('M. Salah'));
    expect(unique.indexOf('V. van Dijk')).toBeLessThan(unique.indexOf('M. Salah'));
  });

  it('sorts by name ascending — alphabetical order', () => {
    mockSearchParams.set('sort', 'name');
    mockSearchParams.set('order', 'asc');
    renderTable();
    const names = screen
      .getAllByText(/Pickford|van Dijk|Saka|Haaland|Salah/)
      .map((el) => el.textContent);
    const unique = [...new Set(names)];
    // 'B. Saka' < 'E. Haaland' alphabetically
    expect(unique.indexOf('B. Saka')).toBeLessThan(unique.indexOf('E. Haaland'));
    // 'E. Haaland' < 'J. Pickford'
    expect(unique.indexOf('E. Haaland')).toBeLessThan(unique.indexOf('J. Pickford'));
  });

  it('sorts by delta descending — highest latest delta first', () => {
    mockSearchParams.set('sort', 'delta');
    mockSearchParams.set('order', 'desc');
    renderTable();
    // SALAH recentDeltas[-1]=2, SAKA recentDeltas[-1]=1 — Salah must precede Saka
    const names = screen
      .getAllByText(/Pickford|van Dijk|Saka|Haaland|Salah/)
      .map((el) => el.textContent);
    const unique = [...new Set(names)];
    expect(unique.indexOf('M. Salah')).toBeLessThan(unique.indexOf('B. Saka'));
    expect(unique.indexOf('B. Saka')).toBeLessThan(unique.indexOf('J. Pickford'));
  });

  it('sorts by delta ascending — lowest latest delta first', () => {
    mockSearchParams.set('sort', 'delta');
    mockSearchParams.set('order', 'asc');
    renderTable();
    // PICKFORD recentDeltas[-1]=-1 < SALAH recentDeltas[-1]=2
    const names = screen
      .getAllByText(/Pickford|van Dijk|Saka|Haaland|Salah/)
      .map((el) => el.textContent);
    const unique = [...new Set(names)];
    expect(unique.indexOf('J. Pickford')).toBeLessThan(unique.indexOf('B. Saka'));
    expect(unique.indexOf('B. Saka')).toBeLessThan(unique.indexOf('M. Salah'));
  });

  it('filters with onlyEligible — excludes injured and stale players', () => {
    mockSearchParams.set('onlyEligible', 'true');
    const injured = makePlayer({ webName: 'Injured Player', status: 'i', recentAppearances: 3 });
    const stale = makePlayer({ webName: 'Stale Player', status: 'a', recentAppearances: 1 });
    renderTable([...SMOKE_PLAYERS, injured, stale]);
    expect(screen.queryByText('Injured Player')).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Player')).not.toBeInTheDocument();
    // All SMOKE_PLAYERS are status='a' and recentAppearances=3 — they pass
    expect(screen.getAllByText('M. Salah').length).toBeGreaterThanOrEqual(1);
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = renderTable();
    expect(await axe(container)).toHaveNoViolations();
  });
});
