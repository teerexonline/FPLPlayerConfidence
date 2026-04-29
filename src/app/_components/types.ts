import type { HotStreakInfo } from '@/lib/confidence/hotStreak';
import type { Position } from '@/lib/confidence/types';

export interface DashboardPlayer {
  readonly id: number;
  readonly webName: string;
  readonly teamCode: number;
  readonly teamShortName: string;
  readonly position: Position;
  readonly confidence: number;
  readonly latestDelta: number;
  readonly latestGameweek: number;
  readonly recentDeltas: readonly number[];
  readonly status: string;
  readonly chanceOfPlaying: number | null;
  readonly news: string;
  readonly recentAppearances: number;
  readonly hotStreak: HotStreakInfo | null;
  /** Season total FPL points — used as a tiebreaker when primary sort values are equal. */
  readonly totalPoints: number;
}

/** Pre-computed top-10 slices by position, for the leaderboard tabs. */
export interface DashboardLeaderboard {
  readonly all: readonly DashboardPlayer[];
  readonly GK: readonly DashboardPlayer[];
  readonly DEF: readonly DashboardPlayer[];
  readonly MID: readonly DashboardPlayer[];
  readonly FWD: readonly DashboardPlayer[];
}

export interface DashboardData {
  readonly currentGameweek: number;
  /** Top 5 eligible risers this GW (status 'a', not stale), delta descending */
  readonly risers: readonly DashboardPlayer[];
  /** Top 5 eligible fallers this GW (status 'a', not stale), delta ascending */
  readonly fallers: readonly DashboardPlayer[];
  /** Top 10 slices by position (and overall), confidence descending */
  readonly leaderboard: DashboardLeaderboard;
  /** True when the DB has no confidence snapshots at all */
  readonly isEmpty: boolean;
}
