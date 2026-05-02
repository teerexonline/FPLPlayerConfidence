import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2 });

const [snapshots] = await sql`SELECT COUNT(*) AS cnt FROM confidence_snapshots`;
const [players] = await sql`SELECT COUNT(*) AS cnt, MAX(updated_at) AS max_ua FROM players`;
const [syncState] = await sql`SELECT value FROM sync_meta WHERE key = 'sync_state'`;
const [lastSync] = await sql`SELECT value FROM sync_meta WHERE key = 'last_sync'`;
const [gw] = await sql`SELECT value FROM sync_meta WHERE key = 'current_gameweek'`;

console.log('confidence_snapshots:', snapshots.cnt);
console.log('players count / MAX(updated_at):', players.cnt, '/', players.max_ua);
console.log('last_sync:', lastSync?.value ?? 'not set');
console.log('current_gameweek:', gw?.value ?? 'not set');
console.log('sync_state:', syncState?.value ?? 'not set');

await sql.end();
