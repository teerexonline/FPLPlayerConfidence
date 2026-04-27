'use client';

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import { ConfidenceSlider } from '@/components/confidence/ConfidenceSlider';

interface ConfidenceHeroProps {
  readonly confidence: number;
  readonly latestDelta: number;
  readonly latestReason: string;
  readonly latestGameweek: number;
  readonly hasSnapshots: boolean;
  /** Whether the ConfidenceNumber should count up. False after first mount animation. */
  readonly animated: boolean;
}

/** Humanises the raw DB reason string into a readable sentence. */
function formatReason(reason: string, delta: number, gameweek: number): string {
  if (!reason) return '';
  const sign =
    delta > 0 ? `+${delta.toString()}` : delta < 0 ? `−${Math.abs(delta).toString()}` : '0';
  // Capitalise first letter for display
  const body = reason.charAt(0).toUpperCase() + reason.slice(1);
  return `GW${gameweek.toString()} · ${sign} · ${body}`;
}

/**
 * The page's centerpiece. Renders the 96px ConfidenceNumber with count-up,
 * then a ConfidenceSlider whose pill pulses into place 300ms after the
 * number animation completes (900ms total from mount).
 */
export function ConfidenceHero({
  confidence,
  latestDelta,
  latestReason,
  latestGameweek,
  hasSnapshots,
  animated,
}: ConfidenceHeroProps): JSX.Element {
  // Trigger the slider pulse after the 600ms count-up + 300ms delay
  const [pulsed, setPulsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPulsed(true);
    }, 900);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const reasonText = formatReason(latestReason, latestDelta, latestGameweek);

  if (!hasSnapshots) {
    return (
      <section aria-label="Player confidence" className="flex flex-col items-center gap-6 py-10">
        <ConfidenceNumber value={0} size="xl" animated={false} />
        <ConfidenceSlider value={0} />
        <p className="text-muted text-center text-[13px]">No matches recorded this season yet.</p>
      </section>
    );
  }

  return (
    <section aria-label="Player confidence" className="flex flex-col items-center gap-6 py-10">
      {/* Hero number — 96px, color-coded, count-up from 0 */}
      <div aria-live="polite">
        <ConfidenceNumber value={confidence} size="xl" animated={animated} />
      </div>

      {/* Slider — pill glides from center to final position, then pulses */}
      <div className="w-full px-4 sm:px-0">
        <ConfidenceSlider value={confidence} pulsed={pulsed} />
      </div>

      {/* Latest match reason — muted caption below the slider */}
      {reasonText && (
        <p className="text-muted text-center text-[13px] leading-relaxed">{reasonText}</p>
      )}
    </section>
  );
}
