import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  QUAYNT_EDITION: z.enum(['community', 'cloud', 'commercial', 'enterprise']).default('community'),
  RATE_LIMIT_POINTS: z.coerce.number().default(100),
  RATE_LIMIT_DURATION: z.coerce.number().default(60),
  CORS_ALLOWED_ORIGINS: z.string().default('*'),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().default(10_000),
  WEBHOOK_MAX_PAYLOAD_SIZE: z.coerce.number().default(65_536),
  ADAPTER_ENCRYPTION_KEY: z.string().length(64).optional(),
  ALERT_MAX_RULES_PER_WORKSPACE: z.coerce.number().default(25),
  EMAIL_ENABLED: z.coerce.boolean().default(false),
  EMAIL_FROM: z.string().default('Quaynt <notifications@quaynt.com>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_TLS: z.coerce.boolean().default(false),
  REPORT_STORAGE_PATH: z.string().default('./data/reports'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

function parseEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    console.error('Invalid environment variables:', formatted);
    throw new Error('Invalid environment variables');
  }

  cached = parsed.data;

  if (cached.NODE_ENV === 'production' && cached.CORS_ALLOWED_ORIGINS === '*') {
    console.warn(
      '[security] CORS_ALLOWED_ORIGINS is set to wildcard (*) in production. ' +
        'Consider restricting to specific origins for session-authenticated endpoints. ' +
        'See docs/deployment.md for guidance.'
    );
  }

  return cached;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return parseEnv()[prop as keyof Env];
  },
});
