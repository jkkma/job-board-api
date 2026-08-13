import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates any combination of body, query string, and route params.
 *
 * Parsed results land on `req.validated` rather than being written back over
 * the originals. That matters for `req.query`: in Express 5 it is a lazily
 * evaluated getter on the prototype, so assigning to it silently does nothing
 * and the handler would keep reading the raw, uncoerced values.
 *
 * A ZodError is thrown rather than answered here — `errorHandler` owns the
 * translation to a 400, so the response shape is defined in exactly one place.
 */
export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const validated = req.validated ?? {};

    if (schemas.params) {
      validated.params = schemas.params.parse(req.params);
    }
    if (schemas.query) {
      validated.query = schemas.query.parse(req.query);
    }
    if (schemas.body) {
      // `req.body` is a plain property, so replacing it here is safe and keeps
      // unknown keys from reaching the controller.
      req.body = schemas.body.parse(req.body);
      validated.body = req.body;
    }

    req.validated = validated;
    next();
  };

/** Typed accessors for the parsed values. Only valid behind `validate`. */
export const getQuery = <T>(req: Request): T => req.validated?.query as T;
export const getParams = <T>(req: Request): T => req.validated?.params as T;
