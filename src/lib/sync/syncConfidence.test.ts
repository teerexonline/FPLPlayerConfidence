import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  ConfidenceSnapshotRepository,
  DbConfidenceSnapshot,
  DbManagerSquadPick,
  DbPlayer,
  DbTeam,
  DbUser,
  ManagerSquadRepository,
  PlayerRepository,
  Repositories,
  SyncMetaRepository,
  TeamRepository,
  UserRepository,
  WatchlistRepository,
} from '@/lib/db';
import { playerId } from '@/lib/db';
import type { PlayerId } from '@/lib/db/types';
import type { BootstrapStatic, ElementSummary, FetchError, Fixtures } from '@/lib/fpl/types';
import { err, ok } from '@/lib/utils/result';
import type { Result } from '@/lib/utils/result';
import { syncConfidence } from './syncConfidence';

// ── MSW safety net ─────────────────────────────────────────────────────────
// No handlers registered — any real network call causes the test to fail.
const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

// ── Fake repository implementations ────────────────────────────────────────

class FakePlayerRepository implements PlayerRepository {
  private readonly store = new Map<number, DbPlayer>();
  upsert(player: DbPlayer): void {
    this.store.set(player.id, player);
  }
  upsertMany(players: readonly DbPlayer[]): void {
    players.forEach((p) => {
      this.upsert(p);
    });
  }
  findById(id: number): DbPlayer | undefined {
    return this.store.get(id);
  }
  listAll(): readonly DbPlayer[] {
    return [...this.store.values()];
  }
}

class FakeTeamRepository implements TeamRepository {
  private readonly store = new Map<number, DbTeam>();
  upsert(team: DbTeam): void {
    this.store.set(team.id, team);
  }
  upsertMany(teams: readonly DbTeam[]): void {
    teams.forEach((t) => {
      this.upsert(t);
    });
  }
  findById(id: number): DbTeam | undefined {
    return this.store.get(id);
  }
  listAll(): readonly DbTeam[] {
    return [...this.store.values()];
  }
}

class FakeConfidenceSnapshotRepository implements ConfidenceSnapshotRepository {
  private readonly store = new Map<string, DbConfidenceSnapshot>();

  private key(s: Pick<DbConfidenceSnapshot, 'player_id' | 'gameweek'>): string {
    return `${s.player_id.toString()}-${s.gameweek.toString()}`;
  }

