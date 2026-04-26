import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import { confidenceToPercent } from '@/lib/utils/math';
import { classifyReason, isBigTeamMatch } from './types';
import type { ReasonKind, SnapshotPoint } from './types';

export interface MatchHistoryCardProps {
  readonly snapshot: SnapshotPoint;
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
    case 'motm_big':
    case 'motm_nonbig':
      return { label: 'MOTM', sublabel: null, icon: TrophyIcon, bgClass, iconClass };
    case 'clean_sheet_big':
    case 'clean_sheet_nonbig':
      return { label: 'Clean Sheet', sublabel: null, icon: ShieldIcon, bgClass, iconClass };
    case 'performance_big':
    case 'performance_nonbig':
      return { label: 'Assist', sublabel: null, icon: TrendingIcon, bgClass, iconClass };
    case 'blank_big':
    case 'blank_nonbig':
      return { label: 'Blank', sublabel: null, icon: CircleSlashIcon, bgClass, iconClass };
    case 'defcon':
      return { label: 'DefCon', sublabel: null, icon: DefConIcon, bgClass, iconClass };
    case 'fatigue':
      return { label: 'Fatigue', sublabel: null, icon: ZapIcon, bgClass, iconClass };
    case 'dgw':
      return { label: 'DGW', sublabel: null, icon: TrendingIcon, bgClass, iconClass };
    case 'other':
      return { label: 'Match', sublabel: null, icon: TrendingIcon, bgClass, iconClass };
  }
}

// ── Compound reason parsing — a reason may have multiple events ─────────────

function parseCompoundReason(reason: string): { label: string; isBig: boolean } {
  const isBig = isBigTeamMatch(reason);
  // Primary event is the first clause (before " + ")
  const primary = reason.split(' + ')[0] ?? reason;
  const lower = primary.toLowerCase();
  if (lower.includes('motm') || lower.includes('assist')) return { label: 'MOTM', isBig };
  if (lower.includes('clean sheet')) return { label: 'Clean Sheet', isBig };
  if (lower.includes('blank')) return { label: 'Blank', isBig };
  if (lower.includes('performance')) return { label: 'Assist', isBig };
  if (lower.includes('defcon')) return { label: 'DefCon', isBig };
  if (lower.includes('fatigue')) return { label: 'Fatigue', isBig };
  return { label: 'Match', isBig };
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
export function MatchHistoryCard({ snapshot }: MatchHistoryCardProps): JSX.Element {
  const { gameweek, delta, confidenceAfter, reason, fatigueApplied } = snapshot;
  const kind = classifyReason(reason);
  const { label, icon: Icon, bgClass, iconClass } = getPresentation(kind, delta);
  const { isBig } = parseCompoundReason(reason);

  const hasFatigueClause = fatigueApplied || reason.toLowerCase().includes('fatigue');

  const deltaColor = delta > 0 ? 'text-positive' : delta < 0 ? 'text-negative' : 'text-neutral';

  const confPercent = Math.round(confidenceToPercent(confidenceAfter));
  const confColor =
    confidenceAfter > 0 ? 'text-positive' : confidenceAfter < 0 ? 'text-negative' : 'text-neutral';

  return (
    <div
      className={cn(
        'border-border relative flex w-20 shrink-0 flex-col items-center rounded-[10px] border px-2 pt-2.5 pb-3',
        bgClass,
      )}
      role="listitem"
    >
      {/* Header: GW label + big-team badge */}
      <div className="flex w-full items-center justify-between">
        <span className="text-muted font-mono text-[10px] font-medium tracking-[0.04em] uppercase">
          GW{gameweek.toString()}
        </span>
        {isBig && (
          <span className="bg-accent/12 text-accent rounded-sm px-1 py-px font-mono text-[8px] font-semibold tracking-[0.05em] uppercase">
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
