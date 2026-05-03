import 'server-only';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRepositories } from '@/lib/db/server';
import { createLogger } from '@/lib/logger';
import type { Position } from '@/lib/db/types';

const logger = createLogger('api/transfer-candidates');

export interface TransferCandidate {
  readonly playerId: number;
  readonly webName: string;
  readonly teamShortName: string;
  readonly teamCode: number;
  readonly position: Position;
  readonly status: string;
  readonly currentConfidence: number;
  /** Current price in tenths of millions (£0.1m) — used by the modal to
   * filter unaffordable transfers against the user's bank. */
  readonly nowCost: number;
}

export interface TransferCandidatesResponse {
  readonly position: Position;
  readonly candidates: readonly TransferCandidate[];
}

const POSITIONS: ReadonlySet<Position> = new Set(['GK', 'DEF', 'MID', 'FWD']);

/**
 * GET /api/transfer-candidates?position=MID
 *
 * Returns every active player at the requested position with their current
 * confidence value, sorted by confidence DESC then name ASC. Used by the
 * transfer planner modal on the My Team page when the user clicks the swap
 * button on a starter row.
 *
 * The list intentionally includes the manager's *own* players — the modal
 * filters them out client-side using the squad it already has loaded.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const positionRaw = new URL(request.url).searchParams.get('position');
  if (positionRaw === null || !POSITIONS.has(positionRaw as Position)) {
    logger.warn('GET /api/transfer-candidates: invalid position', { positionRaw });
    return NextResponse.json({ error: 'INVALID_POSITION' }, { status: 400 });
  }
  const position = positionRaw as Position;

  const repos = getRepositories();
  const [allPlayers, allTeams, snapshots] = await Promise.all([
    repos.players.listAll(),
    repos.teams.listAll(),
    repos.confidenceSnapshots.currentForAllPlayers(),
  ]);

  const teamMap = new Map(allTeams.map((t) => [t.id, t]));
  const confidenceMap = new Map(
    snapshots.map(({ playerId, snapshot }) => [
      playerId as unknown as number,
      snapshot.confidence_after,
    ]),
  );

  const candidates: TransferCandidate[] = allPlayers
    .filter((p) => p.position === position)
    .map((p) => {
      const team = teamMap.get(p.team_id);
      return {
        playerId: p.id,
        webName: p.web_name,
        teamShortName: team?.short_name ?? '???',
        teamCode: team?.code ?? 0,
        position: p.position,
        status: p.status,
        currentConfidence: confidenceMap.get(p.id) ?? 0,
        nowCost: p.now_cost,
      };
    })
    .sort((a, b) => {
      if (b.currentConfidence !== a.currentConfidence) {
        return b.currentConfidence - a.currentConfidence;
      }
      return a.webName.localeCompare(b.webName);
    });

  const body: TransferCandidatesResponse = { position, candidates };
  return NextResponse.json(body);
}
