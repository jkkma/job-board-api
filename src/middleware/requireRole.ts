import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { ApiError } from '../lib/ApiError';

/**
 * Role gate. Must be mounted after `authenticateToken`.
 *
 * Keeping this at the route level rather than inside a controller means the
 * authorization rule for an endpoint is visible in the router, where it can be
 * read (and audited) without opening the handler.
 */
export const requireRole =
  (...roles: [Role, ...Role[]]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(`This action requires the ${roles.join(' or ')} role`);
    }

    next();
  };
