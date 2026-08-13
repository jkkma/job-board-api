import { buildApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const app = buildApp();

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

let shuttingDown = false;

/**
 * Drain in-flight requests, close the database pool, then exit.
 *
 * Without this, a rolling deploy kills the process mid-request and leaves
 * Postgres connections to time out on their own.
 */
const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received, shutting down gracefully`);

  // A connection that refuses to drain should not hang a deploy forever.
  // `unref` keeps this timer from holding the loop open on a clean exit.
  const forceExit = setTimeout(() => {
    console.error('Shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close((err) => {
    void (async () => {
      if (err) console.error('Error closing HTTP server:', err);
      await prisma.$disconnect();
      console.log('Shutdown complete');
      process.exit(err ? 1 : 0);
    })();
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
