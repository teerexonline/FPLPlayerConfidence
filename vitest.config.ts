import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/lib/**/*.tsx',
        'src/components/**/*.ts',
        'src/components/**/*.tsx',
        'src/app/players/_components/**/*.ts',
        'src/app/players/_components/**/*.tsx',
        'src/app/players/[id]/_components/**/*.ts',
        'src/app/players/[id]/_components/**/*.tsx',
      ],
      exclude: [
        '**/__fixtures__/**',
        // Postgres repos run against a live database — we cover their behaviour
        // through the SQLite implementations of the same interfaces and
        // production smoke tests; unit-testing them would require a real DB.
        'src/lib/db/repositories/postgres/**',
        // Supabase auth/database client wrappers — thin glue around the SDK
        // that's exercised in E2E and production rather than unit tests.
        'src/lib/supabase/**',
        // Server-only DB factory: chooses Postgres vs SQLite at runtime; the
        // chosen implementation is tested directly.
        'src/lib/db/server.ts',
        // Auth client wrappers — covered by the auth E2E suite.
        'src/components/auth/**',
        // PWA service-worker registrar — relies on the browser SW lifecycle
        // and is verified in the PWA E2E suite.
        'src/components/pwa/**',
      ],
      thresholds: {
        // Branches at 85 (vs lines 90) accommodates defensive guard branches
        // that are intentionally unreachable in tests (e.g. server-only error
        // paths, schema fallbacks). Lines stays high — they're the substantive
        // bar. Tightening branches back to 90 should follow proper test
        // additions rather than removing the threshold.
        'src/lib/**': { lines: 90, branches: 85 },
        'src/components/**': { lines: 70 },
        'src/app/players/_components/**': { lines: 70 },
        'src/app/players/[id]/_components/**': { lines: 70 },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
