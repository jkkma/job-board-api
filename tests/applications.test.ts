import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { app, createEmployer, createApplicant, createJob } from './helpers';

const APPLICATIONS = '/api/v1/applications';
const UNKNOWN_ID = '8ba1f109-4c4a-4b1e-9b9a-000000000000';

describe('POST /applications', () => {
  it('lets an APPLICANT apply', async () => {
    const employer = await createEmployer();
    const applicant = await createApplicant();
    const job = await createJob(employer.user.id);

    const res = await request(app)
      .post(APPLICATIONS)
      .set('Authorization', applicant.auth)
      .send({ jobId: job.id, coverLetter: 'I would love to join.' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.applicant.id).toBe(applicant.user.id);
  });

  it('refuses an EMPLOYER with 403', async () => {
    const employer = await createEmployer();
    const job = await createJob(employer.user.id);

    const res = await request(app)
      .post(APPLICATIONS)
      .set('Authorization', employer.auth)
      .send({ jobId: job.id });

    expect(res.status).toBe(403);
    expect(await prisma.application.count()).toBe(0);
  });

  it('rejects a second application to the same job with 409', async () => {
    const employer = await createEmployer();
    const applicant = await createApplicant();
    const job = await createJob(employer.user.id);

    await request(app)
      .post(APPLICATIONS)
      .set('Authorization', applicant.auth)
      .send({ jobId: job.id })
      .expect(201);

    const res = await request(app)
      .post(APPLICATIONS)
      .set('Authorization', applicant.auth)
      .send({ jobId: job.id });

    // Enforced by the database's composite unique constraint, surfaced as a
    // 409 by the Prisma P2002 branch of the error handler.
    expect(res.status).toBe(409);
    expect(await prisma.application.count()).toBe(1);
  });

  it('returns 404 for a closed job', async () => {
    const employer = await createEmployer();
    const applicant = await createApplicant();
    const job = await createJob(employer.user.id, { isActive: false });

    const res = await request(app)
      .post(APPLICATIONS)
      .set('Authorization', applicant.auth)
      .send({ jobId: job.id });

    expect(res.status).toBe(404);
  });

  it('returns 404 for a job that does not exist', async () => {
    const applicant = await createApplicant();

    const res = await request(app)
      .post(APPLICATIONS)
      .set('Authorization', applicant.auth)
      .send({ jobId: UNKNOWN_ID });

    expect(res.status).toBe(404);
  });
});

describe('GET /applications/my', () => {
  it('returns only the calling applicant’s own applications', async () => {
    const employer = await createEmployer();
    const mine = await createApplicant();
    const theirs = await createApplicant();
    const job = await createJob(employer.user.id);

    await prisma.application.create({ data: { jobId: job.id, applicantId: mine.user.id } });
    await prisma.application.create({ data: { jobId: job.id, applicantId: theirs.user.id } });

    const res = await request(app).get(`${APPLICATIONS}/my`).set('Authorization', mine.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].job.id).toBe(job.id);
  });
});

describe('GET /applications/job/:id', () => {
  it('returns the applications for a job the caller owns', async () => {
    const employer = await createEmployer();
    const applicant = await createApplicant();
    const job = await createJob(employer.user.id);
    await prisma.application.create({ data: { jobId: job.id, applicantId: applicant.user.id } });

    const res = await request(app)
      .get(`${APPLICATIONS}/job/${job.id}`)
      .set('Authorization', employer.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].applicant.email).toBe(applicant.user.email);
  });

  it('refuses an employer who does not own the job with 403', async () => {
    const owner = await createEmployer();
    const stranger = await createEmployer();
    const job = await createJob(owner.user.id);

    const res = await request(app)
      .get(`${APPLICATIONS}/job/${job.id}`)
      .set('Authorization', stranger.auth);

    expect(res.status).toBe(403);
  });

  it('returns 404, not 403, for a job that does not exist', async () => {
    // The original code folded "no such job" into the not-authorized branch,
    // which contradicted how the job routes behave.
    const employer = await createEmployer();

    const res = await request(app)
      .get(`${APPLICATIONS}/job/${UNKNOWN_ID}`)
      .set('Authorization', employer.auth);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /applications/:id/status', () => {
  it('lets the owning employer accept an application', async () => {
    const employer = await createEmployer();
    const applicant = await createApplicant();
    const job = await createJob(employer.user.id);
    const application = await prisma.application.create({
      data: { jobId: job.id, applicantId: applicant.user.id },
    });

    const res = await request(app)
      .patch(`${APPLICATIONS}/${application.id}/status`)
      .set('Authorization', employer.auth)
      .send({ status: 'ACCEPTED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACCEPTED');
  });

  it('refuses an employer who does not own the underlying job with 403', async () => {
    const owner = await createEmployer();
    const stranger = await createEmployer();
    const applicant = await createApplicant();
    const job = await createJob(owner.user.id);
    const application = await prisma.application.create({
      data: { jobId: job.id, applicantId: applicant.user.id },
    });

    const res = await request(app)
      .patch(`${APPLICATIONS}/${application.id}/status`)
      .set('Authorization', stranger.auth)
      .send({ status: 'ACCEPTED' });

    expect(res.status).toBe(403);
    const unchanged = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(unchanged.status).toBe('PENDING');
  });

  it('rejects a status outside the allowed transitions', async () => {
    const employer = await createEmployer();
    const applicant = await createApplicant();
    const job = await createJob(employer.user.id);
    const application = await prisma.application.create({
      data: { jobId: job.id, applicantId: applicant.user.id },
    });

    const res = await request(app)
      .patch(`${APPLICATIONS}/${application.id}/status`)
      .set('Authorization', employer.auth)
      .send({ status: 'PENDING' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('status');
  });

  it('returns 404 for an application that does not exist', async () => {
    const employer = await createEmployer();

    const res = await request(app)
      .patch(`${APPLICATIONS}/${UNKNOWN_ID}/status`)
      .set('Authorization', employer.auth)
      .send({ status: 'ACCEPTED' });

    expect(res.status).toBe(404);
  });
});
