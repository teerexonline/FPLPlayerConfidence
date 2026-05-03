/**
 * One-shot: populate the `fixtures` + `player_fdr_averages` tables in
 * Supabase Postgres from the live FPL API. This is a stop-gap until the
 * cron pipeline (cronSync.ts) is wired to do it on every sync.
 */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const url = env
  .split('\n')
  .find((l) => l.startsWith('DATABASE_URL='))
  ?.slice('DATABASE_URL='.length)
  .replace(/^"|"$/g, '');
if (!url) throw new Error('DATABASE_URL not in .env.local');

const sql = postgres(url, { max: 4 });

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

function bucketForFdr(fdr) {
  if (fdr <= 2) return 'LOW';
  if (fdr === 3) return 'MID';
  return 'HIGH';
}

console.log('Fetching FPL fixtures…');
const fixturesRes = await fetch('https://fantasy.premierleague.com/api/fixtures/', {
  headers: HEADERS,
});
const fixtures = await fixturesRes.json();
console.log(`Got ${fixtures.length} fixtures`);

// Build per-team fixture rows.
const fixtureRows = [];
for (const f of fixtures) {
  if (f.event === null) continue;
  fixtureRows.push({
    fixture_id: f.id,
    gameweek: f.event,
    team_id: f.team_h,
    opponent_team_id: f.team_a,
    is_home: true,
    fdr: f.team_h_difficulty,
    finished: f.finished,
    kickoff_time: f.kickoff_time,
  });
  fixtureRows.push({
    fixture_id: f.id,
    gameweek: f.event,
    team_id: f.team_a,
    opponent_team_id: f.team_h,
    is_home: false,
    fdr: f.team_a_difficulty,
    finished: f.finished,
    kickoff_time: f.kickoff_time,
  });
}

console.log(`Inserting ${fixtureRows.length} per-team fixture rows…`);
await sql`DELETE FROM fixtures`;
// Chunk to avoid Postgres query size limits
const CHUNK = 500;
for (let i = 0; i < fixtureRows.length; i += CHUNK) {
  const chunk = fixtureRows.slice(i, i + CHUNK);
  await sql`INSERT INTO fixtures ${sql(chunk)} ON CONFLICT (fixture_id, team_id) DO NOTHING`;
}
const { count: fixCount } = await sql`SELECT COUNT(*)::int AS count FROM fixtures`.then(
  (r) => r[0],
);
console.log(`fixtures populated: ${fixCount}`);

// Build per-fixture FDR lookup keyed by `${gw}:${team_h}:${team_a}`.
const fdrLookup = new Map();
for (const f of fixtures) {
  if (f.event === null) continue;
  fdrLookup.set(`${f.event}:${f.team_h}:${f.team_a}`, {
    homeFdr: f.team_h_difficulty,
    awayFdr: f.team_a_difficulty,
  });
}

console.log('\nFetching active players from bootstrap…');
const bootRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
  headers: HEADERS,
});
const boot = await bootRes.json();
const activePlayers = boot.elements.filter((e) => e.total_points > 0);
console.log(`${activePlayers.length} active players to process`);

console.log('\nFetching per-player history and aggregating FDR averages…');
const fdrAverageRows = [];
const now = Date.now();
let processed = 0;
const CONCURRENCY = 8;

async function processPlayer(player) {
  try {
    const res = await fetch(`https://fantasy.premierleague.com/api/element-summary/${player.id}/`, {
      headers: HEADERS,
    });
    if (!res.ok) return;
    const data = await res.json();
    const buckets = {
      LOW: { total: 0, count: 0 },
      MID: { total: 0, count: 0 },
      HIGH: { total: 0, count: 0 },
    };
    for (const item of data.history) {
      if (item.minutes <= 0) continue;
      const key = item.was_home
        ? `${item.round}:${player.team}:${item.opponent_team}`
        : `${item.round}:${item.opponent_team}:${player.team}`;
      const entry = fdrLookup.get(key);
      if (!entry) continue;
      const fdr = item.was_home ? entry.homeFdr : entry.awayFdr;
      const b = bucketForFdr(fdr);
      buckets[b].total += item.total_points;
      buckets[b].count += 1;
    }
    for (const [bucket, acc] of Object.entries(buckets)) {
      if (acc.count > 0) {
        fdrAverageRows.push({
          player_id: player.id,
          bucket,
          avg_points: Math.round((acc.total / acc.count) * 10000) / 10000,
          sample_count: acc.count,
          updated_at: now,
        });
      }
    }
  } catch (err) {
    console.warn(`player ${player.id}: ${err.message}`);
  }
  processed += 1;
  if (processed % 50 === 0) {
    console.log(`  processed ${processed}/${activePlayers.length}`);
  }
}

// Concurrency-limited processing
const queue = [...activePlayers];
async function worker() {
  while (queue.length > 0) {
    const p = queue.shift();
    await processPlayer(p);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\nInserting ${fdrAverageRows.length} player_fdr_averages rows…`);
await sql`DELETE FROM player_fdr_averages`;
for (let i = 0; i < fdrAverageRows.length; i += CHUNK) {
  const chunk = fdrAverageRows.slice(i, i + CHUNK);
  await sql`
    INSERT INTO player_fdr_averages ${sql(chunk)}
    ON CONFLICT (player_id, bucket) DO UPDATE SET
      avg_points = EXCLUDED.avg_points,
      sample_count = EXCLUDED.sample_count,
      updated_at = EXCLUDED.updated_at
  `;
}

const counts = await sql`
  SELECT 'fixtures' AS t, COUNT(*)::int AS n FROM fixtures
  UNION ALL
  SELECT 'player_fdr_averages', COUNT(*)::int FROM player_fdr_averages
`;
console.log('\nFinal counts:', counts);
await sql.end();
