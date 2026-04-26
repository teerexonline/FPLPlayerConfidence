# FPL API Reference

The official FPL API is undocumented but stable. No auth, no key required. Be a good citizen — cache aggressively. **Every response is validated through Zod before use** (see `docs/ENGINEERING.md` §2.3).

---

## 1. Endpoints

### `GET https://fantasy.premierleague.com/api/bootstrap-static/`

Master endpoint.

- `elements[]` — every player (id, web_name, team, element_type, now_cost, total_points, form, …)
- `teams[]` — every team (id, name, short_name, code, strength, …)
- `events[]` — gameweeks (id, deadline_time, finished, is_current, is_next, …)
- `element_types[]` — positions

**Cache: 1 hour** during the season. Reduce to 15 min in the 90 minutes around a deadline.

Important fields:

- `elements[].id` — internal player ID, used in element-summary endpoint
- `elements[].team` — references `teams[].id`
- `elements[].element_type` — 1=GK, 2=DEF, 3=MID, 4=FWD
- `elements[].now_cost` — price in tenths of a million (e.g. 95 = £9.5m)
- `teams[].code` — DIFFERENT from `id`. Use `code` for jersey/badge image URLs.

### `GET https://fantasy.premierleague.com/api/element-summary/{player_id}/`

Per-player history.

- `history[]` — every match this season (round, opponent_team, was_home, minutes, goals_scored, assists, clean_sheets, …)
- `history_past[]` — previous seasons (ignore for v1)
- `fixtures[]` — upcoming fixtures for this player

**Cache: 6 hours.** Refresh more aggressively only after a gameweek finishes.

Map to `MatchEvent`:

```ts
{
  gameweek: history.round,
  opponentTeamId: history.opponent_team,
  isOpponentBigTeam: bigTeamIds.has(history.opponent_team),
  minutesPlayed: history.minutes,
  goals: history.goals_scored,
  assists: history.assists,
  cleanSheet: history.clean_sheets === 1,
}
```

Filter to `minutesPlayed > 0` before passing to the calculator.

### `GET https://fantasy.premierleague.com/api/fixtures/`

All fixtures with FPL difficulty ratings. **Cache: 1 hour.**

Useful query params: `?event={gw}` for a specific gameweek.

---

## 2. Zod schemas (canonical contract)

Every parsed response is the source of truth for the rest of the codebase. If a field isn't in the schema, the rest of the code can't depend on it.

```ts
// src/lib/fpl/schemas.ts
import { z } from 'zod';

export const TeamSchema = z.object({
  id: z.number().int().positive(),
  code: z.number().int().positive(),
  name: z.string().min(1),
  short_name: z.string().min(1),
});

export const ElementSchema = z.object({
  id: z.number().int().positive(),
  web_name: z.string().min(1),
  team: z.number().int().positive(),
  element_type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  now_cost: z.number().int().nonnegative(),
  total_points: z.number().int(),
});

export const EventSchema = z.object({
  id: z.number().int().positive(),
  deadline_time: z.string(),
  finished: z.boolean(),
  is_current: z.boolean(),
  is_next: z.boolean(),
});

export const BootstrapStaticSchema = z.object({
  teams: z.array(TeamSchema),
  elements: z.array(ElementSchema),
  events: z.array(EventSchema),
});

export const HistoryItemSchema = z.object({
  round: z.number().int().positive(),
  opponent_team: z.number().int().positive(),
  was_home: z.boolean(),
  minutes: z.number().int().nonnegative(),
  goals_scored: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  clean_sheets: z.union([z.literal(0), z.literal(1)]),
});

export const ElementSummarySchema = z.object({
  history: z.array(HistoryItemSchema),
});
```

---

## 3. Jersey & badge CDN

### Badges

```
https://resources.premierleague.com/premierleague/badges/t{team_code}.png
```

Use `teams[].code`, not `teams[].id`.

### Kit shirts (outfield)

```
https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_{team_code}-66.png
```

### Kit shirts (goalkeeper)

```
https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_{team_code}_1-66.png
```

Sizes: `-66`, `-110`, `-220`. Use `-220` for the player detail hero, `-66` for tables.

