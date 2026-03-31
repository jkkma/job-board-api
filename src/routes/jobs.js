const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createJob, getJobs, getJobById, updateJob, deleteJob } = require('../controllers/jobController');
const { createJobSchema, updateJobSchema } = require('../validations/schemas');

const router = express.Router();

// Public
router.get('/', getJobs);
router.get('/:id', getJobById);

// Protected
router.post('/', authenticateToken, validate(createJobSchema), createJob);
router.put('/:id', authenticateToken, validate(updateJobSchema), updateJob);
router.delete('/:id', authenticateToken, deleteJob);

module.exports = router;