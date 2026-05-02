/**
 * Self-chain verification script.
 *
 * 1. Resets sync_state to idle
 * 2. Fires ONE trigger at the cron endpoint
 * 3. Polls DB every 3 seconds — logs every state transition
 * 4. Does NOT issue any further triggers — the chain must sustain itself
 * 5. Exits when phase returns to idle (success) or fails/times out
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const PRODUCTION_URL = 'https://fpl-player-confidence.vercel.app';
const POLL_MS = 3_000;
const TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes max

if (!DATABASE_URL) throw new Error('DATABASE_URL not set');
if (!CRON_SECRET) throw new Error('CRON_SECRET not set');

const sql = postgres(DATABASE_URL, { prepare: false, max: 2 });

function ts() {
  return new Date().toISOString().slice(11, 19);
}
function elapsed(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

async function getState() {
  const [row] = await sql`SELECT value FROM sync_meta WHERE key = 'sync_state'`;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

async function resetToIdle() {
  const idle = JSON.stringify({
    phase: 'idle',
    batchIndex: 0,
    totalBatches: 0,
    playerIds: [],
    currentGw: 1,
    startedAt: null,
    completedAt: null,
    error: null,
  });
  await sql`UPDATE sync_meta SET value=${idle} WHERE key='sync_state'`;
  await sql`INSERT INTO sync_meta (key,value,updated_at) VALUES ('sync_state',${idle},${Date.now()}) ON CONFLICT (key) DO NOTHING`;
}

const start = Date.now();
console.log('═══════════════════════════════════════════════════════');
console.log('  Self-chain verification (after/next/server fix)');
console.log('═══════════════════════════════════════════════════════\n');

// Reset
await resetToIdle();
const s0 = await getState();
console.log(`[${ts()}] Reset → phase=${s0?.phase}`);

// Single trigger
const res = await fetch(`${PRODUCTION_URL}/api/cron/sync`, {
  headers: { authorization: `Bearer ${CRON_SECRET}` },
});
const body = await res.text();
console.log(`[${ts()}] Initial trigger → HTTP ${res.status}: ${body}`);
console.log(`[${ts()}] Monitoring — NO further triggers will be issued.\n`);

let prevPhase = null;
let prevBatch = null;
let lastAdvance = Date.now();
let highWaterBatch = -1;

while (true) {
  await new Promise((r) => setTimeout(r, POLL_MS));
  const state = await getState();
  if (!state) {
    console.log(`[${ts()}] WARNING: sync_state unreadable`);
    continue;
  }

  const { phase, batchIndex, totalBatches, completedAt, error } = state;

  const phaseChanged = phase !== prevPhase;
  const batchAdvanced = batchIndex > highWaterBatch;

  if (phaseChanged || batchAdvanced) {
    if (phase === 'player_history') {
      console.log(
        `[${ts()}] [${elapsed(start)}] ${phase}  batch=${batchIndex + 1}/${totalBatches}`,
      );
    } else {
      console.log(`[${ts()}] [${elapsed(start)}] phase=${phase}`);
    }
    if (batchIndex > highWaterBatch) highWaterBatch = batchIndex;
    lastAdvance = Date.now();
    prevPhase = phase;
    prevBatch = batchIndex;
  }

  // Completion
  if (phase === 'idle' && prevBatch !== null) {
    console.log(`\n[${ts()}] ✓ SELF-CHAIN COMPLETE — ${elapsed(start)}`);
    console.log(`  completedAt : ${completedAt ? new Date(completedAt).toISOString() : 'null'}`);
    console.log(`  error       : ${error ?? 'none'}`);
    console.log(`  batches     : ${highWaterBatch + 1} / ${totalBatches}`);
    break;
  }

  if (phase === 'failed') {
    console.log(`\n[${ts()}] ✗ FAILED — ${error ?? '(no message)'}`);
    process.exitCode = 1;
    break;
  }

  // Stall guard: if state hasn't advanced in 90s, declare stall (not us re-triggering)
  if (Date.now() - lastAdvance > 90_000) {
    console.log(`\n[${ts()}] ✗ STALL — state unchanged for 90s`);
    console.log(`  Last state: phase=${phase}, batchIndex=${batchIndex}/${totalBatches}`);
    console.log('  Self-chain did not sustain itself — chain dropped.');
    process.exitCode = 1;
    break;
  }

  // Overall timeout
  if (Date.now() - start > TIMEOUT_MS) {
    console.log(`\n[${ts()}] TIMEOUT after ${elapsed(start)}`);
    process.exitCode = 1;
    break;
  }
}

// Spot checks
const [snaps] = await sql`SELECT COUNT(*) AS cnt FROM confidence_snapshots`;
const [ls] = await sql`SELECT value FROM sync_meta WHERE key='last_sync'`;
const [gw] = await sql`SELECT value FROM sync_meta WHERE key='current_gameweek'`;
const final = await getState();

console.log('\n── Spot checks ──────────────────────────────────────');
console.log(`  confidence_snapshots : ${snaps.cnt}`);
console.log(
  `  last_sync            : ${ls?.value ? new Date(Number(ls.value)).toISOString() : 'not set'}`,
);
console.log(`  current_gameweek     : ${gw?.value ?? 'not set'}`);

console.log('\n── Final sync_state ──────────────────────────────────');
const display = {
  ...final,
  playerIds: `[${Array.isArray(final?.playerIds) ? final.playerIds.length : 0} ids]`,
};
console.log(JSON.stringify(display, null, 2));
console.log('──────────────────────────────────────────────────────');

await sql.end();
