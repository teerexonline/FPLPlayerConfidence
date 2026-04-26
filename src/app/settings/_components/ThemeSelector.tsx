'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import type { JSX } from 'react';

function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

type ThemeOption = 'system' | 'light' | 'dark';

const OPTIONS: { value: ThemeOption; label: string; description: string }[] = [
  { value: 'system', label: 'System', description: 'Follow your OS setting' },
  { value: 'light', label: 'Light', description: 'Always use light mode' },
  { value: 'dark', label: 'Dark', description: 'Always use dark mode' },
];

export function ThemeSelector(): JSX.Element {
  const { theme, setTheme } = useTheme();
  const hasMounted = useHasMounted();

  // Render the same structure on both server and client — only the checked state
  // differs after hydration. This avoids CLS from a skeleton → content swap.
  // `hasMounted` guards only the checked state; structure is always stable.
  const activeTheme = (hasMounted ? (theme ?? 'system') : 'system') as ThemeOption;

  return (
    <div role="radiogroup" aria-label="Theme" className="space-y-2">
      {OPTIONS.map(({ value, label, description }) => {
        const isSelected = activeTheme === value;
        return (
          <label
            key={value}
            className={[
              'flex cursor-pointer items-center gap-3 rounded-[6px] border px-4 py-3 transition-colors',
              'focus-within:ring-accent focus-within:ring-2 focus-within:ring-offset-1',
              isSelected
                ? 'border-accent bg-surface'
                : 'border-border bg-surface hover:border-muted',
            ].join(' ')}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={isSelected}
              onChange={() => {
                setTheme(value);
              }}
              className="sr-only"
            />
            {/* Custom radio indicator */}
            <span
              className={[
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                isSelected ? 'border-accent' : 'border-muted',
              ].join(' ')}
              aria-hidden="true"
            >
              {isSelected && <span className="bg-accent h-2 w-2 rounded-full" />}
            </span>
            <span className="flex flex-col">
              <span className="text-text font-sans text-[14px] leading-none font-medium">
                {label}
              </span>
              <span className="text-muted mt-1 font-sans text-[12px] leading-none">
                {description}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
