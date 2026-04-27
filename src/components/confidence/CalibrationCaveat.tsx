'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { JSX } from 'react';
import { cn } from '@/lib/utils';

const TOOLTIP_TEXT =
  'Goal probability for forwards may run slightly higher than actual outcomes. ' +
  'Calibrated MACE: 7.4 percentage points. Use as directional signal rather than precise probability.';

interface CalibrationCaveatProps {
  /** Additional className for the wrapper span. */
  readonly className?: string;
}

/**
 * Small "?" icon with a tooltip surfacing the FWD P(Goal) calibration caveat.
 * Rendered only for FWD players in G (goal probability) mode.
 */
export function CalibrationCaveat({ className }: CalibrationCaveatProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent): void {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label="Calibration note"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className={cn(
          'text-muted/60 hover:text-muted border-border inline-flex h-4 w-4 items-center justify-center',
          'rounded-full border font-sans text-[9px] leading-none font-semibold transition-colors',
          'focus-visible:ring-accent focus-visible:ring-1 focus-visible:outline-none',
        )}
      >
        ?
      </button>

      {open && (
        <span
          role="tooltip"
          className={cn(
            'bg-surface border-border text-muted absolute bottom-full left-1/2 z-10 mb-1.5',
            'w-[220px] -translate-x-1/2 rounded-[6px] border px-3 py-2',
            'font-sans text-[11px] leading-relaxed shadow-lg',
          )}
        >
          {TOOLTIP_TEXT}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={handleClose}
            className="text-muted/40 hover:text-muted ml-1 underline underline-offset-2 transition-colors"
          >
            Got it
          </button>
        </span>
      )}
    </span>
  );
}
