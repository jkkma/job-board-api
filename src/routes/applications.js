const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  applyToJob,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus
} = require('../controllers/applicationController');

const router = express.Router();

// Applicant routes
router.post('/', authenticateToken, applyToJob);
router.get('/my', authenticateToken, getMyApplications);

// Employer routes
router.get('/job/:id', authenticateToken, getJobApplications);
router.patch('/:id/status', authenticateToken, updateApplicationStatus);

module.exports = router;