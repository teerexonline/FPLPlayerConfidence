import type { Position } from '@/lib/db/types';

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
  /** Predicted goal probability [0, 1]. 0 when ICT data unavailable. */
  readonly pGoal: number;
  /** Predicted assist probability [0, 1]. 0 when ICT data unavailable. */
  readonly pAssist: number;
  readonly status: string;
  readonly chanceOfPlaying: number | null;
  readonly news: string;
}

/** Full view model returned by GET /api/my-team and consumed by MyTeamPageClient. */
export interface MyTeamData {
  readonly managerName: string;
  readonly teamName: string;
  readonly overallRank: number | null;
  readonly overallPoints: number;
  readonly gameweek: number;
  /** Team Confidence %, 0–100 rounded to 2 dp. */
  readonly teamConfidencePercent: number;
  /** Positional line percents, each in [0, 100] rounded to 2 dp. */
  readonly defencePercent: number;
  readonly midfieldPercent: number;
  readonly attackPercent: number;
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
}

/** Shape of error responses from GET /api/my-team. */
export type MyTeamApiError =
  | 'INVALID_TEAM_ID'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'NO_GAMEWEEK_DATA'
  | 'SCHEMA_ERROR'
  | 'PRE_SEASON';
