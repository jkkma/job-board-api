import { z } from 'zod';

// bcrypt silently truncates anything past 72 bytes, so accepting longer input
// would mean the tail of a long password is never actually checked.
const BCRYPT_MAX_PASSWORD_BYTES = 72;

export const MAX_PAGE_SIZE = 100;

const jobTypeEnum = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']);
const workModeEnum = z.enum(['ONSITE', 'HYBRID', 'REMOTE']);

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

const salaryBand = {
  salaryMin: z.coerce.number().int().nonnegative().optional(),
  salaryMax: z.coerce.number().int().nonnegative().optional(),
  salaryCurrency: z.string().length(3, 'Currency must be a 3-letter code').optional(),
};

const salaryBandIsOrdered = (data: { salaryMin?: number; salaryMax?: number }): boolean =>
  data.salaryMin === undefined || data.salaryMax === undefined || data.salaryMax >= data.salaryMin;

export const createJobSchema = z
  .object({
    title: z.string().min(3, 'Title is required and must be at least 3 characters').max(200),
    description: z.string().min(10, 'Description must be at least 10 characters').max(20_000),
    location: z.string().max(200).optional(),
    type: jobTypeEnum.optional(),
    workMode: workModeEnum.optional(),
    ...salaryBand,
  })
  .refine(salaryBandIsOrdered, {
    message: 'salaryMax must be greater than or equal to salaryMin',
    path: ['salaryMax'],
  });

export const updateJobSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).max(20_000).optional(),
    location: z.string().max(200).optional(),
    type: jobTypeEnum.optional(),
    workMode: workModeEnum.optional(),
    isActive: z.boolean().optional(),
    ...salaryBand,
  })
  .refine(salaryBandIsOrdered, {
    message: 'salaryMax must be greater than or equal to salaryMin',
    path: ['salaryMax'],
  });

/**
 * Sortable fields are an allowlist rather than free text — `orderBy` is
 * interpolated into the query, so accepting arbitrary column names would let a
 * caller order by, and therefore probe, anything in the table.
 */
export const jobSortSchema = z
  .enum(['createdAt', '-createdAt', 'salaryMax', '-salaryMax', 'title', '-title'])
  .default('-createdAt');

export const jobQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  location: z.string().trim().min(1).max(200).optional(),
  type: jobTypeEnum.optional(),
  workMode: workModeEnum.optional(),
  salaryMin: z.coerce.number().int().nonnegative().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE, `limit must be ${MAX_PAGE_SIZE} or less`)
    .default(20),
  sort: jobSortSchema,
});

/* -------------------------------------------------------------------------- */
/* Applications                                                               */
/* -------------------------------------------------------------------------- */

export const applySchema = z.object({
  jobId: z.uuid('Invalid job ID format'),
  coverLetter: z.string().max(5000, 'Cover letter must be at most 5000 characters').optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED'], { message: 'Status must be ACCEPTED or REJECTED' }),
});

/* -------------------------------------------------------------------------- */
/* Shared                                                                     */
/* -------------------------------------------------------------------------- */

/** Guards every `:id` route so a malformed id becomes a 400, not a Prisma 500. */
export const idParamSchema = z.object({
  id: z.uuid('Invalid ID format'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobQuery = z.infer<typeof jobQuerySchema>;
export type ApplyInput = z.infer<typeof applySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
