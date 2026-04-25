'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

export interface ProvidersProps {
  readonly children: ReactNode;
}

/**
 * Root client-side providers. Wraps the app in next-themes so any descendant
 * can read and set the current theme. `attribute="data-theme"` sets
 * data-theme="light|dark" on <html>, which our Tailwind dark: variant targets.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
