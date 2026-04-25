'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

export interface ThemeToggleProps {
  readonly className?: string;
}

/**
 * Returns true on the client after hydration, false during SSR and on the
 * first render. Uses useSyncExternalStore so React knows the server and
 * client snapshots differ — avoiding the hydration mismatch without a
 * useEffect/setState cascade.
 */
function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

/**
 * Minimal theme toggle. Defers rendering until hydration so we know the
 * resolved theme (system preference) rather than guessing on the server.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const hasMounted = useHasMounted();

  if (!hasMounted) {
    return <span className={className} style={{ width: 48, display: 'inline-block' }} />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(isDark ? 'light' : 'dark');
      }}
      className={className}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? 'Light' : 'Dark'}
    </button>
  );
}
