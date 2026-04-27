import type { PlayerId, TeamId } from '@/lib/db/types';
import type { Position } from '@/lib/confidence/types';

export type { Position };

export interface PlayerWithConfidence {
  readonly id: PlayerId;
  readonly webName: string;
  readonly teamId: TeamId;
  /** FPL team code (teams[].code, NOT teams[].id) — used for jersey CDN URLs. */
  readonly teamCode: number;
  readonly teamShortName: string;
  readonly position: Position;
  /** Price in tenths of a pound — 130 = £13.0m. */
  readonly nowCost: number;
  /** Current confidence, clamped to [-5, +5]. */
  readonly confidence: number;
  /** Deltas from the last ≤5 matches the player appeared in, oldest-first. */
  readonly recentDeltas: readonly number[];
  readonly gameweek: number;
  /** FPL availability status: 'a'=available, 'd'=doubtful, 'i'=injured, 's'=suspended, 'n'=not available, 'u'=unavailable. */
  readonly status: string;
  /** 0–100 or null when FPL has no estimate. */
  readonly chanceOfPlaying: number | null;
  /** Injury/availability news text from FPL (may be empty string). */
  readonly news: string;
  /** Snapshot count in the window [currentGW-2, currentGW]. 0–3. */
  readonly recentAppearances: number;
  /** P(Goal) for the next fixture in [0, 1]. 0 when no data available. */
  readonly pGoal: number;
  /** P(Assist) for the next fixture in [0, 1]. 0 when no data available. */
  readonly pAssist: number;
}

export type SortKey = 'confidence' | 'price' | 'name' | 'team' | 'pGoal' | 'pAssist';
export type SortOrder = 'asc' | 'desc';

export interface FilterState {
  readonly positions: readonly Position[];
  readonly search: string;
  readonly sortKey: SortKey;
  readonly sortOrder: SortOrder;
  readonly minConf: number;
  readonly maxConf: number;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  positions: [],
  search: '',
  sortKey: 'confidence',
  sortOrder: 'desc',
  minConf: -5,
  maxConf: 5,
};
