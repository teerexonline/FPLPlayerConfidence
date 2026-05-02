/**
 * End-to-end sync monitor for FPL Player Confidence.
 *
 * 1. Resets sync_state to idle in production Postgres
 * 2. Triggers the cron endpoint with Bearer auth
 * 3. Polls sync_meta every 30 s, logging phase/batch progress
 * 4. Exits when phase returns to idle (completion) or failed (error)
 * 5. Prints final spot-checks on players and confidence_snapshots
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const PRODUCTION_URL = 'https://fpl-player-confidence.vercel.app';
const POLL_INTERVAL_MS = 30_000;

if (!DATABASE_URL) throw new Error('DATABASE_URL not set');
if (!CRON_SECRET) throw new Error('CRON_SECRET not set');

const sql = postgres(DATABASE_URL, { prepare: false, max: 3 });

function now() {
  return new Date().toISOString().slice(11, 19); // HH:MM:SS
}

function elapsed(startMs) {
  const s = Math.round((Date.now() - startMs) / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

async function getSyncState() {
  const rows = await sql`SELECT value FROM sync_meta WHERE key = 'sync_state'`;
  if (rows.length === 0) return null;
  try {
    return JSON.parse(rows[0].value);
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
  await sql`
    UPDATE sync_meta SET value = ${idle}
    WHERE key = 'sync_state'
  `;
  // In case the row doesn't exist yet
  await sql`
    INSERT INTO sync_meta (key, value, updated_at)
    VALUES ('sync_state', ${idle}, ${Date.now()})
    ON CONFLICT (key) DO NOTHING
  `;
  console.log(`[${now()}] sync_state reset to idle`);
}

async function triggerCron() {
  const res = await fetch(`${PRODUCTION_URL}/api/cron/sync`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(`[${now()}] Cron trigger → HTTP ${res.status}: ${body}`);
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(`Unexpected status ${res.status}`);
  }
}

async function spotCheck() {
  const [maxUpdatedAt] = await sql`SELECT MAX(updated_at) AS max_ua FROM players`;
  const [snapshotCount] = await sql`SELECT COUNT(*) AS cnt FROM confidence_snapshots`;
  const [lastSync] = await sql`SELECT value FROM sync_meta WHERE key = 'last_sync'`;
  const [currentGw] = await sql`SELECT value FROM sync_meta WHERE key = 'current_gameweek'`;

  console.log('\n── Spot checks ──────────────────────────────────────');
  console.log(`  players.MAX(updated_at)         : ${maxUpdatedAt?.max_ua ?? 'n/a'}`);
  console.log(`  confidence_snapshots COUNT(*)   : ${snapshotCount?.cnt ?? 'n/a'}`);
  console.log(`  sync_meta last_sync             : ${lastSync?.value ?? 'n/a'}`);
  console.log(`  sync_meta current_gameweek      : ${currentGw?.value ?? 'n/a'}`);
}

async function main() {
  const startMs = Date.now();
  console.log('═══════════════════════════════════════════════════');
  console.log('  FPL sync end-to-end monitor');
  console.log(`  Target: ${PRODUCTION_URL}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Step 1: Reset to idle
  await resetToIdle();

  // Confirm reset landed
  const stateAfterReset = await getSyncState();
  console.log(`[${now()}] Confirmed phase after reset: ${stateAfterReset?.phase ?? 'unknown'}\n`);

  // Step 2: Trigger cron (bootstrap → player_history)
  await triggerCron();

  // Step 3: Poll until idle or failed
  let lastPhase = null;
  let lastBatch = null;
  let pollCount = 0;

  // Give the first batch a few seconds to start writing state
  await new Promise((r) => setTimeout(r, 5000));

  while (true) {
    const state = await getSyncState();
    if (!state) {
      console.log(`[${now()}] WARNING: sync_state row not found — retrying`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    const { phase, batchIndex, totalBatches, error, completedAt } = state;
    const changed = phase !== lastPhase || batchIndex !== lastBatch;

    if (changed) {
      if (phase === 'player_history') {
        console.log(
          `[${now()}] [${elapsed(startMs)}] phase=${phase}  batch=${batchIndex + 1}/${totalBatches}`,
        );
      } else {
        console.log(`[${now()}] [${elapsed(startMs)}] phase=${phase}`);
      }
      lastPhase = phase;
      lastBatch = batchIndex;
    } else {
      pollCount++;
      // Still log every 2 polls (60 s) even without change so we know it's alive
      if (pollCount % 2 === 0) {
        if (phase === 'player_history') {
          console.log(
            `[${now()}] [${elapsed(startMs)}] still running — batch=${batchIndex + 1}/${totalBatches}`,
          );
        } else {
          console.log(`[${now()}] [${elapsed(startMs)}] still running — phase=${phase}`);
        }
      }
    }

    if (phase === 'idle' && lastBatch !== null) {
      // We transitioned back to idle — sync completed
      console.log(`\n[${now()}] ✓ Sync complete in ${elapsed(startMs)}`);
      console.log(`  completedAt: ${completedAt ? new Date(completedAt).toISOString() : 'null'}`);
      console.log(`  error: ${error ?? 'none'}`);
      break;
    }

    if (phase === 'failed') {
      console.log(`\n[${now()}] ✗ Sync FAILED after ${elapsed(startMs)}`);
      console.log(`  error: ${error ?? '(no message)'}`);
      process.exitCode = 1;
      break;
    }

    // Timeout guard: 15 minutes max
    if (Date.now() - startMs > 15 * 60 * 1000) {
      console.log(`\n[${now()}] TIMEOUT — sync did not complete within 15 minutes`);
      console.log(`  Last known state: phase=${phase}, batch=${batchIndex}/${totalBatches}`);
      process.exitCode = 1;
      break;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  // Step 4: Spot checks
  await spotCheck();

  // Print final sync_state
  const finalState = await getSyncState();
  console.log('\n── Final sync_state ──────────────────────────────────');
  console.log(JSON.stringify(finalState, null, 2));
  console.log('──────────────────────────────────────────────────────\n');

  await sql.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
