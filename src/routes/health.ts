import express from 'express';
import { prisma } from '../lib/prisma';

const router = express.Router();

/**
 * Liveness: is the process up? Deliberately does no I/O — a liveness probe
 * that touches the database will restart a perfectly healthy container every
 * time Postgres hiccups.
 */
router.get('/', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/**
 * Readiness: can this instance actually serve traffic? This one *does* check
 * the database, so a load balancer stops sending requests to an instance that
 * cannot reach it.
 */
router.get('/ready', async (_req, res) => {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'up',
      latencyMs: Date.now() - startedAt,
    });
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
});

export default router;
