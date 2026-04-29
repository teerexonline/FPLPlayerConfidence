import type { Position } from '@/lib/confidence/types';

export type { Position };

export type PlayerId = number & { readonly __brand: 'PlayerId' };
export type TeamId = number & { readonly __brand: 'TeamId' };

/** Casts a plain number to a branded PlayerId. Use only at trust boundaries. */
export const playerId = (n: number): PlayerId => n as PlayerId;

/** Casts a plain number to a branded TeamId. Use only at trust boundaries. */
export const teamId = (n: number): TeamId => n as TeamId;

export interface DbPlayer {
  readonly id: number;
  readonly web_name: string;
  readonly team_id: number;
  readonly position: Position;
  readonly now_cost: number;
  readonly total_points: number;
  readonly updated_at: number;
  readonly status: string;
  readonly chance_of_playing_next_round: number | null;
  readonly news: string;
  /** Season-total ICT stats from FPL bootstrap-static — inputs for probability calculator. */
  readonly influence: number;
  readonly creativity: number;
  readonly threat: number;
  readonly minutes: number;
  /** Difficulty of the player's next scheduled fixture (1–5). 3 = neutral fallback. */
  readonly next_fixture_fdr: number;
}

export interface DbTeam {
  readonly id: number;
  readonly code: number;
  readonly name: string;
  readonly short_name: string;
}

export interface DbConfidenceSnapshot {
  readonly player_id: number;
  readonly gameweek: number;
  readonly confidence_after: number;
  readonly delta: number;
  readonly raw_delta: number; // pre-fatigue clamped delta — used for streak threshold and level
  readonly reason: string;
  readonly fatigue_applied: boolean;
  readonly motm_counter: number;
  readonly defcon_counter: number;
  readonly savecon_counter: number;
}

export interface DbSyncMeta {
  readonly key: string;
  readonly value: string;
  readonly updated_at: number;
}

export interface DbUser {
  readonly id: number;
  readonly email: string;
  readonly created_at: number;
}

export interface DbManagerSquadPick {
  readonly user_id: number;
  readonly team_id: number;
  readonly gameweek: number;
  readonly player_id: number;
  readonly squad_position: number;
  readonly is_captain: boolean;
  readonly is_vice_captain: boolean;
  readonly fetched_at: number;
}
