// Prisma CLI configuration (schema location, migrations directory, datasource).
// This is read by the `prisma` CLI only — it is not part of the running app,
// which validates its own environment in src/config/env.ts.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
