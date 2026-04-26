# sync

Application-layer module that orchestrates the full confidence sync pipeline. This is the only module permitted to compose `fpl/`, `db/`, and `confidence/` together.

## Public API

```ts
syncConfidence(deps: SyncConfidenceDeps): Promise<Result<SyncResult, FetchError>>
```

The `SyncConfidenceDeps` object injects all I/O — the FPL API client, the repository layer, a clock function, and configuration. The function itself performs pure orchestration: no `fetch`, no `Date.now()`, no direct DB calls.

## Pipeline

1. Fetch `bootstrap-static` → persist teams + players via repositories.
2. Resolve `bigTeamNames` strings → `Set<TeamId>` using `internal/bigTeams.ts`.
3. For each player with `total_points > 0`, fetch `element-summary` (throttled by `throttleMs`).
4. Map `HistoryItem[]` → `MatchEvent[]` using `internal/matchEventMapper.ts`, filtering to appearances only.
5. Call `calculateConfidence({ position, matches })` from the confidence domain.
6. Persist all snapshots via `repos.confidenceSnapshots.upsertMany`.
7. Update `sync_meta` with the current timestamp via `repos.syncMeta.set('last_sync', ...)`.

## Invariants

- **Idempotent.** Running twice produces identical DB state (upsert semantics throughout).
- **Restartable.** A mid-run failure leaves no corrupted state; the next run corrects it.
- **Per-player isolation.** One player's API failure is captured in `SyncResult.errors`; the remaining players are processed.
- **No side effects in internals.** `internal/` helpers are pure functions; all I/O stays in the orchestrator.
