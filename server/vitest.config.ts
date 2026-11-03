import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false, // Run test suites sequentially to prevent SQLite file lock contention
    testTimeout: 10000,
  },
});
