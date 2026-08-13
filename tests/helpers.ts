import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Role, User, Job, Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { env } from '../src/config/env';
import { buildApp } from '../src/app';

export const app = buildApp();

export const TEST_PASSWORD = 'password123';

let sequence = 0;
export const uniqueEmail = (prefix = 'user'): string => `${prefix}-${++sequence}@example.com`;

export interface TestUser {
  user: User;
  token: string;
  /** Ready-made header value: `Bearer <token>`. */
  auth: string;
}

/**
 * Creates a user and mints a token for them directly.
 *
 * Going through POST /auth/login would work but costs a bcrypt comparison on
 * every call, and the token claims are the same either way.
 */
export const createUser = async (
  role: Role,
  overrides: Partial<Prisma.UserCreateInput> = {}
): Promise<TestUser> => {
  const user = await prisma.user.create({
    data: {
      email: uniqueEmail(role.toLowerCase()),
      password: await bcrypt.hash(TEST_PASSWORD, env.BCRYPT_ROUNDS),
      role,
      name: `Test ${role}`,
      ...overrides,
    },
  });

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });

  return { user, token, auth: `Bearer ${token}` };
};

export const createEmployer = (overrides?: Partial<Prisma.UserCreateInput>): Promise<TestUser> =>
  createUser('EMPLOYER', overrides);

export const createApplicant = (overrides?: Partial<Prisma.UserCreateInput>): Promise<TestUser> =>
  createUser('APPLICANT', overrides);

export const createJob = (
  employerId: string,
  overrides: Partial<Prisma.JobUncheckedCreateInput> = {}
): Promise<Job> =>
  prisma.job.create({
    data: {
      title: 'Test Engineer',
      description: 'A description comfortably longer than the ten character minimum.',
      employerId,
      ...overrides,
    },
  });

/** Signs a token with the wrong secret, to stand in for a forged one. */
export const forgedToken = (userId: string): string =>
  jwt.sign({ id: userId, email: 'attacker@example.com', role: 'EMPLOYER' }, 'a-different-secret', {
    algorithm: 'HS256',
    expiresIn: '1h',
  });

/** Signs a token that expired an hour ago. */
export const expiredToken = (user: User): string =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '-1h',
  });
