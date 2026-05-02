/**
 * External sync driver — bypasses the self-chain mechanism.
 * Triggers /api/cron/sync repeatedly from outside Vercel, polling DB
 * between triggers so each invocation starts only after the previous one
 * has written its state update.
 *
 * This is the reliable path on Hobby tier while the waitUntil vs after
 * issue is diagnosed.
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const PRODUCTION_URL = 'https://fpl-player-confidence.vercel.app';

if (!DATABASE_URL) throw new Error('DATABASE_URL not set');
if (!CRON_SECRET) throw new Error('CRON_SECRET not set');

const sql = postgres(DATABASE_URL, { prepare: false, max: 2 });

function now() {
  return new Date().toISOString().slice(11, 19);
}
function elapsed(startMs) {
  const s = Math.round((Date.now() - startMs) / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

async function getSyncState() {
  const rows = await sql`SELECT value FROM sync_meta WHERE key = 'sync_state'`;
  try {
    return JSON.parse(rows[0].value);
  } catch {
    return null;
  }
}

async function trigger() {
  const res = await fetch(`${PRODUCTION_URL}/api/cron/sync`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function waitForStateChange(prevBatchIndex, prevPhase, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    const state = await getSyncState();
    if (!state) continue;
    if (state.phase !== prevPhase || state.batchIndex !== prevBatchIndex) {
      return state;
    }
  }
  return await getSyncState(); // return whatever we have at timeout
}

async function main() {
  const startMs = Date.now();
  console.log('═══════════════════════════════════════════════════');
  console.log('  FPL sync external driver');
  console.log(`  Target: ${PRODUCTION_URL}`);
  console.log('═══════════════════════════════════════════════════\n');

  let state = await getSyncState();
  console.log(
    `[${now()}] Starting state: phase=${state?.phase ?? '?'} batchIndex=${state?.batchIndex ?? '?'}\n`,
  );

  let triggerCount = 0;

  // Drive the pipeline to completion
  while (true) {
    state = await getSyncState();
    if (!state) {
      console.log(`[${now()}] ERROR: cannot read sync_state`);
      break;
    }

    const { phase, batchIndex, totalBatches, completedAt, error } = state;

    // Terminal states
    if (phase === 'idle' && triggerCount > 0) {
      console.log(`\n[${now()}] ✓ Sync complete! Total time: ${elapsed(startMs)}`);
      console.log(`  completedAt: ${completedAt ? new Date(completedAt).toISOString() : 'null'}`);
      break;
    }
    if (phase === 'failed') {
      console.log(`\n[${now()}] ✗ Sync FAILED: ${error ?? '(no message)'}`);
      process.exitCode = 1;
      break;
    }

    // Guard: if we've been at it too long
    if (Date.now() - startMs > 10 * 60 * 1000) {
      console.log(
        `[${now()}] TIMEOUT after 10 min — last state: phase=${phase} batch=${batchIndex}/${totalBatches}`,
      );
      process.exitCode = 1;
      break;
    }

    // Trigger one step
    triggerCount++;
    const label =
      phase === 'player_history'
        ? `batch ${(batchIndex + 1).toString()}/${totalBatches.toString()}`
        : phase;
    process.stdout.write(`[${now()}] Trigger #${triggerCount} (${label})... `);

    const { status, body } = await trigger();
    console.log(`HTTP ${status}: ${body.slice(0, 80)}`);

    if (status !== 200) {
      console.log(`  ERROR: unexpected status ${status}. Retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    // Wait for DB state to advance before firing the next trigger
    const newState = await waitForStateChange(batchIndex, phase);
    if (newState && newState.batchIndex === batchIndex && newState.phase === phase) {
      // State didn't change — something is wrong, but try again
      console.log(`  [${now()}] State unchanged after trigger, retrying...`);
    }
  }

  // Spot checks
  const [snapshots] = await sql`SELECT COUNT(*) AS cnt FROM confidence_snapshots`;
  const [players] = await sql`SELECT COUNT(*) AS total, MAX(updated_at) AS max_ua FROM players`;
  const [lsync] = await sql`SELECT value FROM sync_meta WHERE key = 'last_sync'`;
  const [gw] = await sql`SELECT value FROM sync_meta WHERE key = 'current_gameweek'`;
  const finalState = await getSyncState();

  console.log('\n── Spot checks ──────────────────────────────────────');
  console.log(`  confidence_snapshots COUNT    : ${snapshots.cnt}`);
  console.log(`  players MAX(updated_at)       : ${players.max_ua}`);
  console.log(
    `  last_sync                     : ${lsync?.value ?? 'not set'} (${lsync?.value ? new Date(Number(lsync.value)).toISOString() : 'n/a'})`,
  );
  console.log(`  current_gameweek              : ${gw?.value ?? 'not set'}`);

  console.log('\n── Final sync_state ──────────────────────────────────');
  console.log(
    JSON.stringify(
      finalState,
      (k, v) => (k === 'playerIds' ? `[${Array.isArray(v) ? v.length : 0} ids]` : v),
      2,
    ),
  );
  console.log('──────────────────────────────────────────────────────');
  console.log(`\nTotal triggers: ${triggerCount}, total time: ${elapsed(startMs)}`);

  await sql.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
