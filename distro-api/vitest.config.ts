import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // These tests hit a real MySQL (see src/lib/__tests__/orderReversal.test.ts):
    // the bug being guarded against is about row locks, transaction rollback and
    // Prisma's increment/decrement semantics, none of which a mocked client
    // would exercise honestly.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Each test seeds and tears down its own rows against one shared database,
    // so they must not interleave.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
