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
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
  } catch {
    throw new ApiError(403, 'FORBIDDEN', 'Invalid or expired token');
  }

  next();
};
