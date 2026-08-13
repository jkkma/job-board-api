import { beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';

/**
 * Refuse to run against anything that isn't obviously a test database.
 *
 * `beforeEach` below truncates every table in the public schema. Pointing
 * DATABASE_URL at a development database by accident would silently empty it,
 * so the name has to say "test" before we touch anything.
 */
const databaseName = new URL(process.env['DATABASE_URL'] ?? '').pathname.replace(/^\//, '');
if (!/test/i.test(databaseName)) {
  throw new Error(
    `Refusing to run tests against database "${databaseName}": the name must contain "test". ` +
      'Check TEST_DATABASE_URL in your .env.'
  );
}

interface TableRow {
  tablename: string;
}

beforeEach(async () => {
  // Derived from pg_tables rather than hardcoded, so a new model added to the
  // schema is cleaned up without anyone remembering to update this list.
  const tables = await prisma.$queryRaw<TableRow[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const targets = tables.map((table) => `"public"."${table.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${targets} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  // Without this, Vitest hangs waiting on the open connection pool.
  await prisma.$disconnect();
});