---

## 4. Jersey strategy

### 4.1 `team_code` vs `team_id` — the most common mistake

> **Warning:** the jersey and badge CDN URLs use `teams[].code`, **not** `teams[].id`. These are different numbers for every team. Always resolve `code` from the `bootstrap-static` response before building a jersey URL.

```ts
// ❌ Wrong — id and code are NOT the same
const url = `/.../shirt_${team.id}-66.png`;

// ✅ Correct — always use teams[].code
const url = `/.../shirt_${team.code}-66.png`;
```

Key values from the current season (verify against live `bootstrap-static` before hardcoding):

| Club      | `id` | `code` |
| --------- | ---- | ------ |
| Arsenal   | 1    | 3      |
| Liverpool | 14   | 14     |
| Man City  | 43   | 43     |
| Chelsea   | 8    | 8      |
| Tottenham | 6    | 6      |

`id` and `code` happen to match for a few clubs but diverge for many others. Never assume they are equal.

### 4.2 CDN verification before implementing the route handler

Before writing any jersey-fetching code, confirm the CDN is reachable for these three canonical team codes:

```bash
# Arsenal (code=3), Liverpool (code=14), Man City (code=43)
# Check both -66 and -110 sizes on the standard path:
curl -o /dev/null -w "%{http_code}  %{url_effective}\n" -s \
  "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_3-66.png" \
  "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_3-110.png" \
  "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_14-66.png" \
  "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_14-110.png" \
  "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_43-66.png" \
  "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_43-110.png"
```

Expected: all return `200`. If the standard path returns `404`, try the photos path instead:

```
https://fantasy.premierleague.com/dist/img/shirts/photos/shirt_{team_code}-110.png
```

Document which path worked in the route handler's comment so the next developer knows which variant is live.

### 4.3 Size guidance

| Use                | Size                                                         | Notes                                                  |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------ |
| Player detail hero | `-110` rendered at 2× (`width="110" height="140"` in markup) | `-220` is not available for every club — do not use it |
| Players list table | `-66`                                                        | native resolution                                      |
| Dashboard cards    | `-66`                                                        | native resolution                                      |

**Do not use `-220`.** It returns 404 for some clubs and is not reliably available. Serve `-110` at 2× instead — it covers all clubs and still renders sharply on retina displays.

### 4.4 Fallback strategies

If the FPL CDN becomes unavailable (rate-limit, URL change, or shutdown), apply these strategies in order:

**Option A — `fpl-static` npm package**

