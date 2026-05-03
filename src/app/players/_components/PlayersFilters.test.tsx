import { render, screen, within, fireEvent } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import { parseFilters, filtersToParams, PlayersFilters } from './PlayersFilters';
import { DEFAULT_FILTER_STATE } from './types';

// ── parseFilters ──────────────────────────────────────────────────────────────

describe('parseFilters', () => {
  it('returns default state for empty params', () => {
    const result = parseFilters(new URLSearchParams());
    expect(result).toEqual(DEFAULT_FILTER_STATE);
  });

  it('parses a single valid position', () => {
    const { positions } = parseFilters(new URLSearchParams('pos=MID'));
    expect(positions).toEqual(['MID']);
  });

  it('parses multiple valid positions', () => {
    const { positions } = parseFilters(new URLSearchParams('pos=GK&pos=DEF'));
    expect(positions).toEqual(['GK', 'DEF']);
  });

  it('ignores invalid position values', () => {
    const { positions } = parseFilters(new URLSearchParams('pos=STRIKER&pos=MID'));
    expect(positions).toEqual(['MID']);
  });

  it('parses a valid sort key', () => {
    const { sortKey } = parseFilters(new URLSearchParams('sort=price'));
    expect(sortKey).toBe('price');
  });

  it('falls back to confidence for invalid sort key', () => {
    const { sortKey } = parseFilters(new URLSearchParams('sort=goals'));
    expect(sortKey).toBe('confidence');
  });

  it('parses asc sort order', () => {
    const { sortOrder } = parseFilters(new URLSearchParams('order=asc'));
    expect(sortOrder).toBe('asc');
  });

  it('defaults to desc for invalid order value', () => {
    const { sortOrder } = parseFilters(new URLSearchParams('order=random'));
    expect(sortOrder).toBe('desc');
  });

  it('parses search param', () => {
    const { search } = parseFilters(new URLSearchParams('search=salah'));
    expect(search).toBe('salah');
  });

  it('parses minConf and maxConf', () => {
    const result = parseFilters(new URLSearchParams('minConf=-3&maxConf=4'));
    expect(result.minConf).toBe(-3);
    expect(result.maxConf).toBe(4);
  });

  it('clamps minConf to -5', () => {
    const { minConf } = parseFilters(new URLSearchParams('minConf=-99'));
    expect(minConf).toBe(-5);
  });

  it('clamps maxConf to 5', () => {
    const { maxConf } = parseFilters(new URLSearchParams('maxConf=99'));
    expect(maxConf).toBe(5);
  });

  it('parses onlyEligible=true from params', () => {
    expect(parseFilters(new URLSearchParams('onlyEligible=true')).onlyEligible).toBe(true);
  });

  it('returns onlyEligible: false when param is absent', () => {
    expect(parseFilters(new URLSearchParams()).onlyEligible).toBe(false);
  });

  it('returns onlyEligible: false for any value other than "true"', () => {
    expect(parseFilters(new URLSearchParams('onlyEligible=1')).onlyEligible).toBe(false);
    expect(parseFilters(new URLSearchParams('onlyEligible=false')).onlyEligible).toBe(false);
  });

  it('parses delta as a valid sort key', () => {
    expect(parseFilters(new URLSearchParams('sort=delta')).sortKey).toBe('delta');
  });
});

// ── filtersToParams ───────────────────────────────────────────────────────────

