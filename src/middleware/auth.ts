import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../lib/ApiError';
import type { AuthUser } from '../types/express';

export const authenticateToken = (req: Request, _res: Response, next: NextFunction): void => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Access token required');
  }

  try {
    // Pinning the algorithm keeps a forged header from selecting a weaker one.
    req.user = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as AuthUser;
  } catch {
    // 401, not 403: the caller failed to authenticate. 403 is reserved for a
    // caller we *did* identify who is not allowed to do this.
    throw ApiError.unauthorized('Invalid or expired token');
  }

  next();
};
