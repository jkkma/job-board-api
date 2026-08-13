import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the application reads, in one place.
 *
 * Exported separately from the parsed result so it can be unit-tested without
 * the `process.exit` below.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // 32 characters is the minimum that makes an HS256 secret worth having.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Comma-separated allowlist. Unset means "reflect any origin", which is only
  // acceptable outside production — see src/app.ts.
  CORS_ORIGIN: z.string().optional(),

  // Hashing at cost 10 costs ~60ms per call, which makes a test suite that
  // registers users crawl. Tests drop this to 4.
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // Number of reverse proxies in front of the app. Must be an exact hop count,
  // never `true` — blindly trusting X-Forwarded-For lets a client spoof its own
  // IP and walk straight through the rate limiter. 0 means "no proxy".
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n  Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    console.error(`    ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  console.error('\n  Copy .env.example to .env and fill in the missing values.\n');
  process.exit(1);
}

const data = parsed.data;

export const env = Object.freeze({
  ...data,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  corsOrigins: data.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});
