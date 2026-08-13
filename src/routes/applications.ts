import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import {
  applyToJob,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus,
} from '../controllers/applicationController';
import { applySchema, updateStatusSchema, idParamSchema } from '../validations/schemas';

const router = express.Router();

// Applicants
router.post(
  '/',
  authenticateToken,
  requireRole('APPLICANT'),
  validate({ body: applySchema }),
  applyToJob
);
router.get('/my', authenticateToken, getMyApplications);

// Employers — ownership of the underlying job is checked in the controller.
router.get(
  '/job/:id',
  authenticateToken,
  requireRole('EMPLOYER'),
  validate({ params: idParamSchema }),
  getJobApplications
);
router.patch(
  '/:id/status',
  authenticateToken,
  requireRole('EMPLOYER'),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  updateApplicationStatus
);

export default router;
