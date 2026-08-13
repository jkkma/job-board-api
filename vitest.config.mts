import 'dotenv/config';
import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Copy .env.example to .env — the tests need a database ' +
      'separate from your development one, because they truncate every table between tests.'
  );
}

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],

    // Every test file shares one database and truncates between tests, so they
    // must not run concurrently. Sequential is fast enough at this size and is
    // far easier to reason about than per-worker schemas.
    fileParallelism: false,

    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters-long',
      // bcrypt at cost 10 is ~60ms per hash; the suite creates users constantly.
      BCRYPT_ROUNDS: '4',
      // High enough that ordinary auth tests are never throttled. The test that
      // exercises the 429 builds its own app with a deliberately tiny limit.
      AUTH_RATE_LIMIT_MAX: '10000',
      TRUST_PROXY_HOPS: '0',
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        // Boots a listener and installs signal handlers; exercised by the
        // Docker healthcheck and by hand, not by the suite.
        'src/server.ts',
        'src/types/**',
      ],
      // Pinned a little under what the suite actually reaches (≈94% lines,
      // ≈82% branches) rather than at a round aspirational number, so CI fails
      // on a real regression instead of being quietly worked around later.
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
});
