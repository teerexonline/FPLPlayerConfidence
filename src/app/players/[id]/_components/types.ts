import type { Position } from '@/lib/db/types';

/** A single gameweek confidence data point — the full snapshot row. */
export interface SnapshotPoint {
  readonly gameweek: number;
  readonly confidenceAfter: number;
  readonly delta: number;
  readonly reason: string;
  readonly fatigueApplied: boolean;
  readonly motmCounter: number;
}

/**
 * Parsed reason classification derived from the reason string stored in the DB.
 * The reason encodes the event type and opponent tier.
 */
export type ReasonKind =
  | 'motm_big'
  | 'motm_nonbig'
  | 'clean_sheet_big'
  | 'clean_sheet_nonbig'
  | 'blank_big'
  | 'blank_nonbig'
  | 'performance_big'
  | 'performance_nonbig'
  | 'defcon'
  | 'fatigue'
  | 'dgw'
  | 'other';

/** Server-composed view model passed from page.tsx to client components. */
export interface PlayerDetailData {
  readonly id: number;
  readonly webName: string;
  readonly teamCode: number;
  readonly teamName: string;
  readonly teamShortName: string;
  readonly position: Position;
  /** Price in tenths of £m (e.g. 130 = £13.0m). */
  readonly nowCost: number;
  /** Current confidence value, integer in [−5, +5]. */
  readonly confidence: number;
  /** Delta from the most recent snapshot. */
  readonly latestDelta: number;
  /** Human-readable reason for the latest delta. */
  readonly latestReason: string;
  /** Gameweek of the most recent snapshot. */
  readonly latestGameweek: number;
  /** Full season history, ascending by gameweek. Empty for players with no appearances. */
  readonly snapshots: readonly SnapshotPoint[];
}

// ── DGW reason parsing ────────────────────────────────────────────────────────

/** A single match component within a double-gameweek snapshot. */
export interface DgwPart {
  readonly reason: string;
  readonly delta: number;
}

/**
 * Matches a part that ends with a signed delta in parentheses, e.g. `Blank vs FDR 3 opponent (-1)`.
 * Requires a sign (`+` or `-`) and digits — excludes `(MOTM)` and other non-numeric suffixes.
 */
const DELTA_SUFFIX_RE = /^(.*)\s*\(([+-]\d+)\)$/;

/**
 * Parses a DGW compound reason string into its per-match components.
 *
 * Format: `DGW: <reason1> (<delta1>) + <reason2> (<delta2>)` where each entry reason
 * can itself contain ` + ` (e.g. a fatigue clause). The parser identifies entry boundaries
 * by looking for parts ending with `(<signed_delta>)` — parts without this suffix are
 * accumulated into the next entry (they are mid-reason `+` clauses, not entry separators).
 *
 * Returns `null` for non-DGW reasons or malformed strings (fewer than 2 entries).
 */
export function parseDgwReason(reason: string): readonly DgwPart[] | null {
  if (!reason.startsWith('DGW: ')) return null;
  const body = reason.slice(5);
  const rawParts = body.split(' + ');

  const entries: DgwPart[] = [];
  const accumulated: string[] = [];

  for (const part of rawParts) {
    const match = DELTA_SUFFIX_RE.exec(part);
    if (match !== null) {
      const reasonText = [...accumulated, (match[1] ?? '').trimEnd()].join(' + ');
      const delta = parseInt(match[2] ?? '0', 10);
      entries.push({ reason: reasonText, delta });
      accumulated.length = 0;
    } else {
      accumulated.push(part);
    }
  }

  return entries.length >= 2 ? entries : null;
}

/**
 * True when the reason indicates a big-team opponent.
 * Reason strings use "vs big team" for big opponents and "vs non-big team" for others.
 * We match "vs big team" explicitly to avoid "non-big team" containing "big team".
 */
export function isBigTeamMatch(reason: string): boolean {
  return /vs big team/i.test(reason) && !/non-big team/i.test(reason);
}

/** Classifies a reason string into a structured kind based on the PRIMARY event clause. */
export function classifyReason(reason: string): ReasonKind {
  const lower = reason.toLowerCase();
  if (lower.startsWith('dgw:')) return 'dgw';
  // Examine only the primary clause (before the first " + ") so compound reasons like
  // "Performance vs big team + DefCon" classify by Performance, not DefCon.
  const primaryClause = reason.split(' + ')[0] ?? reason;
  const primaryLower = primaryClause.toLowerCase();
  // Use isBigTeamMatch to correctly distinguish "vs big team" from "vs non-big team"
  const big = isBigTeamMatch(reason);
  if (primaryLower.includes('motm') || primaryLower.includes('assist'))
    return big ? 'motm_big' : 'motm_nonbig';
  if (primaryLower.includes('clean sheet')) return big ? 'clean_sheet_big' : 'clean_sheet_nonbig';
  if (primaryLower.includes('blank')) return big ? 'blank_big' : 'blank_nonbig';
  if (primaryLower.includes('performance')) return big ? 'performance_big' : 'performance_nonbig';
  if (primaryLower.includes('defcon')) return 'defcon';
  if (primaryLower.includes('fatigue')) return 'fatigue';
  return 'other';
}
