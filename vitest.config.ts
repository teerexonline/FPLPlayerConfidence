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
    passWithNoTests: true, // TODO(step-2): remove once calculator tests exist
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**', 'src/components/**'],
      // TODO(step-2): re-enable thresholds once calculator tests are written.
      // Coverage thresholds fail when no tests exist — v8 reports 0% for all
      // instrumented files even with passWithNoTests. Floors per TESTING.md §8:
      // src/lib/ → 90% lines+branches; src/components/ → 70% lines.
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
