/**
 * RLS verification script for 0002_phase4_auth_rls.sql.
 *
 * Applies the migration via the postgres superuser (DATABASE_URL),
 * then verifies the policy behaviour using the Supabase PostgREST API
 * with both the anon key and a freshly-minted test auth user.
 *
 * Usage:
 *   node scripts/test-rls.mjs
 *
 * Reads from .env.local — no extra setup required.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────

const envPath = resolve(__dirname, '../.env.local');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const eq = l.indexOf('=');
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()];
    }),
);

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const DATABASE_URL = env['DATABASE_URL'];

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !DATABASE_URL) {
  console.error('Missing required env vars — check .env.local');
  process.exit(1);
}

// ── Apply migration ──────────────────────────────────────────────────────────

const { default: postgres } = await import('postgres');
const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

const migrationPath = resolve(__dirname, '../supabase/migrations/0002_phase4_auth_rls.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

console.log('Applying migration 0002_phase4_auth_rls.sql…');
await sql.unsafe(migrationSql);
console.log('Migration applied.\n');

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label) {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  ✗  ${label}`);
  if (detail !== undefined) console.error(`     ${String(detail)}`);
  failed++;
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ── Create Supabase clients ───────────────────────────────────────────────────

const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Test: anonymous role ──────────────────────────────────────────────────────

section('Anonymous client (no JWT)');

// Public tables — SELECT should succeed and return rows
const { data: playersAnon, error: playersAnonErr } = await anonClient
  .from('players')
  .select('id')
  .limit(1);
if (playersAnonErr) fail('players: SELECT', playersAnonErr.message);
else if (!Array.isArray(playersAnon)) fail('players: SELECT', 'expected array');
else pass('players: SELECT returns rows');

const { data: teamsAnon, error: teamsAnonErr } = await anonClient
  .from('teams')
  .select('id')
  .limit(1);
if (teamsAnonErr) fail('teams: SELECT', teamsAnonErr.message);
else if (!Array.isArray(teamsAnon)) fail('teams: SELECT', 'expected array');
else pass('teams: SELECT returns rows');

const { data: snapAnon, error: snapAnonErr } = await anonClient
  .from('confidence_snapshots')
  .select('player_id')
  .limit(1);
if (snapAnonErr) fail('confidence_snapshots: SELECT', snapAnonErr.message);
else if (!Array.isArray(snapAnon)) fail('confidence_snapshots: SELECT', 'expected array');
else pass('confidence_snapshots: SELECT returns rows');

// Public tables — INSERT should fail (no INSERT policy)
const { error: playerInsertErr } = await anonClient
  .from('players')
  .insert({
    id: 999999,
    web_name: 'RLS-test',
    team_id: 1,
    position: 'GK',
    now_cost: 40,
    total_points: 0,
    updated_at: 0,
  });
if (playerInsertErr) pass('players: INSERT denied for anon');
else fail('players: INSERT should be denied for anon');

// Service-role-only tables — SELECT should return empty for anon (no SELECT policy)
const { data: syncAnon, error: syncAnonErr } = await anonClient.from('sync_meta').select('key');
if (syncAnonErr) {
  // PostgREST may return an error rather than empty rows depending on config
  pass(`sync_meta: no access for anon (error: ${syncAnonErr.code})`);
} else if (Array.isArray(syncAnon) && syncAnon.length === 0) {
  pass('sync_meta: SELECT returns empty for anon (RLS blocks rows)');
} else {
  fail('sync_meta: anon should not see rows', JSON.stringify(syncAnon));
}

const { data: usersAnon, error: usersAnonErr } = await anonClient.from('users').select('id');
if (usersAnonErr) {
  pass(`users: no access for anon (error: ${usersAnonErr.code})`);
} else if (Array.isArray(usersAnon) && usersAnon.length === 0) {
  pass('users: SELECT returns empty for anon (RLS blocks rows)');
} else {
  fail('users: anon should not see rows', JSON.stringify(usersAnon));
}

// watchlist — anon gets no rows (no auth_user_id to match)
const { data: watchAnon, error: watchAnonErr } = await anonClient
  .from('watchlist')
  .select('player_id');
if (watchAnonErr) {
  pass(`watchlist: no access for anon (error: ${watchAnonErr.code})`);
} else if (Array.isArray(watchAnon) && watchAnon.length === 0) {
  pass('watchlist: SELECT returns empty for anon (no matching uid)');
} else {
  fail('watchlist: anon should see no rows', JSON.stringify(watchAnon));
}

// watchlist — INSERT should fail for anon (no JWT → auth.uid() is null)
const { error: watchInsertAnonErr } = await anonClient
  .from('watchlist')
  .insert({
    user_id: 1,
    player_id: 1,
    added_at: 0,
    auth_user_id: '00000000-0000-0000-0000-000000000000',
  });
if (watchInsertAnonErr) pass('watchlist: INSERT denied for anon');
else fail('watchlist: INSERT should be denied for anon');

// user_profiles — anon sees nothing
const { data: profileAnon, error: profileAnonErr } = await anonClient
  .from('user_profiles')
  .select('user_id');
if (profileAnonErr) {
  pass(`user_profiles: no access for anon (error: ${profileAnonErr.code})`);
} else if (Array.isArray(profileAnon) && profileAnon.length === 0) {
  pass('user_profiles: SELECT returns empty for anon');
} else {
  fail('user_profiles: anon should see no rows', JSON.stringify(profileAnon));
}

// ── Create two test auth users ───────────────────────────────────────────────

section('Setup: create test auth users');

const TS = Date.now();
const EMAIL_A = `rls-test-a-${TS.toString()}@example.invalid`;
const EMAIL_B = `rls-test-b-${TS.toString()}@example.invalid`;
const PASSWORD = 'RlsTest1234!';

const { data: userAData, error: createAErr } = await serviceClient.auth.admin.createUser({
  email: EMAIL_A,
  password: PASSWORD,
  email_confirm: true,
});
if (createAErr || !userAData?.user) {
  console.error('Could not create test user A:', createAErr?.message);
  process.exit(1);
}
const userA = userAData.user;
console.log(`  Created user A: ${userA.id}`);

const { data: userBData, error: createBErr } = await serviceClient.auth.admin.createUser({
  email: EMAIL_B,
  password: PASSWORD,
  email_confirm: true,
});
if (createBErr || !userBData?.user) {
  console.error('Could not create test user B:', createBErr?.message);
  process.exit(1);
}
const userB = userBData.user;
console.log(`  Created user B: ${userB.id}`);

// ── Sign in as user A ─────────────────────────────────────────────────────────

const { data: signInA, error: signInAErr } = await anonClient.auth.signInWithPassword({
  email: EMAIL_A,
  password: PASSWORD,
});
if (signInAErr || !signInA.session) {
  console.error('Could not sign in as user A:', signInAErr?.message);
  process.exit(1);
}
const clientA = createClient(SUPABASE_URL, ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${signInA.session.access_token}` } },
  auth: { persistSession: false },
});

// ── Test: authenticated user A ───────────────────────────────────────────────

section('Authenticated user A');

// Public tables still readable
const { data: playerAuthA, error: playerAuthAErr } = await clientA
  .from('players')
  .select('id')
  .limit(1);
if (playerAuthAErr) fail('players: authenticated SELECT', playerAuthAErr.message);
else pass('players: authenticated SELECT works');

// Seed a watchlist row for user A via service client (bypasses RLS)
await sql`
  INSERT INTO watchlist (user_id, player_id, added_at, auth_user_id)
  VALUES (1, 999001, ${Date.now()}, ${userA.id})
  ON CONFLICT DO NOTHING
`;
// Seed a watchlist row for user B via service client
await sql`
  INSERT INTO watchlist (user_id, player_id, added_at, auth_user_id)
  VALUES (1, 999002, ${Date.now()}, ${userB.id})
  ON CONFLICT DO NOTHING
`;

// User A sees only their own row
const { data: watchA, error: watchAErr } = await clientA.from('watchlist').select('player_id');
if (watchAErr) fail('watchlist: user A SELECT', watchAErr.message);
else if (!Array.isArray(watchA)) fail('watchlist: user A SELECT', 'expected array');
else if (watchA.length !== 1)
  fail('watchlist: user A should see exactly 1 row', `got ${watchA.length.toString()}`);
else if (watchA[0]?.player_id !== 999001)
  fail('watchlist: user A sees wrong row', JSON.stringify(watchA));
else pass('watchlist: user A sees only their row (player_id=999001)');

// User A cannot see user B's row
const hasBRow = Array.isArray(watchA) && watchA.some((r) => r.player_id === 999002);
if (hasBRow) fail('watchlist: user A must not see user B row');
else pass('watchlist: user A cannot see user B row');

// User A can insert their own bookmark
const { error: insertOwnErr } = await clientA
  .from('watchlist')
  .insert({ user_id: 1, player_id: 999003, added_at: Date.now(), auth_user_id: userA.id });
if (insertOwnErr) fail('watchlist: user A insert own row', insertOwnErr.message);
else pass('watchlist: user A can insert own bookmark');

// User A cannot spoof a row for user B
const { error: insertSpoofErr } = await clientA
  .from('watchlist')
  .insert({ user_id: 1, player_id: 999004, added_at: Date.now(), auth_user_id: userB.id });
if (insertSpoofErr) pass('watchlist: user A cannot spoof user B row');
else fail('watchlist: user A should not be able to insert with B auth_user_id');

// user_profiles — user A cannot INSERT (no INSERT policy)
const { error: profileInsertErr } = await clientA
  .from('user_profiles')
  .insert({ user_id: userA.id, display_name: 'Test A' });
if (profileInsertErr) pass('user_profiles: INSERT denied for authenticated user');
else fail('user_profiles: INSERT should be denied (service-role only)');

// user_profiles — service client can INSERT
await serviceClient.from('user_profiles').delete().eq('user_id', userA.id); // clean up any prior run
const { error: serviceInsertErr } = await serviceClient
  .from('user_profiles')
  .insert({ user_id: userA.id, display_name: 'Test A' });
if (serviceInsertErr) fail('user_profiles: service_role INSERT', serviceInsertErr.message);
else pass('user_profiles: service_role can INSERT');

// User A can SELECT own profile
const { data: profileA, error: profileAErr } = await clientA
  .from('user_profiles')
  .select('user_id, display_name');
if (profileAErr) fail('user_profiles: user A SELECT', profileAErr.message);
else if (!Array.isArray(profileA) || profileA.length !== 1)
  fail('user_profiles: user A should see 1 row', JSON.stringify(profileA));
else pass('user_profiles: user A can read own profile');

// User A can UPDATE own profile
const { error: updateErr } = await clientA
  .from('user_profiles')
  .update({ display_name: 'Updated A' })
  .eq('user_id', userA.id);
if (updateErr) fail('user_profiles: user A UPDATE own', updateErr.message);
else pass('user_profiles: user A can update own profile');

// ── Sign in as user B and verify isolation ───────────────────────────────────

section('Cross-user isolation (user B cannot see user A data)');

const { data: signInB, error: signInBErr } = await anonClient.auth.signInWithPassword({
  email: EMAIL_B,
  password: PASSWORD,
});
if (signInBErr || !signInB.session) {
  console.error('Could not sign in as user B:', signInBErr?.message);
  process.exit(1);
}
const clientB = createClient(SUPABASE_URL, ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${signInB.session.access_token}` } },
  auth: { persistSession: false },
});

const { data: watchB, error: watchBErr } = await clientB.from('watchlist').select('player_id');
if (watchBErr) fail('watchlist: user B SELECT', watchBErr.message);
else {
  const seesA = Array.isArray(watchB) && watchB.some((r) => r.player_id === 999001);
  if (seesA) fail('watchlist: user B must not see user A row');
  else pass('watchlist: user B cannot see user A row');
}

// user A profile invisible to user B
const { data: profileAFromB, error: profileAFromBErr } = await clientB
  .from('user_profiles')
  .select('user_id')
  .eq('user_id', userA.id);
if (profileAFromBErr) {
  pass(`user_profiles: user B cannot query user A profile (error: ${profileAFromBErr.code})`);
} else if (Array.isArray(profileAFromB) && profileAFromB.length === 0) {
  pass('user_profiles: user B sees empty result for user A profile');
} else {
  fail('user_profiles: user B should not see user A profile', JSON.stringify(profileAFromB));
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

section('Cleanup');

await sql`DELETE FROM watchlist WHERE player_id IN (999001, 999002, 999003, 999004)`;
await serviceClient.from('user_profiles').delete().eq('user_id', userA.id);
await serviceClient.auth.admin.deleteUser(userA.id);
await serviceClient.auth.admin.deleteUser(userB.id);
console.log('  Test users and watchlist rows removed.');

await sql.end();

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Result: ${passed.toString()} passed, ${failed.toString()} failed`);
if (failed > 0) process.exit(1);
