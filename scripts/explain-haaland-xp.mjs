/**
 * Walks through Haaland's GW36 xP calculation step by step using the
 * exact data the API reads from Supabase.
 */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const url = env
  .split('\n')
  .find((l) => l.startsWith('DATABASE_URL='))
  .slice('DATABASE_URL='.length);
const sql = postgres(url, { max: 1 });

const HAALAND = 430;
const TARGET_GW = 36;

// 1. Haaland's most recent confidence
const [conf] = await sql`
  SELECT gameweek, confidence_after
  FROM confidence_snapshots
  WHERE player_id = ${HAALAND}
  ORDER BY gameweek DESC
  LIMIT 1
`;

// 2. Haaland's per-bucket FPL averages
const buckets = await sql`
  SELECT bucket, avg_points, sample_count
  FROM player_fdr_averages
  WHERE player_id = ${HAALAND}
  ORDER BY bucket
`;

// 3. Man City's GW36 fixture(s)
const [haalandRow] = await sql`SELECT team_id FROM players WHERE id = ${HAALAND}`;
const fixtures = await sql`
  SELECT f.fixture_id, f.opponent_team_id, t.short_name AS opponent, f.is_home, f.fdr
  FROM fixtures f
  LEFT JOIN teams t ON t.id = f.opponent_team_id
  WHERE f.team_id = ${haalandRow.team_id} AND f.gameweek = ${TARGET_GW}
`;

// ─── Walk-through ────────────────────────────────────────────────────────────

const c = conf.confidence_after;
const confidencePct = c >= 0 ? 50 + (c / 5) * 50 : Math.max(0, 50 + (c / 4) * 50);
const confidenceFraction = confidencePct / 100;

console.log('═══ HAALAND xP for GW36 ═══\n');

console.log('─── Step 1: Confidence ───');
console.log(`  raw confidence    = ${c}  (from GW${conf.gameweek} snapshot)`);
console.log(`  → confidence%      = ${confidencePct}%`);
console.log(`  → as fraction      = ${confidenceFraction.toFixed(2)}\n`);

console.log('─── Step 2: Per-bucket FPL averages (current season) ───');
for (const b of buckets) {
  console.log(
    `  ${b.bucket.padEnd(4)} → avg = ${Number(b.avg_points).toFixed(4)} pts/appearance  (n=${b.sample_count})`,
  );
}
console.log();

console.log(`─── Step 3: GW${TARGET_GW} fixture(s) for Manchester City ───`);
for (const f of fixtures) {
  const bucket = f.fdr <= 2 ? 'LOW' : f.fdr === 3 ? 'MID' : 'HIGH';
  console.log(`  ${f.is_home ? 'H vs' : 'A @ '} ${f.opponent}  FDR=${f.fdr}  → bucket = ${bucket}`);
}
console.log();

console.log('─── Step 4: Per-fixture xP ───');
console.log('  Formula:  xP = (0.1 + confidence) × bucketAvg\n');
let total = 0;
for (const f of fixtures) {
  const bucket = f.fdr <= 2 ? 'LOW' : f.fdr === 3 ? 'MID' : 'HIGH';
  const bucketRow = buckets.find((b) => b.bucket === bucket);
  const bucketAvg = Number(bucketRow.avg_points);
  const xp = (0.1 + confidenceFraction) * bucketAvg;
  total += xp;
  console.log(
    `  vs ${f.opponent} (${bucket}):  (0.1 + ${confidenceFraction.toFixed(2)}) × ${bucketAvg.toFixed(4)} = ${xp.toFixed(4)}`,
  );
}
console.log();

console.log('─── Step 5: Total ───');
console.log(`  sum across ${fixtures.length} fixture(s) = ${total.toFixed(4)}`);
console.log(`  rounded to 2 dp           = ${(Math.round(total * 100) / 100).toFixed(2)} xP`);

await sql.end();
