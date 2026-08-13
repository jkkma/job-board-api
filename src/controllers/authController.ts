import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { ApiError } from '../lib/ApiError';
import type { RegisterInput, LoginInput } from '../validations/schemas';

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, role, name } = req.body as RegisterInput;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    throw ApiError.badRequest('User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  // Selecting explicitly keeps the password hash from being read into memory
  // at all, rather than fetching it and remembering not to serialize it.
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, role, name: name ?? null },
    select: { id: true, email: true, role: true, name: true, createdAt: true },
  });

  res.status(201).json({ message: 'User registered successfully', user });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw ApiError.badRequest('Invalid email or password');
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw ApiError.badRequest('Invalid email or password');
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, email: user.email, role: user.role, name: user.name },
  });
};
