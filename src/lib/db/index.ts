import type Database from 'better-sqlite3';
import type { ConfidenceSnapshotRepository } from './repositories/ConfidenceSnapshotRepository';
import type { ManagerSquadRepository } from './repositories/ManagerSquadRepository';
import type { PlayerRepository } from './repositories/PlayerRepository';
import type { SyncMetaRepository } from './repositories/SyncMetaRepository';
import type { TeamRepository } from './repositories/TeamRepository';
import { SqliteConfidenceSnapshotRepository } from './repositories/sqlite/SqliteConfidenceSnapshotRepository';
import { SqliteManagerSquadRepository } from './repositories/sqlite/SqliteManagerSquadRepository';
import { SqlitePlayerRepository } from './repositories/sqlite/SqlitePlayerRepository';
import { SqliteSyncMetaRepository } from './repositories/sqlite/SqliteSyncMetaRepository';
import { SqliteTeamRepository } from './repositories/sqlite/SqliteTeamRepository';

export { createDb } from './client';

export type {
  DbConfidenceSnapshot,
  DbManagerSquadPick,
  DbPlayer,
  DbSyncMeta,
  DbTeam,
  PlayerId,
  TeamId,
} from './types';
export { playerId, teamId } from './types';

export type { PlayerRepository } from './repositories/PlayerRepository';
export type { TeamRepository } from './repositories/TeamRepository';
export type { ConfidenceSnapshotRepository } from './repositories/ConfidenceSnapshotRepository';
export type { SyncMetaRepository } from './repositories/SyncMetaRepository';
export type { ManagerSquadRepository } from './repositories/ManagerSquadRepository';

export interface Repositories {
  readonly players: PlayerRepository;
  readonly teams: TeamRepository;
  readonly confidenceSnapshots: ConfidenceSnapshotRepository;
  readonly syncMeta: SyncMetaRepository;
  readonly managerSquads: ManagerSquadRepository;
}

/** Returns concrete repository instances backed by the provided database. */
export function createRepositories(db: Database.Database): Repositories {
  return {
    players: new SqlitePlayerRepository(db),
    teams: new SqliteTeamRepository(db),
    confidenceSnapshots: new SqliteConfidenceSnapshotRepository(db),
    syncMeta: new SqliteSyncMetaRepository(db),
    managerSquads: new SqliteManagerSquadRepository(db),
  };
}
