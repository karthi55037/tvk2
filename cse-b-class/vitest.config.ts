import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: [
      { find: '@/drizzle', replacement: path.resolve(__dirname, './drizzle') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});