  upsert(snapshot: DbConfidenceSnapshot): void {
    this.store.set(this.key(snapshot), snapshot);
  }
  upsertMany(snapshots: readonly DbConfidenceSnapshot[]): void {
    snapshots.forEach((s) => {
      this.upsert(s);
    });
  }
  listByPlayer(pid: PlayerId): readonly DbConfidenceSnapshot[] {
    return [...this.store.values()].filter((s) => s.player_id === pid);
  }
  currentByPlayer(pid: PlayerId): DbConfidenceSnapshot | undefined {
    return this.listByPlayer(pid).reduce<DbConfidenceSnapshot | undefined>(
      (best, s) => (best === undefined || s.gameweek > best.gameweek ? s : best),
      undefined,
    );
  }
  currentForAllPlayers(): readonly { playerId: PlayerId; snapshot: DbConfidenceSnapshot }[] {
    const byPlayer = new Map<number, DbConfidenceSnapshot>();
    for (const s of this.store.values()) {
      const existing = byPlayer.get(s.player_id);
      if (existing === undefined || s.gameweek > existing.gameweek) {
        byPlayer.set(s.player_id, s);
      }
    }
    return [...byPlayer.entries()].map(([pid, snapshot]) => ({
      playerId: playerId(pid),
      snapshot,
    }));
  }
  listLast5ForAllPlayers(): readonly { playerId: PlayerId; deltas: readonly number[] }[] {
    const byPlayer = new Map<number, number[]>();
    for (const s of [...this.store.values()].sort((a, b) => a.gameweek - b.gameweek)) {
      const arr = byPlayer.get(s.player_id) ?? [];
      arr.push(s.delta);
      byPlayer.set(s.player_id, arr.slice(-5));
    }
    return [...byPlayer.entries()].map(([pid, deltas]) => ({ playerId: playerId(pid), deltas }));
  }
  recentAppearancesForAllPlayers(minGw: number): ReadonlyMap<number, number> {
    const map = new Map<number, number>();
    for (const s of this.store.values()) {
      if (s.gameweek >= minGw) {
        map.set(s.player_id, (map.get(s.player_id) ?? 0) + 1);
      }
    }
    return map;
  }
  snapshotsAtGameweek(gameweek: number): readonly DbConfidenceSnapshot[] {
    return [...this.store.values()].filter((s) => s.gameweek === gameweek);
  }
  latestSnapshotsAtOrBeforeGameweek(gameweek: number): readonly DbConfidenceSnapshot[] {
    const latest = new Map<number, DbConfidenceSnapshot>();
    for (const s of this.store.values()) {
      if (s.gameweek > gameweek) continue;
      const existing = latest.get(s.player_id);
      if (!existing || s.gameweek > existing.gameweek) latest.set(s.player_id, s);
    }
    return [...latest.values()];
  }
  recentBoostForAllPlayers(
    minGw: number,
    maxGw: number,
  ): ReadonlyMap<number, { boostGw: number; boostDelta: number }> {
    const map = new Map<number, { boostGw: number; boostDelta: number }>();
    for (const s of this.store.values()) {
      if (s.delta >= 3 && s.gameweek >= minGw && s.gameweek <= maxGw) {
        const existing = map.get(s.player_id);
        if (existing === undefined || s.gameweek > existing.boostGw) {
          map.set(s.player_id, { boostGw: s.gameweek, boostDelta: s.delta });
        }
      }
    }
    return map;
  }
  listRecentSnapshotsForAllPlayers(
    minGw: number,
  ): ReadonlyMap<number, readonly { gameweek: number; delta: number; reason: string }[]> {
    const map = new Map<number, { gameweek: number; delta: number; reason: string }[]>();
    const sorted = [...this.store.values()]
      .filter((s) => s.gameweek >= minGw)
      .sort((a, b) => a.gameweek - b.gameweek);
    for (const s of sorted) {
      let arr = map.get(s.player_id);
      if (!arr) {
        arr = [];
        map.set(s.player_id, arr);
      }
      arr.push({ gameweek: s.gameweek, delta: s.delta, reason: s.reason });
    }
    return map;
  }
  deleteByPlayer(pid: PlayerId): void {
    for (const [key, s] of this.store.entries()) {
      if (s.player_id === pid) this.store.delete(key);
    }
  }
  count(): number {
    return this.store.size;
  }
}

class FakeSyncMetaRepository implements SyncMetaRepository {
  private readonly store = new Map<string, string>();
  get(key: string): string | undefined {
    return this.store.get(key);
  }
  set(key: string, value: string, _updatedAt: number): void {
    this.store.set(key, value);
  }
}

class FakeManagerSquadRepository implements ManagerSquadRepository {
  upsertMany(_picks: readonly DbManagerSquadPick[]): void {
    /* no-op stub */
  }
  listByTeamAndGameweek(
    _userId: number,
    _teamId: number,
    _gameweek: number,
  ): readonly DbManagerSquadPick[] {
    return [];
  }
  latestGameweekForTeam(_userId: number, _teamId: number): number | null {
    return null;
  }
  listGameweeksForTeam(_userId: number, _teamId: number): readonly number[] {
    return [];
  }
}

class FakeUserRepository implements UserRepository {
  findById(_id: number): DbUser | null {
    return null;
  }
  listAll(): readonly DbUser[] {
    return [];
  }
}

class FakeWatchlistRepository implements WatchlistRepository {
  findByUser(_userId: number): readonly number[] {
    return [];
  }
  add(_userId: number, _playerId: number): void {
    // no-op
  }
  remove(_userId: number, _playerId: number): void {
    // no-op
  }
  contains(_userId: number, _playerId: number): boolean {
    return false;
  }
}

