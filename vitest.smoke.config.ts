import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: ['scripts/**/*.ts'],
    globals: true,
    testTimeout: 60_000,
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
