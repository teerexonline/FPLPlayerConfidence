import type { HotStreakInfo } from '@/lib/confidence/hotStreak';
import type { Position } from '@/lib/db/types';

/** A single upcoming fixture rendered in the next-3 strip below a jersey. */
export interface NextFixture {
  readonly gameweek: number;
  readonly opponentTeamShortName: string;
  readonly isHome: boolean;
  /** 1–5 from the player's team perspective (lower = easier). */
  readonly fdr: number;
  readonly kickoffTime: string | null;
}

/** One player row rendered in StartingXIList or BenchSection. */
export interface SquadPlayerRow {
  readonly playerId: number;
  readonly webName: string;
  readonly teamCode: number;
  readonly teamShortName: string;
  readonly position: Position;
  readonly squadPosition: number;
  readonly isCaptain: boolean;
  readonly isViceCaptain: boolean;
  /** Current confidence integer in [-5, +5]. 0 if no snapshot found. */
  readonly confidence: number;
  /** Current price in tenths of millions (£0.1m). */
  readonly nowCost: number;
  readonly status: string;
  readonly chanceOfPlaying: number | null;
  readonly news: string;
  readonly hotStreak: HotStreakInfo | null;
  /** Up to 3 upcoming fixtures from currentGameweek+1 onward. May be empty late season. */
  readonly nextFixtures: readonly NextFixture[];
  /** Set only when viewMode === 'projected'. xP for the viewed gameweek's fixture(s). */
  readonly projectedXp: number | null;
  /** True only when viewMode === 'projected' AND this row was inserted via ?swap=. */
  readonly isSwappedIn: boolean;
}

/**
 * `historical` = viewing currentGW or earlier. Hero shows Team Confidence %.
 * `projected`  = viewing currentGW+1 or later. Hero shows projected team xP.
 */
export type MyTeamViewMode = 'historical' | 'projected';

/** Full view model returned by GET /api/my-team and consumed by MyTeamPageClient. */
export interface MyTeamData {
  readonly managerName: string;
  readonly teamName: string;
  readonly overallRank: number | null;
  readonly overallPoints: number;
  readonly gameweek: number;
  /** Team Confidence %, 0–100 rounded to 2 dp. Always present (0 in projected mode is fine). */
  readonly teamConfidencePercent: number;
  /** Positional line percents, each in [0, 100] rounded to 2 dp. */
  readonly defencePercent: number;
  readonly midfieldPercent: number;
  readonly attackPercent: number;
  /** Per-line projected xP totals (sum of starters' xP for that position group). */
  readonly defenceXp: number;
  readonly midfieldXp: number;
  readonly attackXp: number;
  /** 11 starters, ascending by squadPosition. */
  readonly starters: readonly SquadPlayerRow[];
  /** 4 bench players, ascending by squadPosition. */
  readonly bench: readonly SquadPlayerRow[];
  /** Unix ms timestamp from sync_meta.last_sync. */
  readonly syncedAt: number;
  /** True when the manager played Free Hit on the fetched GW and we fell back one GW. */
  readonly freeHitBypassed: boolean;
  /** The GW that had the Free Hit active; null when not bypassed. */
  readonly freeHitGameweek: number | null;
  /** True when the Free Hit was played on GW1 (no prior GW to fall back to). */
  readonly isGw1FreeHit: boolean;
  /** True when currentGw returned 404 (deadline not yet passed) and we fell back to currentGw-1. */
  readonly preDeadlineFallback: boolean;
  /** The live current gameweek — used to determine the scrubber timeline range. */
  readonly currentGameweek: number;
  /** Gameweeks with cached squad picks for this team, sorted ascending. */
  readonly availableGameweeks: readonly number[];
  /** The latest gameweek with at least one scheduled fixture (forward-scrubber cap). */
  readonly lastSeasonGameweek: number;
  /** `historical` for past+current GWs, `projected` for future GWs. */
  readonly viewMode: MyTeamViewMode;
  /** Sum of starters' xP for the viewed GW. Null in historical mode. */
  readonly projectedTeamXp: number | null;
  /** Echo of the parsed ?swap= input so the client can render staged swaps. */
  readonly appliedSwaps: readonly { readonly outId: number; readonly inId: number }[];
  /** Bank balance available for new transfers, in tenths of millions (£0.1m). */
  readonly bank: number;
  /** Total squad market value at the last deadline, in tenths of millions. */
  readonly squadValue: number;
  /**
   * Free transfers assumed available for the next gameweek. FPL's public API
   * doesn't expose the rolled-over count, so we default to 1. The UI labels
   * this as an assumption the user can verify.
   */
  readonly freeTransfers: number;
  /** Number of staged transfers (transfers, not subs) — drives the cost banner. */
  readonly stagedTransferCount: number;
  /** Net bank delta after applying staged transfers (positive = money left over). */
  readonly stagedTransferBankDelta: number;
  /** Point hit from staged transfers above the free count (negative or zero). */
  readonly stagedTransferPointCost: number;
}

/** Shape of error responses from GET /api/my-team. */
export type MyTeamApiError =
  | 'INVALID_TEAM_ID'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'NO_GAMEWEEK_DATA'
  | 'SCHEMA_ERROR'
  | 'PRE_SEASON';
