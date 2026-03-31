const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { createJob, getJobs, getJobById, updateJob, deleteJob } = require('../controllers/jobController');

const router = express.Router();

// Public routes
router.get('/', getJobs);
router.get('/:id', getJobById);

// Protected routes (only employers can create/update/delete their own jobs)
router.post('/', authenticateToken, createJob);
router.put('/:id', authenticateToken, updateJob);
router.delete('/:id', authenticateToken, deleteJob);

module.exports = router;