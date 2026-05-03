import 'server-only';

import { confidenceToPercent } from '@/lib/team-confidence';
import type { Repositories } from '@/lib/db';
import type { FdrBucketName } from '@/lib/db/types';
import { calculatePlayerXp } from './calculator';
import type { PlayerBucketAverages, TeamFixture } from './types';

export interface NextGwXpInput {
  /** Map of player id → { team_id, current confidence in [-5, +5] }. */
  readonly players: ReadonlyMap<number, { readonly teamId: number; readonly confidence: number }>;
  /** Gameweek to project xP for — typically `currentGameweek + 1`. */
  readonly gameweek: number;
  readonly repos: Pick<Repositories, 'fixtures' | 'playerFdrAverages'>;
}

/**
 * Computes projected xP for every player for a single gameweek. Used by the
 * dashboard and players-list pages so the UI can show "next-GW xP" alongside
 * the current confidence.
 *
 * Returns a map of `playerId → xp`. Players whose team has no fixture in
 * the requested GW (BGW) are present with xp=0.
 *
 * Read failures (missing fixtures table, empty fdr-averages) degrade to 0
 * rather than throwing — the page must still render even before the first
 * sync populates these tables.
 */
export async function computeNextGwXpMap(
  input: NextGwXpInput,
): Promise<ReadonlyMap<number, number>> {
  const { players, gameweek, repos } = input;

  const fixtureRows = await repos.fixtures.listForGameweek(gameweek).catch(() => [] as const);
  const fixturesByTeam = new Map<number, TeamFixture[]>();
  for (const f of fixtureRows) {
    const list = fixturesByTeam.get(f.team_id) ?? [];
    list.push({
      gameweek: f.gameweek,
      opponentTeamId: f.opponent_team_id,
      isHome: f.is_home,
      fdr: f.fdr,
    });
    fixturesByTeam.set(f.team_id, list);
  }

  const playerIds = [...players.keys()];
  const averagesMap = await repos.playerFdrAverages
    .averagesForPlayers(playerIds)
    .catch(() => new Map<number, ReadonlyMap<FdrBucketName, number>>());

  const result = new Map<number, number>();
  for (const [pid, { teamId, confidence }] of players) {
    const teamFixtures = fixturesByTeam.get(teamId) ?? [];
    if (teamFixtures.length === 0) {
      result.set(pid, 0);
      continue;
    }
    const buckets = averagesMap.get(pid) ?? new Map<FdrBucketName, number>();
    const averages: PlayerBucketAverages = {
      low: buckets.get('LOW') ?? null,
      mid: buckets.get('MID') ?? null,
      high: buckets.get('HIGH') ?? null,
    };
    const xp = calculatePlayerXp({
      playerId: pid,
      confidencePct: confidenceToPercent(confidence),
      averages,
      fixtures: teamFixtures,
    }).xp;
    result.set(pid, xp);
  }

  return result;
}
