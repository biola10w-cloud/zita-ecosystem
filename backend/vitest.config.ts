import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Test files share a single Postgres database; run them sequentially
    // so one file's afterAll cleanup can't wipe rows another file is using.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
