# Architecture Notes

Edge cases and non-obvious system behaviours that are not captured in code comments or the
primary spec documents. Add an entry any time you find a behaviour that would surprise a
future engineer who hasn't read the full session history.

---

## 1. Server-rendered auth state in `WatchlistCard`

### The edge case

`WatchlistCard.isAuthenticated` is baked into the RSC output at request time. If a user signs
in via the `AuthPanel` slide-over **without navigating away**, the dashboard's server-rendered
`isAuthenticated` prop remains `false` for the lifetime of that render:

- The `WatchlistCard` continues to display the sign-in CTA ("Save players to watchlist")
  even though the user is now authenticated.
- `WatchlistContext` also fetches once on mount and never re-fetches, so the watchlist items
  do not populate either (see §2 below).

The card corrects itself as soon as the user navigates to any route, because Next.js re-runs
the server component and the auth cookie is now present.

### Why it is this way

`loadDashboard()` in `src/app/page.tsx` calls `createSupabaseServerClient()` which reads the
session from the request-time cookie store. There is no mechanism to push a new RSC payload to
a page that has already been rendered — that would require either a full navigation or a
`router.refresh()` call.

We deliberately chose **not** to add a `router.refresh()` call inside `AuthContext.signIn()`
because:

- It causes a visible full-page flash.
- The sign-in panel already closes and the next natural user action (clicking a link, starring
  a player) triggers the navigation that refreshes the server state.

### Potential mitigations (not implemented)

| Option                                                                                  | Trade-off                                                                                    |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Call `router.refresh()` after successful sign-in                                        | Flash is visible; works correctly                                                            |
| Move `isAuthenticated` to a client-side context (e.g. read `AuthContext`)               | Requires another round-trip or context subscription; WatchlistCard would need `'use client'` |
| Optimistic UI: treat `isAuthenticated` as `true` right after sign-in on the client      | Requires client-side prop override mechanism; complex                                        |
| Streaming with Suspense: wrap WatchlistCard in `<Suspense>` so it defers to first paint | Changes rendering model; increases implementation surface                                    |

The current UX is acceptable: the CTA disappears the moment the user navigates, which is the
next thing they will do (e.g. click a player to add to watchlist).

---

## 2. `WatchlistContext` fetches once on mount, never on auth change

`src/components/watchlist/WatchlistContext.tsx` fetches the user's watchlist IDs in a
`useEffect(fn, [])`. This runs once, immediately after mount. It does **not** subscribe to
auth state changes.

Consequence: if a user signs in on a page that already has `WatchlistContext` mounted
(e.g. the dashboard), `WatchlistContext.ids` stays empty until the next navigation. Star
buttons will show as un-starred even for items that are in the watchlist.

This pairs with the `isAuthenticated` server-render issue in §1: both the card-level CTA
and the per-player star state are stale after a client-side sign-in. Both self-correct on
the next navigation.

---

## 3. `recentAppearancesForAllPlayers` counts DB rows, not match appearances

`SqliteConfidenceSnapshotRepository.recentAppearancesForAllPlayers` counts
`COUNT(*) GROUP BY player_id`. A Double Gameweek (DGW) is stored as one compound row
(reason string starts with `"DGW: "`), so a DGW player who played two matches in the same
gameweek is credited with 1 appearance.

This interacts with the `isStale` check in `LivePlayerStreakIndicator`
(`isStale={recentAppearances < 2}`): if the only recent snapshot is a DGW row sitting at
the edge of the 3-GW staleness window, the player is incorrectly flagged stale and the hot
streak flame is suppressed.

The player detail page (`PlayerHeader`) is immune because it hardcodes `isStale={false}`.

**Fix implemented (commit 914f826):** Replaced `recentAppearancesForAllPlayers` (COUNT\*)
with `lastAppearanceGwForAllPlayers` (MAX(gameweek)). Staleness is now computed via
`computeIsStale(currentGw, lastGw)` which returns true only when
`(currentGw − lastGw) > STALE_GW_THRESHOLD (2)`. A DGW player whose only recent row is
at GW33 has gap=2 at GW35 — exactly the threshold, NOT > 2 → fresh → flame shows
correctly. See `src/lib/confidence/staleness.ts` for the logic and regression tests.
