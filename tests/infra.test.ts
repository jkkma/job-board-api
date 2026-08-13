import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { app, createEmployer, forgedToken, expiredToken, TEST_PASSWORD } from './helpers';
import { buildApp } from '../src/app';
import { envSchema } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { ApiError } from '../src/lib/ApiError';
import { errorHandler } from '../src/middleware/errorHandler';
import { requireRole } from '../src/middleware/requireRole';

describe('error envelope', () => {
  it('answers an unknown route with JSON, not Express’s HTML 404', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.type).toBe('application/json');
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('answers a malformed JSON body with JSON, not an HTML stack trace', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "broken"');

    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });

  it('rejects an oversized body with 413', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'big@example.com', password: 'x'.repeat(200_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('renders an unexpected async throw as a 500 envelope', async () => {
    // Proves the claim in errorHandler.ts: Express 5 forwards a rejected
    // promise from an async handler on its own, so no asyncHandler wrapper is
    // needed for the error handler to see it.
    const scratch = express();
    scratch.get('/boom', async () => {
      await Promise.resolve();
      throw new Error('kaboom');
    });
    scratch.use(errorHandler);

    const res = await request(scratch).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it.each([
    ['P2002', 409, 'CONFLICT'],
    ['P2025', 404, 'NOT_FOUND'],
  ])('translates Prisma %s to %i', async (code, status, errorCode) => {
    // These fire on races the happy path cannot stage reliably — a row deleted
    // between an ownership check and the write that follows it.
    const scratch = express();
    scratch.get('/boom', () => {
      throw new Prisma.PrismaClientKnownRequestError('database said no', {
        code,
        clientVersion: 'test',
      });
    });
    scratch.use(errorHandler);

    const res = await request(scratch).get('/boom');

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(errorCode);
  });
});

describe('requireRole', () => {
  it('refuses with 401 when no authenticated user is present', async () => {
    // Guards against a route being wired with requireRole but without
    // authenticateToken in front of it — which would otherwise read
    // `undefined.role`.
    const scratch = express();
    scratch.get('/employers-only', requireRole('EMPLOYER'), (_req, res) => {
      res.json({ ok: true });
    });
    scratch.use(errorHandler);

    const res = await request(scratch).get('/employers-only');

    expect(res.status).toBe(401);
  });
});

describe('authentication failures', () => {
  it('rejects an expired token with 401', async () => {
    const { user } = await createEmployer();

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken(user)}`);

    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret with 401', async () => {
    const { user } = await createEmployer();

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${forgedToken(user.id)}`);

    expect(res.status).toBe(401);
  });

  it.each([
    ['no scheme', 'sometokenvalue'],
    ['wrong scheme', 'Basic dXNlcjpwYXNz'],
    ['scheme with no token', 'Bearer'],
  ])('rejects a malformed Authorization header (%s) with 401', async (_label, header) => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', header);

    expect(res.status).toBe(401);
  });
});

