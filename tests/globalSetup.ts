import 'dotenv/config';
import { execFileSync } from 'node:child_process';

/**
 * Brings the test database up to the committed migration history, once, before
 * any test file runs.
 *
 * `migrate deploy` rather than `db push`: it applies the same SQL that CI and
 * production apply, so a broken migration fails here instead of at deploy time.
 */
export default function setup(): void {
  const databaseUrl = process.env['TEST_DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL is not set.');
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    // dotenv does not overwrite variables that are already set, so pointing
    // DATABASE_URL at the test database here wins over the one in .env.
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