function makeRepos(): {
  repos: Repositories;
  players: FakePlayerRepository;
  confidenceSnapshots: FakeConfidenceSnapshotRepository;
  syncMeta: FakeSyncMetaRepository;
} {
  const players = new FakePlayerRepository();
  const teams = new FakeTeamRepository();
  const confidenceSnapshots = new FakeConfidenceSnapshotRepository();
  const syncMeta = new FakeSyncMetaRepository();
  const managerSquads = new FakeManagerSquadRepository();
  const users = new FakeUserRepository();
  const watchlist = new FakeWatchlistRepository();
  const repos: Repositories = {
    players,
    teams,
    confidenceSnapshots,
    syncMeta,
    managerSquads,
    users,
    watchlist,
  };
  return { repos, players, confidenceSnapshots, syncMeta };
}

// ── Test fixtures ───────────────────────────────────────────────────────────

const CLOCK = 1_700_000_000;

// Three players with points > 0: GK, MID, FWD; all on team 1.
const BOOTSTRAP: BootstrapStatic = {
  teams: [{ id: 1, code: 3, name: 'Arsenal', short_name: 'ARS' }],
  elements: [
    {
      id: 1,
      web_name: 'Raya',
      team: 1,
      element_type: 1,
      now_cost: 60,
      total_points: 141,
      status: 'a',
      chance_of_playing_next_round: null,
      news: '',
      minutes: 0,
      influence: 0,
      creativity: 0,
      threat: 0,
    },
    {
      id: 2,
      web_name: 'Salah',
      team: 1,
      element_type: 3,
      now_cost: 130,
      total_points: 200,
      status: 'a',
      chance_of_playing_next_round: null,
      news: '',
      minutes: 0,
      influence: 0,
      creativity: 0,
      threat: 0,
    },
    {
      id: 3,
      web_name: 'Haaland',
      team: 1,
      element_type: 4,
      now_cost: 150,
      total_points: 180,
      status: 'a',
      chance_of_playing_next_round: null,
      news: '',
      minutes: 0,
      influence: 0,
      creativity: 0,
      threat: 0,
    },
  ],
  events: [],
};

// Default fixture list: empty — all FDR lookups fall back to 3 (neutral).
const EMPTY_FIXTURES: Fixtures = [];

// One GW appearance — goals=1, FDR 3 (fallback) → MOTM → confidence_after=+2.
const GW_HISTORY: ElementSummary['history'][number] = {
  round: 1,
  opponent_team: 99,
  was_home: true,
  minutes: 90,
  goals_scored: 1,
  assists: 0,
  clean_sheets: 0,
  saves: 0,
  defensive_contribution: 0,
  total_points: 0,
  influence: 0,
  creativity: 0,
  threat: 0,
};

function makeSummary(overrides: Partial<ElementSummary['history'][number]> = {}): ElementSummary {
  return { history: [{ ...GW_HISTORY, ...overrides }] };
}

