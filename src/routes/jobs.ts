import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { createJob, getJobs, getJobById, updateJob, deleteJob } from '../controllers/jobController';
import {
  createJobSchema,
  updateJobSchema,
  jobQuerySchema,
  idParamSchema,
} from '../validations/schemas';

const router = express.Router();

// Public
router.get('/', validate({ query: jobQuerySchema }), getJobs);
router.get('/:id', validate({ params: idParamSchema }), getJobById);

// Employers only. Without requireRole, any authenticated APPLICANT could post
// jobs and become their own "employer".
router.post(
  '/',
  authenticateToken,
  requireRole('EMPLOYER'),
  validate({ body: createJobSchema }),
  createJob
);
router.put(
  '/:id',
  authenticateToken,
  requireRole('EMPLOYER'),
  validate({ params: idParamSchema, body: updateJobSchema }),
  updateJob
);
router.delete(
  '/:id',
  authenticateToken,
  requireRole('EMPLOYER'),
  validate({ params: idParamSchema }),
  deleteJob
);

export default router;
