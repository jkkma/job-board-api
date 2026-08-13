import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, createEmployer, TEST_PASSWORD, uniqueEmail } from './helpers';

const AUTH = '/api/v1/auth';

describe('POST /auth/register', () => {
  it('creates an APPLICANT and never returns the password', async () => {
    const email = uniqueEmail('new-applicant');

    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ email, password: TEST_PASSWORD, role: 'APPLICANT', name: 'Ada' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, role: 'APPLICANT', name: 'Ada' });
    expect(res.body.user).not.toHaveProperty('password');
    // Belt and braces: the hash must not appear anywhere in the payload.
    expect(JSON.stringify(res.body)).not.toContain('$2');
  });

  it('creates an EMPLOYER', async () => {
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ email: uniqueEmail('new-employer'), password: TEST_PASSWORD, role: 'EMPLOYER' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('EMPLOYER');
  });

  it('rejects a duplicate email with 409', async () => {
    const email = uniqueEmail('dupe');
    const payload = { email, password: TEST_PASSWORD, role: 'APPLICANT' };

    await request(app).post(`${AUTH}/register`).send(payload).expect(201);
    const res = await request(app).post(`${AUTH}/register`).send(payload);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects a short password with 400 and the documented issue shape', async () => {
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ email: uniqueEmail('weak'), password: 'short', role: 'APPLICANT' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toContainEqual({
      path: 'password',
      message: 'Password must be at least 8 characters',
    });
  });

  it('rejects a password over bcrypt 72-byte truncation limit', async () => {
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ email: uniqueEmail('long'), password: 'a'.repeat(73), role: 'APPLICANT' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('password');
  });

  it('rejects an unknown role with 400', async () => {
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ email: uniqueEmail('badrole'), password: TEST_PASSWORD, role: 'ADMIN' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({
      path: 'role',
      message: 'Role must be EMPLOYER or APPLICANT',
    });
  });
});

describe('POST /auth/login', () => {
  it('returns a token that actually authenticates', async () => {
    const { user } = await createEmployer();

    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');

    const me = await request(app)
      .get(`${AUTH}/me`)
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(user.id);
  });

  it('rejects a wrong password with 401', async () => {
    const { user } = await createEmployer();

    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: user.email, password: 'definitely-not-it' });

    expect(res.status).toBe(401);
  });

  it('answers identically for an unknown email and a wrong password', async () => {
    const { user } = await createEmployer();

    const wrongPassword = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: user.email, password: 'definitely-not-it' });

    const unknownEmail = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'nobody@example.com', password: 'definitely-not-it' });

    // Any difference here — status or body — turns login into an
    // account-enumeration oracle.
    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

describe('GET /auth/me', () => {
  it('returns the caller', async () => {
    const { user, auth } = await createEmployer();

    const res = await request(app).get(`${AUTH}/me`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email, role: 'EMPLOYER' });
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('reflects a role changed after the token was issued', async () => {
    // The token still says EMPLOYER; the database is the source of truth.
    const { user, auth } = await createEmployer();
    const { prisma } = await import('../src/lib/prisma');
    await prisma.user.update({ where: { id: user.id }, data: { role: 'APPLICANT' } });

    const res = await request(app).get(`${AUTH}/me`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('APPLICANT');
  });

  it('rejects a missing token with 401', async () => {
    const res = await request(app).get(`${AUTH}/me`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
