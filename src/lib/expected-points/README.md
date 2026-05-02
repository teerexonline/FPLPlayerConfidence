# `src/lib/expected-points`

Pure function that projects **expected FPL points (xP)** for a player against
their team's upcoming fixture(s) in a given gameweek, given:

- the player's current Confidence % (computed elsewhere by `team-confidence`),
- their per-FDR-bucket historical average points (precomputed by sync),
- the team's fixtures for the target gameweek.

No I/O. No side effects. No framework dependencies.

The full spec is in [`docs/ALGORITHM.md` §12](../../../docs/ALGORITHM.md).

---

## Formula

```
xP_per_fixture = 0.1 + (confidencePct / 100) × bucketAvg(player, bucket(fdr))
xP_for_gameweek = Σ xP_per_fixture for all fixtures in that gameweek
```

Buckets:

| FDR | Bucket |
| --- | ------ |
| 1   | LOW    |
| 2   | LOW    |
| 3   | MID    |
| 4   | HIGH   |
| 5   | HIGH   |

A player with no current-season appearances in a bucket falls back to
`BUCKET_FALLBACK_AVG = 2.3`.

A team's xP for a gameweek is the **sum** of its 11 starters' xPs (bench is
ignored, exactly as Team Confidence ignores the bench).

---

## Public API

```ts
import {
  bucketForFdr,
  calculatePlayerXp,
  calculateTeamXp,
  BUCKET_FALLBACK_AVG,
} from '@/lib/expected-points';
import type {
  PlayerXpInput,
  PlayerXpResult,
  TeamXpInput,
  TeamXpResult,
  TeamFixture,
  PlayerBucketAverages,
  StarterXpInput,
} from '@/lib/expected-points';
```

### `calculatePlayerXp(input)`

Returns `{ playerId, xp, fixtureCount }`. `xp` is rounded to 2 dp and `0` for a
blank gameweek (`fixtures.length === 0`).

### `calculateTeamXp(input)`

Filters picks to starters (`squadPosition ≤ 11`), runs `calculatePlayerXp` for
each, and returns `{ teamXp, perPlayer }` where `teamXp` is the rounded sum.

---

## Test coverage

24 tests across:

- **`bucketForFdr`** — all 5 FDR values
- **Worked examples** (XP-EX-01…14) — every case in `docs/ALGORITHM.md` §12.6
- **Edge cases** — bucket avg of exactly 0 must NOT trigger fallback
- **Properties** (XP-PROP-01…03, fast-check) — per-fixture floor, sum identity, bench irrelevance

Coverage: **100% statements / 100% branches / 100% functions / 100% lines**.
