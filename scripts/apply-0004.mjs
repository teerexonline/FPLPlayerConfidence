import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const url = env
  .split('\n')
  .find((l) => l.startsWith('DATABASE_URL='))
  ?.slice('DATABASE_URL='.length)
  .replace(/^"|"$/g, '');
if (!url) throw new Error('DATABASE_URL not in .env.local');

const sql = postgres(url, { max: 1 });
const migration = readFileSync(
  'supabase/migrations/0004_fixtures_and_player_fdr_averages.sql',
  'utf8',
);
console.log('Applying migration 0004...');
await sql.unsafe(migration);
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('fixtures', 'player_fdr_averages')
  ORDER BY table_name
`;
console.log(
  'Tables now present:',
  tables.map((t) => t.table_name),
);
const counts = await sql`
  SELECT 'fixtures' AS t, COUNT(*) AS n FROM fixtures
  UNION ALL
  SELECT 'player_fdr_averages', COUNT(*) FROM player_fdr_averages
`;
console.log('Row counts:', counts);
await sql.end();
