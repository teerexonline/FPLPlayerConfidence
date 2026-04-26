import type { JSX } from 'react';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const W = 64;
const H = 20;
const PAD = 1.5;
const CONF_HALF = 5; // abs(min) === abs(max)
const STRIP_SLOTS = 5;

// ── Math helpers ──────────────────────────────────────────────────────────────

function toY(delta: number): number {
  const half = H / 2 - PAD;
  return H / 2 - (delta / CONF_HALF) * half;
}

function toX(index: number, total: number): number {
  if (total <= 1) return W / 2;
  return PAD + (index / (total - 1)) * (W - PAD * 2);
}

function polylinePoints(deltas: readonly number[]): string {
  return deltas.map((d, i) => `${toX(i, deltas.length).toFixed(2)},${toY(d).toFixed(2)}`).join(' ');
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ConfidenceTrendProps {
  /** Up to 5 GW deltas, oldest-first. Empty array renders a placeholder. */
  deltas: readonly number[];
  variant?: 'sparkline' | 'strip' | 'both';
  className?: string;
}

export function ConfidenceTrend({
  deltas,
  variant = 'sparkline',
  className,
}: ConfidenceTrendProps): JSX.Element {
  return (
    <div className={cn('inline-flex flex-col items-start gap-[2px]', className)} aria-hidden="true">
      {(variant === 'sparkline' || variant === 'both') && <SparklineSvg deltas={deltas} />}
      {(variant === 'strip' || variant === 'both') && <StripBars deltas={deltas} />}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function SparklineSvg({ deltas }: { readonly deltas: readonly number[] }): JSX.Element {
  const hasData = deltas.length > 0;
  const pts = hasData ? polylinePoints(deltas) : '';
  const lastDelta = deltas.at(-1) ?? 0;
  const dotX = hasData ? toX(deltas.length - 1, deltas.length) : W / 2;
  const dotY = toY(lastDelta);
  const dotColor =
    lastDelta > 0 ? 'text-positive' : lastDelta < 0 ? 'text-negative' : 'text-neutral';

  return (
    <svg width={W} height={H} viewBox="0 0 64 20" className="shrink-0 overflow-visible">
      {/* Zero baseline */}
      <line
        x1={PAD}
        y1={H / 2}
        x2={W - PAD}
        y2={H / 2}
        strokeWidth={0.5}
        className="stroke-border"
      />
      {hasData && (
        <>
          <polyline
            points={pts}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-accent"
          />
          <circle
            cx={dotX.toFixed(2)}
            cy={dotY.toFixed(2)}
            r={2}
            className={cn('fill-current', dotColor)}
          />
        </>
      )}
    </svg>
  );
}

// ── Strip ─────────────────────────────────────────────────────────────────────

function StripBars({ deltas }: { readonly deltas: readonly number[] }): JSX.Element {
  const offset = STRIP_SLOTS - deltas.length;

  return (
    <div className="flex gap-[2px]" style={{ width: W }}>
      {Array.from({ length: STRIP_SLOTS }, (_, slotIdx) => {
        const deltaIdx = slotIdx - offset;
        if (deltaIdx < 0 || deltas.length === 0) {
          return (
            <div
              key={slotIdx}
              className="border-border/60 h-[6px] flex-1 rounded-[1px] border"
              data-slot="no-data"
            />
          );
        }
        const d = deltas[deltaIdx] ?? 0;
        return (
          <div
            key={slotIdx}
            className={cn(
              'h-[6px] flex-1 rounded-[1px]',
              d > 0 ? 'bg-positive' : d < 0 ? 'bg-negative' : 'bg-neutral/25',
            )}
            data-slot={d > 0 ? 'positive' : d < 0 ? 'negative' : 'neutral'}
          />
        );
      })}
    </div>
  );
}
