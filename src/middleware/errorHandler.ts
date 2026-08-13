import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError, type ErrorCode } from '../lib/ApiError';
import { env } from '../config/env';

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/** Body-parser attaches a `type` discriminator to the errors it raises. */
interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

const response = (code: ErrorCode, message: string, details?: unknown): ErrorResponse => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

const translate = (err: unknown): { status: number; body: ErrorResponse } => {
  if (err instanceof ApiError) {
    return { status: err.statusCode, body: response(err.code, err.message, err.details) };
  }

  if (err instanceof z.ZodError) {
    return {
      status: 400,
      body: response(
        'VALIDATION_FAILED',
        'Validation failed',
        err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }))
      ),
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 unique constraint, P2025 record not found. Anything else is a bug
    // on our side rather than a client mistake, so it falls through to 500.
    if (err.code === 'P2002') {
      return { status: 409, body: response('CONFLICT', 'That record already exists') };
    }
    if (err.code === 'P2025') {
      return { status: 404, body: response('NOT_FOUND', 'Resource not found') };
    }
  }

  if (err instanceof Error) {
    const parserError = err as BodyParserError;

    // Without this branch, `curl -d '{bad json'` falls through to Express's
    // default handler and returns an HTML stack trace from a JSON API.
    if (parserError.type === 'entity.parse.failed') {
      return { status: 400, body: response('MALFORMED_JSON', 'Request body is not valid JSON') };
    }
    if (parserError.type === 'entity.too.large') {
      return { status: 413, body: response('PAYLOAD_TOO_LARGE', 'Request body is too large') };
    }
  }

  return {
    status: 500,
    body: response(
      'INTERNAL_ERROR',
      // Never surface an unexpected error's message in production — it can
      // carry connection strings, file paths, or query fragments.
      env.isProduction ? 'Internal server error' : ((err as Error)?.message ?? 'Unknown error')
    ),
  };
};

/** Catch-all for unmatched routes. Mounted after the routers, before `errorHandler`. */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
};

/**
 * The single place an error becomes a response.
 *
 * Note there is no `asyncHandler` wrapper anywhere in this codebase: Express 5
 * forwards rejected promises from async handlers to this middleware natively.
 * The wrapper is an Express 4 workaround and is not needed here.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const { status, body } = translate(err);

  if (status >= 500 && !env.isTest) {
    console.error(err);
  }

  res.status(status).json(body);
};
