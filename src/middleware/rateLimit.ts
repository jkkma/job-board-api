import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../config/env';
import { ApiError } from '../lib/ApiError';

/**
 * Throttles the credential endpoints. `/auth/login` and `/auth/register` are
 * the two routes where an unauthenticated caller can guess in a loop.
 *
 * The 429 is routed through `next()` rather than answered here so it comes out
 * of the same error handler — and therefore in the same envelope — as
 * everything else.
 */
export const createAuthLimiter = (max: number = env.AUTH_RATE_LIMIT_MAX): RateLimitRequestHandler =>
  rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(ApiError.tooManyRequests());
    },
  });
