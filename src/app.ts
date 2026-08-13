import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth';
import jobRoutes from './routes/jobs';
import applicationRoutes from './routes/applications';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { createAuthLimiter } from './middleware/rateLimit';
import { env } from './config/env';

export interface AppOptions {
  /** Overrides the auth rate limit. Only used by the test that exercises the 429. */
  authRateLimitMax?: number;
}

/**
 * Builds the Express application without binding a port.
 *
 * Keeping `listen` out of here is what lets the test suite drive the app
 * in-process with supertest, and lets `server.ts` own the shutdown sequence.
 */
export const buildApp = (options: AppOptions = {}): Express => {
  const app = express();

  // An exact hop count, never `true`: see TRUST_PROXY_HOPS in src/config/env.ts.
  if (env.TRUST_PROXY_HOPS > 0) {
    app.set('trust proxy', env.TRUST_PROXY_HOPS);
  }

  app.use(helmet());

  app.use(
    cors({
      // An explicit allowlist when configured. With none set we reflect any
      // origin in development for convenience, but refuse in production rather
      // than silently shipping `Access-Control-Allow-Origin: *`.
      origin: env.corsOrigins ?? !env.isProduction,
    })
  );

  // Request logs are noise in the test output.
  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  // Nothing this API accepts is anywhere near 100kb; the default is unbounded.
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (_req, res) => {
    res.json({ message: 'Job Board API', version: 'v1', docs: '/docs' });
  });

  app.use('/api/v1/auth', createAuthLimiter(options.authRateLimitMax), authRoutes);
  app.use('/api/v1/jobs', jobRoutes);
  app.use('/api/v1/applications', applicationRoutes);

  // Order matters: unmatched routes become a 404 ApiError, which the error
  // handler then renders in the same envelope as every other failure.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
