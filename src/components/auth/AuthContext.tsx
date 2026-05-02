'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface AuthContextValue {
  /** Current Supabase auth user, or null if anonymous / not yet resolved. */
  readonly user: User | null;
  readonly isAuthenticated: boolean;
  /** Whether the auth slide-over panel is open. */
  readonly isPanelOpen: boolean;
  readonly openPanel: () => void;
  readonly closePanel: () => void;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const supabase = getSupabaseBrowserClient();

    // Hydrate immediately from the current session.
    void supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUser(data.user);
    });

    // Keep state in sync with sign-in / sign-out / token-refresh events.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
  }, []);
  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setIsPanelOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isPanelOpen,
        openPanel,
        closePanel,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
