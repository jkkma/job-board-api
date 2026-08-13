import type { Role } from '@prisma/client';

/**
 * The claims we put in the JWT and read back out in `authenticateToken`.
 * Deliberately minimal — anything that can go stale (like `role`) should be
 * re-read from the database rather than trusted from the token.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

/** Output of the `validate` middleware. See src/middleware/validate.ts. */
export interface ValidatedRequestData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticateToken`. Undefined on public routes. */
      user?: AuthUser;
      /** Set by `validate`. Undefined on routes with no schema attached. */
      validated?: ValidatedRequestData;
    }
  }
}