describe('filtersToParams', () => {
  it('returns empty string for default state', () => {
    const params = filtersToParams(DEFAULT_FILTER_STATE);
    expect(params.toString()).toBe('');
  });

  it('serializes multiple positions', () => {
    const params = filtersToParams({ ...DEFAULT_FILTER_STATE, positions: ['GK', 'FWD'] });
    expect(params.getAll('pos')).toEqual(['GK', 'FWD']);
  });

  it('serializes search', () => {
    const params = filtersToParams({ ...DEFAULT_FILTER_STATE, search: 'salah' });
    expect(params.get('search')).toBe('salah');
  });

  it('omits search key when search is empty', () => {
    const params = filtersToParams({ ...DEFAULT_FILTER_STATE, search: '' });
    expect(params.get('search')).toBeNull();
  });

  it('serializes sort + order when non-default', () => {
    const params = filtersToParams({ ...DEFAULT_FILTER_STATE, sortKey: 'price', sortOrder: 'asc' });
    expect(params.get('sort')).toBe('price');
    expect(params.get('order')).toBe('asc');
  });

  it('omits sort keys when equal to default', () => {
    const params = filtersToParams({
      ...DEFAULT_FILTER_STATE,
      sortKey: 'confidence',
      sortOrder: 'desc',
    });
    expect(params.get('sort')).toBeNull();
    expect(params.get('order')).toBeNull();
  });

  it('serializes minConf when non-default', () => {
    const params = filtersToParams({ ...DEFAULT_FILTER_STATE, minConf: -3 });
    expect(params.get('minConf')).toBe('-3');
  });

  it('serializes maxConf when non-default', () => {
    const params = filtersToParams({ ...DEFAULT_FILTER_STATE, maxConf: 4 });
    expect(params.get('maxConf')).toBe('4');
  });

  it('omits minConf/maxConf when equal to defaults', () => {
    const params = filtersToParams({ ...DEFAULT_FILTER_STATE, minConf: -5, maxConf: 5 });
    expect(params.get('minConf')).toBeNull();
    expect(params.get('maxConf')).toBeNull();
  });

  it('serializes onlyEligible=true when active', () => {
    const params = filtersToParams({ ...DEFAULT_FILTER_STATE, onlyEligible: true });
    expect(params.get('onlyEligible')).toBe('true');
  });

  it('omits onlyEligible when false', () => {
    const params = filtersToParams({ ...DEFAULT_FILTER_STATE, onlyEligible: false });
    expect(params.get('onlyEligible')).toBeNull();
  });
});

// ── PlayersFilters component ──────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/players'),
}));

describe('PlayersFilters component', () => {
  it('renders position filter buttons', () => {
    render(<PlayersFilters searchValue="" onSearchChange={vi.fn()} />);
    for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
      expect(screen.getByRole('button', { name: pos })).toBeInTheDocument();
    }
  });

  it('renders sort buttons', () => {
    render(<PlayersFilters searchValue="" onSearchChange={vi.fn()} />);
    const sortGroup = screen.getByRole('group', { name: /sort players/i });
    expect(within(sortGroup).getByRole('button', { name: /confidence/i })).toBeInTheDocument();
    expect(within(sortGroup).getByRole('button', { name: /price/i })).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<PlayersFilters searchValue="" onSearchChange={vi.fn()} />);
    expect(screen.getByRole('searchbox', { name: /search players/i })).toBeInTheDocument();
  });

  it('does not render Clear button when no filters active', () => {
    render(<PlayersFilters searchValue="" onSearchChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('position button calls router.push with pos param', () => {
    mockPush.mockClear();
    render(<PlayersFilters searchValue="" onSearchChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'MID' }));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('pos=MID'), expect.anything());
  });

  it('sort button calls router.push', () => {
    mockPush.mockClear();
    render(<PlayersFilters searchValue="" onSearchChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /price/i }));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('sort=price'), expect.anything());
  });

  it('search input change calls onSearchChange (no URL push)', () => {
    mockPush.mockClear();
    const onSearchChange = vi.fn();
    render(<PlayersFilters searchValue="" onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'salah' } });
    // Search is now local state owned by PlayersInteractive — the input fires
    // the parent callback synchronously and does not touch the URL.
    expect(onSearchChange).toHaveBeenCalledWith('salah');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('renders delta sort button', () => {
    render(<PlayersFilters searchValue="" onSearchChange={vi.fn()} />);
    const sortGroup = screen.getByRole('group', { name: /sort players/i });
    expect(within(sortGroup).getByRole('button', { name: /delta/i })).toBeInTheDocument();
  });

  it('does not render eligible movers chip when onlyEligible is false', () => {
    render(<PlayersFilters searchValue="" onSearchChange={vi.fn()} />);
    expect(screen.queryByText(/eligible movers only/i)).not.toBeInTheDocument();
  });

  it('renders eligible movers chip when onlyEligible param is set', () => {
    vi.mocked(useSearchParams).mockReturnValueOnce(
      new URLSearchParams('onlyEligible=true') as unknown as ReturnType<typeof useSearchParams>,
    );
    render(<PlayersFilters searchValue="" onSearchChange={vi.fn()} />);
    expect(screen.getByText(/eligible movers only/i)).toBeInTheDocument();
  });

  it('clicking eligible movers chip dismiss button clears onlyEligible', () => {
    mockPush.mockClear();
    vi.mocked(useSearchParams).mockReturnValueOnce(
      new URLSearchParams('onlyEligible=true') as unknown as ReturnType<typeof useSearchParams>,
    );
    render(<PlayersFilters searchValue="" onSearchChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /remove eligible movers filter/i }));
    expect(mockPush).toHaveBeenCalledWith('/players', expect.anything());
  });
});
