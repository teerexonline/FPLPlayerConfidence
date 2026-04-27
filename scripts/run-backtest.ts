/**
 * Phase 2 calibration backtest for the v1.3.1 probability model.
 * Usage: npx tsx scripts/run-backtest.ts
 *
 * Fetches current-season data from the live FPL API, builds one prediction
 * per (player, gameweek appearance) for GWs 5 onwards using only prior-GW
 * cumulative stats (no leakage), and writes calibration results to
 * docs/v2/calibration-results.md.
 *
 * GWs 1–4 are excluded as warmup (insufficient prior data per Gap B spec).
 * Uses oracle minutes (actual played) to isolate ICT→probability calibration
 * from the separate minutes-prediction problem.
 *
 * Multi-season validation is deferred (approved for single-season only).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBootstrapStatic, fetchElementSummary, fetchFixtures } from '@/lib/fpl/api';
import { buildFdrLookup, elementTypeToPosition } from '@/lib/sync/internal/matchEventMapper';
import { buildLeagueData, predict } from '@/lib/probability';
import type { PlayerInput, PlayerPrediction, Position } from '@/lib/probability';
import type { Element } from '@/lib/fpl/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PredictionRecord {
  readonly playerId: number;
  readonly gameweek: number;
  readonly position: Position;
  readonly predictedPGoal: number;
  readonly predictedPAssist: number;
  readonly actualGoal: boolean;
  readonly actualAssist: boolean;
  readonly minutesPlayed: number;
}

interface BucketRow {
  readonly label: string;
  readonly midpoint: number;
  readonly n: number;
  readonly events: number;
  readonly observedRate: number;
  readonly calibrationError: number;
}

interface CalibrationResult {
  readonly buckets: BucketRow[];
  readonly mace: number;
  readonly brierScore: number;
  readonly baselineBrier: number;
  readonly byPosition: Record<Position, { mace: number; brier: number; n: number }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WARMUP_GWS = 4; // skip GW 1–4 per Gap B spec
const CONCURRENT_FETCHES = 3;
const FETCH_DELAY_MS = 400;
const FALLBACK_FDR = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllPlayerHistories(
  elements: Element[],
): Promise<
  Map<
    number,
    {
      influence: number;
      creativity: number;
      threat: number;
      minutes: number;
      goalsScored: number;
      assists: number;
      round: number;
      opponentTeam: number;
      wasHome: boolean;
    }[]
  >
> {
  const result = new Map<
    number,
    {
      influence: number;
      creativity: number;
      threat: number;
      minutes: number;
      goalsScored: number;
      assists: number;
      round: number;
      opponentTeam: number;
      wasHome: boolean;
    }[]
  >();
  const total = elements.length;
  let done = 0;
  let failed = 0;

  for (let i = 0; i < elements.length; i += CONCURRENT_FETCHES) {
    const batch = elements.slice(i, i + CONCURRENT_FETCHES);
    const results = await Promise.all(batch.map((el) => fetchElementSummary(el.id)));

    for (let j = 0; j < batch.length; j++) {
      const el = batch[j];
      const res = results[j];
      if (el === undefined || res === undefined) continue;

      if (!res.ok) {
        failed++;
        continue;
      }

      result.set(
        el.id,
        res.value.history.map((h) => ({
          round: h.round,
          opponentTeam: h.opponent_team,
          wasHome: h.was_home,
          minutes: h.minutes,
          goalsScored: h.goals_scored,
          assists: h.assists,
          influence: h.influence,
          creativity: h.creativity,
          threat: h.threat,
        })),
      );
      done++;
    }

    const pct = (((done + failed) / total) * 100).toFixed(0);
    process.stdout.write(
      `\r  Fetching histories: ${String(done + failed)}/${String(total)} (${pct}%) — ${String(failed)} errors`,
    );

    if (i + CONCURRENT_FETCHES < elements.length) {
      await delay(FETCH_DELAY_MS);
    }
  }

  process.stdout.write('\n');
  console.log(`  Done: ${String(done)} ok, ${String(failed)} failed`);
  return result;
}

// ── Calibration computation ───────────────────────────────────────────────────

function computeCalibration(
  records: PredictionRecord[],
  getP: (r: PredictionRecord) => number,
  getActual: (r: PredictionRecord) => boolean,
): CalibrationResult {
  const BUCKET_EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01];
  const positions: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

  const buckets: { n: number; events: number; lo: number; hi: number }[] = BUCKET_EDGES.slice(
    0,
    -1,
  ).map((lo, idx) => ({
    lo,
    hi: BUCKET_EDGES[idx + 1] ?? 1.01,
    n: 0,
    events: 0,
  }));

  let brierSum = 0;
  const zeroBuckets = (): number[] => new Array<number>(buckets.length).fill(0);
  const posStats = Object.fromEntries(
    positions.map((p) => [
      p,
      { brierSum: 0, n: 0, bucketN: zeroBuckets(), bucketE: zeroBuckets() },
    ]),
  ) as Record<Position, { brierSum: number; n: number; bucketN: number[]; bucketE: number[] }>;

  for (const rec of records) {
    const p = getP(rec);
    const y = getActual(rec) ? 1 : 0;
    brierSum += (p - y) ** 2;

    for (const b of buckets) {
      if (p >= b.lo && p < b.hi) {
        b.n++;
        b.events += y;
        break;
      }
    }

    const ps = posStats[rec.position];
    ps.n++;
    ps.brierSum += (p - y) ** 2;
    for (const [k, b] of buckets.entries()) {
      if (p >= b.lo && p < b.hi) {
        ps.bucketN[k] = (ps.bucketN[k] ?? 0) + 1;
        ps.bucketE[k] = (ps.bucketE[k] ?? 0) + y;
        break;
      }
    }
  }

  const N = records.length;
  const brierScore = N > 0 ? brierSum / N : 0;

  // Baseline: predict position-average rate for each record
  const posAvgRate = Object.fromEntries(
    positions.map((pos) => {
      const recs = records.filter((r) => r.position === pos);
      const rate = recs.length > 0 ? recs.filter(getActual).length / recs.length : 0;
      return [pos, rate] as const;
    }),
  ) as Record<Position, number>;

  const baselineBrierSum = records.reduce((acc, r) => {
    const baseline = posAvgRate[r.position];
    return acc + (baseline - (getActual(r) ? 1 : 0)) ** 2;
  }, 0);
  const baselineBrier = N > 0 ? baselineBrierSum / N : 0;

  const MIN_BUCKET_N = 50;
  const bucketRows: BucketRow[] = buckets.map((b) => {
    const midpoint = (b.lo + Math.min(b.hi, 1.0)) / 2;
    const observedRate = b.n > 0 ? b.events / b.n : 0;
    const label = `${String(Math.round(b.lo * 100))}–${String(Math.round(Math.min(b.hi, 1.0) * 100))}%`;
    return {
      label,
      midpoint,
      n: b.n,
      events: b.events,
      observedRate,
      calibrationError: b.n >= MIN_BUCKET_N ? Math.abs(midpoint - observedRate) : 0,
    };
  });

  const eligibleBuckets = bucketRows.filter((b) => b.n >= MIN_BUCKET_N);
  const mace =
    eligibleBuckets.length > 0
      ? eligibleBuckets.reduce((s, b) => s + b.calibrationError, 0) / eligibleBuckets.length
      : 0;

  const byPosition = Object.fromEntries(
    positions.map((pos) => {
      const ps = posStats[pos];
      const posMace =
        ps.n > 0
          ? (() => {
              const posBuckets = ps.bucketN.map((n, k) => ({
                n,
                events: ps.bucketE[k] ?? 0,
                midpoint: bucketRows[k]?.midpoint ?? 0,
              }));
              const eligible = posBuckets.filter((b) => b.n >= MIN_BUCKET_N);
              if (eligible.length === 0) return 0;
              return (
                eligible.reduce(
                  (acc, b) => acc + Math.abs(b.midpoint - (b.n > 0 ? b.events / b.n : 0)),
                  0,
                ) / eligible.length
              );
            })()
          : 0;

      return [pos, { mace: posMace, brier: ps.n > 0 ? ps.brierSum / ps.n : 0, n: ps.n }] as const;
    }),
  ) as Record<Position, { mace: number; brier: number; n: number }>;

  return { buckets: bucketRows, mace, brierScore, baselineBrier, byPosition };
}

// ── Report generation ─────────────────────────────────────────────────────────

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function pp(v: number): string {
  return `${(v * 100).toFixed(1)}pp`;
}

function renderBucketTable(buckets: BucketRow[], label: string): string {
  const MIN_N = 50;
  const header = `| Bucket | N | Events | Observed | Expected | Error |`;
  const sep = `|--------|---|--------|----------|----------|-------|`;
  const rows = buckets
    .map((b) => {
      const skip = b.n < MIN_N ? ' *(sparse)*' : '';
      return `| ${b.label} | ${String(b.n)} | ${String(b.events)} | ${pct(b.observedRate)} | ${pct(b.midpoint)} | ${b.n >= MIN_N ? pp(b.calibrationError) : '—'}${skip} |`;
    })
    .join('\n');
  return `### ${label}\n\n${header}\n${sep}\n${rows}`;
}

function buildReport(
  nPredictions: number,
  gwRange: [number, number],
  goalCal: CalibrationResult,
  assistCal: CalibrationResult,
  generatedAt: string,
): string {
  const positions: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

  const MACE_THRESHOLD = 0.05;
  const MAX_BUCKET_ERROR = 0.1;
  const MIN_BUCKET_N = 50;

  const goalFailures: string[] = [];
  const assistFailures: string[] = [];

  if (goalCal.mace > MACE_THRESHOLD) {
    goalFailures.push(`Overall MACE ${pp(goalCal.mace)} exceeds ${pp(MACE_THRESHOLD)} threshold`);
  }
  for (const b of goalCal.buckets) {
    if (b.n >= MIN_BUCKET_N && b.calibrationError > MAX_BUCKET_ERROR) {
      goalFailures.push(
        `Bucket ${b.label}: error ${pp(b.calibrationError)} > ${pp(MAX_BUCKET_ERROR)}`,
      );
    }
  }
  for (const pos of positions) {
    const ps = goalCal.byPosition[pos];
    if (ps.n >= MIN_BUCKET_N && ps.mace > MACE_THRESHOLD) {
      goalFailures.push(`${pos} MACE ${pp(ps.mace)} exceeds threshold`);
    }
  }
  if (goalCal.brierScore >= goalCal.baselineBrier) {
    goalFailures.push(
      `Brier score ${goalCal.brierScore.toFixed(4)} ≥ baseline ${goalCal.baselineBrier.toFixed(4)}`,
    );
  }

  if (assistCal.mace > MACE_THRESHOLD) {
    assistFailures.push(
      `Overall MACE ${pp(assistCal.mace)} exceeds ${pp(MACE_THRESHOLD)} threshold`,
    );
  }
  if (assistCal.brierScore >= assistCal.baselineBrier) {
    assistFailures.push(
      `Brier score ${assistCal.brierScore.toFixed(4)} ≥ baseline ${assistCal.baselineBrier.toFixed(4)}`,
    );
  }

  const goalPass = goalFailures.length === 0;
  const assistPass = assistFailures.length === 0;
  const overallPass = goalPass && assistPass;

  const verdict = overallPass ? '✅ PASS' : '❌ FAIL';

  const posTable = positions
    .map((pos) => {
      const g = goalCal.byPosition[pos];
      const a = assistCal.byPosition[pos];
      return `| ${pos} | ${String(g.n)} | ${pp(g.mace)} | ${g.brier.toFixed(4)} | ${pp(a.mace)} | ${a.brier.toFixed(4)} |`;
    })
    .join('\n');

  return `# Probability Model Calibration Results

**Generated:** ${generatedAt}
**Model version:** v1.3.1
**Season:** 2025/26 (single-season; multi-season validation deferred)
**GW range:** GW ${String(gwRange[0])}–${String(gwRange[1])} (GW 1–${String(WARMUP_GWS)} excluded as warmup)
**Total predictions:** ${String(nPredictions)}

---

## Verdict: ${verdict}

${overallPass ? 'All acceptance criteria from Gap B spec are met.' : 'One or more acceptance criteria failed — see details below.'}

${
  goalFailures.length > 0
    ? `**Goal model failures:**\n${goalFailures.map((f) => `- ${f}`).join('\n')}`
    : '**Goal model:** all criteria pass.'
}

${
  assistFailures.length > 0
    ? `**Assist model failures:**\n${assistFailures.map((f) => `- ${f}`).join('\n')}`
    : '**Assist model:** all criteria pass.'
}

---

## Overall Metrics

| Metric | Goal model | Assist model |
|--------|-----------|--------------|
| MACE (overall) | ${pp(goalCal.mace)} | ${pp(assistCal.mace)} |
| Brier score | ${goalCal.brierScore.toFixed(4)} | ${assistCal.brierScore.toFixed(4)} |
| Baseline Brier | ${goalCal.baselineBrier.toFixed(4)} | ${assistCal.baselineBrier.toFixed(4)} |
| Beats baseline | ${goalCal.brierScore < goalCal.baselineBrier ? 'Yes ✅' : 'No ❌'} | ${assistCal.brierScore < assistCal.baselineBrier ? 'Yes ✅' : 'No ❌'} |

---

## Calibration Buckets

${renderBucketTable(goalCal.buckets, 'P(Goal) calibration')}

${renderBucketTable(assistCal.buckets, 'P(Assist) calibration')}

---

## Position-Stratified Results

| Position | N | Goal MACE | Goal Brier | Assist MACE | Assist Brier |
|----------|---|-----------|------------|-------------|--------------|
${posTable}

---

## Recommendation

${
  overallPass
    ? `The v1.3.1 model meets all Gap B acceptance criteria on 2025/26 data. The algorithm is calibrated well enough to proceed to UI integration.

**Caveats:**
- Single-season validation only. Multi-season validation would increase confidence.
- Calibration was measured with oracle minutes (actual played); real-world performance will also depend on minutes prediction quality.
- The cap saturation issue (most full-match predictions hit MAX_GOAL_PROB=0.65 for high-percentile players) limits the model's discriminative power at the top end.`
    : `The v1.3.1 model **does not** meet all Gap B acceptance criteria. Do not proceed to UI integration until the failures above are resolved.

**Common causes for calibration failure:**
- Cap saturation: the probability caps (MAX_GOAL_PROB=0.65, MAX_ASSIST_PROB=0.55) may need recalibration.
- BASELINE_ATTACKING_EVENTS_PER_MATCH (currently 12) may need adjustment based on observed calibration.
- The shrinkage constant MIN_MINUTES_FOR_RANKING may need tuning for single-season data.

**Next steps:** Adjust constants in \`src/lib/probability/constants.ts\` and re-run this script.`
}

---

*Generated by \`scripts/run-backtest.ts\`. Multi-season validation (2023/24 + 2024/25 via history_past API) is deferred pending API access confirmation.*
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('FPL Probability Model Backtest — v1.3.1');
  console.log('=========================================\n');

  // 1. Fetch bootstrap
  console.log('Fetching bootstrap-static...');
  const bootstrapResult = await fetchBootstrapStatic();
  if (!bootstrapResult.ok) {
    console.error('Failed to fetch bootstrap:', bootstrapResult.error);
    process.exit(1);
  }
  const { elements, events } = bootstrapResult.value;

  const finishedGws = events
    .filter((e) => e.finished)
    .map((e) => e.id)
    .sort((a, b) => a - b);

  if (finishedGws.length === 0) {
    console.error('No finished GWs found — season may not have started.');
    process.exit(1);
  }

  const maxGw = finishedGws[finishedGws.length - 1] ?? 0;
  const minGw = WARMUP_GWS + 1;
  console.log(
    `Season GWs finished: 1–${String(maxGw)}. Backtesting GW ${String(minGw)}–${String(maxGw)}.\n`,
  );

  // 2. Fetch fixtures for FDR lookup
  console.log('Fetching fixtures...');
  const fixturesResult = await fetchFixtures();
  if (!fixturesResult.ok) {
    console.error('Failed to fetch fixtures:', fixturesResult.error);
    process.exit(1);
  }
  const fdrLookup = buildFdrLookup(fixturesResult.value);

  // 3. Fetch all player histories
  console.log(`\nFetching element summaries for ${String(elements.length)} players...\n`);
  const histories = await fetchAllPlayerHistories(elements);

  // Build player metadata map (id → team, position)
  const elementMeta = new Map<number, { teamId: number; position: Position }>();
  for (const el of elements) {
    elementMeta.set(el.id, {
      teamId: el.team,
      position: elementTypeToPosition(el.element_type),
    });
  }

  // 4. Build predictions
  console.log('\nBuilding predictions...');
  const predictions: PredictionRecord[] = [];

  for (let gw = minGw; gw <= maxGw; gw++) {
    // Compute cumulative stats through GW gw-1 for every player
    const cumulative = new Map<
      number,
      { minutes: number; influence: number; creativity: number; threat: number }
    >();

    for (const [playerId, history] of histories) {
      const prior = history.filter((h) => h.round < gw);
      if (prior.length === 0) continue;

      const minutes = prior.reduce((s, h) => s + h.minutes, 0);
      if (minutes === 0) continue;

      cumulative.set(playerId, {
        minutes,
        influence: prior.reduce((s, h) => s + h.influence, 0),
        creativity: prior.reduce((s, h) => s + h.creativity, 0),
        threat: prior.reduce((s, h) => s + h.threat, 0),
      });
    }

    // Build PlayerInput[] for league snapshot
    const leaguePlayers: PlayerInput[] = [];
    for (const [playerId, cum] of cumulative) {
      const meta = elementMeta.get(playerId);
      if (!meta) continue;
      leaguePlayers.push({
        id: playerId,
        position: meta.position,
        minutes: cum.minutes,
        influence: cum.influence,
        creativity: cum.creativity,
        threat: cum.threat,
      });
    }

    if (leaguePlayers.length === 0) continue;
    const league = buildLeagueData(leaguePlayers);

    // Predict for each player who appeared in GW gw
    for (const [playerId, history] of histories) {
      const appearances = history.filter((h) => h.round === gw && h.minutes > 0);
      if (appearances.length === 0) continue;

      const cum = cumulative.get(playerId);
      if (!cum) continue; // player had no prior data (e.g. debuted in warmup)

      const meta = elementMeta.get(playerId);
      if (!meta) continue;

      const playerInput: PlayerInput = {
        id: playerId,
        position: meta.position,
        minutes: cum.minutes,
        influence: cum.influence,
        creativity: cum.creativity,
        threat: cum.threat,
      };

      for (const appearance of appearances) {
        // Look up FDR for this fixture
        const fixtureKey = appearance.wasHome
          ? `${String(gw)}:${String(meta.teamId)}:${String(appearance.opponentTeam)}`
          : `${String(gw)}:${String(appearance.opponentTeam)}:${String(meta.teamId)}`;

        const fdrEntry = fdrLookup.get(fixtureKey);
        const playerFdr = fdrEntry
          ? appearance.wasHome
            ? fdrEntry.homeFdr
            : fdrEntry.awayFdr
          : FALLBACK_FDR;
        const opponentFdr = fdrEntry
          ? appearance.wasHome
            ? fdrEntry.awayFdr
            : fdrEntry.homeFdr
          : FALLBACK_FDR;

        const result: PlayerPrediction = predict(
          playerId,
          playerInput,
          {
            playerTeamFdr: Math.max(1, Math.min(5, playerFdr)),
            opponentTeamFdr: Math.max(1, Math.min(5, opponentFdr)),
            expectedMinutes: appearance.minutes,
          },
          league,
        );

        predictions.push({
          playerId,
          gameweek: gw,
          position: meta.position,
          predictedPGoal: result.pGoal,
          predictedPAssist: result.pAssist,
          actualGoal: appearance.goalsScored > 0,
          actualAssist: appearance.assists > 0,
          minutesPlayed: appearance.minutes,
        });
      }
    }

    process.stdout.write(
      `\r  GW ${String(gw).padStart(2)} — ${String(predictions.length)} predictions so far`,
    );
  }

  process.stdout.write('\n');
  console.log(`\nTotal predictions: ${String(predictions.length)}`);

  if (predictions.length === 0) {
    console.error('No predictions generated — check data availability.');
    process.exit(1);
  }

  // 5. Compute calibration
  console.log('Computing calibration metrics...');
  const goalCal = computeCalibration(
    predictions,
    (r) => r.predictedPGoal,
    (r) => r.actualGoal,
  );
  const assistCal = computeCalibration(
    predictions,
    (r) => r.predictedPAssist,
    (r) => r.actualAssist,
  );

  console.log(
    `\nGoal model:   MACE=${pp(goalCal.mace)}  Brier=${goalCal.brierScore.toFixed(4)} (baseline=${goalCal.baselineBrier.toFixed(4)})`,
  );
  console.log(
    `Assist model: MACE=${pp(assistCal.mace)}  Brier=${assistCal.brierScore.toFixed(4)} (baseline=${assistCal.baselineBrier.toFixed(4)})`,
  );

  // 6. Write report
  const outDir = join(process.cwd(), 'docs', 'v2');
  mkdirSync(outDir, { recursive: true });

  const reportPath = join(outDir, 'calibration-results.md');
  const report = buildReport(
    predictions.length,
    [minGw, maxGw],
    goalCal,
    assistCal,
    new Date().toISOString(),
  );

  writeFileSync(reportPath, report, 'utf8');
  console.log(`\nReport written to: ${reportPath}`);
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
