const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  applyToJob,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus
} = require('../controllers/applicationController');
const { applySchema, updateStatusSchema } = require('../validations/schemas');

const router = express.Router();

// Applicant
router.post('/', authenticateToken, validate(applySchema), applyToJob);
router.get('/my', authenticateToken, getMyApplications);

// Employer
router.get('/job/:id', authenticateToken, getJobApplications);
router.patch('/:id/status', authenticateToken, validate(updateStatusSchema), updateApplicationStatus);

module.exports = router;