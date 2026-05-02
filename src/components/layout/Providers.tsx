'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/AuthContext';
import { AuthPanel } from '@/components/auth/AuthPanel';
import { WatchlistProvider } from '@/components/watchlist/WatchlistContext';

export interface ProvidersProps {
  readonly children: ReactNode;
}

/**
 * Root client-side providers. Order matters:
 * 1. ThemeProvider — CSS variables available to all descendants.
 * 2. AuthProvider — auth state + panel open/close available to all descendants.
 * 3. WatchlistProvider — fetches watchlist IDs (may depend on auth state in future).
 * AuthPanel lives here so it overlays the full page without z-index conflicts.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <WatchlistProvider>
          {children}
          <AuthPanel />
        </WatchlistProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
