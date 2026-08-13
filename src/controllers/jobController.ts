import type { Request, Response } from 'express';
import { PrismaClient, type Prisma } from '@prisma/client';
import type { CreateJobInput, UpdateJobInput } from '../validations/schemas';

const prisma = new PrismaClient();

export const createJob = async (req: Request, res: Response): Promise<void> => {
  const { title, description, location, salary, type } = req.body as CreateJobInput;
  const employerId = req.user!.id;

  try {
    const job = await prisma.job.create({
      data: { title, description, location, salary, type, employerId },
      include: { employer: { select: { name: true, email: true } } },
    });
    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create job' });
  }
};

export const getJobs = async (req: Request, res: Response): Promise<void> => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const location = typeof req.query.location === 'string' ? req.query.location : undefined;

  try {
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
  } catch {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

export const getJobById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const job = await prisma.job.findUnique({
      where: { id },
      include: { employer: { select: { name: true, email: true } } },
    });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(job);
  } catch {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

export const updateJob = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, description, location, salary, type, isActive } = req.body as UpdateJobInput;

  try {
    // ownership check
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    if (job.employerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const updated = await prisma.job.update({
      where: { id },
      data: { title, description, location, salary, type, isActive },
      include: { employer: { select: { name: true } } },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update job' });
  }
};

export const deleteJob = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    if (job.employerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    await prisma.job.delete({ where: { id } });
    res.json({ message: 'Job deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete job' });
  }
};
