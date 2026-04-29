/**
 * A player's hot streak magnitude level, derived from the delta of the triggering
 * boost match (delta ≥ 3). Color stays constant across all 3 streak matches.
 *
 * hot  (delta ≥ 5) → red    (#f43f5e)
 * warm (delta ≥ 4) → orange (#fb923c)
 * mild (delta ≥ 3) → slate  (#94a3b8)
 */
export type HotStreakLevel = 'hot' | 'warm' | 'mild';

/**
 * Rich hot-streak result returned by the compute functions.
 * The level encodes boost magnitude (not recency), so it is identical across
 * all 3 matches in the streak window.
 */
export interface HotStreakInfo {
  readonly level: HotStreakLevel;
  /** Delta of the original boost match that opened the streak window. */
  readonly boostDelta: number;
  /** Gameweek of the boost match, or null when briefs were built without GW info. */
  readonly boostGw: number | null;
  /** How many match steps after the boost this result represents (0 = boost match itself). */
  readonly matchesSinceBoost: number;
}

/**
 * A single match entry in the chronological sequence used for streak calculation.
 * matchOrder is 0-indexed across all matches, including DGW sub-matches (two matches
 * in the same gameweek each get their own consecutive matchOrder values).
 */
export interface MatchBrief {
  readonly matchOrder: number;
  readonly delta: number;
  /** Gameweek this match belongs to. null when the caller didn't supply GW context. */
  readonly gameweek: number | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function levelFromDelta(delta: number): HotStreakLevel {
  if (delta >= 5) return 'hot';
  if (delta >= 4) return 'warm';
  return 'mild';
}

/** Returns true when gwsSince is within the 3-match streak window [0, 2]. */
function isInStreakWindow(matchesSince: number): boolean {
  return matchesSince >= 0 && matchesSince <= 2;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Computes the hot streak level for a specific match position in the player's
 * chronological match sequence.
 *
 * The level is determined by the delta of the most recent qualifying boost at or
 * before atMatchOrder, not by the distance from the boost. All 3 matches in the
 * streak window carry the same color — only magnitude changes it.
 *
 * matchOrder is the 0-indexed position across ALL matches, including DGW sub-matches.
 * Two sub-matches in the same DGW have consecutive matchOrders, so the streak burns
 * through faster for DGW players.
 *
 * Used by MatchHistoryStrip to annotate each card with the streak state active
 * during that specific match.
 */
export function computeHotStreakAtMatch(
  matchBriefs: readonly MatchBrief[],
  atMatchOrder: number,
): HotStreakInfo | null {
  const mostRecentBoost = [...matchBriefs]
    .filter((b) => b.matchOrder <= atMatchOrder && b.delta >= 3)
    .sort((a, b) => b.matchOrder - a.matchOrder)[0];

  if (mostRecentBoost === undefined) return null;

  const matchesSinceBoost = atMatchOrder - mostRecentBoost.matchOrder;
  if (!isInStreakWindow(matchesSinceBoost)) return null;

  return {
    level: levelFromDelta(mostRecentBoost.delta),
    boostDelta: mostRecentBoost.delta,
    boostGw: mostRecentBoost.gameweek,
    matchesSinceBoost,
  };
}

/**
 * Computes the hot streak level for a player as seen from a specific gameweek,
 * given the boost gameweek and boost delta.
 *
 * Used by the /api/my-team route when computing streak for a scrubber-selected
 * historical GW. The GW-based window (≤2 GWs since boost) is intentional here;
 * the per-match path (computeHotStreakAtMatch) is used for match history cards.
 *
 * Guards against future boosts (boostGw > atGw) to avoid showing a flame for
 * events that haven't happened yet from the viewer's perspective.
 */
export function hotStreakAtGw(
  boostGw: number,
  atGw: number,
  boostDelta: number,
): HotStreakInfo | null {
  if (boostGw > atGw) return null;
  const matchesSinceBoost = atGw - boostGw;
  if (!isInStreakWindow(matchesSinceBoost)) return null;
  return {
    level: levelFromDelta(boostDelta),
    boostDelta,
    boostGw,
    matchesSinceBoost,
  };
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
export function computeHotStreak(matchBriefs: readonly MatchBrief[]): HotStreakInfo | null {
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
 * The optional gameweek field is passed through to MatchBrief so downstream
 * functions can include the boost GW in streak result metadata. When gameweek
 * is absent or undefined, boostGw is null in the HotStreakInfo result.
 *
 * This is the correct input-building step for computeHotStreak on the live bulk
 * path (Dashboard, Players list). It mirrors the logic in the Player Detail page
 * server component, ensuring both paths compute identical streak levels.
 */
export function buildMatchBriefs(
  snapshots: readonly { delta: number; reason: string; gameweek?: number }[],
): readonly MatchBrief[] {
  const briefs: MatchBrief[] = [];
  let cursor = 0;
  for (const s of snapshots) {
    const gw = s.gameweek ?? null;
    const subDeltas = parseDgwSubDeltas(s.reason);
    if (subDeltas !== null) {
      for (const d of subDeltas) {
        briefs.push({ matchOrder: cursor, delta: d, gameweek: gw });
        cursor++;
      }
    } else {
      briefs.push({ matchOrder: cursor, delta: s.delta, gameweek: gw });
      cursor++;
    }
  }
  return briefs;
}
