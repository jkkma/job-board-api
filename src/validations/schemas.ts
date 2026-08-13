import { z } from 'zod';

// bcrypt silently truncates anything past 72 bytes, so accepting longer input
// would mean the tail of a long password is never actually checked.
const BCRYPT_MAX_PASSWORD_BYTES = 72;

export const registerSchema = z.object({
  email: z.email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(BCRYPT_MAX_PASSWORD_BYTES, 'Password must be at most 72 characters'),
  role: z.enum(['EMPLOYER', 'APPLICANT'], { message: 'Role must be EMPLOYER or APPLICANT' }),
  name: z.string().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  // Deliberately not enforcing the register policy here: an account created
  // under an older rule should fail with 401 on the credentials, not 400 on
  // the shape of the request.
  password: z.string().min(1, 'Password is required'),
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
  coverLetter: z.string().max(5000, 'Cover letter must be at most 5000 characters').optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED'], { message: 'Status must be ACCEPTED or REJECTED' }),
});

export const idParamSchema = z.object({
  id: z.uuid('Invalid ID format'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type ApplyInput = z.infer<typeof applySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
