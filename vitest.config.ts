import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [['tests/client/**', 'jsdom']],
    setupFiles: ['./tests/client/setup.ts'],
  },
});
