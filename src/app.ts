import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth';
import jobRoutes from './routes/jobs';
import applicationRoutes from './routes/applications';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { env } from './config/env';

/**
 * Builds the Express application without binding a port.
 *
 * Keeping `listen` out of here is what lets the test suite drive the app
 * in-process with supertest, and lets `server.ts` own the shutdown sequence.
 */
export const buildApp = (): Express => {
  const app = express();

  app.use(helmet());
  app.use(cors());

  // Request logs are noise in the test output.
  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({ message: 'Job Board API', docs: '/docs' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/applications', applicationRoutes);

  // Order matters: unmatched routes become a 404 ApiError, which the error
  // handler then renders in the same envelope as every other failure.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
