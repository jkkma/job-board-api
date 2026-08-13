import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { openapiSpec } from './docs/openapi';
import { renderLandingPage } from './docs/landing';

import authRoutes from './routes/auth';
import jobRoutes from './routes/jobs';
import applicationRoutes from './routes/applications';
import healthRoutes from './routes/health';
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

  // Mounted ahead of the global helmet on purpose: Swagger UI ships inline
  // styles and scripts that helmet's default Content-Security-Policy blocks,
  // which renders /docs blank. Scoping the relaxation to this one path keeps
  // the strict policy everywhere else.
  app.use(
    '/docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, {
      customSiteTitle: 'Job Board API — reference',
      swaggerOptions: { persistAuthorization: true },
    })
  );

  app.use(helmet());

  app.get('/openapi.json', (_req, res) => {
    res.json(openapiSpec);
  });

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

  // Content-negotiated on purpose. A browser lands on a page that explains what
  // this is and links to /docs; curl, fetch, and anything else sending `*/*`
  // keep the JSON discovery document unchanged, so the root stays a usable API
  // endpoint rather than becoming a wall of markup.
  //
  // The array order matters: `req.accepts` falls back to the first entry when
  // the client expresses no preference, which is what keeps `*/*` on JSON.
  app.get('/', (req, res) => {
    if (req.accepts(['json', 'html']) === 'html') {
      res.type('html').send(renderLandingPage(`${req.protocol}://${req.get('host') ?? ''}`));
      return;
    }

    res.json({ message: 'Job Board API', version: 'v1', docs: '/docs' });
  });

  // Probes live outside /api — they are infrastructure, not part of the API
  // contract, and should not be versioned alongside it.
  app.use('/health', healthRoutes);

  app.use('/api/v1/auth', createAuthLimiter(options.authRateLimitMax), authRoutes);
  app.use('/api/v1/jobs', jobRoutes);
  app.use('/api/v1/applications', applicationRoutes);

  // Order matters: unmatched routes become a 404 ApiError, which the error
  // handler then renders in the same envelope as every other failure.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
