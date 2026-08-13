import type { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import type { ApplyInput, UpdateStatusInput } from '../validations/schemas';

const prisma = new PrismaClient();

export const applyToJob = async (req: Request, res: Response): Promise<void> => {
  const { jobId, coverLetter } = req.body as ApplyInput;
  const applicantId = req.user!.id;

  if (req.user!.role !== 'APPLICANT') {
    res.status(403).json({ error: 'Only applicants can apply' });
    return;
  }

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || !job.isActive) {
      res.status(404).json({ error: 'Job not found or closed' });
      return;
    }

    const application = await prisma.application.create({
      data: { jobId, applicantId, coverLetter: coverLetter ?? null },
      include: {
        job: { select: { title: true } },
        applicant: { select: { name: true, email: true } },
      },
    });

    res.status(201).json(application);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(400).json({ error: 'You already applied to this job' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to apply' });
  }
};

export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
  const applicantId = req.user!.id;

  const applications = await prisma.application.findMany({
    where: { applicantId },
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
  const employerId = req.user!.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.employerId !== employerId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

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
    include: { job: true },
  });

  if (!application || application.job.employerId !== req.user!.id) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { status },
    include: { applicant: { select: { name: true } } },
  });

  res.json(updated);
};
