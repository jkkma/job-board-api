import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/ApiError';
import type { CreateJobInput, UpdateJobInput } from '../validations/schemas';

export const createJob = async (req: Request, res: Response): Promise<void> => {
  const { title, description, location, salary, type } = req.body as CreateJobInput;
  const employerId = req.user!.id;

  const job = await prisma.job.create({
    data: { title, description, location, salary, type, employerId },
    include: { employer: { select: { name: true, email: true } } },
  });

  res.status(201).json(job);
};

export const getJobs = async (req: Request, res: Response): Promise<void> => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const location = typeof req.query.location === 'string' ? req.query.location : undefined;

  const where: Prisma.JobWhereInput = {
    isActive: true,
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(location && { location: { contains: location, mode: 'insensitive' } }),
  };

  const jobs = await prisma.job.findMany({
    where,
    include: { employer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(jobs);
};

export const getJobById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: { employer: { select: { name: true, email: true } } },
  });
  if (!job) throw ApiError.notFound('Job not found');

  res.json(job);
};

export const updateJob = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, description, location, salary, type, isActive } = req.body as UpdateJobInput;

  const job = await prisma.job.findUnique({ where: { id }, select: { employerId: true } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.employerId !== req.user!.id) throw ApiError.forbidden();

  const updated = await prisma.job.update({
    where: { id },
    data: { title, description, location, salary, type, isActive },
    include: { employer: { select: { name: true } } },
  });

  res.json(updated);
};

export const deleteJob = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;

  const job = await prisma.job.findUnique({ where: { id }, select: { employerId: true } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.employerId !== req.user!.id) throw ApiError.forbidden();

  await prisma.job.delete({ where: { id } });

  res.json({ message: 'Job deleted' });
};
