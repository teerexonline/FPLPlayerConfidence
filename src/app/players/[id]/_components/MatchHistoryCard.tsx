import type { JSX } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { confidenceToPercent } from '@/lib/utils/math';
import { classifyReason } from './types';
import type { ReasonKind, SnapshotPoint } from './types';

export interface MatchHistoryCardProps {
  readonly snapshot: SnapshotPoint;
  readonly isSelected?: boolean;
  readonly onClick?: () => void;
}

// ── Icon SVG paths ──────────────────────────────────────────────────────────

export function TrophyIcon({ className }: { readonly className?: string }): JSX.Element {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 21h8M12 17v4M5 3H3a2 2 0 000 4c0 3 2 5 4 6M19 3h2a2 2 0 010 4c0 3-2 5-4 6"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 17c-3.314 0-6-2.686-6-6V3h12v8c0 3.314-2.686 6-6 6z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldIcon({ className }: { readonly className?: string }): JSX.Element {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6l-9-4z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrendingIcon({ className }: { readonly className?: string }): JSX.Element {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <polyline
        points="22 7 13.5 15.5 8.5 10.5 2 17"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="16 7 22 7 22 13"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CircleSlashIcon({ className }: { readonly className?: string }): JSX.Element {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={1.75} />
      <line
        x1={4.93}
        y1={4.93}
        x2={19.07}
        y2={19.07}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ZapIcon({ className }: { readonly className?: string }): JSX.Element {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <polygon
        points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DefConIcon({ className }: { readonly className?: string }): JSX.Element {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6l-9-4z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="9"
        y1="12"
        x2="15"
        y2="12"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Derived presentation values ─────────────────────────────────────────────

export interface CardPresentation {
  readonly label: string;
  readonly sublabel: string | null;
  readonly icon: (props: { className?: string }) => JSX.Element;
  readonly bgClass: string;
  readonly iconClass: string;
}

export function getPresentation(kind: ReasonKind, delta: number): CardPresentation {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const bgClass = isPositive ? 'bg-positive/8' : isNegative ? 'bg-negative/8' : 'bg-border/30';
  const iconClass = isPositive ? 'text-positive' : isNegative ? 'text-negative' : 'text-neutral';

  switch (kind) {
    case 'motm':
      return { label: 'MOTM', sublabel: null, icon: TrophyIcon, bgClass, iconClass };
    case 'clean_sheet':
      return { label: 'Clean Sheet', sublabel: null, icon: ShieldIcon, bgClass, iconClass };
    case 'performance':
      return { label: 'Assist', sublabel: null, icon: TrendingIcon, bgClass, iconClass };
    case 'blank':
      return { label: 'Blank', sublabel: null, icon: CircleSlashIcon, bgClass, iconClass };
    case 'defcon':
      return { label: 'DefCon', sublabel: null, icon: DefConIcon, bgClass, iconClass };
    case 'savecon':
      return { label: 'SaveCon', sublabel: null, icon: ShieldIcon, bgClass, iconClass };
    case 'fatigue':
      return { label: 'Fatigue', sublabel: null, icon: ZapIcon, bgClass, iconClass };
    case 'dgw':
      return { label: 'DGW', sublabel: null, icon: TrendingIcon, bgClass, iconClass };
    case 'other':
      return { label: 'Match', sublabel: null, icon: TrendingIcon, bgClass, iconClass };
  }
}

// ── Delta display ───────────────────────────────────────────────────────────

export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta.toString()}`;
  if (delta < 0) return `−${Math.abs(delta).toString()}`; // Unicode minus
  return '0';
}

// ── MatchHistoryCard ────────────────────────────────────────────────────────

/**
 * A compact vertical card for a single gameweek snapshot.
 * Width is fixed at 80px — the strip lays them horizontally.
 * Background tint encodes the delta sign at a glance.
 */
export function MatchHistoryCard({
  snapshot,
  isSelected = false,
  onClick,
}: MatchHistoryCardProps): JSX.Element {
  const { gameweek, delta, confidenceAfter, reason, fatigueApplied } = snapshot;
  const kind = classifyReason(reason);
  const { label, icon: Icon, bgClass, iconClass } = getPresentation(kind, delta);

  const hasFatigueClause = fatigueApplied || reason.toLowerCase().includes('fatigue');
  const isBigOpponent = reason.includes('vs BIG opponent');
  const isBoostMatch = delta >= 3;

  const deltaColor = delta > 0 ? 'text-positive' : delta < 0 ? 'text-negative' : 'text-neutral';

  const confPercent = Math.round(confidenceToPercent(confidenceAfter));
  const confColor =
    confidenceAfter > 0 ? 'text-positive' : confidenceAfter < 0 ? 'text-negative' : 'text-neutral';

  return (
    <div
      className={cn(
        'border-border relative flex w-20 shrink-0 flex-col items-center rounded-[10px] border px-2 pt-2.5 pb-3',
        bgClass,
        isBoostMatch && 'border-t-2 border-t-[#f59e0b]',
        isSelected && 'ring-accent ring-1',
        onClick && 'cursor-pointer',
      )}
      role="listitem"
      aria-label={`GW${gameweek.toString()}, ${label}, ${formatDelta(delta)}`}
      aria-current={isSelected ? 'true' : undefined}
      data-gameweek={gameweek}
      data-boost={isBoostMatch ? 'true' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Header: GW label + optional boost dot + optional BIG badge
          Interactive (onClick provided): split into child spans so getNodeText="" — avoids
          conflicting with hero text when getByText(/GWxx/) is queried in tests.
          Non-interactive: direct text nodes so getByText('GW1') works in strip-only tests. */}
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-1">
          {onClick ? (
            <span className="text-muted font-mono text-[10px] font-medium tracking-[0.04em] uppercase">
              <span>GW</span>
              <span>{gameweek.toString()}</span>
            </span>
          ) : (
            <span className="text-muted font-mono text-[10px] font-medium tracking-[0.04em] uppercase">
              GW{gameweek.toString()}
            </span>
          )}
          {isBoostMatch && (
            <span role="img" aria-label="boost match" className="inline-flex shrink-0 items-center">
              <Flame aria-hidden="true" className="h-3 w-3 text-[#f59e0b]" />
            </span>
          )}
        </div>
        {isBigOpponent && (
          <span
            className="bg-accent/15 text-accent rounded-sm px-[3px] py-px text-[7px] leading-none font-bold tracking-[0.06em] uppercase"
            aria-label="big team opponent"
          >
            BIG
          </span>
        )}
      </div>

      {/* Event icon */}
      <div className="mt-2.5 mb-1.5">
        <Icon className={iconClass} />
      </div>

      {/* Event label */}
      <span className="text-muted text-center text-[10px] leading-tight font-medium">{label}</span>

      {/* Divider */}
      <div className="bg-border/60 my-2 h-px w-full" />

      {/* Delta — the number that matters */}
      <span
        className={cn('text-[20px] leading-none font-semibold tabular-nums', deltaColor)}
        data-sign={delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'}
      >
        {formatDelta(delta)}
      </span>

      {/* Fatigue annotation */}
      {hasFatigueClause && (
        <span className="text-negative mt-1 text-[9px] font-medium">−2 fatigue</span>
      )}

      {/* Confidence after — percentage state */}
      <span className={cn('mt-1.5 text-[10px] font-medium tabular-nums', confColor)}>
        {confPercent.toString()}%
      </span>
    </div>
  );
}
