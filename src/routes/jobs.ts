import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { createJob, getJobs, getJobById, updateJob, deleteJob } from '../controllers/jobController';
import { createJobSchema, updateJobSchema } from '../validations/schemas';

const router = express.Router();

// Public
router.get('/', getJobs);
router.get('/:id', getJobById);

// Employers only. Without requireRole, any authenticated APPLICANT could post
// jobs and become their own "employer".
router.post('/', authenticateToken, requireRole('EMPLOYER'), validate(createJobSchema), createJob);
router.put(
  '/:id',
  authenticateToken,
  requireRole('EMPLOYER'),
  validate(updateJobSchema),
  updateJob
);
router.delete('/:id', authenticateToken, requireRole('EMPLOYER'), deleteJob);

export default router;