The [`fpl-static`](https://www.npmjs.com/package/fpl-static) package ships all FPL static assets as local files. Import shirts directly rather than fetching from the CDN. Useful as an offline fallback or when CDN reliability is low:

```bash
npm install fpl-static
```

```ts
// In the jersey route handler, fall back to the package if CDN returns non-200
import { getShirt } from 'fpl-static';
```

Evaluate whether adding this dependency is warranted before reaching for it.

**Option B — SVG kits from team colors**

Generate a minimal SVG jersey from each team's primary and secondary colors. This approach has zero external dependency and also offers a **design upside**: hand-crafted SVG kits can be more visually distinctive than the FPL PNG sprites and may be worth considering as the **primary visual** even when the CDN is available.

```ts
function renderKitSvg(primary: string, secondary: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 66 66">
    <!-- simplified jersey silhouette -->
    <path d="M10 10 L56 10 L60 25 L50 25 L50 60 L16 60 L16 25 L6 25 Z"
          fill="${primary}" stroke="${secondary}" stroke-width="2"/>
  </svg>`;
}
```

Team color values need a separate mapping (not available from the FPL API). Maintain them in `src/lib/fpl/teamColors.ts` alongside the team data.

---

## 5. Caching strategy

1. On first run, fetch `bootstrap-static` and store in SQLite.
2. Iterate `elements[]`. For each player with `total_points > 0`, fetch `element-summary/{id}/` (rate-limit yourself: 1 request / 200ms).
3. Compute confidence per player, store result + match-by-match deltas in SQLite.
4. On subsequent loads:
   - If `bootstrap-static` cache is fresh → use it.
   - For each player, only re-fetch `element-summary` if their `total_points` has changed since last sync OR if cache is older than 6 hours.

### Asset caching

- Jerseys and badges: download once, store in `public/jerseys/` and `public/badges/`, serve locally.
- Use a Next.js Route Handler `app/jerseys/[code]/route.ts` that:
  1. Checks the local cache.
  2. Fetches from CDN if missing.
  3. Writes the file and returns it.
- Never hotlink on every render.

---

## 6. Big-team list

Default (top 6 from last completed Premier League season — confirm against current standings before locking):

```ts
const DEFAULT_BIG_TEAM_NAMES = [
  'Man City',
  'Arsenal',
  'Liverpool',
  'Aston Villa',
  'Tottenham',
  'Chelsea',
];
```

At runtime, resolve names to `teams[].id` using `bootstrap-static`, store as a `Set<TeamId>`. Persisted to localStorage (validated via Zod on read).

---

## 7. SQLite schema

```sql
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,
  web_name TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  position TEXT NOT NULL CHECK(position IN ('GK','DEF','MID','FWD')),
  now_cost INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS confidence_snapshots (
  player_id INTEGER NOT NULL,
  gameweek INTEGER NOT NULL,
  confidence_after INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  fatigue_applied INTEGER NOT NULL DEFAULT 0,
  motm_counter INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, gameweek)
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_confidence_player ON confidence_snapshots(player_id);
CREATE INDEX IF NOT EXISTS idx_confidence_gw ON confidence_snapshots(gameweek);

CREATE TABLE IF NOT EXISTS manager_squads (
  team_id         INTEGER NOT NULL,
  gameweek        INTEGER NOT NULL,
  player_id       INTEGER NOT NULL,
  squad_position  INTEGER NOT NULL,
  is_captain      INTEGER NOT NULL DEFAULT 0,
  is_vice_captain INTEGER NOT NULL DEFAULT 0,
  fetched_at      INTEGER NOT NULL,
  PRIMARY KEY (team_id, gameweek, squad_position)
);
```

All queries are parameterized — never string-concatenated (see `docs/ENGINEERING.md` §7).

---

## 8. Manager squad endpoint

### `GET https://fantasy.premierleague.com/api/entry/{team_id}/event/{gw}/picks/`

Returns a manager's squad picks for a specific gameweek.

- `team_id` — the manager's FPL entry ID (visible in the URL at `https://fantasy.premierleague.com/entry/{team_id}/event/{gw}`)
- `gw` — gameweek number (1..38)

**Cache: 1 hour.** After a GW deadline passes, the squad is locked and can be cached indefinitely for that GW.

**404 handling:** the FPL API returns 404 (not 401) if the entry ID is invalid or the GW has not started yet. Treat 404 as `FetchError` with type `'not_found'` — this is an expected user-facing state (no team linked yet), not a bug.

### Zod schema

```ts
// add to src/lib/fpl/schemas.ts

export const EntryPickSchema = z.object({
  element: z.number().int().positive(), // playerId
  position: z.number().int().min(1).max(15), // squadPosition (1–11 = starters)
  is_captain: z.boolean(),
  is_vice_captain: z.boolean(),
});

export const EntryPicksSchema = z.object({
  picks: z.array(EntryPickSchema).length(15),
});
```

Map to `SquadPick` (see `docs/ALGORITHM.md` §11.1):

```ts
{
  playerId:      pick.element,
  squadPosition: pick.position,
  isCaptain:     pick.is_captain,
  isViceCaptain: pick.is_vice_captain,
}
```

---

## 9. Error handling

- All API calls return `Result<T, FetchError>` (see `docs/ENGINEERING.md` §3.4).
- On network failure, serve cached data with a "Last synced X minutes ago" banner.
- Log fetch failures via the typed logger (`src/lib/logger/`) with the URL and status code.
- Never throw to the UI without a user-facing message.
- Schema validation errors are reported as `FetchError` with type `'invalid_response'` — they indicate the FPL API changed shape and need attention, not a transient network issue.