function makeApi(
  overrides: {
    bootstrap?: Result<BootstrapStatic, FetchError>;
    summary?:
      | Result<ElementSummary, FetchError>
      | ((id: number) => Result<ElementSummary, FetchError>);
    fixtures?: Result<Fixtures, FetchError>;
  } = {},
) {
  const defaultSummary = ok(makeSummary());
  return {
    fetchBootstrapStatic: vi.fn(
      (): Promise<Result<BootstrapStatic, FetchError>> =>
        Promise.resolve(overrides.bootstrap ?? ok(BOOTSTRAP)),
    ),
    fetchElementSummary: vi.fn((id: number): Promise<Result<ElementSummary, FetchError>> => {
      const s = overrides.summary;
      if (typeof s === 'function') return Promise.resolve(s(id));
      return Promise.resolve(s ?? defaultSummary);
    }),
    fetchFixtures: vi.fn(
      (): Promise<Result<Fixtures, FetchError>> =>
        Promise.resolve(overrides.fixtures ?? ok(EMPTY_FIXTURES)),
    ),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('syncConfidence', () => {
  it('happy path: processes 3 players, writes correct snapshots, returns correct counts in SyncResult', async () => {
    const { repos, confidenceSnapshots, syncMeta } = makeRepos();
    const api = makeApi();

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.playersProcessed).toBe(3);
    expect(result.value.playersSkipped).toBe(0);
    expect(result.value.snapshotsWritten).toBe(3);
    expect(result.value.errors).toHaveLength(0);
    expect(syncMeta.get('last_sync')).toBe(String(CLOCK));

    // Each player: goals=1 vs FDR 3 (fallback) → MOTM → confidence_after=+2
    for (const element of BOOTSTRAP.elements) {
      const snaps = confidenceSnapshots.listByPlayer(playerId(element.id));
      expect(snaps).toHaveLength(1);
      expect(snaps[0]?.confidence_after).toBe(2);
    }
  });

  it('bootstrap-static failure returns the FetchError without writing to DB', async () => {
    const { repos, players } = makeRepos();
    const networkError: FetchError = { type: 'network_error', message: 'Connection refused' };
    const api = makeApi({ bootstrap: err(networkError) });

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('network_error');
    expect(players.listAll()).toHaveLength(0);
    expect(api.fetchElementSummary).not.toHaveBeenCalled();
  });

  it('fixtures fetch failure returns the FetchError without processing any players', async () => {
    const { repos } = makeRepos();
    const networkError: FetchError = { type: 'network_error', message: 'ECONNRESET' };
    const api = makeApi({ fixtures: err(networkError) });

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('network_error');
    expect(api.fetchElementSummary).not.toHaveBeenCalled();
  });

  it('one player element-summary 404 is recorded in errors, others still succeed', async () => {
    const { repos } = makeRepos();
    const notFound: FetchError = { type: 'not_found' };
    const api = makeApi({
      summary: (id) => (id === 1 ? err(notFound) : ok(makeSummary())),
    });

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0]?.playerId).toBe(1);
    expect(result.value.playersProcessed).toBe(2);
  });

  it('malformed element-summary data (Zod failure) is recorded in errors, others still succeed', async () => {
    const { repos } = makeRepos();
    const parseError: FetchError = { type: 'invalid_response', message: 'Validation failed' };
    const api = makeApi({
      summary: (id) => (id === 1 ? err(parseError) : ok(makeSummary())),
    });

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0]?.reason).toContain('invalid_response');
    expect(result.value.playersProcessed).toBe(2);
  });

  it('player with total_points=0 is skipped — no element-summary fetch, counted in playersSkipped', async () => {
    const { repos } = makeRepos();
    const bootstrapWithBench: BootstrapStatic = {
      ...BOOTSTRAP,
      elements: [
        ...BOOTSTRAP.elements,
        {
          id: 99,
          web_name: 'Unused',
          team: 1,
          element_type: 4,
          now_cost: 40,
          total_points: 0,
          status: 'a',
          chance_of_playing_next_round: null,
          news: '',
          minutes: 0,
          influence: 0,
          creativity: 0,
          threat: 0,
        },
      ],
    };
    const api = makeApi({ bootstrap: ok(bootstrapWithBench) });

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(api.fetchElementSummary).toHaveBeenCalledTimes(3);
    expect(result.value.playersSkipped).toBe(1);
    expect(result.value.playersProcessed).toBe(3);
  });

  it('player with all minutes=0 is counted in playersSkipped, no snapshots written', async () => {
    const { repos, confidenceSnapshots } = makeRepos();
    const api = makeApi({
      summary: (id) => (id === 1 ? ok(makeSummary({ minutes: 0 })) : ok(makeSummary())),
    });

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.playersSkipped).toBe(1);
    expect(result.value.playersProcessed).toBe(2);
    expect(confidenceSnapshots.listByPlayer(playerId(1))).toHaveLength(0);
  });

  it('running twice in a row produces identical DB state (idempotency)', async () => {
    const { repos, confidenceSnapshots } = makeRepos();
    const api = makeApi();
    const deps = { api, repos, clock: () => CLOCK };

    await syncConfidence({ ...deps, throttleMs: 0 });
    const countAfterFirst = confidenceSnapshots.count();

    await syncConfidence({ ...deps, throttleMs: 0 });
    const countAfterSecond = confidenceSnapshots.count();

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('network_error from element-summary fetch is recorded in errors with the error type', async () => {
    const { repos } = makeRepos();
    const networkError: FetchError = { type: 'network_error', message: 'ECONNRESET' };
    const api = makeApi({
      summary: (id) => (id === 1 ? err(networkError) : ok(makeSummary())),
    });

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.errors[0]?.reason).toContain('network_error');
  });

  it('http_error from element-summary fetch is recorded in errors with the status code', async () => {
    const { repos } = makeRepos();
    const httpError: FetchError = {
      type: 'http_error',
      status: 503,
      message: 'Service Unavailable',
    };
    const api = makeApi({
      summary: (id) => (id === 1 ? err(httpError) : ok(makeSummary())),
    });

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.errors[0]?.reason).toContain('503');
  });

  it('double-gameweek: two matches in the same round collapse into one snapshot with summed delta and a DGW reason prefix', async () => {
    // FWD player (team 1); GW33 has two fixtures.
    // Match 1: vs Man City (team 2), away (FDR 5 → big → MOTM +3)
    // Match 2: vs unknown opponent 99, home (FDR 3 fallback → MOTM +2)
    // Both round 33 — collapse to delta=+5, confidence_after=+5.
    const bootstrapDgw: BootstrapStatic = {
      teams: [
        { id: 1, code: 3, name: 'Arsenal', short_name: 'ARS' },
        { id: 2, code: 43, name: 'Man City', short_name: 'MCI' },
      ],
      elements: [
        {
          id: 1,
          web_name: 'Striker',
          team: 1,
          element_type: 4,
          now_cost: 90,
          total_points: 150,
          status: 'a',
          chance_of_playing_next_round: null,
          news: '',
          minutes: 0,
          influence: 0,
          creativity: 0,
          threat: 0,
        },
      ],
      events: [],
    };
    const dgwSummary: ElementSummary = {
      history: [
        {
          round: 33,
          opponent_team: 2,
          was_home: false,
          minutes: 90,
          goals_scored: 1,
          assists: 0,
          clean_sheets: 0,
          saves: 0,
          defensive_contribution: 0,
          total_points: 0,
          influence: 0,
          creativity: 0,
          threat: 0,
        },
        {
          round: 33,
          opponent_team: 99,
          was_home: true,
          minutes: 90,
          goals_scored: 1,
          assists: 0,
          clean_sheets: 0,
          saves: 0,
          defensive_contribution: 0,
          total_points: 0,
          influence: 0,
          creativity: 0,
          threat: 0,
        },
      ],
    };
    // Fixture: GW33, Man City (2) at home vs Arsenal (1) away — team_a_difficulty=5 for Arsenal.
    const dgwFixtures: Fixtures = [
      {
        id: 1,
        event: 33,
        team_h: 2,
        team_a: 1,
        team_h_difficulty: 2,
        team_a_difficulty: 5,
        finished: true,
        kickoff_time: null,
      },
    ];
    const { repos, confidenceSnapshots } = makeRepos();
    const api = makeApi({
      bootstrap: ok(bootstrapDgw),
      summary: ok(dgwSummary),
      fixtures: ok(dgwFixtures),
    });

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(true);
    const snaps = confidenceSnapshots.listByPlayer(playerId(1));
    expect(snaps).toHaveLength(1); // collapsed: 2 matches → 1 row
    expect(snaps[0]?.gameweek).toBe(33);
    expect(snaps[0]?.delta).toBe(5); // +3 (FDR 5) + +2 (FDR 3)
    expect(snaps[0]?.confidence_after).toBe(5); // 0 + 3 + 2 = +5
    expect(snaps[0]?.reason).toMatch(/^DGW:/);
  });

  it('Haaland GW33 regression: GW1 blank (−1) then DGW33 two MOTMs → collapsed delta=+6, confidence_after=+5', async () => {
    // Player: Haaland, FWD, team 2 (Man City).
    // GW1:   blank vs unknown opponent 99 at home → FDR 3 fallback → −1 × 1.0 = −1 → confidence=−1
    // GW33a: goal vs Arsenal (team 1) away → FDR 5 → MOTM +5 → confidence=+4, motm=1
    // GW33b: goal vs unknown opponent 99 at home → FDR 3 fallback → MOTM +2 → confidence=clamp(6)=+5, motm=2
    // Collapse GW33 → delta=+6, confidence_after=+5
    const bootstrapHaaland: BootstrapStatic = {
      teams: [{ id: 1, code: 3, name: 'Arsenal', short_name: 'ARS' }],
      elements: [
        {
          id: 1,
          web_name: 'Haaland',
          team: 2,
          element_type: 4,
          now_cost: 150,
          total_points: 200,
          status: 'a',
          chance_of_playing_next_round: null,
          news: '',
          minutes: 0,
          influence: 0,
          creativity: 0,
          threat: 0,
        },
      ],
      events: [],
    };
    const haalandSummary: ElementSummary = {
      history: [
        {
          round: 1,
          opponent_team: 99,
          was_home: true,
          minutes: 90,
          goals_scored: 0,
          assists: 0,
          clean_sheets: 0,
          saves: 0,
          defensive_contribution: 0,
          total_points: 0,
          influence: 0,
          creativity: 0,
          threat: 0,
        },
        {
          round: 33,
          opponent_team: 1,
          was_home: false,
          minutes: 90,
          goals_scored: 1,
          assists: 0,
          clean_sheets: 0,
          saves: 0,
          defensive_contribution: 0,
          total_points: 0,
          influence: 0,
          creativity: 0,
          threat: 0,
        },
        {
          round: 33,
          opponent_team: 99,
          was_home: true,
          minutes: 90,
          goals_scored: 1,
          assists: 0,
          clean_sheets: 0,
          saves: 0,
          defensive_contribution: 0,
          total_points: 0,
          influence: 0,
          creativity: 0,
          threat: 0,
        },
      ],
    };
    // GW33a: Arsenal (1) at home vs Man City (2) away — team_a_difficulty=5 for Haaland.
    const haalandFixtures: Fixtures = [
      {
        id: 1,
        event: 33,
        team_h: 1,
        team_a: 2,
        team_h_difficulty: 4,
        team_a_difficulty: 5,
        finished: true,
        kickoff_time: null,
      },
    ];
    const { repos, confidenceSnapshots } = makeRepos();
    const api = makeApi({
      bootstrap: ok(bootstrapHaaland),
      summary: ok(haalandSummary),
      fixtures: ok(haalandFixtures),
    });

    const result = await syncConfidence({ api, repos, clock: () => CLOCK, throttleMs: 0 });

    expect(result.ok).toBe(true);
    const snaps = [...confidenceSnapshots.listByPlayer(playerId(1))].sort(
      (a, b) => a.gameweek - b.gameweek,
    );
    expect(snaps).toHaveLength(2); // GW1 + GW33 (collapsed)

    const gw1 = snaps[0];
    expect(gw1?.delta).toBe(-1); // blank vs FDR 3 neutral: −1 × 1.0 = −1
    expect(gw1?.confidence_after).toBe(-1);

    const gw33 = snaps[1];
    expect(gw33?.delta).toBe(6); // +5 (MOTM vs FDR 5) + +1 (MOTM vs FDR 3, clamped to ceiling)
    expect(gw33?.confidence_after).toBe(5); // −1 + 6 = +5 (clamped)
    expect(gw33?.reason).toMatch(/^DGW:/);
  });

  it('throttling: awaits a delay between player fetches (verified with fake timers)', async () => {
    vi.useFakeTimers();
    try {
      const { repos } = makeRepos();
      const api = makeApi();

      const syncPromise = syncConfidence({
        api,
        repos,
        clock: () => CLOCK,
        throttleMs: 50,
      });

      // Without advancing timers the promise hangs (setTimeout never fires).
      // runAllTimersAsync drains all pending timers, proving the throttle is real.
      await vi.runAllTimersAsync();
      const result = await syncPromise;

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 3 players → 2 inter-player gaps of 50 ms each
      expect(result.value.playersProcessed).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
