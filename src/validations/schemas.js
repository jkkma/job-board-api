const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['EMPLOYER', 'APPLICANT'], { message: 'Role must be EMPLOYER or APPLICANT' }),
  name: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const createJobSchema = z.object({
  title: z.string().min(3, 'Title is required and must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  location: z.string().optional(),
  salary: z.string().optional(),
  type: z.string().optional()
});

const updateJobSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  location: z.string().optional(),
  salary: z.string().optional(),
  type: z.string().optional(),
  isActive: z.boolean().optional()
});

const applySchema = z.object({
  jobId: z.string().uuid('Invalid job ID format'),
  coverLetter: z.string().optional()
});

const updateStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED'], { message: 'Status must be ACCEPTED or REJECTED' })
});

module.exports = {
  registerSchema,
  loginSchema,
  createJobSchema,
  updateJobSchema,
  applySchema,
  updateStatusSchema
};