# fpl

The `fpl` module is the infrastructure layer responsible for all communication with the Fantasy Premier League API. It exposes four typed async functions — `fetchBootstrapStatic`, `fetchElementSummary`, `fetchFixtures`, and `fetchEntryPicks` — each of which fetches a specific FPL endpoint, validates the response against a Zod schema, and returns a `Result<T, FetchError>`. No raw API shapes leak beyond this module: callers receive either typed domain data or a discriminated `FetchError` they can pattern-match on. Cache lifetimes are baked into each call via Next.js `fetch` options (`revalidate: 3600` for most endpoints, `revalidate: 21600` for player summaries), so no in-memory caching logic is needed here.

## Public API

- **`fetchBootstrapStatic(): Promise<Result<BootstrapStatic, FetchError>>`** — master payload: all players (`elements[]`), teams, and gameweeks (`events[]`). Cache: 1 hour.
- **`fetchElementSummary(playerId): Promise<Result<ElementSummary, FetchError>>`** — per-player match history (`history[]`) used as input to the confidence calculator. Cache: 6 hours.
- **`fetchFixtures(gameweek?): Promise<Result<Fixtures, FetchError>>`** — all fixtures; pass a gameweek number to filter via `?event=`. Cache: 1 hour.
- **`fetchEntryPicks(teamId, gameweek): Promise<Result<EntryPicks, FetchError>>`** — manager squad picks for a specific GW. Returns `not_found` (not an error) when the team ID is invalid or the GW has not started — this is an expected user-facing state. Cache: 1 hour.
- All Zod schemas are exported from `./schemas` for callers that need to do additional validation (e.g. URL param parsing). All inferred TypeScript types are exported from the barrel.

## Invariants

`FetchError` is a discriminated union with four variants: `network_error` (request never reached the server), `http_error` (non-2xx/non-404 response), `not_found` (explicit 404 — valid state for entry-picks), and `invalid_response` (Zod schema mismatch, indicating an FPL API shape change). The module never throws — all failure modes are captured in the `Result` return type. Every response crosses the Zod boundary before the `ok: true` branch is reachable, so callers can treat `result.value` as fully typed without additional guards. The `fetchJson` helper centralises network and HTTP-error handling; individual fetch functions contain only schema-dispatch logic, keeping each function under 15 lines.
