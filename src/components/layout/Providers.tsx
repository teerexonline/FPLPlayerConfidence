'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { WatchlistProvider } from '@/components/watchlist/WatchlistContext';

export interface ProvidersProps {
  readonly children: ReactNode;
}

/**
 * Root client-side providers. Order matters: ThemeProvider first (controls
 * CSS variables read by WatchlistProvider descendants), then WatchlistProvider
 * (fetches watchlist IDs once per app load for all StarButton components).
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <WatchlistProvider>{children}</WatchlistProvider>
    </ThemeProvider>
  );
}
