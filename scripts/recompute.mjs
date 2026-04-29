/**
 * v1.7 recompute script.
 * Calls syncConfidence via the live FPL API and the production SQLite file.
 * Run with: node --experimental-vm-modules scripts/recompute.mjs
 *
 * Uses tsx to handle TypeScript imports via the tsconfig paths.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('data/fpl.db')) {
  console.error('data/fpl.db not found — run from the project root');
  process.exit(1);
}

console.log('Starting v1.7 recompute via tsx...');
execSync('npx tsx --tsconfig tsconfig.json scripts/recompute-runner.ts', {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});
