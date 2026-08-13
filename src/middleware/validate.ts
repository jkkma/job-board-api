import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';

/**
 * Validates `req.body` against a Zod schema, replacing it with the parsed
 * result so unknown keys are stripped before a controller ever sees them.
 *
 * A `ZodError` is thrown rather than answered here — `errorHandler` owns the
 * translation to a 400, so the response shape is defined in exactly one place.
 */
export const validate =
  (schema: ZodType) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
