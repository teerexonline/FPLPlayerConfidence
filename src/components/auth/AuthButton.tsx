'use client';

import type { JSX } from 'react';
import { useAuth } from './AuthContext';

/**
 * Header auth control. Switches between:
 * - "Sign in" text button (anonymous)
 * - Avatar circle with user initials + sign-out option (authenticated)
 */
export function AuthButton(): JSX.Element {
  const { user, isAuthenticated, openPanel, signOut } = useAuth();

  if (isAuthenticated && user) {
    const initials = user.email?.slice(0, 2).toUpperCase() ?? '??';
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void signOut();
          }}
          className="text-muted hover:text-text focus-visible:ring-accent font-sans text-[11px] font-medium tracking-[0.04em] uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Sign out"
        >
          Sign out
        </button>
        <div
          className="bg-accent/10 text-accent flex h-7 w-7 items-center justify-center rounded-full font-sans text-[10px] font-semibold"
          aria-label={`Signed in as ${user.email ?? 'unknown'}`}
          title={user.email ?? undefined}
        >
          {initials}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={openPanel}
      className="text-muted hover:text-text focus-visible:ring-accent font-sans text-[11px] font-medium tracking-[0.04em] uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      Sign in
    </button>
  );
}