describe('rate limiting', () => {
  it('returns 429 through the shared error envelope once the limit is passed', async () => {
    // A dedicated app so the tiny limit cannot leak into the other suites.
    const limited = buildApp({ authRateLimitMax: 2 });
    const credentials = { email: 'nobody@example.com', password: TEST_PASSWORD };

    await request(limited).post('/api/v1/auth/login').send(credentials).expect(401);
    await request(limited).post('/api/v1/auth/login').send(credentials).expect(401);

    const res = await request(limited).post('/api/v1/auth/login').send(credentials);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('health probes', () => {
  it('reports liveness without touching the database', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('reports readiness including database state', async () => {
    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('reports 503 when the database is unreachable', async () => {
    const queryRaw = vi
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', database: 'down' });
    queryRaw.mockRestore();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('root route', () => {
  // Chrome, Firefox, and Safari all lead with text/html and rank */* below it.
  const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

  it('serves the landing page to a browser', async () => {
    const res = await request(app).get('/').set('Accept', BROWSER_ACCEPT);

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain('<title>Job Board API</title>');
    expect(res.text).toContain('href="/docs"');
    expect(res.text).toContain('href="/openapi.json"');
  });

  it.each([
    ['no Accept header at all', undefined],
    ['the */* that curl sends', '*/*'],
    ['an explicit application/json', 'application/json'],
  ])('still answers %s with the JSON discovery document', async (_label, accept) => {
    // The landing page is for humans. Anything that is not asking for HTML must
    // keep getting the payload the root has always returned, or every client
    // that probes `/` to discover the API breaks on a cosmetic change.
    const pending = request(app).get('/');
    const res = await (accept === undefined ? pending : pending.set('Accept', accept));

    expect(res.status).toBe(200);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ message: 'Job Board API', version: 'v1', docs: '/docs' });
  });

  it('keeps the landing page inside the strict CSP, which must allow inline styles', async () => {
    // Unlike /docs, the landing page is served behind the global helmet. It
    // carries no scripts so `script-src 'self'` costs it nothing, but its
    // stylesheet is a <style> block — if helmet's default style-src ever stops
    // allowing inline styles, the page renders unstyled rather than failing
    // loudly, so assert the grant rather than trusting it.
    const res = await request(app).get('/').set('Accept', BROWSER_ACCEPT);

    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("style-src 'self' https: 'unsafe-inline'");
  });

  it('points its curl examples at the host the request arrived on', async () => {
    const res = await request(app)
      .get('/')
      .set('Accept', BROWSER_ACCEPT)
      .set('Host', 'jobs.example.com');

    expect(res.text).toContain('curl http://jobs.example.com/api/v1/jobs');
  });

  it('escapes the Host header instead of reflecting it as markup', async () => {
    // The Host header is client-controlled even behind a proxy, and it is
    // interpolated into the page, so it goes through the same escaping as any
    // other untrusted string.
    const res = await request(app)
      .get('/')
      .set('Accept', BROWSER_ACCEPT)
      .set('Host', 'evil.example.com/"><script>alert(1)</script>');

    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('API documentation', () => {
  it('serves Swagger UI at /docs despite helmet’s CSP', async () => {
    // helmet's default Content-Security-Policy blocks Swagger UI's inline
    // styles and scripts, which renders the page blank. /docs is therefore
    // mounted ahead of the global helmet with its own relaxed policy — this
    // test is what catches a regression in that ordering.
    const res = await request(app).get('/docs/').redirects(1);

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('keeps the strict CSP on the rest of the app', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('serves the machine-readable spec at /openapi.json', async () => {
    const res = await request(app).get('/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/auth/register',
        '/auth/login',
        '/auth/me',
        '/jobs',
        '/jobs/{id}',
        '/applications',
        '/applications/my',
        '/applications/job/{id}',
        '/applications/{id}/status',
      ])
    );
  });
});

describe('configuration and errors', () => {
  it('rejects a JWT_SECRET that is too short to be worth having', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: 'too-short',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === 'JWT_SECRET')).toBe(true);
  });

  it('requires DATABASE_URL', () => {
    const result = envSchema.safeParse({
      JWT_SECRET: 'a-secret-that-is-definitely-long-enough-yes',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === 'DATABASE_URL')).toBe(true);
  });

  it('coerces numeric settings supplied as strings', () => {
    const result = envSchema.parse({
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: 'a-secret-that-is-definitely-long-enough-yes',
      PORT: '8080',
      BCRYPT_ROUNDS: '4',
    });

    expect(result.PORT).toBe(8080);
    expect(result.BCRYPT_ROUNDS).toBe(4);
  });

  it.each([
    [ApiError.badRequest('x'), 400],
    [ApiError.unauthorized(), 401],
    [ApiError.forbidden(), 403],
    [ApiError.notFound(), 404],
    [ApiError.conflict('x'), 409],
    [ApiError.tooManyRequests(), 429],
  ])('maps %s to its status code', (error, expected) => {
    expect(error.statusCode).toBe(expected);
  });
});
