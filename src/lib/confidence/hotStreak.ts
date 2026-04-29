export type HotStreakLevel = 'red_hot' | 'med_hot' | 'low_hot';

/**
 * A single match entry in the chronological sequence used for streak calculation.
 * matchOrder is 0-indexed across all matches, including DGW sub-matches (two matches
 * in the same gameweek each get their own consecutive matchOrder values).
 */
export interface MatchBrief {
  readonly matchOrder: number;
  readonly delta: number;
}

/**
 * Classifies a hot streak level from the number of steps (matches or gameweeks)
 * elapsed since the boost. Used by both the match-based per-card path and the
 * GW-based bulk-query path (hence the "gws" name is kept for backward compat).
 *
 * 0 → 'red_hot'  (Fresh — same match as the boost)
 * 1 → 'med_hot'  (Recent — one match after)
 * 2 → 'low_hot'  (Fading — two matches after)
 * ≥3 → null      (Cold — expired)
 */
export function hotStreakFromGwsSince(gwsSince: number): HotStreakLevel | null {
  if (gwsSince === 0) return 'red_hot';
  if (gwsSince === 1) return 'med_hot';
  if (gwsSince === 2) return 'low_hot';
  return null;
}

/**
 * Computes the streak level for a specific match position in the player's
 * chronological match sequence.
 *
 * matchOrder is the 0-indexed position across ALL matches, including DGW sub-matches.
 * Two sub-matches in the same DGW have consecutive matchOrders, so the streak burns
 * through faster for DGW players: a boost in DGW match A means match B is already
 * 'recent', and the next single-GW card is 'fading'.
 *
 * Used by MatchHistoryStrip to annotate each card (including each DGW sub-card)
 * with the streak state that was active during that specific match.
 */
export function computeHotStreakAtMatch(
  matchBriefs: readonly MatchBrief[],
  atMatchOrder: number,
): HotStreakLevel | null {
  const mostRecentBoost = [...matchBriefs]
    .filter((b) => b.matchOrder <= atMatchOrder && b.delta >= 3)
    .sort((a, b) => b.matchOrder - a.matchOrder)[0];

  if (mostRecentBoost === undefined) return null;
  return hotStreakFromGwsSince(atMatchOrder - mostRecentBoost.matchOrder);
}

/**
 * Computes the hot streak level for a player as seen from a specific gameweek,
 * given the most recent past boost gameweek.
 *
 * Used by the /my-team route when serving a scrubber-selected historical GW.
 * The critical difference from hotStreakFromGwsSince: guards against future
 * boosts (boostGw > atGw) that would otherwise show a flame for events that
 * haven't happened yet from the viewer's perspective.
 */
export function hotStreakAtGw(boostGw: number, atGw: number): HotStreakLevel | null {
  if (boostGw > atGw) return null;
  return hotStreakFromGwsSince(atGw - boostGw);
}

/**
 * Computes a player's current hot streak level from their full match brief list.
 * Anchors to the highest matchOrder (most recent match) — a thin wrapper around
 * computeHotStreakAtMatch for the live-indicator path.
 *
 * DGW-aware: each DGW sub-match consumes one streak step, so a player who plays
 * two matches in a DGW burns through their streak faster than a single-GW player.
 *
 * Briefs may arrive in any order; the function sorts internally.
 */
export function computeHotStreak(matchBriefs: readonly MatchBrief[]): HotStreakLevel | null {
  if (matchBriefs.length === 0) return null;
  const maxOrder = Math.max(...matchBriefs.map((b) => b.matchOrder));
  return computeHotStreakAtMatch(matchBriefs, maxOrder);
}

/**
 * Regex matching a signed integer in parentheses — the per-sub-match delta marker
 * appended by collapseByGameweek when building DGW compound reason strings.
 * Format: `(+N)` or `(-N)` where N is one or more digits.
 *
 * Each DGW sub-match entry ends with exactly one such pattern; reason text clauses
 * (e.g. "Performance vs FDR 3 opponent + Fatigue") never contain this pattern, so
 * matchAll returns exactly one capture per sub-match — no false positives.
 */
const DGW_DELTA_RE = /\(([+-]\d+)\)/g;

function parseDgwSubDeltas(reason: string): readonly number[] | null {
  if (!reason.startsWith('DGW: ')) return null;
  const deltas = [...reason.matchAll(DGW_DELTA_RE)].map((m) => parseInt(m[1] ?? '0', 10));
  return deltas.length >= 2 ? deltas : null;
}

/**
 * Converts a chronologically-sorted list of GW snapshots into a flat MatchBrief
 * sequence with 0-indexed matchOrders. DGW snapshots (whose reason starts with
 * "DGW: ") are expanded into two consecutive entries using the per-sub-match
 * deltas embedded in the reason string, so each sub-match consumes one streak step.
 *
 * Input MUST be sorted by gameweek ascending — callers guarantee this via the
 * repository query order.
 *
 * This is the correct input-building step for computeHotStreak on the live bulk
 * path (Dashboard, Players list). It mirrors the logic in the Player Detail page
 * server component, ensuring both paths compute identical streak levels.
 */
export function buildMatchBriefs(
  snapshots: readonly { delta: number; reason: string }[],
): readonly MatchBrief[] {
  const briefs: MatchBrief[] = [];
  let cursor = 0;
  for (const s of snapshots) {
    const subDeltas = parseDgwSubDeltas(s.reason);
    if (subDeltas !== null) {
      for (const d of subDeltas) {
        briefs.push({ matchOrder: cursor, delta: d });
        cursor++;
      }
    } else {
      briefs.push({ matchOrder: cursor, delta: s.delta });
      cursor++;
    }
  }
  return briefs;
}
