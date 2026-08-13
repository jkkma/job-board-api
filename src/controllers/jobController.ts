import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/ApiError';
import { getQuery, getParams } from '../middleware/validate';
import type { CreateJobInput, UpdateJobInput, JobQuery, IdParam } from '../validations/schemas';

/** Public listing shape: employer name, never their email. */
const PUBLIC_EMPLOYER = { select: { id: true, name: true } } as const;

export const createJob = async (req: Request, res: Response): Promise<void> => {
  const data = req.body as CreateJobInput;

  const job = await prisma.job.create({
    data: { ...data, employerId: req.user!.id },
    include: { employer: PUBLIC_EMPLOYER },
  });

  res.status(201).json(job);
};

export const getJobs = async (req: Request, res: Response): Promise<void> => {
  const { search, location, type, workMode, salaryMin, page, limit, sort } =
    getQuery<JobQuery>(req);

  const where: Prisma.JobWhereInput = {
    isActive: true,
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(location && { location: { contains: location, mode: 'insensitive' } }),
    ...(type && { type }),
    ...(workMode && { workMode }),
    // "Pays at least X" — a job qualifies when the top of its advertised band
    // reaches the requested floor.
    ...(salaryMin !== undefined && { salaryMax: { gte: salaryMin } }),
  };

  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  const orderBy = { [field]: descending ? 'desc' : 'asc' } as Prisma.JobOrderByWithRelationInput;

  // One round trip for the page and its total, rather than two sequential ones.
  const [jobs, total] = await prisma.$transaction([
    prisma.job.findMany({
      where,
      include: { employer: PUBLIC_EMPLOYER },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.job.count({ where }),
  ]);

  res.json({
    data: jobs,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
    },
  });
};

export const getJobById = async (req: Request, res: Response): Promise<void> => {
  const { id } = getParams<IdParam>(req);

  const job = await prisma.job.findUnique({
    where: { id },
    // Name only. This route is public, so including the employer's email here
    // would publish every employer address in the database to anyone crawling
    // job listings.
    include: { employer: PUBLIC_EMPLOYER },
  });
  if (!job) throw ApiError.notFound('Job not found');

  res.json(job);
};

export const updateJob = async (req: Request, res: Response): Promise<void> => {
  const { id } = getParams<IdParam>(req);
  const data = req.body as UpdateJobInput;

  const job = await prisma.job.findUnique({ where: { id }, select: { employerId: true } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.employerId !== req.user!.id) throw ApiError.forbidden();

  const updated = await prisma.job.update({
    where: { id },
    data,
    include: { employer: PUBLIC_EMPLOYER },
  });

  res.json(updated);
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  const { id } = getParams<IdParam>(req);

  const job = await prisma.job.findUnique({ where: { id }, select: { employerId: true } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.employerId !== req.user!.id) throw ApiError.forbidden();

  // Cascade removes the job's applications (see prisma/schema.prisma).
  await prisma.job.delete({ where: { id } });

  res.status(204).send();
};
