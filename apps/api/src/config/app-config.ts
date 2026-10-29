import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Development and test defaults for variables that are required in
 * production. They point at the local Docker Compose services.
 */
const DEVELOPMENT_DEFAULTS = {
  // Mailpit (docker-compose.yml): catches every email, nothing leaves the
  // machine. Inbox at http://localhost:8025.
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'Mi consulta <no-reply@localhost>',
  // The Vite dev server, which proxies /api.
  APP_ORIGIN: 'http://localhost:4200',
} as const;

const REQUIRED_IN_PRODUCTION = [
  'WEB_DIST_DIR',
  'SMTP_URL',
  'MAIL_FROM',
  'APP_ORIGIN',
] as const;

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // Absolute path to the built web app (apps/web/dist). Served by the API
    // in production only.
    WEB_DIST_DIR: z.string().min(1).optional(),
    // SMTP server for transactional email: `smtps://` for implicit TLS
    // (port 465), `smtp://` for STARTTLS or local servers. Credentials go in
    // the URL.
    SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
    // Sender of every email, e.g. `Mi consulta <no-reply@example.com>`.
    MAIL_FROM: z.string().trim().min(1).optional(),
    // Public origin of the app (scheme, host and port, no path), used to
    // build the links in emails.
    APP_ORIGIN: z
      .url({ protocol: /^https?$/ })
      .refine((value) => new URL(value).origin === value, {
        message: 'Must be an origin without a path or trailing slash',
      })
      .optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') {
      return;
    }
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Required in production',
        });
      }
    }
  })
  .transform((env) => ({
    ...env,
    SMTP_URL: env.SMTP_URL ?? DEVELOPMENT_DEFAULTS.SMTP_URL,
    MAIL_FROM: env.MAIL_FROM ?? DEVELOPMENT_DEFAULTS.MAIL_FROM,
    APP_ORIGIN: env.APP_ORIGIN ?? DEVELOPMENT_DEFAULTS.APP_ORIGIN,
  }));

export type AppConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables. Fails fast on startup with the names of
 * the invalid variables; values are never included because they may be
 * secrets.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
