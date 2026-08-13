import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['EMPLOYER', 'APPLICANT'], { message: 'Role must be EMPLOYER or APPLICANT' }),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createJobSchema = z.object({
  title: z.string().min(3, 'Title is required and must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  location: z.string().optional(),
  salary: z.string().optional(),
  type: z.string().optional(),
});

export const updateJobSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  location: z.string().optional(),
  salary: z.string().optional(),
  type: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const applySchema = z.object({
  jobId: z.uuid('Invalid job ID format'),
  coverLetter: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED'], { message: 'Status must be ACCEPTED or REJECTED' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type ApplyInput = z.infer<typeof applySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
