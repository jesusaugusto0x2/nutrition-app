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
  // No proxy in front of the API: the client is the socket's peer.
  CLIENT_IP_SOURCE: 'socket',
} as const;

const REQUIRED_IN_PRODUCTION = [
  'WEB_DIST_DIR',
  'SMTP_URL',
  'MAIL_FROM',
  'APP_ORIGIN',
  'CLIENT_IP_SOURCE',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

/**
 * `sslmode` values a production `DATABASE_URL` may state. `verify-full` is
 * the real one (Neon, docs/deployment.md "Database (Neon)"): pg 8 treats
 * `require` as `verify-full` with a warning, but pg 9 adopts libpq's meaning
 * and would stop checking the certificate, so `require` is rejected.
 * `disable` exists for the CI smoke test, which runs the production image
 * against a local Postgres without TLS; it is visible in review.
 */
const PRODUCTION_SSL_MODES = new Set(['verify-full', 'disable']);

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
    // build the links in emails and to reject cross-site writes (`CsrfGuard`).
    APP_ORIGIN: z
      .url({ protocol: /^https?$/ })
      .refine((value) => new URL(value).origin === value, {
        message: 'Must be an origin without a path or trailing slash',
      })
      .optional(),
    // Where the client IP for rate limiting comes from. `x-real-ip` behind
    // Railway's edge, which overwrites that header on every public request
    // (its hop count is not fixed, so `trust proxy` cannot be used);
    // `socket` when nothing sits in front of the API.
    CLIENT_IP_SOURCE: z.enum(['socket', 'x-real-ip']).optional(),
    // OAuth client of type "Web application" (docs/authentication.md, "Google:
    // OpenID Connect"). Without them the Google routes answer 404, which is
    // only allowed outside production.
    GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    // One without the other is a typo, not a choice to leave Google off.
    if (!env.GOOGLE_CLIENT_ID !== !env.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: [
          env.GOOGLE_CLIENT_ID ? 'GOOGLE_CLIENT_SECRET' : 'GOOGLE_CLIENT_ID',
        ],
        message: 'Google needs both the client id and the client secret',
      });
    }
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
    const sslMode = URL.canParse(env.DATABASE_URL)
      ? new URL(env.DATABASE_URL).searchParams.get('sslmode')
      : null;
    if (!sslMode || !PRODUCTION_SSL_MODES.has(sslMode)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'Must set sslmode=verify-full in production',
      });
    }
  })
  .transform((env) => ({
    ...env,
    SMTP_URL: env.SMTP_URL ?? DEVELOPMENT_DEFAULTS.SMTP_URL,
    MAIL_FROM: env.MAIL_FROM ?? DEVELOPMENT_DEFAULTS.MAIL_FROM,
    APP_ORIGIN: env.APP_ORIGIN ?? DEVELOPMENT_DEFAULTS.APP_ORIGIN,
    CLIENT_IP_SOURCE:
      env.CLIENT_IP_SOURCE ?? DEVELOPMENT_DEFAULTS.CLIENT_IP_SOURCE,
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
