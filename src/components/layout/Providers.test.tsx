import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from './Providers';

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
}));
// AuthProvider calls getSupabaseBrowserClient which requires env vars not present in tests.
vi.mock('@/components/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isPanelOpen: false,
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    signOut: vi.fn(),
  }),
}));
// AuthPanel also uses AuthContext; stub it to prevent cascading failures.
vi.mock('@/components/auth/AuthPanel', () => ({
  AuthPanel: () => null,
}));
// WatchlistProvider fetches data on mount; stub to avoid network calls in tests.
vi.mock('@/components/watchlist/WatchlistContext', () => ({
  WatchlistProvider: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
  useWatchlist: () => ({ ids: new Set(), isLoading: false, toggle: vi.fn() }),
}));

describe('Providers', () => {
  it('renders its children', () => {
    render(
      <Providers>
        <span>hello</span>
      </Providers>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
