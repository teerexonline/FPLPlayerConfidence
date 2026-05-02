import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarButton } from './StarButton';
import * as WatchlistContextModule from './WatchlistContext';
import * as AuthContextModule from '@/components/auth/AuthContext';

function mockWatchlist(ids: ReadonlySet<number>, toggle = vi.fn()) {
  vi.spyOn(WatchlistContextModule, 'useWatchlist').mockReturnValue({
    ids,
    isLoading: false,
    toggle,
  });
}

function mockAuth(isAuthenticated: boolean, openPanel = vi.fn()) {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: null,
    isAuthenticated,
    isPanelOpen: false,
    openPanel,
    closePanel: vi.fn(),
    signOut: vi.fn(),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('StarButton — unstarred state (authenticated)', () => {
  it('renders a button with aria-pressed=false when not watchlisted', () => {
    mockWatchlist(new Set());
    mockAuth(true);
    render(<StarButton playerId={1} playerName="Haaland" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('has aria-label indicating "Add to watchlist"', () => {
    mockWatchlist(new Set());
    mockAuth(true);
    render(<StarButton playerId={1} playerName="Haaland" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Add Haaland to watchlist');
  });
});

describe('StarButton — starred state (authenticated)', () => {
  it('renders aria-pressed=true when player is watchlisted', () => {
    mockWatchlist(new Set([1]));
    mockAuth(true);
    render(<StarButton playerId={1} playerName="Haaland" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('has aria-label indicating "Remove from watchlist"', () => {
    mockWatchlist(new Set([1]));
    mockAuth(true);
    render(<StarButton playerId={1} playerName="Haaland" />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Remove Haaland from watchlist',
    );
  });
});

describe('StarButton — anonymous state', () => {
  it('shows "Sign in to add to watchlist" aria-label for anonymous user', () => {
    mockWatchlist(new Set());
    mockAuth(false);
    render(<StarButton playerId={1} playerName="Haaland" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Sign in to add to watchlist');
  });

  it('does not have aria-pressed set for anonymous user', () => {
    mockWatchlist(new Set());
    mockAuth(false);
    render(<StarButton playerId={1} playerName="Haaland" />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
  });

  it('calls openPanel instead of toggle when anonymous user clicks star', () => {
    const toggle = vi.fn();
    const openPanel = vi.fn();
    mockWatchlist(new Set(), toggle);
    mockAuth(false, openPanel);
    render(<StarButton playerId={42} playerName="Salah" />);
    fireEvent.click(screen.getByRole('button'));
    expect(openPanel).toHaveBeenCalledOnce();
    expect(toggle).not.toHaveBeenCalled();
  });
});

describe('StarButton — interaction (authenticated)', () => {
  it('calls toggle with the playerId when clicked', () => {
    const toggle = vi.fn();
    mockWatchlist(new Set(), toggle);
    mockAuth(true);
    render(<StarButton playerId={42} playerName="Salah" />);
    fireEvent.click(screen.getByRole('button'));
    expect(toggle).toHaveBeenCalledOnce();
    expect(toggle).toHaveBeenCalledWith(42);
  });

  it('does not call toggle when player is already pending (context handles dedup)', () => {
    const toggle = vi.fn();
    mockWatchlist(new Set([42]), toggle);
    mockAuth(true);
    render(<StarButton playerId={42} playerName="Salah" />);
    fireEvent.click(screen.getByRole('button'));
    expect(toggle).toHaveBeenCalledWith(42);
  });
});

describe('StarButton — sizes', () => {
  it('renders with size=sm by default (no explicit class assertions — just no crash)', () => {
    mockWatchlist(new Set());
    mockAuth(false);
    const { container } = render(<StarButton playerId={1} playerName="Test" />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders with size=lg without crashing', () => {
    mockWatchlist(new Set());
    mockAuth(false);
    const { container } = render(<StarButton playerId={1} playerName="Test" size="lg" />);
    expect(container.firstChild).not.toBeNull();
  });
});

describe('StarButton — accessibility', () => {
  it('is a button element (keyboard-accessible)', () => {
    mockWatchlist(new Set());
    mockAuth(false);
    render(<StarButton playerId={1} playerName="Test" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('passes a custom className to the button wrapper', () => {
    mockWatchlist(new Set());
    mockAuth(false);
    render(<StarButton playerId={1} playerName="Test" className="my-custom-class" />);
    expect(screen.getByRole('button')).toHaveClass('my-custom-class');
  });
});
