const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createJob = async (req, res) => {
  const { title, description, location, salary, type } = req.body;
  const employerId = req.user.id;

  try {
    const job = await prisma.job.create({
      data: {
        title,
        description,
        location,
        salary,
        type,
        employerId,
      },
      include: { employer: { select: { name: true, email: true } } }
    });
    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create job' });
  }
};

const getJobs = async (req, res) => {
  const { search, location } = req.query;
  try {
    const jobs = await prisma.job.findMany({
      where: {
        isActive: true,
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        }),
        ...(location && { location: { contains: location, mode: 'insensitive' } })
      },
      include: { employer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

const getJobById = async (req, res) => {
  const { id } = req.params;
  try {
    const job = await prisma.job.findUnique({
      where: { id },
      include: { employer: { select: { name: true, email: true } } }
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

const updateJob = async (req, res) => {
  const { id } = req.params;
  const { title, description, location, salary, type, isActive } = req.body;

  try {
    // ownership check
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.employerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.job.update({
      where: { id },
      data: { title, description, location, salary, type, isActive },
      include: { employer: { select: { name: true } } }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update job' });
  }
};

const deleteJob = async (req, res) => {
  const { id } = req.params;
  try {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.employerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.job.delete({ where: { id } });
    res.json({ message: 'Job deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete job' });
  }
};

module.exports = { createJob, getJobs, getJobById, updateJob, deleteJob };