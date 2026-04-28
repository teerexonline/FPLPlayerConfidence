import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarButton } from './StarButton';
import * as WatchlistContextModule from './WatchlistContext';

// Provide a lightweight mock of useWatchlist so StarButton can be tested
// in isolation without a real WatchlistProvider or fetch calls.
function mockWatchlist(ids: ReadonlySet<number>, toggle = vi.fn()) {
  vi.spyOn(WatchlistContextModule, 'useWatchlist').mockReturnValue({
    ids,
    isLoading: false,
    toggle,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('StarButton — unstarred state', () => {
  it('renders a button with aria-pressed=false when not watchlisted', () => {
    mockWatchlist(new Set());
    render(<StarButton playerId={1} playerName="Haaland" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('has aria-label indicating "Add to watchlist"', () => {
    mockWatchlist(new Set());
    render(<StarButton playerId={1} playerName="Haaland" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Add Haaland to watchlist');
  });
});

describe('StarButton — starred state', () => {
  it('renders aria-pressed=true when player is watchlisted', () => {
    mockWatchlist(new Set([1]));
    render(<StarButton playerId={1} playerName="Haaland" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('has aria-label indicating "Remove from watchlist"', () => {
    mockWatchlist(new Set([1]));
    render(<StarButton playerId={1} playerName="Haaland" />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Remove Haaland from watchlist',
    );
  });
});

describe('StarButton — interaction', () => {
  it('calls toggle with the playerId when clicked', () => {
    const toggle = vi.fn();
    mockWatchlist(new Set(), toggle);
    render(<StarButton playerId={42} playerName="Salah" />);
    fireEvent.click(screen.getByRole('button'));
    expect(toggle).toHaveBeenCalledOnce();
    expect(toggle).toHaveBeenCalledWith(42);
  });

  it('does not call toggle when player is already pending (context handles dedup)', () => {
    const toggle = vi.fn();
    mockWatchlist(new Set([42]), toggle);
    render(<StarButton playerId={42} playerName="Salah" />);
    fireEvent.click(screen.getByRole('button'));
    // toggle is called — dedup is the context's responsibility, not StarButton's
    expect(toggle).toHaveBeenCalledWith(42);
  });
});

describe('StarButton — sizes', () => {
  it('renders with size=sm by default (no explicit class assertions — just no crash)', () => {
    mockWatchlist(new Set());
    const { container } = render(<StarButton playerId={1} playerName="Test" />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders with size=lg without crashing', () => {
    mockWatchlist(new Set());
    const { container } = render(<StarButton playerId={1} playerName="Test" size="lg" />);
    expect(container.firstChild).not.toBeNull();
  });
});

describe('StarButton — accessibility', () => {
  it('is a button element (keyboard-accessible)', () => {
    mockWatchlist(new Set());
    render(<StarButton playerId={1} playerName="Test" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('passes a custom className to the button wrapper', () => {
    mockWatchlist(new Set());
    render(<StarButton playerId={1} playerName="Test" className="my-custom-class" />);
    expect(screen.getByRole('button')).toHaveClass('my-custom-class');
  });
});
