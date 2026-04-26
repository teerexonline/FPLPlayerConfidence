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
      exclude: ['**/__fixtures__/**'],
      thresholds: {
        'src/lib/**': { lines: 90, branches: 90 },
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
