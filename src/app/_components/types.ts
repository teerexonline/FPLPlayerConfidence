import type { HotStreakLevel } from '@/lib/confidence/hotStreak';
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
  readonly hotStreakLevel: HotStreakLevel | null;
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
  /** Top 3 by positive delta this GW, delta descending */
  readonly risers: readonly DashboardPlayer[];
  /** Top 3 by negative delta this GW, delta ascending */
  readonly fallers: readonly DashboardPlayer[];
  /** Top 10 slices by position (and overall), confidence descending */
  readonly leaderboard: DashboardLeaderboard;
  /** True when the DB has no confidence snapshots at all */
  readonly isEmpty: boolean;
}
