import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * A single shared Prisma client.
 *
 * Each `new PrismaClient()` opens its own connection pool, so instantiating one
 * per module quietly multiplies the connection count. The `globalThis` cache
 * additionally keeps tsx/Vitest hot reloads from leaking a new pool on every
 * reload — in production the module is only evaluated once, so it is skipped.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
