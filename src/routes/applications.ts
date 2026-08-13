import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  applyToJob,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus,
} from '../controllers/applicationController';
import { applySchema, updateStatusSchema } from '../validations/schemas';

const router = express.Router();

// Applicant
router.post('/', authenticateToken, validate(applySchema), applyToJob);
router.get('/my', authenticateToken, getMyApplications);

// Employer
router.get('/job/:id', authenticateToken, getJobApplications);
router.patch(
  '/:id/status',
  authenticateToken,
  validate(updateStatusSchema),
  updateApplicationStatus
);

export default router;
