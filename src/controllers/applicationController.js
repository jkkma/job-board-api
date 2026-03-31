const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const applyToJob = async (req, res) => {
  const { jobId, coverLetter } = req.body;
  const applicantId = req.user.id;

  if (req.user.role !== 'APPLICANT') {
    return res.status(403).json({ error: 'Only applicants can apply' });
  }

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || !job.isActive) {
      return res.status(404).json({ error: 'Job not found or closed' });
    }

    const application = await prisma.application.create({
      data: {
        jobId,
        applicantId,
        coverLetter: coverLetter || null,
      },
      include: {
        job: { select: { title: true } },
        applicant: { select: { name: true, email: true } }
      }
    });

    res.status(201).json(application);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'You already applied to this job' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to apply' });
  }
};

const getMyApplications = async (req, res) => {
  const applicantId = req.user.id;

  const applications = await prisma.application.findMany({
    where: { applicantId },
    include: {
      job: { select: { id: true, title: true, location: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(applications);
};

const getJobApplications = async (req, res) => {
  const { id: jobId } = req.params;
  const employerId = req.user.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.employerId !== employerId) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const applications = await prisma.application.findMany({
    where: { jobId },
    include: {
      applicant: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(applications);
};

const updateApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const application = await prisma.application.findUnique({
    where: { id },
    include: { job: true }
  });

  if (!application || application.job.employerId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { status: status.toUpperCase() },
    include: { applicant: { select: { name: true } } }
  });

  res.json(updated);
};

module.exports = { applyToJob, getMyApplications, getJobApplications, updateApplicationStatus };