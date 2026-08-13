import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { ApiError } from '../lib/ApiError';
import type { RegisterInput, LoginInput } from '../validations/schemas';

/**
 * A real hash to compare against when the email doesn't exist, so a failed
 * lookup costs the same wall-clock time as a wrong password. Without it, the
 * response time alone tells an attacker which emails are registered.
 */
const DUMMY_HASH = bcrypt.hashSync('__no_such_user__', env.BCRYPT_ROUNDS);

const PUBLIC_USER_FIELDS = {
  id: true,
  email: true,
  role: true,
  name: true,
  createdAt: true,
} as const;

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, role, name } = req.body as RegisterInput;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    throw ApiError.conflict('An account with that email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  // Selecting explicitly keeps the password hash from being read into memory
  // at all, rather than fetching it and remembering not to serialize it.
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, role, name: name ?? null },
    select: PUBLIC_USER_FIELDS,
  });

  res.status(201).json({ message: 'User registered successfully', user });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({ where: { email } });

  // Both branches below return the identical error, deliberately: telling the
  // caller *which* half was wrong turns login into an account-enumeration API.
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw ApiError.unauthorized('Invalid email or password');
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, email: user.email, role: user.role, name: user.name },
  });
};

export const me = async (req: Request, res: Response): Promise<void> => {
  // Read from the database rather than echoing the token claims: a token issued
  // before a role change still carries the old role.
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: PUBLIC_USER_FIELDS,
  });

  if (!user) {
    throw ApiError.unauthorized('Account no longer exists');
  }

  res.json({ user });
};
