import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { app, createEmployer, createApplicant, createJob } from './helpers';

const JOBS = '/api/v1/jobs';

describe('GET /jobs', () => {
  it('returns only active jobs, newest first', async () => {
    const { user } = await createEmployer();
    await createJob(user.id, { title: 'Older Job' });
    await createJob(user.id, { title: 'Newer Job' });
    await createJob(user.id, { title: 'Closed Job', isActive: false });

    const res = await request(app).get(JOBS);

    expect(res.status).toBe(200);
    expect(res.body.data.map((job: { title: string }) => job.title)).toEqual([
      'Newer Job',
      'Older Job',
    ]);
  });

  it('paginates with a meta envelope', async () => {
    const { user } = await createEmployer();
    for (let i = 0; i < 5; i++) await createJob(user.id, { title: `Job ${i}` });

    const first = await request(app).get(JOBS).query({ page: 1, limit: 2 });
    expect(first.body.data).toHaveLength(2);
    expect(first.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNext: true,
    });

    const last = await request(app).get(JOBS).query({ page: 3, limit: 2 });
    expect(last.body.data).toHaveLength(1);
    expect(last.body.meta.hasNext).toBe(false);
  });

  it('coerces limit to a number and rejects one over the cap', async () => {
    const { user } = await createEmployer();
    await createJob(user.id);

    // Query params arrive as strings; the schema coerces. This also guards the
    // Express 5 req.query getter trap — if the parsed value never reached the
    // controller, `limit` would fall back to its default of 20.
    const ok = await request(app).get(JOBS).query({ limit: '1' });
    expect(ok.status).toBe(200);
    expect(ok.body.meta.limit).toBe(1);

    const tooBig = await request(app).get(JOBS).query({ limit: 999 });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.error.details[0].path).toBe('limit');
  });

  it('searches across title and description', async () => {
    const { user } = await createEmployer();
    await createJob(user.id, { title: 'Rust Engineer', description: 'Systems work, low level.' });
    await createJob(user.id, { title: 'Data Analyst', description: 'Heavy PostgreSQL usage.' });

    const byTitle = await request(app).get(JOBS).query({ search: 'rust' });
    expect(byTitle.body.data.map((j: { title: string }) => j.title)).toEqual(['Rust Engineer']);

    const byDescription = await request(app).get(JOBS).query({ search: 'postgresql' });
    expect(byDescription.body.data.map((j: { title: string }) => j.title)).toEqual([
      'Data Analyst',
    ]);
  });

  it('filters by location, type, and salary floor', async () => {
    const { user } = await createEmployer();
    await createJob(user.id, {
      title: 'Berlin Contract',
      location: 'Berlin, DE',
      type: 'CONTRACT',
      salaryMax: 90_000,
    });
    await createJob(user.id, {
      title: 'Remote Intern',
      location: 'Remote',
      type: 'INTERNSHIP',
      salaryMax: 30_000,
    });

    const byLocation = await request(app).get(JOBS).query({ location: 'berlin' });
    expect(byLocation.body.data).toHaveLength(1);

    const byType = await request(app).get(JOBS).query({ type: 'INTERNSHIP' });
    expect(byType.body.data[0].title).toBe('Remote Intern');

    const bySalary = await request(app).get(JOBS).query({ salaryMin: 50_000 });
    expect(bySalary.body.data.map((j: { title: string }) => j.title)).toEqual(['Berlin Contract']);
  });

  it('rejects a sort field outside the allowlist', async () => {
    const res = await request(app).get(JOBS).query({ sort: 'password' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('sort');
  });
});

describe('GET /jobs/:id', () => {
  it('does not expose the employer email on this public route', async () => {
    const { user } = await createEmployer();
    const job = await createJob(user.id);

    const res = await request(app).get(`${JOBS}/${job.id}`);

    expect(res.status).toBe(200);
    expect(res.body.employer).toEqual({ id: user.id, name: user.name });
    expect(JSON.stringify(res.body)).not.toContain(user.email);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get(`${JOBS}/8ba1f109-4c4a-4b1e-9b9a-000000000000`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed id rather than a database error', async () => {
    const res = await request(app).get(`${JOBS}/not-a-uuid`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /jobs', () => {
  it('lets an EMPLOYER create a job', async () => {
    const { user, auth } = await createEmployer();

    const res = await request(app).post(JOBS).set('Authorization', auth).send({
      title: 'Backend Engineer',
      description: 'Build and maintain our API layer.',
      type: 'FULL_TIME',
      workMode: 'REMOTE',
      salaryMin: 80_000,
      salaryMax: 120_000,
    });

    expect(res.status).toBe(201);
    expect(res.body.employerId).toBe(user.id);
    expect(res.body.salaryMin).toBe(80_000);
  });

  it('refuses an APPLICANT with 403', async () => {
    // Regression test for the original bug: any authenticated user could post
    // jobs, which made them the "employer" of a listing they did not own.
    const { auth } = await createApplicant();

    const res = await request(app)
      .post(JOBS)
      .set('Authorization', auth)
      .send({ title: 'Fake Job', description: 'Should never be created at all.' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await prisma.job.count()).toBe(0);
  });

  it('refuses an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post(JOBS)
      .send({ title: 'Anonymous Job', description: 'No token supplied here.' });

    expect(res.status).toBe(401);
  });

  it('rejects a salary band where max is below min', async () => {
    const { auth } = await createEmployer();

    const res = await request(app).post(JOBS).set('Authorization', auth).send({
      title: 'Backwards Band',
      description: 'The salary range is inverted on purpose.',
      salaryMin: 100_000,
      salaryMax: 50_000,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('salaryMax');
  });
});

describe('PUT /jobs/:id', () => {
  it('lets the owner update', async () => {
    const { user, auth } = await createEmployer();
    const job = await createJob(user.id);

    const res = await request(app)
      .put(`${JOBS}/${job.id}`)
      .set('Authorization', auth)
      .send({ title: 'Retitled Job', isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Retitled Job');
    expect(res.body.isActive).toBe(false);
  });

  it('refuses a different employer with 403', async () => {
    const owner = await createEmployer();
    const stranger = await createEmployer();
    const job = await createJob(owner.user.id);

    const res = await request(app)
      .put(`${JOBS}/${job.id}`)
      .set('Authorization', stranger.auth)
      .send({ title: 'Hijacked Job' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /jobs/:id', () => {
  it('returns 204 and cascades the job applications', async () => {
    const { user, auth } = await createEmployer();
    const applicant = await createApplicant();
    const job = await createJob(user.id);
    await prisma.application.create({ data: { jobId: job.id, applicantId: applicant.user.id } });

    const res = await request(app).delete(`${JOBS}/${job.id}`).set('Authorization', auth);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(await prisma.application.count()).toBe(0);
  });

  it('refuses a non-owner with 403 and leaves the job alone', async () => {
    const owner = await createEmployer();
    const stranger = await createEmployer();
    const job = await createJob(owner.user.id);

    const res = await request(app).delete(`${JOBS}/${job.id}`).set('Authorization', stranger.auth);

    expect(res.status).toBe(403);
    expect(await prisma.job.count()).toBe(1);
  });
});
