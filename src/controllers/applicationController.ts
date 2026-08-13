import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/ApiError';
import type { ApplyInput, UpdateStatusInput } from '../validations/schemas';

export const applyToJob = async (req: Request, res: Response): Promise<void> => {
  const { jobId, coverLetter } = req.body as ApplyInput;
  const applicantId = req.user!.id;

  // The APPLICANT role gate lives on the route (requireRole), not here.
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { isActive: true } });
  if (!job?.isActive) {
    throw ApiError.notFound('Job not found or closed');
  }

  // The duplicate case is caught by the @@unique([applicantId, jobId])
  // constraint and translated to a 409 by the error handler (Prisma P2002),
  // which avoids the check-then-insert race a manual lookup would leave open.
  const application = await prisma.application.create({
    data: { jobId, applicantId, coverLetter: coverLetter ?? null },
    include: {
      job: { select: { title: true } },
      applicant: { select: { name: true, email: true } },
    },
  });

  res.status(201).json(application);
};

export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
  const applications = await prisma.application.findMany({
    where: { applicantId: req.user!.id },
    include: { job: { select: { id: true, title: true, location: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(applications);
};

export const getJobApplications = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const { id: jobId } = req.params;

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { employerId: true } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.employerId !== req.user!.id) throw ApiError.forbidden();

  const applications = await prisma.application.findMany({
    where: { jobId },
    include: { applicant: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(applications);
};

export const updateApplicationStatus = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body as UpdateStatusInput;

  const application = await prisma.application.findUnique({
    where: { id },
    select: { job: { select: { employerId: true } } },
  });
  if (!application) throw ApiError.notFound('Application not found');
  if (application.job.employerId !== req.user!.id) throw ApiError.forbidden();

  const updated = await prisma.application.update({
    where: { id },
    data: { status },
    include: { applicant: { select: { id: true, name: true } } },
  });

  res.json(updated);
};
