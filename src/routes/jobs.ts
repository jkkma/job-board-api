import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createJob, getJobs, getJobById, updateJob, deleteJob } from '../controllers/jobController';
import { createJobSchema, updateJobSchema } from '../validations/schemas';

const router = express.Router();

// Public
router.get('/', getJobs);
router.get('/:id', getJobById);

// Protected
router.post('/', authenticateToken, validate(createJobSchema), createJob);
router.put('/:id', authenticateToken, validate(updateJobSchema), updateJob);
router.delete('/:id', authenticateToken, deleteJob);

export default router;
